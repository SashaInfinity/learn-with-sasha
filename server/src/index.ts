/**
 * Learn With Sasha — backend entry point.
 *
 * Express app: helmet + CORS + cookies + JSON, mounted behind /auth and /api.
 * The Gemini key lives only in lib/gemini.ts and never reaches the browser.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './lib/config.js';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/api.js';
import { pool } from './db/pool.js';

const app = express();

// Trust the proxy set by the host nginx (so req.protocol / secure cookies work).
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true, // allow the auth cookie
  }),
);
app.use(express.json({ limit: '15mb' })); // accommodate base64 image uploads
app.use(cookieParser());

// Stricter rate limit on auth to blunt brute-force attempts.
app.use(
  '/auth/login',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }),
);
// General API limit.
app.use(
  '/api',
  rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false }),
);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/api', apiRouter);

const server = app.listen(config.port, () => {
  console.log(`[learn-with-sasha] listening on :${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown — close the DB pool so connections aren't leaked.
function shutdown(signal: string) {
  console.log(`[learn-with-sasha] ${signal} received, shutting down…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
