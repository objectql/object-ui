/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@object-ui/components',
    '@object-ui/core',
    '@object-ui/react',
    '@object-ui/types',
    '@object-ui/designer',
    '@object-ui/plugin-charts',
    '@object-ui/plugin-editor',
    '@object-ui/plugin-kanban',
    '@object-ui/plugin-markdown',
  ],
  experimental: {
    // Enable Server Actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
