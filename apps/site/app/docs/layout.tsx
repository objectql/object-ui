import { source } from '@/lib/source';
import type { ReactNode } from 'react';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { Logo } from '../components/Logo';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout 
      tree={source.pageTree} 
      nav={{ title: <Logo />, url: '/' }}
      links={[
        {
          text: 'Documentation',
          url: '/docs',
          active: 'nested-url',
        },
        {
          text: 'Blog',
          url: '/blog',
          active: 'nested-url',
        },
      ]}
    >
      {children}
    </DocsLayout>
  );
}
