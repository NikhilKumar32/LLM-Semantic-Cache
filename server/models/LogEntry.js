const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  response: { type: String, required: true },
  model: { type: String, default: 'gpt-4o-mini' },
  cacheHit: { type: Boolean, required: true },
  similarityScore: { type: Number, default: 0.0 },
  latencyMs: { type: Number, required: true },
  tokensSaved: { type: Number, default: 0 },
  costSavedUsd: { type: Number, default: 0.0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LogEntry', logEntrySchema);
