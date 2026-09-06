/**
 * ObjectUI — the shared record-source readers: the ruled three-rung ladder
 * (`resolveRecordSourceConfig`) and the object-name it resolves to
 * (`resolveRecordSourceObjectName`)
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ViewData } from '@object-ui/types';

/**
 * The object a view block is bound to, resolved ONCE for the whole renderer
 * (objectui#7627).
 *
 * ## The question this answers, and the one it does not
 *
 * There are TWO separately-ruled precedence questions about `objectName`, and
 * they only look like one question when a single reader is asked to answer
 * both:
 *
 *  1. **Which object does this block RESOLVE, at render time, when it carries
 *     more than one binding?** — the published three-rung record-source ladder
 *     (`data`, then `staticData`, then `objectName`), declared on both faces of
 *     the contract (`ObjectMapSchema.objectName` / `ObjectGanttSchema.objectName`
 *     in `@object-ui/types`, and the `.describe` on their zod twins:
 *     *"objectName — the THIRD record source `getDataConfig` resolves, after
 *     `data` and `staticData`"*), ruled objectui#6939 (2026-09-02) and pinned by
 *     `objectql-record-source-refinement-6939.test.ts`. **That is this
 *     function.**
 *  2. **How does `objectName` get POPULATED when it is absent?** — the
 *     authoring-time gap-fill in `normalizeListViewSchema` (objectui#7477,
 *     ruling B of PR #7628), where an `objectName` already on the schema WINS
 *     and the `data` block only fills a gap: *"it can never re-point a binding
 *     that already resolves."*
 *
 * The two are NOT merged and neither is re-pointed at the other. Merging them
 * would override a standing maintainer ruling in whichever direction the merged
 * reader happened to pick: at the sites below the binding that already resolves
 * IS `data.object`, so ruling B's own words argue for keeping rung 1 as it is.
 *
 * ## Why `staticData` does not appear here
 *
 * The ladder's second rung wraps inline rows as `{ provider: 'value', items }`,
 * which names no object at all. So for the object-NAME question the three-rung
 * ladder reduces to two rungs — the resolved config's object when it names one,
 * else the schema's own `objectName`, which is what a `value`/`api`-backed block
 * still needs for metadata reads, i18n field labels and permission verdicts.
 * Callers pass the ALREADY-RESOLVED config (their `getDataConfig(schema)`
 * output), so rung ordering is settled before this function is reached.
 *
 * ## No lenient rung was added (AGENTS.md #0.1)
 *
 * `ViewDataSchema`'s `object` provider is a `strictObject` carrying exactly
 * `{ provider, object }` with `object` REQUIRED, so `{ provider: 'object' }`
 * without an `object` is off-contract. This reader does not coerce that shape
 * back to `objectName`; the two call sites that used to (`ObjectGrid`'s
 * `'object' in dataConfig` test and `ObjectTree`'s header `?? schema.objectName`
 * tail) keep their own tail at the site, so the collapse changes nothing they
 * resolve today while the shared rung stays contract-strict.
 *
 * @param schema - The block's schema; only `objectName` is read.
 * @param dataConfig - The RESOLVED data config — the caller's own
 *   `getDataConfig(schema)` output, `null` when nothing is bound.
 * @returns The bound object's name, or `undefined` when neither the resolved
 *   config nor the schema names one.
 *
 * @example
 * ```ts
 * const dataConfig = useMemo(() => resolveRecordSourceConfig(schema), [schema]);
 * const objectName = resolveRecordSourceObjectName(schema, dataConfig);
 * ```
 */
export function resolveRecordSourceObjectName(
  schema: { objectName?: string } | null | undefined,
  dataConfig: { provider?: string; object?: string } | null | undefined,
): string | undefined {
  return dataConfig?.provider === 'object' ? dataConfig.object : schema?.objectName;
}

/**
 * The block's record source, resolved from the ruled three-rung ladder
 * (objectui#7632).
 *
 * ## The ruled contract this is the ONE implementation of
 *
 * `data`, then `staticData`, then `objectName` — declared on both faces of the
 * published contract and pinned by
 * `objectql-record-source-refinement-6939.test.ts`:
 *
 *  1. **`data`** — *"Data source configuration. Read FIRST by `getDataConfig`"*.
 *     Returned verbatim, so an `api`/`value`/`object` provider config reaches
 *     the caller exactly as the author wrote it.
 *  2. **`staticData`** — *"Inline records — read SECOND by `getDataConfig`,
 *     wrapped into a `{ provider: value }` config"*.
 *  3. **`objectName`** — *"the THIRD record source `getDataConfig` resolves,
 *     after `data` and `staticData`"*, folded to `{ provider: 'object' }`.
 *
 * `null` when none of the three is present — the same "nothing is drawn" signal
 * the zod `requireRecordSource` refinement is written against.
 *
 * This is the PRODUCER whose output {@link resolveRecordSourceObjectName} (the
 * objectui#7627 reader) consumes; that function's docblock describes the same
 * ladder from the consuming end. Five plugins — calendar, gantt, grid, map and
 * tree — each carried a hand-copy of this ladder with no gate holding them
 * together, which is the AGENTS.md #0.1 drift class: a change to the ruled
 * order had five edit sites and nothing noticed a missed one.
 *
 * ## No lenient rung was added (AGENTS.md #0.1)
 *
 * Two things the hand-copies did are deliberately NOT folded in here:
 *
 *  - **The bare-array `data` shorthand.** `ObjectGrid` and `ObjectMap` normalize
 *    `data: [...]` to `{ provider: 'value', items }`; calendar, gantt and tree
 *    do not, and return the array verbatim. That shorthand is off-contract —
 *    `ViewData` is a `z.discriminatedUnion('provider', [...])` over OBJECT
 *    variants, so an array under `data` cannot be published — and the two sites
 *    that accept it keep it as their own documented head, exactly as the
 *    objectui#7627 collapse left `ObjectGrid`'s and `ObjectTree`'s off-contract
 *    `{ provider: 'object' }` tails at the site. Hoisting their check is
 *    behaviour-neutral because an array is ALWAYS truthy, `[]` included, so it
 *    could never have reached rung 2 or 3.
 *  - **Null tolerance.** All five copies dereference `schema` unguarded and
 *    would throw on `null`; no site passes one, so no `?.` was added.
 *
 * `ObjectCalendar`'s copy guarded with `'data' in schema && schema.data`
 * because its parameter is the union `ObjectGridSchema | CalendarSchema` and
 * `CalendarSchema` declares neither `data` nor `staticData`. That `in` test is
 * a TYPESCRIPT narrowing device, not a behavioural one: when the property is
 * absent the read yields `undefined`, which is falsy either way, so the guard
 * can never change which rung is taken. The optional-property parameter below
 * accepts that union directly, which is why the guard is gone rather than
 * flattened away.
 *
 * @param schema - The block's schema; only `data`, `staticData` and
 *   `objectName` are read.
 * @returns The resolved data config, or `null` when nothing is bound.
 *
 * @example
 * ```ts
 * const dataConfig = useMemo(() => resolveRecordSourceConfig(schema), [schema]);
 * const objectName = resolveRecordSourceObjectName(schema, dataConfig);
 * ```
 */
export function resolveRecordSourceConfig(schema: {
  objectName?: string;
  data?: ViewData;
  staticData?: any[];
}): ViewData | null {
  if (schema.data) {
    return schema.data;
  }

  if (schema.staticData) {
    return {
      provider: 'value',
      items: schema.staticData,
    };
  }

  if (schema.objectName) {
    return {
      provider: 'object',
      object: schema.objectName,
    };
  }

  return null;
}
