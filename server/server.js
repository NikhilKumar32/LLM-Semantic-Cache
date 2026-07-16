require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'MERN API Gateway for FastAPI Semantic Cache',
    storage_engine: 'Active',
    fastapi_url: process.env.FASTAPI_URL || 'http://localhost:8000'
  });
});

app.listen(PORT, () => {
  console.log(`[Express Gateway] Running on http://localhost:${PORT}`);
  console.log(`[Express Gateway] Routing queries to FastAPI at ${process.env.FASTAPI_URL || 'http://localhost:8000'}`);
});
