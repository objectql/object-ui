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
 * `widgets.tsx` would close a cycle. A module that imports nothing is
 * importable from both sides. `SchemaForm.tsx` re-exports both names, so the
 * surface every existing importer reaches for is unchanged.
 */

/** Wire shapes a visibility predicate arrives in: bare CEL, or `{dialect, source}`. */
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
