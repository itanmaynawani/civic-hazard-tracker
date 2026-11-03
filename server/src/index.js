import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const app = express();

// Needed on Render/Railway/etc. so rate limiting sees the real client IP
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGINS }));
app.use(express.json({ limit: '10kb' }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 300, // requests per IP per window
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

// Health check: used by hosting providers and for quick manual testing
app.get('/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    db: dbStates[mongoose.connection.readyState],
    uptime: Math.round(process.uptime()),
  });
});

// Routes will be mounted here in step 3:
// app.use('/api/reports', reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Using http.createServer (instead of app.listen) so Socket.IO can attach in step 3
const server = http.createServer(app);

async function start() {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

export { app, server };