/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Registry `inputs` <-> `@objectstack/spec` `ComponentPropsMap` parity, for
 * EVERY block that has both (objectui#3797).
 *
 * PR #3795 landed this check on one block (`record:highlights`, see
 * `packages/plugin-detail/src/__tests__/recordHighlightsInputs.spec-parity.test.ts`).
 * This file is the repo-wide half: it asserts the same direction — a block may
 * not DECLARE a top-level input its spec props schema does not accept — for
 * every entry of `ComponentPropsMap` this repo registers with a non-empty
 * `inputs`.
 *
 * WHY THE DIRECTION MATTERS. `inputs` is not documentation, it is the published
 * authoring surface, and four layers are silent about a key that only exists
 * there:
 *
 *   1. `packages/sdui-parser/scripts/gen-manifest.ts` serializes `inputs` into
 *      `sdui.manifest.json` (the save-gate + parser whitelist) and into
 *      `sdui-intrinsics.d.ts` (the JSX authoring type surface), so both declare
 *      the key legal;
 *   2. `packages/sdui-parser/src/validate.ts` walks a node's top-level props
 *      against `comp.inputs`, finds the key there, and raises nothing;
 *   3. the spec's props schemas are plain (strip-mode) `z.object`s, so
 *      `parse()` drops an undeclared top-level key with no error;
 *   4. the renderer never sees it.
 *
 * Net: the platform's own manifest tells an author — very often an AI author —
 * to write a key the platform throws away, and nothing anywhere reports it.
 * That is objectstack#5435 ("platform authority must not point at keys its own
 * gate rejects") in reverse, and the second dialect AGENTS.md #0.1 exists to
 * prevent.
 *
 * It is not hypothetical on the objectstack side either. Since objectstack#5068,
 * `packages/lint/src/validate-component-props.ts` dispatches on the component
 * `type` and reports undeclared `properties.*` keys on `os validate` /
 * `os build` / `os lint`. So for the exempted keys below, the two platform
 * authorities disagree out loud about the same key today: objectui's manifest
 * offers it, the upstream linter warns on it, and the renderer honours it. Three
 * answers, and they cannot all be right — which is why an exemption here is
 * always paired with an issue that resolves the disagreement, never left as a
 * standing licence.
 *
 * WHY IT LIVES HERE. The check needs the FULL registration graph — the same one
 * that produces the published artifacts. `dev/manifest-dump.tsx` builds them
 * from `src/register-plugins.ts` plus `@object-ui/components`, so this file
 * imports exactly that pair (as `public-contract.test.ts` next door already
 * does) rather than a hand-assembled list that could agree with itself and
 * prove nothing. Coverage is deliberately NOT limited to the public tier:
 * `packages/components/src/renderers/layout/page.tsx:462` builds the runtime
 * JSX-page validation manifest from `getKnownTypes()`, so a non-public block's
 * `inputs` are a live prop whitelist too — that is how `element:record_picker`,
 * absent from `PUBLIC_BLOCKS`, still publishes an authoring surface.
 *
 * EXPECTATIONS ARE DERIVED, NOT RESTATED. The accepted key set comes from
 * `ComponentPropsMap[type]`'s own shape at runtime. A spec release that adds or
 * removes a key therefore moves this gate with it instead of quietly widening
 * the gap — which is also how the stale-pin exemptions below are meant to
 * resolve themselves.
 *
 * EXEMPTIONS ARE EXPLICIT, EACH CARRIES A REASON, AND A STALE ONE FAILS. A new
 * divergence has to be registered in a diff someone reviews; it can never
 * arrive silently. And once the spec declares an exempted key, the entry must be
 * DELETED rather than kept — the last test in this file turns a no-longer-needed
 * exemption red, so the list cannot rot into a permanent allowlist.
 *
 * LIMIT — worth knowing before trusting a pass. This gate can only see TOP-LEVEL
 * keys. An `inputs` entry of type `array`/`object` declares no member shape
 * (`ComponentInput` has no slot for one), so a drifted key INSIDE an array
 * element is invisible here; making that machine-readable is its own change
 * across types/core/sdui-parser and is tracked separately (PR #3795's open
 * question). A pass means the top-level surface is in parity, nothing more.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { ComponentPropsMap } from '@objectstack/spec/ui';

