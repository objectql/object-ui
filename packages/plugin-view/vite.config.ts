import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      compilerOptions: { rootDir: resolve(__dirname, '../..') },
      include: ['src'],
      exclude: ['**/*.test.ts', '**/*.test.tsx'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginView',
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@object-ui/components',
        '@object-ui/core',
        '@object-ui/plugin-form',
        '@object-ui/plugin-grid',
        '@object-ui/react',
        '@object-ui/types',
        'lucide-react'
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  test: {
    passWithNoTests: true,
  },
});
