import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  // Preserves the '@/' -> 'src/' alias formerly supplied by the removed
  // @base44/vite-plugin (its resolve.alias entry); required for every
  // '@/...' import in src/ to resolve at build time.
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
      '/functions': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/functions\/(.*)/, '/api/apps/local-assesssuite/functions/$1'),
      },
    },
  },
});
