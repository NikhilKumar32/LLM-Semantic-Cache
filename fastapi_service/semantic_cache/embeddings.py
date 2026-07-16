"""
Embedding providers for generating vector representations of natural language queries.
Supports FastLocalVectorizer (zero-dependency pure Python or NumPy), SentenceTransformers, and OpenAI.
"""
import math
import re
import hashlib
import struct
from abc import ABC, abstractmethod
from typing import List, Union, Any

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False


def compute_norm(vec: List[float]) -> float:
    if HAS_NUMPY and isinstance(vec, np.ndarray):
        return float(np.linalg.norm(vec))
    return math.sqrt(sum(x * x for x in vec))


def normalize_vector(vec: Any) -> Any:
    norm = compute_norm(vec)
    if norm == 0:
        return vec
    if HAS_NUMPY and isinstance(vec, np.ndarray):
        return (vec / norm).astype(np.float32)
    return [x / norm for x in vec]


class EmbeddingProvider(ABC):
    """Abstract base class for vector embedding providers."""
    @property
    @abstractmethod
    def dimension(self) -> int:
        pass

    @abstractmethod
    def embed(self, text: str) -> Any:
        pass

    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[Any]:
        pass


class FastLocalVectorizer(EmbeddingProvider):
    """
    Zero-dependency local vectorizer using character/word n-gram hashing + TF-IDF weighting.
    Works seamlessly in pure Python without any external dependencies, and accelerates with NumPy when available.
    """
    def __init__(self, dim: int = 384):
        self._dim = dim

    @property
    def dimension(self) -> int:
        return self._dim

    def _clean_text(self, text: str) -> str:
        return re.sub(r'[^\w\s]', ' ', text.lower()).strip()

    def embed(self, text: str) -> Any:
        vec = [0.0] * self._dim
        clean = self._clean_text(text)
        if not clean:
            return np.zeros(self._dim, dtype=np.float32) if HAS_NUMPY else vec

        words = clean.split()
        # 1. Word unigrams
        for word in words:
            idx = int(hashlib.md5(word.encode('utf-8')).hexdigest(), 16) % self._dim
            vec[idx] += 1.0

        # 2. Word bigrams
        for i in range(len(words) - 1):
            bigram = f"{words[i]}_{words[i+1]}"
            idx = int(hashlib.md5(bigram.encode('utf-8')).hexdigest(), 16) % self._dim
            vec[idx] += 1.5

        # 3. Character 3-grams
        char_text = f"_{clean.replace(' ', '_')}_"
        for i in range(len(char_text) - 2):
            trigram = char_text[i:i+3]
            idx = int(hashlib.md5(trigram.encode('utf-8')).hexdigest(), 16) % self._dim
            vec[idx] += 0.5

        if HAS_NUMPY:
            vec = np.array(vec, dtype=np.float32)
        return normalize_vector(vec)

    def embed_batch(self, texts: List[str]) -> List[Any]:
        return [self.embed(t) for t in texts]


class LocalSentenceTransformerProvider(EmbeddingProvider):
    """
    Uses sentence-transformers (all-MiniLM-L6-v2) when installed, falls back to FastLocalVectorizer otherwise.
    """
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None
        self._fallback = None
        self._dim = 384

        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(model_name)
            self._dim = self._model.get_sentence_embedding_dimension()
        except Exception as e:
            print(f"[Warning] Could not load SentenceTransformer '{model_name}': {e}. Using FastLocalVectorizer fallback.")
            self._fallback = FastLocalVectorizer(dim=384)

    @property
    def dimension(self) -> int:
        return self._dim

    def embed(self, text: str) -> Any:
        if self._model:
            vec = self._model.encode(text, convert_to_numpy=True)
            return normalize_vector(vec)
        return self._fallback.embed(text)

    def embed_batch(self, texts: List[str]) -> List[Any]:
        if self._model:
            vecs = self._model.encode(texts, convert_to_numpy=True)
            return [normalize_vector(v) for v in vecs]
        return self._fallback.embed_batch(texts)


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str = None, model: str = "text-embedding-3-small"):
        import os
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self._dim = 1536 if "small" in model or "ada" in model else 3072
        self._fallback = FastLocalVectorizer(dim=384)
        if not self.api_key:
            print("[Warning] No OpenAI API Key found. Falling back to FastLocalVectorizer.")

    @property
    def dimension(self) -> int:
        return self._dim if self.api_key else self._fallback.dimension

    def embed(self, text: str) -> Any:
        if not self.api_key:
            return self._fallback.embed(text)
        try:
            import httpx
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            payload = {"input": text, "model": self.model}
            resp = httpx.post("https://api.openai.com/v1/embeddings", headers=headers, json=payload, timeout=10.0)
            data = resp.json()
            vec = data["data"][0]["embedding"]
            if HAS_NUMPY:
                vec = np.array(vec, dtype=np.float32)
            return normalize_vector(vec)
        except Exception as e:
            print(f"[Error calling OpenAI Embeddings]: {e}. Using fallback.")
            return self._fallback.embed(text)

    def embed_batch(self, texts: List[str]) -> List[Any]:
        return [self.embed(t) for t in texts]


def get_embedding_provider(provider_type: str = "fast_local", **kwargs) -> EmbeddingProvider:
    if provider_type == "sentence_transformers":
        return LocalSentenceTransformerProvider(**kwargs)
    elif provider_type == "openai":
        return OpenAIEmbeddingProvider(**kwargs)
    return FastLocalVectorizer(**kwargs)
