import React, { useState } from 'react';
import { Send, Zap, Clock, DollarSign, Award, Sparkles, ArrowRight } from 'lucide-react';
import axios from 'axios';

const PRESET_QUERIES = [
  { label: "Python Sort (1)", query: "How do I sort a list in Python?" },
  { label: "Python Sort (2 - Semantic Match!)", query: "What is the best way to sort a list in Python?" },
  { label: "React Hook (1)", query: "Explain useEffect hook in React and dependency array." },
  { label: "React Hook (2 - Semantic Match!)", query: "How does useEffect work in React and what are dependencies?" },
  { label: "FastAPI Info", query: "What is FastAPI and how does dependency injection work?" }
];

export default function Playground({ threshold, onQueryExecuted }) {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleQuery = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      // Send query through the MERN Gateway (Express port 5000) which proxies to FastAPI
      const response = await axios.post('http://localhost:5000/api/query', {
        prompt: prompt.trim(),
        model,
        threshold
      });

      setResult(response.data);
      if (onQueryExecuted) onQueryExecuted(response.data);
    } catch (err) {
      console.error('Playground Error:', err);
      setError(err.response?.data?.error || 'Failed to connect to MERN Gateway. Make sure Express and FastAPI are running!');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (qText) => {
    setPrompt(qText);
  };

  return (
    <div className="grid-2">
      {/* Left Pane: Input and Controls */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={22} style={{ color: 'var(--accent-cyan)' }} />
            Semantic Query Simulator
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Send queries to test vector similarity matching. Queries with similar meaning will hit the cache instantly without hitting the LLM provider!
          </p>
        </div>

        {/* Presets */}
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
            QUICK PRESETS (Try clicking pairs sequentially to see semantic hit!):
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {PRESET_QUERIES.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p.query)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-secondary)',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-cyan)'}
                onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Query Form */}
        <form onSubmit={handleQuery} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              User Prompt / Query
            </label>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., How do I sort a list in Python?"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Target LLM Model
              </label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cost-effective)</option>
                <option value="gpt-4o">GPT-4o (High Reasoning)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="mistral-large">Mistral Large</option>
              </select>
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <button type="submit" disabled={loading} className="gradient-btn" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 28px' }}>
                {loading ? (
                  <span>Checking Cache...</span>
                ) : (
                  <>
                    <span>Execute Query</span>
                    <Send size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {error && (
          <div style={{ background: 'rgba(255, 8, 68, 0.15)', border: '1px solid #ff0844', padding: '14px', borderRadius: '10px', color: '#ff4e78', fontSize: '0.85rem' }}>
            <strong>Connection Error:</strong> {error}
          </div>
        )}
      </div>

      {/* Right Pane: Output Analysis */}
      <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
          Response & Telemetry Breakdown
        </h3>

        {!result ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: '300px', textAlign: 'center', gap: '12px' }}>
            <Zap size={48} style={{ opacity: 0.3 }} />
            <p>Execute a query on the left to inspect semantic matching, exact cosine similarity scores, and latency/cost savings!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Hit / Miss Banner */}
            <div style={{
              background: result.cache_hit 
                ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.2) 0%, rgba(79, 172, 254, 0.1) 100%)' 
                : 'linear-gradient(135deg, rgba(255, 8, 68, 0.15) 0%, rgba(255, 154, 158, 0.05) 100%)',
              border: `1px solid ${result.cache_hit ? '#00f2fe' : '#ff0844'}`,
              borderRadius: '14px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div className={result.cache_hit ? "badge badge-hit" : "badge badge-miss"} style={{ marginBottom: '6px' }}>
                  <Zap size={14} />
                  {result.cache_hit ? 'SEMANTIC CACHE HIT (Bypassed LLM)' : 'CACHE MISS (Called LLM & Stored)'}
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {result.cache_hit 
                    ? `Matched existing query vector with cosine similarity above threshold (${threshold}).`
                    : `No existing semantic match found. Query embedded and stored in vector index.`}
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Cosine Similarity</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: result.cache_hit ? 'var(--accent-cyan)' : '#ff4e78' }}>
                  {result.similarity_score.toFixed(4)}
                </span>
              </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={14} /> Latency
                </span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)', display: 'block', marginTop: '4px' }}>
                  {result.latency_ms} ms
                </strong>
                {result.cache_hit && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>99.5% Faster!</span>
                )}
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Award size={14} /> Tokens Saved
                </span>
                <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)', display: 'block', marginTop: '4px' }}>
                  {result.tokensSaved || (result.cache_hit ? 120 : 0)}
                </strong>
              </div>

              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-glass)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <DollarSign size={14} /> Est. Savings
                </span>
                <strong style={{ fontSize: '1.2rem', color: '#00f2fe', display: 'block', marginTop: '4px' }}>
                  ${result.costSavedUsd ? result.costSavedUsd.toFixed(5) : (result.cache_hit ? '0.00036' : '0.00000')}
                </strong>
              </div>
            </div>

            {/* AI Response Text */}
            <div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                AI Model Response ({result.model}):
              </span>
              <div style={{
                background: '#0a0814',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                padding: '16px',
                fontSize: '0.9rem',
                color: '#e2e0ff',
                whiteSpace: 'pre-wrap',
                fontFamily: 'Consolas, Monaco, monospace',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {result.response}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
