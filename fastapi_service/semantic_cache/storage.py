"""
SQLite storage backend for Semantic Cache entries and telemetry statistics.
Supports both pure Python `struct` binary packing and optional NumPy vector dot products.
"""
import sqlite3
import json
import time
import struct
from typing import List, Dict, Any, Optional, Tuple

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


def pack_vector(vec: Any) -> bytes:
    if HAS_NUMPY and isinstance(vec, np.ndarray):
        return vec.astype(np.float32).tobytes()
    dim = len(vec)
    return struct.pack(f"{dim}f", *vec)


def unpack_vector(blob: bytes, dim: int) -> Any:
    if HAS_NUMPY:
        return np.frombuffer(blob, dtype=np.float32)
    return struct.unpack(f"{dim}f", blob)


def compute_dot_product(u: Any, v: Any) -> float:
    if HAS_NUMPY and isinstance(u, np.ndarray) and isinstance(v, np.ndarray):
        return float(np.dot(u, v))
    return sum(a * b for a, b in zip(u, v))


class StorageEngine:
    def __init__(self, db_path: str = "semantic_cache.db"):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    query_text TEXT NOT NULL,
                    response_text TEXT NOT NULL,
                    embedding BLOB NOT NULL,
                    embedding_dim INTEGER NOT NULL,
                    created_at REAL NOT NULL,
                    last_accessed_at REAL NOT NULL,
                    ttl_seconds INTEGER NOT NULL,
                    hit_count INTEGER DEFAULT 0,
                    metadata_json TEXT
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON cache_entries(created_at DESC)")

            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache_stats (
                    id INTEGER PRIMARY KEY,
                    total_queries INTEGER DEFAULT 0,
                    cache_hits INTEGER DEFAULT 0,
                    cache_misses INTEGER DEFAULT 0,
                    total_latency_saved_ms REAL DEFAULT 0.0,
                    total_tokens_saved INTEGER DEFAULT 0,
                    total_cost_saved_usd REAL DEFAULT 0.0
                )
            """)
            conn.execute("INSERT OR IGNORE INTO cache_stats (id) VALUES (1)")
            conn.commit()

    def store_entry(
        self,
        query_text: str,
        response_text: str,
        embedding: Any,
        ttl_seconds: int = 3600,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        now = time.time()
        embedding_blob = pack_vector(embedding)
        metadata_json = json.dumps(metadata or {})

        with self._get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO cache_entries (
                    query_text, response_text, embedding, embedding_dim,
                    created_at, last_accessed_at, ttl_seconds, hit_count, metadata_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
            """, (query_text, response_text, embedding_blob, len(embedding), now, now, ttl_seconds, metadata_json))
            conn.commit()
            return cursor.lastrowid

    def find_similar(
        self,
        query_embedding: Any,
        threshold: float = 0.85
    ) -> Optional[Dict[str, Any]]:
        now = time.time()
        best_match = None
        best_score = -1.0
        dim = len(query_embedding)

        with self._get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, query_text, response_text, embedding, created_at, last_accessed_at,
                       ttl_seconds, hit_count, metadata_json
                FROM cache_entries
                WHERE embedding_dim = ? AND (ttl_seconds <= 0 OR created_at + ttl_seconds >= ?)
            """, (dim, now))

            rows = cursor.fetchall()
            for row in rows:
                stored_vec = unpack_vector(row["embedding"], dim)
                score = compute_dot_product(query_embedding, stored_vec)
                if score >= threshold and score > best_score:
                    best_score = score
                    best_match = dict(row)

            if best_match:
                conn.execute("""
                    UPDATE cache_entries
                    SET hit_count = hit_count + 1, last_accessed_at = ?
                    WHERE id = ?
                """, (now, best_match["id"]))
                conn.commit()
                best_match["similarity_score"] = best_score
                best_match["metadata"] = json.loads(best_match["metadata_json"] or "{}")
                del best_match["embedding"]
                del best_match["metadata_json"]
                return best_match

        return None

    def get_entries(
        self,
        limit: int = 100,
        offset: int = 0,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            if search and search.strip():
                cursor = conn.execute("""
                    SELECT id, query_text, response_text, created_at, last_accessed_at,
                           ttl_seconds, hit_count, metadata_json
                    FROM cache_entries
                    WHERE query_text LIKE ? OR response_text LIKE ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                """, (f"%{search}%", f"%{search}%", limit, offset))
            else:
                cursor = conn.execute("""
                    SELECT id, query_text, response_text, created_at, last_accessed_at,
                           ttl_seconds, hit_count, metadata_json
                    FROM cache_entries
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                """, (limit, offset))

            results = []
            for row in cursor.fetchall():
                d = dict(row)
                d["metadata"] = json.loads(d.pop("metadata_json") or "{}")
                results.append(d)
            return results

    def delete_entry(self, entry_id: int) -> bool:
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM cache_entries WHERE id = ?", (entry_id,))
            conn.commit()
            return cursor.rowcount > 0

    def clear(self) -> int:
        with self._get_connection() as conn:
            cursor = conn.execute("DELETE FROM cache_entries")
            conn.commit()
            return cursor.rowcount

    def update_stats(
        self,
        hit: bool,
        latency_saved_ms: float = 0.0,
        tokens_saved: int = 0,
        cost_saved_usd: float = 0.0
    ):
        with self._get_connection() as conn:
            if hit:
                conn.execute("""
                    UPDATE cache_stats
                    SET total_queries = total_queries + 1,
                        cache_hits = cache_hits + 1,
                        total_latency_saved_ms = total_latency_saved_ms + ?,
                        total_tokens_saved = total_tokens_saved + ?,
                        total_cost_saved_usd = total_cost_saved_usd + ?
                    WHERE id = 1
                """, (latency_saved_ms, tokens_saved, cost_saved_usd))
            else:
                conn.execute("""
                    UPDATE cache_stats
                    SET total_queries = total_queries + 1,
                        cache_misses = cache_misses + 1
                    WHERE id = 1
                """)
            conn.commit()

    def get_stats(self) -> Dict[str, Any]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM cache_stats WHERE id = 1").fetchone()
            if not row:
                return {
                    "total_queries": 0, "cache_hits": 0, "cache_misses": 0,
                    "hit_rate_pct": 0.0, "total_latency_saved_ms": 0.0,
                    "total_tokens_saved": 0, "total_cost_saved_usd": 0.0
                }
            d = dict(row)
            d.pop("id", None)
            total = d["total_queries"]
            d["hit_rate_pct"] = round((d["cache_hits"] / total * 100.0), 2) if total > 0 else 0.0
            d["total_latency_saved_ms"] = round(d["total_latency_saved_ms"], 2)
            d["total_cost_saved_usd"] = round(d["total_cost_saved_usd"], 6)
            return d
