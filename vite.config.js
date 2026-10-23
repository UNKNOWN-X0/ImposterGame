import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 so phones on the same wifi can reach the dev server too
    host: true,
    port: 5174,
    proxy: {
      // In dev the React app runs on 5174 and the party server on 5173;
      // this makes /api calls work in both dev and production unchanged.
      '/api': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});
