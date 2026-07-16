const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../gateway_logs.json');

// Initialize local JSON log store if it doesn't exist
function initStore() {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Read all logs
function getLogs(limit = 50) {
  initStore();
  try {
    const data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    // Return sorted descending by timestamp
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return data.slice(0, limit);
  } catch (err) {
    console.error('Error reading gateway logs:', err);
    return [];
  }
}

// Add a log entry
function addLog(entry) {
  initStore();
  try {
    const data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    const newLog = {
      _id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    };
    data.unshift(newLog);
    // Keep max 500 entries locally
    if (data.length > 500) data.length = 500;
    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return newLog;
  } catch (err) {
    console.error('Error writing gateway log:', err);
    return { _id: 'audit_err', ...entry };
  }
}

// Compute summary stats across all gateway logs
function getSummary() {
  initStore();
  try {
    const data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
    let totalLogs = data.length;
    let mongoCacheHits = 0;
    let totalTokensSavedMongo = 0;
    let totalCostSavedMongo = 0.0;

    for (const item of data) {
      if (item.cacheHit) mongoCacheHits++;
      totalTokensSavedMongo += item.tokensSaved || 0;
      totalCostSavedMongo += item.costSavedUsd || 0.0;
    }

    return {
      totalLogs,
      mongoCacheHits,
      totalTokensSavedMongo,
      totalCostSavedMongo: Number(totalCostSavedMongo.toFixed(6))
    };
  } catch (err) {
    return { totalLogs: 0, mongoCacheHits: 0, totalTokensSavedMongo: 0, totalCostSavedMongo: 0.0 };
  }
}

module.exports = {
  getLogs,
  addLog,
  getSummary
};
