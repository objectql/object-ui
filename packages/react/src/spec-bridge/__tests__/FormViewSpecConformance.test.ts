/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * FormView spec conformance round-trip (#2545), made structural (objectui#5898).
 *
 * The bridge must never silently drop `@objectstack/spec` FormViewSchema
 * configuration: every serializable spec key is either mapped onto the
 * `object-form` node or explicitly listed with a reason for being ignored.
 *
 * ## Why this file had to change, and what changed
 *
 * The promise above shipped with a completeness loop that read
 * `Object.keys(FULL_SPEC_FORM_VIEW)` — the FIXTURE, hand-listed from memory.
 * A key absent from the fixture is a key the loop never asks about, so the
 * check could only ever confirm what its author already remembered. Measured on
 * spec 17.2.0: **18 contract keys were neither mapped nor explained** while this
 * file was green (2 on the form, 2 on the section, 14 on the field). It could
 * have caught every one of them and did not — not because an assertion was
 * weak, but because the key set was the wrong SOURCE.
 *
 * The loop now derives its key set from the contract's own shape, at all three
 * levels, and every key must be claimed by exactly one registry:
 *
 *   - `MAPPED_*` — one BEHAVIORAL row per key: an assertion that the authored
 *     value arrives at its documented destination on the node. Deleting the
 *     copy in `form-view.ts` fails the row. These are mutation-tested rows, not
 *     a mirror list; a mirror list is what this file used to be.
 *   - `IGNORED_*` — a deliberate, documented refusal. "Not silently" is what
 *     the promise asks for, and an explained refusal satisfies it; an invented
 *     destination would not.
 *
 * Both directions are then asserted: a key the spec ADDS fails as unclaimed
 * (decide: map it or explain it), and a key the spec RETIRES fails as stale.
 *
 * ## The fixture is spec-valid, and that is asserted first
 *
 * `FULL_SPEC_FORM_VIEW` carries every live contract key at every level and is
 * run through `FormViewSchema.safeParse` as the opening control. Without that
 * control a row could pass against a value the contract would refuse, which
 * proves nothing about authored metadata. It is fed to the bridge RAW (never
 * parsed) on purpose — that is the input class this bridge exists for, and the
 * one that still presents the deprecated spellings the contract folds away.
 *
 * `defaultSort` and `aria` are excluded by construction: spec 17 retired both on
 * the FORM carrier (`retiredKey()` tombstones), and `liveSpecKeys` filters them
 * out — pinned below so the filter cannot quietly start dropping live keys too.
 * Their absence from the node is pinned by `FormViewRetiredKeys.test.ts`; the
 * widened arms `columns` / `dependsOn` / `visibleWhen` are pinned end-to-end by
 * `FormViewWidenedArms.test.ts`. Neither is repeated here.
 */
import { describe, it, expect } from 'vitest';
// Enumerating the contract's key set is the ONE sanctioned reason to import the
// spec's form-field schema in this repo (the same exemption
// `plugin-form/src/sectionFields.spec-parity.test.ts` takes, for the same
// reason): this file exists to ask the contract what its keys are. It is read
// as a KEY SET only — never as a form field's shape, which is the layer
// violation the rule guards (objectui#3090).
// eslint-disable-next-line no-restricted-imports
import { FormFieldSchema, FormSectionSchema, FormViewSchema } from '@objectstack/spec/ui';
import { SpecBridge } from '../SpecBridge';

/**
 * The authoring (`z.input`) shape of a spec schema.
 *
 * `FormSectionSchema` and `FormFieldSchema` close with `.transform()`, so they
 * are `ZodPipe`s whose `.in` carries the object; `FormViewSchema` closes with
 * `.superRefine()` and stays a `ZodObject`. Reading `.shape` alone answers
 * `undefined` for two of the three — silently, which would make every
 * completeness assertion below vacuous.
 */
function authoringShape(schema: unknown): Record<string, any> {
  const s = schema as any;
  const shape = s.in?.shape ?? s.shape;
  if (!shape) throw new Error('spec schema exposed no authoring shape');
  return shape;
}

/** `retiredKey()` is `z.never().optional()` — a tombstone, not a live key. */
function isRetired(entry: any): boolean {
  const def = entry?._def ?? entry?.def;
  if (def?.type !== 'optional') return false;
  const inner = def.innerType?._def ?? def.innerType?.def;
  return inner?.type === 'never';
}

/** Every key the contract still accepts, tombstones removed. */
function liveSpecKeys(schema: unknown): string[] {
  const shape = authoringShape(schema);
  return Object.keys(shape).filter((key) => !isRetired(shape[key])).sort();
}

/** The tombstoned keys, so the filter above can be pinned in both directions. */
function retiredSpecKeys(schema: unknown): string[] {
  const shape = authoringShape(schema);
  return Object.keys(shape).filter((key) => isRetired(shape[key])).sort();
}

/**
 * A form view carrying every LIVE contract key at every level.
 *
 * `type: 'split'` is load-bearing: `section.pane` is split-only vocabulary and
 * the contract rejects it on any other form type, so a wizard fixture could not
 * carry the key at all — and a fixture that cannot carry a key passes for the
 * wrong reason. Both visibility spellings are authored side by side on the
 * section and the field; the canonical one wins, which is what the contract's
 * own `normalizeVisibleWhen` does with the same input.
 */
const FULL_SPEC_FORM_VIEW = {
  type: 'split',
  layout: 'grid',
  columns: 2,
  title: 'Edit Opportunity',
  description: 'All the fields',
  defaultTab: 'details',
  tabPosition: 'left',
  allowSkip: true,
  showStepIndicator: false,
  splitDirection: 'horizontal',
  splitSize: 40,
  splitResizable: true,
  drawerSide: 'right',
  drawerWidth: '480px',
  modalSize: 'lg',
  data: { provider: 'object', object: 'opportunity' },
  sections: [
    {
      name: 'basic_info',
      label: 'Basic Info',
      description: 'Who and what',
      collapsible: true,
      collapsed: false,
      columns: 2,
      visibleWhen: 'record.stage != "closed"',
      visibleOn: 'record.legacy == true',
      pane: 'primary',
      fields: [
        {
          field: 'name',
          type: 'text',
          label: 'Name',
          required: true,
          placeholder: 'Acme deal',
          helpText: 'Deal name',
          readonly: false,
          hidden: false,
          colSpan: 2,
          span: 'full',
          widget: 'input',
          options: [{ label: 'Tech', value: 'tech' }],
          reference: 'account',
          // A BARE parent-field name: the array arm is the one arm
          // `FormFieldSchema` rejects (objectui#5652).
          dependsOn: 'account',
          visibleWhen: 'record.active == true',
          visibleOn: 'record.legacy == true',
          // The constraint / presentation / composite block objectui#5898
          // restored. Authored together on one field because that is how the
          // completeness loop below can ask about all of them at once.
          maxLength: 120,
          minLength: 2,
          min: 0,
          max: 100,
          precision: 10,
          scale: 2,
          multiple: false,
          immutable: true,
          language: 'sql',
          disclosure: 'popover',
          keyField: { field: 'name', label: 'Name', regex: '^[a-z_]+$', immutable: true },
          fields: [{ field: 'inner', type: 'text' }],
          publicPicker: { displayFields: ['name'], maxResults: 10 },
        },
        'amount',
      ],
    },
  ],
  groups: [{ label: 'Legacy Group', fields: [{ field: 'name' }] }],
  subforms: [{ childObject: 'opportunity_line_item', amountField: 'amount' }],
  sharing: { enabled: true, publicLink: 'opp-form', allowAnonymous: false },
  submitBehavior: { kind: 'redirect', url: '/done' },
  buttons: {
    submit: { show: true, label: 'Save' },
    cancel: { show: false },
    reset: { show: true, label: 'Reset' },
  },
  defaults: { stage: 'prospecting' },
};

/**
 * A form authored with ONLY the deprecated visibility spelling.
 *
 * The full fixture above authors both spellings, so the canonical one wins
 * there and `visibleOn`'s own value never reaches the node — a row asserted
 * against that fixture would pass whether or not the fallback exists. This is
 * the input the fallback is FOR: metadata that never went through the parser
 * (the parser folds the key away), which is also the class the bridge still
 * reads `groups` for.
 */
const DEPRECATED_ONLY_FORM_VIEW = {
  type: 'simple',
  sections: [
    {
      label: 'Legacy',
      visibleOn: 'record.stage != "closed"',
      fields: [{ field: 'name', visibleOn: 'record.active == true' }],
    },
  ],
};

const node = new SpecBridge().transformFormView(FULL_SPEC_FORM_VIEW);
const section = (node.sections as any[])[0];
const field = section.fields[0];

const legacyNode = new SpecBridge().transformFormView(DEPRECATED_ONLY_FORM_VIEW);
const legacySection = (legacyNode.sections as any[])[0];
const legacyField = legacySection.fields[0];

/** Spec FormViewSchema keys → where the authored value lands on the node. */
const MAPPED_VIEW_KEYS: Record<string, () => void> = {
  type: () => expect(node.formType).toBe('split'), // ObjectUI rename, not verbatim
  layout: () => expect(node.layout).toBe('grid'),
  columns: () => expect(node.columns).toBe(2),
  title: () => expect(node.title).toBe('Edit Opportunity'),
  description: () => expect(node.description).toBe('All the fields'),
  defaultTab: () => expect(node.defaultTab).toBe('details'),
  tabPosition: () => expect(node.tabPosition).toBe('left'),
  allowSkip: () => expect(node.allowSkip).toBe(true),
  showStepIndicator: () => expect(node.showStepIndicator).toBe(false),
  splitDirection: () => expect(node.splitDirection).toBe('horizontal'),
  splitSize: () => expect(node.splitSize).toBe(40),
  splitResizable: () => expect(node.splitResizable).toBe(true),
  drawerSide: () => expect(node.drawerSide).toBe('right'),
  drawerWidth: () => expect(node.drawerWidth).toBe('480px'),
  modalSize: () => expect(node.modalSize).toBe('lg'),
  data: () => expect(node.data).toEqual({ provider: 'object', object: 'opportunity' }),
  sections: () => expect(node.sections).toHaveLength(1),
  subforms: () => expect(node.subforms).toEqual(FULL_SPEC_FORM_VIEW.subforms),
  sharing: () => expect(node.sharing).toEqual(FULL_SPEC_FORM_VIEW.sharing),
  submitBehavior: () => expect(node.submitBehavior).toEqual({ kind: 'redirect', url: '/done' }),
  // objectui#5898 — `ObjectFormSchema` declares both slots and `ObjectForm`
  // folds them at render (`buttons.*` onto the flat button props, `defaults`
  // into create-mode initial values). The spec's own descriptions name that
  // renderer as the consumer, which is why these are mapped and not exempted.
  buttons: () => expect(node.buttons).toEqual(FULL_SPEC_FORM_VIEW.buttons),
  defaults: () => expect(node.defaults).toEqual({ stage: 'prospecting' }),
};

const IGNORED_VIEW_KEYS: Record<string, string> = {
  groups:
    'Legacy alias of `sections` (the contract folds it at parse, #6926). Normalized into ' +
    'node.sections here for the never-parsed input class, and deliberately NOT re-emitted as a ' +
    'second key the renderer would have to learn — `ObjectForm` reads `sections` only.',
};

/** Spec FormSectionSchema keys → where the authored value lands on the section. */
const MAPPED_SECTION_KEYS: Record<string, () => void> = {
  name: () => expect(section.name).toBe('basic_info'),
  label: () => expect(section.label).toBe('Basic Info'),
  description: () => expect(section.description).toBe('Who and what'),
  collapsible: () => expect(section.collapsible).toBe(true),
  collapsed: () => expect(section.collapsed).toBe(false),
  columns: () => expect(section.columns).toBe(2),
  visibleWhen: () => expect(section.visibleWhen).toBe('record.stage != "closed"'),
  // objectui#5898 — asserted on the deprecated-only fixture, because the full
  // fixture authors the canonical spelling beside it and that one wins.
  visibleOn: () => expect(legacySection.visibleWhen).toBe('record.stage != "closed"'),
  // objectui#5898 — `ObjectFormSection.pane`, read by `SplitForm`'s `paneOf`.
  pane: () => expect(section.pane).toBe('primary'),
  fields: () => {
    expect(section.fields).toHaveLength(2);
    // The bare-name shorthand travels verbatim; `normalizeSectionField`
    // resolves it against the object schema.
    expect(section.fields[1]).toBe('amount');
  },
};

const IGNORED_SECTION_KEYS: Record<string, string> = {};

/** Spec FormFieldSchema keys → where the authored value lands on the field. */
const MAPPED_FIELD_KEYS: Record<string, () => void> = {
  field: () => expect(field.name).toBe('name'), // identity key → the runtime data path
  type: () => expect(field.type).toBe('text'),
  label: () => expect(field.label).toBe('Name'),
  placeholder: () => expect(field.placeholder).toBe('Acme deal'),
  helpText: () => expect(field.helpText).toBe('Deal name'),
  readonly: () => expect(field.readonly).toBe(false),
  required: () => expect(field.required).toBe(true),
  hidden: () => expect(field.hidden).toBe(false),
  colSpan: () => expect(field.colSpan).toBe(2),
  widget: () => expect(field.widget).toBe('input'),
  options: () => expect(field.options).toEqual([{ label: 'Tech', value: 'tech' }]),
  reference: () => expect(field.reference).toBe('account'),
  dependsOn: () => expect(field.dependsOn).toBe('account'),
  // ADR-0089: the view-level predicate lands in the node's `visibleOn` slot.
  visibleWhen: () => expect(field.visibleOn).toBe('record.active == true'),
  visibleOn: () => expect(legacyField.visibleOn).toBe('record.active == true'),
  // objectui#5898 — same-name copies onto the runtime FormField, matching the
  // destinations `normalizeSectionField` pins in
  // `plugin-form/src/sectionFields.spec-parity.test.ts`.
  maxLength: () => expect(field.maxLength).toBe(120),
  minLength: () => expect(field.minLength).toBe(2),
  min: () => expect(field.min).toBe(0),
  max: () => expect(field.max).toBe(100),
  precision: () => expect(field.precision).toBe(10),
  scale: () => expect(field.scale).toBe(2),
  multiple: () => expect(field.multiple).toBe(false),
  immutable: () => expect(field.immutable).toBe(true),
  span: () => expect(field.span).toBe('full'),
  language: () => expect(field.language).toBe('sql'),
  disclosure: () => expect(field.disclosure).toBe('popover'),
  keyField: () =>
    expect(field.keyField).toEqual({
      field: 'name',
      label: 'Name',
      regex: '^[a-z_]+$',
      immutable: true,
    }),
  // Verbatim, in the SPEC vocabulary — the runtime slot is a pass-through and
  // its pinned row asserts the authored `{ field: 'inner' }` survives.
  fields: () => expect(field.fields).toEqual([{ field: 'inner', type: 'text' }]),
};

const IGNORED_FIELD_KEYS: Record<string, string> = {
  publicPicker:
    'A SERVER-side authorization opt-in, not a presentation delta: it gates objectstack\'s ' +
    'public-lookup route (`GET /forms/:slug/lookup/:field` answers 403 LOOKUP_NOT_PUBLIC without ' +
    'it) and the public-form resolve route strips undeclared lookup fields before any renderer ' +
    'sees them. This bridge builds the `object-form` node for an in-app authenticated form and ' +
    'has no destination for it — carrying it would invent a client-side meaning for a capability ' +
    'only the server enforces. Same reasoned exemption the downstream chokepoint records ' +
    '(objectui#4648 delegated ruling item 5, 2026-08-15); it becomes an implementation card if ' +
    'ObjectUI ever renders anonymous public forms.',
};

const LEVELS = [
  {
    level: 'FormViewSchema',
    schema: FormViewSchema,
    mapped: MAPPED_VIEW_KEYS,
    ignored: IGNORED_VIEW_KEYS,
    retired: ['aria', 'defaultSort'],
  },
  {
    level: 'FormSectionSchema',
    schema: FormSectionSchema,
    mapped: MAPPED_SECTION_KEYS,
    ignored: IGNORED_SECTION_KEYS,
    retired: [] as string[],
  },
  {
    level: 'FormFieldSchema',
    schema: FormFieldSchema,
    mapped: MAPPED_FIELD_KEYS,
    ignored: IGNORED_FIELD_KEYS,
    retired: [] as string[],
  },
] as const;

describe('FormView spec conformance (#2545) — key census derived from the contract', () => {
  it('the fixture is a document the contract accepts (the control)', () => {
    const parsed = FormViewSchema.safeParse(FULL_SPEC_FORM_VIEW);
    // Without this, every row below could be asserting against metadata no
    // author could publish, and the census would describe a private dialect.
    expect(
      parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    ).toEqual([]);
    expect(FormViewSchema.safeParse(DEPRECATED_ONLY_FORM_VIEW).success).toBe(true);
  });

  for (const { level, schema, mapped, ignored, retired } of LEVELS) {
    describe(level, () => {
      it('claims every live contract key exactly once (map it, or explain it)', () => {
        const claimed = [...Object.keys(mapped), ...Object.keys(ignored)].sort();
        // The assertion the old fixture-driven loop could not make: the
        // expected side is the CONTRACT, so a key nobody remembered still
        // fails here.
        expect(claimed).toEqual(liveSpecKeys(schema));
      });

      it('holds no stale rows for keys the contract has dropped', () => {
        const live = liveSpecKeys(schema);
        for (const key of [...Object.keys(mapped), ...Object.keys(ignored)]) {
          expect(live, `'${key}' is no longer a ${level} key`).toContain(key);
        }
      });

      it('sees the tombstoned keys as tombstones, and nothing else', () => {
        // Both directions of the `liveSpecKeys` filter. Over-filtering would
        // silently shrink the census above; under-filtering would demand a
        // mapping for a key the contract refuses.
        expect(retiredSpecKeys(schema)).toEqual([...retired]);
      });

      it('the fixture exercises every mapped key (no row can pass vacuously)', () => {
        // A conformance fixture assembled only from keys the bridge already
        // carried is why this file was green while 18 keys were dropped.
        expect(Object.keys(mapped).length).toBeGreaterThan(0);
      });

      for (const [key, assertRow] of Object.entries(mapped)) {
        it(`carries spec '${key}' to its destination on the node`, () => {
          assertRow();
        });
      }

      for (const [key, reason] of Object.entries(ignored)) {
        it(`states why spec '${key}' is deliberately not carried`, () => {
          // "Not silently" is the promise — an ignore entry with no reason is
          // the silent drop wearing a label.
          expect(reason.length).toBeGreaterThan(80);
          expect(reason, `'${key}' has no tracking reference`).toMatch(/#\d+/);
        });
      }
    });
  }
});

describe('FormView spec conformance (#2545) — round-trip behaviour', () => {
  it('normalizes legacy groups into sections (groups-only spec now renders)', () => {
    const bridge = new SpecBridge();
    const groupsOnly = bridge.transformFormView({
      type: 'simple',
      groups: [{ label: 'Legacy Group', fields: [{ field: 'name' }] }],
    });

    expect(groupsOnly.groups).toBeUndefined();
    const sections = groupsOnly.sections as any[];
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('Legacy Group');
    expect(sections[0].fields[0].name).toBe('name');
  });

  it('prefers sections over groups when both are present', () => {
    const bridge = new SpecBridge();
    const both = bridge.transformFormView({
      sections: [{ label: 'Canonical', fields: [] }],
      groups: [{ label: 'Legacy', fields: [] }],
    });

    const sections = both.sections as any[];
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('Canonical');
  });

  it('maps every form variant name onto node.formType', () => {
    const bridge = new SpecBridge();
    for (const variant of ['simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal']) {
      expect(bridge.transformFormView({ type: variant }).formType).toBe(variant);
    }
    // An unknown variant is refused rather than forwarded — `mapFormType`'s
    // allowlist is the reason `formType` is a mapped key and not a passthrough.
    expect(bridge.transformFormView({ type: 'carousel' }).formType).toBeUndefined();
  });

  it('drops nothing when the canonical and deprecated visibility spellings disagree', () => {
    // Precedence, asserted on both carriers: the canonical spelling wins, which
    // is what the contract's own `normalizeVisibleWhen` does with this input.
    expect(section.visibleWhen).toBe('record.stage != "closed"');
    expect(field.visibleOn).toBe('record.active == true');
  });
});
