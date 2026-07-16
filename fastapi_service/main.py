"""
FastAPI Microservice Entrypoint for the LLM Semantic Cache Engine.
Exposes REST endpoints for querying, managing entries, checking telemetry, and live configuration.
"""
import time
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from semantic_cache import SemanticCache

app = FastAPI(
    title="LLM Semantic Cache API",
    description="High-speed semantic caching engine for LLM applications powered by vector embeddings and FastAPI.",
    version="1.0.0"
)

# Enable CORS for local development (MERN Gateway and React Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize global cache instance
cache = SemanticCache(
    db_path="semantic_cache.db",
    provider_type="fast_local",
    similarity_threshold=0.68
)


class QueryRequest(BaseModel):
    prompt: str = Field(..., description="The user query or prompt sent to the LLM.")
    model: Optional[str] = Field("gpt-4o-mini", description="Target LLM model name.")
    threshold: Optional[float] = Field(None, description="Override default similarity threshold for this query.")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Custom tags or metadata.")
    simulate_llm: Optional[bool] = Field(True, description="Simulate LLM response generation on cache miss if no external API key is set.")


class QueryResponse(BaseModel):
    prompt: str
    response: str
    cache_hit: bool
    similarity_score: float
    latency_ms: float
    entry_id: Optional[int]
    model: str
    metadata: Dict[str, Any]


class ConfigUpdateRequest(BaseModel):
    similarity_threshold: Optional[float] = Field(None, ge=0.1, le=1.0)
    default_ttl: Optional[int] = Field(None, ge=0)


@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "FastAPI Semantic Cache Engine",
        "version": "1.0.0",
        "stats": cache.get_stats()
    }


@app.post("/api/v1/query", response_model=QueryResponse)
def execute_query(payload: QueryRequest):
    start_time = time.perf_counter()
    
    # 1. Check Semantic Cache
    match = cache.get(payload.prompt, threshold=payload.threshold)
    if match:
        elapsed = (time.perf_counter() - start_time) * 1000.0
        return QueryResponse(
            prompt=payload.prompt,
            response=match.response_text,
            cache_hit=True,
            similarity_score=match.similarity_score,
            latency_ms=round(elapsed, 2),
            entry_id=match.id,
            model=payload.model or "cache",
            metadata=match.metadata
        )

    # 2. Cache Miss -> Generate or Simulate LLM response
    # Simulate realistic LLM latency if simulate_llm is true
    simulated_latency = 0.42  # ~420ms simulated generation time
    time.sleep(simulated_latency)

    # Generate helpful simulated or mock LLM response based on query semantics
    query_lower = payload.prompt.lower()
    if "sort" in query_lower and "python" in query_lower:
        llm_output = "To sort a list in Python, you can use either the `.sort()` method (sorts in-place) or the `sorted()` built-in function (returns a new sorted list). For example:\n```python\nnumbers = [3, 1, 4, 1, 5]\nnumbers.sort()  # In-place\nsorted_nums = sorted(numbers)  # New list\n```"
    elif "react" in query_lower and ("effect" in query_lower or "hook" in query_lower):
        llm_output = "In React, the `useEffect` hook allows you to perform side effects in functional components, such as fetching data or subscribing to events. Make sure to specify a dependency array `[]` so it only runs when necessary:\n```jsx\nuseEffect(() => {\n  fetchData();\n}, []);\n```"
    elif "fastapi" in query_lower:
        llm_output = "FastAPI is a modern, fast Python web framework based on standard Python type hints. It automatically generates interactive OpenAPI/Swagger documentation and provides high performance using Starlette and Pydantic."
    elif "mongodb" in query_lower or "mern" in query_lower:
        llm_output = "The MERN stack consists of MongoDB, Express.js, React, and Node.js. MongoDB provides flexible JSON-like document schemas that integrate seamlessly with Express and Node backends via Mongoose or the native MongoDB driver."
    else:
        llm_output = f"Simulated high-quality AI response for: '{payload.prompt}'. By using Semantic Caching, future queries with similar meaning will be answered instantly without repeating this LLM computation!"

    # 3. Store new entry into Semantic Cache
    entry_id = cache.put(
        query=payload.prompt,
        response=llm_output,
        metadata={"model": payload.model, "simulated": True, **payload.metadata}
    )

    elapsed = (time.perf_counter() - start_time) * 1000.0
    return QueryResponse(
        prompt=payload.prompt,
        response=llm_output,
        cache_hit=False,
        similarity_score=0.0,
        latency_ms=round(elapsed, 2),
        entry_id=entry_id,
        model=payload.model or "gpt-4o-mini",
        metadata={"model": payload.model, **payload.metadata}
    )


