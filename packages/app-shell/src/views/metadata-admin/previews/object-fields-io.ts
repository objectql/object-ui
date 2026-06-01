// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Field-IO helpers for the form-designer canvas + inspector.
 *
 * `draft.fields` can be either an array `[{name, ...def}, …]` (the
 * legacy / objectql shape) or a record `{name: def, …}` (the spec
 * shape used in `*.object.ts`). This module reads/writes both shapes
 * transparently and preserves arbitrary unknown properties on each
 * field — the inspector only edits the keys it knows about.
 *
 * Field reorders / inserts / removes are performed on a normalized
 * ordered list and serialized back to the input shape, so round-trips
 * are non-destructive.
 */

import type { FieldTypeId } from './field-types';

export type Shape = 'array' | 'record';

export interface FieldEntry {
  /** Canonical snake_case key. */
  name: string;
  /** Raw framework field definition (label, type, options, …). */
  def: Record<string, unknown>;
}

export interface FieldsView {
  shape: Shape;
  entries: FieldEntry[];
}

/** Read draft.fields into a normalized ordered list. */
export function readFields(fieldsInput: unknown): FieldsView {
  if (Array.isArray(fieldsInput)) {
    return {
      shape: 'array',
      entries: (fieldsInput as Array<Record<string, unknown>>).map((raw, i) => {
        const { name, ...rest } = raw ?? {};
        return {
          name: typeof name === 'string' && name ? name : `field_${i + 1}`,
          def: rest as Record<string, unknown>,
        };
      }),
    };
  }
  if (fieldsInput && typeof fieldsInput === 'object') {
    return {
      shape: 'record',
      entries: Object.entries(fieldsInput as Record<string, Record<string, unknown>>).map(
        ([name, def]) => ({ name, def: { ...(def ?? {}) } }),
      ),
    };
  }
  return { shape: 'record', entries: [] };
}

/** Serialize the ordered list back to the original shape. */
export function writeFields(view: FieldsView): Record<string, unknown> | Array<Record<string, unknown>> {
  if (view.shape === 'array') {
    return view.entries.map((e) => ({ name: e.name, ...e.def }));
  }
  const out: Record<string, unknown> = {};
  for (const e of view.entries) out[e.name] = e.def;
  return out;
}

/** Find the index of a field by name. Returns -1 if not found. */
export function indexOfField(view: FieldsView, name: string): number {
  return view.entries.findIndex((e) => e.name === name);
}

/** Build a fresh field definition for the given type. */
export function newField(name: string, type: FieldTypeId, label?: string): FieldEntry {
  const def: Record<string, unknown> = { type, label: label ?? toLabel(name) };
  // Seed a single empty option so picklist editor renders a row to fill in.
  if (type === 'select' || type === 'multiselect' || type === 'radio' || type === 'checkboxes') {
    def.options = [{ value: '', label: '' }];
  }
  return { name, def };
}

