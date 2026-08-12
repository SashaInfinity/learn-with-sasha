/**
 * Centralized, validated configuration. Reads process.env once at startup.
 */
import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: process.env.NODE_ENV === 'production',

  // Comma-separated CORS origins.
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  databaseUrl: required('DATABASE_URL'),

  // The LMS auth API. Defaults to the sasha-edge proxy, which is how the LMS
  // FastAPI is actually reachable from this host — the container publishes no
  // host port of its own, so http://127.0.0.1:8000 does NOT work. Override
  // AUTH_BACKEND_URL to point elsewhere (e.g. a directly-run local FastAPI).
  authBackendUrl: process.env.AUTH_BACKEND_URL ?? 'http://127.0.0.1:3200/api/v1',
  authCookieName: process.env.AUTH_COOKIE_NAME ?? 'learn_sasha_token',
  cookieDomain: process.env.COOKIE_DOMAIN ?? 'localhost',

  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',

  // Local Piper TTS container (OpenAI-compatible /v1/audio/speech).
  ttsUrl: process.env.TTS_URL ?? 'http://127.0.0.1:5000',
} as const;