@app.get("/api/v1/cache/entries")
def list_cache_entries(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None)
):
    entries = cache.get_entries(limit=limit, offset=offset, search=search)
    return {"total": len(entries), "limit": limit, "offset": offset, "entries": entries}


@app.delete("/api/v1/cache/entries/{entry_id}")
def delete_cache_entry(entry_id: int):
    success = cache.delete_entry(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Cache entry {entry_id} not found.")
    return {"status": "success", "deleted_id": entry_id}


@app.post("/api/v1/cache/clear")
def clear_cache():
    count = cache.clear()
    return {"status": "success", "cleared_count": count}


@app.get("/api/v1/stats")
def get_stats():
    return cache.get_stats()


@app.post("/api/v1/config")
def update_config(config: ConfigUpdateRequest):
    if config.similarity_threshold is not None:
        cache.similarity_threshold = config.similarity_threshold
    if config.default_ttl is not None:
        cache.default_ttl = config.default_ttl
    return {"status": "updated", "current_config": cache.get_stats()}


@app.post("/api/v1/seed")
def seed_sample_entries():
    """Seeds the cache with initial high-quality sample query-response pairs for quick testing."""
    samples = [
        (
            "How do I sort a list in Python?",
            "To sort a list in Python, you can use the `.sort()` method for in-place sorting or the `sorted()` built-in function to return a new sorted list.\n```python\nmy_list = [5, 2, 8]\nmy_list.sort() # [2, 5, 8]\n```",
            {"category": "Python", "difficulty": "beginner"}
        ),
        (
            "What is the difference between sort() and sorted() in Python?",
            "The main difference is that `list.sort()` modifies the original list in place and returns `None`, whereas `sorted(iterable)` creates and returns a brand new sorted list without altering the original.",
            {"category": "Python", "difficulty": "intermediate"}
        ),
        (
            "Explain useEffect hook in React and how dependency array works.",
            "`useEffect(setup, dependencies)` lets you synchronize a component with an external system. If you pass `[]` as the second argument, the effect only runs once on mount. If you pass `[prop1, prop2]`, it re-runs whenever those specific values change.",
            {"category": "React", "difficulty": "intermediate"}
        ),
        (
            "How does FastAPI dependency injection work?",
            "FastAPI uses the `Depends` class to inject dependencies into route functions. This allows for clean reuse of database sessions, authentication checks, and input validation without boilerplate code.",
            {"category": "FastAPI", "difficulty": "advanced"}
        ),
        (
            "What is semantic caching and how does it save LLM tokens?",
            "Semantic caching embeds user queries into vector space. When a new query arrives, if its vector cosine similarity to a stored query exceeds a threshold (e.g. 0.85), the cached response is returned instantly, saving 100% of LLM tokens and cutting latency by over 95%.",
            {"category": "AI/LLM", "difficulty": "intermediate"}
        )
    ]
    
    seeded = []
    for prompt, resp, meta in samples:
        # Check if already in cache
        if not cache.get(prompt, threshold=0.99):
            entry_id = cache.put(prompt, resp, metadata=meta)
            seeded.append({"id": entry_id, "prompt": prompt})
            
    return {"status": "success", "seeded_count": len(seeded), "entries": seeded}


if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI Semantic Cache Service on http://localhost:8000 ...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
