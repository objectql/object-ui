// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The metadata-admin form **authoring surface**, in ONE declaration.
 *
 * `FormFieldSpec` is what an author may write on a form-layout field. It has
 * two consumers and they used to hold two different descriptions of it:
 * `SchemaForm.tsx` declared it as the element type of `FormSectionSpec.fields`,
 * and `widgets.tsx` declared its own inline copy as `WidgetProps.fieldSpec`.
 * The copies disagreed — the widget-side one declared `dependsOn`, which
 * `field-selector` and `dynamic-config` read as required configuration, and
 * the authoring-side one did not — so the only configuration that makes those
 * widgets work did not type-check for anyone who typed their spec
 * (objectui#5040). One value travelled down one channel and was described twice.
 *
 * It lives in a leaf rather than in `SchemaForm.tsx` because the import runs
 * the other way: `SchemaForm.tsx` imports `./widgets.js`, so a back-edge from
 * `widgets.tsx` would close a cycle. A module that imports nothing at RUNTIME is
 * importable from both sides. `SchemaForm.tsx` re-exports all three names, so the
 * surface every existing importer reaches for is unchanged.
 *
 * ## The two containers above the leaf (objectui#5596)
 *
 * `FormSectionSpec` and `FormViewSpec` were hand-declared TWICE for the same
 * reason and with the same result: once in `SchemaForm.tsx`, once in
 * `apps/console`'s `FormPage.tsx`. Unlike the field spec, whose console copy was
 * a clean subset, these two had already drifted in BOTH directions -- so neither
 * was a subset of the other and there were two live answers to what an author
 * may write:
 *
 *   FormSectionSpec  app-shell had `description`/`visibleWhen`/`visibleOn`; the
 *                    console had none of them. The console's `columns` admitted
 *                    the string arm (`'1'|'2'|'3'|'4'`); app-shell's took
 *                    numbers only.
 *   FormViewSpec     the console had `label`/`groups`/`sharing`/`submitBehavior`;
 *                    app-shell stopped at `type` plus `sections`.
 *
 * Both are now DERIVED from `@objectstack/spec`'s own `FormSection` / `FormView`
 * rather than restated, which is the repo's sanctioned form for a spec-shaped
 * local type (`scripts/check-spec-symbol-derivation.mjs`). The import is
 * `import type`, so this module still pulls in nothing at runtime and the leaf
 * property above is unchanged.
 *
 * Deriving decides the drift by asking the contract instead of a reader:
 * `columns` DOES admit the string arm (`FormSectionSchema.columns` is a union of
 * `z.enum(['1','2','3','4'])` with the four numeric literals, folded to a number
 * by its own transform), so app-shell's numbers-only declaration was rejecting
 * metadata the platform accepts -- objectui#5040's symptom, not a deliberate
 * narrowing. `description`, `visibleWhen`, `visibleOn`, and also `name` and
 * `pane`, are likewise spec keys that simply went undeclared on one side or the
 * other.
 *
 * ## Why DERIVED-WITH-NAMED-NARROWINGS and not a bare re-export
 *
 * A bare `export type FormSectionSpec = FormSection` would put two different
 * answers INSIDE one document, one nesting level apart, because the spec writes
 * its containers in vocabularies the converged leaf above deliberately does not
 * use:
 *
 *   - `FormSection.label` / `.description` are the spec's `I18nLabel`
 *     (`string | InlineLocaleMap`). `FormFieldSpec.label` -- already converged,
 *     already landed -- is `string`, because both renderers put the value
 *     straight into a text slot and neither resolves a locale map. A section
 *     admitting `{ en: 'x' }` above a field refusing it is the same defect class
 *     this file exists to close.
 *   - `FormSection.visibleWhen` / `.visibleOn` are the spec's `ExpressionInput`
 *     (`dialect` REQUIRED and enum-typed, `source` optional, plus `ast`/`meta`).
 *     The predicate that actually reaches an evaluator here is
 *     {@link VisibilityPredicate} -- `dialect` optional, `source` required --
 *     which is the shape `@object-ui/core`'s `evalFieldPredicate` takes.
 *   - `FormSection.fields` elements are the spec's `FormField` (29 keys), not
 *     the 26-key {@link FormFieldSpec} objectui#5542 converged and pinned.
 *     Re-pointing that position is what would silently re-open #5542.
 *
 * So every key the two layers agree on comes FROM the spec and cannot fall
 * behind it, and each of the four positions where this layer is deliberately
 * narrower is named in an `Omit` list and restated once, next to its reason.
 * `FormSpec.contract.test.ts` pins both halves: that the derived keys really are
 * the spec's, and that each narrowing still refuses the arm it means to refuse.
 */

import type { FormSection, FormView } from '@objectstack/spec/ui';

/**
 * Wire shapes a visibility predicate arrives in: bare CEL, or `{dialect, source}`.
 *
 * NOT the spec's `ExpressionInput`, deliberately -- see the narrowing note in the
 * file header. This is the shape `@object-ui/core`'s `evalFieldPredicate` accepts
 * (`FieldRulePredicate`, `evaluator/fieldRules.ts`), which is the engine every
 * predicate here is ultimately handed to.
 */
export type VisibilityPredicate = string | { dialect?: string; source: string };

export interface FormFieldSpec {
  field: string;
  
  // 🆕 Field type from Data.FieldType (auto-infers widget)
  type?: string;
  
  // 🆕 Field config from Data.Field
  options?: Array<{ label: string; value: string; color?: string }>;
  reference?: string;
  /**
   * Sibling field name(s) whose value this field's widget reads to decide WHAT
   * to offer. Two registered widgets take it as their primary configuration:
   *
   *  - `field-selector` — `dependsOn || reference || 'objectName'` names the
   *    field holding the object name whose field catalog is offered;
   *  - `dynamic-config` — names the sibling whose value selects the sub-schema
   *    out of `WidgetContext.dynamicSchemas`.
   *
   * The runtime has always passed it through — `MetadataField` hands this very
   * object to the widget — so it was only ever missing from the AUTHORING type,
   * which made `{ widget: 'field-selector', dependsOn: 'objectName' }` a
   * `TS2353` even though it is the one configuration that makes that widget
   * work (objectui#5040). Declared here, both descriptions of this contract are
   * the same declaration.
   *
   * ⚠️ `string | string[]`, deliberately NOT `@object-ui/types`' canonical
   * `DependsOnInput` (`packages/types/src/form.ts`), which also admits
   * `{ field, param }` objects. Both readers take `[0]` of the array form and
   * use it as a field NAME to index `formData`, so an object arm would arrive
   * where a string is required: adopting the wider type would be declaring a
   * shape this surface cannot consume. Converging the two is its own decision,
   * not a free widening here.
   */
  dependsOn?: string | string[];
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  precision?: number;
  scale?: number;
  multiple?: boolean;
  
  // UI overrides
  label?: string;
  placeholder?: string;
  helpText?: string;
  readonly?: boolean;
  /**
   * When true, the field is editable on create but locked once the
   * record exists (e.g. immutable `name` machine identifiers). Combined
   * with `SchemaFormProps.createMode` at render time.
   */
  immutable?: boolean;
  required?: boolean;
  hidden?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  widget?: string;
  /** Composite rendering: 'inline' (default, bordered box) or 'popover'
   * (summary line + gear that opens the sub-fields in a popover — Airtable
   * progressive disclosure, keeps the panel lean). */
  disclosure?: 'inline' | 'popover';
  /** For `type: 'code'` — syntax highlighting language (e.g. 'javascript', 'sql', 'json'). */
  language?: string;
  /** Canonical field visibility predicate (ADR-0089). */
  visibleWhen?: VisibilityPredicate;
  /** @deprecated ADR-0089 alias of `visibleWhen`; still read for legacy layouts. */
  visibleOn?: VisibilityPredicate;
  /** Sub-fields for `composite` (single embedded object) and `repeater`
   * (array of embedded objects) types. Recursive. */
  fields?: Array<string | FormFieldSpec>;
}

/**
 * One section of a form layout, in ONE declaration (objectui#5596).
 *
 * Derived from `@objectstack/spec`'s own `FormSection`, so `name`, `collapsible`,
 * `collapsed`, `columns` and `pane` are the contract's keys with the contract's
 * types -- including the `columns` string arm, which app-shell's hand copy used
 * to refuse. Four positions are narrowed, each for a reason recorded in the file
 * header:
 *
 *   fields       the element type is {@link FormFieldSpec}, the leaf
 *                objectui#5542 converged and pinned -- NOT the spec's 29-key
 *                `FormField`.
 *   label        `string`, not the spec's `I18nLabel`. Both renderers put this
 *                straight into a text slot; neither resolves the inline
 *                locale-map arm, and `FormFieldSpec.label` is already `string`.
 *   description  same, for the same reason.
 *   visibleWhen  {@link VisibilityPredicate}, the shape the evaluators take, not
 *   visibleOn    the spec's `ExpressionInput`.
 *
 * This type describes what an AUTHOR WROTE, so it stays as wide as the document
 * -- `pane` and `name` are declared here even though no renderer in this repo
 * reads them yet. Keeping the incoming-document type wide and the honoured-row
 * type narrow is objectui#5542's distinction; the narrow types are this file's
 * `SchemaForm` sections and `FormPage`'s `RenderableSection`.
 *
 * Declaring a key is not honouring it: objectui#5627 tracks the console renderer
 * still rendering every section unconditionally, which this type makes
 * *declarable* but does not evaluate.
 */
export type FormSectionSpec =
  & Omit<FormSection, 'fields' | 'label' | 'description' | 'visibleWhen' | 'visibleOn'>
  & {
    /** Section heading. Narrowed to `string` -- see the note above. */
    label?: string;
    /** Optional description under the section header. Narrowed to `string`. */
    description?: string;
    /** Canonical section visibility predicate (ADR-0089). */
    visibleWhen?: VisibilityPredicate;
    /** @deprecated ADR-0089 alias of `visibleWhen`; still read for legacy layouts. */
    visibleOn?: VisibilityPredicate;
    /** The authored field list. Element type is the converged leaf (objectui#5542). */
    fields: Array<string | FormFieldSpec>;
  };

/**
 * A form-layout view, in ONE declaration (objectui#5596).
 *
 * Derived from `@objectstack/spec`'s own `FormView` with exactly ONE position
 * overridden -- `sections` and `groups`, whose element type is
 * {@link FormSectionSpec} rather than the spec's `FormSection`, for the same
 * reason that type overrides `fields`. Everything else is the contract's: the
 * six-member `type` union both hand copies happened to spell identically, the
 * per-variant presentation keys, `data`, `sharing`, `submitBehavior`, `subforms`,
 * `buttons`.
 *
 * `groups` is kept even though `@objectstack/spec` folds it onto `sections` at
 * parse: the fold happens in the NORMALISER, and both renderers also receive
 * documents that never pass through one (hand-written layouts, and this package's
 * own create schemas -- the same reason `visibleOn` is still read).
 *
 * ## `label` is NOT a key of this type, and that is a measurement
 *
 * `apps/console`'s hand copy declared `label`. `FormViewSchema` REJECTS it --
 * `unrecognized_keys`, measured against the installed `@objectstack/spec` 17.0.0
 * -- because the form config has `title`/`description` instead. The value that
 * read actually finds is the VIEW's identity label, which lives on the envelope
 * (`ExpandedViewItem.label`) or, on a flattened runtime overlay, alongside the
 * config on the same object (`VIEW_METADATA_MEMBERS.formOverlay` is
 * `FormViewSchema` extended with `label`/`object`/`viewKind`/...). That is view
 * identity, not form configuration, so it is declared where the console unwraps
 * the body rather than smuggled onto the form contract.
 */
export type FormViewSpec =
  & Omit<FormView, 'sections' | 'groups'>
  & {
    /** Section list. Element type is {@link FormSectionSpec} -- see above. */
    sections?: FormSectionSpec[];
    /** Legacy alias of `sections`, folded onto it by the spec's normaliser. */
    groups?: FormSectionSpec[];
  };
