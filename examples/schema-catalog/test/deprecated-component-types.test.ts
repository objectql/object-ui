/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3965 — the catalog-scoped ratchet on DEPRECATED component types.
 *
 * Every catalog entry is an exemplar: the corpus is what a human copies from,
 * and what few-shot retrieval over these examples hands a generating model. A
 * fixture authoring a type the engine itself deprecates therefore teaches the
 * deprecated spelling, and does so at corpus scale. This file makes that
 * measurable, because nothing else in the repo does.
 *
 * ## Nothing stopped the 49th before this file
 *
 * Both gates that touch component types ask only whether the type RESOLVES,
 * never whether it is deprecated:
 *
 *   - `catalog-gallery-render.test.tsx` (objectui#4616) asserts
 *     `ComponentRegistry.get(type)` is truthy and that no OBJUI-001 panel
 *     paints. `div` is registered and renders, so the suite is green with all
 *     85 deprecated nodes present — measured, not assumed.
 *   - `scripts/check-doc-component-types.mjs` asks the same existence question
 *     and walks `content/docs` and nothing else (`DOCS_ROOT = 'content/docs'`),
 *     so `examples/**` is outside its scan surface entirely.
 *
 * It was worse than the usual declared-but-unenforced shape: when this file
 * landed, the deprecation was not declared anywhere MACHINE-READABLE.
 * `RegistryComponentMetaExtras` carried `tier` / `namespace` / `skipFallback` /
 * `labelling` and no `deprecated` field, so the only statements of it were a
 * `console.warn` string literal in `div.tsx` / `span.tsx` and the
 * human-readable label `'Container (Deprecated)'`. This file was therefore
 * built on a hand-kept mirror whose premise arm READ THE RENDERER'S SOURCE and
 * regex-matched that console literal — the closest thing to asking "is this
 * type deprecated?" that existed.
 *
 * ## What objectui#6674 changed, and what it did not
 *
 * The registration now DECLARES it: `deprecated: { surfaces: ['json'],
 * replacement: … }`, read back through `ComponentRegistry.deprecationFor(type,
 * surface)`. So `the deprecation this ratchet mirrors is still declared` asks
 * the registry instead of grepping a `.tsx` for a console string, and
 * `no LOADED registration declares a deprecation this list omits` is the new
 * arm that direction makes possible at all.
 *
 * ⚠️ `DEPRECATED_TYPES` stays HAND-KEPT on purpose, and deriving it wholesale
 * from the registry would be a regression rather than the obvious next step.
 * This file loads `@object-ui/components` and nothing else; a type declared
 * deprecated by a plugin package it does not import would silently drop out of
 * a derived list, and the census would shrink to green. The list is the
 * ratchet's authority precisely because it is complete by construction. What
 * the declaration buys is that the list can now be CHECKED — in both directions
 * — against something a machine can read.
 *
 * ## Why this ratchet freezes the stock instead of demanding zero
 *
 * The 2026-08-29 ruling adopted "replace, worklist-form, with the closing
 * lint": convert the catalog's deprecated `div` nodes to the replacements the
 * deprecation notice itself names, then add this lint "so the stock never
 * regrows". The conversion half is NOT mechanical, and the measurement that
 * says so is recorded here because it is the reason this file ships ahead of
 * it. Rendered through the real `SchemaRenderer` on `9486ac672`, given the
 * identical authored input `{ className: 'p-4', children: [...] }`:
 *
 *   div        <div class="p-4">AB</div>
 *   container  <div class="w-full max-w-xl mx-auto sm:p-3 md:p-4 p-4">AB</div>
 *   flex       <div class="flex flex-row justify-start items-start gap-1.5 sm:gap-2 p-4">AB</div>
 *   stack      <div class="flex flex-col justify-start items-stretch gap-1.5 sm:gap-2 p-4">AB</div>
 *   grid       <div class="grid grid-cols-2 gap-4 p-4">AB</div>
 *   card       <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-4"><div class="p-6 pt-0">AB</div></div>
 *
 * `div` is class-TRANSPARENT — it emits the authored className and nothing
 * else. Every replacement the notice names injects layout: a display mode
 * (`flex` / `grid`), a width and centering (`container`), or a border, a shadow
 * and an extra `CardContent` wrapper element (`card`). Note `container`'s
 * output in particular: `twMerge` does not strip the injected `sm:p-3 md:p-4`,
 * because those are different responsive variants from the authored `p-4` — so
 * the box keeps the authored padding at the base breakpoint and silently gets
 * SMALLER padding from `sm` up. None of the 85 nodes carries a flex or grid
 * display class, and none authors a single layout prop (the only keys present
 * across all 85 are `type`, `className`, `children`, `body`), so there is no
 * authored intent to carry over — the injection is pure addition.
 *
 * The second class of difference is not cosmetic at all. `container`, `flex`,
 * `stack` and `grid` render `schema.children` ONLY; `div` renders
 * `schema.children || schema.body`. Four of the 85 nodes author `body` — the
 * `components-basic-sidebar` family, whose whole subtree is `body`-authored.
 * Measured on the real `basic-sidebar.json` fixture, swapping only its `div`:
 *
 *   as authored (div)  elements=21  text="Menu…Settings Main content area"
 *   swapped -> stack   elements=21  text="Menu…Settings"          <- content GONE
 *   swapped -> flex    elements=21  text="Menu…Settings"          <- content GONE
 *   swapped -> container / grid  — same, content GONE
 *
 * The element count is UNCHANGED at 21, so the loss is invisible to any
 * element-count check, and `catalog-gallery-render`'s `drewSomething` control
 * still passes because the sidebar beside it draws. That is the silent
 * catalog-wide regression a find-and-replace would have shipped, and it is
 * worse than the warning it would have removed.
 *
 * So the stock is FROZEN here and drains through the worklist, one judged
 * batch at a time. This file's job is only to guarantee it never grows.
 *
 * ## What the deprecation costs today, measured
 *
 * The card's headline — "one deprecation warning per docs-site thumbnail" — is
 * already false. `DivRenderer` reports once per module load (objectui#3998) and
 * exempts `kind:'html'` nodes by provenance (objectui#4000). Rendering all 431
 * catalog entries through the real `SchemaRenderer` with a `console.warn` spy
 * active from the first entry: `entries_rendered=431 total_warns=4
 * div_deprecation_notices=1`. The other three warns (react-i18next, a
 * `visibleWhen` predicate, an expression failure) are the positive control that
 * the spy was capturing, so `1` is a measurement and not a silent spy. The
 * console cost is therefore closed; what remains, and what this file guards, is
 * the authoring-contract cost.
 *
 * ## Why `components-basic-div/` is exempt rather than baselined
 *
 * That category IS the migration guidance for this deprecation: it ships
 * `use-card-instead`, `flex-layout` and `grid-layout` beside `nested-divs` and
 * `custom-card`. A category documenting the deprecated type must author the
 * deprecated type — sweeping it would delete the before-and-after that teaches
 * the migration. Same class as the two deliberate legacy examples in
 * `div.mdx`, exempted on 2026-08-09 in any option. The exemption is a
 * DIRECTORY, and it is checked for non-vacuity below so it cannot quietly
 * become a hole nothing uses.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Registers `div` / `span` (and the rest of the basic set) at module scope, so
// the two arms below can ASK the registry what is deprecated instead of reading
// a renderer's source. Module scope, not a hook — objectui#3010/#3021.
import '@object-ui/components';
import { ComponentRegistry } from '@object-ui/core';

/** Resolved off this module, so the gate does not depend on the process cwd. */
const SCHEMAS_ROOT = fileURLToPath(new URL('../src/schemas', import.meta.url));

/**
 * The surface this corpus is authored on. Every fixture under `SCHEMAS_ROOT` is
 * JSON metadata, so the question this ratchet asks the registry is scoped to
 * it: `div` and `span` are ALSO permanent vocabulary of the `kind:'html'` tier
 * (objectui#4000), where the parser compiles the plain tag straight through and
 * no other spelling exists to migrate to. A gate that dropped the scope would
 * be refusing a spelling that is correct on the other surface.
 */
const CORPUS_SURFACE = 'json' as const;

/**
 * The deprecated JSON-authored component types this ratchet refuses. Hand-kept
 * — see the header for why deriving it from the registry would shrink the
 * census silently — and now checked in BOTH directions against the
 * machine-readable declaration the registrations carry (objectui#6674).
 */
const DEPRECATED_TYPES = ['div', 'span'] as const;

/**
 * The category that DOCUMENTS the deprecated type, and may therefore author it.
 * A directory prefix, relative to `SCHEMAS_ROOT`.
 */
const DOC_EXEMPT_DIRS = ['components-basic-div/'] as const;

/**
 * The frozen stock, measured on `origin/main` @ `9486ac672`: file path relative
 * to `SCHEMAS_ROOT` -> count of deprecated nodes in it. 25 files, 80 nodes;
 * `components-basic-div/` adds the 2 exempt files / 5 exempt nodes that make up
 * the 27 / 85 a raw `grep` reports.
 *
 * ⛔ This table may only ever SHRINK. Growth is the regression this file
 * exists to refuse; shrinkage without updating the table leaves slack that
 * would silently re-admit what a batch just removed, so both directions are red.
 */
const BASELINE: Readonly<Record<string, number>> = {
  'auth/login-simple.json': 1,
  'auth/signup.json': 1,
  'auth/two-factor.json': 1,
  'components-basic-sidebar/basic-sidebar.json': 1,
  'components-basic-sidebar/collapsible-sidebar.json': 1,
  'components-basic-sidebar/grouped-sidebar.json': 1,
  'components-basic-sidebar/sidebar-with-badges.json': 1,
  'components-complex-carousel/customer-reviews.json': 3,
  'components-complex-carousel/no-arrows.json': 3,
  'components-complex-carousel/simple-carousel.json': 3,
  'components-complex-resizable/complex-layout.json': 3,
  'components-complex-resizable/editor-interface.json': 2,
  'components-complex-resizable/mail-layout.json': 3,
  'components-complex-resizable/triple-split.json': 3,
  'components-complex-resizable/vertical-split.json': 2,
  'components-complex-scroll-area/chat-messages.json': 15,
  'components-complex-scroll-area/code-preview.json': 1,
  'components-complex-scroll-area/document-browser.json': 21,
  'components-complex-scroll-area/vertical-scroll.json': 1,
  'components-feedback-toaster/custom-position-limit.json': 1,
  'ecommerce/order-summary.json': 1,
  'marketing/features-grid.json': 1,
  'marketing/pricing-table.json': 1,
  'marketing/testimonials.json': 1,
  'theme/semantic-color-palette.json': 8,
};

/** Every `*.json` fixture, path relative to `SCHEMAS_ROOT`, sorted. */
function fixtureFiles(): string[] {
  const out: string[] = [];
  const walk = (abs: string, rel: string) => {
    for (const name of readdirSync(abs).sort()) {
      const childAbs = `${abs}/${name}`;
      const childRel = rel ? `${rel}/${name}` : name;
      if (statSync(childAbs).isDirectory()) walk(childAbs, childRel);
      else if (name.endsWith('.json')) out.push(childRel);
    }
  };
  walk(SCHEMAS_ROOT, '');
  return out;
}

/**
 * Count deprecated nodes STRUCTURALLY — every object with a `type` of a
 * deprecated name, at any depth, under any key. A text scan for `"type": "div"`
 * would be at the mercy of JSON formatting and would also match the string
 * inside an unrelated value.
 */
function countDeprecated(node: unknown, into: Map<string, number>): void {
  if (Array.isArray(node)) {
    for (const child of node) countDeprecated(child, into);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Record<string, unknown>;
  const type = obj.type;
  if (typeof type === 'string' && (DEPRECATED_TYPES as readonly string[]).includes(type)) {
    into.set(type, (into.get(type) ?? 0) + 1);
  }
  for (const value of Object.values(obj)) countDeprecated(value, into);
}

/** `{ file -> { type -> count } }` over the whole catalog, deprecated types only. */
function census(): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const rel of fixtureFiles()) {
    const counts = new Map<string, number>();
    countDeprecated(JSON.parse(readFileSync(`${SCHEMAS_ROOT}/${rel}`, 'utf8')), counts);
    if (counts.size > 0) out.set(rel, counts);
  }
  return out;
}

const isDocExempt = (rel: string) => DOC_EXEMPT_DIRS.some((dir) => rel.startsWith(dir));
const total = (counts: Map<string, number>) =>
  [...counts.values()].reduce((a, b) => a + b, 0);

describe('deprecated component types in the catalog are ratcheted (#3965)', () => {
  const measured = census();

  it('no fixture outside the frozen stock authors a deprecated component type', () => {
    const offenders = [...measured]
      .filter(([rel]) => !isDocExempt(rel) && !(rel in BASELINE))
      .map(([rel, counts]) => `${rel} — ${[...counts].map(([t, n]) => `${n}x "${t}"`).join(', ')}`);

    expect(
      offenders,
      'A NEW catalog fixture authors a deprecated component type. Every catalog ' +
        'entry is an exemplar — this is the corpus a human copies from and that ' +
        'few-shot retrieval hands a generating model — so a deprecated spelling ' +
        'here teaches itself forward. Author the supported type instead. If the ' +
        'entry exists specifically to DOCUMENT the deprecated type, it belongs ' +
        'in a DOC_EXEMPT_DIRS category, not in this list.',
    ).toEqual([]);
  });

  it('no baselined fixture grows more deprecated nodes', () => {
    const grown = Object.entries(BASELINE)
      .map(([rel, allowed]) => {
        const now = total(measured.get(rel) ?? new Map());
        return now > allowed ? `${rel} — baseline ${allowed}, now ${now}` : null;
      })
      .filter((x): x is string => x !== null);

    expect(
      grown,
      'A fixture already carrying deprecated nodes gained MORE. The stock is ' +
        'frozen and may only drain; editing one of these files is not licence ' +
        'to add to it.',
    ).toEqual([]);
  });

  it('the ratchet has no slack — the table matches the corpus exactly', () => {
    const slack = Object.entries(BASELINE)
      .map(([rel, allowed]) => {
        const now = total(measured.get(rel) ?? new Map());
        if (now === allowed) return null;
        if (now === 0) return `${rel} — baseline ${allowed}, now 0: drop this line`;
        return `${rel} — baseline ${allowed}, now ${now}: lower it to ${now}`;
      })
      .filter((x): x is string => x !== null);

    expect(
      slack,
      'Deprecated nodes were REMOVED without lowering BASELINE. That is good ' +
        'work with a stale ledger: the leftover allowance would silently ' +
        're-admit exactly what this batch just removed. Update the table in the ' +
        'same PR — that is what makes it a ratchet rather than a ceiling.',
    ).toEqual([]);
  });

  it('`span` is zero-tolerance — the catalog has never carried one', () => {
    const spans = [...measured]
      .map(([rel, counts]) => [rel, counts.get('span') ?? 0] as const)
      .filter(([, n]) => n > 0)
      .map(([rel, n]) => `${rel} — ${n}`);

    expect(
      spans,
      '`span` carries the same deprecation as `div` and, unlike `div`, has no ' +
        'stock in this corpus to drain — measured at 0 nodes across every ref ' +
        'this card was verified on. There is nothing to grandfather, so it is ' +
        'refused outright rather than baselined.',
    ).toEqual([]);
  });

  it('the deprecation this ratchet mirrors is still declared', () => {
    // The mirror's premise. If a type is UN-deprecated, this file must die
    // loudly rather than keep refusing a spelling that became legal again.
    //
    // This arm used to `readFileSync` the renderer and regex-match its
    // `console.warn` literal, because that string was one of only two places a
    // deprecation was stated and the only one a test could reach. It now asks
    // the registry, which is objectui#6674's whole delivery: the question "is
    // this type deprecated?" has an asker.
    const undeclared = DEPRECATED_TYPES.filter(
      (type) => ComponentRegistry.deprecationFor(type, CORPUS_SURFACE) === undefined,
    );

    expect(
      undeclared,
      'A type this ratchet refuses no longer DECLARES a deprecation for the ' +
        'json authoring surface. Either it was un-deprecated — in which case ' +
        'drop it from DEPRECATED_TYPES and retire the matching baseline — or ' +
        'the declaration moved and this mirror needs re-pointing. (A type ' +
        'whose `surfaces` no longer lists `json` reads as un-deprecated HERE ' +
        'and is still deprecated elsewhere; that is the objectui#4000 scope ' +
        'working, not a bug in this arm.)',
    ).toEqual([]);
  });

  it('no LOADED registration declares a deprecation this list omits', () => {
    // The direction the hand-kept mirror could never check. Before the
    // declaration existed there was nothing to enumerate: a third deprecated
    // type could have been added to `@object-ui/components` with a console
    // string and a label, and this file would have gone on refusing exactly two.
    //
    // Scoped honestly to what this file LOADS — `@object-ui/components`. A
    // plugin package's declaration is out of range here, which is the reason
    // DEPRECATED_TYPES stays the authority rather than being derived.
    //
    // Non-vacuity is the arm ABOVE: an empty result here would also be produced
    // by a registry that answered `undefined` for everything, and that state
    // turns the premise arm red first. The two hold each other up.
    const listed = new Set<string>(DEPRECATED_TYPES);
    // A namespaced registration answers under BOTH spellings (`ui:div` and
    // `div`); the corpus authors the bare one and the baseline is keyed on it.
    // Either spelling being listed counts, and the raw key is what gets
    // reported so the message names something that exists in the registry.
    const bare = (key: string) => (key.includes(':') ? key.slice(key.indexOf(':') + 1) : key);
    const missing = ComponentRegistry.getKnownTypes()
      .filter((type) => ComponentRegistry.deprecationFor(type, CORPUS_SURFACE))
      .filter((type) => !listed.has(type) && !listed.has(bare(type)))
      .sort();

    expect(
      missing,
      'A loaded registration declares a json-surface deprecation that this ' +
        'ratchet does not refuse. Add it to DEPRECATED_TYPES — and if the ' +
        'corpus already authors it, baseline the existing stock in the same PR ' +
        'rather than leaving the type unguarded.',
    ).toEqual([]);
  });

  it('the stock is exactly what this card measured, and the exemption is not a hole', () => {
    const baselined = [...measured].filter(([rel]) => !isDocExempt(rel));
    const exempt = [...measured].filter(([rel]) => isDocExempt(rel));

    // Non-vacuity, both halves. A walker that silently returned nothing would
    // satisfy every arm above; an exemption covering no real fixture would be
    // dead licence sitting open for a future author to walk through.
    expect(
      baselined.reduce((n, [, c]) => n + total(c), 0),
      'the frozen stock, as measured on 9486ac672',
    ).toBe(80);
    expect(baselined.length, 'files carrying the frozen stock').toBe(25);
    expect(
      exempt.reduce((n, [, c]) => n + total(c), 0),
      'the documentation category must really author the type it documents',
    ).toBe(5);
  });

  it('the detector actually detects — counter-probe', () => {
    // Fails on a walker that returns [] for everything, which is the failure
    // mode every arm above would read as green.
    const found = new Map<string, number>();
    countDeprecated(
      { type: 'stack', children: [{ type: 'div', body: [{ type: 'span' }] }, { type: 'card' }] },
      found,
    );
    expect(found.get('div')).toBe(1);
    expect(found.get('span')).toBe(1);

    const clean = new Map<string, number>();
    countDeprecated({ type: 'stack', children: [{ type: 'card' }] }, clean);
    expect(clean.size, 'and does not claim a type that is not deprecated').toBe(0);
  });
});
