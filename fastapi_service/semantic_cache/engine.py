"""
SemanticCache main orchestrator engine.
Coordinates embedding generation, vector similarity search, TTL expiration, and telemetry.
"""
from typing import Optional, Dict, Any, List
from .embeddings import get_embedding_provider, EmbeddingProvider
from .storage import StorageEngine


class CacheEntry:
    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id")
        self.query_text = data.get("query_text")
        self.response_text = data.get("response_text")
        self.similarity_score = data.get("similarity_score", 1.0)
        self.hit_count = data.get("hit_count", 0)
        self.created_at = data.get("created_at")
        self.metadata = data.get("metadata", {})

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "query_text": self.query_text,
            "response_text": self.response_text,
            "similarity_score": round(float(self.similarity_score), 4),
            "hit_count": self.hit_count,
            "created_at": self.created_at,
            "metadata": self.metadata
        }


class SemanticCache:
    def __init__(
        self,
        db_path: str = "semantic_cache.db",
        provider_type: str = "fast_local",
        similarity_threshold: float = 0.85,
        default_ttl: int = 3600,
        **provider_kwargs
    ):
        self.similarity_threshold = similarity_threshold
        self.default_ttl = default_ttl
        self.storage = StorageEngine(db_path=db_path)
        self.embedder: EmbeddingProvider = get_embedding_provider(provider_type, **provider_kwargs)

    def get(self, query: str, threshold: Optional[float] = None) -> Optional[CacheEntry]:
        """
        Check if query exists in semantic cache with similarity >= threshold.
        If found, returns CacheEntry and updates hit metrics.
        """
        eval_threshold = threshold if threshold is not None else self.similarity_threshold
        query_vec = self.embedder.embed(query)
        match = self.storage.find_similar(query_vec, threshold=eval_threshold)

        if match:
            # Estimate savings: ~450ms latency, ~120 tokens, ~$0.0003 cost
            self.storage.update_stats(
                hit=True,
                latency_saved_ms=450.0,
                tokens_saved=120,
                cost_saved_usd=0.00036
            )
            return CacheEntry(match)

        self.storage.update_stats(hit=False)
        return None

    def put(
        self,
        query: str,
        response: str,
        metadata: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None
    ) -> int:
        """
        Embed and persist a new query-response pair into the semantic cache.
        """
        entry_ttl = ttl if ttl is not None else self.default_ttl
        query_vec = self.embedder.embed(query)
        return self.storage.store_entry(
            query_text=query,
            response_text=response,
            embedding=query_vec,
            ttl_seconds=entry_ttl,
            metadata=metadata
        )

    def get_entries(self, limit: int = 100, offset: int = 0, search: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.storage.get_entries(limit=limit, offset=offset, search=search)

    def delete_entry(self, entry_id: int) -> bool:
        return self.storage.delete_entry(entry_id)

    def clear(self) -> int:
        return self.storage.clear()

    def get_stats(self) -> Dict[str, Any]:
        stats = self.storage.get_stats()
        stats["current_threshold"] = self.similarity_threshold
        stats["embedding_dimension"] = self.embedder.dimension
        return stats
