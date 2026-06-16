/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, FileQuestion, Loader2 } from 'lucide-react';
import { useAdapter } from '@object-ui/app-shell';
import { MarkdownRenderer, extractToc } from '@object-ui/plugin-markdown';
import { useObjectTranslation } from '@object-ui/i18n';
import { rewriteDocLinks } from './doc-links';
import { DocShell } from './DocShell';

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
  // `appName` is the parent route's package-id segment
  // (/apps/:appName/docs/:name); undefined on the legacy top-level /docs/:name.
  const { name, appName } = useParams<{ name: string; appName?: string }>();
  const navigate = useNavigate();
  const adapter = useAdapter();
  const { t } = useObjectTranslation();
  const [doc, setDoc] = useState<DocItem | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!name || !adapter) return;
      setState('loading');
      try {
        // ADR-0048 — pass the route's package so the single-doc fetch is
        // package-scoped (prefer-local) on the server. With this, doc names
        // need not be globally namespace-prefixed; the prefix becomes optional.
        const raw: any = await adapter.getClient().meta.getItem('doc', name, appName ? { packageId: appName } : undefined);
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
  }, [name, appName, adapter]);

  // Scroll a heading into view ourselves rather than letting the browser
  // follow a bare `#id` href. When the console is served under a sub-path the
  // host injects `<base href="…/_console/">` so relative asset URLs resolve; a
  // side effect is that fragment-only links resolve against that base instead
  // of the current page, so a plain `#id` click navigates to the console root
  // ("home") rather than scrolling. Reflect the section in the URL via an
  // absolute path that ignores <base>.
  const scrollToHeading = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${id}`);
  }, []);

  // SPA navigation for rewritten doc-to-doc links: anchors render as plain
  // <a href="/docs/...">; intercept same-app clicks so following a
  // cross-reference doesn't trigger a full page reload. In-body fragment links
  // (`[x](#section)`) get the same JS-scroll treatment as the ToC so <base>
  // doesn't bounce them to home.
  const onContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const anchor = (e.target as HTMLElement).closest('a');
      const href = anchor?.getAttribute('href');
      if (!href) return;
      if (href.startsWith('/docs/')) {
        e.preventDefault();
        navigate(href);
      } else if (href.startsWith('#')) {
        e.preventDefault();
        scrollToHeading(decodeURIComponent(href.slice(1)));
      }
    },
    [navigate, scrollToHeading],
  );

  // ToC entries are bare `#id` anchors; scroll in JS for the same <base> reason.
  const onTocClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      // Leave modified / non-primary clicks (new tab, etc.) to the browser.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      scrollToHeading(id);
    },
    [scrollToHeading],
  );

  // Long-doc table of contents (h2–h3). Slugs match rehype-slug so a #id
  // link resolves to the rendered heading's anchor. Shown only past a few
  // headings so short docs stay clean.
  const toc = useMemo(() => extractToc(doc?.content ?? ''), [doc?.content]);
  const tocLabel = t('help.onThisPage', { defaultValue: 'On this page' });

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading documentation" />
      </div>
    );
  }

  if (state === 'missing') {
    return (
      <DocShell breadcrumb={name}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-10 text-center">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Documentation not found</h1>
          <p className="text-sm text-muted-foreground">
            No document named <code className="rounded bg-muted px-1 py-0.5">{name}</code> is installed.
            It may belong to a package that is not installed, or it was removed in a newer version.
          </p>
        </div>
      </DocShell>
    );
  }

  if (state === 'error') {
    return (
      <DocShell breadcrumb={name}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-10 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <h1 className="text-lg font-semibold">Failed to load documentation</h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </DocShell>
    );
  }

  return (
    <DocShell breadcrumb={doc?.label ?? name}>
      <div className="mx-auto flex max-w-5xl gap-8 p-4 sm:p-6">
        <article
          className="min-w-0 max-w-3xl flex-1 [&_h1]:scroll-mt-24 [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24"
          onClick={onContentClick}
        >
          <MarkdownRenderer
            schema={{ type: 'markdown', content: rewriteDocLinks(doc?.content ?? '') }}
          />
        </article>
        {toc.length >= 3 ? (
          <aside className="hidden xl:block w-56 shrink-0">
            <nav aria-label={tocLabel} className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-auto">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {tocLabel}
              </div>
              <ul className="border-l border-border text-sm">
                {toc.map((item) => (
                  <li key={item.id} style={{ paddingLeft: (item.depth - 2) * 12 }}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => onTocClick(e, item.id)}
                      className="-ml-px block border-l border-transparent py-0.5 pl-3 text-muted-foreground hover:border-primary hover:text-foreground"
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        ) : null}
      </div>
    </DocShell>
  );
}
