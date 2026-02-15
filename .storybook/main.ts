import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from 'vite';
import path from 'path';
import { viteCryptoStub } from '../scripts/vite-crypto-stub';

const config: StorybookConfig = {
  stories: ["../packages/**/src/**/*.mdx", "../packages/**/src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  staticDirs: ['../public'],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  async viteFinal(config) {
    const merged = mergeConfig(config, {
      define: {
        'process.env': {},
        'process.platform': '"browser"',
        'process.version': '"0.0.0"',
      },
      plugins: [
        viteCryptoStub(),
      ],
      resolve: {
        alias: {
          // Alias for .storybook directory to allow imports from stories
          '@storybook-config': path.resolve(__dirname, '.'),
          // Alias components package to source to avoid circular dependency during build
          '@object-ui/core': path.resolve(__dirname, '../packages/core/src/index.ts'),
          '@object-ui/react': path.resolve(__dirname, '../packages/react/src/index.ts'),
          '@object-ui/types': path.resolve(__dirname, '../packages/types/src/index.ts'),
          '@object-ui/i18n': path.resolve(__dirname, '../packages/i18n/src/index.ts'),
          '@object-ui/mobile': path.resolve(__dirname, '../packages/mobile/src/index.ts'),
          '@object-ui/components': path.resolve(__dirname, '../packages/components/src/index.ts'),
          '@object-ui/fields': path.resolve(__dirname, '../packages/fields/src/index.tsx'),
          '@object-ui/layout': path.resolve(__dirname, '../packages/layout/src/index.ts'),
          '@object-ui/data-objectstack': path.resolve(__dirname, '../packages/data-objectstack/src/index.ts'),
          // Alias example packages for Storybook to resolve them from workspace
          '@object-ui/example-crm': path.resolve(__dirname, '../examples/crm/src/index.ts'),
          // Alias plugin packages for Storybook to resolve them from workspace
          '@object-ui/plugin-aggrid': path.resolve(__dirname, '../packages/plugin-aggrid/src/index.tsx'),
          '@object-ui/plugin-calendar': path.resolve(__dirname, '../packages/plugin-calendar/src/index.tsx'),
          '@object-ui/plugin-charts': path.resolve(__dirname, '../packages/plugin-charts/src/index.tsx'),
          '@object-ui/plugin-chatbot': path.resolve(__dirname, '../packages/plugin-chatbot/src/index.tsx'),
          '@object-ui/plugin-dashboard': path.resolve(__dirname, '../packages/plugin-dashboard/src/index.tsx'),
          '@object-ui/plugin-detail': path.resolve(__dirname, '../packages/plugin-detail/src/index.tsx'),
          '@object-ui/plugin-editor': path.resolve(__dirname, '../packages/plugin-editor/src/index.tsx'),
          '@object-ui/plugin-form': path.resolve(__dirname, '../packages/plugin-form/src/index.tsx'),
          '@object-ui/plugin-gantt': path.resolve(__dirname, '../packages/plugin-gantt/src/index.tsx'),
          '@object-ui/plugin-grid': path.resolve(__dirname, '../packages/plugin-grid/src/index.tsx'),
          '@object-ui/plugin-kanban': path.resolve(__dirname, '../packages/plugin-kanban/src/index.tsx'),
          '@object-ui/plugin-list': path.resolve(__dirname, '../packages/plugin-list/src/index.tsx'),
          '@object-ui/plugin-map': path.resolve(__dirname, '../packages/plugin-map/src/index.tsx'),
          '@object-ui/plugin-markdown': path.resolve(__dirname, '../packages/plugin-markdown/src/index.tsx'),
          '@object-ui/plugin-report': path.resolve(__dirname, '../packages/plugin-report/src/index.tsx'),
          '@object-ui/plugin-timeline': path.resolve(__dirname, '../packages/plugin-timeline/src/index.tsx'),
          '@object-ui/plugin-view': path.resolve(__dirname, '../packages/plugin-view/src/index.tsx'),
        },
      },
      optimizeDeps: {
        include: [
          'msw',
          'msw/browser',
          '@objectstack/spec',
          '@objectstack/spec/data',
          '@objectstack/spec/system',
          '@objectstack/spec/ui',
          '@objectstack/runtime',
          '@objectstack/objectql',
          '@objectstack/driver-memory',
          '@objectstack/plugin-msw',
          '@mdx-js/react',
          'react-router-dom',
        ],
      },
      build: {
        target: 'esnext',
      },
    });

    // Apply onwarn directly to avoid mergeConfig potentially dropping function callbacks
    merged.build ??= {};
    merged.build.rollupOptions ??= {};
    const existingOnwarn = merged.build.rollupOptions.onwarn;
    merged.build.rollupOptions.onwarn = (warning, warn) => {
      // Suppress "use client" directive warnings (from Radix UI, react-router, etc.)
      // and sourcemap resolution errors from dependencies with incomplete sourcemaps
      if (
        warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
        warning.message?.includes("Can't resolve original location of error")
      ) {
        return;
      }
      if (existingOnwarn) {
        existingOnwarn(warning, warn);
      } else {
        warn(warning);
      }
    };

    return merged;
  },
};
export default config;
