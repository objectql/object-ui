/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4616 — EVERY catalog entry is rendered the way the docs gallery
 * renders it, and no tile may show the registry's "Unknown component type"
 * panel or the renderer's error boundary.
 *
 * ## What this generalizes
 *
 * `plugin-dashboard-gallery-render.test.tsx` (objectui#4600) pinned one
 * category. It closed the blind spot for that category and left the rest of the
 * corpus in it: `smoke.test.tsx` has no `render(` call at all (its assertions
 * are structural — every entry is an object with a non-empty `type`) and
 * `plugin-dashboard-global-filters-spec.test.ts` (objectui#4356) validates
 * `globalFilters` against the spec without rendering. Both are satisfied by an
 * entry that renders nothing but a red error box.
 *
 * Measured on `origin/main` @ `e028dfcd8`, rendering all 423 entries against
 * the gallery's registration set as it stood after #4600 — 33 entries painted
 * the OBJUI-001 panel:
 *
 *   components-form-calendar 6 (calendar)   plugin-chatbot 3 (chatbot)
 *   plugin-editor 3 (code-editor)           plugin-gantt 3 (object-gantt)
 *   plugin-map 3 (object-map)               plugin-markdown 3 (markdown)
 *   plugin-timeline 3 (timeline)            plugin-calendar 2 (calendar-view)
 *   plugin-kanban 2 (kanban)                components-complex-filter-ui 1
 *   components-complex-sort-ui 1            components-complex-view-switcher 1
 *   components-disclosure-toggle-group 1    core-schema-renderer 1
 *
 * That is the red this file was written against. `apps/site/app/components/
 * registerCatalogBlocks.ts` now loads the nine further packages that census
 * resolves to, which takes 31 of those 33 tiles from the panel to a drawn
 * component. What registration cannot reach is named — never skipped silently —
 * in the tables below. Four classes were defects in the entries, one issue each:
 *
 *   objectui#4624  1 entry  names root type "single", which nothing registers
 *   objectui#4625  6 entries author the bare `calendar` keyword, which belongs
 *                          to plugin-calendar's data-bound ObjectCalendar
 *   objectui#4626  2 entries were filed as blank tiles, each authoring a key
 *                          its own renderer never reads — one of the two was
 *                          measured to be neither (see below)
 *   objectui#4627  2 entries author events in a fixed past month, outside the
 *                          window `calendar-view` paints around today
 *
 * All four are FIXED in the entries — the first three as of objectui#4624's
 * PR, #4627 as of its own — so the ten entries they covered carry the full
 * assertion set here and no longer appear in either table. What #4624 measured,
 * and corrects in this header:
 *
 *  - #4625's six now author `ui:calendar`, the namespaced key the primitive is
 *    registered under. Probed through this file's own render path before the
 *    rewrite: `type: 'ui:calendar'` resolves and paints the date-picker grid
 *    (115 elements), because `Registry.get(type)` looks the string up verbatim
 *    and `register()` stores the namespaced form as `ui:calendar`. The bare
 *    keyword still reaches `ObjectCalendar` — that is not a bug to route
 *    around, it is `skipFallback: true` working as designed.
 *  - #4626's `basic-tooltip` was a real blank tile: it authored its trigger
 *    under `children`, which the tooltip renderer never reads. Now `trigger`.
 *  - #4626's `basic-hover-card` was NOT blank and authored no unread key.
 *    Measured: the text renderer reads `schema.content || schema.value`
 *    (`packages/components/src/renderers/basic/text.tsx:35,40`), so the
 *    authored `value` WAS read and the tile drew the text node "Hover over
 *    me" — which `drewSomething` accepts, and which an element-only view of
 *    the DOM (the one the filing reports) cannot see. Its real defect was
 *    that a bare text node is not an element, so `HoverCardTrigger asChild`
 *    had nothing to attach to and the card could never open; the trigger is
 *    now a link-variant button, the shape the renderer's own `defaultProps`
 *    declare. Removing its exclusion turns nothing red — verified by removing
 *    it BEFORE touching the entry.
 *
 * DATASOURCE_REQUIRED stays asserted, for the reason #4625 first supplied:
 * registering a package is not the same as a tile drawing, and a pin naming
 * only OBJUI-001 would have reported those six as fixed. It is now a
 * regression guard — an entry sliding back to the bare `calendar` keyword
 * fails on that string rather than on the panel.
 *
 * Six further entries are not rendered here at all, for reasons that are limits
 * of the environment rather than defects in anything: `plugin-editor`'s three
 * mount Monaco and `plugin-map`'s three mount maplibre, which between them want
 * a CDN loader script, WebGL2, and a live third-party tile host. The exclusion
 * table says why for each; what stays pinned for both buckets is the thing
 * objectui#4616 actually changed — that their types resolve — asserted in the
 * control case below.
 *
 * ## Why the module-scope package imports
 *
 * `ComponentRegistry` only knows a type once the package owning it has loaded,
 * so this file mirrors exactly what the gallery host registers, in the same
 * order — several packages claim the same bare keyword (`chart`, `calendar`)
 * and the last registration wins, so a reordered mirror would not be a mirror.
 * The last case in this file reads the host and fails if the two lists drift.
 *
 * ## What is asserted, per entry
 *
 * None of the three diagnostics — all three, for every entry: there are no
 * per-entry diagnostic exemptions left — and, the non-vacuity half, since an
 * entry that renders nothing at all trivially satisfies all three, the tile
 * actually produced DOM or text of its own. That control is not decoration: it
 * is what found objectui#4626's blank tooltip tile, which no red-tile sweep can
 * see. Note what it deliberately does NOT claim: text alone satisfies it, so a
 * tile drawing a bare text node passes — correctly, since `components-basic-
 * text/*` are exactly that. `basic-hover-card` is the case that proves the
 * distinction matters in both directions (see the header). For
 * the categories objectui#4616 newly registered, a stronger positive control on
 * top: the titles the entry itself authors are on screen
 * (`AUTHORED_TEXT_EXEMPT` records any that cannot be asserted that way, with
 * the reason — it is empty as of objectui#4627, and every entry in those
 * categories carries the control).
 *
 * The diagnostic strings are COPIED as literals rather than imported from the
 * packages' internals, for the reason objectui#4600 gave: they are
 * user-visible contract for this pin, and a reworded panel should turn it red
 * for review rather than silently follow along.
 *
 * `role="alert"` is deliberately NOT asserted category-wide the way #4600
 * asserts it for dashboards. Measured: `components-data-display-alert`'s two
 * entries render `role="alert"` because that is what an Alert IS — the
 * assertion is correct for a dashboard tile and wrong for the corpus.
 */
import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '@object-ui/components';
// Mirrors apps/site/app/components/registerCatalogBlocks.ts, in its order.
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-charts';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-chatbot';
import '@object-ui/plugin-editor';
import '@object-ui/plugin-gantt';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-map';
import '@object-ui/plugin-markdown';
import '@object-ui/plugin-timeline';
import '@object-ui/plugin-view';
import { SidebarProvider } from '@object-ui/components';
import { registerLayout } from '@object-ui/layout';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, SchemaRendererContext, toRenderableSchema } from '@object-ui/react';
import fs from 'node:fs';
import path from 'node:path';
import { allExamples } from '../src/index.js';

registerLayout();

/** The registry's panel for a type no loaded package registers (OBJUI-001). */
const UNKNOWN_COMPONENT = 'Unknown component type';
/** `SchemaRenderer`'s error boundary (packages/react/src/SchemaRenderer.tsx). */
const FAILED_TO_RENDER = 'failed to render';
/**
 * The data-bound plugins' guard when the host supplies no data source
 * (`ObjectCalendar.tsx`, `ObjectGantt.tsx`, `ObjectMap.tsx` all throw it).
 * Asserted alongside the other two because registering a package is not the
 * same as the tile drawing: `components-form-calendar/*` used to trade the
 * OBJUI-001 panel for exactly this string, and a pin that named only the panel
 * would have reported those six as fixed. They now author `ui:calendar` and
 * draw the primitive, so this string is what would catch them sliding back to
 * the bare keyword.
 */
const DATASOURCE_REQUIRED = 'DataSource required for object/api providers';

const ALL_DIAGNOSTICS = [UNKNOWN_COMPONENT, FAILED_TO_RENDER, DATASOURCE_REQUIRED];

/** The packages the gallery host must load, in the host's own order. */
const HOST_PACKAGES = [
  '@object-ui/plugin-dashboard',
  '@object-ui/plugin-charts',
  '@object-ui/plugin-calendar',
  '@object-ui/plugin-chatbot',
  '@object-ui/plugin-editor',
  '@object-ui/plugin-gantt',
  '@object-ui/plugin-kanban',
  '@object-ui/plugin-map',
  '@object-ui/plugin-markdown',
  '@object-ui/plugin-timeline',
  '@object-ui/plugin-view',
];

/**
 * Entries this pin does NOT hold to the no-red-tile rule, each with the reason
 * it is not a registration defect. Named here rather than skipped silently:
 * an exclusion that stops being true should be visible to the next reader, and
 * the case below fails if an id here no longer exists.
 */
const EXCLUSIONS: Record<string, string> = {
  'core-schema-renderer/unknown-component-type':
    'Demonstrates the OBJUI-001 panel on purpose — the panel IS the example.',
  // The three below are an ENVIRONMENT limit, not a defect in the entries.
  // Rendering `code-editor` mounts `@monaco-editor/react`, which appends its
  // loader as a `script` tag pointing at a CDN. happy-dom cannot fetch it and
  // dispatches a resource-load `error` event, which Vitest reports as an
  // unhandled error and exits non-zero on — while every assertion in the file
  // passes (measured: 2534/2534 tests green, 4 unhandled errors, exit 1).
  // `packages/plugin-editor/src/index.test.ts` reached the same place first and
  // settled it the same way: that suite asserts registration and metadata and
  // never renders, with a header explaining Monaco's cost. So what is pinned
  // for this bucket is `ComponentRegistry.get('code-editor')` in the control
  // case above — which IS what objectui#4616 changed for it.
  'plugin-editor/javascript-editor': "Monaco's CDN loader cannot run under happy-dom.",
  'plugin-editor/python-editor': "Monaco's CDN loader cannot run under happy-dom.",
  'plugin-editor/read-only-json-viewer': "Monaco's CDN loader cannot run under happy-dom.",
  // The three below are the same class as Monaco, one layer worse. Rendering
  // `object-map` mounts maplibre, which (a) refuses to initialise without WebGL2
  // — "WebGL2 is required to display this map", GPUInitializationError, verbatim
  // from the run — and then trips `SchemaRenderer`'s error boundary tearing its
  // own painter down, and (b) fetches its style sheet from
  // `https://demotiles.maplibre.org` over the real network. (b) is the reason
  // this is an exclusion rather than a narrowed assertion: a unit test that
  // reaches a third-party host is nondeterministic and makes CI depend on that
  // host being up, whatever it asserts. All five of `packages/plugin-map`'s own
  // test files reach the same conclusion and `vi.mock('react-map-gl/maplibre')`;
  // this pin renders the gallery's real stack, so it cannot mock and must
  // abstain instead. `ComponentRegistry.get('object-map')` in the control case
  // is what stays pinned — and that IS what objectui#4616 changed here.
  'plugin-map/event-venue-finder': 'maplibre needs WebGL2 and a live tile host.',
  'plugin-map/real-time-delivery-tracking': 'maplibre needs WebGL2 and a live tile host.',
  'plugin-map/store-locator-map': 'maplibre needs WebGL2 and a live tile host.',
};

/**
 * Categories objectui#4616 newly registered a package for. These get the
 * stronger positive control — the entry's own authored strings on screen —
 * because they are the ones whose tiles were red before this change, and
 * "no longer red" must not be satisfiable by a tile that draws nothing.
 */
const NEWLY_REGISTERED_CATEGORIES = [
  'components-complex-filter-ui',
  'components-complex-sort-ui',
  'components-complex-view-switcher',
  'plugin-calendar',
  'plugin-chatbot',
  'plugin-editor',
  'plugin-gantt',
  'plugin-kanban',
  'plugin-map',
  'plugin-markdown',
  'plugin-timeline',
];

/**
 * Entries in those categories whose authored titles provably cannot reach the
 * DOM. Each would still carry the full no-red-tile assertion and the
 * DOM-was-produced control above; only the authored-title control is lifted,
 * with the measured reason.
 *
 * EMPTY, and that is the assertion: every entry in the newly-registered
 * categories now puts its own authored titles on screen. The table held
 * `plugin-calendar`'s two until objectui#4627 — `calendar-view` paints the
 * window around `currentDate`, which defaults to TODAY, and both entries
 * authored events in a fixed past month, so no event title could ever be in
 * range (measured on a 2026-08-14 run: the tiles drew "August 2026" and
 * "Aug 9 - Aug 15, 2026" around an empty grid). That was a staleness question
 * about the entries' data, not a render defect: both already drew a real
 * calendar, 163 and 421 elements. Both entries now author `currentDate` — the
 * registry input `calendar-view` declares, parsed from its documented ISO
 * string at the renderer boundary since objectui#4452 — pinning each view onto
 * its own events, so the exemption is gone rather than reworded.
 *
 * (`plugin-editor`'s and `plugin-map`'s six are absent from this table because
 * they are not rendered here at all — see `EXCLUSIONS`.)
 */
const AUTHORED_TEXT_EXEMPT: Record<string, string> = {};

/**
 * The gallery's data source, in the shape `SchemaThumbnail` supplies it. Kept
 * as a local literal rather than imported from `apps/site` because `apps/**` is
 * outside every root Vitest project (`vitest.config.mts` `sharedExclude`); the
 * host-parity cases at the end guard the two from drifting apart.
 *
 * objectui#5113 added the object surface (`getObjectSchema` / `find` / the
 * writes) to the host fixture, because `object-view` reaches its data through
 * exactly this context value — `dataSource` is not a schema key. The three
 * `plugin-view` entries render through it, which is what
 * `THE PLUGIN-VIEW ENTRIES` below asserts. What the mirror reproduces is the
 * host's SURFACE and its rows; the query semantics ($search / $orderby /
 * windowing) are the host's, and the parity case pins the method names rather
 * than re-deriving them here.
 */
const USERS_ROWS = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', department: 'Engineering', status: 'active', created_at: '2024-01-14' },
  { id: '2', name: 'Bob Chen', email: 'bob@example.com', role: 'member', department: 'Design', status: 'active', created_at: '2024-02-03' },
  { id: '3', name: 'Carla Gómez', email: 'carla@example.com', role: 'member', department: 'Sales', status: 'invited', created_at: '2024-03-21' },
  { id: '4', name: 'Dan Whitfield', email: 'dan@example.com', role: 'viewer', department: 'Support', status: 'suspended', created_at: '2024-04-09' },
  { id: '5', name: 'Emily Novak', email: 'emily@example.com', role: 'member', department: 'Engineering', status: 'active', created_at: '2024-05-30' },
];

