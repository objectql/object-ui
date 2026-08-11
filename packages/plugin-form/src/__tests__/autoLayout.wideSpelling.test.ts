/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#4250 — the form twin of the detail view's `WIDE_FIELD_TYPES` pin.
 * The set is matched against the RAW type, and its rich-text members were
 * `rich-text` / `field:rich-text`: spellings `@objectstack/spec` REJECTS (typo
 * keys in the spec's own `suggestFieldType` table, nothing a producer emits).
 * The card's `isWideFieldType('rich-text')` assertion was green for exactly the
 * wrong reason — the set held the string it asked about — so the rule could be
 * dead for every real field while the pin stayed green.
 *
 * Derived, not enumerated (the #4226/#4207 precedent): bare members are checked
 * against the spec's own `FieldType` vocabulary and the `field:` half is read
 * out of `mapFieldTypeToFormType`, so the next drift fails BY NAME.
 */
import { describe, it, expect } from 'vitest';
import { FieldType } from '@objectstack/spec/data';
import { mapFieldTypeToFormType } from '@object-ui/fields';
import { isWideFieldType, resolveColSpan } from '../autoLayout';
import type { FormField } from '@object-ui/types';

const SPEC_TYPES: readonly string[] = [...(FieldType as { options: readonly string[] }).options];

/** The long-form / document family, spelled as the SPEC spells it. */
const WIDE_SPEC_TYPES = ['textarea', 'markdown', 'html', 'richtext'] as const;

/** Spellings the spec rejects. */
const REJECTED_SPELLINGS = ['rich-text', 'rich_text'] as const;

describe('form WIDE_FIELD_TYPES — keyed on the spec vocabulary (#4250)', () => {
  it('every bare member this set relies on IS a spec FieldType name', () => {
    for (const type of WIDE_SPEC_TYPES) {
      expect(SPEC_TYPES).toContain(type);
    }
  });

  it('widens every long-form spec type', () => {
    for (const type of WIDE_SPEC_TYPES) {
      expect(isWideFieldType(type)).toBe(true);
    }
  });

  it('widens the widget id each long-form type maps to', () => {
    for (const type of WIDE_SPEC_TYPES) {
      expect(isWideFieldType(mapFieldTypeToFormType(type))).toBe(true);
    }
  });

  it('does not answer to spellings the spec rejects', () => {
    for (const dead of REJECTED_SPELLINGS) {
      expect(SPEC_TYPES).not.toContain(dead);
      expect(isWideFieldType(dead)).toBe(false);
      expect(isWideFieldType(`field:${dead}`)).toBe(false);
    }
  });

  it('its spec-facing surface is EXACTLY the long-form family', () => {
    // `grid` is not in this comparison by construction — it is an objectui-local
    // key (`GridFieldMetadata` in `@object-ui/types`), not a spec FieldType.
    const wideSpecTypes = SPEC_TYPES.filter((t) => isWideFieldType(t));
    expect([...wideSpecTypes].sort()).toEqual([...WIDE_SPEC_TYPES].sort());
  });

  it('gives a richtext field the whole row, in both spellings', () => {
    // The behaviour, through the function the form grid actually calls. Both
    // spellings reach it in production: `FormField.type` carries the widget id,
    // while app-shell's `ObjectFormDesigner` passes the raw object field type.
    const bare = { name: 'body', type: 'richtext' } as unknown as FormField;
    const widget = { name: 'body', type: 'field:richtext' } as unknown as FormField;
    const narrow = { name: 'subject', type: 'field:text' } as unknown as FormField;
    expect(resolveColSpan(bare, 4)).toBe(4);
    expect(resolveColSpan(widget, 4)).toBe(4);
    expect(resolveColSpan(narrow, 4)).toBe(1);
  });
});
