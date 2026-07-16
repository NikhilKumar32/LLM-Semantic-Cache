import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Playground from './components/Playground';
import CacheExplorer from './components/CacheExplorer';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import { Sparkles, Layers, BarChart2 } from 'lucide-react';
import axios from 'axios';

export default function App() {
  const [activeTab, setActiveTab] = useState('playground');
  const [threshold, setThreshold] = useState(0.68);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [health, setHealth] = useState({ fastapi: 'checking' });

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    // Check system health
    axios.get('http://localhost:8000/')
      .then(() => setHealth({ fastapi: 'online' }))
      .catch(() => setHealth({ fastapi: 'offline' }));
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await axios.post('http://localhost:5000/api/seed');
      triggerRefresh();
    } catch (err) {
      alert('Failed to seed cache: ' + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleThresholdChange = async (newVal) => {
    setThreshold(newVal);
    try {
      await axios.post('http://localhost:5000/api/config', { similarity_threshold: newVal });
    } catch (err) {
      console.error('Error updating threshold:', err);
    }
  };

  return (
    <div className="app-container">
      <Navbar 
        threshold={threshold} 
        onThresholdChange={handleThresholdChange} 
        onSeed={handleSeed}
        seeding={seeding}
        health={health}
      />

      {/* Navigation Tabs */}
      <div className="tabs">
        <button 
          onClick={() => setActiveTab('playground')} 
          className={`tab-btn ${activeTab === 'playground' ? 'active' : ''}`}
        >
          <Sparkles size={18} />
          Interactive Simulator
        </button>

        <button 
          onClick={() => setActiveTab('explorer')} 
          className={`tab-btn ${activeTab === 'explorer' ? 'active' : ''}`}
        >
          <Layers size={18} />
          Vector Cache Explorer
        </button>

        <button 
          onClick={() => setActiveTab('analytics')} 
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
        >
          <BarChart2 size={18} />
          Telemetry & MongoDB Logs
        </button>
      </div>

      {/* Tab Panels */}
      <main>
        {activeTab === 'playground' && (
          <Playground threshold={threshold} onQueryExecuted={triggerRefresh} />
        )}

        {activeTab === 'explorer' && (
          <CacheExplorer refreshTrigger={refreshTrigger} onRefreshNeeded={triggerRefresh} />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard refreshTrigger={refreshTrigger} />
        )}
      </main>

      <footer style={{ marginTop: '50px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: '30px' }}>
        Antigravity LLM Semantic Cache Architecture &bull; MERN Gateway (Express/MongoDB) + FastAPI Core Vector Engine
      </footer>
    </div>
  );
}
