import { loader } from 'fumadocs-core/source';
import { docs } from '@/.source';

// Map the docs from .source to the format expected by loader
// Note: docs from .source is wrapped by _runtime.doc(), not a plain array
const mappedDocs = docs
  .filter((doc: any) => doc && doc.info && doc.info.path)
  .map((doc: any) => {
    let path = doc.info.path.replace(/\.mdx?$/, '');
    // Convert index.mdx to empty path for root /docs route
    if (path === 'index') path = '';
    
    return {
      type: 'page' as const,
      path,
      data: {
        ...doc.data,
        body: doc.data.default,
      },
    };
  });

export const source = loader({
  baseUrl: '/docs',
  source: {
    files: mappedDocs,
  },
});
