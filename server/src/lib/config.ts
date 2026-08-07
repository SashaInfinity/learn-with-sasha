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

  // The LMS auth API. Defaults to the remote LMS so login works out of the box
  // without running the local FastAPI/Postgres stack. Override AUTH_BACKEND_URL
  // to point at a local LMS (e.g. http://127.0.0.1:8000/api/v1) for development.
  authBackendUrl:
    process.env.AUTH_BACKEND_URL ?? 'https://backend.sashainfinity.com/api/v1',
  authCookieName: process.env.AUTH_COOKIE_NAME ?? 'learn_sasha_token',
  cookieDomain: process.env.COOKIE_DOMAIN ?? 'localhost',

  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',

  // Local Piper TTS container (OpenAI-compatible /v1/audio/speech).
  ttsUrl: process.env.TTS_URL ?? 'http://127.0.0.1:5000',
} as const;
