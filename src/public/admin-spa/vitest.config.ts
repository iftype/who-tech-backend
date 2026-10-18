import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 빌드(vite.config.ts)와 분리된 테스트 전용 설정
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
