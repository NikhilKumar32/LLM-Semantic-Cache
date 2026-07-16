import React, { useState, useEffect } from 'react';
import { Database, Trash2, Search, RefreshCw, Layers } from 'lucide-react';
import axios from 'axios';

export default function CacheExplorer({ refreshTrigger, onRefreshNeeded }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const resp = await axios.get('http://localhost:5000/api/cache/entries', {
        params: { limit: 100, search: search || undefined }
      });
      setEntries(resp.data.entries || []);
    } catch (err) {
      console.error('Error loading cache entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [refreshTrigger, search]);

  const handleDeleteEntry = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/api/cache/entries/${id}`);
      fetchEntries();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err) {
      alert('Failed to delete entry: ' + err.message);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to flush all semantic vector cache entries?')) return;
    setClearing(true);
    try {
      await axios.post('http://localhost:5000/api/cache/clear');
      fetchEntries();
      if (onRefreshNeeded) onRefreshNeeded();
    } catch (err) {
      alert('Failed to clear cache: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="glass-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} style={{ color: 'var(--accent-purple)' }} />
            Vector Cache Index Explorer
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Stored query embeddings and cached responses. When new queries match these vectors with high similarity, they are returned immediately.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '15px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search cached queries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', paddingBottom: '10px', paddingTop: '10px', fontSize: '0.85rem' }}
            />
          </div>

          <button
            onClick={fetchEntries}
            className="tab-btn"
            style={{ border: '1px solid var(--border-glass)', padding: '10px 14px' }}
            title="Refresh Table"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>

          {entries.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              style={{
                background: 'rgba(255, 8, 68, 0.15)',
                color: '#ff4e78',
                border: '1px solid rgba(255, 8, 68, 0.3)',
                padding: '10px 16px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Trash2 size={16} />
              {clearing ? 'Flushing...' : 'Flush Cache'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading vector cache entries...
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
          No cached queries found in vector storage. Use the Playground or click "Seed Samples" to populate the cache!
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th style={{ width: '32%' }}>Cached Query Text</th>
                <th style={{ width: '38%' }}>Stored Response Preview</th>
                <th>Hit Count</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((item) => (
                <tr key={item.id}>
                  <td><span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>#{item.id}</span></td>
                  <td style={{ fontWeight: 600, color: '#eef' }}>{item.query_text}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {item.response_text ? (item.response_text.length > 110 ? item.response_text.substring(0, 110) + '...' : item.response_text) : ''}
                  </td>
                  <td>
                    <span className="badge" style={{ background: item.hit_count > 0 ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.05)', color: item.hit_count > 0 ? '#00f2fe' : 'var(--text-secondary)' }}>
                      {item.hit_count} hits
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(item.created_at * 1000).toLocaleTimeString()}
                  </td>
                  <td>
                    <button
                      onClick={() => handleDeleteEntry(item.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ff4e78', cursor: 'pointer', padding: '6px' }}
                      title="Delete Entry"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
