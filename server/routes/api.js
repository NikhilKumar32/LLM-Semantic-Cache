const express = require('express');
const axios = require('axios');
const LogStore = require('../models/LogStore');

const router = express.Router();
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

function estimateMetrics(prompt, response, cacheHit) {
  if (!cacheHit) return { tokensSaved: 0, costSavedUsd: 0.0 };
  const totalChars = (prompt || '').length + (response || '').length;
  const tokensSaved = Math.max(10, Math.round(totalChars / 4));
  const costSavedUsd = (tokensSaved / 1000) * 0.003;
  return { tokensSaved, costSavedUsd };
}

// 1. Gateway Query: Proxy to FastAPI & log in audit store
router.post('/query', async (req, res) => {
  try {
    const { prompt, model, threshold, metadata, simulate_llm } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const fastApiResponse = await axios.post(`${FASTAPI_URL}/api/v1/query`, {
      prompt,
      model: model || 'gpt-4o-mini',
      threshold,
      metadata,
      simulate_llm: simulate_llm !== undefined ? simulate_llm : true
    }, { timeout: 15000 });

    const data = fastApiResponse.data;
    const { tokensSaved, costSavedUsd } = estimateMetrics(prompt, data.response, data.cache_hit);

    // Save audit log entry
    const logEntry = LogStore.addLog({
      prompt: data.prompt,
      response: data.response,
      model: data.model,
      cacheHit: data.cache_hit,
      similarityScore: data.similarity_score,
      latencyMs: data.latency_ms,
      tokensSaved,
      costSavedUsd,
      metadata: data.metadata || {}
    });

    res.json({
      ...data,
      gatewayAuditId: logEntry._id,
      tokensSaved,
      costSavedUsd
    });
  } catch (error) {
    console.error('[Gateway Query Error]:', error.message);
    const detail = error.response?.data?.detail || error.message;
    res.status(error.response?.status || 500).json({ error: 'Failed to process query via FastAPI service.', detail });
  }
});

// 2. Gateway Logs: Retrieve audit history & summary
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = LogStore.getLogs(limit);
    const summary = LogStore.getSummary();
    res.json({ logs, summary });
  } catch (error) {
    console.error('[Gateway Logs Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// 3. Proxy endpoints directly to FastAPI for unified connection
router.get('/cache/entries', async (req, res) => {
  try {
    const resp = await axios.get(`${FASTAPI_URL}/api/v1/cache/entries`, { params: req.query });
    res.json(resp.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

router.delete('/cache/entries/:id', async (req, res) => {
  try {
    const resp = await axios.delete(`${FASTAPI_URL}/api/v1/cache/entries/${req.params.id}`);
    res.json(resp.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

router.post('/cache/clear', async (req, res) => {
  try {
    const resp = await axios.post(`${FASTAPI_URL}/api/v1/cache/clear`);
    res.json(resp.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const resp = await axios.get(`${FASTAPI_URL}/api/v1/stats`);
    const summary = LogStore.getSummary();
    res.json({ ...resp.data, gateway_mongo_total_logs: summary.totalLogs });
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

router.post('/config', async (req, res) => {
  try {
    const resp = await axios.post(`${FASTAPI_URL}/api/v1/config`, req.body);
    res.json(resp.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

router.post('/seed', async (req, res) => {
  try {
    const resp = await axios.post(`${FASTAPI_URL}/api/v1/seed`);
    const summary = LogStore.getSummary();
    if (summary.totalLogs === 0 && resp.data.entries) {
      for (const entry of resp.data.entries) {
        LogStore.addLog({
          prompt: entry.prompt,
          response: 'Seeded cache response from initial setup.',
          model: 'gpt-4o-mini',
          cacheHit: false,
          similarityScore: 0.0,
          latencyMs: 380.0,
          tokensSaved: 0,
          costSavedUsd: 0.0
        });
      }
    }
    res.json(resp.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

module.exports = router;
