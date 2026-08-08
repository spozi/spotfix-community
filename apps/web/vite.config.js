import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    // Dev-only: proxy API calls so the browser stays same-origin (the live
    // API's CORS allowlist has no localhost entry). Point the app at it with
    // VITE_API_BASE_URL=/api/v1.
    proxy: {
      '/api': {
        target: process.env.SPOTFIX_API_PROXY_TARGET || 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
});
