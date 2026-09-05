/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - ADR-0049 retirement tombstone helper, and its two
 * named-refusal siblings (handler keys, alias spellings)
 *
 * @module zod/tombstone
 * @packageDocumentation
 */

import { z } from 'zod';

/**
 * Declare an ADR-0049 RETIREMENT TOMBSTONE: a key that stays declared but is
 * unwritable, so an authored value is REFUSED loudly instead of being silently
 * stripped the way an undeclared key would be (the convention `crud.zod.ts`
 * `confirm` established; objectui#5474's ruling records loud refusal as the
 * intended outcome).
 *
 * `guidance` is written ONCE and carried into BOTH author-facing channels:
 *
 *   1. `.describe()` — schema METADATA, which feeds generated JSON-Schema and
 *      the docs surface. This is where the text already lived.
 *   2. `z.never({ error })` — the parse-time ISSUE MESSAGE, which is what an
 *      author who trips the tombstone actually reads. Without it zod emits its
 *      own generic `"Invalid input: expected never, received string"`, which
 *      names WHICH key is wrong (via the issue path) but says nothing about why
 *      it was retired or what to write instead — so half of the loud refusal's
 *      payload was being dropped (objectui#6105). `DashboardConfigSchema.aria`
 *      (`complex.zod.ts`, objectui#5852) landed the spelling by hand first;
 *      this is that spelling as one shared mechanism.
 *
 * ONE argument feeding TWO channels is the point: the message an author reads
 * and the text generated docs publish cannot drift apart, because there is only
 * one string.
 *
 * ## What this deliberately does NOT change: the accept set
 *
 * `z.never({ error })` customises the MESSAGE only. The issue `code` stays
 * `invalid_type` and the issue `path` still names the key — exactly what a bare
 * `z.never()` reports — and `z.input` still types the key `never`, so `tsc`
 * refuses it at the authoring site before anything runs. Nothing that parsed
 * green parses red, or the reverse. Pinned member-by-member against the
 * pre-change readings in `../__tests__/static-table-narrow-surface.test.ts`.
 *
 * ## Not `@objectstack/spec`'s `retiredKey`
 *
 * The spec has a same-shaped helper (`shared/retired-key.ts`) for keys removed
 * from the SPEC, and it deliberately prefixes its describe text with
 * `[REMOVED] `. This one must not: these describe strings are already-published
 * metadata and stay byte-identical through this conversion. Same shape,
 * different describe contract — do not swap one for the other.
 *
 * Internal to this package's zod modules — deliberately NOT re-exported from
 * `index.zod.ts`, since nothing outside `@object-ui/types` declares these
 * schemas.
 */
export function retirementTombstone(guidance: string) {
  return z.never({ error: guidance }).optional().describe(guidance);
}

/** How a handler key sits on the TypeScript face (objectui#6124, measured per key). */
export type HandlerKeyDisposition =
  /** A host-supplied function REACHES a renderer at runtime — the TS twin keeps its function type. */
  | 'runtime-slot'
  /** Nothing reads the key — the TS twin is a `?: never` tombstone. */
  | 'retired';

/**
 * Declare a NAMED REFUSAL ARM for an `on*` handler key (objectui#6124,
 * maintainer ruling 2026-08-30: Q2 → A with C).
 *
 * The mirrors declared 58 handler keys as `z.function()` — a declaration no
 * JSON document can satisfy on a JSON-authored vocabulary. Deleting them was
 * measured and refused: `BaseSchema` is `.passthrough()`, so an undeclared key
 * is not refused, it is KEPT, and `onClick` rides `SDUI_DOM_PASS_THROUGH_KEYS`
 * into the DOM listener slot where React throws at click. So the key stays
 * DECLARED and refuses BY NAME, in the shape #5099 landed for
 * `FieldConstraintsSchema.pattern.value` (`form.zod.ts`): a `z.custom`
 * predicate whose message names the key, says why JSON cannot author it, and
 * points at the spelling that runs — the node-type form PR #6498 established.
 *
 * The predicate refuses EVERYTHING, a live function included. The JSON face
 * has no function value, and the programmatic face reaches renderers through
 * the TypeScript interface and React props, never through `safeParse`; a
 * function that parsed green here was only ever the instrument's positive
 * control. That is the accept-set change objectui#6124's changeset declares.
 *
 * Same discipline as {@link retirementTombstone}: ONE string feeds BOTH
 * author-facing channels — the parse-time issue message and the `.describe()`
 * metadata — so they cannot drift apart. Deliberately NOT that helper: a
 * tombstone retires a key from the contract on both faces and reports
 * `invalid_type`; this arm reports `custom` (the #5099 code) and, for a
 * `'runtime-slot'` key, the TypeScript twin stays callable. The two are pinned
 * apart in `../__tests__/handler-keys-json-refusal-6124.test.ts`.
 *
 * @param key         the member name, spelled into the message so the issue is
 *                    addressed even when read without its path
 * @param disposition what the TypeScript twin does — see {@link HandlerKeyDisposition}
 * @param label       the human label the site carried before (`'Click handler'`),
 *                    kept as the message's lead so docs surfaces keep their noun
 */
