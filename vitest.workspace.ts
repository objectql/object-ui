import { defineWorkspace } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineWorkspace([
  {
    extends: './vitest.config.mts',
    test: {
      name: 'unit',
      include: [
        'packages/core/src/**/*.test.ts',
        'packages/types/src/**/*.test.ts',
        'packages/cli/src/**/*.test.ts',
        'packages/data-objectstack/src/**/*.test.ts',
        // Pure-logic tests across packages (auto-layout, i18n resolution, etc.)
        // can run in node without component registry — huge speedup.
        'packages/*/src/**/*.test.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        // Everything in apps/* has DOM dependencies; route via the ui project.
        'apps/**',
      ],
      environment: 'node',
      // Minimal setup: polyfills only, no heavy component registry.
      setupFiles: [path.resolve(__dirname, 'vitest.setup.base.ts')],
      testTimeout: 5000,
    },
  },
  {
    extends: './vitest.config.mts',
    test: {
      name: 'ui',
      include: [
        'packages/*/src/**/*.test.tsx',
        'apps/*/src/**/*.test.{ts,tsx}',
        'examples/*/src/**/*.test.{ts,tsx}',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/e2e/**',
        '**/.{idea,git,cache,output,temp}/**',
      ],
      setupFiles: [path.resolve(__dirname, 'vitest.setup.dom.tsx')],
    },
  },
]);
