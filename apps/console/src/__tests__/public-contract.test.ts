/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Console ↔ public contract coverage (ADR-0080, objectui#2953).
 *
 * `PUBLIC_BLOCKS` is the curated contract and AI-authoring vocabulary. What an
 * author (or a model) can actually write is the intersection of that list with
 * what THIS APP registers — and nothing was checking the two against each
 * other. objectui#2953 is what that costs: `getPublicConfigs()` resolved each
 * curated tag through `getConfig()`, which reads loaded registrations only, so
 * every block the console registers via `registerLazy()` fell out of the
 * contract — and out of every `kind:'react'` page's scope — while type-check,
 * lint, build and the whole test suite stayed green.
 *
 * This reads the REAL registration list (`src/register-plugins.ts`, the same
 * module `main.tsx` boots from). A hand-copied list here would reproduce the
 * original failure: it would agree with itself and tell us nothing.
 *
 * The assertions are exact lists rather than "contains", because the failure
 * mode is a SHRINKING contract. `toContain` would sail past a block that
 * silently disappeared; an exact list makes both directions a deliberate edit.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry, PUBLIC_BLOCKS, type PublicComponentConfig } from '@object-ui/core';
// The two graphs whose registrations this file reads. At module scope, NOT
// awaited inside a `beforeAll` — there their cold transform is billed to the
// hook, against `hookTimeout`, which is why this needed a 60s budget. The import
// phase has no test/hook timeout, so the raised timeout goes away rather than
// getting raised again (objectui#3010). See AGENTS.md §9 (test discipline).
//
// Loading them here rather than in a hook does not change WHAT is loaded, so the
// eager/lazy split the assertions below pin is untouched: static imports are
// evaluated in order before the module body, and the shared setup still runs
// before this module is imported at all.
//
// The layout/content primitives (Tier B) …
import '@object-ui/components';
// … and the console's own plugin layer, from the module main.tsx boots from.
import '../register-plugins';

/**
 * Every curated tag the console makes available, in `PUBLIC_BLOCKS` order.
 * Update this only alongside a deliberate change to what the console ships.
 */
const EXPECTED_COVERED = [
  'object-grid',
  'list-view',
  'object-form',
  'embeddable-form',
  'object-master-detail-form',
  'object-kanban',
  'object-calendar',
  'object-gantt',
  'object-timeline',
  'object-map',
  'object-metric',
  'object-chart',
  'dashboard',
  'object-pivot',
  'record:details',
  'record:highlights',
  'record:related_list',
  'record:path',
  'record:line_items',
  'record:activity',
  'record:discussion',
  'record:history',
  'record:quick_actions',
  'record:reference_rail',
  'record:alert',
  'page:tabs',
  'page:card',
  'page:accordion',
  'page:section',
  'page:footer',
  'page:sidebar',
  'element:text',
  'element:number',
  'element:button',
  'element:definition-list',
  'element:repeater',
  'action:button',
  'action:group',
  'action:menu',
  'action:icon',
  'flex',
  'grid',
  'stack',
  'card',
  'tabs',
  'accordion',
  'container',
  'page:header',
  'text',
  'image',
  'icon',
  'markdown',
  'element:divider',
  'badge',
  'alert',
  'button',
  'html',
];

/**
 * Curated tags with no renderer behind them yet — currently none.
 *
 * `PUBLIC_BLOCKS` is documented as aspirational-safe (an unregistered tag is
 * skipped), so a gap is allowed, but it has to be a listed, reviewable gap
 * rather than a silent one: "advertised in the contract, absent at runtime" is
 * exactly what an AI-authored page trips over.
 *
 * The one entry that used to sit here, `line_items`, was not aspirational at
 * all — it was a misspelling of `record:line_items`, whose renderer has shipped
 * in @object-ui/plugin-form all along. Keeping the list empty is what surfaces
 * the next one of those.
 */
const EXPECTED_UNIMPLEMENTED: string[] = [];

/**
 * The curated tags that reach the contract through a PENDING lazy stub in this
 * environment — i.e. the exact code path objectui#2953 broke. Nothing here is
 * eagerly imported by `register-plugins.ts` or by `vitest.setup.dom.tsx`.
 *
 * `dashboard` / `object-metric` / `object-pivot` are lazy in the real console
 * too, but the shared DOM setup imports `@object-ui/plugin-dashboard` eagerly,
 * so they arrive loaded here. That skew is precisely why the coverage
 * assertion above pins AVAILABILITY and not tier: whether a given block is
 * eager or lazy is a bundling decision that varies by host, while "the author
 * can write this tag" must not. If the shared setup ever imports one of the
 * plugins below, move that tag out of this list — it is still covered.
 */
const EXPECTED_LAZY = [
  'object-kanban',
  'object-calendar',
  'object-gantt',
  'object-timeline',
  'object-map',
  'object-chart',
  'markdown',
];

// Safe at module scope: the two side-effect imports at the top of this file are
// evaluated before the module body, so every registration is already in place.
const contract: Map<string, PublicComponentConfig> = new Map(
  ComponentRegistry.getPublicConfigs().map((c) => [c.type, c]),
);

