const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { generalLimiter } = require('./middleware/rateLimiter');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const habitRoutes = require('./routes/habit.routes');
const aiRoutes = require('./routes/ai.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

// Trust proxy for platforms like Vercel so rate-limit sees correct client IP
app.set('trust proxy', 1);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(generalLimiter);

app.get('/', (req, res) => {
  res.json({ message: 'Habit AI API is running' });
});

const requireDatabase = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database unavailable:', err.message);
    res.status(503).json({ error: 'Database temporarily unavailable' });
  }
};

app.get('/cron/db-ping', async (req, res) => {
  if (
    !process.env.CRON_SECRET ||
    req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await connectDB();
    await mongoose.connection.db.admin().ping();
    return res.json({ ok: true, database: 'connected', checkedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Database keep-alive failed:', err.message);
    return res.status(503).json({ ok: false, error: 'Database temporarily unavailable' });
  }
});

app.use('/auth', requireDatabase, authRoutes);
app.use('/habits', requireDatabase, habitRoutes);
app.use('/ai', requireDatabase, aiRoutes);
app.use('/users', requireDatabase, userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  console.error('Unhandled error:', err);
  console.error('Unhandled error stack:', err.stack);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

module.exports = app;
