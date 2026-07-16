import React, { useState } from 'react';
import { Database, Cpu, Sliders, CheckCircle, RefreshCw } from 'lucide-react';

export default function Navbar({ threshold, onThresholdChange, onSeed, seeding, health }) {
  const [showSliders, setShowSliders] = useState(false);

  return (
    <header className="navbar glass-card">
      <div className="brand">
        <Database className="lucide-icon" style={{ color: 'var(--accent-cyan)' }} size={28} />
        <span className="gradient-text font-heading">Antigravity Semantic Cache</span>
        <span className="brand-badge">MERN + FastAPI Engine</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* Connection status badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="badge" style={{ background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
            <span className="pulse-dot"></span>
            FastAPI: {health?.fastapi === 'online' ? 'Connected' : 'Checking...'}
          </div>
          <div className="badge" style={{ background: 'rgba(155, 81, 224, 0.1)', color: '#d46bff', border: '1px solid rgba(155, 81, 224, 0.2)' }}>
            <span className="pulse-dot" style={{ backgroundColor: '#d46bff', boxShadow: '0 0 10px #d46bff' }}></span>
            MERN Gateway: Connected
          </div>
        </div>

        {/* Quick actions */}
        <button 
          onClick={onSeed} 
          disabled={seeding}
          className="tab-btn" 
          style={{ border: '1px solid var(--border-glass)', fontSize: '0.85rem', padding: '8px 14px' }}
          title="Seed cache with sample AI Q&A pairs"
        >
          <RefreshCw size={16} className={seeding ? "animate-spin" : ""} />
          {seeding ? "Seeding..." : "Seed Samples"}
        </button>

        {/* Threshold slider popover trigger */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowSliders(!showSliders)} 
            className="tab-btn" 
            style={{ 
              background: showSliders ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
              border: '1px solid var(--border-glass)'
            }}
          >
            <Sliders size={18} />
            Threshold: <strong>{threshold}</strong>
          </button>

          {showSliders && (
            <div className="glass-card" style={{
              position: 'absolute',
              right: 0,
              top: '50px',
              width: '280px',
              padding: '18px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justify: 'content', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                <span>Cosine Similarity Threshold</span>
                <span style={{ color: 'var(--accent-cyan)' }}>{threshold}</span>
              </div>
              <input 
                type="range" 
                min="0.50" 
                max="0.99" 
                step="0.01" 
                value={threshold} 
                onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
                style={{ accentColor: 'var(--accent-cyan)' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Higher value requires closer semantic similarity for a cache hit. Default is <code>0.82</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
