const express = require('express');
const cors = require('cors');
const { generalLimiter } = require('./middleware/rateLimiter');

const authRoutes = require('./routes/auth.routes');
const habitRoutes = require('./routes/habit.routes');
const aiRoutes = require('./routes/ai.routes');
const userRoutes = require('./routes/user.routes');
const connectDB = require('./config/db');

const app = express();

// Trust proxy for platforms like Vercel so rate-limit sees correct client IP
app.set('trust proxy', 1);

// Ensure DB connection in serverless environments
connectDB().catch((err) => {
  console.error('MongoDB connection failed:', err.message);
});

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

app.use('/auth', authRoutes);
app.use('/habits', habitRoutes);
app.use('/ai', aiRoutes);
app.use('/users', userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
