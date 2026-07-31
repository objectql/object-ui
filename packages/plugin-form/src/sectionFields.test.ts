import { describe, it, expect, vi } from 'vitest';
import { normalizeSectionField, buildSectionFields } from './sectionFields';
import { mapFieldTypeToFormType } from '@object-ui/fields';

const objectSchema = {
  name: 'crm_account',
  fields: {
    name: { type: 'text', label: 'Account Name', required: true, description: 'Legal name' },
    industry: {
      type: 'select',
      label: 'Industry',
      options: [{ label: 'Tech', value: 'tech' }],
    },
    billing_address: { type: 'address', label: 'Billing Address' },
  },
};

const ctx = {
  objectSchema,
  objectName: 'crm_account',
  fieldLabel: (_obj: string, _name: string, fallback?: string) => fallback || _name,
};

describe('normalizeSectionField', () => {
  it('resolves a spec FormFieldSchema object (key `field`, not `name`)', () => {
    // This is the exact shape that crashed the form: react-hook-form received
    // `name === undefined` and threw on `name.split('.')`.
    const f = normalizeSectionField({ field: 'name', required: true, colSpan: 2 }, ctx);
    expect(f.name).toBe('name');           // ← was undefined before the fix
    expect(f.type).toBe(mapFieldTypeToFormType('text')); // merged from object schema
    expect(f.required).toBe(true);         // spec override
    expect((f as any).colSpan).toBe(2);    // spec override
    expect((f as any).field).toMatchObject({ type: 'text' }); // metadata object, not the string
  });

  it('merges select options + label from the object schema', () => {
    const f = normalizeSectionField({ field: 'industry' }, ctx);
    expect(f.name).toBe('industry');
    expect(f.type).toBe(mapFieldTypeToFormType('select'));
    expect((f as any).options).toEqual([{ label: 'Tech', value: 'tech' }]);
  });

  it('maps spec override keys (helpText→description, readonly→disabled)', () => {
    const f = normalizeSectionField(
      { field: 'name', helpText: 'Custom hint', readonly: true },
      ctx,
    );
    expect(f.description).toBe('Custom hint');
    expect((f as any).disabled).toBe(true);
  });

  it('applies a spec reference override written under either key (`reference` or `reference_to`)', () => {
    // Spec canon is `reference_to` (views.zod.ts) but `reference` (ObjectStack
    // convention) is accepted too; both keys are stamped so any dual-key
    // downstream reader sees the override (#2407 / PR #2587).
    const specCanon = normalizeSectionField({ field: 'name', reference_to: 'accounts' }, ctx) as any;
    expect(specCanon.reference).toBe('accounts');
    expect(specCanon.reference_to).toBe('accounts');

    const stackConvention = normalizeSectionField({ field: 'name', reference: 'contacts' }, ctx) as any;
    expect(stackConvention.reference).toBe('contacts');
    expect(stackConvention.reference_to).toBe('contacts');
  });

  it('builds from the object schema for a string shorthand', () => {
    const f = normalizeSectionField('industry', ctx);
    expect(f.name).toBe('industry');
    expect(f.type).toBe(mapFieldTypeToFormType('select'));
  });

  it('passes a runtime FormField object through unchanged (field = metadata object)', () => {
    const runtime = { name: 'custom', type: 'text', label: 'Custom' };
    const f = normalizeSectionField(runtime as any, ctx);
    expect(f.name).toBe('custom');
    expect(f.type).toBe('text');
  });

  it('still yields a name when the spec field is not in the object schema', () => {
    const f = normalizeSectionField({ field: 'ghost', required: true }, ctx);
    expect(f.name).toBe('ghost'); // never undefined → no `.split` crash
  });

  // View-level conditional visibility (#2212): the spec `P`-template ships
  // `visibleOn` as an Expression object `{ dialect: 'cel', source }`. It must
  // survive normalization verbatim so the form renderer can evaluate it with
  // the canonical engine — the old code only accepted a bare string, and even
  // then attached a dead `visible()` closure instead.
  it('carries a `{ dialect, source }` visibleOn expression through (spec shape, #2212)', () => {
    const expr = { dialect: 'cel', source: "record.priority == 'urgent'" };
    const f = normalizeSectionField({ field: 'name', visibleOn: expr }, ctx);
    expect((f as any).visibleOn).toEqual(expr);
    expect((f as any).visible).toBeUndefined(); // no dead closure
  });

  it('carries a bare-string visibleOn through (#2212)', () => {
    const f = normalizeSectionField(
      { field: 'name', visibleOn: "record.priority == 'urgent'" },
      ctx,
    );
    expect((f as any).visibleOn).toBe("record.priority == 'urgent'");
  });

  it('carries visibleOn on a runtime FormField object too (#2212)', () => {
    const expr = { dialect: 'cel', source: 'record.flag == true' };
    const f = normalizeSectionField({ name: 'custom', type: 'text', visibleOn: expr } as any, ctx);
    expect((f as any).visibleOn).toEqual(expr);
  });

  // ── Spec 17 late-added / renamed keys (#3090) ─────────────────────────────
  // ADR-0089 renamed the view-level predicate to `visibleWhen` — which is also
  // the runtime slot for the OBJECT-level rule. The view predicate must land in
  // the view-level slot (`visibleOn`) so the renderer ANDs both layers
  // (form.tsx evaluates the two slots independently) instead of one clobbering
  // the other. Before the fix the canonical spelling was silently dropped while
  // the DEPRECATED spelling worked.

  it('routes a view-level `visibleWhen` (canonical spelling) into the view-level slot', () => {
    const f = normalizeSectionField(
      { field: 'name', visibleWhen: "record.stage == 'won'" },
      ctx,
    ) as any;
    expect(f.visibleOn).toBe("record.stage == 'won'");
  });

  it('carries a `{ dialect, source }` view-level visibleWhen expression', () => {
    const expr = { dialect: 'cel', source: "record.priority == 'urgent'" };
    const f = normalizeSectionField({ field: 'name', visibleWhen: expr }, ctx) as any;
    expect(f.visibleOn).toEqual(expr);
  });

  it('layers the view predicate OVER the object-level rule instead of clobbering it', () => {
    const rulesCtx = {
      ...ctx,
      objectSchema: {
        ...objectSchema,
        fields: {
          ...objectSchema.fields,
          paid_on: { type: 'date', label: 'Paid on', visibleWhen: "record.status == 'paid'" },
        },
      },
    };
    const f = normalizeSectionField(
      { field: 'paid_on', visibleWhen: 'record.amount > 0' },
      rulesCtx,
    ) as any;
    expect(f.visibleWhen).toBe("record.status == 'paid'"); // object-level rule intact
    expect(f.visibleOn).toBe('record.amount > 0'); // view predicate in the view slot
  });

  it('prefers the canonical spelling when both visibleWhen and deprecated visibleOn are authored', () => {
    // `saveMeta` persists verbatim, so served metadata can carry either (or,
    // after a partial migration, both). Canonical wins.
    const f = normalizeSectionField(
      { field: 'name', visibleWhen: "record.a == 1", visibleOn: "record.b == 2" },
      ctx,
    ) as any;
    expect(f.visibleOn).toBe("record.a == 1");
  });

  it('carries a view-level dependsOn (spec cascading declaration)', () => {
    const f = normalizeSectionField({ field: 'industry', dependsOn: 'country' }, ctx) as any;
    expect(f.dependsOn).toBe('country');
  });

  it('warns once when an entry mixes both vocabularies, and the spec key wins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const f = normalizeSectionField({ field: 'industry', name: 'legacy_key' }, ctx);
      expect(f.name).toBe('industry'); // spec branch derives the name from `field`
      normalizeSectionField({ field: 'industry', name: 'legacy_key' }, ctx); // same site again
      const said = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('mixed'));
      expect(said).toHaveLength(1); // deduped — this runs inside render loops
      expect(said[0]).toContain("{ field: 'industry' }");
      expect(said[0]).toContain("name: 'legacy_key'");
    } finally {
      warn.mockRestore();
    }
  });

  it('carries keyField and disclosure through for record/composite widgets', () => {
    const f = normalizeSectionField(
      { field: 'billing_address', keyField: { field: 'name', immutable: true }, disclosure: 'popover' },
      ctx,
    ) as any;
    expect(f.keyField).toEqual({ field: 'name', immutable: true });
    expect(f.disclosure).toBe('popover');
  });

  it('copies field-level conditional rules from the object schema (#2212)', () => {
    const rulesSchema = {
      ...objectSchema,
      fields: {
        ...objectSchema.fields,
        paid_on: {
          type: 'date',
          label: 'Paid on',
          visibleWhen: "record.status == 'paid'",
          requiredWhen: "record.status == 'paid'",
          readonlyWhen: 'record.locked == true',
        },
      },
    };
    const rulesCtx = { ...ctx, objectSchema: rulesSchema };
    for (const def of ['paid_on', { field: 'paid_on' }]) {
      const f = normalizeSectionField(def as any, rulesCtx);
      expect((f as any).visibleWhen).toBe("record.status == 'paid'");
      expect((f as any).requiredWhen).toBe("record.status == 'paid'");
      expect((f as any).readonlyWhen).toBe('record.locked == true');
    }
  });
});

describe('buildSectionFields', () => {
  it('normalizes a mixed section (string + spec object) with no undefined names', () => {
    const fields = buildSectionFields(
      { fields: ['industry', { field: 'name', required: true, colSpan: 2 }] },
      ctx,
    );
    expect(fields.map((f) => f.name)).toEqual(['industry', 'name']);
    expect(fields.every((f) => typeof f.name === 'string')).toBe(true);
  });
});