const USERS_SCHEMA = {
  name: 'users',
  label: 'Users',
  fields: {
    name: { label: 'Name', type: 'text' },
    email: { label: 'Email', type: 'email' },
    role: { label: 'Role', type: 'select' },
    department: { label: 'Department', type: 'text' },
    status: { label: 'Status', type: 'select' },
    created_at: { label: 'Created', type: 'date' },
  },
};

const galleryDataSource = {
  queryDataset: async (
    _dataset: string,
    query: { dimensions?: string[]; measures?: string[] },
  ) => {
    const dimensions = query?.dimensions ?? [];
    const measures = query?.measures ?? [];
    const measure = measures[0] ?? 'value';
    const rows = dimensions.length
      ? [
          { [dimensions[0]]: 'Alpha', [measure]: 42 },
          { [dimensions[0]]: 'Beta', [measure]: 27 },
        ]
      : [{ [measure]: 69 }];
    return { rows, fields: [] };
  },
  getObjectSchema: async (objectName: string) =>
    objectName === 'users' ? USERS_SCHEMA : { name: objectName, label: objectName, fields: {} },
  find: async (objectName: string) =>
    objectName === 'users'
      ? { data: [...USERS_ROWS], total: USERS_ROWS.length }
      : { data: [], total: 0 },
  findOne: async (objectName: string, id: string | number) =>
    (objectName === 'users' ? USERS_ROWS : []).find((row) => String(row.id) === String(id)) ?? null,
  create: async (_objectName: string, data: Record<string, unknown>) => ({ ...data, id: 'demo' }),
  update: async (_objectName: string, id: string | number, data: Record<string, unknown>) => ({ ...data, id }),
  delete: async () => true,
};

