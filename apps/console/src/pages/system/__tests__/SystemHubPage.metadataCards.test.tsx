// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The System hub's two metadata cards land on the CANONICAL metadata-admin
 * routes in one hop, never on the deprecated alias (objectui#3660).
 *
 * ## What was wrong
 *
 * The "Metadata" card aimed at `…/component/metadata/directory` and the
 * "Datasources" card at `…/component/metadata/resource?type=datasource`.
 * app-shell declares both spellings as legacy *aliases*, not pages: their route
 * element is `LegacyMetadataRedirect`, which immediately `<Navigate>`s onto
 * `…/metadata` and `…/metadata/datasource` respectively. So every click on
 * either card paid a redundant hop plus a re-render to reach a destination the
 * hub could name directly.
 *
 * These are the third and fourth of the six producers enumerated while fixing
 * objectui#3639; that issue's PR corrected the console host's two redirects
 * (`ObjectRedirect` / `MetadataRedirect`) but the two cards here were outside
 * its declared file surface. The remaining two producers are the `sys-datasources`
 * entries in app-shell's two sidebars, pinned by that package's
 * `layout/__tests__/systemNavDatasourcesHop.test.tsx`.
 *
 * ## What these tests measure
 *
 * `ChainRecorder` records every distinct location the router settles on, so the
 * assertion is about the *chain*, not only its endpoint. Endpoint-only
 * assertions cannot tell a one-hop click from a two-hop one — both finish at
 * `…/metadata/datasource` — and one hop versus two is the whole of this issue.
 * The technique is lifted from `__tests__/AppContent.legacyRedirects.test.tsx`
 * (objectui#3639), deliberately, so both halves of the same defect are measured
 * the same way.
 *
 * The route table below declares the canonical routes AND the alias routes as
 * terminal probes. That is what makes the direction falsifiable: restore either
 * card's old href and the alias probe renders, the canonical probe does not, and
 * the recorded chain ends on `component/metadata`.
 *
 * `SystemHubPage` is the real component, mounted at the real `system` path, so
 * the hrefs measured are the ones its own render path emits — the card list is
 * not transcribed here. A transcribed copy is exactly how the alias spelling
 * survived this long.
 *
 * ## Scope
 *
 * This measures where the hub AIMS. The alias routes themselves are untouched
 * and stay reachable for bookmarks and external links (app-shell's
 * `console/__tests__/AppContent.noAppComponentRoutes.test.tsx` drives the real
 * alias end to end); nothing here asks for their removal.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation, useParams } from 'react-router-dom';

// The hub's only two data dependencies. `@object-ui/components` stays REAL so
// the cards, their click handlers and their test ids are the ones the hub
// actually renders.
vi.mock('@object-ui/app-shell', () => ({
  useAdapter: () => ({ find: async () => ({ data: [] }) }),
}));
vi.mock('@object-ui/auth', () => ({
  useIsWorkspaceAdmin: () => true,
}));

import { SystemHubPage } from '../SystemHubPage';

/**
 * Records every distinct location the router settles on. `<Navigate replace>`
 * re-renders the tree once per hop, so a two-hop chain shows up as three
 * entries and a one-hop chain as two.
 */
function ChainRecorder({ sink }: { sink: string[] }) {
  const location = useLocation();
  const here = `${location.pathname}${location.search}`;
  if (sink[sink.length - 1] !== here) sink.push(here);
  return null;
}

/** Terminal probe: reports which route matched and with which params. */
function Probe({ id }: { id: string }) {
  const params = useParams();
  return <div data-testid={id}>{JSON.stringify(params)}</div>;
}

/**
 * The destinations both spellings compete for. `metadata/*` mirrors app-shell's
 * canonical metadata-admin routes; `component/metadata/*` mirrors the legacy
 * aliases it declares alongside them. Both are terminal here — this file asks
 * *which one the hub aims at*, not what the alias does afterwards.
 */
function renderHub(): string[] {
  const chain: string[] = [];
  render(
    <MemoryRouter initialEntries={['/apps/setup/system']}>
      <ChainRecorder sink={chain} />
      <Routes>
        <Route path="/apps/:appName">
          <Route path="system" element={<SystemHubPage />} />
          <Route path="metadata" element={<Probe id="canonical-directory" />} />
          <Route path="metadata/:type" element={<Probe id="canonical-list" />} />
          <Route path="component/metadata/directory" element={<Probe id="alias-directory" />} />
          <Route path="component/metadata/resource" element={<Probe id="alias-resource" />} />
          <Route path="component/metadata/resource/*" element={<Probe id="alias-resource" />} />
        </Route>
        <Route path="*" element={<Probe id="unmatched" />} />
      </Routes>
    </MemoryRouter>,
  );
  return chain;
}

/** No alias route may appear anywhere in the chain, not merely at its end. */
function expectNoAliasAnywhere(chain: string[]) {
  expect(chain.some((entry) => entry.includes('component/metadata'))).toBe(false);
  expect(screen.queryByTestId('alias-resource')).not.toBeInTheDocument();
  expect(screen.queryByTestId('alias-directory')).not.toBeInTheDocument();
}

/**
 * Click a hub card and let the counts effect settle first. `fetchCounts` runs
 * from a `useEffect` and setStates; clicking before it resolves produces act()
 * noise unrelated to anything measured here.
 */
async function clickCard(testId: string) {
  const card = await screen.findByTestId(testId);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  await userEvent.click(card);
}

describe('System hub metadata cards → canonical metadata routes (objectui#3660)', () => {
  it('the "Metadata" card reaches the metadata directory in ONE hop', async () => {
    const chain = renderHub();

    await clickCard('hub-card-metadata');

    // The whole point: two entries, i.e. a single navigation. Before the fix
    // this ended on `component/metadata/directory`, whose route element is a
    // second `<Navigate>` onto exactly the URL asserted here.
    expect(chain).toEqual(['/apps/setup/system', '/apps/setup/metadata']);
    expect(screen.getByTestId('canonical-directory')).toBeInTheDocument();
    expectNoAliasAnywhere(chain);
  });

  it('the "Datasources" card reaches metadata/datasource in ONE hop', async () => {
    const chain = renderHub();

    await clickCard('hub-card-datasources');

    expect(chain).toEqual(['/apps/setup/system', '/apps/setup/metadata/datasource']);
    expect(screen.getByTestId('canonical-list')).toHaveTextContent('"type":"datasource"');
    expectNoAliasAnywhere(chain);
  });

  it('MEASUREMENT: both endpoints are byte-identical to what the alias hop produced', async () => {
    // Equivalence, not improvement. `LegacyMetadataRedirect`'s directory arm
    // builds `${appBase}/metadata` + search + hash, and its resource arm builds
    // `${appBase}/metadata/${encodeURIComponent(type)}` + path tail + hash.
    // Neither card carried a query or a hash beyond the `?type=` the alias
    // itself consumed, and `datasource` percent-encodes to itself, so the old
    // two-hop chain landed on precisely these two URLs. Pinned so a future
    // reader can see the equality was measured rather than assumed.
    const chain = renderHub();

    await clickCard('hub-card-datasources');

    expect(chain[chain.length - 1]).toBe('/apps/setup/metadata/datasource');
    expect(chain).toHaveLength(2);
  });

  it('CONTROL: the sibling "Applications" card is unchanged and still hub-scoped', async () => {
    // Without this the suite would also pass on a hub that had lost its cards
    // entirely, or on one where every href had been rewritten to `/metadata`.
    const chain = renderHub();

    await clickCard('hub-card-applications');

    expect(chain).toEqual(['/apps/setup/system', '/apps/setup/system/apps']);
  });
});
