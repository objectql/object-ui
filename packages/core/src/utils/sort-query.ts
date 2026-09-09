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
 * ONE authored spelling reaches every object-bound block: the spec's
 * `SortConfig[]` (`[{ field, order }]`). The legacy OData-ish string clause
 * (`"name desc"`) that this function also honoured until objectui#8221 is
 * RETIRED — director ruling, decision batch #77, 2026-09-07 (objectui#8221,
 * maintainer approved), option B: "The platform has one `sort` spelling, the
 * array, everywhere."
 *
 * Why the string had to go rather than be declared alongside the array: every
 * `sort` input in the registry publishes `type: 'array'` alone, so the html
 * tier already answered `type-mismatch` for the string, and
 * `@objectstack/spec` refuses it outright on `element-record-picker`. A
 * spelling that core implements, the docs teach and the validator rejects is
 * three faces disagreeing, and the ruling settled which one wins. Declaring
 * per-block string arms instead (option A) was rejected by name: it would make
 * one key mean different things on different blocks.
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
 * strings) yields `undefined` rather than a guess. Only the ONE spelling the
 * schema types declare is honoured.
 *
 * ⚠️ A retired string is REFUSED OUT LOUD, not dropped in silence. Types are
 * erased, so the narrowed signature below cannot stop a string: authored JSON,
 * a stored `sys_metadata` row and an `as any` bag all reach this function
 * unparsed. Returning `undefined` and saying nothing would turn every one of
 * those into a row order that quietly stopped applying — the exact failure this
 * repository has measured over and over. See {@link convertSortToQueryParams}.
 */

/** A field name paired with a direction — the spec's `SortConfig`. */
export interface QuerySortEntry {
  field?: string;
  order?: 'asc' | 'desc';
}

/**
 * The canonical spelling, quoted in the refusal diagnostic so the message
 * carries the fix and not just the complaint.
 */
const ARRAY_FORM_EXAMPLE = "[{ field: 'name', order: 'desc' }]";

/**
 * Retired string clauses already reported, so one bad `sort` logs its
 * prescription ONCE instead of once per render. The message is a fix
 * instruction for an author, not a per-render event, and this sink runs inside
 * the query memo of every object-bound block — a related-list derivation over
 * an object with N lists would otherwise print N lines per pass.
 *
 * Module state, exactly as {@link resetRetiredSortSpellingReports}'s sibling
 * `resetRetiredFieldTypeReports` keeps it for retired field types: the dedupe
 * is per SPELLING, so two blocks that inherit the same bad view sort still
 * print one line between them.
 */
const reportedRetiredSpellings = new Set<string>();

/**
 * Test seam — forget which retired spellings have been reported.
 *
 * Needed because the dedupe above is module state: without it the second test
 * to assert the refusal diagnostic would observe silence and pass for the
 * wrong reason.
 */
export function resetRetiredSortSpellingReports(): void {
  reportedRetiredSpellings.clear();
}

/**
 * Name a retired string `sort` clause, once per spelling.
 *
 * `console.error`, not `warn`, and not dev-gated: this call REFUSES an authored
 * row order, so the page renders in a different order than the author asked
 * for. That is the same severity class as `reportRetiredFieldType`, which is
 * also unconditional, and the opposite of `warnOnUnknownActionKeys`, which only
 * reports keys nothing was ever going to read.
 */
function reportRetiredSortSpelling(sort: string): void {
  if (reportedRetiredSpellings.has(sort)) return;
  reportedRetiredSpellings.add(sort);
  console.error(
    `[object-ui] convertSortToQueryParams: the legacy string \`sort\` clause is retired ` +
      `(objectui#8221) and was REFUSED — received ${JSON.stringify(sort)}, so this query ` +
      `carries no \`$orderby\`. Write the array form instead: ` +
      `sort: ${ARRAY_FORM_EXAMPLE} (\`order\` is optional and means \`'asc'\`). ` +
      `The array is the only spelling every \`sort\` input declares, and the only one ` +
      `\`@objectstack/spec\` accepts.`,
  );
}

/**
 * Normalize an authored `sort` into the field→direction map used for
 * `QueryParams.$orderby`.
 *
 * @param sort `SortConfig[]` — the one declared spelling. The legacy string
 * clause (`"name desc"`) is retired (objectui#8221): a string that reaches here
 * at runtime is refused with a diagnostic naming the array form, and this
 * function returns `undefined` so the query carries no `$orderby`.
 * @returns The ordering map, or `undefined` when nothing orderable was authored.
 */
export function convertSortToQueryParams(
  sort: QuerySortEntry[] | undefined | null,
): Record<string, 'asc' | 'desc'> | undefined {
  if (!sort) return undefined;

  // Retired spelling — reachable only at runtime, since the signature above no
  // longer admits it. Read through `unknown` on purpose: the check is about the
  // VALUE that actually arrived, not about the type the caller promised.
  if (typeof (sort as unknown) === 'string') {
    reportRetiredSortSpelling(sort as unknown as string);
    return undefined;
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
