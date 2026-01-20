import { defineConfig, defineDocs, defineCollections } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const { docs, meta } = defineDocs({
  dir: '../../docs',
  docs: {
    files: [
      '**/*.{md,mdx}', 
      '!**/node_modules/**', 
      '!**/.vitepress/**',
      '!**/dist/**',
      '!**/.*/**', 
    ],
  },
});

export const blog = defineCollections({
  dir: 'content/blog',
  files: ['**/*.{md,mdx}', '!**/node_modules/**'],
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.string().or(z.date()).transform((d) => new Date(d).toISOString()),
    author: z.string().optional(),
  }),
  type: 'doc',
});

export default defineConfig();
