import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@ronduel/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@': path.resolve(__dirname, 'apps/web'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'functions/**/*.test.ts',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**', 'e2e/**'],
  },
});