describe('console ↔ PUBLIC_BLOCKS coverage', () => {
  it('exposes every curated block the console ships, eager or lazy', () => {
    expect(PUBLIC_BLOCKS.filter((tag) => contract.has(tag))).toEqual(EXPECTED_COVERED);
  });

  it('leaves exactly the known-unimplemented curated tags uncovered', () => {
    expect(PUBLIC_BLOCKS.filter((tag) => !contract.has(tag))).toEqual(EXPECTED_UNIMPLEMENTED);
  });

  it('reaches the lazily-registered blocks before their chunks load (objectui#2953)', () => {
    // If `getPublicConfigs()` ever goes back to resolving through `getConfig()`,
    // these seven vanish from the contract — silently, since the plugin chunk
    // that would prove them present is exactly the thing that hasn't loaded.
    const lazy = EXPECTED_COVERED.filter((tag) => contract.get(tag)!.lazy);
    expect(lazy).toEqual(EXPECTED_LAZY);
    // A pending stub carries metadata but no renderer — consumers must go
    // through SchemaRenderer, which triggers the loader.
    for (const tag of EXPECTED_LAZY) {
      expect(contract.get(tag)!.component).toBeUndefined();
    }
  });

  it('keeps the contract keyed by the bare tag authors write', () => {
    for (const tag of EXPECTED_COVERED) {
      expect(contract.get(tag)!.type).toBe(tag);
    }
  });
});

/**
 * The namespaces that hold semantic page blocks — the families the Studio page
 * designer offers and @objectstack/spec's page schema enumerates. These are
 * the ones the reverse-coverage guard sweeps: `ui:`/`field:`/plugin internals
 * are rendering capability, not vocabulary candidates.
 *
 * objectui#3023 guarded `record:` alone after fixing it, and 22 doubled keys
 * kept sitting in the other three — checking only the namespace you just fixed
 * is exactly the leak mechanism. Sweep all four.
 */
const SEMANTIC_NAMESPACES = ['record', 'page', 'element', 'action'] as const;

/**
 * Blocks in a semantic namespace that ship but are deliberately NOT in the AI
 * vocabulary, each with the reason it stays out.
 *
 * This list exists to force a decision, not to park problems: registering a
 * new block in any {@link SEMANTIC_NAMESPACES} namespace fails the test below
 * until it is either curated or added here with a reason. That is the property
 * objectui#3006 needed and did not have — `record:line_items` shipped fully
 * configurable and simply never reached the contract, because nothing looked
 * in this direction.
 *
 * Unlike the seven zero-input entries this list once held, several of these
 * DO declare inputs — they are excluded on the merits, not for want of a
 * configuration surface. The reasons for the four `element:` entries mirror
 * the Studio palette's own exclusions (`PALETTE_EXCLUSIONS` in
 * app-shell/metadata-admin), so the two vocabularies stay excluded for the
 * same reasons, not coincidentally.
 */
const DELIBERATELY_UNCURATED: Record<string, string> = {
  'record:chatter':
    'same renderer as record:discussion under a Salesforce-familiar name, kept for ' +
    'schemas already in the wild — the vocabulary carries the spec name, since two ' +
    'spellings of one block is ambiguity an authoring model cannot resolve',
  'action:bar':
    'record:quick_actions covers the record-page action strip, and the spec ui/page ' +
    'vocabulary blesses action button/group/icon/menu but not bar',
  'element:image':
    'duplicates the curated `image` primitive (src/alt/fit) — one spelling per concept',
  'element:metadata_viewer': 'internal metadata debugging surface, not an authoring block',
  'element:record_picker': 'record picking is a field widget, not a page block',
  'element:text_input': 'bare inputs belong to a form, not a page block',
};

/**
 * Curated semantic blocks that declare NO inputs because their renderers
 * genuinely read nothing beyond `children`/`className` — pure containers and
 * separators. Listing them here (rather than exempting them ad hoc) keeps
 * "zero inputs" a reviewed decision: a block that grows a configurable surface
 * while sitting in this list fails the assertion below in the other direction.
 *
 * `page:section` / `page:footer` / `page:sidebar` left this list in
 * objectui#4027, and the entry they left is the reason: "reads nothing beyond
 * `children`" was doing double duty as "therefore declares nothing", and the
 * child list is exactly what a designer has to be able to authorize. All three
 * now publish that one slot, matching the shared `PageContainerProps`
 * objectstack#5775 (PR objectstack#6281) gave them upstream. `element:divider`
 * stays: it renders no children at all.
 */
const PROP_LESS_CURATED = ['element:divider'];