/** The method names the host fixture must expose for the mirror to be one. */
const GALLERY_DATA_SOURCE_METHODS = [
  'queryDataset',
  'getObjectSchema',
  'find',
  'findOne',
  'create',
  'update',
  'delete',
];

/** The two wrapper elements this harness adds around the entry's own root. */
const WRAPPER_ELEMENTS = 2;

interface Rendered {
  text: string;
  elements: number;
  unmount: () => void;
}

/**
 * Did the tile draw anything of its own? Elements OR text, because both are
 * real: `components-basic-text/*` render a bare text node with no element
 * around it (measured — "Heading 1" is a direct child of the wrapper), so an
 * element-count-only control reads nine correct tiles as empty.
 */
const drewSomething = (elements: number, text: string) =>
  elements > WRAPPER_ELEMENTS || text.trim().length > 0;

/** Render one entry exactly as `SchemaThumbnail` does, then let it settle. */
async function renderEntry(schema: unknown): Promise<Rendered> {
  const { container, unmount } = render(
    <SchemaRendererContext.Provider value={{ dataSource: galleryDataSource } as never}>
      <SidebarProvider className="min-h-0 w-full" defaultOpen={false}>
        <div className="w-full p-4">
          <SchemaRenderer
            schema={toRenderableSchema(schema as never) as never}
            dataSource={galleryDataSource as never}
          />
        </div>
      </SidebarProvider>
    </SchemaRendererContext.Provider>,
  );
  // Two settles, for two different asynchronous shapes:
  //  - a dataset widget starts in `loading` and resolves on a promise;
  //  - `code-editor`, `kanban` and `markdown` are `React.lazy` behind
  //    `Suspense`, so their first paint is the fallback and their real DOM
  //    arrives one dynamic import later.
  // Asserting before either settles would pass while the diagnostic is still a
  // tick away — the vacuous green this pin exists to prevent.
  await waitFor(() =>
    expect(container.querySelector('[data-testid="dataset-loading"]')).toBeNull(),
  );
  await waitFor(() =>
    expect(
      drewSomething(container.querySelectorAll('*').length, container.textContent ?? ''),
    ).toBe(true),
  );
  return {
    text: container.textContent ?? '',
    elements: container.querySelectorAll('*').length,
    unmount,
  };
}

