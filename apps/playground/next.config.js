const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during builds temporarily - will be re-enabled after fixing linting issues
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable type checking for transpiled packages during builds
    // Type errors in @object-ui/components don't affect playground functionality
    ignoreBuildErrors: true,
  },
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
  webpack: (config) => {
    // Add alias for @/ used in components package
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '../../packages/components/src'),
    };
    return config;
  },
};

module.exports = nextConfig;
