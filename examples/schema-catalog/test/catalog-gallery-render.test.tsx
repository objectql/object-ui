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
 * in the four tables below, one issue per class:
 *
 *   objectui#4624  1 entry  names root type "single", which nothing registers
 *   objectui#4625  6 entries author the bare `calendar` keyword, which belongs
 *                          to plugin-calendar's data-bound ObjectCalendar
 *   objectui#4626  2 entries render a blank tile — each authors a key its own
 *                          renderer never reads (found by the control below)
 *   objectui#4627  2 entries author 2024 event dates, outside the window
 *                          `calendar-view` paints
 *
 * The last of those is the reason this file asserts three diagnostic strings
 * rather than one: registering a package is not the same as a tile drawing, and
 * a pin that named only OBJUI-001 would have reported #4625's six as fixed.
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
 * None of the three diagnostics, and — the non-vacuity half, since an entry
 * that renders nothing at all trivially satisfies all three — the tile actually
 * produced DOM or text of its own. That control is not decoration: it is what
 * found objectui#4626's two blank tiles, which no red-tile sweep can see. For
 * the categories objectui#4616 newly registered, a stronger positive control on
 * top: the titles the entry itself authors are on screen
 * (`AUTHORED_TEXT_EXEMPT` records the five that cannot be asserted that way,
 * with the reason for each).
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
 * same as the tile drawing: `components-form-calendar/*` trades the OBJUI-001
 * panel for exactly this string, and a pin that named only the panel would
 * report those six as fixed.
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
  'components-disclosure-toggle-group/with-labels':
    'Authoring defect, not registration: the entry names root type "single", which no ' +
    'package registers. Its two siblings spell the same thing "toggle-group" + ' +
    '"selectionType": "single". Filed as objectui#4624.',
  'components-overlay-tooltip/basic-tooltip':
    'Blank tile, not a red one, and not registration: the entry authors its trigger under ' +
    '"children", which the tooltip renderer never reads (it reads "trigger" / "body"), so ' +
    'the tile renders nothing at all. Filed as objectui#4626.',
  'components-overlay-hover-card/basic-hover-card':
    'Blank tile, not a red one, and not registration: both slots author {"type":"text", ' +
    '"value":…} and the text renderer reads "content", so both render empty. ' +
    'Filed as objectui#4626.',
};

/**
 * Entries allowed ONE named diagnostic, because that diagnostic is a defect
 * this card measured and filed rather than caused. Every other assertion still
 * applies to them — including the other two diagnostics — so the exemption is
 * one string wide, not one entry wide.
 *
 * All six `components-form-calendar` entries author the bare `calendar`
 * keyword, which `@object-ui/components` deliberately registers as
 * `ui:calendar` only ("collides with the plugin-calendar full CRUD calendar
 * VIEW", `skipFallback: true`). So the bare keyword reaches `ObjectCalendar`,
 * which has no data source here and says so. Registering the package is what
 * exposed it; correcting six entries' authored type is a separate decision,
 * filed as objectui#4625.
 */
const KNOWN_DIAGNOSTIC: Record<string, string> = {
  'components-form-calendar/custom-style': DATASOURCE_REQUIRED,
  'components-form-calendar/date-range': DATASOURCE_REQUIRED,
  'components-form-calendar/form-integration': DATASOURCE_REQUIRED,
  'components-form-calendar/multiple-dates': DATASOURCE_REQUIRED,
  'components-form-calendar/simple-calendar': DATASOURCE_REQUIRED,
  'components-form-calendar/single-date': DATASOURCE_REQUIRED,
};

/**
 * Entries held to the OBJUI-001 half only. `object-map` mounts maplibre, which
 * refuses to initialise without WebGL2 ("WebGL2 is required to display this
 * map" — GPUInitializationError, verbatim from the run) and then trips
 * `SchemaRenderer`'s error boundary while tearing its own painter down. That is
 * a property of happy-dom, not of the gallery, and it is not something this
 * file can assert its way around — so what IS pinned for these is the thing
 * objectui#4616 fixed: the type resolves, so no "Unknown component type" panel.
 */
const UNKNOWN_PANEL_ONLY: Record<string, string> = {
  'plugin-map/event-venue-finder': 'maplibre needs WebGL2, which happy-dom has not',
  'plugin-map/real-time-delivery-tracking': 'maplibre needs WebGL2, which happy-dom has not',
  'plugin-map/store-locator-map': 'maplibre needs WebGL2, which happy-dom has not',
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
 * Entries in those categories whose authored strings provably cannot reach the
 * DOM in this environment. Each still carries the full no-red-tile assertion
 * and the DOM-was-produced control above; only the authored-text control is
 * lifted, with the measured reason.
 */
const AUTHORED_TEXT_EXEMPT: Record<string, string> = {
  'plugin-editor/javascript-editor': 'Monaco',
  'plugin-editor/python-editor': 'Monaco',
  'plugin-editor/read-only-json-viewer': 'Monaco',
  'plugin-calendar/month-view-calendar': 'date window',
  'plugin-calendar/week-view-calendar': 'date window',
};
/**
 * Why each class above is exempt:
 *  - Monaco: `code-editor` lazy-loads `@monaco-editor/react`, which needs a
 *    real layout engine; under happy-dom it stops at its own "Loading…" state.
 *    The tile is a tile — it just never paints the authored source text.
 *  - date window: `calendar-view` paints the grid for the CURRENT month/week,
 *    and both entries author events with fixed 2024 dates, so no event title
 *    is in range. That is a staleness question about the entries' data, not a
 *    render defect — filed as objectui#4627.
 *
 * (`plugin-map`'s three are absent because `UNKNOWN_PANEL_ONLY` already lifts
 * every assertion but one for them.)
 */

/**
 * The gallery's data source, in the shape `SchemaThumbnail` supplies it. Kept
 * as a local literal rather than imported from `apps/site` because `apps/**` is
 * outside every root Vitest project (`vitest.config.mts` `sharedExclude`); the
 * host-parity case at the end guards the two from drifting apart.
 */
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
};

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

/** Which diagnostics this entry must not show. */
const diagnosticsFor = (id: string) =>
  UNKNOWN_PANEL_ONLY[id]
    ? [UNKNOWN_COMPONENT]
    : ALL_DIAGNOSTICS.filter((d) => d !== KNOWN_DIAGNOSTIC[id]);

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
    for (const id of [
      ...Object.keys(EXCLUSIONS),
      ...Object.keys(UNKNOWN_PANEL_ONLY),
      ...Object.keys(KNOWN_DIAGNOSTIC),
      ...Object.keys(AUTHORED_TEXT_EXEMPT),
    ]) {
      expect(ids.has(id), `${id} is excluded but no longer exists in the catalog`).toBe(true);
    }
  });

  it.each(entries.filter((e) => !EXCLUSIONS[e.id]).map((e) => [e.id, e.schema] as const))(
    '%s renders without a red tile',
    async (id, schema) => {
      const r = await renderEntry(schema);
      try {
        for (const diagnostic of diagnosticsFor(id)) {
          expect(r.text, `${id} shows "${diagnostic}"`).not.toContain(diagnostic);
        }
        if (UNKNOWN_PANEL_ONLY[id]) return;
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
          !UNKNOWN_PANEL_ONLY[e.id] &&
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
      for (const diagnostic of diagnosticsFor(entry.id)) {
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
