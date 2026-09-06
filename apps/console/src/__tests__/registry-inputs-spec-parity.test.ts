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
 * LIMIT — worth knowing before trusting a pass. Of the two things this gate
 * used to be unable to see, ONE IS NOW GATED and one is still deliberately not:
 *
 *   - member KINDS — CLOSED, objectui#8067. This gate used to compare top-level
 *     key names and nothing else, because an `inputs` entry of type
 *     `array`/`object` declared no member shape at all: `ComponentInput` had no
 *     slot for one, so a member that drifted from the contract was invisible
 *     here. That is what `page:header.actions` cost — spec `z.array(z.string())`
 *     ("Action IDs"), a renderer reading the members as `ActionDef` OBJECTS, and
 *     this gate green for the whole life of the drift because both sides had the
 *     key. `ComponentInput.of` now carries the member kind, and the MEMBER
 *     DIRECTION section below compares every declared one against what
 *     `ComponentPropsMap[type]` accepts at the member position. It stops at the
 *     KIND, exactly as the arm direction does: `of: 'object'` says the members
 *     are objects, never WHICH KEYS they have. Those keys — `record:details
 *     .sections`, `record:highlights.fields` and `record:related_list.add`
 *     among them — publish their members in prose and are pinned by per-block
 *     tests next to their renderers, and since objectui#8068 the MEMBER-PIN
 *     DIRECTION below makes naming that pin MANDATORY rather than voluntary.
 *     PR #3795's open question, half of it closed;
 *   - types, NARROWER than the contract. A key can be in perfect name parity
 *     while declaring fewer arms than the spec accepts, and this gate does not
 *     look. That half is deliberately left to per-block discipline, for the
 *     reason the ARM DIRECTION section below sets out: narrowing is NOISY, and
 *     noise is at least audible. It applies to `of` unchanged — a member union
 *     declared with one arm is not gated either, and the keys left undeclared
 *     for that reason are pinned in `MULTI_KIND_MEMBER_CONTRACTS`.
 *
 * A pass means the top-level key names are in parity, that no declared arm is
 * one the contract refuses outright, and that no declared MEMBER kind is —
 * nothing more.
 *
 * ── THE ARM DIRECTION, AND WHY ONLY ONE OF ITS TWO HALVES IS GATED ──────────
 *                                                             (objectui#4971)
 *
 * `ComponentInput.type` used to carry ONE coarse kind. objectui#3832 gave it
 * the ARRAY form so a key whose contract is a union can declare its real arms —
 * and in doing so created a SECOND way for a declaration to disagree with the
 * contract. The two are not symmetric, and the asymmetry is the whole argument
 * for gating one and not the other:
 *
 *   - NARROWING — declaring FEWER arms than the spec accepts — produces NOISE.
 *     `sdui-parser`'s `checkType` reports `type-mismatch` on a value the
 *     contract is perfectly happy with; the author is warned off a legal write.
 *     Annoying, occasionally harmful (noise on legal writes trains authors, AI
 *     authors included, to dismiss the reports that ARE real) — but AUDIBLE.
 *     Somebody sees it.
 *   - WIDENING — declaring an arm the spec REJECTS — is SILENT. `checkType`
 *     clears a value the contract refuses, the manifest and the generated
 *     `.d.ts` publish it as legal, and `os validate` / `os build` are the first
 *     thing in the chain to say no, long after the metadata was written.
 *     `declared = enforced` inverts, and NOTHING announces it.
 *
 * Before #3832 only the narrow mode existed, so the gap self-announced. After
 * it, the silent mode is live and needs a gate. That is this one, and it is
 * ONE-DIRECTIONAL on purpose: every declared arm must be a shape the contract
 * accepts (a SUBSET of what the spec takes on that key). It does not ask the
 * reverse question.
 *
 * MEASURED, and this is what "done" meant for #4971. Two fake arms were added
 * on the #3832 branch, one per specimen. `element:text_input.defaultValue` grew
 * an `'object'` arm the spec rejects and the per-block
 * `text-input-inputs-spec-parity.test.ts` pinned it red. `page:card.title` grew
 * a `'number'` arm the spec rejects and the WHOLE SUITE stayed green — 856
 * tests, not one gate noticing. The only difference between the two is that
 * `element:text_input` happens to have a per-block test and `page:card` does
 * not: the property held by DISCIPLINE, block by block, not by a gate.
 *
 * ## What an arm is compared against — the COARSE-KIND ceiling
 *
 * An arm names a value's KIND, never its DOMAIN (`ComponentInput.type`, and the
 * maintainer ruling of 2026-08-17 quoted there: "the coarse arm plus
 * `description` IS the publication face's expression ceiling today, and SPEC IS
 * THE SOLE JUDGE OF VALUES"). `page:header.maxVisible` is the worked example —
 * its contract is a POSITIVE SAFE INTEGER, its arm is `'number'`, and `0` /
 * `-1` / `1.5` pass this layer by design.
 *
 * So the question this gate asks is the one the ruling leaves it: does the
 * contract accept ANY value of that kind on that key? A `'number'` arm on a key
 * whose contract is `1..n` is in scope of the ruling and stays green. A
 * `'number'` arm on a key whose contract is a STRING accepts nothing the
 * contract accepts, and is what `declared = enforced` cannot survive.
 *
 * ## Kind-refusal vs value-refusal — the trap this gate is built around
 *
 * The naive probe ("does `safeParse` accept a representative value of this
 * kind?") is WRONG in two measured ways, and both make a CORRECT arm read as
 * invented — the false red triage flagged when this card was scoped:
 *
 *   1. ENUM CONTRACTS. `record:quick_actions.variant` is a spec enum, declared
 *      with a `'string'` arm. A representative string is refused — as a VALUE,
 *      not as a kind. Reading that as "the string arm is fake" would condemn a
 *      declaration the ruling above expressly permits.
 *   2. REQUIRED SIBLINGS. `{ filter: … }` alone fails `element:number`'s schema
 *      for the missing `object` / `aggregate`, and would report every arm of
 *      every key on such a block as fake.
 *
 * `specArmVerdict` therefore reads the ISSUES rather than the boolean: it looks
 * only at issues about THIS key (so siblings cannot speak for it), and it
 * refutes an arm only when the refusal is at the key's own node AND is a KIND
 * refusal (`invalid_type`, or an `invalid_union` whose every branch refuses the
 * kind). A refusal deeper in the value, or of any other code, means the kind got
 * in and the CONTENT was judged — which is precisely the ceiling above, so the
 * arm stands.
 *
 * That is the exemption for enum CONTRACTS, and it is a rule rather than a list.
 * The one thing it must not do is let #4971's own measurement through, so the
 * calibration is asserted by name: `page:card.title` + `42` must read
 * `refuses-kind` (the fake arm reds), while `record:quick_actions.variant` +
 * `'Account'` must read `refuses-content` (the enum arm does not).
 *
 * An `enum` ARM is judged differently and exactly, because it is the one arm
 * whose admitted set is FINITE and written down: `armAccepts` consults the
 * input's own `enum` list, so every declared member must be a value the spec
 * accepts. No coarseness is needed and none is taken.
 *
 * Two arm kinds are EXEMPT, listed rather than silent: `'slot'` (it describes a
 * CHILD POSITION, not a value — `armAccepts` admits everything for it, so there
 * is no value-shaped claim to compare), and an `'enum'` arm that declares NO
 * members (it admits nothing, so it can widen nothing).
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
import { ComponentPropsMap, PageComponentSchema } from '@objectstack/spec/ui';
import { MANIFEST_INPUT_TYPES, inputTypeArms } from '@object-ui/sdui-parser';
import type { ComponentInput } from '@object-ui/types';
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

/**
 * Declared input ENTRIES for a registered block, or `null` when not registered.
 *
 * The arm direction (objectui#4971) needs more of an input than its name — the
 * declared `type` arms, and an `enum` arm's own member list — so the registry
 * read happens once, here, and `declaredInputs` projects it. Two readers of
 * `config.inputs` would be two chances to disagree about which registration a
 * verdict came from.
 */
function declaredInputEntries(type: string): ComponentInput[] | null {
  const config = ComponentRegistry.getConfig(type);
  if (!config) return null;
  return (config.inputs ?? []) as ComponentInput[];
}

/** Declared input names for a registered block, or `null` when not registered. */
function declaredInputs(type: string): string[] | null {
  return declaredInputEntries(type)?.map((input) => input.name) ?? null;
}

/**
 * Keys the spec accepts on the NODE itself, on every page component
 * (objectui#6678).
 *
 * `ComponentPropsMap[type]` is the per-block PROPS half of a component's
 * contract. It is not the whole contract: `PageComponentSchema` — the schema of
 * the node these `inputs` describe — carries its own top-level keys, and the
 * html tier validates an author's attributes against `BASE_PROPS` ∪ `inputs`,
 * with no third place for a node-level key to be declared.
 *
 * That distinction was invisible while no block declared a node-level key, and
 * it stopped being invisible with `dataSource`: the spec's per-element data
 * binding, read by every block that wraps `ElementDataSourceGate`, declared by
 * none, and therefore reported by the html tier as a prop that does not exist —
 * the one spelling that resolves a saved view, reported exactly like the
 * spellings that do nothing (objectui#6678). The maintainer ruling of
 * 2026-08-29 declares it on the blocks that read it, emitted at the wrapping
 * seam; `BASE_PROPS` (which mirrors `BaseSchema`) was refused, because it would
 * also silence the key on `flex` and `card`, which do not read it.
 *
 * So the forward direction's question — "does the contract accept this key on
 * this node?" — has to be asked of the whole node contract. It is DERIVED here,
 * not listed: `PageComponentSchema` is a `.pipe()`, whose input side is the
 * object whose shape names those keys. A spec release that adds or removes one
 * moves this set with it.
 *
 * ⚠️ Used by the FORWARD direction only. Feeding it to the reverse direction
 * would demand that every covered block publish `dataSource` — including the
 * blocks that do not read it, which is the exact lie the ruling refused.
 */
const nodeLevelSpecKeys = (): string[] =>
  authorableShapeKeys((PageComponentSchema as unknown as { _def?: { in?: unknown } })._def?.in);

/** Top-level inputs this block declares that its spec props schema rejects. */
function offSpecInputs(type: string): string[] {
  const allowed = new Set([...specTopLevelKeys(type), ...nodeLevelSpecKeys()]);
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
  // which by itself DOES make the entry dangling and stale here, because
  // `specTopLevelKeys` subtracts tombstones — the record_picker trio was
  // harvested that way, and `defaultSort` followed it at 17.3.0)
  // or if objectui un-deprecates a spelling. Do not resolve one by declaring the
  // input; that is the move the ruling refused.
  //
  // Measurement note, reported on objectui#4648 with this change: the ruling
  // enumerated FIVE (`fields` / `staticData` / `selectable` / `pageSize` /
  // `showSearch`) from the fork report's list. Re-deriving the class it named —
  // `@deprecated` in `ObjectGridSchema`, AND declared by GA — measures TEN. The
  // five extra (`showPagination`, `defaultSort`, `defaultFilters`,
  // `resizableColumns`, `title`) are the same class by the same test, so they are
  // carved out with it. `defaultSort` has since been harvested — spec 17.3.0
  // tombstoned it (see the note below), leaving nine. Trimming back to exactly five is a one-line reversal
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
  /*
   * `object-grid.defaultSort` WAS THE NINTH TOMBSTONE HARVESTED HERE —
   * `@objectstack/spec` 17.3.0, and it died the way the eight above did.
   *
   * 17.3.0 converted the key to an ADR-0087 D2 tombstone: its member is
   * `z.never().optional()` and its description opens `[REMOVED] … removed in
   * @objectstack/spec 17 (ADR-0049) — it was the legacy second spelling of
   * `sort` … Rename the key to `sort` and wrap the value in an array`. Read
   * from the installed artifact, not from a changelog: `safeParse` of
   * `{ defaultSort: … }` fails `invalid_type` `expected: 'never'` at that path.
   *
   * So it left the AUTHORABLE set while staying listed, and the two checks that
   * police this list reported it DANGLING and STALE exactly as designed —
   * deleting the entry is the only way to green. The carve-out reason it used
   * to carry is now upstream's own prescription, which is strictly better: the
   * contract refuses the spelling by name and says what to write instead.
   *
   * ⛔ Not resolved by declaring the input. `sort`, the canonical spelling, is
   * declared already, and publishing a key the contract rejects by name is the
   * one resolution the test below forbids in so many words.
   */
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
  // NOT blocked on a contract question any more — that half is settled. The
  // maintainer ruled Option B (2026-08-22) and objectui#5494 landed it:
  // `ReferenceRailEntry` is now DERIVED from `@objectstack/spec/ui`
  // (re-exported, never re-declared — `check:spec-symbols` enforces that), and
  // the `icon` key the old local interface carried retired with the
  // derivation. The spec's `ReferenceRailEntrySchema` is `$strict` over
  // {objectName, relationshipField, title?, limit?, displayField?} and refuses
  // `icon` at save, so it survives on neither side of the contract.
  //
  // The note this replaces also asserted that the renderer READ that key. It
  // did not — that premise was false when it was written, which is the whole
  // reason this block was rewritten (objectui#5792). Measured twice,
  // independently: the spec's `ui-reference-rail-unknown-keys-refused`
  // migration entry, and a grep over `plugin-detail/src` where the only
  // surviving `icon` mention in `record-reference-rail.tsx` is prose, while the
  // same grep finds real reads of `entry.objectName`, `.relationshipField`,
  // `.title`, `.limit` and `.displayField`. So the SHAPE limit above is the
  // entire justification for this exemption — it always was sufficient alone.
  'record:reference_rail.entries':
    'An array of {objectName, relationshipField, title, limit, displayField} objects; `inputs` is a flat scalar carrier and cannot express it. Newly judged rather than newly missing — @objectstack/spec 17.1.0 added record:reference_rail to ComponentPropsMap, and the registration (plugin-detail/src/index.tsx:675) has always published only `hideEmpty` — the 17.1.0 pin, objectui#5328. The flat-carrier shape limit is the entire reason: the `icon` divergence that once also blocked an entries editor was settled by Option B (maintainer 2026-08-22, objectui#5494).',
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

// ── the ARM direction (objectui#4971) ────────────────────────────────────────
//
// Same `covered` set, same derived-not-restated expectations, same exemption
// discipline as the two key-name directions above. What moves is the SUBJECT:
// not which keys a block publishes, but which coarse KINDS it publishes them
// with. One direction only — see the header: widening is silent, narrowing is
// merely noisy.

/**
 * One Zod issue, as far as the arm judge needs to see it.
 *
 * Structural rather than imported: the contract's issues arrive as plain data
 * through `safeParse`, and the three fields read here (`code`, `path`, and the
 * per-branch `errors` of a union) are the stable shape of that data. `keys` is
 * the `unrecognized_keys` payload — see `specArmVerdict`.
 */
interface SpecIssue {
  code?: string;
  path?: readonly unknown[];
  keys?: readonly string[];
  values?: readonly unknown[];
  errors?: readonly (readonly SpecIssue[])[];
}

interface SpecParser {
  safeParse: (value: unknown) => { success: boolean; error?: { issues?: readonly SpecIssue[] } };
}

/** This block's spec props schema as a parser, or `null` when this pin has none. */
function specParser(type: string): SpecParser | null {
  const schema = specSchema(type) as Partial<SpecParser> | undefined;
  return typeof schema?.safeParse === 'function' ? (schema as SpecParser) : null;
}

/**
 * Representative values per coarse arm, in the vocabulary `armAccepts` uses
 * (`packages/sdui-parser/src/validate.ts`) — the arms are KINDS, so one value
 * of the kind is what witnesses it.
 *
 * More than one per structured kind on purpose. `[]` witnesses any array
 * contract regardless of its element type, and `{}` witnesses an object
 * contract whose members are all optional; the second entry is what witnesses
 * the opposite case — a contract with required members, where the empty value
 * fails on CONTENT (which `specArmVerdict` reads as the kind being accepted).
 * Either one answering is enough, which is why the verdict is `some`, not
 * `every`.
 *
 * `color` / `date` / `code` / `file` are the string-family kinds `armAccepts`
 * treats as `typeof value === 'string'`. No registration in this repo declares
 * one today, so their probes are unexercised vocabulary rather than measured —
 * they are here so that a first such declaration is JUDGED rather than silently
 * unjudged, which is what `the probe vocabulary covers every arm a manifest can
 * carry` asserts.
 */
const COARSE_ARM_PROBES: Record<string, readonly unknown[]> = {
  string: ['Account'],
  number: [42],
  boolean: [true],
  array: [[], ['Account']],
  object: [{}, { en: 'Account', 'zh-CN': '客户' }],
  color: ['#336699'],
  date: ['2026-01-01T00:00:00.000Z'],
  code: ['const total = 1;'],
  file: ['logo.png'],
};

/**
 * Arm kinds that carry no value-shaped claim, and so cannot be compared to a
 * contract at all. Listed, never silent (the header's exemption rule).
 *
 * `slot` is the whole list: it names a CHILD POSITION rather than a value, and
 * `armAccepts` admits everything for it (`default: return true`), so "the spec
 * accepts some value of this kind" is not a question about the declaration.
 * `page:card.children` / `.footer` and the three `page:*` container `children`
 * are the five that use it.
 */
const ARM_KINDS_WITHOUT_A_VALUE_CLAIM = new Set(['slot']);

/**
 * The coarse kind of a value, in `armAccepts`'s vocabulary
 * (`packages/sdui-parser/src/validate.ts`).
 *
 * Only ever asked about a value the gate itself produced — a probe, or a
 * declared enum member — so the question is "which arm would admit this", not a
 * general type test. The string family (`color` / `date` / `code` / `file`)
 * collapses to `string` because `armAccepts` makes no distinction between them
 * either: all five admit exactly `typeof value === 'string'`.
 */
function coarseKindOf(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}

/**
 * Is this rejection about the VALUE'S KIND at the node itself, rather than
 * about its CONTENT?
 *
 * `issues` are RELATIVE to the node under judgement — which is why the union
 * recursion below is not a formality. A union's per-branch issues come back
 * with paths relative to the union node (measured: `page:card.title` refused a
 * number as `invalid_union` at `["title"]`, its two branch issues at `[]`), so
 * a judge that kept matching them against the absolute key path would find
 * nothing to refute and pass EVERY union key — including objectui#4971's own
 * `page:card.title` measurement, the one reading this gate exists to turn red.
 *
 *  - an issue DEEPER than the node means the kind was accepted and the content
 *    judged (a missing required member, a bad element) — not a kind refusal;
 *  - `invalid_type` at the node is the kind refusal itself;
 *  - `invalid_union` at the node is one only if EVERY branch refuses the kind;
 *  - `invalid_value` at the node — a closed list of literals — is decided by
 *    the list: a probe of a kind NO listed value has is refused for its kind,
 *    while one that shares a kind with some listed value is refused for its
 *    VALUE. Both halves are load-bearing and were measured on
 *    `record:quick_actions.variant`, a spec enum of strings: `'Account'` must
 *    read as a value refusal (or the block's correct `'string'` arm reads as
 *    invented — the false red triage flagged), and `42` must read as a KIND
 *    refusal (or a `'number'` arm on an enum contract would be exactly the
 *    silent widening this gate exists for, waved through by the same rule that
 *    protects the string arm). One key, both directions, so the two cannot be
 *    collapsed into one answer;
 *  - anything else at the node (`too_small`, `invalid_format`, a custom
 *    refinement) is a VALUE refusal, and the coarse-kind ceiling
 *    (`ComponentInput.type`, maintainer 2026-08-17) puts it outside what an arm
 *    claims.
 */
function refusesKind(issues: readonly SpecIssue[], probed: unknown): boolean {
  const here = issues.filter((issue) => (issue.path ?? []).length === 0);
  if (issues.length > here.length) return false;
  if (here.length === 0) return false;
  return here.every(
    (issue) =>
      issue.code === 'invalid_type' ||
      (issue.code === 'invalid_value' &&
        Array.isArray(issue.values) &&
        issue.values.length > 0 &&
        !issue.values.some((allowed) => coarseKindOf(allowed) === coarseKindOf(probed))) ||
      (issue.code === 'invalid_union' &&
        (issue.errors ?? []).length > 0 &&
        (issue.errors ?? []).every((branch) => refusesKind(branch, probed))),
  );
}

type ArmVerdict = 'accepts' | 'refuses-content' | 'refuses-kind' | 'no-schema';

/**
 * What the contract says about ONE value on ONE key — scoped to that key.
 *
 * Scoped is the load-bearing word. A whole-parse boolean cannot answer this
 * question on any block with a REQUIRED key: `{ filter: {} }` fails
 * `element:number`'s schema for the missing `object` / `aggregate`, and reading
 * that as a verdict on `filter` would report every arm of every key on such a
 * block as invented. So only issues about this key count, and a parse whose
 * every complaint is about a sibling reads as `accepts`.
 */
function specArmVerdict(type: string, key: string, value: unknown): ArmVerdict {
  const parser = specParser(type);
  if (!parser) return 'no-schema';
  const result = parser.safeParse({ [key]: value });
  if (result.success) return 'accepts';
  const issues = result.error?.issues ?? [];
  // The key refused BY NAME — strict-mode contracts report it this way, at the
  // parent with the offending names in `keys`. Defensive: the walk below only
  // judges keys the accepted set already carries.
  if (issues.some((issue) => issue.code === 'unrecognized_keys' && (issue.keys ?? []).includes(key)))
    return 'refuses-kind';
  const mine = issues
    .filter((issue) => (issue.path ?? [])[0] === key)
    .map((issue) => ({ ...issue, path: (issue.path ?? []).slice(1) }));
  if (mine.length === 0) return 'accepts';
  return refusesKind(mine, value) ? 'refuses-kind' : 'refuses-content';
}

/**
 * The values an `enum` arm admits, flattened from either declaration form.
 *
 * The same flattening `enumValues` does in `packages/sdui-parser/src/validate.ts`
 * — that function is module-private, and the two forms (`['a', 'b']` or
 * `[{ label, value }]`) are `ComponentInput.enum`'s own published shape rather
 * than a judgement, so this is a re-read of a data shape, not a second
 * classifier.
 */
function declaredEnumValues(input: ComponentInput): unknown[] {
  return (input.enum ?? []).map((entry) =>
    typeof entry === 'object' && entry !== null ? (entry as { value: unknown }).value : entry,
  );
}

interface ArmJudgement {
  /** `BLOCK.INPUT:ARM` — the exemption key format. */
  id: string;
  type: string;
  input: string;
  arm: string;
  verdict: 'witnessed' | 'refused' | 'exempt-slot' | 'exempt-empty-enum';
  /** What the contract actually answered, for the failure message. */
  evidence: string;
}

/**
 * Judge every arm of every declared input on one block.
 *
 * Inputs whose NAME the contract does not accept are skipped, not judged: they
 * are the FORWARD direction's subject (and its exemption list's), and asking
 * what kind a contract accepts on a key it does not declare has no answer worth
 * reporting. Today that set is empty — `no covered block declares an off-spec
 * input` is what the forward direction asserts — so the skip removes nothing.
 */
function judgeArms(type: string): ArmJudgement[] {
  const accepted = new Set(specTopLevelKeys(type));
  const judgements: ArmJudgement[] = [];
  for (const input of declaredInputEntries(type) ?? []) {
    if (!accepted.has(input.name)) continue;
    for (const arm of inputTypeArms(input.type)) {
      const id = `${type}.${input.name}:${arm}`;
      if (ARM_KINDS_WITHOUT_A_VALUE_CLAIM.has(arm)) {
        judgements.push({ id, type, input: input.name, arm, verdict: 'exempt-slot', evidence: 'describes a child position, not a value' });
        continue;
      }
      if (arm === 'enum') {
        // EXACT, not coarse: `armAccepts` admits precisely the declared members,
        // so every one of them must be a value the contract accepts. This is
        // where an enum arm is judged — the coarse rule never sees it.
        const members = declaredEnumValues(input);
        if (members.length === 0) {
          judgements.push({ id, type, input: input.name, arm, verdict: 'exempt-empty-enum', evidence: 'declares no members, so it admits nothing' });
          continue;
        }
        const refused = members.filter(
          (member) => specArmVerdict(type, input.name, member) !== 'accepts',
        );
        judgements.push({
          id,
          type,
          input: input.name,
          arm,
          verdict: refused.length === 0 ? 'witnessed' : 'refused',
          evidence:
            refused.length === 0
              ? `all ${members.length} declared members accepted`
              : `the contract refuses the declared member(s) ${JSON.stringify(refused)}`,
        });
        continue;
      }
      const probes = COARSE_ARM_PROBES[arm] ?? [];
      const verdicts = probes.map((probe) => specArmVerdict(type, input.name, probe));
      const witnessed = verdicts.some((verdict) => verdict === 'accepts' || verdict === 'refuses-content');
      judgements.push({
        id,
        type,
        input: input.name,
        arm,
        verdict: witnessed ? 'witnessed' : 'refused',
        evidence: witnessed
          ? `probe verdicts ${JSON.stringify(verdicts)}`
          : `the contract refuses the KIND itself — probe verdicts ${JSON.stringify(verdicts)}`,
      });
    }
  }
  return judgements;
}

/** Every arm judgement this gate makes, computed once. */
const ARM_JUDGEMENTS: ArmJudgement[] = covered.flatMap(judgeArms);

/** Arms of `type` the contract refuses outright, as `BLOCK.INPUT:ARM`. */
const refusedArms = (type: string): string[] =>
  ARM_JUDGEMENTS.filter((judgement) => judgement.type === type && judgement.verdict === 'refused').map(
    (judgement) => judgement.id,
  );

/**
 * Declared arms the contract refuses, ACCEPTED for now, each with the reason.
 * Key format: `BLOCK.INPUT:ARM`.
 *
 * Third instance of this file's one exemption discipline, and the bar is the
 * same as `OFF_SPEC_EXEMPTIONS`': the divergence has to be owned by a named,
 * open piece of work, because neither `@objectstack/spec` nor a declaration is
 * edited to make a gate green (AGENTS.md #0 / #0.1). Every reason cites an
 * issue, which `every arm exemption states a reason and references a tracking
 * issue` asserts, and an entry that stops describing anything is DELETED by
 * `carries no stale arm exemption`.
 *
 * BOTH ENTRIES ARE RED-ON-ARRIVAL FINDINGS, not regressions this change
 * introduced. objectui#4971 was filed believing there were ZERO fake arms —
 * true of what it had measured, which was #3832's five multi-arm specimens,
 * each checked against spec and its renderer. These two are SINGLE-arm
 * declarations, the form that predates #3832's array `type` entirely, and
 * nothing had ever compared one to the contract. Finding them on arrival is the
 * gate working, and the dispatched scope of #4971 is explicit that a red on
 * arrival gets REPORTED rather than declared away by editing the declaration.
 */
const OFF_SPEC_ARM_EXEMPTIONS: Record<string, string> = {
  /*
   * EMPTY, AND THAT IS THE RESULT — both entries were harvested at
   * `@objectstack/spec` 17.3.0, each resolved upstream in the direction its own
   * reason named. Measured with this gate's own coarse probes against the
   * installed artifact:
   *
   *   - `element:number.filter:array` (objectui#6206) — the spec entry was a
   *     record and refused an array outright; 17.3.0 accepts `[]` and answers
   *     `invalid_type` at `filter.0` for `['Account']`. So the ARRAY KIND is
   *     accepted and only the content is judged, which is the first of the two
   *     resolutions the reason offered: "widening the spec entry to the
   *     ViewFilterRule array form every sibling filter uses". The declaration
   *     was right; the contract moved to it.
   *   - `object-grid.data:object` (objectui#6207) — the two spec authorities
   *     that disagreed have converged. `ComponentPropsMap[object-grid].data`
   *     was `z.array(z.unknown())`; it now answers `invalid_union` at
   *     `data.provider` for an object probe, i.e. the discriminated
   *     `ViewDataSchema` shape `ObjectGridSchema.data` already resolved to.
   *     That is exactly the "convergence is upstream" the entry was waiting on,
   *     and the `object` arm objectui#5090 / PR objectui#5108 deliberately
   *     chose is now the contract's own.
   *
   * ⛔ Neither was closed by editing a declaration — both declarations are
   * byte-identical to what they were; the contract changed underneath them.
   * `carries no stale arm exemption` is what forced the deletion, which is this
   * file's exemption discipline working end to end. objectui#6206 and #6207 can
   * be closed as resolved-upstream; reported on objectui#7122.
   */
};

// ── the MEMBER direction (objectui#8067) ─────────────────────────────────────
//
// The first of the two LIMITs in this file's header, closed. `ComponentInput`
// now carries `of` — the coarse KIND of an input's members, array elements or
// the values of an object used as a map — so the `inputs` side can finally say
// what a container holds, and this section compares it to what the contract
// holds. Same `covered` set, same derived-not-restated expectations, same
// exemption discipline as the three directions above, and the same ONE
// DIRECTION for the same reason: a member kind the contract REFUSES is silent
// (the manifest, the generated `.d.ts` and `validateTree` all publish it as
// legal), while declaring FEWER member kinds than the contract accepts is
// merely noisy, and noise is audible.
//
// WHAT THIS COST BEFORE IT EXISTED. `page:header.actions` — spec
// `z.array(z.string())`, "Action IDs"; the renderer read the members as
// `ActionDef` OBJECTS; this gate saw `actions` on both sides and stayed green
// for the whole life of the drift. What settled it was a maintainer ruling, not
// a test, and even after the fix the fact "these are ids" lived only in the
// registration's `description` PROSE. It is now `of: 'string'` at that
// registration, and the calibration pin below asserts, by name, that this gate
// reds on `of: 'object'` there — the exact declaration the drift would have
// made.

/**
 * The container arms a member declaration can describe.
 *
 * `of` means the same thing on each: the ELEMENTS of the array, and the VALUES
 * of an object used as a MAP. An input declaring `of` and neither of these has
 * no member position at all, which `judgeMembers` reports rather than skips.
 */
const CONTAINER_ARMS = new Set(['array', 'object']);

/**
 * The key a member probe occupies when the container arm is `object`.
 *
 * Deliberately a name no contract declares, because the two answers it can draw
 * are exactly the two cases that need telling apart: a MAP contract
 * (`z.record(...)`) judges the value under whatever key it is given, while a
 * NAMED-SHAPE contract (`z.object({ ... })`) refuses the key itself at the
 * container node — which is not a verdict about the member kind, it is the
 * absence of a uniform member position.
 */
const OBJECT_MEMBER_PROBE_KEY = '__objectui_member_probe__';

/** The value that puts one member probe in the member position of a container arm. */
function containerProbe(containerArm: string, member: unknown): { value: unknown; position: unknown } {
  return containerArm === 'array'
    ? { value: [member], position: 0 }
    : { value: { [OBJECT_MEMBER_PROBE_KEY]: member }, position: OBJECT_MEMBER_PROBE_KEY };
}

type MemberVerdict = ArmVerdict | 'no-member-position';

/**
 * What the contract says about ONE member value, in ONE container arm, on ONE
 * key.
 *
 * The same scoping discipline `specArmVerdict` is built on, one level deeper:
 * only issues about this key count, and of those only the ones at the MEMBER's
 * own position, so a sibling key's missing requirement cannot speak for a
 * member and a complaint about the container cannot either. Once the issues are
 * rebased onto the member node, the judgement is `refusesKind` — the same
 * function, unchanged, because "is this a KIND refusal or a CONTENT refusal" is
 * the same question at any depth.
 *
 * `no-member-position` is the verdict this level adds, and it is not a shrug:
 * it means the contract refused the CONTAINER — either its kind outright, or,
 * for an `object` arm, the probe key itself, which is how a named-shape
 * `z.object({ ... })` says it is not a map. A declaration claiming uniform
 * members of a contract that has no uniform member position is wrong in a way
 * worth naming, so the gate below treats it as a refusal rather than skipping
 * it.
 */
function specMemberVerdict(
  type: string,
  key: string,
  containerArm: string,
  member: unknown,
): MemberVerdict {
  const parser = specParser(type);
  if (!parser) return 'no-schema';
  const { value, position } = containerProbe(containerArm, member);
  const result = parser.safeParse({ [key]: value });
  if (result.success) return 'accepts';
  const issues = result.error?.issues ?? [];
  // The key refused BY NAME at the top — the forward direction's subject, and
  // `judgeMembers` only judges keys the accepted set already carries.
  if (issues.some((issue) => issue.code === 'unrecognized_keys' && (issue.keys ?? []).includes(key)))
    return 'no-member-position';
  const mine = issues.filter((issue) => (issue.path ?? [])[0] === key);
  if (mine.length === 0) return 'accepts';
  // Anything AT the container node is about the container, not the member: an
  // `invalid_type` refusing the container kind, or the `unrecognized_keys` a
  // named-shape object raises for the probe key.
  if (mine.some((issue) => (issue.path ?? []).length === 1)) return 'no-member-position';
  const atMember = mine
    .filter((issue) => (issue.path ?? [])[1] === position)
    .map((issue) => ({ ...issue, path: (issue.path ?? []).slice(2) }));
  if (atMember.length === 0) return 'accepts';
  return refusesKind(atMember, member) ? 'refuses-kind' : 'refuses-content';
}

interface MemberJudgement {
  /** `BLOCK.INPUT:of=ARM` — the exemption key format. */
  id: string;
  type: string;
  input: string;
  arm: string;
  verdict: 'witnessed' | 'refused' | 'exempt-slot' | 'exempt-empty-enum' | 'no-container-arm';
  /** What the contract actually answered, for the failure message. */
  evidence: string;
}

/**
 * Judge every declared member arm of every declared input on one block.
 *
 * An input that declares no `of` produces no judgement — this direction asks
 * what a DECLARATION claims, and there is nothing to compare against a key that
 * claims nothing. (What that silence costs is the LIMIT this section closes;
 * which keys deserve a declaration and which are left to per-block discipline
 * is recorded on `ComponentInput.of` and pinned by
 * `member declarations are derived from single-kind member contracts` below.)
 *
 * Off-spec input names are skipped for the same reason `judgeArms` skips them:
 * asking what members a contract accepts inside a key it does not declare has
 * no answer worth reporting.
 */
function judgeMembers(type: string): MemberJudgement[] {
  const accepted = new Set(specTopLevelKeys(type));
  const judgements: MemberJudgement[] = [];
  for (const input of declaredInputEntries(type) ?? []) {
    if (!accepted.has(input.name)) continue;
    const memberArms = inputTypeArms(input.of as never);
    if (memberArms.length === 0) continue;
    const containerArms = inputTypeArms(input.type).filter((arm) => CONTAINER_ARMS.has(arm));
    for (const arm of memberArms) {
      const id = `${type}.${input.name}:of=${arm}`;
      if (containerArms.length === 0) {
        judgements.push({
          id, type, input: input.name, arm,
          verdict: 'no-container-arm',
          evidence: `declares members but its type is ${JSON.stringify(input.type)}, which holds none`,
        });
        continue;
      }
      if (ARM_KINDS_WITHOUT_A_VALUE_CLAIM.has(arm)) {
        judgements.push({
          id, type, input: input.name, arm,
          verdict: 'exempt-slot',
          evidence: 'describes a child position, not a value',
        });
        continue;
      }
      if (arm === 'enum') {
        // EXACT, not coarse — the same rule the `enum` ARM is judged by, since
        // an enum's admitted set is finite and written down. Every declared
        // member must be a value the contract accepts SOMEWHERE in the member
        // position of some declared container arm.
        const members = declaredEnumValues(input);
        if (members.length === 0) {
          judgements.push({
            id, type, input: input.name, arm,
            verdict: 'exempt-empty-enum',
            evidence: 'declares no members, so it admits nothing',
          });
          continue;
        }
        const refused = members.filter((member) =>
          !containerArms.some(
            (containerArm) => specMemberVerdict(type, input.name, containerArm, member) === 'accepts',
          ),
        );
        judgements.push({
          id, type, input: input.name, arm,
          verdict: refused.length === 0 ? 'witnessed' : 'refused',
          evidence:
            refused.length === 0
              ? `all ${members.length} declared members accepted`
              : `the contract refuses the declared member(s) ${JSON.stringify(refused)}`,
        });
        continue;
      }
      const probes = COARSE_ARM_PROBES[arm] ?? [];
      const verdicts = containerArms.flatMap((containerArm) =>
        probes.map((probe) => specMemberVerdict(type, input.name, containerArm, probe)),
      );
      const witnessed = verdicts.some(
        (verdict) => verdict === 'accepts' || verdict === 'refuses-content',
      );
      judgements.push({
        id, type, input: input.name, arm,
        verdict: witnessed ? 'witnessed' : 'refused',
        evidence: witnessed
          ? `member probe verdicts ${JSON.stringify(verdicts)}`
          : `the contract admits no member of this KIND — member probe verdicts ${JSON.stringify(verdicts)}`,
      });
    }
  }
  return judgements;
}

/** Every member judgement this gate makes, computed once. */
const MEMBER_JUDGEMENTS: MemberJudgement[] = covered.flatMap(judgeMembers);

/** The verdicts that mean "the contract will not have this member declaration". */
const MEMBER_REFUSALS = new Set(['refused', 'no-container-arm']);

/** Member arms of `type` the contract refuses, as `BLOCK.INPUT:of=ARM`. */
const refusedMembers = (type: string): string[] =>
  MEMBER_JUDGEMENTS.filter(
    (judgement) => judgement.type === type && MEMBER_REFUSALS.has(judgement.verdict),
  ).map((judgement) => judgement.id);

/**
 * Declared MEMBER arms the contract refuses, ACCEPTED for now, each with the
 * reason. Key format: `BLOCK.INPUT:of=ARM`.
 *
 * Fourth instance of this file's one exemption discipline, and the bar is
 * unchanged: the divergence has to be owned by a named, open piece of work,
 * because neither `@objectstack/spec` nor a declaration is edited to make a
 * gate green (AGENTS.md #0 / #0.1).
 *
 * EMPTY ON ARRIVAL, and that is a measurement rather than an accident. Every
 * `of` this repository declares was DERIVED from the contract — each container
 * key's member position was probed with one value of each coarse kind, and a
 * declaration was written only where exactly ONE kind was accepted — so a
 * refusal here would mean the derivation and the contract disagree, which is a
 * finding, not an exemption.
 */
const OFF_SPEC_MEMBER_EXEMPTIONS: Record<string, string> = {};

/**
 * Container keys whose member contract accepts MORE THAN ONE coarse kind, and
 * are therefore deliberately left without an `of`.
 *
 * Pinned rather than merely absent, because "no declaration" and "no
 * declaration for a reason" are the same byte in the registration and opposite
 * facts about this gate. Declaring one arm of a genuine member union is the
 * NARROWING this repo leaves un-gated as noise (#4971), and declaring all of
 * them would advertise member shapes the renderer may not resolve — the rule
 * `ComponentInput.type` states for arms, one level down. Either way it is
 * per-block knowledge, not a repo-wide derivation, so it stays out of this
 * change.
 */
const MULTI_KIND_MEMBER_CONTRACTS: Record<string, string> = {
  'record:highlights.fields':
    'The member contract is a union — a field NAME or an inline field object — so no single coarse arm describes it and declaring both would advertise a member shape only the per-block pin next to the renderer can vouch for (packages/plugin-detail/src/__tests__/recordHighlightsInputs.spec-parity.test.ts). objectui#8067 leaves it undeclared on purpose.',
};

// ── the MEMBER-PIN direction (objectui#8068) ─────────────────────────────────
//
// The four directions above judge a block's DECLARATION — which top-level keys
// it publishes, with which coarse kinds, and (since objectui#8067 landed
// alongside this one) with which coarse kind INSIDE a container. None of them
// can see the member's own KEYS, and the LIMIT note at the top of this file says
// so in as many words: `of` "stops at the KIND … `of: 'object'` says the members
// are objects, never WHICH KEYS they have", so a drifted key INSIDE an array
// element or a nested object is still invisible here.
//
// ⚠️ That merge changed a NUMBER in this paragraph and nothing else in this
// direction. `of` is a DECLARATION, not a pin, so it neither satisfies nor
// exempts anything below: the population this direction judges, its ledger and
// its ceiling are the same on the merged tree as they were on the branch that
// measured them.
//
// That note then names the mitigation — `record:details.sections`,
// `record:highlights.fields` and `record:related_list.add` "publish their
// members in prose and are pinned by per-block tests next to their renderers".
// All three pins are real. What was NOT real is any requirement that a fourth
// key get one.
//
// `page:header.actions` is that fourth key, and it is the measurement this
// direction exists for. Array-typed, member shape in `description` prose only
// (`packages/components/src/renderers/layout/containers.tsx`), spec
// `z.array(z.string())` — action IDs — while the renderer read the members as
// `ActionDef` OBJECTS and resolved nothing, so metadata satisfying the published
// contract rendered ZERO buttons. Every layer was green: the key names are in
// parity (forward and reverse), the `'array'` arm is a kind the contract accepts
// (the arm direction), and no per-block test existed to look inside. It took a
// human filing objectstack#11592 and a maintainer ruling (2026-08-25) to settle
// it, and `packages/components/src/__tests__/page-header-action-ids.test.tsx` —
// the fourth pin — arrived as part of that FIX (objectui#6252), not because
// anything demanded it.
//
// Three keys got it right, the fourth did not, and nothing noticed the fourth.
// So the discipline stops being voluntary here: every array/object-armed input
// on a covered block must name a pin, or carry an exemption.
//
// ## WHAT THIS DIRECTION CAN AND CANNOT JUDGE
//
// The criterion objectui#8068 sets is a JUDGEMENT, not a computation: a pin must
// constrain the shape the renderer actually READS, rather than restate the
// registration. A registration saying `of: 'string'` while the code reads
// members as objects is the exact hole, and no mechanical reader can tell the
// two apart — the four exemplars do it four different ways (a description
// derived from the spec's element schema, a spec-vs-declaration arm set, a
// renderer-default comparison, and a twice-authored render equivalence).
//
// So this direction is built the way every exemption in this file is: the
// judgement is made in a diff someone reviews, and what is MECHANISED is the
// part that rots silently. A registered pin must
//
//   1. exist on disk — a deleted or renamed pin file is the failure mode that
//      leaves the key uncovered while the registry entry still reads deliberate;
//   2. be a file the test runner collects, so "pinned" means "executed";
//   3. NAME the block and NAME the key, so an entry cannot point at a file that
//      says nothing about this key. That is the locator, and it is why the
//      calibration below asserts it discriminates: a check that matched any file
//      would license every entry at once.
//
// ## THE POPULATION, MEASURED FIRST — 58 of 77 (objectui#8071)
//
// objectui#8068 required the number before the gate, because the number chooses
// the route: single digits means add the pins and let the gate bite, dozens
// means a transition. Measured on this branch, over this file's own `covered`
// set: 77 array/object-armed inputs across 22 blocks, of which 19 already have a
// pin that meets both the criterion and the locator. 58 do not.
//
// 58 is the transition case, and this file already owns the pattern for it —
// `OFF_SPEC_EXEMPTIONS` / `UNPUBLISHED_EXEMPTIONS` / `OFF_SPEC_ARM_EXEMPTIONS`
// are explicit, reasoned, issue-backed, and go RED once stale. This is the same
// mechanism, not a second one: `MEMBER_PIN_EXEMPTIONS` below lists all 58 BY
// NAME, every entry cites objectui#8071 (which owns writing the pins), and an
// entry whose key acquires a pin is reported STALE and must be deleted in the
// same change. The list has a CEILING as well as a stale check, because the
// cheap way to green a new array key is to add a 59th entry rather than a pin.
//
// ## WHAT IS DELIBERATELY NOT IN THE POPULATION, stated rather than dropped
//
// `covered` — this file's own set, spec-carried blocks that declare inputs — is
// the population, unchanged. The wider registration graph carries 310
// array/object-armed inputs across 501 registered type names (aliases included:
// `object-grid`, `plugin-grid:object-grid` and `view:grid` are three names for
// one registration), and 233 of those sit on blocks with no `ComponentPropsMap`
// entry. NO direction in this file has ever judged them — a member pin needs a
// published contract to compare a member shape against, and those blocks have
// none. That boundary is pre-existing rather than a narrowing taken here, and it
// is recorded in objectui#8071 so it cannot go quiet.

/** Coarse arms whose values have a MEMBER shape this file cannot see. */
const STRUCTURED_ARMS = new Set(['array', 'object']);

/** One declared input that carries a member shape, as this direction sees it. */
interface StructuredInput {
  /** `BLOCK.INPUT` — the registry/exemption key format used throughout. */
  id: string;
  type: string;
  input: string;
  arms: string[];
}

/**
 * Every array/object-armed input on a covered block — the population this
 * direction judges.
 *
 * Deliberately NOT filtered to keys the contract accepts, unlike `judgeArms`.
 * That filter is right there — an arm makes a claim ABOUT the contract, so a key
 * the contract does not declare has no arm question to answer — and wrong here:
 * a member shape is a claim about what the RENDERER reads, which an off-spec key
 * makes just as loudly. Today the two sets coincide (`no covered block declares
 * an off-spec input`), so the choice removes nothing and cannot hide anything;
 * it is stated because the day they diverge, the stricter reading is the one
 * this card asked for.
 */
const structuredInputs: StructuredInput[] = covered.flatMap((type) =>
  (declaredInputEntries(type) ?? [])
    .map((input) => ({
      id: `${type}.${input.name}`,
      type,
      input: input.name,
      arms: inputTypeArms(input.type),
    }))
    .filter((entry) => entry.arms.some((arm) => STRUCTURED_ARMS.has(arm))),
);

/** The array/object-armed inputs of one covered block. */
const structuredInputsOf = (type: string): StructuredInput[] =>
  structuredInputs.filter((entry) => entry.type === type);

/** A registered per-block member pin. */
interface MemberPin {
  /** Repo-relative path of the test file that pins this key's member shape. */
  file: string;
  /** WHAT it constrains — the half a reader needs and the locator cannot check. */
  pins: string;
}

/**
 * The per-block member pins this repo has, by key.
 *
 * An entry is a claim that the named file constrains the member shape the
 * RENDERER reads for that key — the criterion objectui#8068 sets, and the one
 * thing here that is reviewed rather than computed. `pins` says which assertion
 * carries the claim, so the next reader can check it in one hop instead of
 * re-deriving why the file counts.
 *
 * The four objectui#8068 names are all here: the three the LIMIT note at the top
 * of this file already delegated to (`record:details.sections`,
 * `record:highlights.fields`, `record:related_list.add`) and the fourth that
 * arrived with objectui#6252's fix rather than from any mechanism
 * (`page:header.actions`). They are asserted BY NAME below, because they are the
 * calibration for everything else: if the population or the locator ever stops
 * recognising those four, this direction has stopped describing the defect it
 * was built for.
 */
const MEMBER_PINS: Record<string, MemberPin> = {
  'element:button.label': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map `{ en, "zh-CN" }` and nothing else — driven through the real `manifestFromConfigs` + `validateTree` pair the JSX-page compiler and the save gate use, each positive paired with a value matching NEITHER arm that must still be reported (objectui#4970).',
  },
  'element:record_picker.emptyText': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map, asserted at the render site that actually resolves one, with the non-matching controls (`42`, `["No records"]`) still reported (objectui#3832).',
  },
  'element:record_picker.filter': {
    file: 'packages/components/src/__tests__/record-picker-inputs-spec-parity.test.ts',
    pins: 'The `object` arm is `FilterConditionSchema` — field keys plus `$and`/`$or`/`$not` — with the rule-ARRAY spelling every sibling `filter` uses rejected outright, and the description pinned to the renderer\'s own precedence read (`composed?.filter ?? props.filter`), objectui#3830.',
  },
  'element:text.content': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map, derived from the spec\'s own verdicts rather than restated, with a non-matching control (objectui#4970).',
  },
  'element:text_input.description': {
    file: 'packages/components/src/__tests__/text-input-inputs-spec-parity.test.ts',
    pins: 'The I18nLabel trio: the declared arms equal the arms the spec accepts as a SET in both directions, the `object` arm is the locale map, and the description must teach `zh-CN` and the locale-aware resolution the read site performs (objectui#5717).',
  },
  'element:text_input.label': {
    file: 'packages/components/src/__tests__/text-input-inputs-spec-parity.test.ts',
    pins: 'The I18nLabel trio — see `element:text_input.description` (objectui#5717).',
  },
  'element:text_input.placeholder': {
    file: 'packages/components/src/__tests__/text-input-inputs-spec-parity.test.ts',
    pins: 'The I18nLabel trio — see `element:text_input.description` (objectui#5717).',
  },
  'object-grid.data': {
    file: 'packages/plugin-grid/src/__tests__/gridDataInputContract.test.ts',
    pins: 'The `object` arm is `ViewDataSchema` discriminated on `provider`: each of the four providers parses, none of them is an array, the declaration is one shape across both registered tags so the alias cannot drift, and it is pinned at compile time too (objectui#5090).',
  },
  'page:card.title': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map, with a non-matching control that must still be reported (objectui#3832).',
  },
  'page:header.actions': {
    file: 'packages/components/src/__tests__/page-header-action-ids.test.tsx',
    pins: 'THE card\'s own key. The members are ACTION IDS, not `ActionDef` objects: the same action metadata is authored twice — once as ids, once as inline objects — and the two renders are compared, with the object-shape render as a live non-empty control so an id-side green cannot come from two empty headers agreeing. Covers placement, `requiredPermissions`, `visible` and `order` (objectui#6252, objectstack#11592).',
  },
  'page:header.subtitle': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map, with a non-matching control (objectui#3832).',
  },
  'page:header.title': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map, with a non-matching control (objectui#3832).',
  },
  'record:alert.body': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map, with a non-matching control (objectui#3832).',
  },
  'record:alert.title': {
    file: 'apps/console/src/__tests__/component-input-union-specimens.test.ts',
    pins: 'The `object` arm is the inline translation map, with a non-matching control (objectui#3832).',
  },
  'record:details.fields': {
    file: 'packages/plugin-detail/src/__tests__/recordDetailsInputs.spec-parity.test.ts',
    pins: 'Members are BARE NAMES: the spec rejects the entry-object spelling on its value, the description is asserted non-empty first and then required to teach no entry shape, and the renderer\'s more tolerant read is recorded as unexercised drift rather than a second contract.',
  },
  'record:details.hideFields': {
    file: 'packages/plugin-detail/src/__tests__/recordDetailsInputs.spec-parity.test.ts',
    pins: 'Members are bare names — the object spelling is rejected on its VALUE (a full parse, not a strip), and the description may not teach `{` (objectui#3808).',
  },
  'record:details.sections': {
    file: 'packages/plugin-detail/src/__tests__/recordDetailsInputs.spec-parity.test.ts',
    pins: 'Members are OBJECTS: every spec member key must be discoverable from the description, the retired section-id spelling must be ruled out by name, and the three renderer-only keys the spec refuses (`title`, `showBorder`, `hideEmpty`) may not be taught — filtered through the spec at runtime so a stale prohibition drops out on its own (objectui#3807).',
  },
  'record:highlights.fields': {
    file: 'packages/plugin-detail/src/__tests__/recordHighlightsInputs.spec-parity.test.ts',
    pins: 'Members are objects carrying `readonly` PER ENTRY — asserted to be per-entry rather than top-level, and every spec entry key must be discoverable from the `fields` description (objectui#3407).',
  },
  'record:related_list.add': {
    file: 'packages/plugin-detail/src/__tests__/recordRelatedListInputs.spec-parity.test.ts',
    pins: 'Every spec member key of `add` must be discoverable from its description, the published defaults must be the RENDERER\'s rather than the spec\'s prose, and `picker.filter` must be documented as a real restriction (objectui#3808).',
  },
};

/**
 * The reason every entry in `MEMBER_PIN_EXEMPTIONS` carries today.
 *
 * One shared constant rather than 58 near-copies, because the reason really is
 * uniform and a copy is what drifts: none of these keys has a pin, and writing
 * 58 of them is not the dispatched scope of the card that built this direction.
 * objectui#8068 prescribes the transition itself for a population this size, and
 * objectui#8071 owns the work — key by key, deleting an entry here in the same
 * change that registers its pin.
 *
 * A key that needs a DIFFERENT reason — a shape a pin genuinely cannot express,
 * a contract question upstream owns — gets its own string. The map is
 * `Record<string, string>` precisely so that stays possible without a second
 * mechanism.
 */
const AWAITING_A_PIN =
  'No per-block member pin today. Measured with objectui#8068: 58 of the 77 array/object-armed ' +
  'inputs on covered blocks had none, which is the population size that card prescribes a ' +
  'self-deleting transition for rather than a same-PR sweep. objectui#8071 owns writing the pin; ' +
  'delete this entry in the same change that registers it.';

/**
 * Array/object-armed inputs accepted WITHOUT a member pin for now, each with the
 * reason. Key format: `BLOCK.INPUT`.
 *
 * Fourth instance of this file's one exemption discipline, and the bar is the
 * one the three above already set: the divergence is explicit, reasoned,
 * issue-backed, and DELETED by a failing test once it stops describing anything.
 * `carries no stale member-pin exemption` fires the moment a key here acquires a
 * pin, and `every member-pin exemption names a key that is still
 * array/object-armed` fires when a key leaves the population.
 *
 * The ceiling below is the other half, and it is what makes this a transition
 * rather than an allowlist: a NEW array-typed key cannot be absorbed by adding a
 * 59th entry, because the count may only go down.
 */
const MEMBER_PIN_EXEMPTIONS: Record<string, string> = {
  // element:button
  'element:button.action': AWAITING_A_PIN,

  // element:number
  'element:number.filter': AWAITING_A_PIN,

  // element:record_picker
  'element:record_picker.dataSource': AWAITING_A_PIN,
  'element:record_picker.label': AWAITING_A_PIN,
  'element:record_picker.placeholder': AWAITING_A_PIN,
  'element:record_picker.sort': AWAITING_A_PIN,

  // object-form
  'object-form.customFields': AWAITING_A_PIN,
  'object-form.dataSource': AWAITING_A_PIN,
  'object-form.fields': AWAITING_A_PIN,
  'object-form.initialData': AWAITING_A_PIN,
  'object-form.initialValues': AWAITING_A_PIN,
  'object-form.mobile': AWAITING_A_PIN,
  'object-form.sections': AWAITING_A_PIN,
  'object-form.submitBehavior': AWAITING_A_PIN,

  // object-grid
  'object-grid.aggregations': AWAITING_A_PIN,
  'object-grid.batchActions': AWAITING_A_PIN,
  'object-grid.bulkActionDefs': AWAITING_A_PIN,
  'object-grid.bulkActions': AWAITING_A_PIN,
  'object-grid.columns': AWAITING_A_PIN,
  'object-grid.conditionalFormatting': AWAITING_A_PIN,
  'object-grid.dataSource': AWAITING_A_PIN,
  'object-grid.exportOptions': AWAITING_A_PIN,
  'object-grid.filter': AWAITING_A_PIN,
  'object-grid.grouping': AWAITING_A_PIN,
  'object-grid.navigation': AWAITING_A_PIN,
  'object-grid.operations': AWAITING_A_PIN,
  'object-grid.pagination': AWAITING_A_PIN,
  'object-grid.rowActions': AWAITING_A_PIN,
  'object-grid.rowColor': AWAITING_A_PIN,
  'object-grid.searchableFields': AWAITING_A_PIN,
  'object-grid.selection': AWAITING_A_PIN,
  'object-grid.sort': AWAITING_A_PIN,

  // object-master-detail-form
  'object-master-detail-form.dataSource': AWAITING_A_PIN,
  'object-master-detail-form.details': AWAITING_A_PIN,
  'object-master-detail-form.fields': AWAITING_A_PIN,
  'object-master-detail-form.initialData': AWAITING_A_PIN,
  'object-master-detail-form.initialValues': AWAITING_A_PIN,
  'object-master-detail-form.sections': AWAITING_A_PIN,

  // object-metric
  'object-metric.aggregate': AWAITING_A_PIN,
  'object-metric.compareTo': AWAITING_A_PIN,
  'object-metric.dataSource': AWAITING_A_PIN,
  'object-metric.drillDown': AWAITING_A_PIN,
  'object-metric.filter': AWAITING_A_PIN,
  'object-metric.trend': AWAITING_A_PIN,

  // page:accordion
  'page:accordion.items': AWAITING_A_PIN,

  // page:tabs
  'page:tabs.items': AWAITING_A_PIN,

  // record:activity
  'record:activity.types': AWAITING_A_PIN,

  // record:alert
  'record:alert.action': AWAITING_A_PIN,

  // record:chatter
  'record:chatter.feed': AWAITING_A_PIN,

  // record:discussion
  'record:discussion.feed': AWAITING_A_PIN,

  // record:path
  'record:path.stages': AWAITING_A_PIN,

  // record:quick_actions
  'record:quick_actions.actionNames': AWAITING_A_PIN,
  'record:quick_actions.requiredPermissions': AWAITING_A_PIN,

  // record:related_list
  'record:related_list.actions': AWAITING_A_PIN,
  'record:related_list.columns': AWAITING_A_PIN,
  'record:related_list.dataSource': AWAITING_A_PIN,
  'record:related_list.filter': AWAITING_A_PIN,
  'record:related_list.sort': AWAITING_A_PIN,
};

/**
 * How many keys may be exempt. Ratchet: this number may only ever go DOWN.
 *
 * Measured with objectui#8068 and pinned so the list cannot grow. Without it the
 * cheapest way to green a newly added array-typed input is an exemption entry
 * with the same reason as its 58 neighbours — which is exactly the "voluntary"
 * state this direction was built to end, one entry further in.
 */
const MEMBER_PIN_EXEMPTION_CEILING = 58;

/**
 * Every test file a member pin can live in, as LAZY `?raw` loaders.
 *
 * Vite's glob, not `node:fs`, and that is a constraint rather than a taste: this
 * app's tsconfig is browser-only (`lib: ES2020, DOM`, `types` without `node`),
 * so a `node:fs` import passes under Vitest and fails the console's own `tsc` —
 * the trap `insecure-origin-crypto.placement.test.ts` and
 * `__tests__/helpers/preview-page-sources.ts` both record. It is also the better
 * instrument here: the glob is expanded against the real directory at transform
 * time, so the KEY SET alone answers "does this pin file still exist", which is
 * the failure this locator exists to catch.
 *
 * LAZY on purpose. `eager: true` would inline the raw text of every test file in
 * the repo — 2,000+ files, ~3 MB — into this module on every run of a gate that
 * already loads the whole registration graph. Lazy hands back loaders, so the
 * cost is the glob itself plus one read per REGISTERED pin (19 today).
 */
const PIN_SOURCES = import.meta.glob(
  [
    '../../../../packages/*/src/**/*.test.ts',
    '../../../../packages/*/src/**/*.test.tsx',
    '../../**/*.test.ts',
    '../../**/*.test.tsx',
  ],
  { query: '?raw', import: 'default' },
) as Record<string, () => Promise<string>>;

/** This file's own directory, repo-relative — the anchor the glob keys resolve against. */
const THIS_DIR = 'apps/console/src/__tests__';

/** A glob key (`../../../../packages/…`) as a repo-relative path. */
function repoPathOfGlobKey(key: string): string {
  const out: string[] = [];
  for (const segment of `${THIS_DIR}/${key}`.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

/** Pin sources by repo-relative path — the spelling `MEMBER_PINS` entries use. */
const PIN_SOURCE_BY_PATH = new Map<string, () => Promise<string>>(
  Object.entries(PIN_SOURCES).map(([key, load]) => [repoPathOfGlobKey(key), load]),
);

/** Vitest collects `*.test.ts` / `*.test.tsx`; anything else would never run. */
const IS_A_COLLECTED_TEST_FILE = /\.test\.tsx?$/;

/**
 * What is WRONG with one registered pin, or `null` when nothing is.
 *
 * Three failures, and each is a way a pin stops covering its key while the
 * registry entry still reads deliberate: the file was deleted, renamed or moved
 * out of the glob's reach; it is not a file the runner collects, so "pinned"
 * would not mean "executed"; or it does not mention this block and this key at
 * all, which is what an entry pointed at the wrong file looks like.
 *
 * The key match is word-boundaried. A substring match would accept `fields` for
 * `hideFields` — those two are pinned by the SAME file here, so the weaker form
 * would be satisfied by the wrong assertion.
 */
async function memberPinProblem(id: string, pin: MemberPin): Promise<string | null> {
  const [type, key] = splitExemptionKey(id);
  if (!IS_A_COLLECTED_TEST_FILE.test(pin.file)) {
    return `${id} -> ${pin.file}: not a *.test.ts(x) file, so the runner never collects it`;
  }
  const load = PIN_SOURCE_BY_PATH.get(pin.file);
  if (!load) {
    return `${id} -> ${pin.file}: no such pin file (deleted, renamed, or moved outside the glob)`;
  }
  const text = await load();
  if (!text.includes(type)) return `${id} -> ${pin.file}: pin file never names the block \`${type}\``;
  if (!new RegExp(`\\b${key}\\b`).test(text)) {
    return `${id} -> ${pin.file}: pin file never names the key \`${key}\``;
  }
  return null;
}

/** Ids with neither a pin nor an exemption — the new red. */
const unpinnedMembersOf = (type: string): string[] =>
  structuredInputsOf(type)
    .map((entry) => entry.id)
    .filter((id) => !(id in MEMBER_PINS) && !(id in MEMBER_PIN_EXEMPTIONS));

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

  it('the node-level key set is derived, discriminating, and not empty', () => {
    // Non-vacuity and calibration for the widening above, in both directions —
    // a reader that returned [] would silently stop widening (every gate-wrapped
    // block reds), and one that returned everything would stop being a gate.
    const nodeKeys = nodeLevelSpecKeys();
    expect(nodeKeys.length).toBeGreaterThan(0);
    // Accepted, and measured rather than assumed: `PageComponentSchema.safeParse`
    // keeps `dataSource` on a bare node and drops the two spellings the
    // objectui#6598 reporter tried instead.
    expect(nodeKeys).toContain('dataSource');
    expect(nodeKeys).toContain('className');
    // Refused — a per-block prop is not a node key, and neither is an invention.
    expect(nodeKeys).not.toContain('objectName');
    expect(nodeKeys).not.toContain('viewName');
    expect(nodeKeys).not.toContain('__not_a_spec_key__');
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

  // ── the ARM direction (objectui#4971) ──────────────────────────────────────

  it.each(covered)('%s declares no arm the spec refuses outright', (type) => {
    const unregistered = refusedArms(type).filter((id) => !(id in OFF_SPEC_ARM_EXEMPTIONS));
    const evidence = ARM_JUDGEMENTS.filter((judgement) => unregistered.includes(judgement.id))
      .map((judgement) => `${judgement.id} — ${judgement.evidence}`)
      .join('; ');
    expect(unregistered, evidence).toEqual([]);
  });

  it('judges a non-vacuous census — every covered block, every key, every arm', () => {
    // THE NON-VACUITY GUARD, and the verdict line objectui#4971 asked for. Every
    // per-block assertion above is generated from `ARM_JUDGEMENTS`; a walk that
    // resolved nothing — a registry that stopped loading, an `inputTypeArms`
    // that stopped seeing the array form, a `specTopLevelKeys` that returned
    // `[]` and skipped every key as off-spec — produces an EMPTY judgement list,
    // and `[] === []` is what every one of those assertions would then report.
    // So the census is asserted before anything is derived from it.
    const keysJudged = new Set(
      ARM_JUDGEMENTS.map((judgement) => `${judgement.type}.${judgement.input}`),
    );
    const exemptSlot = ARM_JUDGEMENTS.filter((j) => j.verdict === 'exempt-slot');
    const exemptEmptyEnum = ARM_JUDGEMENTS.filter((j) => j.verdict === 'exempt-empty-enum');
    const census =
      `blocks ${covered.length} · keys judged ${keysJudged.size} · arms judged ` +
      `${ARM_JUDGEMENTS.length} · exempt(slot — describes a child position, not a value) ` +
      `${exemptSlot.length} · exempt(enum arm with no declared members — admits nothing) ` +
      `${exemptEmptyEnum.length} · refused ${ARM_JUDGEMENTS.filter((j) => j.verdict === 'refused').length} ` +
      `· registered exemptions ${Object.keys(OFF_SPEC_ARM_EXEMPTIONS).length}`;

    expect(covered.length, census).toBeGreaterThan(0);
    expect(keysJudged.size, census).toBeGreaterThan(0);
    expect(ARM_JUDGEMENTS.length, census).toBeGreaterThan(0);

    // …and per block, which is the half a global count cannot see: a block whose
    // keys all stopped resolving would vanish from the walk while the totals
    // stayed comfortably non-zero.
    for (const type of covered) {
      expect(
        ARM_JUDGEMENTS.some((judgement) => judgement.type === type),
        `${type} contributed no arm judgement — ${census}`,
      ).toBe(true);
    }

    // The exact arms are NOT pinned here: they are a property of the
    // registrations, which `EXPECTED_COVERED` and the forward direction already
    // pin by name. What is pinned is that there is at least one arm per judged
    // key — the walk cannot report a key it judged nothing about.
    expect(ARM_JUDGEMENTS.length, census).toBeGreaterThanOrEqual(keysJudged.size);
  });

  it('the arm judge tells a refused KIND from a refused VALUE — objectui#4971 mutation 3b, by name', () => {
    // CALIBRATION, and the assertion that keeps this gate honest in BOTH
    // directions at once. Every other assertion in this section is satisfied by
    // a judge that never refutes anything, and the enum treatment above is
    // exactly the kind of rule that could quietly become that judge.
    //
    // Reading 1 — the card's own measurement. `page:card.title` is
    // `string | Record<string,string>`; a `'number'` arm on it is a value the
    // contract refuses, and adding one is the mutation that left all 856 tests
    // green before this gate existed. It must read as a KIND refusal.
    expect(specArmVerdict('page:card', 'title', 42)).toBe('refuses-kind');
    // …with the control that says the probe is not just refusing everything.
    expect(specArmVerdict('page:card', 'title', 'Account')).toBe('accepts');
    expect(specArmVerdict('page:card', 'title', { en: 'Account', 'zh-CN': '客户' })).toBe('accepts');

    // Reading 2 — the false red triage flagged, and the reason the exemption for
    // enum CONTRACTS is a rule and not a list. `record:quick_actions.variant` is
    // a spec enum declared with a `'string'` arm: the contract refuses a
    // representative string as a VALUE, and the coarse-kind ceiling
    // (`ComponentInput.type`, maintainer 2026-08-17) puts that outside what the
    // arm claims. A judge that read this as a kind refusal would condemn a
    // correct declaration.
    expect(specArmVerdict('record:quick_actions', 'variant', 'Account')).toBe('refuses-content');
    // …and the same key is proof the two readings cannot collapse into one:
    // whatever makes the enum arm survive must NOT be what lets `42` through.
    expect(specArmVerdict('record:quick_actions', 'variant', 42)).toBe('refuses-kind');

    // Reading 3 — a verdict is scoped to its own key. `element:number` requires
    // `object` and `aggregate`; a whole-parse boolean would call every arm on
    // the block invented because of two keys the probe never set.
    expect(specParser('element:number')?.safeParse({ prefix: 'US$' }).success).toBe(false);
    expect(specArmVerdict('element:number', 'prefix', 'US$')).toBe('accepts');
  });

  it('the probe vocabulary covers every arm a manifest can carry', () => {
    // An arm kind with no probe is an arm kind that is silently never judged —
    // `COARSE_ARM_PROBES[arm] ?? []` yields no verdicts, `some` over nothing is
    // false, and the judgement would be `refused` on no evidence. So the
    // vocabulary is compared against the manifest's own set rather than a copy:
    // an eleventh kind arriving upstream fails here, naming itself.
    const needsProbe = [...MANIFEST_INPUT_TYPES].filter(
      (arm) => arm !== 'enum' && !ARM_KINDS_WITHOUT_A_VALUE_CLAIM.has(arm),
    );
    expect(needsProbe.length).toBeGreaterThan(0);
    expect(needsProbe.filter((arm) => (COARSE_ARM_PROBES[arm] ?? []).length === 0)).toEqual([]);
    // The two kinds judged by another route, asserted so a deletion of either
    // branch shows up here rather than as silence.
    expect(MANIFEST_INPUT_TYPES.has('enum')).toBe(true);
    expect([...ARM_KINDS_WITHOUT_A_VALUE_CLAIM].every((arm) => MANIFEST_INPUT_TYPES.has(arm))).toBe(
      true,
    );
  });

  it('the exact enum branch is exercised — at least one enum arm with real members', () => {
    // The enum arm is the one judged EXACTLY rather than by kind, so it is the
    // one branch that could rot into dead code without any assertion noticing:
    // if no covered block declared an `enum` arm with members, the exact
    // comparison would run over nothing while the coarse rule kept the file
    // green. Derived, not pinned to a block — any enum arm keeps it alive.
    const enumArms = ARM_JUDGEMENTS.filter(
      (judgement) => judgement.arm === 'enum' && judgement.verdict !== 'exempt-empty-enum',
    );
    expect(enumArms.length, 'no covered block declares an enum arm with members').toBeGreaterThan(0);
  });

  it('every arm exemption names an arm a covered block really declares', () => {
    // Same reason as its key-name twins: a typo'd entry licenses nothing while
    // reading as deliberate cover for a real divergence.
    const declaredIds = new Set(ARM_JUDGEMENTS.map((judgement) => judgement.id));
    expect(Object.keys(OFF_SPEC_ARM_EXEMPTIONS).filter((id) => !declaredIds.has(id))).toEqual([]);
  });

  it('every arm exemption states a reason and references a tracking issue', () => {
    const unjustified = Object.entries(OFF_SPEC_ARM_EXEMPTIONS)
      .filter(([, reason]) => !/#\d+/.test(reason))
      .map(([id]) => id);
    expect(unjustified).toEqual([]);
  });

  it('carries no stale arm exemption — an arm the contract accepts must lose its entry', () => {
    // The half that stops this list becoming a permanent allowlist. Once either
    // side moves — the spec widening the key, or the declaration changing — the
    // entry stops describing anything and has to be deleted in the same change.
    const refused = new Set(ARM_JUDGEMENTS.filter((j) => j.verdict === 'refused').map((j) => j.id));
    expect(Object.keys(OFF_SPEC_ARM_EXEMPTIONS).filter((id) => !refused.has(id))).toEqual([]);
  });

  // ── the MEMBER direction (objectui#8067) ───────────────────────────────────

  it.each(covered)('%s declares no member kind the spec refuses outright', (type) => {
    const unregistered = refusedMembers(type).filter((id) => !(id in OFF_SPEC_MEMBER_EXEMPTIONS));
    const evidence = MEMBER_JUDGEMENTS.filter((judgement) => unregistered.includes(judgement.id))
      .map((judgement) => `${judgement.id} — ${judgement.evidence}`)
      .join('; ');
    expect(unregistered, evidence).toEqual([]);
  });

  it('judges a non-vacuous member census — real declarations, on real blocks', () => {
    // THE NON-VACUITY GUARD for this direction, and it has to be stricter than
    // the arm direction's. `of` is OPTIONAL: a walk that resolved nothing —
    // `inputTypeArms(input.of)` returning `[]` because the key stopped reaching
    // the registry, a `specTopLevelKeys` that skipped every key as off-spec, a
    // serializer that dropped the field — produces an EMPTY judgement list, and
    // an empty list is INDISTINGUISHABLE from "no block declares members yet".
    // That is precisely the failure mode objectui#5905 recorded: a key written
    // everywhere and read by nothing, with every gate green. So the counts are
    // pinned as lower bounds rather than merely asserted non-zero.
    const keysJudged = new Set(
      MEMBER_JUDGEMENTS.map((judgement) => `${judgement.type}.${judgement.input}`),
    );
    const blocksJudged = new Set(MEMBER_JUDGEMENTS.map((judgement) => judgement.type));
    const census =
      `blocks with member declarations ${blocksJudged.size} · keys judged ${keysJudged.size} ` +
      `· member arms judged ${MEMBER_JUDGEMENTS.length} · witnessed ` +
      `${MEMBER_JUDGEMENTS.filter((j) => j.verdict === 'witnessed').length} · refused ` +
      `${MEMBER_JUDGEMENTS.filter((j) => MEMBER_REFUSALS.has(j.verdict)).length} ` +
      `· registered exemptions ${Object.keys(OFF_SPEC_MEMBER_EXEMPTIONS).length}`;

    // The fifteen keys objectui#8067 derived from single-kind member contracts,
    // across ten blocks. A LOWER bound, not an equality: a new declaration that
    // this gate then judges is the direction this section exists to encourage,
    // and it should not have to edit a number to land. A declaration
    // DISAPPEARING is the regression, and that is what the bound catches.
    expect(keysJudged.size, census).toBeGreaterThanOrEqual(15);
    expect(blocksJudged.size, census).toBeGreaterThanOrEqual(10);
    expect(MEMBER_JUDGEMENTS.length, census).toBeGreaterThanOrEqual(keysJudged.size);
    // Every judgement must be a real verdict about the contract, not a skip.
    expect(
      MEMBER_JUDGEMENTS.filter((j) => j.verdict === 'witnessed').length,
      census,
    ).toBeGreaterThanOrEqual(15);
  });

  it('the member judge reds on the drift that started this — page:header.actions, by name', () => {
    // CALIBRATION, and the reason this section is not just three more green
    // assertions. Every other member assertion here is satisfied by a judge that
    // never refutes anything; this one asserts the refutation, on the key whose
    // drift the card was filed for.
    //
    // `ComponentPropsMap['page:header'].actions` is `z.array(z.string())` —
    // "Action IDs". The declaration says `of: 'string'`, and that must be
    // witnessed…
    expect(specMemberVerdict('page:header', 'actions', 'array', 'Account')).toBe('accepts');
    // …while `of: 'object'` — the members the renderer actually read for the
    // whole life of the drift, and the exact mutation the ablation for this card
    // applies — must read as a KIND refusal at the MEMBER position. Before this
    // section existed there was no declaration to make and nothing to compare
    // it with, which is why the gate stayed green.
    expect(specMemberVerdict('page:header', 'actions', 'array', { id: 'clone' })).toBe(
      'refuses-kind',
    );
    expect(specMemberVerdict('page:header', 'actions', 'array', 42)).toBe('refuses-kind');

    // The container-level control, which is what tells a member refusal from the
    // top-level refusal the ARM direction already covered: the ARRAY itself is
    // perfectly acceptable on this key. A judge that simply refused everything
    // would pass the two assertions above and fail this one.
    expect(specArmVerdict('page:header', 'actions', [])).toBe('accepts');

    // …and the second half of the calibration: a CONTENT refusal at the member
    // position is NOT a kind refusal, so the coarse-kind ceiling survives one
    // level down exactly as it does at the top. `record:activity.types` is a
    // spec enum of strings — a string member is refused as a VALUE, and reading
    // that as "the string member declaration is invented" would condemn a
    // declaration derived from the contract itself.
    expect(specMemberVerdict('record:activity', 'types', 'array', 'Account')).toBe(
      'refuses-content',
    );
    expect(specMemberVerdict('record:activity', 'types', 'array', 42)).toBe('refuses-kind');
  });

  it('a contract with no uniform member position is named, not silently skipped', () => {
    // The third verdict this level adds, calibrated by name because nothing in
    // the repository declares it today and an unexercised branch is a branch
    // that can be wrong for free.
    //
    // `record:related_list.add` is a named-shape `z.object({ ... })`, not a map:
    // it has no position where "every value is of kind K" is even a statement,
    // so a probe key it never declared is refused AT THE CONTAINER. That is not
    // a verdict about the member kind — it is the absence of a member position,
    // and `judgeMembers` reports a declaration resting on one rather than
    // passing it.
    expect(specMemberVerdict('record:related_list', 'add', 'object', 'Account')).toBe(
      'no-member-position',
    );
    // …and the control: the same block's `columns` IS a container with a member
    // position, so the verdict above is about the contract's shape and not about
    // the probe machinery.
    expect(specMemberVerdict('record:related_list', 'columns', 'array', 'name')).toBe('accepts');
    // The other half of the same fact: a MAP contract judges the value under
    // whatever key it is given, so the probe key is not refused there.
    expect(specMemberVerdict('object-form', 'initialValues', 'object', 'Account')).toBe('accepts');
  });

  it('member declarations are derived from single-kind member contracts', () => {
    // The rule `ComponentInput.of` states, asserted rather than trusted: a key
    // is declared when the contract accepts exactly ONE coarse member kind, and
    // left alone when it accepts several. Both halves matter — the first is what
    // makes a declaration underivable-by-hand and therefore checkable, and the
    // second is what keeps this change from advertising member shapes only a
    // per-block pin can vouch for.
    const KINDS = ['string', 'number', 'boolean', 'array', 'object'] as const;
    const acceptedMemberKinds = (type: string, key: string): string[] =>
      KINDS.filter((kind) =>
        (COARSE_ARM_PROBES[kind] ?? []).some((probe) => {
          const verdict = specMemberVerdict(type, key, 'array', probe);
          return verdict === 'accepts' || verdict === 'refuses-content';
        }),
      );

    // Every declared member arm is the contract's single accepted kind…
    const declaredAgainstContract = MEMBER_JUDGEMENTS.filter(
      (judgement) => judgement.verdict === 'witnessed',
    ).map((judgement) => {
      const accepted = acceptedMemberKinds(judgement.type, judgement.input);
      return `${judgement.id} → contract accepts {${accepted.join(',')}}`;
    });
    expect(
      declaredAgainstContract.filter((row) => !/→ contract accepts \{[a-z]+\}$/.test(row)),
      declaredAgainstContract.join('; '),
    ).toEqual([]);

    // …and the keys left undeclared for a member UNION are pinned with their
    // reason, so "no declaration" and "no declaration for a reason" stay
    // different facts. A stale entry fails: once the contract collapses to one
    // kind, the key becomes derivable and the entry must be deleted.
    for (const [id, reason] of Object.entries(MULTI_KIND_MEMBER_CONTRACTS)) {
      const [type, key] = splitExemptionKey(id);
      expect(reason.length, id).toBeGreaterThan(40);
      expect(reason, id).toMatch(/objectui#\d+/);
      expect(declaredInputs(type) ?? [], id).toContain(key);
      expect(acceptedMemberKinds(type, key).length, `${id} — ${reason}`).toBeGreaterThan(1);
      expect(
        MEMBER_JUDGEMENTS.some((judgement) => judgement.type === type && judgement.input === key),
        `${id} is pinned as a member union yet declares an \`of\` — delete the entry`,
      ).toBe(false);
    }
  });

  it('every member exemption names a member arm a covered block really declares', () => {
    const declaredIds = new Set(MEMBER_JUDGEMENTS.map((judgement) => judgement.id));
    expect(Object.keys(OFF_SPEC_MEMBER_EXEMPTIONS).filter((id) => !declaredIds.has(id))).toEqual([]);
  });

  it('every member exemption states a reason and references a tracking issue', () => {
    for (const [id, reason] of Object.entries(OFF_SPEC_MEMBER_EXEMPTIONS)) {
      expect(reason.length, id).toBeGreaterThan(40);
      expect(reason, id).toMatch(/objectui#\d+|objectstack#\d+/);
    }
  });

  it('carries no stale member exemption — a member kind the contract accepts must lose its entry', () => {
    const refused = new Set(
      MEMBER_JUDGEMENTS.filter((j) => MEMBER_REFUSALS.has(j.verdict)).map((j) => j.id),
    );
    expect(Object.keys(OFF_SPEC_MEMBER_EXEMPTIONS).filter((id) => !refused.has(id))).toEqual([]);
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

  // ── the MEMBER-PIN direction (objectui#8068) ───────────────────────────────
  //
  // Same `covered` set and the same exemption discipline as the three
  // directions above. What moves is the SUBJECT once more: not which keys a
  // block publishes, nor with which kinds, but whether anything anywhere
  // constrains what is INSIDE an array element or a nested object.

  it('judges a non-vacuous member-shape census — every covered block, every array/object input', () => {
    // Non-vacuity FIRST, for the reason the arm census gives next door: every
    // assertion below is generated from `structuredInputs`, so a reader that
    // resolved nothing (a renamed `ComponentInput.type`, an `inputTypeArms`
    // that stopped recognising the array form) would empty the population and
    // turn the whole direction green on nothing at all.
    expect(structuredInputs.length).toBeGreaterThan(0);

    // The partition is TOTAL and DISJOINT: every member of the population is
    // either pinned or exempt, never both and never neither. Stated here as
    // well as per-block below because the per-block loop cannot see the
    // "both" case, which is the shape a stale exemption takes.
    const ids = structuredInputs.map((entry) => entry.id);
    expect(ids.filter((id) => id in MEMBER_PINS && id in MEMBER_PIN_EXEMPTIONS)).toEqual([]);
    expect(
      ids.filter((id) => !(id in MEMBER_PINS) && !(id in MEMBER_PIN_EXEMPTIONS)),
    ).toEqual([]);

    // Every arm the population was selected on is one of the two, so a widened
    // `STRUCTURED_ARMS` cannot quietly pull in scalars.
    for (const entry of structuredInputs) {
      expect(entry.arms.some((arm) => STRUCTURED_ARMS.has(arm)), entry.id).toBe(true);
    }
  });

  it.each(covered)('%s pins the member shape of every array/object input it declares', (type) => {
    // THE new red. A block that grows an array-typed key with no pin and no
    // exemption fails here, naming the key — which is the one thing that did
    // not happen for `page:header.actions` through an entire contract cycle.
    expect(unpinnedMembersOf(type)).toEqual([]);
  });

  it('the pin-source glob resolves against the right anchor', () => {
    // Self-location, and the one thing `THIS_DIR` cannot assert about itself. A
    // wrong anchor resolves every key to a path nothing matches, every pin then
    // reads as MISSING, and the resulting repo-wide red looks like 19 deleted
    // pins instead of one bad constant.
    //
    // NOT asserted on this file's own path: `import.meta.glob` excludes the
    // module that calls it, so `registry-inputs-spec-parity.test.ts` is never in
    // its own glob — measured, and the first shape of this control failed on it.
    // The two arms below are what actually discriminate. A `THIS_DIR` off by a
    // level still yields correct `packages/…` paths (the `..` walk bottoms out),
    // so the `./`-anchored half is the half that catches it.
    const resolved = [...PIN_SOURCE_BY_PATH.keys()];
    expect(resolved.length).toBeGreaterThan(0);
    // No key may still carry a `..`: that is the signature of an anchor the walk
    // could not consume, and it would silently match nothing forever after.
    expect(resolved.filter((path) => path.includes('..'))).toEqual([]);
    // The `./`-anchored half — this directory's own siblings land back in it.
    // Witnessed by a long-standing neighbour that is NOT a registered pin, on
    // purpose: naming a pin file here would make a DELETED PIN red this control
    // too, and "the anchor is broken" and "one pin is gone" are different
    // diagnoses that must not share a signal. A generic
    // `some(path.startsWith(THIS_DIR))` cannot do the job either — it compares
    // the anchor against itself and passes for any wrong value.
    expect(resolved).toContain(`${THIS_DIR}/public-contract.test.ts`);
    // …and the `../../../../`-anchored half reaches the packages. Generic here,
    // because a wrong anchor cannot produce a `packages/` prefix at all: the
    // `..` walk bottoms out at the repo root either way.
    expect(resolved.some((path) => path.startsWith('packages/'))).toBe(true);
  });

  it('every registered member pin points at a collected test file that names its block and key', async () => {
    // The locator, and the failure mode it exists for: a pin file deleted or
    // renamed leaves the key uncovered while its registry entry still reads
    // deliberate. Reported as one list so a sweep names every broken entry at
    // once rather than one per run.
    const problems = (
      await Promise.all(
        Object.entries(MEMBER_PINS).map(([id, pin]) => memberPinProblem(id, pin)),
      )
    ).filter((problem): problem is string => problem !== null);
    expect(problems).toEqual([]);
  });

  it('the locator discriminates — it is not a check that passes on any file', async () => {
    // Calibration for the check above, in the direction it cannot fail on its
    // own. A locator that matched everything would license every entry at once
    // and read exactly like a clean sweep, which is the false-negative shape
    // this card was dispatched to end. Every probe is aimed at a REAL registered
    // pin, so the control cannot pass by pointing at nothing.
    const real = MEMBER_PINS['page:header.actions'];
    expect(await memberPinProblem('page:header.actions', real)).toBeNull();

    // …a key that file never mentions is REFUSED,
    expect(await memberPinProblem('page:header.__objectui_8068_probe__', real)).toMatch(
      /never names the key/,
    );
    // …a block it never mentions is refused,
    expect(await memberPinProblem('__objectui_8068_block__.actions', real)).toMatch(
      /never names the block/,
    );
    // …a path with no file behind it is refused,
    expect(
      await memberPinProblem('page:header.actions', {
        file: 'packages/components/src/__tests__/__objectui_8068_absent__.test.tsx',
        pins: 'probe',
      }),
    ).toMatch(/no such pin file/);
    // …and a file that really exists but the runner would never collect is
    // refused too, which is what separates "present" from "executed".
    expect(
      await memberPinProblem('page:header.actions', { file: 'package.json', pins: 'probe' }),
    ).toMatch(/never collects it/);
  });

  it('the four keys objectui#8068 names are in the population, and all four are pinned', () => {
    // The calibration this whole direction is measured against. Three of these
    // are the keys the LIMIT note at the top of this file delegates to; the
    // fourth is the one that had no pin, drifted for a full contract cycle, and
    // was only ever caught by a human. If a future narrowing of the population
    // or the locator drops any of the four, the direction has stopped
    // describing the defect it was built for — and that must be loud, not a
    // shorter list nobody re-derives.
    const exemplars = [
      'record:details.sections',
      'record:highlights.fields',
      'record:related_list.add',
      'page:header.actions',
    ];
    const ids = new Set(structuredInputs.map((entry) => entry.id));
    for (const id of exemplars) {
      expect(ids, `${id} left the member-shape population`).toContain(id);
      expect(MEMBER_PINS[id], `${id} lost its pin`).toBeDefined();
      expect(Object.keys(MEMBER_PIN_EXEMPTIONS), `${id} was exempted instead of pinned`).not.toContain(id);
    }
  });

  it('every member pin names a key that is still array/object-armed on a covered block', () => {
    // Dangling, the same check the three lists above carry: a pin for a key
    // that changed kind, lost its declaration or left `covered` silently
    // licenses nothing while reading as coverage.
    const ids = new Set(structuredInputs.map((entry) => entry.id));
    expect(Object.keys(MEMBER_PINS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every member-pin exemption names a key that is still array/object-armed on a covered block', () => {
    const ids = new Set(structuredInputs.map((entry) => entry.id));
    expect(Object.keys(MEMBER_PIN_EXEMPTIONS).filter((id) => !ids.has(id))).toEqual([]);
  });

  it('every member-pin exemption states a reason and references a tracking issue', () => {
    const unjustified = Object.entries(MEMBER_PIN_EXEMPTIONS)
      .filter(([, reason]) => !/#\d+/.test(reason))
      .map(([key]) => key);
    expect(unjustified).toEqual([]);
  });

  it('carries no stale member-pin exemption — a pinned key must lose its entry', () => {
    // The half that keeps the transition from becoming a permanent allowlist.
    // objectui#8071 converts these to pins one at a time, and this is what
    // demands the entry be deleted in the same change rather than left behind
    // as cover for a key that no longer needs any.
    expect(Object.keys(MEMBER_PIN_EXEMPTIONS).filter((id) => id in MEMBER_PINS)).toEqual([]);
  });

  it('the member-pin exemption list only ratchets DOWN', () => {
    // The other half. A new array-typed key must be answered with a pin, not
    // with a 59th entry carrying the same reason as its neighbours — that move
    // is what made the discipline voluntary in the first place, one layer in.
    expect(Object.keys(MEMBER_PIN_EXEMPTIONS).length).toBeLessThanOrEqual(
      MEMBER_PIN_EXEMPTION_CEILING,
    );
  });
});
