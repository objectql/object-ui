/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Object-metadata keys carried onto a detail-view field so the read cell and
 * the inline editor see the SAME resolved field shape the object form does.
 *
 * A `DetailViewField` only declares presentation (name / label / span / …), so
 * everything that configures a widget lives on the object schema. `DetailSection`
 * and `HeaderHighlight` each used to hand-copy their own subset, which drifted
 * repeatedly — numeric `min`/`max`/`step` were missing (objectui#2572), and the
 * relational block below was missing entirely, so a `multiple: true` lookup
 * rendered as a SINGLE-select picker in inline edit (picking one record replaced
 * the value and closed the popover, making multi-select impossible).
 *
 * Ordering is documentation only; the copy is key-by-key.
 */
export const ENRICHED_FIELD_METADATA_KEYS = [
  // Presentation / value formatting
  'options',
  'currency',
  // The SPEC channel for a per-field currency (a bare `currency` key is
  // designer/DB-only) — resolveFieldCurrency reads it second (#2548).
  'currencyConfig',
  'precision',
  'scale',
  // Numeric range/step constraints (objectui#2572 item 3).
  'min',
  'max',
  'step',
  'format',
  // Per-field widget override (ADR-0056 P2) — a structured editor replaces the
  // raw type in inline edit too, matching the form path.
  'widget',
  'dueLike',

  // Relational / picker configuration. Every key the lookup + user pickers read
  // off their field metadata (both the ObjectStack snake_case convention and the
  // camelCase alias each reader accepts), so an inline-edit picker behaves
  // exactly like the same field on the object form: multi-value selection,
  // display/description/id fields, quick-create, the Level-2 record picker's
  // columns / page size / base filters, the search-first people picker, and
  // dependent-lookup gating.
  'multiple',
  'reference_field',
  'display_field',
  'displayField',
  'description_field',
  'descriptionField',
  'id_field',
  'allow_create',
  'allowCreate',
  'lookup_columns',
  'lookupColumns',
  'lookup_page_size',
  'lookupPageSize',
  'lookup_filters',
  'lookupFilters',
  'picker',
  'subtitle',
  'avatar_field',
  'avatarField',
  'depends_on',
  'dependsOn',
] as const;

/**
 * Merge a detail-view field with its object-schema metadata.
 *
 * The view field always wins — it is the author's explicit override; the object
 * schema only fills the keys it left undefined. Shared by `DetailSection` (the
 * details body) and `HeaderHighlight` (the highlights strip) so the two editors
 * can't drift again.
 *
 * `readonly` is deliberately NOT copied: the hosts read it straight off the
 * object metadata for their editability gate, and widgets take `readonly` as a
 * prop rather than from field metadata.
 */
export function enrichDetailField(
  viewField: Record<string, any>,
  objectDefField: Record<string, any> | undefined | null,
): Record<string, any> {
  const enriched: Record<string, any> = { ...viewField };
  if (!objectDefField) return enriched;

  if (!enriched.type && objectDefField.type) enriched.type = objectDefField.type;

  for (const key of ENRICHED_FIELD_METADATA_KEYS) {
    const value = (objectDefField as Record<string, any>)[key];
    if (value !== undefined && enriched[key] === undefined) enriched[key] = value;
  }

  // ObjectStack object metadata uses `reference` for the lookup target while the
  // objectui types call it `reference_to` — accept both, stamp the canonical key.
  const refTarget = objectDefField.reference_to || objectDefField.reference;
  if (refTarget && enriched.reference_to === undefined) enriched.reference_to = refTarget;

  return enriched;
}
