import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@objectstack/spec',
      '@objectstack/spec/data',
      '@objectstack/spec/system'
    ]
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
  }
});
