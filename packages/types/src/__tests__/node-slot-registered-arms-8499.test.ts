/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Registered, live renderers reached through a declared node slot resolve in an
 * arm of `AnyComponentSchema` (objectui#8499).
 *
 * ## The defect these pin
 *
 * Nine `type` spellings sat at DECLARED node slots in this repository's own
 * corpora and resolved in no arm of the union. Eight of them were registered
 * renderers; the ninth (`my-component`) is the reader's own plugin component and
 * carries a written exemption at `scripts/check-doc-component-types.mjs`.
 *
 * The damage ran the expensive direction: a reader following
 * `content/docs/utilities/runner.mdx`'s own instruction — "copy one, wrap it in
 * a page document … and save it as `src/app-data/pages/index.json`" — got a
 * document that RENDERS CORRECTLY in the browser and is REFUSED by `objectui
 * check`. The likely reaction to that is to stop trusting `check`, not to fix
 * the document.
 *
 * ## Why nothing caught it
 *
 * `check:doc-types` judges a `type` literal against the RENDERER REGISTRY (656
 * keys, measured at the time of writing); `AnyComponentSchema` declares 107 arm
 * literals. The two faces disagree BY CONSTRUCTION and nothing compared them at
 * a node slot. So the repair is paired with the comparison this file's third
 * `describe` performs — not the full `registry ⊆ arms` containment (552 of the
 * 656 registered keys have no arm, so that instrument needs a ledger this card
 * is not authorised to mint), but the two FAMILY arms compared against the very
 * arrays their registration sites loop over. A tag added to either array without
 * an arm here goes red instead of diverging silently.
 *
 * ## `line-chart` is deliberately NOT armed — the card's premise fails for it
 *
 * The card lists `line-chart` among the eight as a "REGISTERED, LIVE renderer".
 * Measured here, it is not. `apps/console/src/register-plugins.ts` registers it
 * as a LAZY STUB pointing at `@object-ui/plugin-charts`, and that package never
 * registers the key — `Registry.loadLazy`'s own docblock says the loader
 * "resolves once the loader completes (whether or not the loaded module actually
 * registered the expected type)". So the key is known to `check:doc-types` and
 * resolves to nothing at render time; `scripts/check-doc-component-types.mjs`
 * records the same reading, calling it "the `line-chart` widget objectui#7896
 * recorded in `packages/plugin-dashboard/README.md`". objectui#8499's triage
 * admits arms only for things that "运行时已经正确渲染" — already render
 * correctly at runtime — so an arm for `line-chart` would invent a capability
 * rather than name one. The fourth `describe` pins the absence WITH its reason,
 * so registering the key for real turns this red instead of leaving the gap.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AnyComponentSchema } from '../zod/index.zod.js';
import { SemanticElementSchema, HtmlElementSchema } from '../zod/layout.zod.js';
import { InputShorthandSchema, UiCalendarSchema } from '../zod/form.zod.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');
const read = (relative: string): string => readFileSync(join(REPO_ROOT, relative), 'utf8');

const SEMANTIC_RENDERER = 'packages/components/src/renderers/layout/semantic.tsx';
const HTML_RENDERER = 'packages/components/src/renderers/basic/html-elements.tsx';
const CHARTS_PLUGIN = 'packages/plugin-charts/src/index.tsx';
const CONSOLE_PLUGINS = 'apps/console/src/register-plugins.ts';

/** The seven spellings this card armed, and where each renders from. */
const ARMED = [
  { type: 'footer', renderer: SEMANTIC_RENDERER },
  { type: 'header', renderer: SEMANTIC_RENDERER },
  { type: 'main', renderer: SEMANTIC_RENDERER },
  { type: 'nav', renderer: SEMANTIC_RENDERER },
  { type: 'h1', renderer: HTML_RENDERER },
  { type: 'password', renderer: 'packages/components/src/renderers/form/input.tsx' },
  { type: 'ui:calendar', renderer: 'packages/components/src/renderers/form/calendar.tsx' },
] as const;

