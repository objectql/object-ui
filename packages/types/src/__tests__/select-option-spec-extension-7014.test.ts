// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The objectui-side select-option / editor keys are extensions the spec
 * REFUSES BY NAME — pinned so the comments that say so cannot rot (objectui#7014).
 *
 * Why this exists. `SelectOptionMetadata` (packages/types/src/field-types.ts)
 * and the two `rows` declarations beside it each carried a doc comment
 * asserting the installed `@objectstack/spec` DECLARES the key:
 *
 *   "Aligns `@objectstack/spec` `SelectOptionSchema.description`"
 *   "`@objectstack/spec` `FieldSchema.rows` (a positive integer, authorable …)"
 *
 * Measured on `@objectstack/spec@17.2.0`, all three are false: the spec has no
 * such key and rejects it BY NAME. A false canonical claim is not stale
 * documentation — it is a planted premise for the next agent, which is the
 * whole failure class `scripts/check-spec-symbol-derivation.mjs` exists to
 * prevent. That gate could not see these, because it reads only the comment
 * block attached to a DECLARATION and validates a citation only at SYMBOL
 * granularity; both claims sit on MEMBERS and dangle at the member
 * (`SelectOptionSchema` is a live export, `.description` is not a key of it).
 *
 * The keys themselves are legitimate and consumed — objectui#6153 for the
 * option `description` (LookupField searches it), objectui#6140 for `rows`
 * (RichTextField reads it). What was wrong was the attribution. So this pin
 * asserts the BOUNDARY rather than removing anything: these are read-model
 * extensions that must never reach authored object metadata.
 *
 * Every assertion below pairs the refusal with a CONTROL that accepts the same
 * payload minus the key, so a red here means "the key's status changed", never
 * "the fixture drifted".
 */

import { describe, it, expect } from 'vitest';
import { SelectOptionSchema as SpecSelectOptionSchema, FieldSchema } from '@objectstack/spec/data';

/** Keys of the spec's select option, as installed. */
const SPEC_OPTION_KEYS = Object.keys(SpecSelectOptionSchema.shape).sort();

/** A valid option — `value` is a system identifier, min length 2. */
const validOption = { label: 'High', value: 'high' } as const;

/** Pull the `unrecognized_keys` issue naming `key`, or undefined. */
const refusedByName = (result: { success: boolean; error?: { issues: readonly any[] } }, key: string) =>
  result.success
    ? undefined
    : result.error!.issues.find(
        (i) => i.code === 'unrecognized_keys' && (i.keys ?? []).includes(key)
      );

describe('spec SelectOptionSchema is the boundary these extensions sit outside', () => {
  it('declares exactly the five keys the corrected comments name', () => {
    // If the spec ever ADDS `description`/`icon`/`disabled`, this fails and the
    // comments in field-types.ts must be re-corrected rather than left stale.
    expect(SPEC_OPTION_KEYS).toEqual(['color', 'default', 'label', 'value', 'visibleWhen']);
  });

  it('accepts the control option', () => {
    expect(SpecSelectOptionSchema.safeParse(validOption).success).toBe(true);
  });

  for (const key of ['description', 'icon', 'disabled'] as const) {
    it(`refuses the objectui-only key \`${key}\` BY NAME`, () => {
      const res = SpecSelectOptionSchema.safeParse({ ...validOption, [key]: key === 'disabled' ? true : 'x' });
      expect(res.success).toBe(false);
      expect(refusedByName(res, key), `expected unrecognized_keys naming '${key}'`).toBeDefined();
    });
  }
});

describe('FieldSchema routes options through that strict schema', () => {
  const field = (options: unknown[]) => ({ name: 'status', type: 'select', label: 'Status', options });

  it('accepts a field whose options carry only spec keys', () => {
    expect(FieldSchema.safeParse(field([validOption])).success).toBe(true);
  });

  it('fails the WHOLE field when an option carries `description`', () => {
    const res = FieldSchema.safeParse(field([{ ...validOption, description: 'help' }]));
    expect(res.success).toBe(false);
    expect(refusedByName(res, 'description')).toBeDefined();
  });
});

describe('FieldSchema refuses `rows` by name on every multiline editor type', () => {
  const base = (type: string) => ({ name: 'body', type, label: 'Body' });

  for (const type of ['textarea', 'markdown', 'html', 'richtext'] as const) {
    it(`control: \`${type}\` without \`rows\` is accepted`, () => {
      expect(FieldSchema.safeParse(base(type)).success).toBe(true);
    });

    it(`\`${type}\` with \`rows\` is refused BY NAME`, () => {
      const res = FieldSchema.safeParse({ ...base(type), rows: 4 });
      expect(res.success).toBe(false);
      expect(refusedByName(res, 'rows'), `expected unrecognized_keys naming 'rows' on ${type}`).toBeDefined();
    });
  }
});
