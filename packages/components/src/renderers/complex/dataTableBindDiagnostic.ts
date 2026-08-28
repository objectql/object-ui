/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The diagnostic that says out loud what `data-table` has always done silently
 * with an authored `bind` — nothing (objectui#6575, maintainer ruling
 * 2026-08-27, option A: 「同意」).
 *
 * ## The defect this names
 *
 * `bind` is the data-scope binding vocabulary: a path string resolved by
 * `useDataScope()`. `list`, `tree-view` and the `object-*` plugin widgets read
 * it. `DataTableRenderer` does NOT — it takes its rows from `data: rawData =
 * EMPTY_ROWS` off the node, and the file calls no such hook.
 *
 * A `bind` on a `data-table` is nevertheless accepted by every gate: the TS
 * side by `BaseSchema`'s `[key: string]: any`, the zod side by `BaseSchema`
 * being `.passthrough()` (which `DataTableSchema.extend(…)` inherits). So the
 * author gets a table drawing a correct-looking header over the "No results
 * found" empty state, with no error, no warning and no diagnostic — the
 * hardest failure shape for a human OR an AI author to self-check, because a
 * rendered header reads as a success receipt.
 *
 * The platform was already paying a teaching cost for it rather than a
 * diagnostic cost: `skills/objectui/rules/protocol.md` documents the pothole
 * verbatim, and `skill-guide-data-table-binding.test.tsx` pins the behaviour.
 * This module moves the warning from the docs to the console, where the author
 * who did not read the docs is standing.
 *
 * ## What it deliberately does NOT do
 *
 * It changes NO behaviour. `data-table` still does not read `bind`, and the
 * ruling is explicit that it must not start: making it a `useDataScope` reader
 * (option B) is a separate published-surface question needing its own ruling,
 * including a `data`-vs-`bind` precedence. Refusing the key at parse (option C)
 * stays blocked on the `.passthrough()` ceiling (objectui#5155 / objectui#6269).
 * So the trap stops being silent; it does not stop being a trap.
 *
 * ## Why a console warning, and only a console warning
 *
 * The same channel `plugin-grid`'s `columnSpellingDiagnostics.ts` uses for the
 * identical shape of failure ("you declared something and the renderer dropped
 * it"): a pure `describe…` function returning `string | null`, called from a
 * `useEffect` keyed on the schema slice, one `console.warn`, no NODE_ENV
 * branch. Deliberately the SAME shape rather than a second, differently-shaped
 * one next to it. Rendering an in-table message instead would be user-facing
 * copy needing all ten locale packs in `@object-ui/i18n`; a throw would take
 * the surrounding page down for a defect that costs one table.
 *
 * The rate limit is the `useEffect` key, and that is enough HERE for a reason
 * `visibilityDiagnostic.ts` does not have available: a node gate is evaluated
 * once per row, so it needs a module-level dedupe `Set` to keep one authoring
 * bug from printing N lines. A `data-table` is one node rendered once — the
 * effect key is one line per mount per distinct `bind`, which is already the
 * "one line per distinct authoring bug" ceiling that `Set` exists to buy.
 *
 * ## The message never asserts something it did not check
 *
 * A node can carry BOTH an inline `data` array and a `bind`. That table is not
 * empty, so the "header over an empty body" consequence would be false there —
 * and a diagnostic that overstates its own consequence teaches authors to
 * distrust it. The two cases get two different consequence clauses, decided by
 * looking at the rows the renderer actually resolved.
 */

/** Prefix for every line this module emits — the handle tests and greps hold. */
export const DATA_TABLE_BIND_DIAGNOSTIC_PREFIX = '[ObjectUI] DataTable bind:';

/** The key `data-table` really reads its rows from. */
export const DECLARED_ROWS_KEY = 'data';

/** Where the offending node lives, for the first line of the message. */
export interface DataTableBindAddress {
  /** The schema node's `type` — `data-table`, or an alias that routes here. */
  blockType?: unknown;
  /** The node's `id`, when it has one. */
  id?: unknown;
  /** The table's authored caption — often the only human-readable name. */
  caption?: unknown;
}

function quote(value: unknown): string {
  return typeof value === 'string' ? `'${value}'` : String(value);
}

function describeAddress({ blockType, id, caption }: DataTableBindAddress): string {
  const block = typeof blockType === 'string' && blockType.length > 0 ? blockType : 'data-table';
  const parts: string[] = [];
  if (typeof id === 'string' && id.length > 0) parts.push(`id: '${id}'`);
  if (typeof caption === 'string' && caption.length > 0) parts.push(`caption: '${caption}'`);
  return parts.length > 0 ? `${block} (${parts.join(', ')})` : block;
}

/**
 * Was a `bind` authored on this node?
 *
 * `undefined` is absence — a destructuring default or an omitted key. Every
 * other value, including `null` and the empty string, is something the author
 * WROTE, and writing it bought nothing. Exported so the renderer's effect key
 * and this judgement cannot drift apart: one predicate, two readers.
 */
export function hasAuthoredBind(bind: unknown): boolean {
  return bind !== undefined;
}

/**
 * The message for a `data-table` node carrying a `bind`, or `null` when there
 * is nothing to say.
 *
 * `rows` is what the renderer resolved for the body — passed in rather than
 * re-derived, so the consequence sentence is measured against the same array
 * the reader is looking at.
 *
 * Naming the ADDRESS is the point: which node, which path it spells, what the
 * renderer did instead, and what to write to get the rows on screen. A message
 * that only said something went wrong would leave the author where the silence
 * did.
 */
export function describeIgnoredBind(
  bind: unknown,
  rows: unknown,
  address: DataTableBindAddress,
): string | null {
  if (!hasAuthoredBind(bind)) return null;

  const rowCount = Array.isArray(rows) ? rows.length : 0;
  const consequence =
    rowCount === 0
      ? 'This node has no inline rows, so the table renders its header over an empty body'
      : `The ${rowCount} ${rowCount === 1 ? 'row' : 'rows'} on screen `
        + `${rowCount === 1 ? 'comes' : 'come'} from \`${DECLARED_ROWS_KEY}\`; `
        + 'the `bind` contributes nothing';

  return `${DATA_TABLE_BIND_DIAGNOSTIC_PREFIX} ${describeAddress(address)} — `
    + `\`bind: ${quote(bind)}\` is ignored: data-table does not read \`bind\`; it reads its rows `
    + `from the inline \`${DECLARED_ROWS_KEY}\` array on the node. ${consequence}.\n`
    + `  Put the rows in \`${DECLARED_ROWS_KEY}\`, or author a component that does read \`bind\` `
    + '(`list`, `tree-view`, or an `object-*` widget — they call `useDataScope`). (objectui#6575)';
}
