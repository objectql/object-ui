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
import DocsIndex from './DocsIndex';
import DocsSlug from './DocsSlug';
import DocPage from './DocPage';

function Harness({ entry }: { entry: string }) {
  return (
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/docs" element={<DocsIndex />} />
        <Route path="/docs/:slug" element={<DocsSlug />} />
        <Route path="/docs/:slug/:name" element={<DocPage />} />
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

  it('/docs/:slug renders the book landing with its docs (resolved spine)', async () => {
    render(<Harness entry="/docs/crm" />);
    // Both the sidebar and the overview list the book's docs.
    expect(await screen.findAllByText('CRM Intro')).not.toHaveLength(0);
    expect(screen.getAllByText('Leads').length).toBeGreaterThan(0);
    // The overview links a doc to the in-book reader URL.
    const links = screen.getAllByRole('link', { name: 'CRM Intro' });
    expect(links.some((a) => a.getAttribute('href') === '/docs/crm/crm_intro')).toBe(true);
  });

  it('/docs/:slug/:name renders the doc content with the book sidebar (active)', async () => {
    render(<Harness entry="/docs/crm/crm_intro" />);
    expect(await screen.findByTestId('doc-content')).toHaveTextContent('Welcome to the CRM');
    // Sidebar marks the current doc as active.
    const active = screen.getByRole('link', { name: 'CRM Intro' });
    expect(active).toHaveAttribute('aria-current', 'page');
    // A sibling doc is reachable from the sidebar.
    expect(screen.getByRole('link', { name: 'Leads' })).toHaveAttribute('href', '/docs/crm/crm_guide_lead');
  });

  it('legacy /docs/:name redirects to the doc\'s canonical in-book URL', async () => {
    render(<Harness entry="/docs/crm_intro" />);
    // 'crm_intro' is not a book slug → dispatcher redirects to /docs/crm/crm_intro,
    // which renders the reader.
    expect(await screen.findByTestId('doc-content')).toHaveTextContent('Welcome to the CRM');
    expect(screen.getByRole('link', { name: 'CRM Intro' })).toHaveAttribute('aria-current', 'page');
  });

  it('an unknown segment degrades to a not-found notice', async () => {
    render(<Harness entry="/docs/does_not_exist" />);
    expect(await screen.findByText('Documentation not found')).toBeInTheDocument();
  });

  it('clicking a book card navigates to its landing (real router flow)', async () => {
    render(<Harness entry="/docs" />);
    fireEvent.click(await screen.findByRole('link', { name: /ops/i }));
    // Now on /docs/ops — the ops book landing renders, headed by the book, with
    // its doc reachable (in both the sidebar and the overview list).
    expect(await screen.findByRole('heading', { name: 'ops' })).toBeInTheDocument();
    const setupLinks = screen.getAllByRole('link', { name: 'Setup' });
    expect(setupLinks.some((a) => a.getAttribute('href') === '/docs/ops/ops_setup')).toBe(true);
  });
});
