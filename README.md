# LLM Semantic Cache — MERN + FastAPI Hybrid Architecture

An enterprise-grade, high-performance **Semantic Caching Engine** for Large Language Models (LLMs) built with **FastAPI (Python)**, **MongoDB**, **Express**, **Node.js**, and a stunning **React + Vite** frontend.

Semantic caching stores and retrieves LLM responses based on **vector embedding similarity** (`Cosine Similarity >= 0.82`) rather than exact string matches. When a new user query is conceptually similar to a previous query (e.g., *"How do I sort a list in Python?"* vs *"What's the best way to sort a Python list?"*), the system returns the cached response instantly without calling the LLM API—saving up to 100% in token costs and reducing latency by >95%.

---

## Architecture

```
+---------------------------------------------------------------------------------+
|                                React Dashboard                                  |
|         (Vite SPA @ http://localhost:5173 - Obsidian Dark/Glassmorphism)         |
+----------------------------------------+----------------------------------------+
                                         | REST API (Axios)
                                         v
+---------------------------------------------------------------------------------+
|                         MERN Express API Gateway                                |
|        (Node.js @ http://localhost:5000 - Audit Logging & MongoDB Store)         |
+-------------------+----------------------------------------+--------------------+
                    | Proxy Query/Cache                      | Audit Transaction
                    v                                        v
+-----------------------------------+   +-----------------------------------------+
|     FastAPI Semantic Engine       |   |       MongoDB / Memory Server           |
| (Python @ http://localhost:8000)  |   |     (Persistent LogEntry Collection)    |
+-------------------+---------------+   +-----------------------------------------+
                    |
                    +--> Vector Embeddings (SentenceTransformers / OpenAI / FastLocal)
                    +--> SQLite + Vector Cosine Index (`cache_entries`)
```

---

## Folder Structure

```
llm-semantic-cache/
├── fastapi_service/         # Python FastAPI Core Cache Engine & Vector Index
│   ├── main.py              # FastAPI REST endpoints & simulation logic
│   ├── requirements.txt     # Python dependencies
│   └── semantic_cache/      # Engine modular package
│       ├── embeddings.py    # FastLocal TFIDF, SentenceTransformers, & OpenAI providers
│       ├── storage.py       # SQLite engine with float32 binary vector cosine search
│       └── engine.py        # SemanticCache orchestrator
├── server/                  # Node.js & Express API Gateway + MongoDB audit store
│   ├── server.js            # Express server (Port 5000) + in-memory MongoDB auto-fallback
│   ├── package.json         # Node dependencies
│   ├── models/LogEntry.js   # Mongoose audit schema
│   └── routes/api.js        # Gateway routing and metrics calculation
└── client/                  # React + Vite Interactive Frontend (Port 5173)
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx          # Tabbed dashboard layout
        ├── index.css        # Obsidian/Glassmorphism design tokens
        └── components/      # Navbar, Playground, CacheExplorer, & AnalyticsDashboard
```

---

## Quickstart & Installation

### Step 1: Start the FastAPI Core Cache Engine (Port 8000)
Open a terminal in `fastapi_service/`:
```bash
cd fastapi_service
pip install -r requirements.txt
python main.py
```
*The service starts on `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.*

### Step 2: Start the MERN Express API Gateway (Port 5000)
Open a new terminal in `server/`:
```bash
cd server
npm install
npm start
```
*The server connects to MongoDB (automatically launches a zero-config local memory server if no `MONGODB_URI` is set) and listens on `http://localhost:5000`.*

### Step 3: Start the React Dashboard (Port 5173)
Open a third terminal in `client/`:
```bash
cd client
npm install
npm run dev
```
*Open `http://localhost:5173` in your browser to experience the interactive dashboard!*

---

## Features & Usage

1. **Semantic Query Simulator**: Type queries or test pre-configured pairs. Watch the engine compute vector cosine similarities and bypass simulated LLM generation for semantically equivalent prompts.
2. **Real-time Threshold Tuning**: Adjust the live similarity slider (`0.50` to `0.99`) from the top navigation bar to see how stricter or looser thresholds affect cache hits.
3. **Vector Index Explorer**: Inspect raw query embeddings, hit counters, and timestamps. Click "Seed Samples" to instantly load 5 foundational Python/React/FastAPI AI responses.
4. **Telemetry & Audit Logs**: Monitor cumulative latency reduction, token savings, and inspect transaction traces stored inside MongoDB.