describe('PUBLIC_BLOCKS ↔ console coverage (reverse direction)', () => {
  const shippedBlocks = (ns: string): string[] =>
    ComponentRegistry.getKnownTypes()
      .filter((k) => ComponentRegistry.getMeta(k)?.namespace === ns)
      .sort();

  it('curates every shipped semantic block, or records why not', () => {
    const curated = new Set<string>(PUBLIC_BLOCKS);
    const uncurated = SEMANTIC_NAMESPACES.flatMap((ns) =>
      shippedBlocks(ns).filter((tag) => !curated.has(tag)),
    ).sort();

    expect(uncurated).toEqual(Object.keys(DELIBERATELY_UNCURATED).sort());
  });

  it('registers each semantic block under one key, prefixed once', () => {
    for (const ns of SEMANTIC_NAMESPACES) {
      expect(shippedBlocks(ns).every((k) => k.startsWith(`${ns}:`))).toBe(true);
    }
  });

  it('leaves the bare names to whoever owns them', () => {
    // The corollary of registering bare + `namespace`: without
    // `skipFallback: true` these also claim `details`, `tabs`, `text`,
    // `button` … as top-level tags. Every one of those belongs to `ui:` (or
    // `field:`), and a missing skipFallback would silently take it over.
    for (const ns of SEMANTIC_NAMESPACES) {
      for (const tag of shippedBlocks(ns)) {
        const bare = tag.slice(ns.length + 1);
        expect(ComponentRegistry.getMeta(bare)?.namespace ?? null).not.toBe(ns);
      }
    }
  });

  it('prefixes every namespaced key exactly once, in every namespace', () => {
    // `register('page:header', …, { namespace: 'page' })` hands an
    // already-prefixed name to a registry that prefixes it again: the block
    // lands at `page:page:header` and stays reachable only through the
    // un-namespaced fallback, which happens to spell `page:header`. Nothing
    // fails — `getPublicConfigs()` rewrites `type` to the curated tag — so the
    // registry quietly carries a phantom key per block.
    //
    // objectui#3023 fixed the eleven in `record:` and guarded that namespace
    // alone. Twenty-two more were sitting in `action:`, `element:` and `page:`,
    // two of them (`page:header`, `element:divider`) curated public blocks.
    // Checking one namespace is what let them keep sitting there, so this asks
    // the whole registry.
    const doubled = ComponentRegistry.getKnownTypes().filter((k) => {
      const ns = ComponentRegistry.getMeta(k)?.namespace;
      return !!ns && k.startsWith(`${ns}:${ns}:`);
    });

    expect(doubled).toEqual([]);
  });

  it('keeps the chatter alias identical to the block it aliases', () => {
    // `record:chatter` is excluded because it duplicates `record:discussion`,
    // not because it is lesser. The moment the two configuration surfaces
    // diverge, that reasoning stops holding: `chatter` would be its own block
    // kept out of the vocabulary, which is the state this whole file exists to
    // catch. Comparing inputs is what makes the exclusion falsifiable.
    //
    // Both are eager registrations, asserted first — a pending lazy stub
    // reports `inputs: undefined` meaning "not known yet", which would make the
    // comparison below pass vacuously on two blanks.
    for (const tag of ['record:chatter', 'record:discussion']) {
      expect(ComponentRegistry.getConfig(tag)).toBeDefined();
    }
    const chatter = ComponentRegistry.getMeta('record:chatter')?.inputs;
    expect(chatter?.length).toBeGreaterThan(0);
    expect(chatter).toEqual(ComponentRegistry.getMeta('record:discussion')?.inputs);
  });

  it('declares inputs for every curated semantic block, minus the prop-less list', () => {
    // What objectui#3006 cost was a configurable block sitting outside the
    // contract. The inverse is just as bad for an authoring model: a curated
    // tag with no declared inputs can only be emitted bare, so it reads as
    // "this block takes no configuration" when the renderer in fact reads
    // props. Curation and a configuration surface travel together — except for
    // the genuinely prop-less containers, which are pinned as such below.
    const curatedSemantic = PUBLIC_BLOCKS.filter((tag) =>
      SEMANTIC_NAMESPACES.some((ns) => tag.startsWith(`${ns}:`)),
    );
    expect(curatedSemantic.length).toBeGreaterThan(0);
    for (const tag of curatedSemantic.filter((t) => !PROP_LESS_CURATED.includes(t))) {
      expect(contract.get(tag)?.inputs ?? []).not.toEqual([]);
    }
    for (const tag of PROP_LESS_CURATED) {
      // Eager registrations, asserted first: a pending lazy stub reports
      // `inputs: undefined` meaning "not known yet", which would make the
      // zero-input pin below vacuous.
      expect(ComponentRegistry.getConfig(tag)).toBeDefined();
      expect(contract.get(tag)?.inputs ?? []).toEqual([]);
    }
  });

  it('catches a curated tag that misses a registered block by its namespace', () => {
    // The objectui#3006 shape: PUBLIC_BLOCKS said `line_items`, the registry
    // said `record:line_items`, and the forward check could only report "not
    // covered" — which reads as "not built yet" and got filed as a known gap.
    // A near-miss is never intentional: one of the two spellings is a typo.
    const known = new Set(ComponentRegistry.getKnownTypes());
    const nearMisses = PUBLIC_BLOCKS.filter((tag) => !known.has(tag)).map((tag) => {
      const bare = tag.slice(tag.indexOf(':') + 1);
      return { tag, alsoTry: [...known].filter((k) => k === bare || k.endsWith(`:${bare}`)) };
    });

    expect(nearMisses.filter((m) => m.alsoTry.length > 0)).toEqual([]);
  });
});
