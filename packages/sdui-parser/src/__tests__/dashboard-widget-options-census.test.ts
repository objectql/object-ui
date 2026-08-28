/// <reference types="node" />
/**
 * ObjectUI — the renderer-consumed-keys census, re-measured every run
 * (objectui#5709)
 *
 * `CONSUMED_WIDGET_OPTION_KEYS` is a hand-pinned list, and a hand-pinned list
 * about SOMEONE ELSE'S code is wrong the day that code moves. The 2026-08-23
 * ruling made the census the load-bearing half of the warning ("a false
 * positive on a key that IS consumed is worse than no warning"), so this file
 * re-derives every input the list was pinned from, on every test run:
 *
 *  1. the DECLARED set, from the installed `@objectstack/spec` schema — the
 *     same source the platform's save gate parses with;
 *  2. the CONSUMED set, extracted from `DatasetWidget.tsx` source text — the
 *     one component every spec-legal (dataset-bound) widget renders through;
 *  3. the sub-caption convention read site in `DashboardRenderer.tsx`, the
 *     evidence for the single accepted key the spec does not declare;
 *  4. a repo tripwire for NEW files that start reading `widget.options`.
 *
 * ## What the instrument can and cannot see — read before trusting a verdict
 *
 * The extractor is a TEXT census: it matches `options.<identifier>` in one
 * file whose `options` binding it first proves to be the widget-options bag,
 * and it counts comments as reads. Both biases point the SAFE way (a key
 * wrongly counted consumed draws no warning — a false negative, never a false
 * positive). What it CANNOT follow is a consumption shape with no `options.`
 * spelling: a spread (`{ ...options }`), a destructuring (`const { x } =
 * options`), a computed access (`options[k]`), or the bag passed wholesale to
 * a helper. Those shapes exist in this repo — on the LEGACY (non-dataset)
 * dispatch branches the warning deliberately skips — so the census stays
 * honest by REFUSING them where it measures: their appearance in
 * `DatasetWidget.tsx` fails this file loudly instead of silently
 * under-counting. The tripwire has its own stated blind spot: it matches the
 * receiver spelling `widget.options` / `widget?.options`, so a read through a
 * renamed receiver is invisible to it (`legacyRetiredWidget.ts`'s
 * `w.options?.data` is the known live example — on a branch the warning
 * skips). It exists to catch new FILES joining the surface under the common
 * spelling, not to be a proof.
 *
 * Maintenance cost, measured while building it: when a renderer gains or
 * loses a consumed key, this file goes red and the fix is editing ONE array
 * (`CONSUMED_WIDGET_OPTION_KEYS`) plus its census notes; when the spec
 * declares a new key, same; when a new file starts reading the bag, the
 * tripwire's allowlist is the edit. The scan itself is ~70ms over ~1.5k
 * files.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DashboardWidgetOptionsSchema, DashboardWidgetSchema } from '@objectstack/spec/ui';
import {
  CONSUMED_WIDGET_OPTION_KEYS,
  UNCONSUMED_WIDGET_OPTION,
} from '../dashboard-widget-options.js';

/** Repo root, located by marker file — never by counting `..` segments. */
const repoRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const parent = dirname(dir);
    if (parent === dir) throw new Error('pnpm-workspace.yaml not found above test file');
    dir = parent;
  }
  return dir;
})();

const DATASET_WIDGET = join(repoRoot, 'packages/plugin-dashboard/src/DatasetWidget.tsx');
const DASHBOARD_RENDERER = join(repoRoot, 'packages/plugin-dashboard/src/DashboardRenderer.tsx');

const declaredKeys = Object.keys(DashboardWidgetOptionsSchema.shape).sort();

