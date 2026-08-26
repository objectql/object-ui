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
 *
 * The one exception to "preserve unknown properties" is
 * {@link RETIRED_FIELD_KEYS} — see the note on that constant.
 */

import type { FieldTypeId } from './field-types.js';

export type Shape = 'array' | 'record';

/**
 * Field keys the ObjectStack spec REJECTS by name, stripped on read.
 *
 * Measured against the installed `@objectstack/spec` 17.2.0, each one on an
 * otherwise-green field (`{ type: 'text', label: 'L' }`), and through the whole
 * object document `PUT /api/v1/meta/object/:name` validates:
 *
 *   indexed      => unrecognized_keys  "never a FieldSchema key; a field-level
 *                   index flag built no index (#2377). Declare the index in the
 *                   object's `indexes[]`."                       (objectui#4644)
 *   referenceTo  => unrecognized_keys  "Did you mean `referenceTo` ->
 *                   `reference`?"                                (objectui#6041)
 *   isSystem     => unrecognized_keys  "Did you mean `isSystem` -> `system`?"
 *                                                                (objectui#6044)
 *
 * `ObjectSchema.safeParse` reports them at `["fields", <name>]`, which is the
 * hard 422 (`INVALID_METADATA`) that blocks EVERY subsequent save of the object
 * until the author finds and clears the key — and the controls that wrote them
 * are retired, so there is no UI path left to clear it.
 *
 * Every key here is one a SHIPPED build wrote, so a stored object can still
 * carry it inside a field. That premise was verified per key rather than
 * assumed (objectui#6519):
 *
 *   - `indexed` — the field inspector's `Indexed` checkbox wrote it until
 *     objectui#4644, measured blocking saves on console 17.0.0 GA.
 *   - `referenceTo` — emitted by BOTH designer writers until objectui#6041:
 *     `MetadataService.toFieldPayload` (`referenceTo: field.referenceTo`) and
 *     `MetadataFieldsPage.fromDesignerField` (`referenceTo: designed.referenceTo`).
 *   - `isSystem` — declared on `MetadataFieldsPage`'s `ServerFieldSchema` and
 *     read back (`isSystem: raw.isSystem`) until objectui#6044, i.e. served
 *     field entries were expected to carry it; it left again through a verbatim
 *     carry-over spread rather than any named emit site.
 *
 * Neither key loses anything on the way out: where the spec has a spelling for
 * the concept it is a SEPARATE key that is NOT stripped — `reference` and
 * `system` are real `FieldSchema` keys and ride through untouched, which is
 * what lets the designer read them back.
 *
 * ── Two keys the spec also refuses and this door deliberately does NOT strip ──
 * Read both before adding a fourth entry; each was measured, and they fail the
 * strip for DIFFERENT reasons.
 *
 * `formula` (objectui#6043) — the premise holds and the strip still does not.
 * The Field Designer's textarea wrote it, so stored objects carry it; but
 * `ObjectFieldInspector` is this platform's sanctioned migration surface for
 * exactly that key. The legacy value seeds its CEL editor
 * (`readPredicate(def.expression ?? def.formula)`) and the first edit commits
 * the spec key and clears the alias (`patchDef({ expression: …, formula:
 * undefined })`). Stripping here empties that editor: measured on
 * objectui#6519, adding `formula` to this list turns
 * `ObjectFieldInspector.test.tsx`'s pin *commits edits to `expression` and
 * migrates the legacy `formula` key* RED (`Tests 1 failed | 42 passed`) with the
 * editor rendering `""` instead of the authored source — after which the next
 * save drops the text for good. objectui#6043 refused the blind rename in
 * `plugin-designer` PRECISELY because this linting editor exists to migrate the
 * value properly; a strip here would discard what that ruling preserved. So a
 * `formula` draft stays blocked at the server until the author edits the
 * formula, which is a worse-than-nothing trade only a maintainer should make —
 * it is raised on objectui#6519, not taken here.
 *
 * `sortOrder` (objectui#6045) — the premise itself fails. `FieldSchema` refuses
 * it by name too, and `MetadataService`'s `carryOver` does list it, but no
 * writer on this tree ever populated a FIELD-level `sortOrder`: it was declared
 * on the UI model and on the wire shape and left undefined, so `toFieldPayload`
 * emitted `sortOrder: undefined` and `JSON.stringify` dropped it. objectui#6045
 * removed it as objectui#4687's shape (a declaration with zero readers and zero
 * writers), not objectui#6041's rename. No shipped build stored one, so no
 * draft this door reads can carry one, and stripping it would be dead code that
 * reads like a measurement. (The object-level `sortOrder` on `ObjectDefinition`
 * and the saved-view `sortOrder` in `ObjectView` are different concepts living
 * outside `fields` entirely, so neither passes through this door.) Evidence of a
 * stored field-level `sortOrder` would change this — add it then, not defensively.
 *
 * Stripping on load — not a data migration — is what makes an edit-and-save
 * round-trip of such a draft come out parseable. `readFields` is the single
 * read door for `draft.fields` across the whole object designer (inspector,
 * form designer, design surface, settings / validations / API panels), and
 * `writeFields` writes each def back verbatim, so one strip here covers every
 * writer.
 *
 * Same shape as `PermissionAdvancedFacets`' `RETIRED_RLS_KEYS`
 * (objectstack#7130). Keyed to the tombstones, never a blanket unknown-key
 * purge: every other key the designer does not render still survives.
 *
 * ⚠ This is one of THREE retired-key lists on this seam, each scoped to its own
 * writer's history (`MetadataFieldsPage`'s `carryOver` carries four,
 * `MetadataService`'s carries five). They are NOT nested, and the two paragraphs
 * above are why: this door reads drafts a live editor also migrates, which the
 * two write-side lists do not. Unifying them spans
 * `plugin-designer/src/MetadataFieldsPage.tsx`, which objectui#6489 owns in
 * flight, so objectui#6519 scoped itself to this file and left unification to a
 * follow-up rather than collide on that file.
 */
