/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `FormFieldSchema` (zod) ↔ `FormField` (TS) coverage gate (#3090).
 *
 * The zod schema is the ONLY runtime enforcement of the form-field contract —
 * `@object-ui/cli`'s published `objectui validate` parses through it, while
 * renderers read plain objects and never parse. Until #3090 it validated 13 of
 * the interface's declared keys and required `type` (the interface says
 * optional): metadata the renderer accepts failed validation, and a typo in
 * `visibleWhen`/`widget`/`dependsOn` passed silently (strip mode).
 *
 * Why a PINNED LIST instead of a derivation: TS interface keys cannot be
 * enumerated at runtime, and `FormField` carries an index signature, which
 * defeats both directions of a compile-time assignability probe (the
 * objectstack#4075 mechanism — see check-spec-symbol-derivation.mjs, lie #3).
 * A set-coverage assertion is the #3017 fallback for exactly this case: the
 * zod side stays deliberate and reviewed, and any schema edit must touch the
 * list here in the same PR.
 */

import { describe, it, expect } from 'vitest';
import { FormFieldSchema } from '../zod/form.zod.js';

/** Every key `FormField` (../form.ts) declares by name, in declaration order. */
const DECLARED_KEYS = [
  'id',
  'name',
  'label',
  'description',
  'type',
  'inputType',
  'required',
  'disabled',
  'placeholder',
  'options',
  'validation',
  'condition',
  'widget',
  'dependsOn',
  'hidden',
  'readonly',
  'visibleOn',
  'visibleWhen',
  'readonlyWhen',
  'requiredWhen',
  'colSpan',
  'span',
];

describe('FormFieldSchema covers the FormField contract', () => {
  it('validates exactly the declared key set', () => {
    expect(Object.keys(FormFieldSchema.shape).sort()).toEqual([...DECLARED_KEYS].sort());
  });

  it('requires only `name` — `type` is optional, matching the interface', () => {
    expect(FormFieldSchema.safeParse({ name: 'email' }).success).toBe(true);
  });

  it('keeps the spec-aligned keys it used to strip', () => {
    const parsed = FormFieldSchema.parse({
      name: 'state',
      widget: 'rating',
      dependsOn: ['country', { field: 'region', param: 'region_id' }],
      hidden: false,
      readonly: true,
      visibleOn: { dialect: 'cel', source: "record.priority == 'urgent'" },
      visibleWhen: "record.status == 'sent'",
      readonlyWhen: 'record.locked == true',
      requiredWhen: "record.stage == 'won'",
      span: 'full',
    });
    expect(parsed.widget).toBe('rating');
    expect(parsed.dependsOn).toEqual(['country', { field: 'region', param: 'region_id' }]);
    expect(parsed.visibleOn).toEqual({ dialect: 'cel', source: "record.priority == 'urgent'" });
    expect(parsed.visibleWhen).toBe("record.status == 'sent'");
    expect(parsed.readonlyWhen).toBe('record.locked == true');
    expect(parsed.requiredWhen).toBe("record.stage == 'won'");
    expect(parsed.span).toBe('full');
    expect(parsed.readonly).toBe(true);
  });

  it('now REJECTS a malformed value for a declared key instead of stripping it', () => {
    // Before #3090 `visibleWhen` was unknown to the schema, so `visibleWhen: 42`
    // validated clean with the predicate thrown away.
    expect(FormFieldSchema.safeParse({ name: 'x', visibleWhen: 42 }).success).toBe(false);
  });

  it('still rejects the SPEC form-field vocabulary — the layers stay distinct', () => {
    // `{ field: 'email' }` is the authored (spec) shape; this schema is the
    // runtime shape. The boundary between them is `normalizeSectionField` in
    // @object-ui/plugin-form, not a dual-key read here. (#3090 PR2 upgrades
    // the CLI's error MESSAGE for this case; the verdict must not change.)
    expect(FormFieldSchema.safeParse({ field: 'email', required: true }).success).toBe(false);
  });
});
