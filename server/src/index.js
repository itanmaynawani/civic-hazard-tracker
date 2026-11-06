import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { initSocket } from './socket.js';
import reportRoutes from './routes/reports.js';

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
    limit: 1500, // requests per IP per window
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

app.use('/api/reports', reportRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Central error handler (Express 5 forwards errors from async handlers here automatically)
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 ? 'Server error' : err.message,
    ...(err.details && { details: err.details }),
  });
});

const server = http.createServer(app);
initSocket(server, CLIENT_ORIGINS);

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