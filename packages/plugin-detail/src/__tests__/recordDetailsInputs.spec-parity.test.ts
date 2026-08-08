/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:details` — the published authoring surface stays in parity with
 * `@objectstack/spec` `RecordDetailsProps` (objectui#3807, objectstack#5611).
 *
 * Sibling of `recordHighlightsInputs.spec-parity.test.ts` (objectui#3407 /
 * PR #3795) and the same two directions, on the block where the drift was
 * worse: there the `fields` description spelled an entry shape that was merely
 * INCOMPLETE (`readonly` missing); here the `sections` description spelled an
 * entry shape the spec had DELETED. Until 17.x `sections` was
 * `z.array(z.string())` — "section IDs" — and objectstack#5611 replaced that
 * with the object form outright (no producer, no consumer, so one shape rather
 * than two de-facto contracts). The registry text kept teaching the ID list.
 *
 * WHY A DESCRIPTION IS WORTH A TEST. `inputs` is not documentation, it is the
 * published contract: `gen-manifest.ts` serializes it into `sdui.manifest.json`
 * (the save-gate + parser whitelist) and into `sdui-intrinsics.d.ts` (the JSX
 * authoring surface), and for an array-of-objects input the ENTRY shape exists
 * nowhere else — `ComponentInput` has no member-shape slot, which is why the
 * repo-wide gate in `apps/console/src/__tests__/registry-inputs-spec-parity.test.ts`
 * (objectui#3797 / PR #3806) can only see top-level keys and says so in its
 * LIMIT note. An author following the retired spelling gets four silent layers:
 * `['a','b']` is a valid `array` to the manifest gate, upstream
 * `validateComponentProps` is advisory, the spec is only parsed on paths that
 * parse, and `RecordDetailsRenderer` reads `s.name` / `s.label` / `s.fields`
 * off each entry — all `undefined` on a string, so the section renders nothing.
 * Under `layout: 'custom'` sections are the ONLY source of the body, so the
 * page comes up blank with no diagnostic anywhere pointing at `sections`.
 *
 * Every expectation below is DERIVED from the spec schema at runtime rather
 * than restating today's key list, so a spec change fails here instead of
 * quietly reopening the gap.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { RecordDetailsProps } from '@objectstack/spec/ui';
import '../index';

type ShapeCarrier = { shape?: unknown; _def?: { shape?: unknown } };

/** Resolve a Zod object's `.shape` through both spellings, lazy or plain. */
function shapeKeys(schema: unknown): string[] {
  const carrier = schema as ShapeCarrier | undefined;
  const shape = carrier?.shape ?? carrier?._def?.shape;
  const resolved = typeof shape === 'function' ? (shape as () => object)() : shape;
  return resolved && typeof resolved === 'object' ? Object.keys(resolved) : [];
}

/** One entry of `.shape`, unwrapped past `.optional()`. */
function shapeMember(schema: unknown, key: string): unknown {
  const carrier = schema as ShapeCarrier | undefined;
  const shape = carrier?.shape ?? carrier?._def?.shape;
  const resolved = (typeof shape === 'function' ? (shape as () => object)() : shape) as
    | Record<string, unknown>
    | undefined;
  const member = resolved?.[key] as { unwrap?: () => unknown } | undefined;
  return typeof member?.unwrap === 'function' ? member.unwrap() : member;
}

/** The element schema of a `z.array(...)`, through both spellings. */
function arrayElement(schema: unknown): unknown {
  const arr = schema as {
    element?: unknown;
    def?: { element?: unknown };
    _def?: { type?: unknown; element?: unknown };
  } | undefined;
  return arr?.element ?? arr?.def?.element ?? arr?._def?.element ?? arr?._def?.type;
}

/** Top-level keys of the spec's `RecordDetailsProps`. */
const specTopLevelKeys = (): string[] => shapeKeys(RecordDetailsProps);

/** Member keys of one `sections[]` entry, per the spec. */
const specSectionKeys = (): string[] =>
  shapeKeys(arrayElement(shapeMember(RecordDetailsProps, 'sections')));

/**
 * Section keys `RecordDetailsRenderer` honours beyond the spec's four. Read off
 * `renderers/record-details.tsx` (`s.title ?? s.label`, `s.showBorder`,
 * `s.hideEmpty`) — a hand-kept list, but the ASSERTION filters it through the
 * spec at runtime, so the day upstream declares one of these it drops out of
 * the forbidden set on its own instead of pinning a stale prohibition.
 */
const RENDERER_ONLY_SECTION_KEYS = ['title', 'showBorder', 'hideEmpty'];

const config = () => ComponentRegistry.getConfig('record:details');
const inputs = () => config()?.inputs ?? [];
const input = (name: string) => inputs().find((i) => i.name === name);
const sectionsDescription = () => input('sections')?.description ?? '';

describe('record:details — registry inputs vs @objectstack/spec', () => {
  it('is registered with a non-empty `inputs` surface', () => {
    expect(config()).toBeDefined();
    expect(inputs().map((i) => i.name)).toContain('sections');
  });

  it('the spec really takes OBJECT sections — the id-list spelling is gone, not unioned in', () => {
    // Guards the premise the rest of the file rests on. A `z.array(z.string())`
    // arm coming back (or the object form moving) must fail here first, because
    // the description below would then be documenting the wrong shape again.
    expect(specSectionKeys().length).toBeGreaterThan(0);

    // A VALUE verdict, so the criterion is a full parse, not key recognition:
    // the retired spelling has to be rejected on its value, and the object form
    // has to survive intact.
    const idList = RecordDetailsProps.safeParse({
      layout: 'custom',
      sections: ['contact_info', 'address'],
    });
    expect(idList.success).toBe(false);
    expect(idList.error?.issues.map((i) => i.code)).toContain('invalid_type');

    const objectForm = RecordDetailsProps.safeParse({
      layout: 'custom',
      sections: [{ name: 'contact_info', label: 'Contact', columns: 2, fields: ['phone'] }],
    });
    expect(objectForm.success).toBe(true);
    expect(objectForm.data?.sections?.[0]).toMatchObject({
      name: 'contact_info',
      columns: 2,
      fields: ['phone'],
    });
  });

  it('every spec section member key is discoverable from the `sections` description', () => {
    const description = sectionsDescription();
    expect(description).not.toBe('');
    const undocumented = specSectionKeys().filter((key) => !description.includes(key));
    expect(undocumented).toEqual([]);
  });

  it('the `sections` description no longer teaches the retired section-id spelling', () => {
    // The regression this issue was filed for, named explicitly so it stays
    // legible if the derived check above is ever loosened. The entry shape must
    // be stated as an object, and the string form must be ruled out in the same
    // breath — an author reading only "object form" would not know their
    // existing `['contact_info']` page is now silently empty.
    const description = sectionsDescription();
    expect(description).not.toMatch(/section ids/i);
    expect(description).toMatch(/object/i);
    expect(description).toMatch(/string/i);
  });

  it('publishes no section member key the spec strips on parse', () => {
    // The renderer honours `title` / `showBorder` / `hideEmpty` per section,
    // but the spec's section object does not declare them, so they are dropped
    // with no error. Documenting them here would tell authors to write keys the
    // contract discards — the member-level twin of publishing a top-level input
    // the props schema rejects.
    const stripped = RENDERER_ONLY_SECTION_KEYS.filter(
      (key) => !specSectionKeys().includes(key),
    );
    expect(stripped).not.toEqual([]); // the premise: these really are undeclared

    const parsed = RecordDetailsProps.safeParse({
      sections: [{ label: 'Contact', fields: ['phone'], title: 'T', showBorder: true, hideEmpty: false }],
    });
    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.data?.sections?.[0] ?? {}).sort()).toEqual(['fields', 'label']);

    // Word-boundary, not substring: this direction asks "does the text teach
    // this KEY", and prose legitimately contains words that merely embed one
    // ("untitled" embeds `title`). The forward check above can stay a substring
    // test because a false positive there only ever accepts a description that
    // does mention the key.
    const description = sectionsDescription();
    const published = stripped.filter((key) => new RegExp(`\\b${key}\\b`).test(description));
    expect(published).toEqual([]);
  });

  it('declares no top-level input the spec does not accept', () => {
    const allowed = new Set(specTopLevelKeys());
    const offSpec = inputs().map((i) => i.name).filter((name) => !allowed.has(name));
    expect(offSpec).toEqual([]);
  });

  it('`fields` documents no entry shape, because the spec accepts bare names only', () => {
    // objectui#3807's fence check on the sibling input at the same call site.
    // Top-level `fields` is `z.array(z.string())`: there is no member shape to
    // publish, and the renderer's tolerance for `{name}` / `{field}` entries is
    // not a second contract to advertise — the spec rejects those values.
    const element = arrayElement(shapeMember(RecordDetailsProps, 'fields'));
    expect(shapeKeys(element)).toEqual([]);
    expect(RecordDetailsProps.safeParse({ fields: ['phone'] }).success).toBe(true);
    expect(RecordDetailsProps.safeParse({ fields: [{ name: 'phone' }] }).success).toBe(false);

    const description = input('fields')?.description ?? '';
    expect(description).not.toBe('');
    expect(description).not.toContain('{');
  });
});
