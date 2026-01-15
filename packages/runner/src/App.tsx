// Ensure this file is treated as a module
export {}; 

import { SchemaRenderer } from '@object-ui/react';
import '@object-ui/components';
import { PageSchema, AppSchema } from '@object-ui/types';
import { useState, useEffect, useCallback } from 'react';
import { LayoutRenderer } from './LayoutRenderer';

// --- Router Logic ---

/**
 * Matches a URL path to a list of file paths (glob keys).
 * Supports exact match, index match, and dynamic [param] match.
 */
function matchRoute(urlPath: string, filePaths: string[]) {
  // Normalize URL: /customers/123 -> customers/123
  const normalizedUrl = urlPath.replace(/^\//, '').replace(/\/$/, '') || 'index';

  // 1. Exact Match (e.g. customers.json)
  const exactMatch = filePaths.find(p => {
    const name = p.replace(/^\.\/app-data\/pages\//, '').replace(/\.json$/, '');
    return name === normalizedUrl;
  });
  if (exactMatch) return { file: exactMatch, params: {} };

  // 2. Index Match (e.g. customers/index.json)
  const indexMatch = filePaths.find(p => {
    const name = p.replace(/^\.\/app-data\/pages\//, '').replace(/\/index\.json$/, '');
    return name === normalizedUrl;
  });
  if (indexMatch) return { file: indexMatch, params: {} };

  // 3. Dynamic Match (e.g. customers/[id].json)
  for (const filePath of filePaths) {
    // customers/[id].json -> customers/[id]
    const routePattern = filePath
      .replace(/^\.\/app-data\/pages\//, '')
      .replace(/\/index\.json$/, '') // Handle [id]/index.json as [id]
      .replace(/\.json$/, '');

    // If it doesn't have dynamic params, we already checked it in exact/index match
    if (!routePattern.includes('[')) continue;

    // Convert [id] -> ([^/]+)
    const paramNames: string[] = [];
    const regexSource = routePattern
      .replace(/\//g, '\\/') // Escape slashes
      .replace(/\[([^\]]+)\]/g, (_, name) => {
        paramNames.push(name);
        return '([^\\/]+)';
      });
    
    const regex = new RegExp(`^${regexSource}$`);
    const match = normalizedUrl.match(regex);

    if (match) {
      const params: Record<string, string> = {};
      match.slice(1).forEach((val, i) => {
        params[paramNames[i]] = decodeURIComponent(val);
      });
      return { file: filePath, params };
    }
  }

  return null;
}

export default function App() {
  const [appConfig, setAppConfig] = useState<AppSchema | null>(null);
  const [pageSchema, setPageSchema] = useState<PageSchema | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // --- 1. Load Global Config (once) ---
  useEffect(() => {
    const loadAppConfig = async () => {
      try {
        const appFiles = import.meta.glob('./app-data/app.json');
        if (appFiles['./app-data/app.json']) {
          const mod: any = await appFiles['./app-data/app.json']();
          const loaded = mod.default || mod;
          if (loaded.type === 'app') {
            setAppConfig(loaded);
          }
        }
      } catch (e) {
        console.error("Error loading app.json", e);
      }
    };
    loadAppConfig();
  }, []);

  // --- 2. Route Handling ---

  const handleNavigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    setCurrentPath(to);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // --- 3. Page Loading Logic ---
  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const pagesGlob = import.meta.glob('./app-data/pages/**/*.json');
        const filePaths = Object.keys(pagesGlob);
        
        // A. Match Route
        const match = matchRoute(currentPath, filePaths);

        if (match) {
          const mod: any = await pagesGlob[match.file]();
          const loaded = mod.default || mod;
          // Inject params into schema if needed? 
          // For now, we assume title/data might rely on context, but here we just render.
          setPageSchema(loaded);
        } else {
           // B. Fallback: No pages folder? Try root
          const rootGlob = import.meta.glob('./app-data/*.json');
          const rootKeys = Object.keys(rootGlob).filter(k => !k.endsWith('app.json') && !k.endsWith('package.json'));
          
          if (rootKeys.length > 0 && currentPath === '/') {
             // If root has index.json or similar, load it for '/'
             const mod: any = await rootGlob[rootKeys[0]]();
             setPageSchema(mod.default || mod);
          } else {
             // 404
             if (filePaths.length > 0 || rootKeys.length > 0) {
                setError(`Page not found: ${currentPath}`);
                setPageSchema(null);
             } else {
                 setPageSchema({
                    type: 'page',
                    title: 'Welcome',
                    body: [{ type: 'div', className: "p-10 text-center", body: 'No JSON files found in src/app-data.' }]
                 } as any);
             }
          }
        }

      } catch (err) {
        console.error(err);
        setError("Failed to load page.");
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [currentPath]);

  // --- Render ---

  if (error) {
    // Show error inside layout if possible
    const errorContent = (
      <div className="flex flex-col items-center justify-center h-full p-12 text-red-600">
        <h1 className="text-2xl font-bold">404 / Error</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <button onClick={() => handleNavigate('/')} className="mt-4 text-blue-600 hover:underline">
          Go Home
        </button>
      </div>
    );

    if (appConfig) {
      return (
        <LayoutRenderer app={appConfig} currentPath={currentPath} onNavigate={handleNavigate}>
          {errorContent}
        </LayoutRenderer>
      );
    }
    return errorContent;
  }

  if (loading || !pageSchema) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
         <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600 mr-2" />
         Loading...
      </div>
    );
  }

  const content = <SchemaRenderer schema={pageSchema} />;

  if (appConfig) {
    return (
      <LayoutRenderer app={appConfig} currentPath={currentPath} onNavigate={handleNavigate}>
        {content}
      </LayoutRenderer>
    );
  }

  return (
    <div className="object-ui-app">
      {content}
    </div>
  );
}
