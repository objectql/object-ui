/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:related_list` — the published authoring surface stays in parity with
 * `@objectstack/spec` `RecordRelatedListProps` (objectui#3808).
 *
 * Third sibling of `recordHighlightsInputs.spec-parity.test.ts` (objectui#3407 /
 * PR #3795) and `recordDetailsInputs.spec-parity.test.ts` (objectui#3807), added
 * for the direction those two carry and the repo-wide gate had not: a top-level
 * key the SPEC declares must be discoverable from `inputs`.
 *
 * This block had the worst instance of it. `relationshipValueField` and `add`
 * were both spec keys the renderer had honoured all along —
 * `renderers/record-related-list.tsx:95` and `:186` — while `inputs` published
 * neither, and nothing anywhere reported the mismatch:
 * `gen-manifest.ts` left them out of `sdui.manifest.json` and
 * `sdui-intrinsics.d.ts`, `sdui-parser/src/validate.ts:74` returned
 * `unknown-prop` for an author who wrote one, and the renderer went on honouring
 * it. `add` in particular is the ONLY way to build a junction-assignment list,
 * so the single published route to that feature was an undiscoverable key.
 *
 * WHY A DESCRIPTION IS WORTH A TEST, and why `add`'s is checked member by
 * member: `ComponentInput` is flat by design, so an `object` input can document
 * its member shape nowhere but its own prose. The assertions below derive the
 * member list from the spec at runtime, so a spec change fails here rather than
 * leaving the description quietly incomplete — the failure mode objectui#3807
 * was filed for.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { PageComponentSchema, RecordRelatedListProps } from '@objectstack/spec/ui';
import '../index';

type ShapeCarrier = { shape?: unknown; _def?: { shape?: unknown } };

/** Resolve a Zod object's `.shape` through both spellings, lazy or plain. */
function shapeKeys(schema: unknown): string[] {
  const carrier = schema as ShapeCarrier | undefined;
  const shape = carrier?.shape ?? carrier?._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return resolved && typeof resolved === 'object' ? Object.keys(resolved) : [];
}

/**
 * One entry of `.shape`, unwrapped past the optional/default wrappers until an
 * object shape is reachable. `add` is `.optional()` and `add.picker` carries
 * defaults on its own members, so a single `.unwrap()` is not enough.
 */
function innerObject(schema: unknown, key: string): unknown {
  const carrier = schema as ShapeCarrier | undefined;
  const shape = carrier?.shape ?? carrier?._def?.shape;
  const resolved = (typeof shape === 'function' ? (shape as () => object)() : shape) as
    | Record<string, unknown>
    | undefined;
  let member = resolved?.[key] as
    | { shape?: unknown; _def?: { shape?: unknown; innerType?: unknown; type?: unknown } }
    | undefined;
  for (let hop = 0; hop < 8; hop += 1) {
    if (member?.shape ?? member?._def?.shape) return member;
    const next = member?._def?.innerType ?? member?._def?.type;
    if (!next || typeof next !== 'object') return member;
    member = next as typeof member;
  }
  return member;
}

const specTopLevelKeys = (): string[] => shapeKeys(RecordRelatedListProps);

/**
 * Keys the spec accepts on the NODE, on every page component (objectui#6678).
 *
 * `RecordRelatedListProps` is this block's PROPS contract, which is not the whole
 * contract of the node an `inputs` list describes: `PageComponentSchema` carries
 * its own top-level keys, and the html tier validates an author's attributes
 * against `BASE_PROPS` + `inputs` with no third place for a node-level key to be
 * declared. `dataSource` — the spec's per-element binding, which this block reads
 * through `ElementDataSourceGate` and now declares from that seam — is one of
 * them, and it is accepted here for the same reason `className` would be.
 *
 * DERIVED from `PageComponentSchema`'s own input shape (it is a `.pipe()`), never
 * listed, so a spec release moves it. The repo-wide half of this gate makes the
 * same widening in
 * `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`, and both
 * assert the derivation still discriminates.
 */
const nodeLevelSpecKeys = (): string[] =>
  shapeKeys((PageComponentSchema as unknown as { _def?: { in?: unknown } })._def?.in);
const specAddKeys = (): string[] => shapeKeys(innerObject(RecordRelatedListProps, 'add'));
const specPickerKeys = (): string[] =>
  shapeKeys(innerObject(innerObject(RecordRelatedListProps, 'add'), 'picker'));

const config = () => ComponentRegistry.getConfig('record:related_list');
const inputs = () => config()?.inputs ?? [];
const inputNames = () => inputs().map((i) => i.name);
const input = (name: string) => inputs().find((i) => i.name === name);
const addDescription = () => input('add')?.description ?? '';

/** A spec-valid related list, so a fixture only ever carries the key under test. */
const baseline = { objectName: 'task', relationshipField: 'account', columns: ['name'] };

describe('record:related_list — registry inputs vs @objectstack/spec', () => {
  it('is registered with a non-empty `inputs` surface', () => {
    expect(config()).toBeDefined();
    expect(inputNames().length).toBeGreaterThan(0);
  });

  it('declares no top-level input the spec does not accept', () => {
    const allowed = new Set([...specTopLevelKeys(), ...nodeLevelSpecKeys()]);
    expect(inputNames().filter((name) => !allowed.has(name))).toEqual([]);
  });

  it('the node-level widening is derived, discriminating and non-empty', () => {
    // Calibration, in both directions: [] would silently stop widening and this
    // block would red on a key the spec accepts, while an everything-set would
    // stop this pin being a gate at all.
    const nodeKeys = nodeLevelSpecKeys();
    expect(nodeKeys.length).toBeGreaterThan(0);
    expect(nodeKeys).toContain('dataSource');
    expect(nodeKeys).not.toContain('relationshipField');
    expect(nodeKeys).not.toContain('__not_a_spec_key__');
  });

  it('publishes `relationshipValueField`, which the renderer has read all along', () => {
    // A KEY-reachability claim, so the criterion is that the key SURVIVES the
    // parse rather than merely that the parse succeeds. The verdict behind that
    // choice holds on every pin — an UNDECLARED top-level key is not an authoring
    // surface — but the contract states it two ways depending on the installed
    // `@objectstack/spec`: the closed props schemas refuse it with a named
    // `unrecognized_keys`, while the older strip-mode `z.object`s parsed it green
    // and dropped it from `data` in silence, which is exactly how this gap stayed
    // invisible for as long as it did. Key survival is the criterion that reads
    // the same either way; `success === true` does not, because on a stripping
    // pin an undeclared key gets that too. For the behavioural probe of which way
    // the installed pin says it, see `specRefusesUnknownTopLevelKeys` in the
    // sibling `recordHighlightsInputs.spec-parity.test.ts` — strictness is per
    // schema, so that probe is the shape to copy, not evidence about this one.
    expect(specTopLevelKeys()).toContain('relationshipValueField');
    const parsed = RecordRelatedListProps.safeParse({ ...baseline, relationshipValueField: 'name' });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.relationshipValueField).toBe('name');

    expect(inputNames()).toContain('relationshipValueField');
  });

  it("`relationshipValueField` publishes the renderer's default, and it matches the read site", () => {
    // `record-related-list.tsx:95` is `schema.relationshipValueField || 'id'`, and
    // the input carries `defaultValue: 'id'` to match. Pinned because a default
    // published on the authoring surface that disagrees with the renderer is
    // worse than no default: the designer would pre-fill one value and the page
    // would behave as another, with nothing comparing them.
    expect(input('relationshipValueField')?.defaultValue).toBe('id');

    // And the spec agrees, so all three say `id`.
    expect(RecordRelatedListProps.safeParse(baseline).data?.relationshipValueField ?? 'id').toBe('id');
  });

  it('publishes `add`, the only route to a junction-assignment list', () => {
    expect(specTopLevelKeys()).toContain('add');
    const parsed = RecordRelatedListProps.safeParse({
      ...baseline,
      add: { picker: { object: 'sys_position' }, linkField: 'position', label: 'Assign' },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.add?.picker?.object).toBe('sys_position');

    expect(inputNames()).toContain('add');
    expect(input('add')?.type).toBe('object');
    expect(addDescription()).not.toBe('');
  });

  it('every spec member key of `add` is discoverable from its description', () => {
    // `ComponentInput` has no member-shape slot (the LIMIT the repo-wide gate in
    // `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` documents),
    // so this prose is the only published description of the shape. Derived from
    // the spec at runtime: a member key added upstream fails here instead of
    // going unmentioned.
    expect(specAddKeys().length).toBeGreaterThan(0);
    expect(specPickerKeys().length).toBeGreaterThan(0);

    const description = addDescription();
    expect(specAddKeys().filter((key) => !description.includes(key))).toEqual([]);
    expect(specPickerKeys().filter((key) => !description.includes(key))).toEqual([]);
  });

  it("`add`'s published defaults are the RENDERER's, not the spec's prose", () => {
    // The one place the two disagree. `RelatedList.tsx:724` defaults
    // `picker.valueField` to `id` — same as the spec — but `:390` defaults
    // `picker.labelField` to `name`, where the spec's `.describe()` says it
    // "defaults to the object title field". The description publishes what the
    // platform does; publishing the spec's wording would document a behaviour no
    // code implements.
    const description = addDescription();
    expect(description).toMatch(/labelField[^.]*default "name"/);
    expect(description).not.toMatch(/labelField[^.]*title field/);
  });

  it('documents `picker.filter` as a real restriction, with no gap warning left over', () => {
    // The INVERSE of the assertion this used to carry. Until #3831 the spec
    // declared `add.picker.filter` ("Restrict which records the picker offers")
    // and nothing in this repo read it, so the description named it as a KNOWN
    // GAP on the `record:activity.showSubscriptionToggle` precedent. The wiring
    // landed (`RelatedList` hands it to `RecordPickerDialog`'s `baseFilter`
    // verbatim), so the warning had to go — and this direction now fails if
    // anyone puts a gap warning back, or reverts the wiring and leaves the
    // description claiming a restriction the dialog does not apply.
    expect(specPickerKeys()).toContain('filter');
    expect(addDescription()).not.toMatch(/KNOWN GAP/);
    expect(addDescription()).not.toMatch(/not applied/);
    expect(addDescription()).toMatch(/`picker\.filter` restricts which records/);
    // The restriction must be published as un-widenable, not as a suggestion:
    // `lookupFilters` would have rendered it as an editable filter-bar row.
    expect(addDescription()).toMatch(/hard constraint the user cannot widen/);
  });
});
