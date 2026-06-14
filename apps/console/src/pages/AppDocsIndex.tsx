/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, BookOpen, Loader2 } from 'lucide-react';
import { useAdapter } from '@object-ui/app-shell';
import { DocShell } from './DocShell';

interface AppDocItem {
  name: string;
  label?: string;
  description?: string;
}

/**
 * `/apps/:appName/docs` — the app-scoped documentation index (ADR-0046/0048).
 *
 * The platform `/docs` portal lists *every* installed doc grouped by package;
 * this is its package-scoped sibling: the docs owned by the app whose
 * container this route renders inside (`:appName` is the package-id segment,
 * matched against each doc's `_packageId`). It is the landing target for the
 * header Help menu's "This app's docs" entry when an app ships more than one
 * doc — a single-doc app deep-links straight to the viewer instead.
 *
 * Like the rest of the doc routes it degrades softly: an app with no docs
 * shows an empty-state notice, never a hard error.
 */
export default function AppDocsIndex() {
  // `appName` is the parent route's package-id segment (/apps/:appName/docs).
  const { appName } = useParams<{ appName?: string }>();
  const adapter = useAdapter();
  const [docs, setDocs] = useState<AppDocItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!adapter) return;
      const client: any = adapter.getClient();
      if (!client?.meta?.getItems) {
        setErrorMessage('meta.getItems is not available on this client');
        setState('error');
        return;
      }
      setState('loading');
      try {
        const result: any = await client.meta.getItems('doc');
        const items: any[] = Array.isArray(result)
          ? result
          : Array.isArray(result?.items)
            ? result.items
            : Array.isArray(result?.value)
              ? result.value
              : [];
        if (cancelled) return;
        const mine = items
          .filter((it) => it && it.name && it._packageId === appName)
          .map((it) => ({ name: it.name, label: it.label, description: it.description }))
          .sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name));
        setDocs(mine);
        setState('ready');
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(err?.message ?? 'Failed to load documentation');
        setState('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [adapter, appName]);

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading documentation" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h1 className="text-lg font-semibold">Failed to load documentation</h1>
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
      </div>
    );
  }

  return (
    <DocShell>
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <BookOpen className="h-10 w-10" />
            <p className="text-sm">
              This app does not ship any documentation yet.
            </p>
            <Link to="/docs" className="text-sm font-medium text-primary hover:underline">
              Browse all documentation
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {docs.map((doc) => (
              <li key={doc.name}>
                <Link
                  to={`/apps/${appName}/docs/${doc.name}`}
                  className="flex items-start gap-3 px-3 py-3 hover:bg-muted/50"
                >
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{doc.label ?? doc.name}</div>
                    {doc.description ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {doc.description}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DocShell>
  );
}
