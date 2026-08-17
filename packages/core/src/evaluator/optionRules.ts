/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Client-side resolution of per-option visibility for `select` / `radio` /
 * `multiselect` fields — cascading (dependent) options and role/context gating.
 *
 * An option carries an optional `visibleWhen` CEL predicate; the option is
 * offered only when it evaluates TRUE against the live record + `current_user`
 * (the SAME engine and binding environment as a field-level `visibleWhen`, via
 * {@link evalFieldPredicate}). This expresses both:
 *   - cascades — `record.country == 'cn'` (the dependent list narrows as the
 *     controlling field changes), and
 *   - role/context gating — `'admin' in current_user.positions`.
 *
 * A field declares which sibling fields its option list reacts to via
 * `dependsOn` (aligns with `@objectstack/spec` Field.dependsOn — the same knob
 * lookups use). While any dependency is empty the list is *gated*: we surface a
 * "select the parent first" hint instead of an unfiltered set, mirroring the
 * dependent-lookup UX (#2215).
 *
 * Evaluation is fail-open (a broken/absent predicate keeps the option) — the
 * same safe default as field visibility. Client-side hiding is UX, not a
 * security boundary: when an option is gated for access-control reasons the
 * server must also reject writes of its value.
 */
import type { DependsOnInput } from '@object-ui/types';
import { evalFieldPredicate, type FieldRulePredicate } from './fieldRules.js';

/**
 * Minimal shape of a select/radio option this module reads. Deliberately has no
 * index signature so richer option types (`SelectOption`, `SelectOptionMetadata`)
 * remain structurally assignable — the helpers only read `value`/`visibleWhen`.
 */
export interface OptionLike {
  label: string;
  /** Widened with `SelectOption.value` (#3090): the option engines treat the
   * value opaquely (gate/filter by `visibleWhen`, compare by identity), so a
   * numeric/boolean authored value flows through unchanged. */
  value: string | number | boolean;
  /** Per-option visibility predicate (CEL). Omit = always available. */
  visibleWhen?: FieldRulePredicate;
}

/**
 * A field's `dependsOn` as authored — imported from `@object-ui/types`, where
 * `FormField.dependsOn` is declared with it (framework#4074; formerly a local
 * declaration that only the reader knew about, while the public
 * `FormField.dependsOn` said `string`). Re-exported for this module's existing
 * consumers.
 */
export type { DependsOnInput } from '@object-ui/types';

/**
 * Normalize a field's `dependsOn` to the list of sibling field names it reacts
 * to. The lookup-only `{field,param}` form contributes just its `field`.
 */
export function resolveDependsOnFields(dependsOn: DependsOnInput): string[] {
  if (!dependsOn) return [];
  const arr = Array.isArray(dependsOn) ? dependsOn : [dependsOn];
  return arr
    .map((d) => (typeof d === 'string' ? d : d && typeof d === 'object' ? d.field : null))
    .filter((f): f is string => typeof f === 'string' && f.length > 0);
}

/** A value counts as "empty" (dependency unmet) when nullish, blank, or an empty array. */
function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * True when at least one `dependsOn` field is empty in the record — the option
 * list is gated and the widget should prompt for the parent rather than show an
 * unfiltered set. Returns false when there are no dependencies.
 */
export function isOptionGroupGated(
  dependsOn: DependsOnInput,
  record: Record<string, unknown>,
): boolean {
  const fields = resolveDependsOnFields(dependsOn);
  return fields.some((f) => isEmptyValue(record[f]));
}

/**
 * Filter options by their per-option `visibleWhen` predicate, evaluated against
 * the live `record` (+ optional `scope`, e.g. `{ current_user }`). Options with
 * no predicate are always kept; a predicate that errors fails open (kept).
 */
export function resolveVisibleOptions<T extends OptionLike>(
  options: readonly T[] | undefined | null,
  record: Record<string, unknown>,
  scope?: Record<string, unknown>,
): T[] {
  if (!options || options.length === 0) return [];
  return options.filter((o) =>
    o?.visibleWhen == null
      ? true
      : evalFieldPredicate(o.visibleWhen, record, true, undefined, scope, {
          context: `visibleWhen of option '${String(o.value)}'`,
        }),
  );
}

/**
 * Whether a scalar field value is still valid given the currently-visible
 * options — used to decide a cascade clear (parent changed, child's old choice
 * no longer offered). An empty value is always "valid" (nothing to clear).
 */
export function isValueStillOffered(
  value: unknown,
  visibleOptions: readonly OptionLike[],
): boolean {
  if (isEmptyValue(value)) return true;
  if (Array.isArray(value)) {
    // Multi-select: valid only when every selected value is still offered.
    return value.every((v) => visibleOptions.some((o) => o.value === v));
  }
  return visibleOptions.some((o) => o.value === value);
}

/** The resolved state of a cascading / role-gated option list. */
export interface CascadingOptions<T extends OptionLike> {
  /** Offered options after `visibleWhen` filtering. Empty while gated. */
  options: T[];
  /** True when a declared `dependsOn` field is empty — the list is gated. */
  gated: boolean;
  /** Normalized `dependsOn` field names (drives the "select the parent first" hint). */
  dependsOnFields: string[];
}

/**
 * Resolve an option field's offered set in one shot: normalize `dependsOn`,
 * decide whether the list is gated (a controlling field is still empty), and —
 * unless gated — filter by each option's `visibleWhen`. The single source of
 * truth behind the option widgets' `useCascadingOptions` hook and the form
 * renderer's inline pre-filter / cascade-clear, so gating and filtering can
 * never drift between them (#2715).
 *
 * `gated` is true only when there IS a `dependsOn` and one of its fields is
 * empty; a field with no `dependsOn` is never gated (its options are filtered
 * purely by `visibleWhen`). Callers format their own hint from `dependsOnFields`.
 */
export function resolveCascadingOptions<T extends OptionLike>(
  rawOptions: readonly T[] | undefined | null,
  record: Record<string, unknown>,
  dependsOn: DependsOnInput,
  scope?: Record<string, unknown>,
): CascadingOptions<T> {
  const dependsOnFields = resolveDependsOnFields(dependsOn);
  const gated = dependsOnFields.length > 0 && isOptionGroupGated(dependsOn, record);
  const options = gated ? [] : resolveVisibleOptions(rawOptions, record, scope);
  return { options, gated, dependsOnFields };
}

/**
 * Widget keys whose OFFERED option set is re-resolved against a live record by
 * {@link resolveCascadingOptions} — i.e. the allow-list of widgets a surface
 * must thread its live record to (`dependentValues`). Each of their options may
 * carry a `visibleWhen` predicate read against `record.*`, and the field may
 * declare a `dependsOn` gate (ADR-0058 / objectui#2284 / objectui#1583).
 * Without the record a cascading select never sees its controlling field and
 * stays permanently gated on the "select the parent first" hint.
 *
 * ## One definition, three surfaces (objectui#4770)
 *
 * Three surfaces feed this one evaluator, and each carried its own private copy
 * of these four keys until this constant existed — with no gate able to notice
 * them drifting apart on what "the record" means:
 *
 * - the object form — `CASCADE_OPTION_FIELD_TYPES` in
 *   `components/src/renderers/form/form.tsx` (the original);
 * - the single-record action dialog — `CASCADE_OPTION_WIDGET_TYPES` in
 *   `app-shell/src/views/ActionParamDialog.tsx` (objectui#3765 / PR #4756);
 * - the bulk action dialog — the same name in
 *   `plugin-grid/src/components/BulkActionDialog.tsx` (objectui#4757 / PR #4763).
 *
 * The set lives in `@object-ui/core`, next to the evaluator it describes,
 * because core is the one package all three already depend on — the form layer
 * cannot reach `@object-ui/fields` (that dependency runs the other way). Same
 * shape and same reason as `EXPANDABLE_FIELD_TYPES` in
 * `core/src/utils/expand-fields.ts`, the in-repo precedent for a form-layer
 * allow-table more than one surface reads. `@object-ui/fields` re-exports it
 * next to `resolveFormWidgetType` for discoverability — a re-export, never a
 * second definition.
 *
 * ## An ALLOW-LIST, not a blanket pass-through
 *
 * `dependentValues` is also the channel two widget-hint pickers read a specific
 * SIBLING KEY from (`filter-condition` reads `object_name`, `recipient-picker`
 * reads `recipient_type`), and the lookup family filters its query by it. All
 * three surfaces above agree today in NOT feeding those from action / bulk
 * dialog params, but that is a different wiring question from the one ruled
 * here and it has never been decided either way. Stated here so the three
 * copies of the statement become one — the boundary itself stays open:
 * objectui#4771.
 *
 * ## Normalization stays with the consumer
 *
 * The members are WIDGET keys — `resolveFormWidgetType` output in the two
 * dialogs, `normalizeFieldType` output (the `field:` prefix stripped) in the
 * form — not authored `type` spellings. Each consumer keeps its own
 * normalization; the two normalizations agree on these four members, which is
 * what makes one shared set safe to read from both.
 *
 * `select` + `multiple: true` is not listed separately: `SelectField` delegates
 * to `MultiSelectField` with the whole prop object, so the key it resolves
 * under (`select`) is the one that must carry the record.
 */
export const CASCADE_OPTION_WIDGET_TYPES: ReadonlySet<string> = new Set([
  'select',
  'multiselect',
  'radio',
  'checkboxes',
]);
