/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Integration test for the book-driven docs portal (ADR-0046 §6): mounts the
 * REAL DocsIndex / DocsSlug / BookPage / DocPage under the REAL route table,
 * backed by a mocked metadata adapter (no authored books — so the implicit
 * per-package books are exercised, §6.4). Verifies the full reader flow that
 * the unit tests can't: routing, the /docs/:slug dispatcher, the book landing,
 * the in-book reader + sidebar, and the legacy /docs/:name redirect.
 *
 * This is a jsdom integration test, not a real browser — it needs no backend.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Sample metadata the mocked adapter serves (two packages, no books) ──────
// Defined via vi.hoisted so the hoisted vi.mock factory can close over them,
// and so the adapter is a STABLE singleton — the real useAdapter() returns a
// memoized instance, so a fresh object per render would loop the fetch effects.
const { ADAPTER } = vi.hoisted(() => {
  const DOCS = [
    { name: 'crm_intro', label: 'CRM Intro', _packageId: 'crm', order: 1 },
    { name: 'crm_guide_lead', label: 'Leads', _packageId: 'crm', order: 2 },
    { name: 'ops_setup', label: 'Setup', _packageId: 'ops' },
  ];
  const CONTENT: Record<string, string> = {
    crm_intro: 'Welcome to the CRM',
    crm_guide_lead: 'Managing leads',
    ops_setup: 'Operations setup',
  };
  const ADAPTER = {
    getClient: () => ({
      meta: {
        getItems: async (type: string) => (type === 'doc' ? DOCS : []), // no authored books
        getItem: async (_type: string, name: string) => ({ item: { name, content: CONTENT[name] } }),
      },
    }),
  };
  return { ADAPTER };
});

vi.mock('@object-ui/app-shell', () => ({ useAdapter: () => ADAPTER }));

vi.mock('@object-ui/plugin-markdown', () => ({
  MarkdownRenderer: ({ schema }: { schema: { content?: string } }) => (
    <div data-testid="doc-content">{schema.content}</div>
  ),
  extractToc: () => [],
}));

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({ t: (_k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? _k }),
}));

// Imported AFTER the mocks so the pages pick up the mocked modules.
import DocsLayout from './DocsLayout';
import DocsIndex from './DocsIndex';
import DocsSlug from './DocsSlug';
import DocPage from './DocPage';

// Mirrors the real route table: the layout fetches once and shares the data.
function Harness({ entry }: { entry: string }) {
  return (
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<DocsIndex />} />
          <Route path=":slug" element={<DocsSlug />} />
          <Route path=":slug/:name" element={<DocPage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

afterEach(cleanup);

describe('book-driven docs portal (integration)', () => {
  it('/docs lists an implicit per-package book for every package with docs', async () => {
    render(<Harness entry="/docs" />);
    // Implicit books keyed by packageId: crm (2 docs) + ops (1 doc).
    const crm = await screen.findByRole('link', { name: /crm/i });
    expect(crm).toHaveAttribute('href', '/docs/crm');
    expect(screen.getByRole('link', { name: /ops/i })).toHaveAttribute('href', '/docs/ops');
    expect(screen.getByText('2 articles')).toBeInTheDocument();
    expect(screen.getByText('1 article')).toBeInTheDocument();
  });

  it('/docs/:slug opens the book to its overview doc (no duplicated TOC)', async () => {
    render(<Harness entry="/docs/crm" />);
    // The landing redirects into the reader of the first doc; content + sidebar.
    expect(await screen.findByTestId('doc-content')).toHaveTextContent('Welcome to the CRM');
    const intro = screen.getAllByRole('link', { name: 'CRM Intro' });
    expect(intro.every((l) => l.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('/docs/:slug/:name renders the doc content with the book sidebar (active)', async () => {
    render(<Harness entry="/docs/crm/crm_intro" />);
    expect(await screen.findByTestId('doc-content')).toHaveTextContent('Welcome to the CRM');
    // The sidebar is rendered twice (persistent on wide, a disclosure on narrow);
    // both mark the current doc active.
    const active = screen.getAllByRole('link', { name: 'CRM Intro' });
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(active.every((l) => l.getAttribute('aria-current') === 'page')).toBe(true);
    // A sibling doc is reachable from the sidebar.
    const leads = screen.getAllByRole('link', { name: 'Leads' });
    expect(leads.some((l) => l.getAttribute('href') === '/docs/crm/crm_guide_lead')).toBe(true);
  });

  it('legacy /docs/:name redirects to the doc\'s canonical in-book URL', async () => {
    render(<Harness entry="/docs/crm_intro" />);
    // 'crm_intro' is not a book slug → dispatcher redirects to /docs/crm/crm_intro.
    expect(await screen.findByTestId('doc-content')).toHaveTextContent('Welcome to the CRM');
    const active = screen.getAllByRole('link', { name: 'CRM Intro' });
    expect(active.every((l) => l.getAttribute('aria-current') === 'page')).toBe(true);
  });

  it('an unknown segment degrades to a not-found notice', async () => {
    render(<Harness entry="/docs/does_not_exist" />);
    expect(await screen.findByText('Documentation not found')).toBeInTheDocument();
  });

  it('clicking a book card opens it (real router flow)', async () => {
    render(<Harness entry="/docs" />);
    fireEvent.click(await screen.findByRole('link', { name: /ops/i }));
    // /docs/ops opens the ops book → reader of its single doc.
    expect(await screen.findByTestId('doc-content')).toHaveTextContent('Operations setup');
  });
});
