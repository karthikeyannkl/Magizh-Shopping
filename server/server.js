// Production Express Server for Magizh Shopping + B5 Coin
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDatabase, persistDatabase } from './db.js';
import { apiRouter } from './api.js';
import { backupService } from './backupService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, '..', 'dist');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check (Supports platform /healthz probe along with /health and /api/health)
app.get(['/healthz', '/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'Magizh Shopping & B5 Coin Ecosystem Backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: 'connected',
    version: '1.0.0',
  });
});

// Mount API router
app.use('/api', apiRouter);

// Serve frontend in production or when dist directory exists
if (process.env.NODE_ENV === 'production' || fs.existsSync(DIST_DIR)) {
  // Static assets with cache header
  app.use(express.static(DIST_DIR, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (filePath.includes('assets')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  
  const serveIndex = (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile('index.html', { root: DIST_DIR });
  };

  app.get('/', serveIndex);
  app.get('/partner', serveIndex);
  app.get('/referral', serveIndex);
  app.get('/admin', serveIndex);
  app.get('{*path}', serveIndex);
}

// Graceful shutdown with atomic SQLite database persistence
const handleShutdown = (signal) => {
  console.log(`[Magizh Server] Received ${signal}. Persisting database before exiting...`);
  try {
    persistDatabase();
    console.log('[Magizh Server] Database successfully persisted.');
  } catch (err) {
    console.error('[Magizh Server] Error during shutdown persistence:', err);
  }
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Start Server
async function start() {
  try {
    await initDatabase();
    // Start automated daily backup scheduler
    backupService.startScheduler();
    // Dual-stack listener: Omitting host binds to :: (IPv6) with IPv4 fallback/mapping,
    // accepting incoming connections from both IPv4 (0.0.0.0 / 127.0.0.1) and IPv6 (:: / ::1)
    app.listen(PORT, () => {
      console.log(`[Magizh Server] Backend listening on port ${PORT} (Dual-Stack IPv4/IPv6)`);
    });
  } catch (err) {
    console.error('[Magizh Server] Failed to start server:', err);
    process.exit(1);
  }
}

// Only start when invoked directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start();
}

export default app;