/**
 * `object-map` tears maplibre down through a GL context that happy-dom never
 * gave it, so unmount throws `Cannot read properties of undefined (reading
 * 'destroy')` for those three entries. Swallowed HERE, at teardown only, so it
 * cannot mask anything the assertions above already read off the settled DOM —
 * and done explicitly so RTL's auto-cleanup does not hit it later, out of band,
 * where it would surface as an unattributable error on some other file.
 */
function teardown(r: Rendered) {
  try {
    r.unmount();
  } catch {
    /* environment-only; see the comment above */
  }
}

/**
 * Authored TITLES at any depth — the same key objectui#4600 used for dashboard
 * widgets, generalized. Deliberately only `title`:
 *  - `label` also names the options inside a filter/sort config, which are not
 *    on screen until a row is added (measured: `components-complex-filter-ui/
 *    filter-ui` renders "Filters" and authors Name/Status/Open/Closed);
 *  - `content` on a markdown block is markdown SOURCE, whose rendered form is
 *    deliberately not the source text.
 * Both would make this control fail on tiles that are drawing correctly.
 */
function authoredTitles(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const n of node) authoredTitles(n, acc);
    return acc;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (
        k === 'title' &&
        typeof v === 'string' &&
        v.trim().length > 1 &&
        // Template expressions resolve against data this corpus does not ship.
        !v.includes('{{') &&
        !v.includes('${')
      ) {
        acc.push(v.trim());
      }
      authoredTitles(v, acc);
    }
  }
  return acc;
}

