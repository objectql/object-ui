import { loader } from 'fumadocs-core/source';
import { resolveFiles } from 'fumadocs-mdx';
import { docs, meta } from '@/.source';

export const source = loader({
  baseUrl: '/docs',
  source: {
    files: resolveFiles({ docs, meta }),
  },
});
