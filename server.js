require('dotenv').config({ override: true });

const express = require('express');
const cors = require('cors');
const router = require('./route');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { testDatabaseConnection } = require('./config/db');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST || '0.0.0.0';
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'BusTicket backend is running.',
    api: '/api',
  });
});

app.use('/api', router);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await testDatabaseConnection();
    app.listen(PORT, HOST, () => {
      console.log(`BusTicket API running on ${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed because PostgreSQL is unavailable:', error.message);
    process.exit(1);
  }
}

startServer();
