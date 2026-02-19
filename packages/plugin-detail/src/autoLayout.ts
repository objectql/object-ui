/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Auto-Layout for DetailView
 *
 * Provides intelligent, zero-configuration default layout for detail sections.
 * When the user has not explicitly set columns on a section, this module
 * infers optimal column count based on the number of fields.
 *
 * Priority: User configuration > Auto-layout inference
 *
 * Column rules for detail views (wider thresholds than forms):
 * - 0-3 fields  → 1 column
 * - 4-10 fields → 2 columns
 * - 11+ fields  → 3 columns
 */

import type { DetailViewField } from '@object-ui/types';

/** Field types that should span full width in multi-column layouts */
const WIDE_FIELD_TYPES = new Set([
  'textarea',
  'markdown',
  'html',
  'grid',
  'rich-text',
  'field:textarea',
  'field:markdown',
  'field:html',
  'field:grid',
  'field:rich-text',
]);

/**
 * Check if a field type is "wide" (should span full row in multi-column layout).
 */
export function isWideFieldType(type: string): boolean {
  return WIDE_FIELD_TYPES.has(type);
}

/**
 * Infer optimal number of columns for a detail section based on field count.
 *
 * Rules:
 * - 0-3 fields  → 1 column
 * - 4-10 fields → 2 columns
 * - 11+ fields  → 3 columns
 */
export function inferDetailColumns(fieldCount: number): number {
  if (fieldCount <= 3) return 1;
  if (fieldCount <= 10) return 2;
  return 3;
}

/**
 * Apply auto span to wide fields so they span the full row.
 * Only sets span if the field does not already have one explicitly set.
 *
 * @returns A new array of fields with span applied where needed.
 */
export function applyAutoSpan(
  fields: DetailViewField[],
  columns: number
): DetailViewField[] {
  if (columns <= 1) return fields;

  return fields.map((field) => {
    // User-defined span takes priority
    if (field.span !== undefined) return field;

    // Wide field types should span full row
    if (field.type && isWideFieldType(field.type)) {
      return { ...field, span: columns };
    }

    return field;
  });
}

/**
 * Main auto-layout orchestrator for detail sections.
 * Applies intelligent defaults only when the user has not explicitly configured columns.
 *
 * @param fields - The section fields
 * @param schemaColumns - User-provided columns (from DetailViewSection or DetailViewSchema)
 * @returns Object with processed fields and inferred columns
 */
export function applyDetailAutoLayout(
  fields: DetailViewField[],
  schemaColumns: number | undefined
): { fields: DetailViewField[]; columns: number } {
  // If user explicitly set columns, respect it but still apply auto span
  if (schemaColumns !== undefined) {
    const processed = applyAutoSpan(fields, schemaColumns);
    return { fields: processed, columns: schemaColumns };
  }

  // Infer columns from field count
  const columns = inferDetailColumns(fields.length);

  // Apply auto span for wide fields
  const processed = applyAutoSpan(fields, columns);

  return { fields: processed, columns };
}
