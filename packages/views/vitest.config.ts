/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: [path.resolve(__dirname, '../../vitest.setup.ts')],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@object-ui/types': path.resolve(__dirname, '../types/src'),
      '@object-ui/core': path.resolve(__dirname, '../core/src'),
      '@object-ui/react': path.resolve(__dirname, '../react/src'),
      '@object-ui/components': path.resolve(__dirname, '../components/src'),
      '@object-ui/data-objectql': path.resolve(__dirname, '../data-objectql/src'),
    },
  },
});
