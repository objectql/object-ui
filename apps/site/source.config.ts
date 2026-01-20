import { defineConfig, defineDocs, defineCollections } from 'fumadocs-mdx/config';
import { z } from 'zod';

export const { docs, meta } = defineDocs({
  dir: '../../docs',
  root: '../../docs',
  files: ['**/*.{md,mdx}', '!**/node_modules/**'],
});

export const blog = defineCollections({
  dir: 'content/blog',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.string().date().or(z.date()).map((d) => new Date(d).toISOString()),
    author: z.string().optional(),
  }),
  type: 'doc',
});

export default defineConfig();
