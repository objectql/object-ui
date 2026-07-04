// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Package-scoped slice merge for the permission matrix (ADR-0086 P0).
 *
 * A Permission Set / Profile is a single metadata record whose `objects` and
 * `fields` maps accumulate authorization rows contributed by many packages.
 * When the Access matrix is opened inside a package context it must:
 *
 *   1. show only the objects that package declares (scope), and
 *   2. on Save write back ONLY that slice — leaving every row contributed by
 *      other packages byte-for-byte intact.
 *
 * Overwriting the whole record (the pre-P0 behavior) silently drops the rows
 * other packages contributed. {@link mergePermissionSlice} rebuilds the record
 * from a freshly-read base, keeping the set-level identity and every
 * out-of-scope row, and overlaying only the in-scope rows the user edited.
 */

export interface ObjectPerm {
  allowCreate?: boolean;
  allowRead?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  allowTransfer?: boolean;
  allowRestore?: boolean;
  allowPurge?: boolean;
  viewAllRecords?: boolean;
  modifyAllRecords?: boolean;
}

export interface FieldPerm {
  readable?: boolean;
  editable?: boolean;
}

export interface PermissionSetDraft {
  name: string;
  label?: string;
  isProfile?: boolean;
  objects: Record<string, ObjectPerm>;
  fields?: Record<string, FieldPerm>;
  systemPermissions?: string[];
  tabPermissions?: Record<string, 'visible' | 'hidden' | 'default_on' | 'default_off'>;
  // Any extra keys are carried through untouched on save.
  [extra: string]: unknown;
}

/**
 * Object name embedded in a `${object}.${field}` field-permission key. Object
 * and field names are field-name-safe (snake_case, no dots), so the object is
 * everything up to the first dot.
 */
export function fieldKeyObject(key: string): string {
  const dot = key.indexOf('.');
  return dot === -1 ? key : key.slice(0, dot);
}

function asScopeSet(scope: Iterable<string>): Set<string> {
  return scope instanceof Set ? scope : new Set(scope);
}

/**
 * Narrow a permission set down to just the rows whose object is in `scope`.
 * Used to drive the matrix display so a package panel lists only its own
 * objects (and their field overrides), never the whole environment.
 */
export function scopePermissionSet(
  set: Pick<PermissionSetDraft, 'objects' | 'fields'>,
  scope: Iterable<string>,
): { objects: Record<string, ObjectPerm>; fields: Record<string, FieldPerm> } {
  const scopeSet = asScopeSet(scope);
  const objects: Record<string, ObjectPerm> = {};
  for (const [k, v] of Object.entries(set.objects ?? {})) {
    if (scopeSet.has(k)) objects[k] = v;
  }
  const fields: Record<string, FieldPerm> = {};
  for (const [k, v] of Object.entries(set.fields ?? {})) {
    if (scopeSet.has(fieldKeyObject(k))) fields[k] = v;
  }
  return { objects, fields };
}

/**
 * Merge the edited in-scope slice back onto a freshly-read full `base`.
 *
 * Out-of-scope rows (other packages' contributions) are copied verbatim from
 * `base`; in-scope rows are taken entirely from `edited` (so removing a grant
 * in the package panel deletes only that package's row). Set-level identity and
 * any extra keys (systemPermissions, tabPermissions, …) come from `base`, with
 * name / label / isProfile taking the user's edits.
 */
export function mergePermissionSlice(
  base: PermissionSetDraft,
  edited: PermissionSetDraft,
  scope: Iterable<string>,
): PermissionSetDraft {
  const scopeSet = asScopeSet(scope);

  const objects: Record<string, ObjectPerm> = {};
  for (const [k, v] of Object.entries(base.objects ?? {})) {
    if (!scopeSet.has(k)) objects[k] = v; // preserve other packages' rows
  }
  for (const [k, v] of Object.entries(edited.objects ?? {})) {
    if (scopeSet.has(k)) objects[k] = v; // write this package's slice
  }

  const fields: Record<string, FieldPerm> = {};
  for (const [k, v] of Object.entries(base.fields ?? {})) {
    if (!scopeSet.has(fieldKeyObject(k))) fields[k] = v;
  }
  for (const [k, v] of Object.entries(edited.fields ?? {})) {
    if (scopeSet.has(fieldKeyObject(k))) fields[k] = v;
  }

  return {
    ...base,
    name: edited.name,
    label: edited.label,
    isProfile: edited.isProfile,
    objects,
    fields,
  };
}
