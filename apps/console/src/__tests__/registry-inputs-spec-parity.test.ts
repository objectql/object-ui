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
 * KEY NAMES and nothing else. Two things it therefore cannot see, both real and
 * both filed:
 *
 *   - member shapes. An `inputs` entry of type `array`/`object` declares no
 *     member shape (`ComponentInput` has no slot for one), so a drifted key
 *     INSIDE an array element or nested object is invisible here — which is why
 *     `record:details.sections`, `record:highlights.fields` and
 *     `record:related_list.add` publish their members in prose and are pinned by
 *     per-block tests next to their renderers. PR #3795's open question;
 *   - types. This gate compares key NAMES only, so a key can be in perfect name
 *     parity while publishing a type the contract does not match — narrower, or
 *     (since objectui#3832 gave `ComponentInput.type` the array form) wider by an
 *     arm the spec rejects. The expressiveness half of that gap is closed: a
 *     union key can now declare its real arms, and the five specimens do. The
 *     COMPARISON half is not, and is nobody's check yet — each of those five is
 *     pinned against the spec's verdicts by a per-block test next to its
 *     renderer, which is per-block discipline, not a gate.
 *
 * A pass means the top-level key names are in parity, nothing more.
 *
 * `retiredKey()` TOMBSTONES USED TO BE THE THIRD — CLOSED, objectui#3809.
 * ADR-0087 D2 retirement replaces a member with `z.never().optional()` instead
 * of deleting it, so raw `Object.keys(shape)` reported a key the spec rejects BY
 * NAME as though the contract accepted it. Both directions read that one set,
 * and they failed OPPOSITE ways on it: forward went falsely GREEN on a block
 * publishing a retired key, reverse went falsely RED demanding that a block
 * publish one. `specTopLevelKeys` now subtracts tombstones, which is the single
 * point that fixes both, and the derivation's own premise — that a retirement
 * KEEPS the member — is asserted rather than assumed (`the tombstone premise
 * still holds`), so the day upstream starts deleting keys outright this filter
 * is judged dead code instead of silently narrowing nothing.
 *
 * The blind spot was NOT dormant by the time it was fixed, which is worth
 * recording because the issue was filed believing it was. It was written against
 * `@objectstack/spec@17.0.0-rc.5`, where `ComponentPropsMap` carried no
 * tombstone at all; the rc.6 pin (objectui#4167) brought EIGHT, the 17.0.0 GA
 * pin (objectui#4636 / PR objectui#4639) carries the same eight, and the reverse
 * direction's red was live from rc.6 onward — absorbed, key by key, by the eight
 * `UNPUBLISHED_EXEMPTIONS` entries that named this issue as the only thing that
 * could resolve them. Those eight are deleted with this change; the pin below
 * (`the eight tombstoned keys are recognised, not exempted`) is what keeps their
 * deletion from being quietly undone by re-exempting a key instead.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { ComponentPropsMap } from '@objectstack/spec/ui';
import {
  authorableShapeKeys,
  isShapeKeyTombstoned,
  listedShapeKeys,
  tombstonedShapeKeys,
} from '@object-ui/test-support';

// The two graphs whose registrations this file reads, at module scope rather
// than in a hook: their cold transform is billed to the import phase, which has
// no test/hook timeout (AGENTS.md §测试纪律, objectui#3010).
import '@object-ui/components';
import '../register-plugins';

/** This block's spec props schema, or `undefined` when this pin has none. */
const specSchema = (type: string): unknown => (ComponentPropsMap as Record<string, unknown>)[type];

/**
 * Top-level keys `ComponentPropsMap[type]` ACCEPTS — tombstones excluded
 * (objectui#3809).
 *
 * This one function is where both directions of this file get their notion of
 * "the contract's authoring surface", which is why narrowing it here fixes two
 * opposite defects at once. It used to be raw `Object.keys(shape)`, and an
 * ADR-0087 D2 retirement does not delete the key — it replaces the member with
 * `z.never().optional()` — so a key the spec rejects BY NAME kept answering
 * "declared". Forward that reads as GREEN on a block publishing a retired key;
 * reverse it reads as RED demanding a block publish one. Same set, opposite
 * failures.
 *
 * The judgement itself lives in `@object-ui/test-support` rather than here: it
 * had been hand-written four times across this repo's gates, the copies had
 * already drifted (two structural-only, one absent — this file), and the shared
 * one is calibrated once against what the contract's own `safeParse` rejects
 * (`spec-tombstones.test.ts`). Zod-internals access now happens in exactly one
 * module repo-wide.
 */
function specTopLevelKeys(type: string): string[] {
  return authorableShapeKeys(specSchema(type));
}

/**
 * Every top-level key the schema still LISTS — tombstones INCLUDED.
 *
 * Deliberately kept alongside the narrowed set, because two questions in this
 * file are about the RELEASE rather than about the authoring surface, and a
 * retired key must answer YES to them: "did this pin ever carry the key at all"
 * (`isDormantOnThisPin`) and "is the tombstone premise still true"
 * (`the tombstone premise still holds` below). Using the narrowed set for
 * either would be the same conflation in a new place — a retired key would read
 * as a key the pin never had.
 */
const specListedKeys = (type: string): string[] => listedShapeKeys(specSchema(type));

/** The listed top-level keys this block's spec schema rejects by name. */
const specTombstonedKeys = (type: string): string[] => tombstonedShapeKeys(specSchema(type));

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
 * (`plugin-detail/src/index.tsx:554-556`, verbatim: "`aria` is omitted for the
 * same reason it is omitted on `record:details` above"). Publishing it would put
 * an `aria` object in every designer panel and every generated `.d.ts` as though
 * hand-writing ARIA were the normal way to configure a block, when the renderers
 * derive their accessible names from labels and object metadata. A key whose
 * reason is per-block belongs in `UNPUBLISHED_EXEMPTIONS` below, not here.
 */
const GLOBALLY_UNPUBLISHED_SPEC_KEYS: Record<string, string> = {
  aria: 'Accessibility escape hatch, not a layout choice — renderers derive accessible names from labels and object metadata, and every block omits it for this one reason (plugin-detail/src/index.tsx:554-556). objectui#3808.',
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
 * The five `record:*` blocks `@objectstack/spec` 17.1.0 adds to
 * `ComponentPropsMap` and `17.0.0` does not carry at all (objectui#5328;
 * the map goes from 37 entries to 42, and these are the five).
 *
 * Exactly the same shape as `GA_ONLY_BLOCKS` above, and for the same reason:
 * this repo has registered all five with `inputs` for far longer than the spec
 * has described them — `plugin-detail/src/index.tsx` registers `alert` (:686),
 * `history` (:662) and `reference_rail` (:675), and `quick_actions` /
 * `discussion` alongside them — so what moved at the pin bump is the SPEC's
 * side, not this repo's. They enter `covered` the moment the installed spec
 * carries them, and the reverse direction then asks each for the keys it does
 * not publish. Only `record:reference_rail` had one: `entries`, exempted below.
 */
const MINOR_17_1_BLOCKS = [
  'record:alert',
  'record:discussion',
  'record:history',
  'record:quick_actions',
  'record:reference_rail',
];

/**
 * Does the installed `@objectstack/spec` carry the 17.1.0 record set?
 *
 * Same observable-fact reasoning as `specCarriesGaBlocks` below, including the
 * `every` rather than `some`: the five arrived in one release, so a
 * half-carried state is a broken premise rather than an in-between pin.
 */
const specCarries171Blocks = MINOR_17_1_BLOCKS.every((type) => type in ComponentPropsMap);

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
  ...(specCarries171Blocks ? MINOR_17_1_BLOCKS : []),
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
 *   - the installed pin does not declare the key yet, so declaring the input
 *     would fail this file's own forward direction today;
 *   - the key is out of the dispatched scope of the change that added this gate,
 *     and its own issue owns it.
 *
 * ONE CLASS IS GONE, and it is worth knowing which, because it used to be the
 * biggest: "the spec rejects this key by name upstream already". A key the spec
 * REJECTS needs no exemption at all since objectui#3809 — it leaves the accepted
 * set on its own, so nothing demands it and nothing has to license not
 * publishing it. Eight entries of that class were harvested (see the comment at
 * the top of the map). An entry whose reason reduces to "upstream retired it" is
 * therefore the one thing that may never be ADDED here again: it would go
 * dangling-and-stale in the same run that wrote it.
 *
 * Every reason cites an issue, which `references a tracking issue` asserts.
 * Verified against renderer read sites at objectui `origin/main` @ `c25222758`
 * with `@objectstack/spec@17.0.0-rc.6` — not assumed from the spec's wording.
 */
const UNPUBLISHED_EXEMPTIONS: Record<string, string> = {
  /*
   * EIGHT TOMBSTONE ENTRIES HARVESTED HERE — objectui#3809, and they were
   * designed to die exactly this way.
   *
   * `page:header.icon`, `page:card.actions`, `page:tabs.type`,
   * `element:record_picker.displayField` / `.searchFields` / `.multiple`,
   * `page:card.body` and `record:details.layout`. Every one of them existed for
   * the same reason, said so in its own words, and named this issue as the only
   * thing that could resolve it: the key is an ADR-0087 D2 tombstone — retired
   * upstream, and STILL a member of the spec's shape, because D2 retirement
   * replaces the member with `z.never().optional()` rather than deleting it. So
   * the reverse direction, reading raw `Object.keys(shape)`, demanded that this
   * repo publish a key the contract rejects by name, and each entry was cover
   * for that false red.
   *
   * They are not deleted by hand-picking. `specTopLevelKeys` now subtracts
   * tombstones, and the two checks that police this list did the rest: the key
   * is no longer in the accepted set, so `every unpublished-key exemption names a
   * key the spec really declares` reports each as DANGLING, and
   * `carries no stale unpublished-key exemption` reports each as STALE. Both
   * name all eight. Deleting them is the only way to get green, which is the
   * discipline this file's header promises working end to end.
   *
   * THE FIVE UPSTREAM RETIREMENTS these eight came from, kept for the reader who
   * needs to know why none of the keys is coming back — the prescriptions are
   * upstream's, not this repo's:
   *
   *   - objectstack#5775 / PR objectstack#6281 — the `element:record_picker`
   *     trio converges on `labelField` / `valueField` (which this renderer reads
   *     and this repo publishes); `PageCardProps.body` converges on `children`,
   *     the spelling every other container uses and the one `page:card` now
   *     publishes (objectui#4027);
   *   - objectstack#6946 / PR objectstack#7115 — `page:header.icon` (a header's
   *     identity is the record chrome plus each action's own icon),
   *     `page:card.actions` (buttons are authored as components in `children` or
   *     `footer`), and `record:details.layout` (withdrawn here by objectui#3818:
   *     its published `auto` | `custom` semantics were never implemented);
   *   - objectstack#6776 — `page:tabs.type`. This one resolves DIFFERENTLY from
   *     its own entry's prediction, and the difference is worth a sentence. The
   *     entry read it as a live spec key that the flat SDUI carrier cannot
   *     express (a node is `{ type: 'page:tabs', … }`, where `type` is the
   *     dispatch tag, and `validate.ts` lists `'type'` in `BASE_PROPS`), and
   *     called convergence "upstream". Upstream converged: it retired the `type`
   *     spelling in favour of `tabStyle`, which this repo already publishes. So
   *     the carrier collision is not tolerated any more, it is gone — the
   *     contract now has one spelling, and it is the publishable one.
   *
   * Renderer READS of these keys are untouched and stay untouched. A stored
   * document written against the old contract keeps rendering until an ADR-0087
   * D2 conversion rewrites it at load time; a back-compat read is not an
   * authoring surface, so it never belonged in `inputs` (the split
   * `page-header-subtitle-alias` established in `packages/layout`). This harvest
   * withdraws EXEMPTIONS, not capability.
   *
   * WHAT HAPPENS AT THE NEXT PIN BUMP, so nobody reads the next red as a
   * regression: the mechanism is now self-clearing. A key upstream retires after
   * this change enters the shape as a tombstone, leaves the accepted set on
   * arrival, and any exemption covering it goes dangling-and-stale in the same
   * run — no issue needed, no filter to remember.
   *
   * THAT PREDICTION HAS NOW RUN ONCE, AND IT HELD. The paragraph used to say two
   * entries below were queued for it: objectstack `origin/main` tombstoned
   * `targetVariable` on BOTH `element:text_input` and `element:record_picker`
   * while the installed 17.0.0 still carried both as live. The 17.1.0 pin
   * (objectui#5328) delivered those retirements, all three directions named the
   * two entries in the same run, and deleting them was the entire fix —
   * objectui#3834's "should we publish an intent-only key" question having been
   * answered upstream, in the negative. The mechanism needed no maintenance to
   * do that, which is the property worth keeping.
   *
   * DO NOT resolve a tombstone red by declaring the input. That publishes a key
   * the contract rejects by name and fails the forward direction immediately;
   * the two directions of this file are a vice on exactly that move, which is
   * why one of them could not be fixed without the other.
   */

  // `element:record_picker.filter` was the ninth entry here — a real A-class gap
  // that fell out of objectui#3808's three-class triage, exempted only because it
  // was outside that PR's dispatched scope. objectui#3830 declared the input, so
  // the entry stopped describing anything and `carries no stale unpublished-key
  // exemption` demanded its deletion. It is now pinned as DECLARED, by name,
  // alongside #3808's four at the bottom of this file.

  // TWO targetVariable ENTRIES DELETED HERE — objectui#5328, and they died
  // exactly the way the docblock above said they would.
  //
  // `element:text_input.targetVariable` and `element:record_picker.targetVariable`
  // were exempted as the spec's own intent-only "declarative hint" with zero read
  // points repo-wide, pending objectui#3834's question of whether to publish such
  // a key at all. The `@objectstack/spec` 17.1.0 pin answered it upstream, in the
  // negative: both keys arrived as ADR-0087 D2 tombstones, so they left the
  // accepted set and the exemptions covering them went dangling-and-stale in the
  // same run — named by `every unpublished-key exemption names a key the spec
  // really declares`, `carries no stale unpublished-key exemption` and `the
  // tombstoned keys are recognised, not exempted`, all three at once.
  //
  // Deleting them is the whole fix. The tombstone judge recognises both keys now,
  // which is a stronger statement than an exemption ever was: the contract itself
  // rejects them by name.

  // FIVE GA-PENDING ENTRIES DELETED HERE — objectui#4668, and they too were
  // designed to die exactly this way.
  //
  // `page:header.maxVisible` / `page:header.mobileMaxVisible` /
  // `page:tabs.alwaysShowStrip` / `record:details.inlineEdit` /
  // `record:details.showHeader` were a class of their own: publishing them was
  // the RIGHT answer and this file's own bar said so ("a spec key the renderer
  // HONOURS and `inputs` omits is a plain defect and gets declared"). What held
  // them was the installed contract, not a judgement — @objectstack/spec 17.0.0
  // GA declares all five and the then-pinned 17.0.0-rc.6 declared none, so
  // declaring the inputs would have failed the FORWARD direction of this very
  // file, and a forward exemption to cover THAT would have gone stale the moment
  // the pin moved (the collision PR objectui#4660 recorded for `SECRET_MASK`).
  //
  // The GA pin landed (objectui#4636 / PR objectui#4639) and objectui#4668
  // declared all five at their registration sites, which is what made `carries
  // no stale unpublished-key exemption` name every one of them at once —
  // exactly as it killed `element:record_picker.filter` when #3830 declared that
  // one. They are pinned as DECLARED, by name, in `the five GA keys
  // objectui#4668 declared are discoverable` at the bottom of this file: the
  // derived reverse loop goes green just as readily if a declaration is swapped
  // back for an entry here, which is the cheap move and the one thing the pin
  // forbids.
  //
  // One of the five needed more than a declaration, and it is recorded here
  // because this list is where the next reader looks: `page:tabs.alwaysShowStrip`
  // was read ONLY as `schema.properties.alwaysShowStrip`, while `inputs`
  // publishes top-level keys. Measured on a one-tab schema, the flat form every
  // layer of the manifest accepts was dropped by the renderer — so #4668 added
  // the canonical top-level arm in the same change. Publishing a key whose only
  // read is under a different carrier is not a declaration, it is this gate's own
  // failure mode moved one layer in.

  // ── object-grid's own @deprecated legacy spellings — the RULED carve-out ───
  //                                                          (10 keys)
  // A class of its own, and the only part of objectui#4648's option B that is
  // NOT declared. The maintainer ruling of 2026-08-16 on that card reads:
  // "object-grid's own `@deprecated` legacy spellings … are NOT published as new
  // authoring surface — they get reasoned, cited exemptions so a deprecated
  // alias is not hardened."
  //
  // So the reason here is NOT the one every other entry gives. These ten are not
  // undecided, not upstream-owned, and not blocked on anything: the renderer
  // reads all ten and will keep reading them, because documents authored under
  // the old spellings must keep rendering. What is refused is PUBLISHING them —
  // an `inputs` entry is a recommendation to write the key, and recommending a
  // deprecated alias is how a second dialect gets hardened (AGENTS.md #0.1).
  // A back-compat read is not an authoring surface: the same split
  // `page:card.body` records above, and the one `page-header-subtitle-alias`
  // established in `packages/layout`.
  //
  // Each is tagged `@deprecated` in this repo's own `ObjectGridSchema`
  // (`packages/types/src/objectql.ts`), and GA's own `.describe()` text says the
  // same thing from the producer side ("Legacy … fallback, read only when
  // `filter` is absent. Prefer `filter`"). Both authorities agree, which is why
  // this is an exemption rather than an open question. The CANONICAL spelling of
  // each is declared by objectui#4648 in `plugin-grid/src/index.tsx` and named in
  // the reason below, so the pair reads as "write this one instead" rather than
  // as an unexplained hole.
  //
  // THESE DO NOT SELF-RETIRE ON A PIN BUMP, and that is deliberate: unlike the
  // GA-pending five above, no issue owns declaring them later. They retire only
  // if `@objectstack/spec` retires the keys upstream (an ADR-0087 D2 tombstone,
  // which by itself would NOT make them stale here — see the record_picker trio)
  // or if objectui un-deprecates a spelling. Do not resolve one by declaring the
  // input; that is the move the ruling refused.
  //
  // Measurement note, reported on objectui#4648 with this change: the ruling
  // enumerated FIVE (`fields` / `staticData` / `selectable` / `pageSize` /
  // `showSearch`) from the fork report's list. Re-deriving the class it named —
  // `@deprecated` in `ObjectGridSchema`, AND declared by GA — measures TEN. The
  // five extra (`showPagination`, `defaultSort`, `defaultFilters`,
  // `resizableColumns`, `title`) are the same class by the same test, so they are
  // carved out with it. Trimming back to exactly five is a one-line reversal
  // (delete the entry, declare the input); publishing first and withdrawing later
  // is not, which is why the exemption is the direction taken while the card is
  // open.
  'object-grid.fields':
    '@deprecated in ObjectGridSchema ("Use columns instead"); GA describes it as the "Field list fallback used when `columns` is absent". Read as back-compat, deliberately not published as authoring surface — the canonical `columns` IS declared. Ruled carve-out, objectui#4648 (maintainer 2026-08-16).',
  'object-grid.staticData':
    '@deprecated in ObjectGridSchema ("Use data with provider: \'value\' instead"); GA describes it as the "Alternate spelling of `data`". Read as back-compat, deliberately not published — the canonical `data` IS declared. Ruled carve-out, objectui#4648 (maintainer 2026-08-16).',
  'object-grid.selectable':
    '@deprecated in ObjectGridSchema ("Use selection.type instead"); GA describes it as the "Legacy selection shorthand, read only when `selection` is absent. Prefer `selection`". Read as back-compat, deliberately not published — the canonical `selection` IS declared. Ruled carve-out, objectui#4648 (maintainer 2026-08-16).',
  'object-grid.pageSize':
    '@deprecated in ObjectGridSchema ("Use pagination.pageSize instead"); GA describes it as the "Flat page-size shorthand; `pagination.pageSize` wins when both are set". Read as back-compat, deliberately not published — the canonical `pagination` IS declared. Ruled carve-out, objectui#4648 (maintainer 2026-08-16).',
  'object-grid.showSearch':
    '@deprecated in ObjectGridSchema ("Use searchableFields instead"); GA describes it as "read only when `searchableFields` is absent". A boolean cannot say WHICH fields to search, which is why the list is the surface. Read as back-compat, deliberately not published — the canonical `searchableFields` IS declared. Ruled carve-out, objectui#4648 (maintainer 2026-08-16).',
  'object-grid.showPagination':
    '@deprecated in ObjectGridSchema ("Use pagination config instead"); GA describes it as "read only when `pagination` is absent". Read as back-compat, deliberately not published — the canonical `pagination` IS declared. Same ruled carve-out class as the five the ruling enumerated, measured on this branch — objectui#4648 (maintainer 2026-08-16).',
  'object-grid.defaultSort':
    '@deprecated in ObjectGridSchema ("Use sort instead"); GA describes it as the "Legacy single-sort fallback ({ field, order }), read only when `sort` is absent. Prefer `sort`". Read as back-compat, deliberately not published — the canonical `sort` IS declared. Same ruled carve-out class as the five the ruling enumerated, measured on this branch — objectui#4648 (maintainer 2026-08-16).',
  'object-grid.defaultFilters':
    '@deprecated in ObjectGridSchema ("Use filter instead"); GA describes it as the "Legacy base-filter fallback, read only when `filter` is absent. Prefer `filter`". Read as back-compat, deliberately not published — the canonical `filter` IS declared. Same ruled carve-out class as the five the ruling enumerated, measured on this branch — objectui#4648 (maintainer 2026-08-16).',
  'object-grid.resizableColumns':
    '@deprecated in ObjectGridSchema ("Moved to top-level resizable"); GA describes it as the "Alternate spelling of `resizable`". Read as back-compat, deliberately not published — the canonical `resizable` IS declared. Same ruled carve-out class as the five the ruling enumerated, measured on this branch — objectui#4648 (maintainer 2026-08-16).',
  'object-grid.title':
    '@deprecated in ObjectGridSchema ("Use label instead"); GA describes it as the "Fallback for `label` (the renderer reads `label || title`)". Read as back-compat, deliberately not published — the canonical `label` IS declared. Same ruled carve-out class as the five the ruling enumerated, measured on this branch — objectui#4648 (maintainer 2026-08-16).',

  // ── record:reference_rail.entries — a nested collection, newly JUDGED ──────
  //                                                                   (1 key)
  // The gap is not new; being GATED is. `@objectstack/spec` 17.1.0 added
  // `record:reference_rail` to `ComponentPropsMap` (37 entries to 42), so this
  // file began judging a block it had never covered — the registration in
  // `plugin-detail/src/index.tsx:675` has always published `hideEmpty` and only
  // `hideEmpty`. Nothing about the renderer or its inputs changed on the pin
  // (objectui#5328).
  //
  // `entries` is an ARRAY OF OBJECTS — `{objectName, relationshipField, title,
  // limit, displayField}` per item — and `inputs` is a flat carrier of scalar
  // fields (`type: 'string' | 'number' | 'boolean' | 'enum'`). The same
  // "unpublishable in a flat carrier" reading `page:tabs.type` carried, except
  // here the carrier cannot express the SHAPE rather than colliding on a name.
  //
  // DO NOT resolve this by declaring a scalar input for it: a string field
  // standing in for a list of related-object bindings recommends a write the
  // renderer cannot honour, which is this gate's own failure mode one layer in
  // (the `page:tabs.alwaysShowStrip` note above).
  //
  // Also blocked on a real contract question, so it is not merely unbuilt: the
  // item shape is `ReferenceRailEntrySchema`, whose `$strict` object REFUSES the
  // `icon` key this repo's own local `ReferenceRailEntry` declares and the
  // renderer reads. Publishing an entries editor means first deciding whether
  // `icon` survives — objectui#5494.
  'record:reference_rail.entries':
    'An array of {objectName, relationshipField, title, limit, displayField} objects; `inputs` is a flat scalar carrier and cannot express it. Newly judged rather than newly missing — @objectstack/spec 17.1.0 added record:reference_rail to ComponentPropsMap, and the registration (plugin-detail/src/index.tsx:675) has always published only `hideEmpty`. An entries editor also needs the `icon` divergence settled first: objectui#5494.',
};

/**
 * Exemption entries whose KEY the installed spec is allowed not to declare yet.
 *
 * Every other entry in `UNPUBLISHED_EXEMPTIONS` describes a key the installed
 * spec declares right now — that is what `every unpublished-key exemption names
 * a key the spec really declares` asserts, and it is why a typo cannot hide in
 * the list. These ten describe keys of a block only @objectstack/spec 17.0.0 GA
 * carries, so on a pin predating the GA element set they describe nothing yet.
 *
 * Pinning them as a SET rather than skipping "any entry the spec does not
 * declare" is the whole safety of the mechanism: only these entries may be
 * dormant, and `every GA-pending exemption arms exactly with the installed
 * spec` asserts that their dormancy tracks the installed element set in BOTH
 * directions — so a GA release that dropped one of them fails here instead of
 * leaving an entry that quietly covers nothing.
 *
 * ONE GROUP NOW, and knowing which one LEFT matters more than the one that
 * stayed:
 *
 *   - the ten `object-grid` entries are objectui#4648's RULED carve-out. They
 *     are dormant only on a pin that does not carry `object-grid` at all, so
 *     none of its keys resolves; on a GA tree they are fully judged. They are
 *     not awaiting declaration — see their reasons above;
 *   - the FIVE that were listed first here (`page:header.maxVisible`,
 *     `page:header.mobileMaxVisible`, `page:tabs.alwaysShowStrip`,
 *     `record:details.inlineEdit`, `record:details.showHeader`) were the other
 *     kind: keys on blocks the pin already carried, awaiting declaration. They
 *     retired the way this mechanism intends — the pin moved to GA, objectui#4668
 *     declared all five, and their exemption entries went stale in the same run.
 *     A "pending" entry that never lands is the rot this set exists to make
 *     visible; these five are the worked example of it not happening.
 *
 * So the two arms of `isDormantOnThisPin` are no longer symmetric in practice:
 * a future entry here is either a ruled carve-out on a block the pin may not
 * carry, or a declaration someone owes. Say which in the reason.
 */
const GA_PENDING_UNPUBLISHED_KEYS = [
  'object-grid.fields',
  'object-grid.staticData',
  'object-grid.selectable',
  'object-grid.pageSize',
  'object-grid.showSearch',
  'object-grid.showPagination',
  'object-grid.defaultSort',
  'object-grid.defaultFilters',
  'object-grid.resizableColumns',
  'object-grid.title',
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
 *
 * `specListedKeys`, NOT the narrowed accepted set, and the difference is the one
 * objectui#3809 is about (see that function's own note). Dormancy is a question
 * about the RELEASE: does this pin know the key at all? A tombstone answers YES
 * — the release knows it and refuses it — so an exemption covering a retired key
 * must stay LIVE and be reported as dangling-and-stale, which is what forces its
 * deletion. Asking the narrowed set here would call every future retirement
 * "dormant" and hand a retired key's exemption a permanent hiding place, which
 * is the same blind spot one layer down.
 */
const isDormantOnThisPin = (exemptionKey: string): boolean => {
  if (!GA_PENDING_UNPUBLISHED_KEYS.includes(exemptionKey)) return false;
  const [type, specKey] = splitExemptionKey(exemptionKey);
  return !specListedKeys(type).includes(specKey);
};

/*
 * THE FOUR GA BLOCKS — RULED AND RESOLVED, objectui#4648 (maintainer 2026-08-16).
 *
 * On a GA tree `object-form` / `object-grid` / `object-master-detail-form` /
 * `object-metric` enter `covered` (see `GA_ONLY_BLOCKS`) and the reverse
 * direction judges the 78 spec keys their `inputs` did not publish. That red is
 * now resolved the way this file's own bar prescribes — "a spec key the renderer
 * HONOURS and `inputs` omits is a plain defect and gets declared" — because the
 * implementation measurement that forked the card's first ruling showed all 78
 * ARE honoured today, either off `schema.*` in the renderer or through
 * `SchemaRenderer`'s rest-prop spread onto components whose props declare them
 * one for one. The maintainer re-ruled on that measurement (option B):
 *
 *   - 68 keys are DECLARED, at the four registration sites —
 *     `plugin-form/src/index.tsx` (`object-form` +20, `object-master-detail-form`
 *     +10), `plugin-grid/src/index.tsx` (`object-grid` +21 in
 *     `GRID_QUERY_INPUTS`), `plugin-dashboard/src/index.tsx` (`object-metric`
 *     +14). No exemption is owed for a declared key and none is written;
 *   - 10 are the ruled CARVE-OUT — `object-grid`'s own `@deprecated` legacy
 *     spellings, which are exempted rather than declared so a deprecated alias is
 *     not hardened into a second dialect. Their entries are in
 *     `UNPUBLISHED_EXEMPTIONS` above, each naming the canonical spelling that IS
 *     declared in its place.
 *
 * The bar was NOT amended: option B is the arm that needed no amendment, which
 * is one of the reasons the ruling chose it.
 *
 * The exemption list is therefore the carve-out and nothing else. A future key
 * these blocks gain is a plain A-class defect: declare it at the registration
 * site. Do not add an entry here to silence one.
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

  it('the tombstone premise still holds — a retired key stays IN the shape', () => {
    // THE PREMISE, asserted rather than assumed (objectui#3809). Every tombstone
    // filter in this file — in BOTH directions, since they share one accepted
    // set — is built on one property of ADR-0087 D2: retirement REPLACES the
    // member with `z.never().optional()` and leaves the entry listed. If
    // upstream ever retires by DELETING the key instead, the filter stops
    // narrowing anything and every assertion here goes on passing. That is dead
    // code nobody can see, and it is the failure mode objectui#3809's own text
    // warned about before the fix existed.
    //
    // So the shape of this assertion is deliberate: it is not "tombstones are
    // handled correctly", it is "there is still something for the handling to
    // do". A red here does not mean the gate is wrong; it means the premise
    // expired, and the filter plus this test plus the harvest comment above are
    // all now archaeology to be removed together.
    const listedButRejected = covered.flatMap((type) =>
      specTombstonedKeys(type).map((key) => `${type}.${key}`),
    );
    expect(
      listedButRejected.length,
      'no covered block lists a tombstoned key: either this pin predates every ADR-0087 D2 ' +
        'retirement, or upstream now DELETES retired keys — in which case the tombstone ' +
        'narrowing in `specTopLevelKeys` is dead code and must be removed, not kept',
    ).toBeGreaterThan(0);

    // …and the narrowing is not a no-op, per block. `listed` must strictly
    // exceed `accepted` exactly where a tombstone was found — the third way this
    // could rot is a judge that reports tombstones while the subtraction quietly
    // stops using its answer.
    for (const type of covered) {
      const tombstoned = specTombstonedKeys(type);
      if (tombstoned.length === 0) continue;
      expect(specListedKeys(type).length, `${type} accepted set did not narrow`).toBeGreaterThan(
        specTopLevelKeys(type).length,
      );
      for (const key of tombstoned) {
        expect(specListedKeys(type), `${type}.${key} is not even listed`).toContain(key);
        expect(specTopLevelKeys(type), `${type}.${key} survived the narrowing`).not.toContain(key);
      }
    }

    // Non-vacuity for the judge itself, in the direction the loops above cannot
    // reach: a probe that answered "tombstone" for EVERYTHING would satisfy all
    // of them. `page:card.title` is live contract and this repo publishes it, so
    // it is the control.
    expect(isShapeKeyTombstoned(specSchema('page:card'), 'title')).toBe(false);
    expect(specTopLevelKeys('page:card')).toContain('title');
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

  it('every GA-pending exemption arms exactly with the installed spec, all ten together', () => {
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

  it('the four GA blocks resolve their ruled split — declared vs carved out', () => {
    // objectui#4648's ruling, pinned by name rather than left to the derived
    // reverse-direction loop above, for exactly the reason the `#3808 / #3830`
    // and `rc.6 record_picker` pins next door exist: that loop goes green just as
    // readily if a declaration is REPLACED by an exemption, which is the cheap
    // move under time pressure and the one thing option B forbids. So the split
    // is asserted as "declared" and "exempted, not declared", not merely as
    // "not failing".
    //
    // Dormant on a pin that predates the GA element set — there is nothing to
    // judge when the spec carries none of the four — and the dormancy is not
    // silent: `the four GA blocks enter coverage exactly when the installed spec
    // carries them` above owns that fact for both pins.
    if (!specCarriesGaBlocks) {
      expect(covered.filter((type) => GA_ONLY_BLOCKS.includes(type))).toEqual([]);
      return;
    }

    // The carve-out, by name: `@deprecated` in this repo's own ObjectGridSchema,
    // declared by GA, and deliberately NOT published (maintainer 2026-08-16).
    const CARVED_OUT_GRID_KEYS = [
      'defaultFilters',
      'defaultSort',
      'fields',
      'pageSize',
      'resizableColumns',
      'selectable',
      'showPagination',
      'showSearch',
      'staticData',
      'title',
    ];

    for (const key of CARVED_OUT_GRID_KEYS) {
      expect(
        specTopLevelKeys('object-grid'),
        `spec no longer declares object-grid.${key} — re-check the carve-out`,
      ).toContain(key);
      expect(
        declaredInputs('object-grid') ?? [],
        `object-grid publishes ${key}; the ruling carved it out as a deprecated alias`,
      ).not.toContain(key);
      expect(
        Object.keys(UNPUBLISHED_EXEMPTIONS),
        `object-grid.${key} is carved out but carries no cited exemption`,
      ).toContain(`object-grid.${key}`);
    }

    // Everything else the four blocks' spec schemas declare is DECLARED, and
    // carries no exemption. Stated as an exact set difference rather than a
    // spot-check so a key added by a later GA cannot slip through as neither.
    for (const type of GA_ONLY_BLOCKS) {
      const carved = type === 'object-grid' ? CARVED_OUT_GRID_KEYS : [];
      const shouldPublish = specTopLevelKeys(type)
        .filter((key) => !(key in GLOBALLY_UNPUBLISHED_SPEC_KEYS))
        .filter((key) => !carved.includes(key));
      const declared = new Set(declaredInputs(type) ?? []);
      expect(
        shouldPublish.filter((key) => !declared.has(key)),
        `${type} does not publish these spec keys, and they are not the ruled carve-out`,
      ).toEqual([]);
      expect(
        shouldPublish.filter((key) => Object.keys(UNPUBLISHED_EXEMPTIONS).includes(`${type}.${key}`)),
        `${type} exempts a key it declares — an exemption may not stand in for a declaration here`,
      ).toEqual([]);
    }
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
    // the block declares the input (objectui#3829/#3830/#3834 landing), when the
    // spec genuinely deletes the key, or — since objectui#3809 — when the spec
    // RETIRES it: a tombstone leaves the accepted set, so the reverse direction
    // stops demanding the key and any entry covering it stops describing
    // anything. That last arm is what harvested the eight entries named in the
    // comment above, and it is why no future retirement needs an issue of its
    // own to clean up after it.
    const stale = Object.keys(UNPUBLISHED_EXEMPTIONS)
      .filter((key) => !isDormantOnThisPin(key))
      .filter((key) => {
        const [type, specKey] = splitExemptionKey(key);
        return !undiscoverableSpecKeys(type).includes(specKey);
      });
    expect(stale).toEqual([]);
  });

  it('the eight tombstoned keys are recognised, not exempted — and not published either', () => {
    // The pin the harvest leaves behind (objectui#3809). Deleting eight
    // exemptions is only half the change: the derived assertions above would go
    // green just as readily if a future edit RE-EXEMPTED one of these keys, or
    // if the tombstone narrowing stopped working and the entry came back to
    // absorb the red again. Both moves restore the exact state this issue
    // existed to end, and neither shows up as a failure anywhere else — which is
    // the same reason the `#3808 / #3830` and `rc.6 record_picker` pins next door
    // are written by name.
    //
    // Five upstream retirements, eight keys, several facts each. The list is
    // pin-dependent by construction and that is the point: it is the measurement
    // (`@objectstack/spec@17.0.0`, and the same eight on the rc.6 that preceded
    // it — this change was verified on both), so a pin that un-retires one of
    // them fails HERE, naming the key, instead of resurfacing as an unexplained
    // red in a derived loop.
    const HARVESTED: Array<[string, string]> = [
      ['element:record_picker', 'displayField'],
      ['element:record_picker', 'multiple'],
      ['element:record_picker', 'searchFields'],
      ['page:card', 'actions'],
      ['page:card', 'body'],
      ['page:header', 'icon'],
      ['page:tabs', 'type'],
      ['record:details', 'layout'],
    ];

    for (const [type, key] of HARVESTED) {
      // Still LISTED: the release knows the key. This is the assertion that
      // distinguishes "retired" from "this pin never had it", and without it the
      // three below would pass just as well on a key that simply does not exist.
      expect(specListedKeys(type), `${type} no longer lists ${key} at all`).toContain(key);
      expect(
        isShapeKeyTombstoned(specSchema(type), key),
        `${type}.${key} is listed but no longer reads as a tombstone — did upstream un-retire it?`,
      ).toBe(true);
      // Not demanded by the reverse direction any more, which is what made the
      // exemption unnecessary…
      expect(
        undiscoverableSpecKeys(type),
        `${type}.${key} is being demanded again; the narrowing is not being applied`,
      ).not.toContain(key);
      // …and not covered by one either.
      expect(
        Object.keys(UNPUBLISHED_EXEMPTIONS),
        `${type}.${key} is exempted again — a tombstone needs no cover`,
      ).not.toContain(`${type}.${key}`);
      // The other resolution the two directions exist to forbid: publishing the
      // key. The forward direction would red on it, but stating it here is what
      // makes THIS test the one place a reader learns both halves.
      expect(
        declaredInputs(type) ?? [],
        `${type} publishes ${key}, a key the contract rejects by name`,
      ).not.toContain(key);
    }

    // Completeness, derived rather than restated: no OTHER tombstoned key on a
    // covered block may carry an exemption. An entry for one would be dangling
    // (the checks above name it), but this states the rule positively so the
    // next retirement is not resolved by writing an entry that then has to be
    // harvested a second time.
    const exemptedTombstones = covered.flatMap((type) =>
      specTombstonedKeys(type)
        .filter((key) => Object.keys(UNPUBLISHED_EXEMPTIONS).includes(`${type}.${key}`))
        .map((key) => `${type}.${key}`),
    );
    expect(exemptedTombstones).toEqual([]);
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

  it('the five GA keys objectui#4668 declared are discoverable, block by block', () => {
    // Named, not merely covered by the derived reverse loop above, for exactly
    // the reason the #3808 five and the rc.6 record_picker trio next door are:
    // that loop goes green just as readily if a declaration is REPLACED by an
    // `UNPUBLISHED_EXEMPTIONS` entry, which is the cheap move under time
    // pressure and the one thing these five may not resolve to a second time.
    // Their entries existed for a stated, expiring reason — the pre-GA pin — and
    // that reason cannot be re-borrowed now that the pin carries the keys.
    //
    // Three assertions per key, and the first is the non-vacuity half: if a
    // later pin dropped one of these from its props schema,
    // `undiscoverableSpecKeys` would stop naming it and every derived assertion
    // would pass while the input sat there publishing a key the contract no
    // longer has — the forward direction would then be the one to red, which is
    // the correct place for that failure, not here.
    const declared: Array<[string, string]> = [
      ['page:header', 'maxVisible'],
      ['page:header', 'mobileMaxVisible'],
      ['page:tabs', 'alwaysShowStrip'],
      ['record:details', 'inlineEdit'],
      ['record:details', 'showHeader'],
    ];
    for (const [type, key] of declared) {
      expect(specTopLevelKeys(type), `${type} spec no longer declares ${key}`).toContain(key);
      expect(declaredInputs(type) ?? [], `${type} does not publish ${key}`).toContain(key);
      expect(Object.keys(UNPUBLISHED_EXEMPTIONS)).not.toContain(`${type}.${key}`);
      // And they are no longer nameable as dormant: the set that licensed the
      // dormancy dropped them, so `isDormantOnThisPin` answers false for a
      // second, independent reason. Without this, re-adding the key to
      // `GA_PENDING_UNPUBLISHED_KEYS` *and* to the exemption map would restore
      // the pre-GA state and only `every GA-pending exemption arms exactly with
      // the installed spec` would notice — and only while the pin carries the
      // key.
      expect(GA_PENDING_UNPUBLISHED_KEYS).not.toContain(`${type}.${key}`);
    }

    // Each carries a description, because for these five the discoverability
    // IS the fix: an input with an empty description publishes the key to
    // `sdui.manifest.json` and the `.d.ts` while still telling a designer panel
    // nothing about what to write in it.
    for (const [type, key] of declared) {
      const input = (ComponentRegistry.getConfig(type)?.inputs ?? []).find((i) => i.name === key);
      expect(input, `${type}.${key} input vanished`).toBeTruthy();
      expect((input?.description ?? '').length, `${type}.${key} has no description`).toBeGreaterThan(0);
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
