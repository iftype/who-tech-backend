import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/admin/ui/admin-dist/',
  build: {
    outDir: '../../dist/public/admin-dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/admin': 'http://localhost:3000',
    },
  },
});
