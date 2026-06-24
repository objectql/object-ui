/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Render a (possibly nested) validation issue path into a human-readable trail
 * that names the offending element. A Zod issue on a dashboard widget arrives as
 * a dot-joined path like `widgets.2.layout`; shown as just its head field
 * ("Widgets") the author can't tell WHICH widget or sub-field is at fault. This
 * turns it into "Widgets → priority_split → layout" by resolving each array
 * index to the item's stable identity (id/name/title) from the draft value.
 *
 * @param headLabel resolved human label for the first segment (caller knows the
 *                  form/schema labels).
 * @param path      dot-joined issue path (e.g. `widgets.2.layout`).
 * @param rootValue the draft object the path indexes into (used to resolve an
 *                  array index to the item's identity).
 */
export function describeIssuePath(headLabel: string, path: string, rootValue: unknown): string {
  const segments = path.split('.');
  if (segments.length <= 1) return headLabel;

  const parts: string[] = [headLabel];
  let cursor: unknown = asRecord(rootValue)?.[segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (/^\d+$/.test(seg)) {
      const idx = Number(seg);
      const item = Array.isArray(cursor) ? cursor[idx] : undefined;
      // 1-based index reads naturally for non-developers ("#1" not "#0").
      parts.push(itemIdentity(item) ?? `#${idx + 1}`);
      cursor = item;
    } else {
      parts.push(seg);
      cursor = asRecord(cursor)?.[seg];
    }
  }
  return parts.join(' → ');
}

/** Best-effort stable identity of an array item, resolving an I18nLabel object
 *  ({ key, defaultValue }) to its string. Returns undefined when none usable. */
function itemIdentity(item: unknown): string | undefined {
  const o = asRecord(item);
  if (!o) return undefined;
  for (const k of ['id', 'name', 'key', 'title', 'label']) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v;
    const nested = asRecord(v);
    if (nested) {
      const s = nested.defaultValue ?? nested.key;
      if (typeof s === 'string' && s.trim()) return s;
    }
  }
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}
