/**
 * ObjectUI — the shared record-source object-name reader
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
 * const dataConfig = useMemo(() => getDataConfig(schema), [schema]);
 * const objectName = resolveRecordSourceObjectName(schema, dataConfig);
 * ```
 */
export function resolveRecordSourceObjectName(
  schema: { objectName?: string } | null | undefined,
  dataConfig: { provider?: string; object?: string } | null | undefined,
): string | undefined {
  return dataConfig?.provider === 'object' ? dataConfig.object : schema?.objectName;
}