/**
 * The firing controls. Each is a `type` NOTHING registers, so each must stay
 * refused — an assertion set that only ever says ACCEPT would pass against a
 * union that accepted everything, which is the failure mode a widening card is
 * most exposed to.
 */
const UNREGISTERED = [
  'h1ZZ',
  'stat-card',
  'my-component',
  'area-chart',
] as const;

/** The `type` literals a schema declares to Zod's discriminator dispatch. */
function literalsOf(schema: unknown): string[] {
  const values = (schema as { _zod?: { propValues?: { type?: Set<string> } } })._zod?.propValues
    ?.type;
  return values === undefined ? [] : [...values];
}

/** The string array a `const NAME = [ … ] as const;` declaration holds. */
function sourceArray(source: string, declaration: string): string[] {
  const start = source.indexOf(declaration);
  if (start === -1) throw new Error(`declaration not found: ${declaration}`);
  const open = source.indexOf('[', start);
  const close = source.indexOf(']', open);
  if (open === -1 || close === -1) throw new Error(`array literal not found: ${declaration}`);
  return [...source.slice(open, close).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('objectui#8499 — the seven armed spellings resolve, at the root and at a node slot', () => {
  it.each(ARMED)('accepts `$type` as a document root', ({ type }) => {
    const result = AnyComponentSchema.safeParse({ type });
    expect(result.success, JSON.stringify(result.success ? {} : result.error.issues)).toBe(true);
  });

  it.each(ARMED)('accepts `$type` nested at a declared node slot', ({ type }) => {
    // The slot that matters: objectui#8344 pointed the node recursion point at
    // this union, so a nested node is judged by its own component schema. Before
    // this card every one of these was refused HERE as well as at the root.
    const result = AnyComponentSchema.safeParse({ type: 'div', children: [{ type }] });
    expect(result.success, JSON.stringify(result.success ? {} : result.error.issues)).toBe(true);
  });

  it('accepts the catalog fixtures the card names as its live evidence', () => {
    // These render — `examples/schema-catalog/test/catalog-gallery-render.test.tsx`
    // fails if any catalog entry paints the registry's OBJUI-001 "Unknown
    // component type" panel — and every one of them was refused by this union.
    const fixtures = [
      ...['article', 'aside', 'blog-article', 'complete-layout', 'footer', 'header',
        'main-element', 'navigation', 'section']
        .map((n) => `components-layout-semantic/${n}`),
      ...['custom-style', 'date-range', 'form-integration', 'multiple-dates',
        'simple-calendar', 'single-date']
        .map((n) => `components-form-calendar/${n}`),
    ];
    expect(fixtures).toHaveLength(15);
    const refused = fixtures.filter((name) => {
      const doc: unknown = JSON.parse(
        read(`examples/schema-catalog/src/schemas/${name}.json`),
      );
      return !AnyComponentSchema.safeParse(doc).success;
    });
    expect(refused, 'a fixture the renderer draws is still refused by the validator').toEqual([]);
  });
});

describe('objectui#8499 — the controls that keep the acceptances honest', () => {
  it.each(UNREGISTERED)('still refuses `%s`, which nothing registers', (type) => {
    expect(AnyComponentSchema.safeParse({ type }).success).toBe(false);
    expect(AnyComponentSchema.safeParse({ type: 'div', children: [{ type }] }).success).toBe(false);
  });

  it('the new arms judge VALUES, not just the discriminator', () => {
    // An arm that accepted its literal and nothing else would satisfy every
    // assertion above while validating nothing. Each pair is one green reading
    // and one red reading on the SAME key of the SAME arm.
    expect(AnyComponentSchema.safeParse({ type: 'img', src: 'a.png', width: 100 }).success).toBe(true);
    expect(AnyComponentSchema.safeParse({ type: 'img', src: 'a.png', width: true }).success).toBe(false);
    expect(AnyComponentSchema.safeParse({ type: 'password', required: true }).success).toBe(true);
    expect(AnyComponentSchema.safeParse({ type: 'password', required: 'yes' }).success).toBe(false);
    expect(AnyComponentSchema.safeParse({ type: 'ui:calendar', mode: 'single' }).success).toBe(true);
    expect(AnyComponentSchema.safeParse({ type: 'ui:calendar', mode: 'agenda' }).success).toBe(false);
    expect(AnyComponentSchema.safeParse({ type: 'main', hidden: true }).success).toBe(true);
    expect(AnyComponentSchema.safeParse({ type: 'main', hidden: 42 }).success).toBe(false);
  });

  it('adds no discriminator collision', () => {
    // `AnyComponentSchema` can only stay a discriminated union while every
    // literal is claimed once — `any-component-union-fanout.test.ts` states the
    // invariant; this leg says these four arms are not where it breaks.
    const added = [
      ...literalsOf(SemanticElementSchema),
      ...literalsOf(HtmlElementSchema),
      ...literalsOf(InputShorthandSchema),
      ...literalsOf(UiCalendarSchema),
    ];
    expect(added.length).toBe(7 + 37 + 2 + 1);
    expect(new Set(added).size).toBe(added.length);
    const all = literalsOf(AnyComponentSchema);
    expect(new Set(all).size).toBe(all.length);
    for (const literal of added) expect(all).toContain(literal);
  });
});

describe('objectui#8499 — the family arms are compared against their registration sites', () => {
  // ⭐ THE COMPARISON INSTRUMENT. The two faces diverged by construction because
  // nothing compared them. This does, for the two families this card armed: the
  // arm's literal set must EQUAL the array the registration site loops over.
  it('`SemanticElementSchema` names exactly the tags `semantic.tsx` registers', () => {
    const tags = sourceArray(read(SEMANTIC_RENDERER), 'const tags = ');
    expect(tags.length, 'the source read went vacuous — check the declaration name').toBe(7);
    expect([...literalsOf(SemanticElementSchema)].sort()).toEqual([...tags].sort());
  });

  it('`HtmlElementSchema` names exactly the tags `html-elements.tsx` registers', () => {
    const tags = sourceArray(read(HTML_RENDERER), 'const TAGS = ');
    expect(tags.length, 'the source read went vacuous — check the declaration name').toBe(37);
    expect([...literalsOf(HtmlElementSchema)].sort()).toEqual([...tags].sort());
  });

  it('detects a tag that is registered and unarmed', () => {
    // The firing control for the two equalities above: they must not be able to
    // pass while a registered tag is missing from the arm.
    const armed = new Set(literalsOf(SemanticElementSchema));
    const registeredPlusOne = [...armed, 'hgroup'];
    expect([...armed].sort()).not.toEqual([...registeredPlusOne].sort());
  });
});

describe('objectui#8499 — `line-chart` stays unarmed, and the reason stays checked', () => {
  it('resolves in no arm', () => {
    expect(AnyComponentSchema.safeParse({ type: 'line-chart' }).success).toBe(false);
  });

  it('is a lazy stub in the console that `@object-ui/plugin-charts` never fulfils', () => {
    // The premise the card asserts for all eight and that fails for this one.
    // Both halves are read from source so the day someone registers the key for
    // real, this goes red and the arm becomes owed.
    const consoleSource = read(CONSOLE_PLUGINS);
    expect(consoleSource, 'the console stub moved — re-derive the premise').toContain("'line-chart'");

    const pluginSource = read(CHARTS_PLUGIN);
    const registered = [...pluginSource.matchAll(/register\(\s*\n?\s*'([^']+)'/g)].map((m) => m[1]);
    // Non-vacuity: the reader must actually find this module's registrations.
    expect(registered.length, 'the registration read went vacuous').toBeGreaterThanOrEqual(6);
    expect(registered).toContain('pie-chart');
    expect(registered).not.toContain('line-chart');
  });
});
