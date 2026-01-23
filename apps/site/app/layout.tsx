import './global.css';
import '@object-ui/components/style.css';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { ObjectUIProvider } from './components/ObjectUIProvider';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>
          <ObjectUIProvider>
            {children}
          </ObjectUIProvider>
        </RootProvider>
      </body>
    </html>
  );
}
