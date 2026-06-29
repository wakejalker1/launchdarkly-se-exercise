import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The frontend reads VITE_LD_CLIENT_ID from the SINGLE root-level .env file
// (shared with the server), so we point Vite's envDir up one level.
export default defineConfig({
  plugins: [react()],
  envDir: '..',
  server: {
    port: 5173,
    // Proxy API calls to the Express backend so the browser only talks to one
    // origin in development (avoids CORS headaches for the chatbot).
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
