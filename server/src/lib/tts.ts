/**
 * Text-to-speech via the local Piper container.
 *
 * Piper is CPU-only and runs as a sibling docker service on 127.0.0.1:5000,
 * exposing an OpenAI-compatible POST /v1/audio/speech endpoint. Voices auto-
 * download from HuggingFace on first use and cache under the container's
 * /data volume.
 *
 * The voice is fixed (Sasha) — clients can't pick it.
 */
import { config } from './config.js';

const PIPER_VOICE = process.env.PIPER_VOICE ?? 'en_US-lessac-high';

// Simple bounded LRU so repeated phrases (greetings, errors, common replies)
// don't re-synthesize. Keyed by the text; values are WAV buffers.
const CACHE_MAX = 128;
const cache = new Map<string, Buffer>();

/** Synthesize text to a WAV buffer, using the cache when possible. */
export async function synthesize(text: string): Promise<Buffer> {
  const key = text.slice(0, 500);
  const cached = cache.get(key);
  if (cached) {
    // Refresh recency (Map preserves insertion order).
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  const res = await fetch(`${config.ttsUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'piper',
      voice: PIPER_VOICE,
      input: text,
      response_format: 'wav',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => `Piper error (${res.status})`);
    throw new Error(detail);
  }
  const buf = Buffer.from(await res.arrayBuffer());

  if (cache.size >= CACHE_MAX) {
    // Evict oldest entry.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, buf);
  return buf;
}
