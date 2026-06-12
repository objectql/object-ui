/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, FileQuestion, Loader2 } from 'lucide-react';
import { useAdapter } from '@object-ui/app-shell';
import { MarkdownRenderer } from '@object-ui/plugin-markdown';
import { rewriteDocLinks } from './doc-links';

interface DocItem {
  name: string;
  label?: string;
  content: string;
}

/**
 * `/docs/:name` — render one package-doc metadata item (ADR-0046).
 *
 * Docs are inert `doc` metadata compiled from a package's flat
 * `src/docs/*.md`; this page fetches the item by name through the
 * standard metadata API and renders the sanitized Markdown body,
 * rewriting relative `[x](./other_doc.md)` references to `/docs/<name>`
 * routes (see doc-links.ts).
 *
 * Per the ADR, an unresolvable doc (bad URL, or a cross-package link
 * whose target was removed in a newer dependency version) degrades to a
 * "not found" notice — never an install-time or hard failure.
 */
export default function DocPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const adapter = useAdapter();
  const [doc, setDoc] = useState<DocItem | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!name || !adapter) return;
      setState('loading');
      try {
        const raw: any = await adapter.getClient().meta.getItem('doc', name);
        const item = raw?.item ?? raw?.data ?? raw;
        if (cancelled) return;
        if (item && typeof item.content === 'string') {
          setDoc({ name, label: item.label, content: item.content });
          setState('ready');
        } else {
          setState('missing');
        }
      } catch (err: any) {
        if (cancelled) return;
        // The metadata API answers 404 for unknown names — that is the
        // ADR-mandated soft-degrade path, not an error.
        const status = err?.status ?? err?.response?.status;
        if (status === 404 || /not found/i.test(err?.message ?? '')) {
          setState('missing');
        } else {
          setErrorMessage(err?.message ?? 'Failed to load documentation');
          setState('error');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [name, adapter]);

  // SPA navigation for rewritten doc-to-doc links: anchors render as
  // plain <a href="/docs/...">; intercept same-app clicks so following a
  // cross-reference doesn't trigger a full page reload.
  const onContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const anchor = (e.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href');
      if (href && href.startsWith('/docs/')) {
        e.preventDefault();
        navigate(href);
      }
    },
    [navigate],
  );

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading documentation" />
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Documentation not found</h1>
        <p className="text-sm text-muted-foreground">
          No document named <code className="rounded bg-muted px-1 py-0.5">{name}</code> is installed.
          It may belong to a package that is not installed, or it was removed in a newer version.
        </p>
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
    <div className="mx-auto max-w-3xl p-4 sm:p-6" onClick={onContentClick}>
      <MarkdownRenderer
        schema={{ type: 'markdown', content: rewriteDocLinks(doc?.content ?? '') }}
      />
    </div>
  );
}
