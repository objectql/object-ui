import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/studio/' : '/',
  resolve: {
    alias: {
      '@object-ui/components': path.resolve(__dirname, '../../packages/components/src'),
      '@object-ui/core': path.resolve(__dirname, '../../packages/core/src'),
      '@object-ui/react': path.resolve(__dirname, '../../packages/react/src'),
      '@object-ui/types': path.resolve(__dirname, '../../packages/types/src'),
      '@object-ui/designer': path.resolve(__dirname, '../../packages/designer/src'),
      '@object-ui/plugin-charts': path.resolve(__dirname, '../../packages/plugin-charts/src'),
      '@object-ui/plugin-editor': path.resolve(__dirname, '../../packages/plugin-editor/src'),
      '@object-ui/plugin-kanban': path.resolve(__dirname, '../../packages/plugin-kanban/src'),
      '@object-ui/plugin-markdown': path.resolve(__dirname, '../../packages/plugin-markdown/src'),
      '@': path.resolve(__dirname, '../../packages/components/src'),
    }
  },
  server: {
    port: 5174
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