/** Convert a snake_case name to a human-friendly Title Case label. */
export function toLabel(name: string): string {
  if (!name) return '';
  return name
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Normalize an arbitrary string into a valid snake_case field name. */
export function toFieldName(raw: string): string {
  const lower = raw.trim().toLowerCase();
  const sanitized = lower
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  if (!sanitized) return 'field';
  if (!/^[a-z_]/.test(sanitized)) return `f_${sanitized}`;
  return sanitized;
}

/**
 * A declared field group (a.k.a. "section"). Lives at the object's
 * top level as `draft.fieldGroups`; individual fields opt into a group
 * via `Field.group === FieldGroup.key`.
 */
export interface FieldGroup {
  key: string;
  label: string;
}

/** Read `draft.fieldGroups` into a normalized, well-typed list. */
export function readGroups(fieldGroupsInput: unknown): FieldGroup[] {
  if (!Array.isArray(fieldGroupsInput)) return [];
  return fieldGroupsInput
    .filter((g): g is { key?: unknown; label?: unknown } => !!g && typeof g === 'object')
    .map((g) => ({
      key: typeof g.key === 'string' ? g.key : '',
      label: typeof g.label === 'string' ? g.label : '',
    }))
    .filter((g) => g.key);
}

/**
 * Derive a unique snake_case group key from a human label, avoiding
 * collisions with `existing` keys. Falls back to `group` / `group_N`.
 */
export function genGroupKey(label: string, existing: string[]): string {
  // toFieldName() bottoms out at "field"; for a *group* key prefer
  // "group" when the label carries no usable alphanumerics.
  const base = /[a-z0-9]/i.test(label) ? toFieldName(label) : 'group';
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

/** Append a new group with a unique key derived from `label`. */
export function addGroup(groups: FieldGroup[], label: string): FieldGroup[] {
  const clean = label.trim() || 'New section';
  const key = genGroupKey(clean, groups.map((g) => g.key));
  return [...groups, { key, label: clean }];
}

/** Rename a group's label in place (key is stable). */
export function renameGroup(groups: FieldGroup[], key: string, label: string): FieldGroup[] {
  const clean = label.trim();
  if (!clean) return groups;
  return groups.map((g) => (g.key === key ? { ...g, label: clean } : g));
}

/** Remove a group declaration (callers should also clear members' `group`). */
export function removeGroup(groups: FieldGroup[], key: string): FieldGroup[] {
  return groups.filter((g) => g.key !== key);
}

/** Move a group one slot up (-1) or down (+1), clamped to bounds. */
export function moveGroup(groups: FieldGroup[], key: string, dir: -1 | 1): FieldGroup[] {
  const idx = groups.findIndex((g) => g.key === key);
  if (idx < 0) return groups;
  const to = idx + dir;
  if (to < 0 || to >= groups.length) return groups;
  return moveArray(groups, idx, to);
}

/** Strip `group === key` from every field (used after removing a group). */
export function clearFieldGroup(view: FieldsView, key: string): FieldsView {
  return {
    shape: view.shape,
    entries: view.entries.map((e) =>
      e.def.group === key ? { name: e.name, def: { ...e.def, group: undefined } } : e,
    ),
  };
}

/** Generic immutable array move helper (also used by group reorder). */
export function moveArray<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Group entries by their `group` property, in `fieldGroups[]` order.
 * Fields with no group (or a group not declared in fieldGroups) land
 * in a trailing "Ungrouped" bucket.
 *
 * By default empty *declared* groups are dropped to avoid chrome noise
 * (read-only / preview). Pass `includeEmptyDeclared` while editing so a
 * freshly-added, still-empty section stays visible as a drop target.
 */
export interface GroupedEntries {
  key: string | null;
  label: string;
  entries: FieldEntry[];
}

export function groupEntries(
  view: FieldsView,
  fieldGroups: Array<{ key?: string; label?: string }> | undefined,
  opts?: { includeEmptyDeclared?: boolean },
): GroupedEntries[] {
  const declared = Array.isArray(fieldGroups) ? fieldGroups.filter((g) => typeof g?.key === 'string') : [];
  const buckets = new Map<string | null, GroupedEntries>();
  for (const g of declared) {
    buckets.set(g.key!, { key: g.key!, label: String(g.label ?? g.key), entries: [] });
  }
  const declaredKeys = new Set(declared.map((g) => g.key as string));
  for (const e of view.entries) {
    const g = typeof e.def.group === 'string' ? (e.def.group as string) : null;
    if (g && declaredKeys.has(g)) {
      buckets.get(g)!.entries.push(e);
    } else {
      if (!buckets.has(null)) buckets.set(null, { key: null, label: 'Ungrouped', entries: [] });
      buckets.get(null)!.entries.push(e);
    }
  }
  const includeEmpty = !!opts?.includeEmptyDeclared;
  // Drop empty declared buckets unless asked to keep them (edit mode).
  // The implicit "Ungrouped" bucket is only created when populated, so
  // it never shows empty.
  return Array.from(buckets.values()).filter((b) => b.entries.length > 0 || (includeEmpty && b.key !== null));
}