const entries = allExamples();
const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('objectui#4616 — every catalog entry renders in the docs gallery', () => {
  /**
   * NON-VACUITY CONTROL for the sweep as a whole. `it.each([])` reports nothing
   * rather than failing, and every root type resolving to the red panel would
   * still leave each per-entry case asserting over a string — so pin the corpus
   * size and the registration set the sweep depends on.
   */
  it('the corpus is populated and every package the census needs is loaded', () => {
    expect(entries.length).toBeGreaterThanOrEqual(423);
    // One type per package below, chosen as the one the census actually needed.
    for (const type of [
      'dashboard',
      'chart',
      'calendar-view',
      'chatbot',
      'code-editor',
      'object-gantt',
      'kanban',
      'object-map',
      'markdown',
      'timeline',
      'filter-ui',
      'sort-ui',
      'view-switcher',
    ]) {
      expect(ComponentRegistry.get(type), `${type} is not registered`).toBeTruthy();
    }
  });

  it('every exclusion still names a real entry', () => {
    const ids = new Set(entries.map((e) => e.id));
    for (const id of [...Object.keys(EXCLUSIONS), ...Object.keys(AUTHORED_TEXT_EXEMPT)]) {
      expect(ids.has(id), `${id} is excluded but no longer exists in the catalog`).toBe(true);
    }
  });

  it.each(entries.filter((e) => !EXCLUSIONS[e.id]).map((e) => [e.id, e.schema] as const))(
    '%s renders without a red tile',
    async (id, schema) => {
      const r = await renderEntry(schema);
      try {
        for (const diagnostic of ALL_DIAGNOSTICS) {
          expect(r.text, `${id} shows "${diagnostic}"`).not.toContain(diagnostic);
        }
        // Positive control: the tile drew something of its own.
        expect(drewSomething(r.elements, r.text)).toBe(true);
      } finally {
        teardown(r);
      }
    },
  );

  it.each(
    entries
      .filter(
        (e) =>
          NEWLY_REGISTERED_CATEGORIES.includes(e.meta.category) &&
          !EXCLUSIONS[e.id] &&
          !AUTHORED_TEXT_EXEMPT[e.id],
      )
      .map((e) => [e.id, e.schema] as const),
  )('%s puts its authored content on screen', async (_id, schema) => {
    const r = await renderEntry(schema);
    try {
      const titles = [...new Set(authoredTitles(schema))];
      if (titles.length > 0) {
        // Same control objectui#4600 applies to dashboard widget titles.
        expect(titles.filter((t) => !r.text.includes(t))).toEqual([]);
      } else {
        // Entries in these categories that author no `title` at all —
        // `filter-ui`, `sort-ui`, `view-switcher`, `markdown` — still have to
        // paint text of their own rather than an empty frame.
        expect(r.text.trim().length).toBeGreaterThan(0);
      }
    } finally {
      teardown(r);
    }
  });

  /**
   * The same facts as COUNTS, so a regression reports "3 entries across
   * plugin-gantt and plugin-timeline" rather than one failing entry at a time —
   * and so the numbers in this file's header stay measured numbers.
   */
  it('the whole corpus produces zero unknown-type panels and zero error tiles', async () => {
    const counts: Record<string, number> = {
      [UNKNOWN_COMPONENT]: 0,
      [FAILED_TO_RENDER]: 0,
      [DATASOURCE_REQUIRED]: 0,
    };
    const broken: string[] = [];
    for (const entry of entries) {
      if (EXCLUSIONS[entry.id]) continue;
      const r = await renderEntry(entry.schema);
      const hits: string[] = [];
      for (const diagnostic of ALL_DIAGNOSTICS) {
        const n = occurrences(r.text, diagnostic);
        counts[diagnostic] += n;
        if (n) hits.push(`${diagnostic} x${n}`);
      }
      teardown(r);
      if (hits.length) broken.push(`${entry.meta.category} :: ${entry.id}: ${hits.join(', ')}`);
    }
    expect({ ...counts, broken }).toEqual({
      [UNKNOWN_COMPONENT]: 0,
      [FAILED_TO_RENDER]: 0,
      [DATASOURCE_REQUIRED]: 0,
      broken: [],
    });
  }, 120000);

  /**
   * HOST PARITY (source-text guard, deliberately not behavioural).
   *
   * Everything above mirrors the gallery: the same registration set, in the
   * same order, with the same dataset-capable `dataSource`. It cannot mirror it
   * by construction — `apps/**` is outside every root Vitest project — so
   * deleting a package from the host would leave this file green while
   * `/docs/guide/schema-catalog` went back to painting red panels. This case
   * reads the host and pins what the sweep assumes about it.
   */
  describe('the docs-site gallery host registers the same set', () => {
    // `process.cwd()` is the repo root by construction: `scripts/vitest-
    // invocation-guard.mjs` refuses any run whose Vitest root is not it.
    const siteDir = path.join(process.cwd(), 'apps/site/app/components');
    const read = (f: string) => fs.readFileSync(path.join(siteDir, f), 'utf8');

    it('loads every package this pin loads, in this pin’s order', () => {
      const source = read('registerCatalogBlocks.ts');
      const imported = [...source.matchAll(/^import\s+'(@object-ui\/[^']+)';$/gm)].map(
        (m) => m[1],
      );
      expect(imported).toEqual(HOST_PACKAGES);
    });

    it('is imported by the gallery thumbnail host', () => {
      expect(read('SchemaThumbnail.tsx')).toMatch(
        /^import\s+'\.\/registerCatalogBlocks';$/m,
      );
    });

    /**
     * The objectui#4600 separation, restated because objectui#4616 is exactly
     * the change that would tempt someone to collapse it: the per-page demo
     * hosts opt into their plugins through `PluginLoader`, and importing this
     * module from them would make every docs page carrying a demo load all
     * eleven graphs eagerly.
     */
    it.each(['InteractiveDemo.tsx', 'LiveSplitDemo.tsx'])(
      '%s still does NOT import it (PluginLoader stays lazy there)',
      (host) => {
        expect(read(host)).not.toContain('registerCatalogBlocks');
      },
    );
  });
});

