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
 *   - role/context gating — `'admin' in current_user.roles`.
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
import { evalFieldPredicate, type FieldRulePredicate } from './fieldRules.js';

/**
 * Minimal shape of a select/radio option this module reads. Deliberately has no
 * index signature so richer option types (`SelectOption`, `SelectOptionMetadata`)
 * remain structurally assignable — the helpers only read `value`/`visibleWhen`.
 */
export interface OptionLike {
  label: string;
  value: string;
  /** Per-option visibility predicate (CEL). Omit = always available. */
  visibleWhen?: FieldRulePredicate;
}

/** A field's `dependsOn` as authored: a bare name, or a list of names / `{field,param}`. */
export type DependsOnInput =
  | string
  | Array<string | { field: string; param?: string }>
  | undefined
  | null;

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
    o?.visibleWhen == null ? true : evalFieldPredicate(o.visibleWhen, record, true, undefined, scope),
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
