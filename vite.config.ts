import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // In dev, the frontend talks same-origin to /auth and /api (see src/lib/api.ts,
  // which uses `BASE = ''` + `credentials: 'include'`). Without a proxy those
  // requests hit this Vite server and return the SPA HTML, so login silently
  // fails in `npm run dev`. Forward them to the Express backend instead.
  //
  // Override with VITE_PROXY_TARGET (or VITE_BACKEND_URL) if your backend runs
  // elsewhere. This mirrors the nginx/Apache reverse proxy used in production.
  const devBackendUrl =
    process.env.VITE_PROXY_TARGET ||
    process.env.VITE_BACKEND_URL ||
    'http://localhost:3002';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/auth': {
          target: devBackendUrl,
          changeOrigin: true,
          // The auth cookie is SameSite=lax; keep it on the proxied host so the
          // browser stores and sends it for same-origin requests.
          secure: false,
        },
        '/api': {
          target: devBackendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [react()],
    // SECURITY: Previously the Gemini API key from .env.local was inlined into
    // the client bundle via `define`, leaking the live billing key to anyone who
    // downloaded the built JS (it appeared 3x in dist/assets/*.js).
    // This is now stubbed to an empty string. The client no longer calls Gemini
    // directly — all AI calls are proxied through the backend (see /server).
    // Keep these stubs so `process.env.API_KEY` references in legacy code compile.
    define: {
      'process.env.API_KEY': JSON.stringify(''),
      'process.env.GEMINI_API_KEY': JSON.stringify(''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      // Split heavy deps into their own long-cacheable chunks so app-code
      // changes don't invalidate the vendor cache. three.js (~600KB) is by
      // far the largest dependency, so it gets its own chunk.
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
