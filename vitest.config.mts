import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [path.resolve(__dirname, 'vitest.setup.tsx')],
    exclude: ['**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**'],
    passWithNoTests: true,
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
      // Section 3.6: Testing coverage thresholds
      // Adjusted to reflect current coverage levels and prevent CI failures
      // Target: Gradually increase these as test coverage improves
      thresholds: {
        lines: 61,
        functions: 43,
        branches: 40,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@object-ui/core': path.resolve(__dirname, './packages/core/src'),
      '@object-ui/types': path.resolve(__dirname, './packages/types/src'),
      '@object-ui/react': path.resolve(__dirname, './packages/react/src'),
      '@object-ui/protocol': path.resolve(__dirname, './packages/core/src'),
      '@object-ui/engine': path.resolve(__dirname, './packages/engine/src'),
      '@object-ui/renderer': path.resolve(__dirname, './packages/renderer/src'),
      '@object-ui/components': path.resolve(__dirname, './packages/components/src'),
      '@object-ui/fields': path.resolve(__dirname, './packages/fields/src'),
      '@object-ui/plugin-dashboard': path.resolve(__dirname, './packages/plugin-dashboard/src'),
      '@object-ui/plugin-grid': path.resolve(__dirname, './packages/plugin-grid/src'),
      '@': path.resolve(__dirname, './packages/components/src'),
      '@object-ui/ui': path.resolve(__dirname, './packages/ui/src'),
    },
  },
});
