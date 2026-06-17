/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Field-group helpers for ObjectForm.
 *
 * An object's metadata can declare top-level `fieldGroups` (a.k.a. sections),
 * and individual fields opt into a group via `field.group === group.key`. The
 * object designer already lays out fields this way; these helpers let the
 * runtime form renderer honour the same grouping so authored sections show up
 * on the actual record form — not just in the designer preview.
 *
 * The grouping semantics mirror the designer's `groupEntries`: sections render
 * in declared order, and any field without a (declared) group lands in a
 * trailing untitled bucket.
 */

import type { FormField, ObjectFormSection } from '@object-ui/types';

/** A declared field group on the object metadata. */
export interface DeclaredFieldGroup {
  key: string;
  label?: string;
  /** Render the group's section header with a collapse toggle. */
  collapsible?: boolean;
  /** Start the (collapsible) group collapsed. */
  collapsed?: boolean;
}

/** Read an object's `fieldGroups` into a normalized, well-typed list. */
export function readObjectFieldGroups(input: unknown): DeclaredFieldGroup[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map((g) => ({
      key: typeof g.key === 'string' ? (g.key as string) : '',
      label: typeof g.label === 'string' ? (g.label as string) : undefined,
      collapsible: typeof g.collapsible === 'boolean' ? (g.collapsible as boolean) : undefined,
      collapsed: typeof g.collapsed === 'boolean' ? (g.collapsed as boolean) : undefined,
    }))
    .filter((g) => g.key);
}

/**
 * Derive form sections from an object's declared `fieldGroups` and each
 * rendered field's `group`.
 *
 * Returns `null` when grouping does not apply — no declared groups, or no
 * rendered field opts into a declared group — so callers fall back to a flat
 * form. Sections come back in declared order; fields without a declared group
 * collect into a trailing untitled section (no `name`/`label`) so they render
 * as a plain block rather than a card.
 *
 * Section `fields` are returned as field *names* (strings) so the result plugs
 * straight into ObjectForm's existing section-render path, which resolves names
 * back to generated `FormField`s and applies field-level permissions.
 */
export function deriveFieldGroupSections(
  fields: FormField[],
  fieldGroups: unknown,
): ObjectFormSection[] | null {
  const declared = readObjectFieldGroups(fieldGroups);
  if (declared.length === 0) return null;

  const declaredKeys = new Set(declared.map((g) => g.key));
  const groupOf = (f: FormField): string | null => {
    const g = (f as { group?: unknown }).group;
    return typeof g === 'string' && declaredKeys.has(g) ? g : null;
  };

  // No field references a declared group → keep the flat layout.
  if (!fields.some((f) => groupOf(f) !== null)) return null;

  const buckets = new Map<string, FormField[]>();
  for (const g of declared) buckets.set(g.key, []);
  const ungrouped: FormField[] = [];
  for (const f of fields) {
    const g = groupOf(f);
    if (g) buckets.get(g)!.push(f);
    else ungrouped.push(f);
  }

  const sections: ObjectFormSection[] = [];
  for (const g of declared) {
    const items = buckets.get(g.key)!;
    if (items.length === 0) continue;
    sections.push({
      name: g.key,
      label: g.label ?? g.key,
      fields: items.map((f) => f.name),
      ...(g.collapsible !== undefined ? { collapsible: g.collapsible } : {}),
      ...(g.collapsed !== undefined ? { collapsed: g.collapsed } : {}),
    });
  }
  // Trailing untitled bucket for ungrouped fields. Omitting `name`/`label`
  // makes the section render flat (no card chrome) instead of surfacing an
  // internal key as a header.
  if (ungrouped.length > 0) {
    sections.push({ fields: ungrouped.map((f) => f.name) });
  }

  return sections;
}
