/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Navigate, useParams } from 'react-router-dom';
import { FileQuestion, Loader2 } from 'lucide-react';
import { DocShell } from './DocShell';
import BookPage from './BookPage';
import { useBookData } from './use-book-data';
import { bookSlug, homeBook } from './book-nav';

/**
 * `/docs/:slug` — resolves a single segment under the portal to either a book
 * landing or a legacy doc permalink (ADR-0046).
 *
 * Books and docs share the `/docs/<segment>` space deliberately: a doc's
 * identity stays single-coordinate (`<name>`, ADR §4) while a book occupies a
 * `slug` portal segment (ADR §6). When the segment is a book slug we render its
 * landing; otherwise we treat it as a flat doc name and redirect to its
 * canonical in-book URL `/docs/<homeBook>/<name>` — every doc has a home book
 * (its package's authored or implicit book, §6.4), so this resolves for any
 * installed doc. An unknown segment degrades to a "not found" notice.
 */
export default function DocsSlug() {
  const { slug, appName } = useParams<{ slug: string; appName?: string }>();
  const { books, docs, state } = useBookData();

  if (state === 'loading') {
    return (
      <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading documentation" />
      </div>
    );
  }

  // A book slug → render its landing (BookPage reads the same `:slug` param).
  if (slug && books.some((b) => bookSlug(b) === slug)) {
    return <BookPage />;
  }

  // Otherwise a flat doc permalink → redirect to its canonical in-book URL.
  const base = appName ? `/apps/${appName}/docs` : '/docs';
  const hb = slug ? homeBook(slug, books, docs) : null;
  if (hb && slug) {
    return <Navigate to={`${base}/${bookSlug(hb)}/${slug}`} replace />;
  }

  return (
    <DocShell breadcrumb={slug}>
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Documentation not found</h1>
        <p className="text-sm text-muted-foreground">
          No book or document named <code className="rounded bg-muted px-1 py-0.5">{slug}</code> is installed.
        </p>
      </div>
    </DocShell>
  );
}
