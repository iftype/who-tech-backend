import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';

function getVersion(): string {
  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA.slice(0, 7);
  }
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  base: command === 'serve' ? '/' : '/admin/ui/admin-dist/',
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  build: {
    outDir: '../../../dist/public/admin-dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/admin': 'http://localhost:3000',
    },
  },
}));
