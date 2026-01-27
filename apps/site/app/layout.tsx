import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
// AG Grid styles - required for plugin-aggrid demos
import { Inter } from 'next/font/google';
import { ObjectUIProvider } from '@/app/components/ObjectUIProvider';

const inter = Inter({
  subsets: ['latin'],
});

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <ObjectUIProvider>{children}</ObjectUIProvider>
        </RootProvider>
      </body>
    </html>
  );
}