/**
 * THE PLUGIN-VIEW ENTRIES ACTUALLY USE THE PLUGIN (objectui#5113).
 *
 * The sweep above answers "does every tile draw". It cannot answer the
 * question objectui#5113 was filed on: whether an example mounted under a
 * PLUGIN's docs page exercises that plugin. The three `plugin-view` entries
 * used to be hand-built static card layouts — `card` / `flex` / `text` /
 * `badge`, no `object-view` node anywhere — sitting on
 * `content/docs/plugins/plugin-view.mdx` under an "Interactive Examples"
 * heading and inside a `PluginLoader plugins={['view']}` wrapper none of them
 * used. Every check in the repo was green on them: the types they named ARE
 * registered, and the tiles DID draw.
 *
 * Two facts are pinned here, and the second is the one that cannot be
 * satisfied by a picture of a view:
 *
 *  1. STRUCTURE — every entry in the category authors an `object-view` node.
 *  2. RENDER — the tile shows a record that exists only in the gallery's data
 *     source, so the rows on screen came through `ObjectViewRenderer` →
 *     `ObjectGrid` → `dataSource.find`, not out of the entry's own JSON. An
 *     entry that went back to drawing its own table would keep (1) satisfiable
 *     by a stray node and would fail (2) outright.
 *
 * Deliberately scoped to `plugin-view` rather than generalized to every
 * `plugin-*` category: the general rule needs a per-plugin map of which types
 * each package registers, and other categories (`plugin-grid`'s two entries,
 * for one) are hand-built mock-ups of exactly this kind today. That is a
 * separate card, not a silent exemption list here.
 */
