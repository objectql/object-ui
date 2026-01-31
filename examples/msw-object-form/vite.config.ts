import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
  },
  optimizeDeps: {
    include: [
      'msw',
      'msw/browser',
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system',
      '@objectstack/spec/ui'
    ],
    esbuildOptions: {
      resolveExtensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
    }
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.code === 'UNRESOLVED_IMPORT' &&
          warning.message.includes('@objectstack/driver-memory')
        ) {
          return;
        }
        warn(warning);
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        inline: [/@objectstack/]
      }
    }
  }
});
