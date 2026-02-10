import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // @objectstack/core@2.0.4 statically imports Node.js crypto (for plugin hashing).
  // The code already has a browser fallback, so we provide an empty stub instead of
  // marking it as external (which emits a bare `import 'crypto'` that browsers reject).
  // enforce: 'pre' ensures this runs before Vite's built-in browser-external resolve.
  plugins: [
    {
      name: 'stub-crypto',
      enforce: 'pre',
      resolveId(id: string) {
        if (id === 'crypto') return '\0crypto-stub';
      },
      load(id: string) {
        if (id === '\0crypto-stub') {
          return [
            'export function createHash() { return { update() { return this; }, digest() { return ""; } }; }',
            'export function createVerify() { return { update() { return this; }, end() {}, verify() { return false; } }; }',
            'export default {};',
          ].join('\n');
        }
      },
    },
    react(),
  ],
  server: {
    port: 3000,
  },
  optimizeDeps: {
    include: [
      'msw', 
      'msw/browser',
      '@objectstack/spec',
      '@objectstack/spec/data', // Force pre-bundling for CJS compatibility
      '@objectstack/spec/system',
      '@objectstack/spec/ui'
    ]
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/, /packages/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      // Suppress warnings for optional dynamic imports in runtime
      onwarn(warning, warn) {
        // Ignore unresolved import warnings for @objectstack/driver-memory
        // This is an optional fallback dynamic import in the runtime kernel.
        // It's safe to suppress because the driver is explicitly imported in src/mocks/browser.ts
        if (
          warning.code === 'UNRESOLVED_IMPORT' &&
          warning.message.includes('@objectstack/driver-memory')
        ) {
          return;
        }
        warn(warning);
      },
    }
  }
});
