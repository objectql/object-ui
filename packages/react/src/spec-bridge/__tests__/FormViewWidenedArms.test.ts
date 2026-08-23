/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Form-view bridge — the arms the contract admits and the bridge used to refuse
 * (objectui#5652).
 *
 * The bridge held a THIRD hand-written description of the FormViewSchema
 * contract (after objectui#5542's leaf and objectui#5596's two containers), and
 * a description nothing compares is one spec release from being a fork. Three
 * of its key types had already drifted. Each of them refused metadata the
 * platform accepts, which is the objectui#5040 symptom: a legal document that
 * the type says cannot exist.
 *
 * Every arm below is pinned TWICE, and both halves are load-bearing:
 *
 *  1. **The contract's answer**, from `safeParse` — so "the contract admits
 *     this" is a measurement in the suite rather than a claim in a comment.
 *     These are the assertions that turn red if the spec ever moves, which is
 *     the moment the derived declarations below need re-reading.
 *  2. **The bridge's answer**, end to end onto the `object-form` node — because
 *     widening a declaration is only half a repair. A key that is declarable
 *     but silently dropped on the way out is the same defect one layer over
 *     (objectui#5542 / #5594), so each arm is followed to the node, and the
 *     predicates are followed one step further into the evaluator that reads
 *     them.
 *
 * The compile-time pins in `describe('derivation')` are the drift guard proper:
 * they fail if a future edit restates any of these types by hand, whatever
 * value it restates them to. They are erased at runtime — `tsc -p
 * tsconfig.test.json` (chained from this package's `type-check` script) is what
 * checks them, not vitest.
 */
import { describe, it, expect } from 'vitest';
import { FormSectionSchema, FormViewSchema } from '@objectstack/spec/ui';
import type { FormFieldInput, FormSection, FormView } from '@objectstack/spec/ui';
import { evalFieldPredicate } from '@object-ui/core';
import { bridgeFormView } from '../bridges/form-view';
import type { FormFieldSpec, FormSectionSpec, FormViewSpec } from '../bridges/form-view';

type Assert<T extends true> = T;
/** Invariant type equality — `A extends B` is too weak to catch a widening. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Extends<A, B> = [A] extends [B] ? true : false;

/** A section fixture that is spec-valid except for the arm under test. */
const SECTION_BASE = { label: 'Basic', fields: [{ field: 'name' }] };

describe("objectui#5652 — the contract's measured answers (controls)", () => {
  it('admits the string spelling of a SECTION column count', () => {
    expect(FormSectionSchema.safeParse({ ...SECTION_BASE, columns: '3' }).success).toBe(true);
    expect(FormSectionSchema.safeParse({ ...SECTION_BASE, columns: 3 }).success).toBe(true);
    // The control that keeps the assertion above honest: the string arm is an
    // enum of the four counts, not "any string".
    expect(FormSectionSchema.safeParse({ ...SECTION_BASE, columns: '5' }).success).toBe(false);
  });

  it('does NOT admit the string arm on the FORM, which is not what the card predicted', () => {
    const withNumber = FormViewSchema.safeParse({ columns: 2, sections: [SECTION_BASE] });
    const withString = FormViewSchema.safeParse({ columns: '3', sections: [SECTION_BASE] });

    expect(withNumber.success).toBe(true);
    expect(withString.success).toBe(false);
    expect(withString.error?.issues.some((i) => i.path[0] === 'columns')).toBe(true);
  });

  it('admits a BARE `dependsOn` name and refuses the array arm', () => {
    const bare = FormViewSchema.safeParse({
      sections: [{ label: 'S', fields: [{ field: 'config', dependsOn: 'objectName' }] }],
    });
    const array = FormViewSchema.safeParse({
      sections: [{ label: 'S', fields: [{ field: 'config', dependsOn: ['objectName'] }] }],
    });

    expect(bare.success).toBe(true);
    // The exact inversion the bridge shipped: it declared `string[]`, so the
    // only arm it admitted is the one the contract rejects.
    expect(array.success).toBe(false);
  });

  it('admits both predicate arms, and requires `dialect` on the object one', () => {
    const asString = FormSectionSchema.safeParse({ ...SECTION_BASE, visibleWhen: 'x == 1' });
    const asObject = FormSectionSchema.safeParse({
      ...SECTION_BASE,
      visibleWhen: { dialect: 'cel', source: 'x == 1' },
    });
    const dialectless = FormSectionSchema.safeParse({
      ...SECTION_BASE,
      visibleWhen: { source: 'x == 1' },
    });

    expect(asString.success).toBe(true);
    expect(asObject.success).toBe(true);
    // `{ dialect?, source }` is the EVALUATOR's `FieldRulePredicate`, a
    // different layer's type — the contract refuses it.
    expect(dialectless.success).toBe(false);
  });
});

describe('objectui#5652 — each widened arm reaches the object-form node', () => {
  it('folds a string SECTION column count onto the number the node carries', () => {
    const spec: FormViewSpec = {
      type: 'simple',
      sections: [{ label: 'Basic', columns: '3', fields: [{ field: 'name' }] }],
    };

    const section = (bridgeFormView(spec, {}).sections as any[])[0];

    // Not `'3'`: `FormSectionContainer` types this `1 | 2 | 3 | 4` and indexes
    // its grid-class map by it, and its own header puts the fold at this seam.
    expect(section.columns).toBe(3);
    expect(typeof section.columns).toBe('number');
  });

  it('leaves a numeric column count alone (the fold is not a rewrite)', () => {
    const spec: FormViewSpec = {
      columns: 2,
      sections: [{ label: 'Basic', columns: 2, fields: [{ field: 'name' }] }],
    };
    const node = bridgeFormView(spec, {});

    expect((node.sections as any[])[0].columns).toBe(2);
    expect(node.columns).toBe(2);
  });

  it('carries a BARE `dependsOn` name onto the node field', () => {
    const spec: FormViewSpec = {
      sections: [
        {
          label: 'Basic',
          fields: [{ field: 'config', widget: 'field-selector', dependsOn: 'objectName' }],
        },
      ],
    };

    const field = (bridgeFormView(spec, {}).sections as any[])[0].fields[0];

    // The node slot is declared `DependsOnInput` and read by
    // `resolveDependsOnFields`, which takes the bare name as-is.
    expect(field.dependsOn).toBe('objectName');
    expect(field.widget).toBe('field-selector');
  });

  it('carries the object predicate arm onto the field, whole and evaluable', () => {
    const spec: FormViewSpec = {
      sections: [
        {
          label: 'Basic',
          fields: [
            { field: 'discount', visibleWhen: { dialect: 'cel', source: "record.stage == 'won'" } },
          ],
        },
      ],
    };

    const field = (bridgeFormView(spec, {}).sections as any[])[0].fields[0];

    // ADR-0089: the view-level predicate lands in the node's `visibleOn` slot.
    expect(field.visibleOn).toEqual({ dialect: 'cel', source: "record.stage == 'won'" });
    // Reaching the node is not the same as being usable there. Both verdicts
    // are asserted because a predicate the evaluator cannot read returns the
    // FALLBACK for every record — which would look identical to the `false`
    // case on its own.
    expect(evalFieldPredicate(field.visibleOn, { stage: 'won' }, false)).toBe(true);
    expect(evalFieldPredicate(field.visibleOn, { stage: 'lost' }, false)).toBe(false);
  });

  it('carries the object predicate arm onto the section', () => {
    const spec: FormViewSpec = {
      sections: [
        {
          label: 'Internal',
          visibleWhen: { dialect: 'cel', source: "record.stage != 'closed'" },
          fields: [{ field: 'name' }],
        },
      ],
    };

    const section = (bridgeFormView(spec, {}).sections as any[])[0];

    expect(section.visibleWhen).toEqual({ dialect: 'cel', source: "record.stage != 'closed'" });
  });

  it('still carries the bare-string predicate arm (the widening added, it did not replace)', () => {
    const spec: FormViewSpec = {
      sections: [
        {
          label: 'Basic',
          visibleWhen: "record.stage != 'closed'",
          fields: [{ field: 'discount', visibleWhen: "record.stage == 'won'" }],
        },
      ],
    };

    const section = (bridgeFormView(spec, {}).sections as any[])[0];

    expect(section.visibleWhen).toBe("record.stage != 'closed'");
    expect(section.fields[0].visibleOn).toBe("record.stage == 'won'");
    expect(evalFieldPredicate(section.fields[0].visibleOn, { stage: 'won' }, false)).toBe(true);
  });

  it('forwards the spec shorthand for a field — a bare object-field name', () => {
    const spec: FormViewSpec = {
      sections: [{ label: 'Basic', fields: ['name', { field: 'amount' }] }],
    };

    const section = (bridgeFormView(spec, {}).sections as any[])[0];

    // Verbatim: the node's `fields` slot admits the shorthand and
    // `normalizeSectionField` (@object-ui/plugin-form) resolves it against the
    // object schema. Running it through the object mapper produced
    // `{ name: undefined }` — a field with no identity.
    expect(section.fields[0]).toBe('name');
    expect(section.fields[1]).toEqual({ name: 'amount', label: 'amount' });
  });
});

describe('objectui#5652 — derivation pins (compile-time; vitest only reports they exist)', () => {
  // Each declared type IS the contract's type. A hand restatement fails here
  // whatever it restates the type to — that is the whole point of the guard,
  // and the reason these are `Equal` and not `extends`.
  type _sectionColumns = Assert<Equal<FormSectionSpec['columns'], FormSection['columns']>>;
  type _formColumns = Assert<Equal<FormViewSpec['columns'], FormView['columns']>>;
  type _fieldVisibleWhen = Assert<Equal<FormFieldSpec['visibleWhen'], FormFieldInput['visibleWhen']>>;
  type _fieldVisibleOn = Assert<Equal<FormFieldSpec['visibleOn'], FormFieldInput['visibleOn']>>;
  type _sectionVisibleWhen = Assert<Equal<FormSectionSpec['visibleWhen'], FormSection['visibleWhen']>>;

  // `dependsOn` is deliberately WIDER than the contract (it is forwarded into a
  // node slot declared `DependsOnInput`, which also admits the array arm the
  // runtime has always read). Equality would be the wrong pin; what must hold
  // is that every arm the contract admits is describable here, so a spec that
  // widens `dependsOn` fails this instead of outgrowing the declaration.
  type _dependsOnCoversContract = Assert<
    Extends<NonNullable<FormFieldInput['dependsOn']>, FormFieldSpec['dependsOn']>
  >;

  // The arms themselves, spelled out: these are what a re-narrowing to
  // `number` / `string[]` / `string` breaks first, and they name the value.
  type _stringColumnArm = Assert<Extends<'3', NonNullable<FormSectionSpec['columns']>>>;
  type _bareNameArm = Assert<Extends<'objectName', NonNullable<FormFieldSpec['dependsOn']>>>;
  type _objectPredicateArm = Assert<
    Extends<{ dialect: 'cel'; source: string }, NonNullable<FormFieldSpec['visibleWhen']>>
  >;

  it('holds the compile-time pins above (erased at runtime by design)', () => {
    // Referenced so the aliases are not unused declarations, and so a reader
    // running vitest alone sees the pins named rather than silently absent.
    const pinned: Array<_sectionColumns | _formColumns | _fieldVisibleWhen | _fieldVisibleOn> = [
      true,
      true,
      true,
      true,
    ];
    const alsoPinned: Array<
      | _sectionVisibleWhen
      | _dependsOnCoversContract
      | _stringColumnArm
      | _bareNameArm
      | _objectPredicateArm
    > = [true, true, true, true, true];

    expect(pinned.every(Boolean)).toBe(true);
    expect(alsoPinned.every(Boolean)).toBe(true);
  });

  it('accepts a spec-authored document at the declared types', () => {
    // Assignability IS the assertion: each of these was a compile error before
    // the conversion. The runtime expectations keep the fixtures live.
    const section: FormSectionSpec = {
      label: 'Basic',
      columns: '3',
      visibleWhen: { dialect: 'cel', source: 'record.open == true' },
      fields: ['name', { field: 'config', dependsOn: 'objectName' }],
    };
    const field: FormFieldSpec = {
      field: 'config',
      widget: 'dynamic-config',
      dependsOn: 'driver',
      visibleWhen: { dialect: 'cel', source: 'record.open == true' },
    };
    const view: FormViewSpec = { type: 'simple', columns: 2, sections: [section] };

    expect(bridgeFormView(view, {}).columns).toBe(2);
    expect(field.dependsOn).toBe('driver');
  });
});
