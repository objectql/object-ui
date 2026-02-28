import { defineWorkspace } from 'vitest/config';

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
      ],
      environment: 'node',
      setupFiles: [],
      testTimeout: 5000,
    },
  },
  {
    extends: './vitest.config.mts',
    test: {
      name: 'ui',
      include: [
        'packages/*/src/**/*.test.{ts,tsx}',
        'apps/*/src/**/*.test.{ts,tsx}',
        'examples/*/src/**/*.test.{ts,tsx}',
      ],
      exclude: [
        'packages/core/src/**/*.test.ts',
        'packages/types/src/**/*.test.ts',
        'packages/cli/src/**/*.test.ts',
        'packages/data-objectstack/src/**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/e2e/**',
        '**/.{idea,git,cache,output,temp}/**',
      ],
    },
  },
]);
