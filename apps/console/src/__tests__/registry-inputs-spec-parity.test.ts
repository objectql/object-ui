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
 * The four `object-*` blocks `@objectstack/spec` 17.0.0 GA adds to
 * `ComponentPropsMap` and the pinned `17.0.0-rc.6` does not carry at all
 * (objectui#4648, measured on a GA-installed tree).
 *
 * This repo has registered all four with `inputs` since long before the spec
 * described them — `plugin-form/src/index.tsx:100` (`object-form`) and `:252`
 * (`object-master-detail-form`), `plugin-grid/src/index.tsx:129`
 * (`object-grid`), `plugin-dashboard/src/index.tsx:141` (`object-metric`) —
 * so what moves at the pin bump is the SPEC's side, not this repo's: they enter
 * `covered` the moment the installed spec carries them, and the reverse
 * direction then asks each of them for the keys it does not publish.
 */
const GA_ONLY_BLOCKS = [
  'object-form',
  'object-grid',
  'object-master-detail-form',
  'object-metric',
];

/**
 * Does the installed `@objectstack/spec` carry the GA element set?
 *
 * The spec ships no version constant, so the observable fact is used instead —
 * and it is the fact this file actually depends on. `every` rather than `some`
 * on purpose: the four arrived in one release, so a half-carried state is a
 * broken premise rather than a pin somewhere in between, and the assertion
 * below fails on it instead of silently expecting the wrong coverage set.
 */
const specCarriesGaBlocks = GA_ONLY_BLOCKS.every((type) => type in ComponentPropsMap);

/**
 * Blocks the spec has carried since before the GA line, all of them declared in
 * this repo. Exact rather than `toContain` for the reason
 * `public-contract.test.ts` gives: the dangerous direction is a SHRINKING
 * contract, which a containment assertion sails straight past.
 */
const PINNED_EXPECTED_COVERED = [
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
 * Every block with a spec entry AND a declared authoring surface, in sorted
 * order.
 *
 * Pin-dependent, and that is not a loosening: the expectation stays EXACT on
 * either pin, and which of the two it is gets asserted on its own below rather
 * than inferred. The alternative — hard-coding the GA four — would fail on
 * current `main`, and hard-coding only the eighteen fails the day the pin moves;
 * both readings are correct facts about different installed contracts.
 */
const EXPECTED_COVERED = [
  ...PINNED_EXPECTED_COVERED,
  ...(specCarriesGaBlocks ? GA_ONLY_BLOCKS : []),
].sort();

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
 * ## EMPTY as of @objectstack/spec 17.0.0-rc.6 (objectui#4167)
 *
 * All twelve entries were deleted on the rc.6 bump, by the `carries no stale
 * exemption` test below, which named every one of them at once. Emptying it is
 * the discipline working end to end rather than an absence of divergence: each
 * entry cited the upstream issue that owned it, and rc.6 is where both of those
 * issues landed. Verified per key against the resolved
 * `ComponentPropsMap[type].shape` at this pin, not from the issues' wording:
 *
 *  - **objectstack#6776** — `page:header` now declares `recordChrome`,
 *    `showStar` and `showCopyId`; `page:accordion` declares `variant`;
 *    `page:tabs` declares `tabStyle`. The five keys the renderer had read all
 *    along are contract now. `page:tabs` is the interesting one: the spec
 *    declares BOTH `tabStyle` and `type`, so the carrier collision written up in
 *    the deleted entry was resolved upstream by declaring the alias rather than
 *    by renaming — which is why `page:tabs.type` stays in
 *    `UNPUBLISHED_EXEMPTIONS` below (spec-declared, unpublishable in a flat
 *    carrier) while `tabStyle` needs no cover at all.
 *  - **objectstack#5775 / PR objectstack#6281** — `element:record_picker`
 *    declares `labelField`, `valueField` and `label`; `page:card` declares
 *    `children` (replacing the retired `body`); and `page:section` /
 *    `page:footer` / `page:sidebar` carry the shared `PageContainerProps`, whose
 *    one key is `children`. Those seven were the objectui#4027 stale-pin set,
 *    predicted in their own reasons ("Delete this entry when the pin moves") and
 *    deleted exactly there.
 *
 * The map stays declared rather than removed: a future divergence needs
 * somewhere to be registered, and `exemptedFor` below reads it. Empty is a
 * state, not a deletion — every forward-direction assertion now runs with no
 * cover of any kind, which is the strongest reading this gate has ever had.
 */
const OFF_SPEC_EXEMPTIONS: Record<string, string> = {};

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
 * Verified against renderer read sites at objectui `origin/main` @ `c25222758`
 * with `@objectstack/spec@17.0.0-rc.6` — not assumed from the spec's wording.
 * (The four `…-rc.5` mentions left in the entries below are the stale-pin
 * entries' own prose and belong to their issues, not to this header.)
 */
const UNPUBLISHED_EXEMPTIONS: Record<string, string> = {
  // ── page:header.icon / page:card.actions — retired upstream (2 keys) ───────
  // These two used to be a MENU: objectui#3829 filed them as a three-way fork
  // (wire them; declare them with a KNOWN GAP per the
  // `record:activity.showSubscriptionToggle` precedent; retire them upstream)
  // and this entry listed all three so no implementing agent would guess. The
  // fork is closed. The maintainer ruled route (c) on 2026-08-09 —
  // zero producers, zero consumers, zero demand — and objectstack#6946 /
  // PR objectstack#7115 executed it: both keys are ADR-0087 D2 tombstones in
  // `@objectstack/spec` 17.0.0, live on the rc.6 this repo installs. So the
  // class here is no longer B (undecided) but the same one as
  // `record:details.layout` below: the spec rejects the key BY NAME, and the
  // reverse direction demands it anyway because the tombstone is still a member
  // of the shape.
  //
  // Read the upstream prescriptions before touching either key — they say what
  // replaces it, which is why neither is coming back. A header's identity is
  // drawn by the record chrome (`recordChrome`, on by default) plus each
  // action's own `icon`; a card's buttons are authored as components in
  // `children` or `footer` (`element:button`, `record:quick_actions`).
  //
  // DO NOT DELETE THESE TWO ENTRIES YET, and the reason is the one this file
  // already writes out twice above: D2 retirement REPLACES the member with
  // `z.never()` rather than deleting it, so `Object.keys(shape)` still reports
  // both keys as declared and `carries no stale unpublished-key exemption`
  // still needs the cover. They resolve when objectui#3809's tombstone
  // recognition narrows `specTopLevelKeys` — not on a pin bump, and not by
  // declaring the inputs.
  //
  // The objectui half of route (c) is otherwise complete (objectui#3829).
  // `page:card.actions` had no producer at all; `page:header.icon` had exactly
  // one — the metadata-admin designer's BLOCK_CONFIG field for the CANONICAL
  // `page:header`, which kept offering authors an icon box whose value rc.6
  // rejects by name — and it was removed with its two i18n keys in the same
  // change that rewrote these entries. The `layout:page-header` ALIAS keeps its
  // `icon` input deliberately: that is a different renderer with a real read
  // point (`packages/layout/src/PageHeader.tsx`), so the two are opposite facts,
  // not an inconsistency.
  'page:header.icon':
    'Retired upstream by objectstack#6946 / PR objectstack#7115 (ADR-0087 D2 tombstone) — PageHeaderRenderer never had a read point: `icon` inside containers.tsx:973-1677 is only ever per-action (`action.icon`, :1428/:1472) or a nav item (:641/:816), and the spec now rejects the key by name, prescribing the record chrome plus per-action icons instead. Unlike the stale-pin entries below this one is LIVE at @objectstack/spec@17.0.0-rc.6: the tombstone stays in `Object.keys(shape)`, so the reverse direction demands a key the contract refuses. Resolves via objectui#3809 tombstone recognition, not by declaring the input — objectui#3829.',
  'page:card.actions':
    'Retired upstream by objectstack#6946 / PR objectstack#7115 (ADR-0087 D2 tombstone) — PageCardRenderer (containers.tsx:703-745) builds its card from title/body/children/footer and never had an actions area, and the spec now rejects the key by name, prescribing buttons authored as components in `children` or `footer` (`element:button`, `record:quick_actions`). Unlike the stale-pin entries below this one is LIVE at @objectstack/spec@17.0.0-rc.6: the tombstone stays in `Object.keys(shape)`, so the reverse direction demands a key the contract refuses. Resolves via objectui#3809 tombstone recognition, not by declaring the input — objectui#3829.',

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

  // ── record:details.layout — retired upstream AND withdrawn here (1 key) ───
  // The fifth D2 tombstone, and the first one whose objectui half has actually
  // landed — so it is here for a DIFFERENT reason than the four above, and the
  // difference is worth reading before treating it as more of the same.
  //
  // Those four are stale-pin cover: the key is still published in this repo and
  // the entry says "the pin predates the retirement". This one is the opposite.
  // objectui#3818 DELETED the `record:details` `layout` input (the spec's
  // `auto` | `custom` semantics were never implemented — the renderer's only
  // read tested `inline` | `compact`, values the schema never permitted, so both
  // legal values took the same branch and the key selected nothing), which is
  // exactly what this gate's forward direction wants. The entry exists because
  // the REVERSE direction then demands the key back: `specTopLevelKeys` reads
  // raw `Object.keys(shape)`, the ADR-0087 D2 tombstone is still an entry in
  // that shape, and so a key the spec rejects by name reads as "declared, and
  // you failed to publish it".
  //
  // That is objectui#3809's blind spot seen from the other side — it predicted a
  // false GREEN in the forward direction, and this is the same root cause
  // producing a false RED in the reverse one. Both vanish together when #3809
  // narrows `specTopLevelKeys` to non-tombstone members; this entry then goes
  // stale and `carries no stale unpublished-key exemption` will name it, along
  // with the four above. Do not resolve it by re-adding the input.
  'record:details.layout':
    'Retired upstream by objectstack#6946 (ADR-0087 D2 tombstone) and withdrawn here by objectui#3818 — its published `auto` | `custom` semantics were never implemented, and the spec now rejects the key by name, so publishing it again would teach a key the contract refuses. Unlike the stale-pin entries above this one is live at @objectstack/spec@17.0.0-rc.6: the tombstone stays in `Object.keys(shape)`, so the reverse direction demands a key the forward direction forbids. Resolves via objectui#3809 tombstone recognition, not by declaring the input.',

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

  // ── GA-added keys the renderers already honour — held by the PIN (5 keys) ──
  // A different class from every entry above, and the difference is the whole
  // reason they are here rather than declared: publishing them is the RIGHT
  // answer and this file's own bar says so ("a spec key the renderer HONOURS
  // and `inputs` omits is a plain defect and gets declared"). What blocks it is
  // the installed contract, not a judgement.
  //
  // @objectstack/spec 17.0.0 GA declares all five; the pinned 17.0.0-rc.6
  // declares none of them. Declaring the inputs today would therefore fail the
  // FORWARD direction of this very file on the pinned spec — and a forward
  // exemption to cover THAT would go stale, and red, the moment the pin moves.
  // The two clauses collide and "must stay green on current main" wins, the
  // same resolution PR objectui#4660 recorded for `SECRET_MASK`.
  //
  // So these five are dormant on this pin and fully judged on a GA tree (see
  // `GA_PENDING_UNPUBLISHED_KEYS`), and objectui#4668 owns declaring them once
  // objectui#4636 / PR objectui#4639 lands the GA pin. Each dies the moment its
  // input exists — `carries no stale unpublished-key exemption` is what kills
  // it, exactly as it killed `element:record_picker.filter` when #3830 declared
  // that one.
  'page:header.maxVisible':
    'GA declares it and PageHeaderRenderer HONOURS it already — containers.tsx:1360, `readMax(schema?.maxVisible ?? schema?.properties?.maxVisible) ?? 3`, the desktop inline/overflow action budget. Not published only because the pinned @objectstack/spec@17.0.0-rc.6 does not declare it, so the input would fail this file\'s forward direction today. Declared by objectui#4668 on the GA pin (objectui#4636 / PR #4639); dormant on this pin, dies when the input lands.',
  'page:header.mobileMaxVisible':
    'GA declares it and PageHeaderRenderer HONOURS it already — containers.tsx:1359, the mobile half of the same overflow budget (`?? 1`). Not published only because the pinned @objectstack/spec@17.0.0-rc.6 does not declare it. Declared by objectui#4668 on the GA pin (objectui#4636 / PR #4639); dormant on this pin, dies when the input lands.',
  'page:tabs.alwaysShowStrip':
    'GA declares it and PageTabsRenderer HONOURS it already — containers.tsx:637, `itemsWithValue.length > 1 || schema?.properties?.alwaysShowStrip === true` keeps the strip visible for a single tab. Not published only because the pinned @objectstack/spec@17.0.0-rc.6 does not declare it. Declared by objectui#4668 on the GA pin (objectui#4636 / PR #4639); dormant on this pin, dies when the input lands.',
  'record:details.inlineEdit':
    'GA declares it and RecordDetailsRenderer HONOURS it already — renderers/record-details.tsx:234, `(schema.inlineEdit ?? true) && objectInlineEditable` gates the inline-edit affordance. Not published only because the pinned @objectstack/spec@17.0.0-rc.6 does not declare it. Declared by objectui#4668 on the GA pin (objectui#4636 / PR #4639); dormant on this pin, dies when the input lands.',
  'record:details.showHeader':
    'GA declares it and RecordDetailsRenderer HONOURS it already — renderers/record-details.tsx:257, `showHeader: schema.showHeader ?? false` reaches DetailView, which reads it at DetailView.tsx:909/:1183. Not published only because the pinned @objectstack/spec@17.0.0-rc.6 does not declare it. Declared by objectui#4668 on the GA pin (objectui#4636 / PR #4639); dormant on this pin, dies when the input lands.',
};

/**
 * Exemption entries whose KEY the installed spec is allowed not to declare yet.
 *
 * Every other entry in `UNPUBLISHED_EXEMPTIONS` describes a key the installed
 * spec declares right now — that is what `every unpublished-key exemption names
 * a key the spec really declares` asserts, and it is why a typo cannot hide in
 * the list. These five describe keys only @objectstack/spec 17.0.0 GA has, so
 * on the pinned 17.0.0-rc.6 they describe nothing yet.
 *
 * Pinning them as a SET rather than skipping "any entry the spec does not
 * declare" is the whole safety of the mechanism: only these five may be
 * dormant, and `every GA-pending exemption arms exactly with the installed
 * spec` asserts that their dormancy tracks the installed element set in BOTH
 * directions — so a GA release that dropped one of them fails here instead of
 * leaving an entry that quietly covers nothing.
 */
const GA_PENDING_UNPUBLISHED_KEYS = [
  'page:header.maxVisible',
  'page:header.mobileMaxVisible',
  'page:tabs.alwaysShowStrip',
  'record:details.inlineEdit',
  'record:details.showHeader',
];

/** Split a `BLOCK.KEY` exemption id into its two halves. */
const splitExemptionKey = (exemptionKey: string): [string, string] => {
  const dot = exemptionKey.indexOf('.');
  return [exemptionKey.slice(0, dot), exemptionKey.slice(dot + 1)];
};

/**
 * Is this a GA-pending entry the installed spec does not carry? Such an entry
 * is judged by neither the dangling nor the stale check — both of those ask
 * questions about a key that does not exist on this pin.
 */
const isDormantOnThisPin = (exemptionKey: string): boolean => {
  if (!GA_PENDING_UNPUBLISHED_KEYS.includes(exemptionKey)) return false;
  const [type, specKey] = splitExemptionKey(exemptionKey);
  return !specTopLevelKeys(type).includes(specKey);
};

/*
 * THE FOUR GA BLOCKS HAVE NO ENTRIES HERE, DELIBERATELY — objectui#4648.
 *
 * On a GA tree `object-form` / `object-grid` / `object-master-detail-form` /
 * `object-metric` enter `covered` (see `GA_ONLY_BLOCKS`) and the reverse
 * direction goes RED on 78 spec keys their `inputs` do not publish. That red is
 * unresolved on purpose: the card's ruling chose reasoned exemptions on the
 * premise that nothing in this repo reads those keys, and the implementation
 * measurement contradicted the premise — all 78 are honoured today, either off
 * `schema.*` in the renderer or through `SchemaRenderer`'s rest-prop spread
 * onto components whose props declare them one for one (`ObjectGridSchema` in
 * `@object-ui/types`, `ObjectMetricWidget`'s props, the form renderers').
 *
 * Under this file's stated bar that makes them A-class defects to DECLARE, not
 * keys to exempt — so writing the exemptions would have required rewriting the
 * bar as well as acting on a falsified premise. Both are the maintainer's call
 * and neither is silent: the measurement went back to objectui#4648 as a fork
 * report. Add nothing here until that card rules again.
 */

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
    //
    // GA-pending entries are excluded only while the installed spec really does
    // not carry their key — the set of entries allowed to be dormant is pinned,
    // and the assertion below judges the dormancy itself.
    const dangling = Object.keys(UNPUBLISHED_EXEMPTIONS)
      .filter((key) => !isDormantOnThisPin(key))
      .filter((key) => {
        const [type, specKey] = splitExemptionKey(key);
        return !covered.includes(type) || !specTopLevelKeys(type).includes(specKey);
      });
    expect(dangling).toEqual([]);
  });

  it('every GA-pending exemption arms exactly with the installed spec, all five together', () => {
    // The non-vacuity and self-arming half of `GA_PENDING_UNPUBLISHED_KEYS`.
    // Without it the pinned set could name keys no entry covers (licensing
    // nothing while reading as cover) or stay dormant forever on a GA tree that
    // dropped one of the keys — the two ways a "pending" mechanism rots.
    expect(GA_PENDING_UNPUBLISHED_KEYS.length).toBeGreaterThan(0);
    for (const key of GA_PENDING_UNPUBLISHED_KEYS) {
      expect(
        Object.keys(UNPUBLISHED_EXEMPTIONS),
        `${key} is pinned as GA-pending but has no exemption entry`,
      ).toContain(key);
      // Dormant exactly when the installed spec predates the GA element set,
      // live exactly when it carries it. An equality, not an implication, so
      // both regressions fail: a key GA dropped, and a key rc.6 somehow has.
      expect(
        isDormantOnThisPin(key),
        `${key} dormancy disagrees with the installed spec's element set`,
      ).toBe(!specCarriesGaBlocks);
    }
  });

  it('the four GA blocks enter coverage exactly when the installed spec carries them', () => {
    // The pin-dependence of `EXPECTED_COVERED`, asserted rather than assumed.
    // The registration half is pin-INDEPENDENT and checked first: all four are
    // registered with inputs by this repo on either pin, so a block dropping
    // out of `covered` can only ever mean the spec stopped carrying it — never
    // that a plugin quietly stopped registering an authoring surface.
    for (const type of GA_ONLY_BLOCKS) {
      expect(
        (declaredInputs(type) ?? []).length,
        `${type} is no longer registered with inputs in this repo`,
      ).toBeGreaterThan(0);
      expect(
        covered.includes(type),
        `${type} coverage disagrees with the installed spec`,
      ).toBe(type in ComponentPropsMap);
    }
    // Half-carried is a broken premise, not an in-between pin: they shipped in
    // one release, so `specCarriesGaBlocks` may not be a partial truth.
    const carried = GA_ONLY_BLOCKS.filter((type) => type in ComponentPropsMap);
    expect([0, GA_ONLY_BLOCKS.length]).toContain(carried.length);
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
    const stale = Object.keys(UNPUBLISHED_EXEMPTIONS)
      .filter((key) => !isDormantOnThisPin(key))
      .filter((key) => {
        const [type, specKey] = splitExemptionKey(key);
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

  it('the three keys the rc.6 bump added to element:record_picker are discoverable', () => {
    // objectui#4167, and pinned by name for exactly the reason the five above
    // are: the derived reverse-direction assertion would go green just as
    // readily if these three were added to `UNPUBLISHED_EXEMPTIONS` instead of
    // declared, and "exempt it" is the cheaper move under time pressure. The
    // exemption that covered the retired `displayField` / `searchFields` /
    // `multiple` trio predicted this red in writing and called it "correct and
    // wanted"; this is what banking that prediction looks like.
    //
    // The first assertion is not redundant with the second. It is the
    // non-vacuity half: if a later pin dropped these from
    // `ElementRecordPickerProps`, `undiscoverableSpecKeys` would stop naming
    // them and every derived assertion would pass while the inputs sat there
    // publishing keys the contract no longer has.
    for (const key of ['sort', 'limit', 'emptyText']) {
      expect(
        specTopLevelKeys('element:record_picker'),
        `spec no longer declares element:record_picker.${key}`,
      ).toContain(key);
      expect(
        declaredInputs('element:record_picker') ?? [],
        `element:record_picker does not publish ${key}`,
      ).toContain(key);
      expect(Object.keys(UNPUBLISHED_EXEMPTIONS)).not.toContain(`element:record_picker.${key}`);
    }
  });

  it('the twelve rc.6-obsoleted off-spec exemptions are gone, and their keys are contract now', () => {
    // The tombstone for the emptied `OFF_SPEC_EXEMPTIONS` (see its comment).
    // Without this, "the list is empty" and "the list was accidentally deleted
    // along with the divergences it covered" look identical, and every forward
    // assertion passes either way — the same misdiagnosis objectui#4027 records
    // for the `SPEC_SHAPE_EMPTY_ON_THE_PIN` carve-out, which is why that one
    // also left an assertion behind rather than just a comment.
    //
    // Asserted as "the spec declares it AND the block publishes it", not merely
    // "no longer exempted": these twelve keys were author-reachable
    // configuration the renderers had always honoured, so a pin that regressed
    // any of them must fail here loudly rather than quietly re-open an
    // exemption-shaped hole.
    const settledUpstream: Array<[string, string]> = [
      ['page:header', 'recordChrome'],
      ['page:header', 'showStar'],
      ['page:header', 'showCopyId'],
      ['page:accordion', 'variant'],
      ['page:tabs', 'tabStyle'],
      ['element:record_picker', 'labelField'],
      ['element:record_picker', 'valueField'],
      ['element:record_picker', 'label'],
      ['page:card', 'children'],
      ['page:section', 'children'],
      ['page:footer', 'children'],
      ['page:sidebar', 'children'],
    ];
    for (const [type, key] of settledUpstream) {
      expect(specTopLevelKeys(type), `${type} spec no longer declares ${key}`).toContain(key);
      expect(declaredInputs(type) ?? [], `${type} stopped publishing ${key}`).toContain(key);
      expect(Object.keys(OFF_SPEC_EXEMPTIONS)).not.toContain(`${type}.${key}`);
    }
    expect(Object.keys(OFF_SPEC_EXEMPTIONS)).toEqual([]);
  });
});