describe('leg 1 — the spec side of the pin', () => {
  it('the options schema still rides passthrough — the premise of the warning', () => {
    // If the spec ever tightens this to strict/strip, undeclared keys stop
    // parsing and this warning's subject disappears — re-visit the module.
    const parsed = DashboardWidgetOptionsSchema.safeParse({ __census_probe: 1 });
    expect(parsed.success).toBe(true);
    expect((parsed as { data: Record<string, unknown> }).data.__census_probe).toBe(1);
  });

  it('declared keys are exactly the pinned spec set', () => {
    // Derivation guard for everything below: a schema that stopped exporting
    // `shape` (or renamed keys) must fail HERE, not let ⊆-checks pass on [].
    expect(declaredKeys).toEqual(['dateGranularity', 'limit', 'sortBy', 'sortOrder', 'stageOrder']);
  });

  it('every declared key is accepted, and the only undeclared accepted key is `description`', () => {
    for (const key of declaredKeys) expect(CONSUMED_WIDGET_OPTION_KEYS).toContain(key);
    const extras = CONSUMED_WIDGET_OPTION_KEYS.filter((k) => !declaredKeys.includes(k));
    // `description` is the sub-caption convention key (leg 3). Any OTHER
    // undeclared entry needs its own documented read-site evidence first.
    expect(extras).toEqual(['description']);
  });

  it('`dataset` is required — the fact the census scopes itself by', () => {
    // The warning only fires on dataset-bound widgets BECAUSE that is the only
    // spec-legal form. If the spec relaxes this, the legacy dispatch branches
    // become legal authoring surface and the census must grow to cover them.
    expect(DashboardWidgetSchema.shape.dataset.isOptional()).toBe(false);
  });

  it('the suppressWarnings escape hatch is spec-legal with this code in it', () => {
    const parsed = DashboardWidgetSchema.safeParse({
      id: 'sla_gauge',
      dataset: 'case_metrics',
      values: ['avg_sla_violated'],
      type: 'gauge',
      suppressWarnings: [UNCONSUMED_WIDGET_OPTION],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('leg 2 — the renderer side: DatasetWidget source census', () => {
  const src = readFileSync(DATASET_WIDGET, 'utf8');

  it('the options bag is still where the census measured it', () => {
    // The binding the extractor's `options.` matches belong to. Renamed or
    // moved ⇒ the extraction below would be measuring a different variable.
    expect(src).toMatch(/widget\?\.options && typeof widget\.options === 'object'/);
  });

  it('contains no consumption shape the extractor cannot see', () => {
    // Each of these would make the text census silently under-count, which is
    // the false-POSITIVE direction (a consumed key missing from the accepted
    // set draws a warning on working metadata). Loud failure instead: whoever
    // introduces the shape extends the census in the same change.
    expect(src, 'spread of the options bag').not.toMatch(/\.\.\.options\b/);
    expect(src, 'destructuring from the options bag').not.toMatch(/\}\s*=\s*options\b/);
    expect(src, 'computed access into the options bag').not.toMatch(/\boptions\[/);
  });

  it('the extracted read set equals the declared set — both directions', () => {
    const extracted = new Set<string>();
    for (const m of src.matchAll(/\boptions\.([A-Za-z_$][\w$]*)/g)) extracted.add(m[1]!);
    // Instrument control: a zero here is a broken instrument, not a reading —
    // `limit` is known-present at a `options.limit` read site.
    expect(extracted.size).toBeGreaterThan(0);
    expect([...extracted]).toContain('limit');
    expect([...extracted].sort()).toEqual(declaredKeys);
  });
});

describe('leg 3 — the sub-caption convention read site', () => {
  it('DashboardRenderer still reads options.description for the subCaption channel', () => {
    // The evidence for the one accepted key the spec does not declare
    // (objectui#4032 item 4; objectstack#8056 `subCaption`; the server's
    // `translateDashboard` writes this key). If this read disappears,
    // `description` needs re-triage, not silent retention.
    const src = readFileSync(DASHBOARD_RENDERER, 'utf8');
    expect(src).toMatch(/\(widget\.options as [^)]*\)\?\.description/);
  });
});

describe('leg 4 — repo tripwire: files reading widget.options', () => {
  it('no NEW file reads the widget options bag under the common spelling', () => {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name === '__tests__'
        ) {
          continue;
        }
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.|\.d\.ts$/.test(entry.name)) {
          if (/widget\??\.options/.test(readFileSync(p, 'utf8'))) {
            hits.push(relative(repoRoot, p).replace(/\\/g, '/'));
          }
        }
      }
    };
    for (const root of ['packages', 'apps']) walk(join(repoRoot, root));
    // The measured surface on origin/main@8689166f6, plus the census module
    // itself (whose header describes the bag in prose — it never renders one).
    // A new entry means a new consumer of the bag: re-run the census (module
    // header) before extending either this list or the accepted-key set.
    // `useObjectLabel.ts` matches in prose only — it documents the subCaption
    // convention leg 3 pins.
    expect(hits.sort()).toEqual([
      'packages/i18n/src/useObjectLabel.ts',
      'packages/plugin-dashboard/src/DashboardGridLayout.tsx',
      'packages/plugin-dashboard/src/DashboardRenderer.tsx',
      'packages/plugin-dashboard/src/DatasetWidget.tsx',
      'packages/sdui-parser/src/dashboard-widget-options.ts',
    ]);
  });
});
