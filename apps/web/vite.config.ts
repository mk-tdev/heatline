import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: { rolldownOptions: { input: ['index.html', 'worker/supervisor.html'] } },
  plugins: [react()],
  server: { port: 5183, proxy: { '/api': `http://127.0.0.1:${process.env.HEATLINE_API_PORT || 8787}` } },
});
