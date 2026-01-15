import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

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