// The two graphs whose registrations this file reads, at module scope rather
// than in a hook: their cold transform is billed to the import phase, which has
// no test/hook timeout (AGENTS.md §测试纪律, objectui#3010).
import '@object-ui/components';
import '../register-plugins';

/**
 * Top-level keys `ComponentPropsMap[type]` accepts.
 *
 * Reads `.shape` through the same two spellings PR #3795's single-block version
 * uses, so a `lazySchema()`-wrapped entry (every `element:*`) and a plain
 * `z.object` both resolve. Zod-internals access is confined to this function.
 */
function specTopLevelKeys(type: string): string[] {
  const schema = (ComponentPropsMap as Record<string, unknown>)[type] as
    | { shape?: unknown; _def?: { shape?: unknown } }
    | undefined;
  const shape = schema?.shape ?? schema?._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return resolved && typeof resolved === 'object' ? Object.keys(resolved) : [];
}

/** Declared input names for a registered block, or `null` when not registered. */
function declaredInputs(type: string): string[] | null {
  const config = ComponentRegistry.getConfig(type);
  if (!config) return null;
  return (config.inputs ?? []).map((input) => input.name);
}

/** Top-level inputs this block declares that its spec props schema rejects. */
function offSpecInputs(type: string): string[] {
  const allowed = new Set(specTopLevelKeys(type));
  return (declaredInputs(type) ?? []).filter((name) => !allowed.has(name));
}

/**
 * The blocks this gate judges: an entry of `ComponentPropsMap` that this repo
 * registers with at least one `inputs` entry. A block with no `inputs` — or one
 * present only as a `registerLazy` stub, which has none yet — has no declaration
 * to be wrong.
 */
const covered = Object.keys(ComponentPropsMap)
  .filter((type) => (declaredInputs(type) ?? []).length > 0)
  .sort();

/**
 * Registered `ComponentPropsMap` blocks whose `inputs` is empty.
 *
 * Pinned below so "the declaration surface disappeared" is as visible as "it
 * grew a dialect": inputs emptied by accident would otherwise just shrink
 * `covered`, and every per-block assertion would keep passing on less.
 */
const registeredWithoutInputs = Object.keys(ComponentPropsMap)
  .filter((type) => declaredInputs(type)?.length === 0)
  .sort();

/**
 * Every block with a spec entry AND a declared authoring surface, in sorted
 * order. Exact rather than `toContain` for the reason `public-contract.test.ts`
 * gives: the dangerous direction is a SHRINKING contract, which a containment
 * assertion sails straight past.
 */
const EXPECTED_COVERED = [
  'element:button',
  'element:number',
  'element:record_picker',
  'element:text',
  'element:text_input',
  'page:accordion',
  'page:card',
  'page:header',
  'page:tabs',
  'record:activity',
  'record:chatter',
  'record:details',
  'record:highlights',
  'record:path',
  'record:related_list',
];

/**
 * Registered, spec-carried, and deliberately propless. `EmptyProps` blocks
 * (`page:footer`, `page:section`, `page:sidebar`, `nav:*`, `global:search`)
 * genuinely take no props; `element:image` / `element:metadata_viewer` /
 * `element:divider` / `ai:suggestion` are registered without an `inputs` list.
 * Either way there is no declaration for this gate to judge — but a block moving
 * OUT of `EXPECTED_COVERED` into here is an authoring surface that vanished, so
 * the list is pinned rather than derived-and-ignored.
 */
const EXPECTED_WITHOUT_INPUTS = [
  'ai:suggestion',
  'element:divider',
  'element:image',
  'element:metadata_viewer',
  'global:search',
  'nav:breadcrumb',
  'nav:menu',
  'page:footer',
  'page:section',
  'page:sidebar',
];

/**
 * Off-spec top-level inputs ACCEPTED for now, each with the reason.
 * Key format: `BLOCK.INPUT`.
 *
 * The bar for an entry is NOT "the renderer reads it". A key the renderer reads
 * is a key worth declaring SOMEWHERE — it is not a key worth declaring in a
 * place the contract rejects. The bar is that the divergence is already owned by
 * a named, open piece of upstream work, because `@objectstack/spec` is not
 * edited from this repo (AGENTS.md #0 / #0.1): "the spec should declare this"
 * is an upstream issue plus an entry here, never a local widening. Every reason
 * therefore has to cite an issue, which `references a tracking issue` asserts.
 *
 * All eight entries below were verified against renderer read sites, not
 * assumed — see objectui#3797 and objectstack#6776 for the per-key evidence.
 */
