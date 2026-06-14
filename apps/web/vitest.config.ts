import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], reportsDirectory: 'coverage' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@harmony/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
