import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  transpilePackages: [
    '@object-ui/core',
    '@object-ui/components',
    '@object-ui/fields',
    '@object-ui/i18n',
    '@object-ui/layout',
    '@object-ui/react',
    '@object-ui/types',
    '@object-ui/plugin-aggrid',
    '@object-ui/plugin-calendar',
    '@object-ui/plugin-charts',
    '@object-ui/plugin-chatbot',
    '@object-ui/plugin-dashboard',
    '@object-ui/plugin-editor',
    '@object-ui/plugin-form',
    '@object-ui/plugin-gantt',
    '@object-ui/plugin-grid',
    '@object-ui/plugin-kanban',
    '@object-ui/plugin-map',
    '@object-ui/plugin-markdown',
    '@object-ui/plugin-timeline',
    '@object-ui/plugin-view',
  ],
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/docs/:path*',
      },
    ];
  },
};

export default withMDX(config);
