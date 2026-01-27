import { RootProvider } from 'fumadocs-ui/provider/next';
import './global.css';
// AG Grid styles - required for plugin-aggrid demos
import { ObjectUIProvider } from '@/app/components/ObjectUIProvider';


export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <ObjectUIProvider>{children}</ObjectUIProvider>
        </RootProvider>
      </body>
    </html>
  );
}
