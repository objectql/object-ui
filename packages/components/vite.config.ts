import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    dts({
      insertTypesEntry: true,
      include: ['src'],
    }),
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ObjectUIComponents',
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        // Externalize all workspace dependencies
        '@object-ui/core',
        '@object-ui/react',
        '@object-ui/types',
        // Externalize all Radix UI dependencies
        /^@radix-ui\/.*/,
        // Externalize other heavy dependencies
        'class-variance-authority',
        'clsx',
        'cmdk',
        'date-fns',
        'embla-carousel-react',
        'input-otp',
        'lucide-react',
        'next-themes',
        'react-day-picker',
        'react-hook-form',
        'react-resizable-panels',
        'sonner',
        'tailwind-merge',
        'tailwindcss-animate',
        'vaul',
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
    globals: true,
    environment: 'happy-dom',
    setupFiles: [],
    // Ensure dependencies are resolved properly for tests
    deps: {
      inline: ['@object-ui/core', '@object-ui/react'],
    },
  },
});
