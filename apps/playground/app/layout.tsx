import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

// Import components registry
import '@object-ui/components';

// Import lazy-loaded plugins
import '@object-ui/plugin-editor';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-kanban';

export const metadata: Metadata = {
  title: 'Object UI Studio - Schema-Driven UI Builder',
  description: 'Build beautiful, responsive interfaces with pure JSON schemas. The universal schema-driven UI engine powered by React, Tailwind, and Shadcn.',
  keywords: ['Object UI', 'Schema-Driven', 'UI Builder', 'React', 'Tailwind', 'Low-Code'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
