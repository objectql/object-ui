/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Form-view bridge input — the documented SUBSET of `@objectstack/spec`'s
 * FormViewSchema this bridge consumes, with every drift-prone key's TYPE bound
 * to the contract instead of restated (objectui#5652).
 *
 * The subset stays hand-listed on purpose: this declaration is load-bearing
 * documentation, and its NON-declarations are a retirement ledger
 * (`defaultSort` / `aria`, objectui#3901 / #3974) that a blanket
 * `Omit<FormView, ...>` would erase. What was never deliberate is the TYPE each
 * declared key was given. Three of them had drifted from what the contract
 * accepts, and nothing ever compared the two descriptions — the mirror shape
 * `scripts/check-spec-symbol-derivation.mjs` exists to catch. The sibling
 * bridge in this directory (`list-view.ts`) was converted the same way and for
 * the same reason (objectui#2231): the shape derives, so it cannot drift.
 *
 * ## What the contract actually answers
 *
 * Measured with `safeParse` against the installed `@objectstack/spec` while
 * fixing this, NOT copied from the finding — two of its three rows were wrong,
 * in ways that change the repair:
 *
 *   FormSection.columns    `1 | 2 | 3 | 4 | '1' | '2' | '3' | '4'`. The string
 *                          arm IS admitted, and the section schema's own pipe
 *                          folds it to a number. The bridge declared `number`
 *                          and refused it.
 *   FormView.columns       `number`, with NO string arm: `FormViewSchema`
 *                          rejects `columns: '3'` at the FORM level while
 *                          `FormSectionSchema` accepts it at the SECTION level.
 *                          The bridge's `number` was already right here — it is
 *                          bound to the contract so the asymmetry cannot rot,
 *                          and the two answers are pinned side by side.
 *   FormField.dependsOn    a BARE parent-field name. The array arm is rejected
 *                          by the contract outright. The bridge declared
 *                          `string[]`, so it admitted only the arm the contract
 *                          refuses and refused the only arm it admits — the one
 *                          configuration that makes `field-selector` and
 *                          `dynamic-config` work (objectui#5040).
 *   *.visibleWhen          `string | { dialect, source?, ast?, meta? }`, with
 *                          `dialect` REQUIRED and enum-typed. `{ dialect?,
 *                          source }` is a DIFFERENT layer's type — the
 *                          evaluator's `FieldRulePredicate` (`@object-ui/core`,
 *                          ADR-0089) — and the contract does not accept it: an
 *                          object arm without `dialect` is refused. The bridge
 *                          declared `string` and refused the object arm
 *                          entirely.
 *
 * ## Declaring an arm is not consuming it
 *
 * A key that is declarable but dropped on the way out is the same defect one
 * layer over (objectui#5542 / #5594), so each widened arm is followed all the
 * way onto the `object-form` node by `FormViewWidenedArms.test.ts`, and the one
 * arm that needs a translation to get there gets it — see `normalizeColumns`.
 */

import type { BaseSchema, DependsOnInput } from '@object-ui/types';
// `FormFieldInput` is the AUTHORING half of the spec's form field (`z.input`) —
// what a bridge that reads authored metadata is handed. Its parsed twin,
// `FormField`, is banned from import here by `no-restricted-imports` (it names
// the runtime vocabulary in this repo, and its spec type erases to `any` —
// objectstack#4171 / objectui#3090). `FormFieldInput` carries neither problem.
import type { FormFieldInput, FormSection, FormView } from '@objectstack/spec/ui';
import type { BridgeContext, BridgeFn } from '../types.js';

/**
 * A form field as authored. Exported so the derivation pins in
 * `__tests__/FormViewWidenedArms.test.ts` can name the declared types; NOT
 * re-exported by `spec-bridge/index.ts`, so the package surface is unchanged.
 */
export interface FormFieldSpec {
  field: string;
  /** Field type (spec FormFieldSchema reuses Data.FieldType; auto-infers widget). */
  type?: string;
  /** Options for select/multiselect/radio/checkboxes fields. */
  options?: any[];
  /** Target object name for lookup/master_detail fields. */
  reference?: string;
  label?: string;
  placeholder?: string;
  helpText?: string;
  readonly?: boolean;
  required?: boolean;
  hidden?: boolean;
  colSpan?: number;
  widget?: string;
  /**
   * Sibling field name whose value this field's widget reads (objectui#5040).
   *
   * The contract admits a BARE NAME and refuses an array. This is the wider
   * {@link DependsOnInput} rather than the contract's `string` alone because
   * the value is FORWARDED, unread, into the node slot that is declared with
   * exactly this type (`FormField.dependsOn`, `@object-ui/types`) and read by
   * `resolveCascadingOptions` / `resolveDependsOnFields` (`@object-ui/core`),
   * whose parameter is also exactly this type (framework#4074). Narrowing to
   * the contract's `string` would refuse array-authored layouts that the
   * runtime has always honoured, on the same never-parsed inputs `groups` and
   * `visibleOn` below are still read for. The contract's arm is a subset of
   * this one, which is what the derivation pin asserts — so a spec that widens
   * `dependsOn` fails the pin instead of silently outgrowing the declaration.
   */
  dependsOn?: DependsOnInput;
  /** Canonical conditional-visibility predicate (ADR-0089), bound to the contract. */
  visibleWhen?: FormFieldInput['visibleWhen'];
  /** @deprecated ADR-0089 -> `visibleWhen`. */
  visibleOn?: FormFieldInput['visibleOn'];

  // ── Keys restored by objectui#5898 ──────────────────────────────────────────
  // Every one below was a spec key this declaration did not name, so `mapField`
  // could not copy it and the authored value ended at this seam. Each has a
  // destination on the runtime `FormField` that `normalizeSectionField`
  // (@object-ui/plugin-form) already pins by name in
  // `sectionFields.spec-parity.test.ts` — the SAME slot, so a bridged field and
  // a directly-normalised one carry the value identically. Types are bound to
  // the contract rather than restated, per this file's derivation policy.
  /** Text length constraints. */
  maxLength?: FormFieldInput['maxLength'];
  minLength?: FormFieldInput['minLength'];
  /** Numeric constraints. */
  min?: FormFieldInput['min'];
  max?: FormFieldInput['max'];
  precision?: FormFieldInput['precision'];
  scale?: FormFieldInput['scale'];
  /** Multi-value flag — part of the (type, multiple) pair the widget id derives from. */
  multiple?: FormFieldInput['multiple'];
  /** Editable on create, locked once the record exists. */
  immutable?: FormFieldInput['immutable'];
  /** Relative field width (`'auto' | 'full'`) — preferred over the legacy `colSpan`. */
  span?: FormFieldInput['span'];
  /** Code-editor language, for `type: 'code'` fields. */
  language?: FormFieldInput['language'];
  /** Record-typed field key column config (ADR-0007). */
  keyField?: FormFieldInput['keyField'];
  /** Composite rendering mode: inline box or summary + popover (ADR-0007). */
  disclosure?: FormFieldInput['disclosure'];
  /**
   * Sub-fields for `composite` / `repeater` / `record` types. Forwarded
   * VERBATIM, in the spec vocabulary (`field`, not `name`): the runtime slot is
   * the pass-through `base.fields = fd.fields` in `normalizeSectionField`, and
   * its pinned row asserts the authored shape survives (`{ field: 'inner' }`).
   * Recursing through `mapField` here would rewrite the sub-field identity key
   * and hand the widget a shape its own gate says it must not receive.
   */
  fields?: FormFieldInput['fields'];

  // `publicPicker` is NOT declared here, and that is the deliberate half of
  // #2545's promise — an explained refusal, not a silent drop. It is a
  // SERVER-side authorization opt-in, not a presentation delta: it gates
  // objectstack's public-lookup route (`GET /forms/:slug/lookup/:field` answers
  // `403 LOOKUP_NOT_PUBLIC` for a field whose form declaration lacks it), and
  // the public-form resolve route strips undeclared lookup fields before the
  // metadata ever reaches a renderer. This bridge builds the `object-form` node
  // for an in-app authenticated form and has no destination for it — zero read
  // points repo-wide. Carrying it onto the node would invent a client-side
  // meaning for a capability only the server enforces. Same reasoned exemption
  // the downstream chokepoint already records, on the same delegated ruling
  // (objectui#4648 item 5, 2026-08-15); it becomes an implementation card if
  // ObjectUI ever renders anonymous public forms.
}

/** One section of a form layout, as authored. */
export interface FormSectionSpec {
  /** Stable section identifier for i18n lookup (spec FormSectionSchema.name). */
  name?: string;
  label?: string;
  description?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  /** Bound to the contract: the string spelling of a column count is admitted. */
  columns?: FormSection['columns'];
  /** Section-level conditional-visibility predicate (ADR-0089), bound to the contract. */
  visibleWhen?: FormSection['visibleWhen'];
  /**
   * @deprecated ADR-0089 -> `visibleWhen`.
   *
   * Declared and FOLDED, not carried (objectui#5898). The contract accepts this
   * spelling and normalises it away in `FormSectionSchema`'s own
   * `.transform(normalizeVisibleWhen)`, so a section that has been through the
   * parser never presents it — but this bridge is also the seam for the
   * never-parsed input class it already reads `groups` and field `visibleOn`
   * for, and on that input the section path read only `visibleWhen`. The
   * deprecated spelling was therefore dropped on exactly the documents the
   * fallback exists for. Folding here reproduces the contract's own
   * normalisation rather than teaching the node a second key.
   */
  visibleOn?: FormSection['visibleOn'];
  /**
   * Which pane of a split form this section renders in (`type: 'split'` only —
   * the contract rejects the key on any other form type at parse). Restored by
   * objectui#5898: the node declares the same slot (`ObjectFormSection.pane`),
   * `ObjectForm`'s split branch copies it, and `SplitForm`'s `paneOf` reads it.
   * Dropped here, a spec-authored split form fell back to the legacy positional
   * rule (first section primary, the rest secondary) — so reordering sections
   * moved them across the divider, the exact failure `pane` was added to
   * prevent.
   */
  pane?: FormSection['pane'];
  /**
   * The authored field list. A bare string is the spec's shorthand for "this
   * object's own field, rendered with its defaults" — the same shorthand
   * `mapColumn` already honours on the list bridge.
   */
  fields?: Array<string | FormFieldSpec>;
}

/**
 * The subset of `@objectstack/spec` FormViewSchema the bridge consumes.
 * Every serializable spec key is either mapped onto the `object-form` node
 * or listed here with an explicit reason for being ignored — the bridge must
 * never silently drop spec configuration (#2545).
 *
 * ⚠️ That promise was FALSE for 18 keys until objectui#5898, and the way it
 * stayed false is the part worth keeping: the conformance test that enforces it
 * ran its completeness loop over `Object.keys(FIXTURE)`, so a key nobody
 * remembered to put in the fixture was a key the loop never asked about. A
 * hand-listed subset is legitimate here (its NON-declarations are a retirement
 * ledger a blanket `Omit` would erase) — a hand-listed *check* of that subset is
 * not. The loop now derives its key set from the contract's own shape at all
 * three levels, so a spec key that is neither mapped nor explained fails the
 * suite by construction rather than by recall.
 */
export interface FormViewSpec {
  type?: string;
  layout?: string;
  /** Bound to the contract, which admits NO string arm here — unlike a section. */
  columns?: FormView['columns'];
  title?: string;
  description?: string;
  // Tabbed (`type: 'tabbed'`)
  defaultTab?: string;
  tabPosition?: string;
  // Wizard (`type: 'wizard'`)
  allowSkip?: boolean;
  showStepIndicator?: boolean;
  // Split (`type: 'split'`)
  splitDirection?: string;
  splitSize?: number;
  splitResizable?: boolean;
  // Drawer (`type: 'drawer'`)
  drawerSide?: string;
  drawerWidth?: string;
  // Modal (`type: 'modal'`)
  modalSize?: string;
  data?: any;
  sections?: FormSectionSpec[];
  /** Legacy alias of `sections` (spec: "Legacy support → alias to sections"). */
  groups?: FormSectionSpec[];
  /** Inline master-detail child collections. */
  subforms?: any[];
  /**
   * Structured action-button config (`submit` / `cancel` / `reset` visibility +
   * label). Restored by objectui#5898: the node declares the same slot
   * (`ObjectFormSchema.buttons`) and `ObjectForm` folds it down onto the flat
   * `showSubmit` / `submitText` / … props at render. The spec key exists FOR
   * this consumer — its own description names ObjectUI's ObjectForm as what
   * consumes it (framework#1894 / #2998) — so an ignore-list entry would have
   * been the wrong repair.
   */
  buttons?: FormView['buttons'];
  /**
   * Create-mode initial field values, keyed by field machine name. Restored by
   * objectui#5898 for the same reason as `buttons`: `ObjectFormSchema.defaults`
   * is the declared slot and `ObjectForm` folds it into `initialValues` at
   * render.
   */
  defaults?: FormView['defaults'];
  // `defaultSort` and `aria` are NOT declared here on purpose — see the
  // retirement note above `bridgeFormView`'s trailing key copies (#3901/#3974).
  // Re-adding either to this mirror is the first half of re-adding a read that
  // can never fire.
  sharing?: any;
  submitBehavior?: any;
}

/**
 * Fold the contract's string spelling of a column count onto the number the
 * node carries.
 *
 * `FormSectionSchema` accepts `'2'` and `2` and normalises the string away in
 * its own pipe; the `object-form` node's section declares `columns?: 1|2|3|4`
 * and `FormSectionContainer` indexes its grid-class map by that number. Its
 * header states where the fold belongs: "The normalisation belongs at the seam
 * that parses authored metadata, not in the container's props." This bridge is
 * that seam. Forwarding `'2'` verbatim hands every downstream renderer a value
 * outside the type it declares.
 */
function normalizeColumns(columns: FormSectionSpec['columns']): number | undefined {
  return typeof columns === 'string' ? Number(columns) : columns;
}

function mapField(field: FormFieldSpec): Record<string, any> {
  const mapped: Record<string, any> = {
    name: field.field,
    label: field.label ?? field.field,
  };

  if (field.type) mapped.type = field.type;
  if (field.options) mapped.options = field.options;
  if (field.reference) mapped.reference = field.reference;
  if (field.placeholder) mapped.placeholder = field.placeholder;
  if (field.helpText) mapped.helpText = field.helpText;
  if (field.readonly != null) mapped.readonly = field.readonly;
  if (field.required != null) mapped.required = field.required;
  if (field.hidden != null) mapped.hidden = field.hidden;
  if (field.colSpan != null) mapped.colSpan = field.colSpan;
  if (field.widget) mapped.widget = field.widget;
  // objectui#5898 — the constraint / presentation / composite keys the
  // declaration above had never named. Every one is a SAME-NAME copy, matching
  // the destination `normalizeSectionField` gives it when it normalises an
  // authored spec field directly (`base.maxLength = fd.maxLength`, …), so the
  // two routes to a runtime `FormField` agree key for key. `!= null` rather
  // than truthiness throughout: `min: 0`, `precision: 0`, `multiple: false` and
  // `immutable: false` are all authored decisions, and a truthiness test would
  // drop them exactly as the missing declaration did.
  if (field.maxLength != null) mapped.maxLength = field.maxLength;
  if (field.minLength != null) mapped.minLength = field.minLength;
  if (field.min != null) mapped.min = field.min;
  if (field.max != null) mapped.max = field.max;
  if (field.precision != null) mapped.precision = field.precision;
  if (field.scale != null) mapped.scale = field.scale;
  if (field.multiple != null) mapped.multiple = field.multiple;
  if (field.immutable != null) mapped.immutable = field.immutable;
  if (field.span != null) mapped.span = field.span;
  if (field.language != null) mapped.language = field.language;
  if (field.keyField != null) mapped.keyField = field.keyField;
  if (field.disclosure != null) mapped.disclosure = field.disclosure;
  // Verbatim, in the spec vocabulary — see the declaration's note: the runtime
  // slot is a pass-through and its pinned row asserts `{ field: 'inner' }`
  // survives unrewritten.
  if (Array.isArray(field.fields)) mapped.fields = field.fields;
  // Forwarded unread into the node's `dependsOn`, which is declared with the
  // same type and read by `@object-ui/core`'s cascading-option resolver.
  if (field.dependsOn) mapped.dependsOn = field.dependsOn;
  // ADR-0089: `visibleWhen` is the canonical view-form-field visibility predicate
  // (the spec folds the deprecated `visibleOn` into it at parse). Prefer it and
  // fall back to `visibleOn` for raw / un-normalized metadata. The ObjectForm
  // renderer reads this view-level predicate from the node's `visibleOn` slot.
  //
  // Both contract arms travel whole: the bare CEL string, and the expression
  // object. `evalFieldPredicate` reads `{ dialect, source }` back out of the
  // object arm, which is how a spec-authored `{ dialect: 'cel', source: ... }`
  // now drives visibility instead of being refused by this declaration. An
  // `ast`-only expression (legal metadata: the contract requires `dialect` plus
  // one of `source` / `ast`) is forwarded whole rather than dropped, but no
  // evaluator in this repo reads an `ast` today — that gap is the evaluator's,
  // and the bridge must not hide it by discarding the key.
  const visiblePredicate = field.visibleWhen ?? field.visibleOn;
  if (visiblePredicate) mapped.visibleOn = visiblePredicate;

  return mapped;
}

function mapSection(section: FormSectionSpec): Record<string, any> {
  const mapped: Record<string, any> = {
    // A bare field name is the spec's shorthand and is forwarded verbatim: the
    // node's `fields` slot admits it and `normalizeSectionField`
    // (@object-ui/plugin-form) resolves it against the object schema. Running
    // it through `mapField` instead produced `{ name: undefined }` — a field
    // with no identity — for the most ordinary section a form can declare.
    fields: (section.fields ?? []).map((field) =>
      typeof field === 'string' ? field : mapField(field),
    ),
  };

  if (section.name) mapped.name = section.name;
  if (section.label) mapped.label = section.label;
  if (section.description) mapped.description = section.description;
  if (section.collapsible != null) mapped.collapsible = section.collapsible;
  if (section.collapsed != null) mapped.collapsed = section.collapsed;
  if (section.columns != null) mapped.columns = normalizeColumns(section.columns);
  // Whole, both arms — same predicate contract as the field above. The
  // deprecated `visibleOn` spelling folds onto the canonical slot exactly as
  // `FormSectionSchema`'s own `.transform(normalizeVisibleWhen)` does, so a
  // never-parsed document reaches the node saying what a parsed one would
  // (objectui#5898). Canonical wins when both are authored, matching the
  // contract's precedence and the field path directly above.
  const sectionPredicate = section.visibleWhen ?? section.visibleOn;
  if (sectionPredicate) mapped.visibleWhen = sectionPredicate;
  // objectui#5898 — explicit split-pane placement. `ObjectFormSection.pane` is
  // the node slot; `ObjectForm`'s split branch copies it and `SplitForm`'s
  // `paneOf` reads it, falling back to the positional rule only when it is
  // absent. Dropped here, every spec-authored placement took that fallback.
  if (section.pane != null) mapped.pane = section.pane;

  return mapped;
}

/** Maps spec formType to ObjectUI formType */
function mapFormType(type?: string): string | undefined {
  if (!type) return undefined;
  const validTypes = ['simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal'];
  return validTypes.includes(type) ? type : undefined;
}

/**
 * Spec FormViewSchema keys carried onto the `object-form` node verbatim.
 * All of them are declared with the same name (and semantics) on
 * `ObjectFormSchema`, so no per-key mapping is needed — only presence checks.
 */
const PASSTHROUGH_KEYS = [
  'layout',
  'columns',
  'title',
  'description',
  'defaultTab',
  'tabPosition',
  'allowSkip',
  'showStepIndicator',
  'splitDirection',
  'splitSize',
  'splitResizable',
  'drawerSide',
  'drawerWidth',
  'modalSize',
  'subforms',
  // objectui#5898 — the spec's structured authoring surface for the form's
  // action buttons and its create-mode initial values. Same name and semantics
  // on `ObjectFormSchema`, where `ObjectForm` folds both down at render.
  'buttons',
  'defaults',
] as const;

/** Transforms a FormView spec into a Form SchemaNode */
export const bridgeFormView: BridgeFn<FormViewSpec> = (
  spec: FormViewSpec,
  _context: BridgeContext,
): BaseSchema => {
  // Spec defines `groups` as a legacy alias of `sections`; normalize here so
  // downstream renderers only ever see `sections` (ObjectForm never reads a
  // `groups` key — before this normalization a groups-only spec silently
  // rendered no sections at all, #2545).
  const sections = (spec.sections ?? spec.groups ?? []).map(mapSection);
  const formType = mapFormType(spec.type);

  const node: BaseSchema = {
    type: 'object-form',
    id: `form-${spec.type ?? 'default'}`,
    sections,
    data: spec.data,
  };

  // P1.2 — formType mapping (tabbed, wizard, split, drawer, modal)
  if (formType) node.formType = formType;

  // #2545 — same-name spec keys (layout, title, tab/wizard/split/drawer/modal
  // options, subforms) pass straight through onto the node.
  for (const key of PASSTHROUGH_KEYS) {
    if (spec[key] != null) node[key] = spec[key];
  }

  if (spec.submitBehavior) node.submitBehavior = spec.submitBehavior;

  // P1.6 — sharing
  if (spec.sharing) node.sharing = spec.sharing;

  // `defaultSort` (#3974) and `aria` (#3901) USED to be copied here. Both are
  // `retiredKey()` tombstones on spec 17's FormViewSchema, so a FormView that
  // parsed can never carry either — the guards were unreachable, and their
  // shape invited the next reader to copy a dead pattern. Removed under the
  // maintainer's 2026-08-11 enforce-or-remove ruling; measured dormant at BOTH
  // ends before removal:
  //   - producer: `FormViewSchema.safeParse` rejects both keys by name
  //     (`form.defaultSort` / `form.aria` removed in the #3896 close-out).
  //   - consumer: no form renderer reads either off the node — plugin-form
  //     reads neither, and `SchemaRenderer`'s generic ARIA injection resolves
  //     FLAT `ariaLabel`/`ariaDescribedBy`/`role` (SchemaRenderer.tsx:109-119),
  //     never a nested `aria` object.
  // The nested `aria` copy is still correct on the LIST bridge
  // (`list-view.ts:214`), whose carrier stayed live and IS consumed at
  // `plugin-list/src/ListView.tsx:2389-2392` — do not "align" the two.
  // Pinned by `__tests__/FormViewRetiredKeys.test.ts`.

  return node;
};
