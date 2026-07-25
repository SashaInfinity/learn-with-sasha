/**
 * Shared Postgres connection pool.
 *
 * Connects to the same `tutor_lms` database the sasha_lms FastAPI backend
 * uses, but only reads/writes the `learn_*` tables (plus FK reads on `users`).
 */
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to .env.');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // The pool is shared across requests; keep it modest.
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[pg] unexpected pool error:', err);
});