export const RETIRED_FIELD_KEYS = ['indexed', 'referenceTo', 'isSystem'] as const;

/** Drop {@link RETIRED_FIELD_KEYS} from one field definition. */
function stripRetiredFieldKeys(def: Record<string, unknown>): Record<string, unknown> {
  const present = RETIRED_FIELD_KEYS.filter((k) => k in def);
  if (present.length === 0) return def;
  const next = { ...def };
  for (const k of present) delete next[k];
  return next;
}

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
          def: stripRetiredFieldKeys(rest as Record<string, unknown>),
        };
      }),
    };
  }
  if (fieldsInput && typeof fieldsInput === 'object') {
    return {
      shape: 'record',
      entries: Object.entries(fieldsInput as Record<string, Record<string, unknown>>).map(
        ([name, def]) => ({ name, def: stripRetiredFieldKeys({ ...(def ?? {}) }) }),
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
  // Picklist-style fields start with no options; the OptionsEditor shows a
  // blank input row locally and only persists rows once they have a value, so
  // an unfilled row never trips the spec's identifier validation.
  if (type === 'select' || type === 'multiselect' || type === 'radio' || type === 'checkboxes') {
    def.options = [];
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
 * Prefix-stable variant of {@link toFieldName} for *live keystroke* input.
 *
 * The strict `toFieldName` trims a trailing `_`, which makes it impossible
 * to TYPE a multi-word identifier into a controlled input: the field's
 * `onChange` re-normalizes on every keystroke, so the instant the user
 * presses `_` the value is `"repair_"` -> trimmed to `"repair"` -> the
 * underscore vanishes before the next letter arrives, yielding
 * `"repairticket"` instead of `"repair_ticket"`. (Authors of non-Latin
 * locales hit this hardest: their label cannot derive a Latin slug, so
 * they MUST type the identifier by hand.)
 *
 * This variant keeps a single trailing `_` so typing can continue, and
 * returns `''` (not the `'field'` placeholder) on empty input so clearing
 * the box actually clears it. A trailing `_` is itself a valid identifier
 * per the spec ("starts with a letter, may contain letters/digits/`_`"),
 * so no separate commit-time trim is required for correctness; callers
 * that need a canonical form for a *complete* string (label->name
 * derivation, group keys) should keep using strict `toFieldName`.
 */
export function toFieldNameLoose(raw: string): string {
  const sanitized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+/g, '') // trim leading only -- a trailing `_` must survive
    .replace(/_{2,}/g, '_');
  if (!sanitized) return '';
  if (!/^[a-z_]/.test(sanitized)) return `f_${sanitized}`;
  return sanitized;
}

/**
 * A declared field group (a.k.a. "section"). Lives at the object's top level as
 * `draft.fieldGroups`; individual fields opt into a group via
 * `Field.group === ObjectFieldGroup.key`.
 *
 * Named `ObjectFieldGroup`, which is the spec's own name for this shape
 * (`@objectstack/spec/data`, the `ObjectFieldGroupSchema` family), and
 * re-exported from there rather than re-declared.
 *
 * It used to be called `FieldGroup` — and `@objectstack/spec/studio` exports a
 * DIFFERENT `FieldGroup`: the Studio field-editor's own group config
 * (`{ key, label, icon?, defaultExpanded, order }`), which has no `collapse`
 * and adds `order`. The local doc comment nonetheless claimed `description` and
 * `collapse` were "spec-defined" — true of `ObjectFieldGroup`, false of the
 * `FieldGroup` the name actually resolved to. That is objectstack#4115's
 * planted-premise failure exactly: a correct sentence filed under a name that
 * points somewhere else. Key-for-key this is `ObjectFieldGroup`, so the fix is
 * to say so.
 *
 * Collapse semantics (unchanged, now single-sourced): `'none'` → not
 * collapsible; `'expanded'` → collapsible, open by default; `'collapsed'` →
 * collapsible, closed by default; `collapsible` / `collapsed` /
 * `defaultExpanded` are the legacy boolean aliases the shared
 * `deriveFieldGroupLayout` still normalizes.
 *
 * Derived from `z.input`, NOT the exported `ObjectFieldGroup` type (which is
 * `z.infer`, i.e. the OUTPUT side). The distinction is load-bearing here and is
 * the zod-specific trap the derivation guard's header warns about: `collapse`
 * carries `.default('none')`, so it is OPTIONAL to author and REQUIRED after
 * parsing. This designer is on the authoring side — `addGroup` creates
 * `{ key, label }` and lets the default apply — so the output type would make
 * the editor's own new-group shape unrepresentable. Using `z.infer` here
 * type-checks against a value nobody in this module ever holds.
 */
export type ObjectFieldGroup = z.input<typeof ObjectFieldGroupSchema>;

import type { z } from 'zod';
import type { ObjectFieldGroupSchema } from '@objectstack/spec/data';

/**
 * Read `draft.fieldGroups` into a normalized, well-typed list. Unknown/extra
 * authored props (icon, description, collapse, …) are PRESERVED so a
 * read-modify-write round-trip (rename/reorder/inspector edit) never silently
 * drops a property the source set — only `key`/`label` are coerced to strings.
 */
export function readGroups(fieldGroupsInput: unknown): ObjectFieldGroup[] {
  if (!Array.isArray(fieldGroupsInput)) return [];
  return fieldGroupsInput
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map((g) => ({
      ...g,
      key: typeof g.key === 'string' ? g.key : '',
      label: typeof g.label === 'string' ? g.label : '',
    }) as ObjectFieldGroup)
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
export function addGroup(groups: ObjectFieldGroup[], label: string): ObjectFieldGroup[] {
  const clean = label.trim() || 'New section';
  const key = genGroupKey(clean, groups.map((g) => g.key));
  return [...groups, { key, label: clean }];
}

/** Rename a group's label in place (key is stable). */
export function renameGroup(groups: ObjectFieldGroup[], key: string, label: string): ObjectFieldGroup[] {
  const clean = label.trim();
  if (!clean) return groups;
  return groups.map((g) => (g.key === key ? { ...g, label: clean } : g));
}

/**
 * Merge a partial patch onto one group (by key). A patch value of `undefined`
 * REMOVES that property (so e.g. resetting collapse to its `'none'` default
 * leaves no stale key behind) rather than persisting an explicit `undefined`.
 */
export function updateGroup(
  groups: ObjectFieldGroup[],
  key: string,
  patch: Partial<ObjectFieldGroup>,
): ObjectFieldGroup[] {
  return groups.map((g) => {
    if (g.key !== key) return g;
    const next = { ...g } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k];
      else next[k] = v;
    }
    return next as unknown as ObjectFieldGroup;
  });
}

/** Remove a group declaration (callers should also clear members' `group`). */
export function removeGroup(groups: ObjectFieldGroup[], key: string): ObjectFieldGroup[] {
  return groups.filter((g) => g.key !== key);
}

/** Move a group one slot up (-1) or down (+1), clamped to bounds. */
export function moveGroup(groups: ObjectFieldGroup[], key: string, dir: -1 | 1): ObjectFieldGroup[] {
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

/* ─────────────── Review diff (current draft vs a baseline) ─────────────── */

export type FieldDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface FieldDiffEntry {
  name: string;
  status: FieldDiffStatus;
  /** Sorted def keys that differ (only for `changed`). */
  changedKeys: string[];
}

export interface FieldsDiff {
  /** Per current-field status, keyed by field name. */
  byName: Record<string, FieldDiffEntry>;
  /** Baseline fields absent from the current draft (rendered as ghosts). */
  removed: FieldEntry[];
  counts: { added: number; changed: number; removed: number };
}

/** Stable equality for field-def values (small JSON — order-sensitive is fine). */
function valueEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Def keys whose values differ between two field definitions, sorted. */
function changedDefKeys(a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) if (!valueEqual(a[k], b[k])) out.push(k);
  return out.sort();
}

/**
 * Diff the current `fields` against a `baseline` (e.g. the last published
 * version). Drives the canvas review mode: added / changed / removed
 * per field. Shape-agnostic — both inputs are read via {@link readFields}.
 */
export function diffFields(baselineInput: unknown, currentInput: unknown): FieldsDiff {
  const base = readFields(baselineInput);
  const cur = readFields(currentInput);
  const baseByName = new Map(base.entries.map((e) => [e.name, e] as const));
  const curNames = new Set(cur.entries.map((e) => e.name));

  const byName: Record<string, FieldDiffEntry> = {};
  let added = 0;
  let changed = 0;
  for (const e of cur.entries) {
    const b = baseByName.get(e.name);
    if (!b) {
      byName[e.name] = { name: e.name, status: 'added', changedKeys: [] };
      added += 1;
      continue;
    }
    const keys = changedDefKeys(b.def, e.def);
    if (keys.length) {
      byName[e.name] = { name: e.name, status: 'changed', changedKeys: keys };
      changed += 1;
    } else {
      byName[e.name] = { name: e.name, status: 'unchanged', changedKeys: [] };
    }
  }

  const removed = base.entries.filter((e) => !curNames.has(e.name));
  return { byName, removed, counts: { added, changed, removed: removed.length } };
}
