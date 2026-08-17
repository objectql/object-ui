/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * sort-query — lower a block's authored `sort` to the `$orderby` value a
 * `DataSource.find` query carries.
 *
 * Two authored spellings reach every object-bound block, because both are
 * declared: the legacy OData-ish string (`ObjectGridSchema.sort: "name desc"`)
 * and the spec's `SortConfig[]` (`[{ field, order }]`). A read site that hands
 * either straight to `$orderby` works only because `QueryParams.$orderby`
 * accepts four shapes; normalizing here means one shape reaches the wire and a
 * block does not have to know which spelling its author used.
 *
 * This is now the ONLY definition in the repo. It was hoisted here because
 * objectstack#7137 added two more read sites (`object-timeline`,
 * `record:line_items`) next to three sibling blocks that each inlined a
 * byte-identical private copy (`ObjectGantt` / `ObjectMap` / `ObjectCalendar`),
 * and a fifth and sixth copy is how the conversions start disagreeing. Those
 * three copies were deliberately left alone by #7137 and collapsed onto this
 * function by objectui#4022; every block now imports it from here.
 *
 * Two deliberate differences from those retired private copies, both of which
 * make this function more faithful to the declared contract rather than adding
 * tolerance — and both are BEHAVIOUR CHANGES the migration delivered, not pure
 * refactor:
 *
 *  - **`order` is optional in `SortConfig`**, so an entry that omits it means
 *    ascending (that is what `$orderby`'s own
 *    `Array<{ field: string; order?: 'asc' | 'desc' }>` shape says). The private
 *    copies required BOTH keys and silently dropped such an entry, which lost an
 *    authored sort key instead of ordering by it.
 *  - **Nothing usable yields `undefined`, never `{}`.** An empty object is a
 *    truthy value that means "no ordering" only by accident of the adapter's
 *    serializer; `undefined` says it, so the query simply carries no `$orderby`.
 *
 * Not a lenient alias: an unusable input (a number, an object, an array of
 * strings) yields `undefined` rather than a guess. Only the two spellings the
 * schema types declare are honoured.
 */

/** A field name paired with a direction — the spec's `SortConfig`. */
export interface QuerySortEntry {
  field?: string;
  order?: 'asc' | 'desc';
}

/**
 * Normalize an authored `sort` into the field→direction map used for
 * `QueryParams.$orderby`.
 *
 * @param sort `"name desc"` (legacy string) or `SortConfig[]`.
 * @returns The ordering map, or `undefined` when nothing orderable was authored.
 */
export function convertSortToQueryParams(
  sort: string | QuerySortEntry[] | undefined | null,
): Record<string, 'asc' | 'desc'> | undefined {
  if (!sort) return undefined;

  // Legacy string clause: "name desc" / "name" (a bare field means ascending).
  if (typeof sort === 'string') {
    const [field, direction] = sort.trim().split(/\s+/);
    if (!field) return undefined;
    return { [field]: direction?.toLowerCase() === 'desc' ? 'desc' : 'asc' };
  }

  if (Array.isArray(sort)) {
    const out: Record<string, 'asc' | 'desc'> = {};
    for (const entry of sort) {
      if (!entry || typeof entry.field !== 'string' || entry.field === '') continue;
      out[entry.field] = entry.order === 'desc' ? 'desc' : 'asc';
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }

  return undefined;
}
