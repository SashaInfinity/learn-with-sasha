import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
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
        }
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
      }
    };
});
