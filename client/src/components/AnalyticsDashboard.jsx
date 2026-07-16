import React, { useState, useEffect } from 'react';
import { Activity, DollarSign, Clock, CheckCircle, Database, TrendingUp } from 'lucide-react';
import axios from 'axios';

export default function AnalyticsDashboard({ refreshTrigger }) {
  const [stats, setStats] = useState({
    total_queries: 0,
    cache_hits: 0,
    cache_misses: 0,
    hit_rate_pct: 0,
    total_latency_saved_ms: 0,
    total_cost_saved_usd: 0
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const [statsResp, logsResp] = await Promise.all([
        axios.get('http://localhost:5000/api/stats'),
        axios.get('http://localhost:5000/api/logs?limit=25')
      ]);
      setStats(statsResp.data);
      setLogs(logsResp.data.logs || []);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [refreshTrigger]);

  return (
    <div>
      {/* 4 Big Stat Cards */}
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '28px' }}>
        <div className="glass-card stat-card">
          <div className="stat-title">
            <span>Total Queries Processed</span>
            <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div className="stat-value">{stats.total_queries}</div>
          <div className="stat-badge">Through MERN & FastAPI Engine</div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-title">
            <span>Cache Hit Rate</span>
            <TrendingUp size={18} style={{ color: '#00f2fe' }} />
          </div>
          <div className="stat-value">{stats.hit_rate_pct}%</div>
          <div className="stat-badge" style={{ color: stats.hit_rate_pct > 40 ? '#00f2fe' : 'var(--text-secondary)' }}>
            {stats.cache_hits} hits vs {stats.cache_misses} misses
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-title">
            <span>Total Latency Reduced</span>
            <Clock size={18} style={{ color: '#d46bff' }} />
          </div>
          <div className="stat-value">{(stats.total_latency_saved_ms / 1000).toFixed(2)}s</div>
          <div className="stat-badge" style={{ color: '#d46bff' }}>
            Avg ~450ms saved per hit
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-title">
            <span>Estimated Cost Saved</span>
            <DollarSign size={18} style={{ color: '#00f2fe' }} />
          </div>
          <div className="stat-value">${Number(stats.total_cost_saved_usd).toFixed(4)}</div>
          <div className="stat-badge" style={{ color: '#00f2fe' }}>
            100% token cost bypass on hits
          </div>
        </div>
      </div>

      {/* Gateway Audit Log Table */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={20} style={{ color: 'var(--accent-pink)' }} />
              MERN Gateway Audit Log Feed (MongoDB)
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Real-time transaction history logged by Express into MongoDB (`LogEntry` collection).
            </p>
          </div>
        </div>

        {logs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No transaction logs recorded yet. Execute queries in the Playground!
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th style={{ width: '38%' }}>Prompt</th>
                  <th>Model</th>
                  <th>Cache Status</th>
                  <th>Similarity</th>
                  <th>Latency</th>
                  <th>Est. Cost Saved</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ fontWeight: 500, color: '#fff' }}>{log.prompt}</td>
                    <td><span className="badge" style={{ background: 'rgba(255,255,255,0.05)' }}>{log.model}</span></td>
                    <td>
                      {log.cacheHit ? (
                        <span className="badge badge-hit">Cache Hit</span>
                      ) : (
                        <span className="badge badge-miss">LLM Miss</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: log.cacheHit ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                      {log.similarityScore ? log.similarityScore.toFixed(4) : '0.0000'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{log.latencyMs} ms</td>
                    <td style={{ color: '#00f2fe', fontWeight: 600 }}>
                      ${log.costSavedUsd ? log.costSavedUsd.toFixed(5) : '0.00000'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
