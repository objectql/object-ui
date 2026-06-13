/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, BookOpen, Loader2 } from 'lucide-react';
import { useAdapter } from '@object-ui/app-shell';
import { type DocGroup, groupDocsByPackage } from './doc-groups';
import { DocShell } from './DocShell';

/**
 * `/docs` — the platform-level documentation portal (ADR-0046).
 *
 * Lists every installed `doc` metadata item, grouped by package
 * namespace, each linking to the single-doc viewer at `/docs/<name>`.
 * The viewer route is app-independent, so this portal is the canonical
 * place to discover docs regardless of which app (if any) is active.
 * An app may additionally surface a contextual link into a specific
 * `/docs/<name>`, but discovery lives here.
 */
export default function DocsIndex() {
  const adapter = useAdapter();
  const [groups, setGroups] = useState<DocGroup[]>([]);
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
        setGroups(
          groupDocsByPackage(
            items.map((it) => ({ name: it?.name, label: it?.label, description: it?.description })),
          ),
        );
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
  }, [adapter]);

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
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10" />
          <p className="text-sm">
            No documentation is installed. Packages ship docs as flat
            <code className="mx-1 rounded bg-muted px-1 py-0.5">src/docs/*.md</code>
            files (ADR-0046).
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.pkg}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.pkg}
              </h2>
              <ul className="divide-y divide-border rounded-md border border-border">
                {group.docs.map((doc) => (
                  <li key={doc.name}>
                    <Link
                      to={`/docs/${doc.name}`}
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
            </section>
          ))}
        </div>
      )}
      </div>
    </DocShell>
  );
}
