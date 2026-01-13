import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        'examples/',
      ],
    },
  },
  resolve: {
    alias: {
      '@object-ui/protocol': path.resolve(__dirname, './packages/protocol/src'),
      '@object-ui/engine': path.resolve(__dirname, './packages/engine/src'),
      '@object-ui/renderer': path.resolve(__dirname, './packages/renderer/src'),
      '@object-ui/ui': path.resolve(__dirname, './packages/ui/src'),
      '@object-ui/designer': path.resolve(__dirname, './packages/designer/src'),
    },
  },
});
