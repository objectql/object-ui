/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, FileQuestion, Loader2 } from 'lucide-react';
import { DocShell } from './DocShell';
import { BookSidebar } from './BookSidebar';
import { useBookData } from './use-book-data';
import { resolveBookTree, scopeDocsToBook, bookSlug } from './book-nav';

/**
 * `/docs/:slug` — a book landing page (ADR-0046 §6). Resolves the book's spine
 * against the current docs and shows the grouped table of contents: the
 * persistent nav sidebar plus an overview that lists every section's docs. Each
 * doc links to the in-book reader (`/docs/:slug/:name`), which keeps this
 * sidebar in view. `:slug` is the book's `slug` (an implicit per-package book
 * uses its packageId).
 */
export default function BookPage() {
  const { slug, appName } = useParams<{ slug: string; appName?: string }>();
  const { books, docs, state, error } = useBookData();

  const found = useMemo(() => books.find((b) => bookSlug(b) === slug), [books, slug]);
  const resolved = useMemo(
    () => (found ? resolveBookTree(found, scopeDocsToBook(found, docs)) : null),
    [found, docs],
  );

  const base = appName ? `/apps/${appName}/docs` : '/docs';
  const docHref = (name: string) => `${base}/${slug}/${name}`;

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading documentation" />
      </div>
    );
  }

  if (state === 'error' || !found || !resolved) {
    return (
      <DocShell breadcrumb={slug}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-10 text-center">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
          <h1 className="text-lg font-semibold">
            {state === 'error' ? 'Failed to load documentation' : 'Book not found'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {error ?? (
              <>
                No book named <code className="rounded bg-muted px-1 py-0.5">{slug}</code> is installed.
              </>
            )}
          </p>
        </div>
      </DocShell>
    );
  }

  return (
    <DocShell breadcrumb={resolved.label ?? slug}>
      <div className="mx-auto flex max-w-5xl gap-8 p-4 sm:p-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-auto pr-1">
            <BookSidebar book={resolved} docHref={docHref} />
          </div>
        </aside>

        <div className="min-w-0 max-w-3xl flex-1">
          <h1 className="text-2xl font-bold">{resolved.label ?? slug}</h1>
          {resolved.description ? (
            <p className="mt-2 text-sm text-muted-foreground">{resolved.description}</p>
          ) : null}

          <div className="mt-6 space-y-8">
            {resolved.groups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {group.entries
                    .filter((e) => !e.separator)
                    .map((entry, i) =>
                      entry.href ? (
                        <li key={`ext-${i}`}>
                          <a
                            href={entry.href}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-start gap-3 px-3 py-3 hover:bg-muted/50"
                          >
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm font-medium">{entry.label ?? entry.href}</span>
                          </a>
                        </li>
                      ) : entry.doc ? (
                        <li key={entry.doc}>
                          <Link
                            to={docHref(entry.doc)}
                            className="flex items-start gap-3 px-3 py-3 hover:bg-muted/50"
                          >
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="text-sm font-medium">{entry.label ?? entry.doc}</div>
                              {entry.description ? (
                                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                  {entry.description}
                                </div>
                              ) : null}
                            </div>
                          </Link>
                        </li>
                      ) : null,
                    )}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </DocShell>
  );
}