const OFF_SPEC_EXEMPTIONS: Record<string, string> = {
  // ── page:header — three author-facing booleans the spec never declared ────
  // Read at `containers.tsx:979/980/981` and consumed at `:1453` (which of the
  // two header layouts renders) and `:1531/:1532` (the RecordTitleChip star and
  // copy-id affordances). Author-reachable, NOT host-injected: this block's
  // host injections come through RecordContext (`headerSystemActions`,
  // `isFavorite`, `onToggleFavorite`) and are deliberately undeclared.
  // `recordChrome` already has in-repo authors — `preview-samples.ts:68` writes
  // it under `properties`, the exact shape the upstream linter warns on, and
  // `plugin-detail/src/synth/buildDefaultPageSchema.ts:413` emits it on every
  // synthesized record page. Direction is therefore "the spec should declare
  // it", filed as objectstack#6776; withdrawing them here would delete live,
  // author-reachable configuration.
  //
  // (objectui#3797 suggested these might be renderer-only props deliberately
  // kept by objectui#3226 / PR #3265. Checked: #3265 (`d2363e710`) narrowed the
  // LEGACY `page-header` alias in `packages/layout`, not this canonical block —
  // there is no such deliberate-retention record.)
  'page:header.recordChrome':
    'Renderer reads it (containers.tsx:979) to pick the bare-h1 layout; authored in-repo by preview-samples.ts:68 and emitted by buildDefaultPageSchema.ts:413. Awaiting the spec declaration in objectstack#6776.',
  'page:header.showStar':
    'Renderer reads it (containers.tsx:980) and passes it to RecordTitleChip (:1531) to hide the follow star. Awaiting the spec declaration in objectstack#6776.',
  'page:header.showCopyId':
    'Renderer reads it (containers.tsx:981) and passes it to RecordTitleChip (:1532) to hide the copy-id button. Awaiting the spec declaration in objectstack#6776.',

  // ── page:accordion.variant ───────────────────────────────────────────────
  // Read at `containers.tsx:734` and consumed at `:735` to pick each panel's
  // border class, so `variant: 'card'` renders visibly differently. The spec
  // declares no equivalent at all.
  'page:accordion.variant':
    "Renderer reads it (containers.tsx:734) and it changes per-panel borders (:735); the renderer's own comment documents `variant: 'card'` as an author opt-in. Awaiting the spec declaration in objectstack#6776.",

  // ── page:tabs.tabStyle — a carrier collision, not ordinary drift ──────────
  // The spec DOES declare this concept, spelled `type` (`PageTabsProps.type`),
  // and `containers.tsx:381` reads both (`properties.type || tabStyle`). Two
  // spellings for one semantic is exactly what #0.1 forbids, so the local
  // instinct is to withdraw `tabStyle` — but both local moves are wrong:
  //   - withdrawing it deletes the only spelling the FLAT carrier can express.
  //     `SchemaRenderer.tsx:251-270` deliberately refuses to hoist
  //     `properties.type` onto the node (it would shadow the dispatch key, and
  //     its comment names this very case), and a flat node is
  //     `{ type: 'page:tabs', tabStyle: 'card' }` where `type` is the tag;
  //   - publishing `type` instead declares a key this repo's own parser cannot
  //     validate: `sdui-parser/src/validate.ts:20-30` lists `'type'` in
  //     `BASE_PROPS`, so it is skipped as a base prop on every node.
  // The only remaining lever is upstream, where the shape (rename `type` to
  // `tabStyle` per objectstack#5775's precedent, vs declare an alias) is a spec
  // contract decision this repo must not guess. Both options and their costs are
  // written out in objectstack#6776.
  'page:tabs.tabStyle':
    "Renderer reads it (containers.tsx:381) and it is the only spelling the flat SDUI carrier can express — the spec's `type` is unhoistable (SchemaRenderer.tsx:251-270) and unvalidatable as an input (validate.ts BASE_PROPS). Convergence is an upstream contract decision: objectstack#6776.",

  // ── element:record_picker — ALREADY settled upstream, stale pin only ──────
  // objectstack#5775 (ADR-0087 D2) declared `labelField` / `valueField` /
  // `label` (plus `sort` / `limit` / `emptyText`) and turned `displayField` /
  // `searchFields` / `multiple` into `retiredKey()` tombstones — converging on
  // the `labelField` this renderer actually reads
  // (`renderers/basic/record-picker.tsx:80-81`), which is the direction
  // objectui#3797 guessed at. Verified on objectstack `origin/main`
  // (`packages/spec/src/ui/component.zod.ts:715-786`). It is not in a published
  // release yet: the newest `@objectstack/spec` on npm is `17.0.0-rc.5`, which
  // predates #5775 and is what this repo pins. So these three flags are a
  // stale-pin artifact with NOTHING to do in either repo — and the
  // `no stale exemption` test below deletes them for us, loudly, the moment the
  // pin moves.
  'element:record_picker.labelField':
    'Already declared upstream by objectstack#5775 (converging on the spelling this renderer reads); flagged only because the pinned @objectstack/spec@17.0.0-rc.5 predates it. Delete this entry when the pin moves.',
  'element:record_picker.valueField':
    'Already declared upstream by objectstack#5775; flagged only because the pinned @objectstack/spec@17.0.0-rc.5 predates it. Delete this entry when the pin moves.',
  'element:record_picker.label':
    'Already declared upstream by objectstack#5775; flagged only because the pinned @objectstack/spec@17.0.0-rc.5 predates it. Delete this entry when the pin moves.',
};

