import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src'],
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ObjectUILayout',
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        '@object-ui/components',
        '@object-ui/core',
        '@object-ui/react',
        '@object-ui/types',
        'clsx',
        'tailwind-merge',
        'lucide-react',
        'react-router-dom'
      ],
    },
  },
});