describe('objectui#5113 — the plugin-view entries render THROUGH object-view', () => {
  const pluginViewEntries = entries.filter((e) => e.meta.category === 'plugin-view');

  /** Every `type` string anywhere in a schema tree. */
  function nodeTypes(node: unknown, acc: Set<string> = new Set()): Set<string> {
    if (Array.isArray(node)) {
      for (const n of node) nodeTypes(n, acc);
      return acc;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === 'type' && typeof v === 'string') acc.add(v);
        nodeTypes(v, acc);
      }
    }
    return acc;
  }

  it('the category is populated (guard is not vacuous)', () => {
    expect(pluginViewEntries.length).toBeGreaterThanOrEqual(3);
  });

  it.each(pluginViewEntries.map((e) => [e.id, e.schema] as const))(
    '%s authors an object-view node',
    (_id, schema) => {
      expect([...nodeTypes(schema)]).toContain('object-view');
    },
  );

  it.each(pluginViewEntries.map((e) => [e.id, e.schema] as const))(
    '%s puts data from the gallery data source on screen',
    async (_id, schema) => {
      const r = await renderEntry(schema);
      try {
        // Not authored anywhere in the catalog — it exists only in the fixture.
        expect(r.text).toContain('Alice Johnson');
      } finally {
        teardown(r);
      }
    },
  );

  /**
   * HOST PARITY for the fixture, same technique and same reason as the
   * registration-set parity above: the mirror at the top of this file is what
   * the assertions run against, so a host fixture that lost `find` would leave
   * this file green while the docs page went back to an empty view.
   */
  describe('the docs-site hosts supply the same fixture', () => {
    const siteDir = path.join(process.cwd(), 'apps/site/app/components');
    const read = (f: string) => fs.readFileSync(path.join(siteDir, f), 'utf8');

    it('the host fixture exposes every method this mirror implements', () => {
      const source = read('galleryDataSource.ts');
      const missing = GALLERY_DATA_SOURCE_METHODS.filter(
        (method) => !new RegExp(`\\basync ${method}\\s*\\(`).test(source),
      );
      expect(missing).toEqual([]);
    });

    it.each(['SchemaThumbnail.tsx', 'InteractiveDemo.tsx'])(
      '%s hands it to the renderer',
      (host) => {
        expect(read(host)).toMatch(/^import \{ galleryDataSource \} from '\.\/galleryDataSource';$/m);
        expect(read(host)).toContain('dataSource: galleryDataSource');
      },
    );
  });
});
