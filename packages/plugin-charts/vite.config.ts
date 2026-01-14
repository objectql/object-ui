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
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ObjectUIPluginCharts',
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@object-ui/components', '@object-ui/core', '@object-ui/react'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@object-ui/components': 'ObjectUIComponents',
          '@object-ui/core': 'ObjectUICore',
          '@object-ui/react': 'ObjectUIReact',
        },
      },
    },
  },
});
