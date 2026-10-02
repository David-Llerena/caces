import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En local, /api/* va al servidor de scripts/dev-api.ts
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3001}` },
  },
});
