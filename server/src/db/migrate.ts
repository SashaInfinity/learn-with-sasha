/**
 * Applies schema.sql against the configured DATABASE_URL.
 * Idempotent — safe to run repeatedly.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { pool } from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sqlPath = join(__dirname, 'schema.sql');
  const sql = readFileSync(sqlPath, 'utf8');
  console.log('[migrate] applying schema.sql …');
  await pool.query(sql);
  console.log('[migrate] done.');
  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});