export function handlerKeyRefusal(key: string, disposition: HandlerKeyDisposition, label?: string) {
  const what =
    disposition === 'runtime-slot'
      ? `\`${key}\` is a RUNTIME SLOT for a host-supplied function, not authorable metadata ` +
        '(objectui#6124): JSON has no function value, and no handler key consumes a declarative ' +
        'action object. A React host supplies it through the TypeScript interface / props, never ' +
        'through this validator, which refuses it by name.'
      : `\`${key}\` is RETIRED (objectui#6124, ADR-0049): JSON has no function value, and no ` +
        'renderer reads this key, so nothing could ever run it.';
  const remedy =
    'Author behaviour as a NODE TYPE instead — e.g. { "type": "toast", ... } or an action:button ' +
    'node with a declared action, the spelling PR #6498 established.';
  const guidance = `${label ? `${label} — ` : ''}${what} ${remedy}`;
  return z.custom<never>(() => false, { error: guidance }).optional().describe(guidance);
}

/**
 * Declare a NAMED ALIAS REFUSAL ARM: a key that is a sibling SPELLING of a
 * declared member — never a member itself — kept declared and unwritable so an
 * authored value is refused by name and pointed at the canonical spelling,
 * instead of being STRIPPED in silence by a non-strict `z.object`
 * (objectui#7694, `domain:ui` PM ruling on objectui#7546: option A). The lead
 * sentence is the one `@objectstack/spec`'s `strictObject({ aliases })` answers
 * with, so an author meets the same remedy on both faces:
 *
 *     Unrecognized key(s) on this chart series: `chartType`. Did you mean
 *     `chartType` → `type`? …
 *
 * The third member of this file's family, and deliberately neither of the
 * other two by NAME — while sharing {@link retirementTombstone}'s PRIMITIVE:
 *
 *   - not {@link retirementTombstone} by name: that retires a key the contract
 *     once declared (ADR-0049) and its guidance is a migration note; an alias
 *     was never a member, and its guidance must carry the canonical spelling.
 *     A census of `retirementTombstone(` sites is a census of RETIRED keys, and
 *     an alias arm filed under it would miscount.
 *   - not {@link handlerKeyRefusal}: that says why JSON cannot author a
 *     function-valued key; an alias has a perfectly authorable value under the
 *     other name. And not its `z.custom` primitive either — measured:
 *     `z.toJSONSchema` THROWS on a `z.custom` arm ("Custom types cannot be
 *     represented in JSON Schema") and represents a `z.never` arm as
 *     `{ not: {} }` carrying the description. `z.toJSONSchema(ChartDataSeriesSchema)`
 *     succeeded before the first alias arm landed and goes on succeeding.
 *   - not a FOLD (`.overwrite()`, the shape `foldChartXAxisAlias` takes in
 *     `data-display.zod.ts`): a fold is only honest where the canonical key is
 *     the READER's first limb, so "canonical wins when both are written" restates
 *     a precedence already running. Where the reader takes the ALIAS first, a
 *     fold would let it overwrite the canonical key; the refusal is the shape
 *     there (objectui#7113's precedence rule, not inverted).
 *
 * Same discipline as its siblings: ONE string feeds BOTH author-facing
 * channels — the parse-time issue message and the `.describe()` metadata — so
 * they cannot drift apart. The issue `code` is `invalid_type` at the key's own
 * path, `z.input` is `undefined`, so the TypeScript twin is a `?: never`
 * tombstone and the pair does not drift in `zod-mirror-parity.test.ts`.
 * Pinned in `../__tests__/chart-series-chart-type-alias-refusal-7694.test.ts`.
 *
 * @param alias     the refused spelling, spelled into the message so the issue
 *                  is addressed even when read without its path
 * @param canonical the declared member the author meant
 * @param surface   the object being authored, phrased as the spec phrases it
 *                  (`'this chart series'`)
 * @param detail    the site's own reason and remedy — why the alias is not a
 *                  member HERE, and what to write instead
 */
export function aliasKeyRefusal(alias: string, canonical: string, surface: string, detail: string) {
  const guidance =
    `Unrecognized key(s) on ${surface}: \`${alias}\`. Did you mean \`${alias}\` → \`${canonical}\`? ${detail}`;
  return z.never({ error: guidance }).optional().describe(guidance);
}
