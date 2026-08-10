/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Registry `inputs` <-> `@objectstack/spec` `ComponentPropsMap` parity, for
 * EVERY block that has both, in BOTH directions (objectui#3797, objectui#3808).
 *
 * PR #3795 landed both directions on one block (`record:highlights`, see
 * `packages/plugin-detail/src/__tests__/recordHighlightsInputs.spec-parity.test.ts`).
 * This file is the repo-wide half, and it carries the same two:
 *
 *   FORWARD (objectui#3797, PR #3806) — a block may not DECLARE a top-level
 *   input its spec props schema does not accept.
 *
 *   REVERSE (objectui#3808) — a top-level key the spec DOES declare must be
 *   discoverable from that block's `inputs`.
 *
 * Both live in one file on purpose. #3808 exists because PR #3806 shipped only
 * the forward half repo-wide and the reverse half stayed on the single block
 * PR #3795 had covered; keeping them side by side, over one `covered` set and
 * one exemption discipline, is what stops a direction from being forgotten
 * again.
 *
 * WHY THE FORWARD DIRECTION MATTERS. `inputs` is not documentation, it is the
 * published authoring surface, and four layers are silent about a key that only
 * exists there:
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
 * WHY THE REVERSE DIRECTION MATTERS JUST AS MUCH. A key the spec declares, the
 * renderer honours, and `inputs` omits does not exist as far as an author can
 * tell — and the same four layers are just as quiet, only inverted:
 * `gen-manifest.ts` leaves it out of `sdui.manifest.json` and
 * `sdui-intrinsics.d.ts`, so it is in no designer panel and no `.d.ts`;
 * `validate.ts:74` does not find it in `comp.inputs` and reports `unknown-prop`
 * on it; and the renderer honours it anyway. An author who writes it is warned
 * off a key that works, and an author who doesn't never learns it is there.
 * That is objectui#3407's original complaint verbatim (`readonly` was enforced
 * by the HeaderHighlight gate and honoured by the renderer — the description
 * just never mentioned it), and objectui#3808 found it on three more keys plus
 * one this gate now covers as an exemption.
 *
 * The reverse direction bites non-public blocks too, which is the other reason
 * coverage is not limited to `PUBLIC_BLOCKS`: `element:text_input` never reaches
 * `sdui.manifest.json`, but `page.tsx:462` builds the JSX-page compiler's prop
 * whitelist from `getKnownTypes()` + these same `inputs`, so its undeclared
 * `defaultValue` was a live `unknown-prop` warning on a key the renderer seeded
 * page variables from.
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
 * LIMIT — worth knowing before trusting a pass. This gate compares TOP-LEVEL
 * KEY NAMES and nothing else. Three things it therefore cannot see, all of them
 * real and all filed:
 *
 *   - member shapes. An `inputs` entry of type `array`/`object` declares no
 *     member shape (`ComponentInput` has no slot for one), so a drifted key
 *     INSIDE an array element or nested object is invisible here — which is why
 *     `record:details.sections`, `record:highlights.fields` and
 *     `record:related_list.add` publish their members in prose and are pinned by
 *     per-block tests next to their renderers. PR #3795's open question;
 *   - types. `ComponentInput.type` is one coarse control kind and cannot spell a
 *     spec union, so a key can be in perfect NAME parity while publishing a
 *     narrower type than the contract accepts (objectui#3832);
 *   - `retiredKey()` tombstones. `Object.keys(shape)` still contains a key the
 *     spec rejects BY NAME, and the two directions then fail opposite ways —
 *     forward reads the tombstone as "accepted" and goes falsely GREEN, reverse
 *     reads it as "declared" and would demand the block publish it, going
 *     falsely RED. Dormant today (zero tombstones in the pinned rc.5) and fixed
 *     in one place — narrowing `specTopLevelKeys` — for both directions at once:
 *     objectui#3809. Until then the reverse direction's exemptions for the
 *     `element:record_picker` trio are what absorb the red, and they say so.
 *
 * A pass means the top-level key names are in parity, nothing more.
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
 * Spec keys that no block is expected to publish, with the reason — applied to
 * every block rather than repeated as one exemption entry per block.
 *
 * Only `aria` qualifies, and only because the reason is genuinely uniform: it is
 * an accessibility escape hatch, not a layout choice, and the blocks that omit
 * it say so in the same words at their registration sites
 * (`plugin-detail/src/index.tsx:335-337`, verbatim: "`aria` is omitted for the
 * same reason it is omitted on `record:details` above"). Publishing it would put
 * an `aria` object in every designer panel and every generated `.d.ts` as though
 * hand-writing ARIA were the normal way to configure a block, when the renderers
 * derive their accessible names from labels and object metadata. A key whose
 * reason is per-block belongs in `UNPUBLISHED_EXEMPTIONS` below, not here.
 */
const GLOBALLY_UNPUBLISHED_SPEC_KEYS: Record<string, string> = {
  aria: 'Accessibility escape hatch, not a layout choice — renderers derive accessible names from labels and object metadata, and every block omits it for this one reason (plugin-detail/src/index.tsx:335-337). objectui#3808.',
};

/**
 * Top-level keys this block's spec props schema declares that its `inputs` do
 * not publish — the reverse direction (objectui#3808).
 */
function undiscoverableSpecKeys(type: string): string[] {
  const declared = new Set(declaredInputs(type) ?? []);
  return specTopLevelKeys(type).filter(
    (key) => !declared.has(key) && !(key in GLOBALLY_UNPUBLISHED_SPEC_KEYS),
  );
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
  'page:footer',
  'page:header',
  'page:section',
  'page:sidebar',
  'page:tabs',
  'record:activity',
  'record:chatter',
  'record:details',
  'record:highlights',
  'record:path',
  'record:related_list',
];

/**
 * Registered, spec-carried, and deliberately propless. `nav:*` / `global:search`
 * genuinely take no props; `element:image` / `element:metadata_viewer` /
 * `element:divider` / `ai:suggestion` are registered without an `inputs` list.
 * Either way there is no declaration for this gate to judge — but a block moving
 * OUT of `EXPECTED_COVERED` into here is an authoring surface that vanished, so
 * the list is pinned rather than derived-and-ignored.
 *
 * `page:footer` / `page:section` / `page:sidebar` LEFT this list in objectui#4027
 * and are now in `EXPECTED_COVERED`. They were the "`EmptyProps` blocks that
 * genuinely take no props" this comment used to name — a reading the pinned
 * rc.5 still supports and the contract no longer does: objectstack#5775
 * (PR objectstack#6281) replaced their `EmptyProps` entries with the shared
 * `PageContainerProps`, whose one key is the `children` all three renderers have
 * always rendered. Their `children` inputs are flagged by the forward direction
 * below purely as a stale-pin artifact.
 */
const EXPECTED_WITHOUT_INPUTS = [
  'ai:suggestion',
  'element:divider',
  'element:image',
  'element:metadata_viewer',
  'global:search',
  'nav:breadcrumb',
  'nav:menu',
];

/*
 * `SPEC_SHAPE_EMPTY_ON_THE_PIN` — DELETED on the @objectstack/spec 17.0.0-rc.6
 * bump (objectstack#7100), exactly as it was designed to be.
 *
 * It carved `page:footer` / `page:section` / `page:sidebar` out of the
 * non-empty probe guard because rc.5 still mapped all three to `EmptyProps`,
 * so their shapes resolved to `{}` for a real reason rather than a broken
 * reader (objectui#4027). objectstack#5775 / PR objectstack#6281 replaced that
 * with the shared `PageContainerProps` upstream, and rc.6 is where this repo
 * resolves it: `children` now appears in each of the three shapes.
 *
 * The list was self-clearing by construction, and its companion test — `the
 * empty-shape carve-out still describes an empty shape` — is what fired,
 * carrying its own instruction ("delete it from SPEC_SHAPE_EMPTY_ON_THE_PIN").
 * Both the list and that test are gone; the plain non-empty guard now covers
 * all three again, which is the state the carve-out was always temporary
 * against.
 */

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

  // ── page container `children` — ALREADY settled upstream, stale pin only ───
  // The other half of the same upstream issue as the record_picker trio above,
  // and the same stale-pin shape (objectui#4027). objectstack#5775
  // (PR objectstack#6281, merged 2026-08-07) declared `PageCardProps.children`
  // as the canonical composition slot — retiring `body`, its second spelling —
  // and gave `page:section` / `page:footer` / `page:sidebar` the shared
  // `PageContainerProps`, whose one key is `children`, replacing the
  // `EmptyProps` that had declared "zero props" for three components whose only
  // job is to render a child list. Verified in that PR's merged diff
  // (`packages/spec/src/ui/component.zod.ts`, `PageContainerProps` + the
  // `ComponentPropsMap` entries), not from the issue's wording.
  //
  // The pinned `@objectstack/spec@17.0.0-rc.5` predates all of it: its
  // `PageCardProps` still lists `body` and no `children`, and the three thin
  // containers are still `EmptyProps` — so this gate reads four correct,
  // contract-following declarations as off-spec. Nothing to do in either repo;
  // the `no stale exemption` test below deletes these four for us, loudly, the
  // moment the pin moves.
  //
  // Nothing about `children` moves a validation verdict either way, which is
  // why publishing it ahead of the pin is safe: `validate.ts` lists `children`
  // in `BASE_PROPS` (never an `unknown-prop`), and `codegen.ts:emitInterface`
  // filters `slot` inputs out of the generated `.d.ts`, where
  // `SduiBaseProps.children` already types it. The designer panel is the only
  // surface that changes.
  'page:card.children':
    'Already declared upstream by objectstack#5775 / PR objectstack#6281 as the canonical card content slot (replacing the retired `body`); flagged only because the pinned @objectstack/spec@17.0.0-rc.5 predates it. objectui#4027. Delete this entry when the pin moves.',
  'page:section.children':
    'Already declared upstream by objectstack#5775 / PR objectstack#6281 via the shared `PageContainerProps` (this renderer has always rendered `schema.children`); flagged only because the pinned @objectstack/spec@17.0.0-rc.5 still maps this block to `EmptyProps`. objectui#4027. Delete this entry when the pin moves.',
  'page:footer.children':
    'Already declared upstream by objectstack#5775 / PR objectstack#6281 via the shared `PageContainerProps` (this renderer has always rendered `schema.children`); flagged only because the pinned @objectstack/spec@17.0.0-rc.5 still maps this block to `EmptyProps`. objectui#4027. Delete this entry when the pin moves.',
  'page:sidebar.children':
    'Already declared upstream by objectstack#5775 / PR objectstack#6281 via the shared `PageContainerProps` (this renderer has always rendered `schema.children`); flagged only because the pinned @objectstack/spec@17.0.0-rc.5 still maps this block to `EmptyProps`. objectui#4027. Delete this entry when the pin moves.',
};

/**
 * Spec-declared top-level keys deliberately NOT published, each with the reason.
 * Key format: `BLOCK.KEY`. The reverse direction's half of the same discipline
 * as `OFF_SPEC_EXEMPTIONS` above: explicit, reasoned, issue-backed, and deleted
 * by a failing test once it stops describing anything.
 *
 * The bar for an entry is NOT "we haven't got round to it". A spec key the
 * renderer HONOURS and `inputs` omits is a plain defect and gets declared —
 * that is what objectui#3808 did to `record:details.hideFields`,
 * `record:related_list.relationshipValueField`, `record:related_list.add` and
 * `element:text_input.defaultValue`. The bar is that publishing the key would
 * itself be wrong or premature, and WHICH of those it is has to be named:
 *
 *   - the renderer does not read it, so publishing it would advertise
 *     configuration the platform silently drops (the objectui#3797 direction, in
 *     reverse) — the choice between wiring it and declaring it with a KNOWN GAP
 *     is a contract decision, not an implementation detail;
 *   - the spec rejects it by name upstream already and only a stale pin still
 *     lists it;
 *   - the key is out of the dispatched scope of the change that added this gate,
 *     and its own issue owns it.
 *
 * Every reason cites an issue, which `references a tracking issue` asserts.
 * Verified against renderer read sites at objectui `origin/main` @ `c85268256`
 * with `@objectstack/spec@17.0.0-rc.5` — not assumed from the spec's wording.
 */
const UNPUBLISHED_EXEMPTIONS: Record<string, string> = {
  // ── B class — spec declares it, NO renderer read point at all (2 keys) ─────
  // The instinct here is to add an input, and it is wrong: that publishes a key
  // the platform drops on the floor, which is exactly the defect objectui#3797
  // spent a repo-wide gate closing. The other instinct — wire it — is a visual
  // decision (where an icon sits next to RecordTitleChip; whether a card grows
  // an actions area, which reaches into `renderers/action/**`). The third option
  // is the `record:activity.showSubscriptionToggle` precedent: declare it and
  // say NOT IMPLEMENTED in the description, so both directions are in parity and
  // the author is told. Three viable shapes, one public contract — filed as
  // objectui#3829 rather than guessed at here.
  'page:header.icon':
    'Spec declares it; PageHeaderRenderer has NO read point — `icon` in containers.tsx:822-1570 is only ever per-action (`action.icon`, :1321/:1365) or a nav item (:604). Wire it, or declare it with a KNOWN GAP per the showSubscriptionToggle precedent: objectui#3829.',
  'page:card.actions':
    'Spec declares it; PageCardRenderer (containers.tsx:666-695) renders title/body/footer only and never reads `actions`. Wire it, or declare it with a KNOWN GAP per the showSubscriptionToggle precedent: objectui#3829.',

  // ── page:tabs.type — the carrier collision, from the other side ────────────
  // The mirror image of the `page:tabs.tabStyle` exemption in
  // `OFF_SPEC_EXEMPTIONS` above, and the same single fact seen twice: the spec
  // spells this concept `type`, the flat SDUI carrier cannot express it (a flat
  // node is `{ type: 'page:tabs', … }` where `type` is the dispatch tag, and
  // `SchemaRenderer.tsx:251-270` deliberately refuses to hoist
  // `properties.type`), and `validate.ts` lists `'type'` in `BASE_PROPS` so it
  // is skipped as a base prop and could not be validated as an input even if
  // declared. Publishing it would advertise a key this repo's own parser cannot
  // check, on a spelling the carrier cannot carry. Convergence is upstream.
  'page:tabs.type':
    "Spec's spelling of the tabStyle concept; unpublishable in the flat carrier (`type` is the dispatch key, SchemaRenderer.tsx:251-270) and unvalidatable as an input (validate.ts BASE_PROPS). The renderer does read it when it survives as `properties.type` (containers.tsx:381). Upstream contract decision: objectstack#6776.",

  // ── element:record_picker — retired upstream, stale pin only (3 keys) ──────
  // objectstack#5775 (ADR-0087 D2) turned these three into `retiredKey()`
  // tombstones, converging on the `labelField` / `valueField` this renderer
  // actually reads (`renderers/basic/record-picker.tsx:80-81`). Declaring a key
  // the spec has retired is the objectui#3797 direction again.
  //
  // TWO THINGS THE PIN BUMP WILL DO HERE, and objectui#3808 got the first of
  // them wrong, so it is written out:
  //   1. these three do NOT vanish from `Object.keys(shape)`. ADR-0087 D2
  //      retirement REPLACES the entry with `z.never().optional()`, it does not
  //      delete it — so they stay "declared" to this gate and these exemptions
  //      stay live rather than going stale. They resolve when objectui#3809's
  //      tombstone recognition narrows `specTopLevelKeys`, not when the pin
  //      moves;
  //   2. `sort` / `limit` / `emptyText` — which #5775 ADDS and this renderer
  //      already reads (`record-picker.tsx:79/80` and `:170`) — become brand-new
  //      A-class gaps, and this gate will go RED demanding them. That red is
  //      correct and wanted: it is the pin bump's own reminder to declare them,
  //      the way `record:details.hideFields` was declared here.
  'element:record_picker.displayField':
    'Retired upstream by objectstack#5775 (ADR-0087 D2 tombstone, converging on the `labelField` this renderer reads); declaring it would publish a key the spec rejects by name. Listed here only because the pinned @objectstack/spec@17.0.0-rc.5 predates the retirement. Resolves via objectui#3809, not via the pin bump.',
  'element:record_picker.searchFields':
    'Retired upstream by objectstack#5775 (ADR-0087 D2 tombstone); declaring it would publish a key the spec rejects by name. Listed here only because the pinned @objectstack/spec@17.0.0-rc.5 predates the retirement. Resolves via objectui#3809, not via the pin bump.',
  'element:record_picker.multiple':
    'Retired upstream by objectstack#5775 (ADR-0087 D2 tombstone); declaring it would publish a key the spec rejects by name. Listed here only because the pinned @objectstack/spec@17.0.0-rc.5 predates the retirement. Resolves via objectui#3809, not via the pin bump.',

  // ── page:card.body — retired upstream, stale pin only (1 key) ─────────────
  // The fourth ADR-0087 D2 tombstone from the same upstream issue as the three
  // above, and it withdraws here for the same reason: objectstack#5775
  // (PR objectstack#6281) replaced `PageCardProps.body` with `children`, the
  // spelling every other container uses and the one this renderer reads
  // (`containers.tsx`, `schema?.body ?? schema?.children`). Continuing to
  // publish `body` was objectui#4027 — a designer teaching a key the contract
  // rejects by name.
  //
  // The renderer's `body` READ deliberately survives the declaration's removal:
  // documents stored under the old contract keep rendering until the ADR-0087 D2
  // conversion rewrites the key at load time. A back-compat read is not an
  // authoring surface, so it does not belong in `inputs` — the same split the
  // `page-header-subtitle-alias` sequencing already established in
  // `packages/layout`.
  //
  // Like the record_picker trio, this entry does NOT go stale when the pin
  // moves: D2 retirement replaces the entry with `z.never().optional()` rather
  // than deleting it, so `Object.keys(shape)` still reports `body` as declared.
  // It resolves when objectui#3809's tombstone recognition narrows
  // `specTopLevelKeys`.
  'page:card.body':
    'Retired upstream by objectstack#5775 / PR objectstack#6281 (ADR-0087 D2 tombstone, converging on the `children` this renderer reads and now publishes); declaring it would publish a key the spec rejects by name — objectui#4027. Listed here only because the pinned @objectstack/spec@17.0.0-rc.5 predates the retirement. Resolves via objectui#3809, not via the pin bump.',

  // `element:record_picker.filter` was the ninth entry here — a real A-class gap
  // that fell out of objectui#3808's three-class triage, exempted only because it
  // was outside that PR's dispatched scope. objectui#3830 declared the input, so
  // the entry stopped describing anything and `carries no stale unpublished-key
  // exemption` demanded its deletion. It is now pinned as DECLARED, by name,
  // alongside #3808's four at the bottom of this file.

  // ── targetVariable — the spec's own "declarative hint" (2 keys) ────────────
  // Zero read points repo-wide (`grep -rn targetVariable packages/ apps/` is
  // empty), and that is by design, not drift: the spec's describe says the live
  // binding resolves via the variable whose `source` equals the component id,
  // which is exactly what `usePageVariableBinding(schema?.id)` does
  // (`text-input.tsx:60`). So publishing it is neither a fix nor a defect — it
  // is a judgement about whether to publish an intent-only key, with a concrete
  // risk on the publish side (an author who writes only `targetVariable` and no
  // variable `source` gets an input that writes nowhere, silently).
  'element:text_input.targetVariable':
    "Spec's own declarative hint with zero read points repo-wide; the live binding is the reverse lookup in usePageVariableBinding(schema.id) (text-input.tsx:60). Whether to publish an intent-only key is an open judgement: objectui#3834.",
  'element:record_picker.targetVariable':
    "Spec's own declarative hint with zero read points repo-wide; the live binding is the reverse lookup by component id, as on element:text_input. Whether to publish an intent-only key is an open judgement: objectui#3834.",
};

const exemptedFor = (type: string): string[] =>
  Object.keys(OFF_SPEC_EXEMPTIONS)
    .filter((key) => key.startsWith(`${type}.`))
    .map((key) => key.slice(type.length + 1));

const unpublishedExemptedFor = (type: string): string[] =>
  Object.keys(UNPUBLISHED_EXEMPTIONS)
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

  it('the three former carve-out blocks now resolve a real shape', () => {
    // The tombstone of `SPEC_SHAPE_EMPTY_ON_THE_PIN` (see above). Keeping one
    // assertion on the three names is what stops the deletion being silently
    // undone by a future pin that regresses them to `EmptyProps` — the guard
    // above would then read as "the probe is broken" for all three at once,
    // which is the misdiagnosis objectui#4027 was filed about.
    for (const type of ['page:footer', 'page:section', 'page:sidebar']) {
      expect(covered, `${type} no longer declares inputs`).toContain(type);
      expect(specTopLevelKeys(type), `${type} regressed to an empty spec shape`).toContain('children');
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

  // ── the REVERSE direction (objectui#3808) ──────────────────────────────────
  //
  // Same `covered` set, same derived-not-restated expectations, same exemption
  // discipline — only the subtraction is turned round: spec keys minus declared
  // inputs, instead of declared inputs minus spec keys.

  it('every globally unpublished key is a real spec key on a covered block', () => {
    // Non-vacuity for the blanket exclusion. `aria` is subtracted from EVERY
    // block's expected surface, so a typo there (or the spec renaming the key)
    // would quietly stop excluding anything while still reading as a documented
    // decision — and, worse, would make the per-block assertion below start
    // demanding an `aria` input on fifteen blocks for a reason nobody wrote down.
    //
    // Non-empty FIRST: a `for` over an emptied map — and the reason check below —
    // both pass on nothing, so the map's own existence is the first assertion.
    expect(Object.keys(GLOBALLY_UNPUBLISHED_SPEC_KEYS).length).toBeGreaterThan(0);
    for (const key of Object.keys(GLOBALLY_UNPUBLISHED_SPEC_KEYS)) {
      const carriers = covered.filter((type) => specTopLevelKeys(type).includes(key));
      expect(carriers.length, `no covered block's spec declares "${key}"`).toBeGreaterThan(0);
    }
  });

  it('every globally unpublished key states a reason and references a tracking issue', () => {
    const unjustified = Object.entries(GLOBALLY_UNPUBLISHED_SPEC_KEYS)
      .filter(([, reason]) => !/#\d+/.test(reason))
      .map(([key]) => key);
    expect(unjustified).toEqual([]);
  });

  it.each(covered)('%s publishes every top-level key its spec props schema declares', (type) => {
    const exempt = new Set(unpublishedExemptedFor(type));
    const undiscoverable = undiscoverableSpecKeys(type).filter((key) => !exempt.has(key));
    expect(undiscoverable).toEqual([]);
  });

  it('every unpublished-key exemption names a key the spec really declares', () => {
    // The dangling check, in the reverse direction. Two ways to be wrong here,
    // and both read as deliberate cover while licensing nothing: a typo'd key,
    // and an entry for a block this gate does not judge.
    const dangling = Object.keys(UNPUBLISHED_EXEMPTIONS).filter((key) => {
      const dot = key.indexOf('.');
      const type = key.slice(0, dot);
      const specKey = key.slice(dot + 1);
      return !covered.includes(type) || !specTopLevelKeys(type).includes(specKey);
    });
    expect(dangling).toEqual([]);
  });

  it('every unpublished-key exemption states a reason and references a tracking issue', () => {
    // The discipline that separates "deliberately not published, and here is who
    // owns the decision" from "we forgot". Four of the nine entries once here
    // existed only because objectui#3829 / #3830 / #3834 were opened to own
    // them, and #3830's is already gone — declaring the input is what retires an
    // entry, which is the point of the stale check below.
    const unjustified = Object.entries(UNPUBLISHED_EXEMPTIONS)
      .filter(([, reason]) => !/#\d+/.test(reason))
      .map(([key]) => key);
    expect(unjustified).toEqual([]);
  });

  it('carries no stale unpublished-key exemption — a published key must lose its entry', () => {
    // Keeps the reverse list from rotting the same way. An entry goes stale when
    // the block declares the input (objectui#3829/#3830/#3834 landing) or when
    // the spec genuinely deletes the key — note that ADR-0087 D2 retirement is
    // NOT a deletion, so the `element:record_picker` trio does not go stale on
    // the pin bump; objectui#3809 is what resolves those.
    const stale = Object.keys(UNPUBLISHED_EXEMPTIONS).filter((key) => {
      const dot = key.indexOf('.');
      const type = key.slice(0, dot);
      const specKey = key.slice(dot + 1);
      return !undiscoverableSpecKeys(type).includes(specKey);
    });
    expect(stale).toEqual([]);
  });

  it('the five A-class keys objectui#3808 / #3830 declared are discoverable, block by block', () => {
    // Named, not just covered by the derived loop above. The derived assertion
    // would also pass if these five were added to `UNPUBLISHED_EXEMPTIONS`
    // instead of declared — which is precisely the move #3808 exists to rule
    // out — so the keys it fixed are pinned by name, and pinned as DECLARED
    // rather than merely "not failing".
    //
    // The fifth is objectui#3830's `element:record_picker.filter`, the A-class
    // key #3808's own triage dropped between its raw key dump and its three
    // lists. It is listed HERE, in the same place as the other four, because it
    // is the same fact about the same gate: the entry that used to exempt it
    // (deleted above) is not evidence of anything once the input exists, and a
    // future change that dropped the declaration and re-added the exemption
    // would restore the gap while leaving every derived assertion green.
    const fixed: Array<[string, string]> = [
      ['record:details', 'hideFields'],
      ['record:related_list', 'relationshipValueField'],
      ['record:related_list', 'add'],
      ['element:text_input', 'defaultValue'],
      ['element:record_picker', 'filter'],
    ];
    for (const [type, key] of fixed) {
      expect(specTopLevelKeys(type), `${type} spec no longer declares ${key}`).toContain(key);
      expect(declaredInputs(type) ?? [], `${type} does not publish ${key}`).toContain(key);
      expect(Object.keys(UNPUBLISHED_EXEMPTIONS)).not.toContain(`${type}.${key}`);
    }
  });
});