const exemptedFor = (type: string): string[] =>
  Object.keys(OFF_SPEC_EXEMPTIONS)
    .filter((key) => key.startsWith(`${type}.`))
    .map((key) => key.slice(type.length + 1));

describe('registry `inputs` vs `@objectstack/spec` ComponentPropsMap (repo-wide)', () => {
  it('judges every spec-carried block that declares an authoring surface', () => {
    // Non-vacuity guard. Every per-block assertion below is generated from
    // `covered`; if the registration graph stopped loading, `covered` would be
    // empty and the whole suite would pass on nothing.
    expect(covered).toEqual(EXPECTED_COVERED);
  });

  it('pins the spec-carried blocks that are registered with no inputs', () => {
    expect(registeredWithoutInputs).toEqual(EXPECTED_WITHOUT_INPUTS);
  });

  it('resolves a non-empty accepted key set for each covered block', () => {
    // Guards the derivation itself: if `specTopLevelKeys` ever stopped
    // resolving `.shape` (a Zod internals change, a `lazySchema` rework), it
    // would return `[]`, every input would read as off-spec, and the failure
    // would look like a repo-wide regression instead of a broken probe. An
    // empty result here means "fix the reader", not "fix the inputs".
    for (const type of covered) {
      expect(specTopLevelKeys(type).length, `${type} spec shape did not resolve`).toBeGreaterThan(0);
    }
  });

  it.each(covered)('%s declares no top-level input the spec does not accept', (type) => {
    const exempt = new Set(exemptedFor(type));
    const unregistered = offSpecInputs(type).filter((name) => !exempt.has(name));
    expect(unregistered).toEqual([]);
  });

  it('every exemption names a real declared input on a covered block', () => {
    // A typo'd exemption key is worse than no exemption: it silently licenses
    // nothing while reading as deliberate cover for a real divergence.
    const dangling = Object.keys(OFF_SPEC_EXEMPTIONS).filter((key) => {
      const dot = key.indexOf('.');
      const type = key.slice(0, dot);
      const input = key.slice(dot + 1);
      return !covered.includes(type) || !(declaredInputs(type) ?? []).includes(input);
    });
    expect(dangling).toEqual([]);
  });

  it('every exemption states a reason and references a tracking issue', () => {
    const unjustified = Object.entries(OFF_SPEC_EXEMPTIONS)
      .filter(([, reason]) => !/#\d+/.test(reason))
      .map(([key]) => key);
    expect(unjustified).toEqual([]);
  });

  it('carries no stale exemption — a declared key must lose its entry', () => {
    // The half that keeps this list from becoming a permanent allowlist. Once
    // the spec declares an exempted key (upstream landing, or just a pin bump
    // for the `element:record_picker` trio), the entry stops describing
    // anything and has to be deleted in the same change that moves the pin.
    const stale = Object.keys(OFF_SPEC_EXEMPTIONS).filter((key) => {
      const dot = key.indexOf('.');
      const type = key.slice(0, dot);
      const input = key.slice(dot + 1);
      return !offSpecInputs(type).includes(input);
    });
    expect(stale).toEqual([]);
  });
});
