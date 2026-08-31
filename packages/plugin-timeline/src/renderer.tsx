/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import type { TimelineSchema } from '@object-ui/types';
import {
  Timeline,
  TimelineItem,
  TimelineMarker,
  TimelineContent,
  TimelineTitle,
  TimelineTime,
  TimelineDescription,
  TimelineHorizontal,
  TimelineHorizontalItem,
  TimelineGantt,
  TimelineGanttHeader,
  TimelineGanttRowLabels,
  TimelineGanttGrid,
  TimelineGanttRow,
  TimelineGanttLabel,
  TimelineGanttBar,
  TimelineGanttBarContent,
} from './index';
import { renderChildren, cn } from '@object-ui/components';
import { useDisplayLocale } from '@object-ui/i18n';
import {
  useTimelineTranslation,
  translateTimelineDefault,
  type TimelineTranslate,
} from './useTimelineTranslation';

// Constants
/**
 * The spec's timeline scale vocabulary (`ui/view.zod.ts`
 * `TimelineConfigSchema.scale`). Exported for the spec-parity test.
 */
export const TIMELINE_SCALES: ReadonlySet<string> = new Set([
  'hour', 'day', 'week', 'month', 'quarter', 'year',
]);

/**
 * Resolve the axis scale for the gantt variant. `scale` is the ONLY axis key —
 * it is `@objectstack/spec` `ui/TimelineConfig.json`'s spelling.
 *
 * The `timeScale` alias this used to fall back to (`scale ?? timeScale`) is
 * RETIRED (objectui#6355, maintainer ruling 2026-08-27: immediate retirement,
 * no phased window, while the project is at startup stage). It was this
 * renderer's pre-spec dialect: before #2942 ONLY `timeScale` was read, so every
 * spec-authored `scale` was silently ignored — this function was the fix, and
 * dropping the alias half completes it.
 *
 * A document that still spells `timeScale` no longer reaches this function with
 * an axis, and would fall to the `month` default below. That reversion is NOT
 * left silent: `@object-ui/types` tombstones the key on both halves
 * (`TimelineSchema.timeScale?: never` and the Zod twin's `z.never()`), so the
 * retired spelling is refused at the authoring boundary rather than quietly
 * re-bucketing the chart. The tombstone is why this deletion is safe; the two
 * ship together.
 *
 * An absent/unknown value keeps the renderer's historical `month` default. The
 * `vertical` / `horizontal` variants are sequential event feeds with no time
 * axis, so `scale` has nothing to bucket there by construction.
 */
export function resolveTimelineScale(schema: { scale?: unknown }): string {
  const raw = schema.scale;
  return typeof raw === 'string' && TIMELINE_SCALES.has(raw) ? raw : 'month';
}

/**
 * Gantt header labels for one scale across [minDate, maxDate]. Every spec
 * scale produces a non-empty header row — `hour` / `quarter` / `year` used to
 * fall through the month/week/day chain and return `[]`, blanking the axis
 * (#2942). Exported for the spec-parity test.
 *
 * `locale` is threaded in rather than read here: this is a pure function, and
 * the session's locale lives behind a hook (#4513). The three `Intl` branches
 * below used to pass a literal `'en-US'`, so a fully Chinese timeline rendered
 * an English axis. The default is `'en'` — the same concrete last resort
 * `useDisplayLocale()` falls back to, and byte-identical to the retired
 * `'en-US'` at all three sites — so the existing 3-argument call sites keep
 * producing exactly what they produced before.
 *
 * `t` is threaded on the same seam and for the same reason (#4520). The two are
 * different kinds of dependency and each covers what the other cannot: a locale
 * TAG formats a date, a TRANSLATION spells a word. The `week` and `quarter`
 * branches never touched `Intl`, so #4513 left them reading `Week 1` / `Q3
 * 2026` on an axis that had just become Chinese. Its default is the package's
 * own defaults table, which is what the channel serves with no `I18nProvider`
 * mounted, so 3- and 4-argument call sites keep producing byte-identical
 * English.
 *
 * ## The empty/degenerate range — the second of #6750's three sites
 *
 * objectui#6750 asked the same empty-list question at all three stops on the
 * gantt branch, so that fixing the one `throw` did not just move the crash two
 * stations down. This one needed no change, and that verdict is recorded here
 * rather than left to be re-derived: the guard on the next line already refuses
 * an unparseable or inverted range by returning NO headers, and a DEGENERATE
 * range (`minDate === maxDate`, which is what `emptyGanttDateRange` hands it)
 * is not inverted — `start > end` is false when they are equal, so the loop
 * runs exactly once and every scale emits exactly one bucket. Measured on
 * b76ca6764, min = max = '2026-03-15': hour `["Mar 15, 12 AM"]`, day
 * `["Mar 15"]`, week `["Week 1"]`, month `["Mar 2026"]`, quarter `["Q1 2026"]`,
 * year `["2026"]`.
 *
 * So the empty gantt gets a real one-column axis, not a header row with zero
 * cells. That composition is what
 * `./__tests__/timeline-gantt-empty-items.test.tsx` pins — separately from the
 * other two sites, so a later change that fixes one and not the others goes
 * red.
 *
 * ## The refusal on the next line is NOT dead code (objectui#6759)
 *
 * #6759 put a guard in the gantt branch that refuses an unparseable or inverted
 * range before this function is ever called, so the `return headers` below can
 * no longer be reached FROM THERE. It was reached before: a `zero-column axis`
 * is exactly what case 2 rendered its negative-width bar under, and the fix was
 * to refuse above rather than to relax the guard here — this function's verdict
 * is still "needed no change".
 *
 * Two reasons it stays. It is EXPORTED and called directly, including by
 * `timeline-gantt-empty-items.test.tsx`'s pin 5a, which holds these exact
 * inputs (`'2030-01-01'` / `'2026-03-15'`, and `''` / `''`) returning `[]`. And
 * it is the reason the caller's guard is allowed to be the only one: an axis
 * that silently drew nothing is what let the row loop below it keep running, so
 * the two guards are one invariant read from both ends, not a duplicate.
 */
export function generateTimeScaleHeaders(
  scale: string,
  minDate: string,
  maxDate: string,
  locale: string = 'en',
  t: TimelineTranslate = translateTimelineDefault,
): string[] {
  const headers: string[] = [];
  const start = new Date(minDate);
  const end = new Date(maxDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return headers;
  const current = new Date(start);
  switch (scale) {
    case 'hour':
      while (current <= end) {
        headers.push(current.toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric' }));
        current.setHours(current.getHours() + 1);
      }
      break;
    case 'day':
      while (current <= end) {
        headers.push(current.toLocaleDateString(locale, { month: 'short', day: 'numeric' }));
        current.setDate(current.getDate() + 1);
      }
      break;
    case 'week': {
      let week = 1;
      while (current <= end) {
        headers.push(t('timeline.scale.week', { n: week++ }));
        current.setDate(current.getDate() + 7);
      }
      break;
    }
    case 'quarter':
      current.setMonth(Math.floor(current.getMonth() / 3) * 3, 1);
      while (current <= end) {
        headers.push(
          t('timeline.scale.quarter', {
            quarter: Math.floor(current.getMonth() / 3) + 1,
            year: current.getFullYear(),
          }),
        );
        current.setMonth(current.getMonth() + 3);
      }
      break;
    case 'year':
      // Snap to the calendar-year start so every year touched by the range
      // gets a bucket (mirrors the quarter snap above).
      current.setMonth(0, 1);
      while (current <= end) {
        headers.push(String(current.getFullYear()));
        current.setFullYear(current.getFullYear() + 1);
      }
      break;
    case 'month':
    default:
      while (current <= end) {
        headers.push(current.toLocaleDateString(locale, { month: 'short', year: 'numeric' }));
        current.setMonth(current.getMonth() + 1);
      }
      break;
  }
  return headers;
}

/**
 * The date range a gantt falls back to when the rows carry NO dates at all —
 * an authored `items: []`, or rows whose `items` are all empty.
 *
 * ## Why a sentinel and not a throw (objectui#6750)
 *
 * `calculateDateRange` used to reduce the empty list directly: `Math.min()`
 * over no arguments is `Infinity`, and `new Date(Infinity).toISOString()`
 * throws `RangeError: Invalid time value` during render. An empty gantt is not
 * a malformed document — it is the ORDINARY empty state of a valid schema. Any
 * author or generator that builds `items` from a collection produces `items:
 * []` the moment the collection is empty: a filtered project list with no
 * matches, a fresh workspace, a plan whose rows are yet to be added. Crashing
 * the render on that is a correctness defect, not a strict-input policy.
 *
 * ## Why TODAY, and why a single day
 *
 * An empty plan carries no dates of its own, so the axis has to be anchored on
 * something outside the data, and "now" is the only anchor that is not
 * arbitrary. The span is ONE day — the smallest coherent range — because how
 * much time an empty gantt should show is a question about what an empty gantt
 * should LOOK like, and the 2026-08-29 triage on #6750 deliberately left that
 * open (「不要崩」 is the correctness floor it ruled on; 「崩改成空态面板还是零行
 * 图表」 is the product option it did not). A one-day window makes the smallest
 * possible claim: `generateTimeScaleHeaders` turns it into exactly one bucket
 * on every scale, so the axis is valid and non-empty, and the grid below it has
 * zero rows.
 *
 * ## What this deliberately does NOT do
 *
 * It does not reach the caller when the author pinned a range. The gantt branch
 * resolves `schema.minDate || dateRange.minDate`, so an author who pinned an
 * explicit `minDate` / `maxDate` gets EXACTLY that range with no rows in it —
 * most likely what they wanted, and free. Pinned by
 * `./__tests__/timeline-gantt-empty-items.test.tsx`.
 */
function emptyGanttDateRange(): { minDate: string; maxDate: string } {
  const today = new Date().toISOString().split('T')[0];
  return { minDate: today, maxDate: today };
}

// Helper function to calculate date range from items
function calculateDateRange(items: any[]): { minDate: string; maxDate: string } {
  const allDates = items.flatMap((row: any) =>
    (row.items || []).flatMap((item: any) => [item.startDate, item.endDate])
  );

  // objectui#6750 — the empty list is an ordinary state, not an error. Guarding
  // it HERE rather than at the call site is what keeps the whole gantt branch
  // coherent: the caller's `schema.minDate || dateRange.minDate` still resolves,
  // `generateTimeScaleHeaders` still gets a parseable min <= max and so still
  // emits an axis, and `calculateBarDimensions` is simply never reached because
  // there are no rows to draw bars for. See `emptyGanttDateRange` above.
  if (allDates.length === 0) return emptyGanttDateRange();

  // objectui#6759 — a list whose dates do not PARSE is a different input class
  // and is refused by the caller, above this function, naming the offending
  // value. So by the time control reaches the reduce below, every entry parses
  // and `Math.min` / `Math.max` are finite. objectui#6770 added `null` to that
  // same refusal, which is what keeps the EPOCH out of this reduce: `null`
  // parses to `0`, so it would have arrived here as a perfectly finite 1970
  // bound and anchored the axis fifty-four years early. Do NOT add a second guard here: a
  // sentinel substituted for a value the author got wrong is the consumer-side
  // tolerance both #6750 and #6759 rejected — see `findUnusableGanttDate`.

  const minTimestamp = Math.min(...allDates.map((d: string) => new Date(d).getTime()));
  const maxTimestamp = Math.max(...allDates.map((d: string) => new Date(d).getTime()));

  return {
    minDate: new Date(minTimestamp).toISOString().split('T')[0],
    maxDate: new Date(maxTimestamp).toISOString().split('T')[0],
  };
}

/**
 * "Is this value a `Date`?" — asked so that NOTHING the authored document
 * controls can answer it, and so that asking cannot throw (objectui#7027).
 *
 * ## What was wrong with `instanceof Date`
 *
 * It is this repo's idiom for the question (see
 * `packages/core/src/validation/validation-engine.ts` and
 * `components/src/renderers/complex/data-table.tsx`), and it answers a
 * DIFFERENT question: "does this inherit from `Date.prototype`?". A `Date` is
 * a Date because it owns a `[[DateValue]]` internal slot; the prototype chain
 * is decoration, and the two come apart in both directions. Measured on this
 * card's base 7fc5c3c12 with a node probe:
 *
 *     Object.create(Date.prototype) instanceof Date        -> true
 *     new Date(Object.create(Date.prototype))              -> THREW TypeError:
 *         Method Date.prototype.toString called on incompatible receiver
 *         [object Object]
 *
 * `new Date(x)` uses the slot directly when `x` owns one and runs ToPrimitive
 * when it does not — so an impostor that passed the gate reached `new Date`,
 * reached `Date.prototype[Symbol.toPrimitive]`, reached
 * `Date.prototype.toString` on a receiver with no slot, and took the render
 * down with it. That is a blank screen where a named diagnostic belongs, which
 * is the exact failure mode #6781 put the type gate here to remove and #6907
 * removed one function downstream.
 *
 * `instanceof` is not even total on its own terms: it walks
 * `[[GetPrototypeOf]]`, so a `Proxy` with a throwing `getPrototypeOf` trap
 * crashes inside the operator (measured, same probe).
 *
 * ## Why NOT the two brand tests the card suggested — both measured, both out
 *
 * - `Object.prototype.toString.call(value) === '[object Date]'` performs
 *   `Get(O, @@toStringTag)` UNCONDITIONALLY (ES2015 19.1.3.6 step 16), even
 *   once the builtin tag is decided. A `@@toStringTag` getter that throws is
 *   an authored value, and #6907 measured that exact input crashing the
 *   speller. It trades an impostor crash for a getter crash.
 * - `Number.isFinite(value.getTime())` calls the AUTHOR'S `getTime`. A
 *   `class X extends Date` that overrides it is a REAL Date — `super()` gave
 *   it the slot, so #6781's accept set contains it and the chart must draw —
 *   and this spelling would refuse it by dying. It trades an impostor crash
 *   for a subclass crash, on a value that is not even wrong.
 *
 * Both are pinned as red rows in `timeline-gantt-date-brand-7027.test.tsx`,
 * so a later "simplification" into either one fails there rather than in a
 * fifth card.
 *
 * ## What this does instead
 *
 * Invokes the BUILTIN `Date.prototype.getTime` with `.call`. It reads the
 * receiver's `[[DateValue]]` slot and nothing else: no property is fetched off
 * `value`, so no author getter runs, no `@@toStringTag` is consulted, no proxy
 * trap fires, and a subclass cannot hijack it. The slot is not observable any
 * other way — the language exposes that bit only by throwing when it is
 * absent — so the `catch` is the READ, not error handling draped over a
 * fallible operation.
 *
 * `new Date(NaN)` owns its slot, so it is a `Date` here and is refused one
 * step later by the parse check, keeping its `Invalid Date` spelling. That is
 * the half of #6781's ruling this must not move.
 */
const isDate = (value: unknown): value is Date => {
  try {
    Date.prototype.getTime.call(value as Date);
    return true;
  } catch {
    return false;
  }
};

/**
 * How a gantt date value is SPELLED inside a diagnostic (objectui#6759,
 * ruled into a rule by objectui#6907).
 *
 * ## THE RULE
 *
 *     Spell the value when the LANGUAGE owns its spelling.
 *     Name its TYPE when producing text would run AUTHOR code.
 *
 * That single line decides every branch below, and it is a rule rather than a
 * list of values someone tripped over — the same treatment #6781 gave the
 * accept set. Every primitive has a spelling fixed by the grammar, so a
 * primitive is spelled: it is literally the text the author typed, and it
 * cannot be confused with the spelling of a different value. A non-primitive
 * has no such spelling. The only way to get text out of one is to call
 * `toString` / `Symbol.toPrimitive` / `Symbol.toStringTag`, all of which are
 * whatever the authored document happens to carry — so the diagnostic would be
 * quoting the very data it is refusing, as if it were trustworthy.
 *
 * ## Why the old `String` fallback had to go — three faults, all measured
 *
 * The fallback was written by #6759 when nothing but `[object Object]`-shaped
 * values could reach it. #6905 (the #6781 type rule) routes the whole
 * non-date type space through it. Measured on this card's base b458300ca, one
 * row item and a throwaway probe (`startDate: '2024-01-01'`, `endDate` varied):
 *
 *     endDate: []                 -> "endDate is , which is not a valid date"
 *     endDate: ['2024-01-01']     -> "endDate is 2024-01-01, ..."
 *     endDate: [0]                -> "endDate is 0, ..."
 *     endDate: 0n                 -> "endDate is 0, ..."
 *     endDate: {toString: () => '2024-01-01'}
 *                                 -> "endDate is 2024-01-01, ..."
 *     endDate: new Map()          -> "endDate is [object Map], ..."
 *     endDate: function myFn() {} -> the function's SOURCE TEXT, newlines and all
 *     endDate: {toString() { throw }}      -> THREW, uncaught, mid-render
 *     endDate: {get [Symbol.toStringTag]() { throw }}
 *                                          -> THREW, uncaught, mid-render
 *     endDate: Object.create(null)         -> THREW TypeError: Cannot convert
 *                                             object to primitive value
 *
 * 1. It VANISHES. `String([])` is the empty string, so the value disappears
 *    from its own sentence — the exact blur this helper quotes strings to
 *    avoid, reached through a different branch.
 * 2. It LIES. `['2024-01-01']` is spelled as a text that IS a valid date, and
 *    `[0]` / `0n` as a number that IS an accepted one (`0` is a kept gantt
 *    date, #6781). The author is told a correct-looking value is invalid with
 *    no hint that the wrapper is the fault.
 * 3. It THROWS. The last three rows are live crashes on `main`, and they are
 *    the reason this is not a cosmetic card. #6759 declared this helper "total
 *    by construction" and #6905 made that property load-bearing by putting the
 *    type gate BEFORE `new Date`. But the gate only stopped `new Date` from
 *    throwing; `String(value)` still handed control to author code one line
 *    later, so the crash class did not go away — it moved from
 *    `findUnusableGanttDate` into this function. A helper that dies while
 *    reporting an author error replaces a named diagnostic with a blank screen,
 *    which is the failure mode both cards exist to remove.
 *
 * ## Why NOT `JSON.stringify`, the obvious repair
 *
 * `JSON.stringify(0n)` THROWS (`TypeError: Do not know how to serialize a
 * BigInt`), and it throws again on a cycle, and it drops `undefined` members.
 * It would reintroduce fault 3 — the crash class — into the one helper that
 * must not have it. Measured, not assumed. It stays only where it is already
 * total: on a `string`, where it is #6759's quoting and nothing else.
 *
 * ## Why NOT "type plus a bounded rendering"
 *
 * The rule refuses it, on the same ground as the rest: any rendering of a
 * non-primitive reads something off it. Even the most bounded version — an
 * element count — is not total, because `Array.isArray` is true for a Proxy
 * whose `length` trap throws (measured). A hybrid would buy a few characters of
 * detail by giving back the crash-freedom the whole card is about.
 *
 * ## Why naming the TYPE does not abandon this helper's purpose
 *
 * The purpose is to let an author find and fix the value. The PATH half does
 * the finding and is always exact (`items[0].items[0].endDate`); the value half
 * exists to disambiguate what sits there when the author cannot see it — `''`
 * from `'  '` from a key never written. For a non-primitive, the author can
 * read their own document at that path; what they cannot read is WHY it was
 * refused. "is an array" says exactly that, and says it about the wrapper,
 * which is the repair. Naming a WRONG value, as the fallback did, is strictly
 * worse than naming a category: it costs the author a search for a fault that
 * is not there.
 *
 * ## The branches, and why each is total
 *
 * - `string` -> quoted (#6759's pin; empty and space-padded stay visible).
 * - `undefined` / `null` -> themselves (#6759 / #6770's pins; how an author
 *   reads a key they forgot to write versus one they wrote as empty).
 * - `symbol` -> `Symbol(desc)` via `Symbol.prototype.toString`, which no
 *   instance can override. `String(aSymbol)` THROWS; #6905's type-first
 *   ordering is what finally made this branch reachable.
 * - `bigint` -> the LITERAL, with its `n`. `String(0n)` is `"0"`, which is
 *   fault 2; `${value}n` is what the author typed and is unmistakable.
 * - `number` / `boolean` -> `String`, which for a primitive IS the source
 *   syntax (`0`, `NaN`, `false`).
 * - `Date` -> `Date.prototype.toString.call`, NOT `String`. Byte-identical for
 *   every Date that owns a `[[DateValue]]` slot (measured, both the valid and
 *   the `Invalid Date` reading), so the inverted-range diagnostic this helper
 *   is shared with does not move. It is used in place of `String` because a
 *   `class X extends Date` that overrides `toString` can hijack `String` and
 *   throw (measured) — the builtin cannot be. This is the one non-primitive
 *   with a spelling the LANGUAGE owns, and it is also the only non-primitive
 *   the accept set contains. The branch is SELECTED by `isDate` and not by
 *   `instanceof Date` (objectui#7027): the builtin `toString` throws on a
 *   receiver that inherits `Date.prototype` without owning the slot, so
 *   choosing this branch on the prototype chain is what let an impostor crash
 *   the very sentence that was supposed to name it.
 * - everything else -> `an array` / `a function` / `an object`, chosen with
 *   `Array.isArray` and `typeof`, which read no author-controlled property.
 *   Deliberately NOT `Object.prototype.toString.call`: that consults
 *   `Symbol.toStringTag`, which can be a throwing getter (measured), so the
 *   more informative spelling is the non-total one.
 *
 * All eight `typeof` results are covered and no branch falls through to author
 * code. The single reflective operation it performs is the Date test, which is
 * the one `isGanttDateType` already performed on the same value to refuse it —
 * so this function adds no throw site the accept gate does not already have.
 *
 * ⚠️ objectui#7027 — that sentence was true and the helper was still not
 * total, because the shared test was `instanceof Date` and `instanceof` is not
 * total. `Object.create(Date.prototype)` took this function's `Date` branch
 * and threw inside `Date.prototype.toString.call`; a `Proxy` with a throwing
 * `getPrototypeOf` trap threw inside the operator itself (both measured on
 * 7fc5c3c12). Both sites now ask `isDate`, which is total, so the shared
 * operation adds no throw site because it HAS none — not because the gate
 * absorbed it first.
 *
 * ## What this deliberately does NOT do
 *
 * It does not change WHICH values are refused — that is #6781's ruling and it
 * is untouched here — and it does not change the sentence. "is an array, which
 * is not a valid date" reads correctly in the existing
 * `timeline.gantt.unusableRange.malformedDate` hole, so no new i18n key is
 * added and the ten locale packs are not opened. A spelling repair that needed
 * a new key would be a different file surface and a separate decision.
 */
function spellGanttDateValue(value: unknown): string {
  // Primitives — the language fixes the spelling, so it is the author's own.
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  // The one non-primitive whose spelling the LANGUAGE owns, and the only one
  // the accept set contains. `.call` so a subclass cannot hijack it, and
  // `isDate` rather than `instanceof` so a slot-less impostor never reaches
  // that builtin — it throws on a receiver without `[[DateValue]]` (#7027).
  if (isDate(value)) return Date.prototype.toString.call(value);

  // Every other non-primitive — named, never rendered. No author code runs.
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'function') return 'a function';
  return 'an object';
}

/** A gantt date that does not parse, with the authored path that names it. */
type UnusableGanttDate = { path: string; value: unknown };

/**
 * The first gantt date that does not parse — objectui#6759 case 1.
 *
 * ## What was wrong
 *
 * objectui#6750 taught `calculateDateRange` about the EMPTY list and nothing
 * else. A list whose dates do not PARSE reduced exactly as before:
 * `new Date('not-a-date').getTime()` is `NaN`, `Math.min(NaN)` is `NaN`, and
 * `new Date(NaN).toISOString()` throws `RangeError: Invalid time value`
 * mid-render — the same crash site and the same signature as #6750, on a
 * different input class. Measured on this card's base b98352a15, with a
 * throwaway probe before any change:
 *
 *     CASE-1  malformed startDate + endDate -> RangeError: Invalid time value
 *     CASE-1b one date parses, one does not -> RangeError: Invalid time value
 *     CASE-1c endDate absent entirely       -> RangeError: Invalid time value
 *
 * 1c is the one worth reading twice. `new Date(undefined)` is also an invalid
 * date, so a row item that simply OMITS `endDate` crashed the render too — it
 * arrives at the same reduce through the same `[item.startDate, item.endDate]`
 * flatMap. It is not a separate defect and it is not a widening: any guard
 * phrased as "every date in the list must parse" necessarily covers it, and
 * deliberately excluding it would mean writing extra code to keep one input
 * class crashing.
 *
 * ## Why the PINS are scanned here too
 *
 * `schema.minDate` / `schema.maxDate` never reach `calculateDateRange` — the
 * caller resolves `schema.minDate || dateRange.minDate` afterwards — so an
 * author who pins an unparseable value does not crash. They fail the OTHER
 * way, which is worse and is case 2's disease: measured on the same base,
 * `minDate: 'whenever'` rendered an axis with zero columns and a bar carrying
 * NO `style` attribute at all (`CASE-2b ... bars: [null]`), because
 * `calculateBarDimensions` divided by `NaN` and the CSSOM rejects
 * `left: NaN%`. One scan covers both origins because they are one question:
 * does every date this chart is about to be drawn from parse?
 *
 * Only a TRUTHY pin is judged. `schema.minDate: ''` is falsy, so the caller's
 * `||` discards it and the computed range is used instead; judging a value the
 * render will never read would refuse a chart that draws correctly. `null` is
 * falsy as well, so a PINNED `null` stays unjudged for that same reason even
 * though a ROW `null` is refused below (objectui#6770) — measured: `minDate:
 * null, maxDate: null` draws the rows' own range, `['Jan 2024','Feb 2024','Mar
 * 2024']`. The asymmetry is the caller's `||`, which row dates have nothing
 * equivalent to.
 *
 * Rows before pins, which is the order the caller resolves them in — compute
 * from the rows, then let a pin override. When both are wrong the diagnostic
 * names the one a reader tracing the render reaches first.
 *
 * ## `null` is a fault too — the one that PARSES (objectui#6770)
 *
 * `new Date(null).getTime()` is `0`, not `NaN` — the epoch, not an invalid
 * date — so a `null` date passes every parse check there is and flows into the
 * arithmetic as `1970-01-01`. #6759 left it alone as an input class it had not
 * measured; #6770 measured it, on c6732825d, i.e. WITH the guard above already
 * in the tree, one row item and a throwaway probe:
 *
 *     CASE-NULL-END   endDate: null   -> alert: null, axis 649 columns
 *                     (Jan 1970 … Jan 2024), bars ["left: 100%; width: -100%;"]
 *     CASE-NULL-START startDate: null -> alert: null, axis 651 columns,
 *                     bars ["left: 0%; width: 100%;"]
 *     CASE-NULL-BOTH  both null       -> alert: null, axis ["Jan 1970"],
 *                     bars ["left: 0%; width: 100%;"]
 *
 * The last two are the reason this is refused rather than drawn: they do not
 * even look broken. A full-width bar under a one-bucket `Jan 1970` axis is a
 * chart a reader believes.
 *
 * ## Why refused, rather than read as "open-ended" or as "absent"
 *
 * Not a new adjudication: #6759 already refuses an ABSENT date — `new
 * Date(undefined)` is `NaN` — and pins it ("an ABSENT date is the same input
 * class and is named as `undefined`"). `null` is that same absence with a
 * different spelling: a record mapping that omits the key and one that emits
 * `null` report the same unset field upstream. Treating them differently would
 * make the chart depend on how a mapping layer spells "no value" — something
 * no author writes and none can predict. The two other readings both fail the
 * same test: "runs to the end of the axis" is a new rendering behaviour that
 * would need a spec key of its own rather than a meaning smuggled into `null`,
 * and "fall back to `startDate`" substitutes a plausible value for one the
 * document does not carry — the consumer-side tolerance #6750 and #6759 both
 * rejected. `spellGanttDateValue` was already written to spell `null` as
 * itself, for "one they wrote as empty"; until this card that branch could not
 * be reached.
 *
 * ## Where the line is: the RULED TYPE RULE (objectui#6781)
 *
 * #6770 drew this line at `value === null` and deliberately nothing wider,
 * because it had measured only that one spelling. objectui#6781 measured the
 * rest of the type space and the maintainer ruled the line to be a TYPE rule
 * instead — see `isGanttDateType` below, which is now the whole of "is this a
 * date at all". `null` is no longer named on its own; it is refused by that
 * rule, through this same function, with the same path and the same spelling
 * (measured — see the table on `isGanttDateType`).
 *
 * `0` stays ACCEPTED under that rule, which is the part worth reading twice.
 * `0` coerces to the epoch just like `null` did (measured: the same 649-column
 * axis) — but `0` is a legitimate epoch timestamp, indistinguishable from an
 * author who means 1970-01-01, and `startDate: 1704067200000` renders 2024
 * correctly today. `null` is not a timestamp at all; it is what a data source
 * hands you for a field that is unset. The type rule keeps exactly that
 * distinction and widens nothing around it.
 */
/**
 * THE RULED TYPE RULE for a gantt date — objectui#6781, maintainer ruling
 * 2026-08-30 (option A of that card's three).
 *
 * ## The accept set, stated as an accept set
 *
 *     string  |  FINITE number  |  Date
 *
 * and nothing else. This is a RULE, not a list of values someone tripped over:
 * every input class is judged by the same question — "is this the kind of thing
 * a date can be written as?" — and the answer does not depend on which
 * coercion `new Date` happens to perform on it. The three cards before this one
 * each added one more refused VALUE (`undefined` #6759, `null` #6770); this one
 * replaces that accretion with the rule they were each approximating, so the
 * next exotic value does not need a fourth card.
 *
 * ## Why a type rule rather than more values
 *
 * `new Date(x)` accepts far more than dates. It runs ToPrimitive on anything,
 * so a boolean, an array, or any object with a plausible `toString` becomes an
 * instant, silently. Measured on this card's base fab4802e3, one row item and a
 * throwaway probe (`endDate` set, `startDate: '2024-01-01'`):
 *
 *     endDate: false            -> NO diagnostic, axis 649 columns
 *                                  (Jan 1970 … Jan 2024), bars ["left: 100%;
 *                                  width: -100%;"]
 *     endDate: true             -> NO diagnostic, axis 649 columns, bars
 *                                  ["left: 100%; width: -99.99999999994131%;"]
 *     endDate: ['2024-01-01']   -> NO diagnostic, axis ["Jan 2024"], bars
 *                                  ["left: 0%; width: 100%;"]
 *     endDate: [0]              -> NO diagnostic (ToPrimitive gives "0", which
 *                                  parses as the year 2000)
 *     endDate: {toString: () => '2024-01-01'}
 *                               -> NO diagnostic, axis ["Jan 2024"]
 *
 * The first is the filed shape of this defect and is byte-identical to the
 * `endDate: 0` reading the card was filed on: a fifty-four-year axis and a
 * NEGATIVE-width bar, with no diagnostic. `false` is where a wrong value hides:
 * a boolean reaching a date field means a mapping layer emitted the wrong
 * column, and drawing a 1970 axis from it is the silent-wrong-render this
 * chart's three previous cards each closed one spelling of.
 *
 * ## Why `0` is KEPT (the ruling is explicit, and it is the load-bearing half)
 *
 * `0` is a finite number, so it is ACCEPTED and still draws 1970-01-01. That is
 * ruled, not incidental: `0` is a legitimate epoch timestamp, and under a
 * `startDate: 1704067200000` encoding an author who writes `0` means the epoch.
 * Refusing it would take away a real capability to catch a hypothetical input.
 * Measured for this card: the repo has ZERO sites feeding an integer `0` into a
 * gantt date (control: 222 gantt-date assignment sites repo-wide), so the
 * capability is preserved on the encoding's terms rather than on a consumer's —
 * which is why the pin for it is a TEST and not a call site.
 *
 * ## Why FINITE, when `new Date` already refuses `NaN` and `Infinity`
 *
 * It moves nothing measured: `new Date(NaN)` and `new Date(Infinity)` are both
 * invalid dates, so the parse check below already refused them and still would.
 * The clause is here so the accept set can be READ as the rule it is — "a
 * number that is an instant" — instead of leaving the exclusion to a coercion
 * detail that a later reader would have to rediscover. Same verdict, stated
 * rather than inherited.
 *
 * ## `null` and `undefined` are SUBSUMED, and their diagnostics do not move
 *
 * Neither is a string, a finite number, or a `Date`, so both are refused here
 * — #6759's `undefined` and #6770's `null` alike — and neither is named
 * separately any more. This is strictly wider than `value === null` and it
 * changes nothing an author sees: the path is the same, and
 * `spellGanttDateValue` still spells them as themselves. The reasoning that put
 * them here is preserved in this function's header, which is where a reader
 * asking "why is an absent date refused?" goes.
 *
 * ## The order is load-bearing: this gate runs BEFORE `new Date`
 *
 * `new Date(x)` does not merely refuse a `bigint` or a `symbol` — it THROWS
 * `TypeError: Cannot convert a BigInt value to a number`. Measured on the same
 * base, both crashed the render from inside the guard itself:
 *
 *     endDate: 0n         -> THREW TypeError (uncaught, mid-render)
 *     endDate: Symbol('s') -> THREW TypeError (uncaught, mid-render)
 *
 * A guard that crashes while reporting an author error replaces a named
 * diagnostic with a blank screen — the exact failure mode `spellGanttDateValue`
 * calls out one docblock up, and the reason its `symbol` branch was written
 * "total by construction". Refusing by TYPE first makes this predicate total:
 * `new Date` is only ever reached with a string, a finite number, or a `Date`,
 * none of which throw. Those two classes now take the ordinary refusal path,
 * and that `symbol` branch is reachable at last.
 *
 * ⚠️ ...with ONE gap, closed by objectui#7027 and worth reading as the reason
 * this docblock now points at `isDate`. The paragraph above is a claim about
 * `new Date`'s ARGUMENT, and it was only as good as the predicate that
 * produced it. `instanceof Date` answers "does this inherit from
 * `Date.prototype`?", not "is this a `Date`?", so it admitted
 * `Object.create(Date.prototype)` — which is not a `Date`, reached `new Date`,
 * and threw. Measured on 7fc5c3c12; the reading and the two other impostor
 * spellings are on `isDate` above and pinned in
 * `timeline-gantt-date-brand-7027.test.tsx`.
 *
 * ⛔ That is the fourth totality claim in this code path and the third to be
 * falsified by the next card's measurement (#6759 -> #6905 -> #6907 -> this).
 * The pattern is the lesson: totality asserted in prose is a hypothesis, and
 * the only thing that has ever settled it here is an exercised input set. Do
 * not answer a future gap with a fifth sentence — add the row to that file.
 *
 * The ACCEPT SET is untouched by #7027. `isDate` is strictly narrower than
 * `instanceof Date` over values that reach it, and everything it newly refuses
 * is a value no authored document can carry (ObjectUI metadata is JSON; JSON
 * has no way to spell a prototype). An invalid `Date` object owns its slot, so
 * it still passes this gate and is still refused by the parse check below,
 * where it belongs, with its `Invalid Date` spelling intact.
 */
const isGanttDateType = (value: unknown): value is string | number | Date =>
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  isDate(value);

function findUnusableGanttDate(
  items: any[],
  pinnedMinDate: unknown,
  pinnedMaxDate: unknown,
): UnusableGanttDate | undefined {
  /**
   * Two ways a gantt date is unusable, in this order and only this order.
   *
   * 1. It is not one of the three things a date can be written as — the ruled
   *    TYPE rule, objectui#6781, spelled out on `isGanttDateType` above. This
   *    subsumes #6770's `null` and #6759's `undefined`, and it is what refuses
   *    `false` / `true` / an array / an object with a `toString`, all of which
   *    `new Date` would otherwise coerce into a silent 1970 axis.
   * 2. It is the right TYPE but does not parse — #6759's original question,
   *    still asked, and still the only thing that separates `'2024-01-01'` from
   *    `'not-a-date'` or a valid `Date` from `new Date(NaN)`.
   *
   * The type gate must come first: `new Date` THROWS on a `bigint` or a
   * `symbol`, so asking "does it parse?" of an unjudged value crashes the guard
   * (measured — see `isGanttDateType`).
   */
  const isUnusable = (value: unknown) =>
    !isGanttDateType(value) || Number.isNaN(new Date(value).getTime());

  for (let rowIndex = 0; rowIndex < items.length; rowIndex++) {
    const rowItems = (items[rowIndex]?.items || []) as any[];
    for (let itemIndex = 0; itemIndex < rowItems.length; itemIndex++) {
      for (const key of ['startDate', 'endDate'] as const) {
        const value = rowItems[itemIndex]?.[key];
        if (isUnusable(value)) {
          return { path: `items[${rowIndex}].items[${itemIndex}].${key}`, value };
        }
      }
    }
  }

  for (const [path, value] of [
    ['minDate', pinnedMinDate],
    ['maxDate', pinnedMaxDate],
  ] as const) {
    if (value && isUnusable(value)) return { path, value };
  }

  return undefined;
}

// Helper function to calculate bar position and width based on dates
function calculateBarDimensions(
  startDate: string,
  endDate: string,
  minDate: string,
  maxDate: string
): { start: number; width: number } {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  const min = new Date(minDate).getTime();
  const max = new Date(maxDate).getTime();

  const totalDuration = max - min;
  const startOffset = start - min;
  const duration = end - start;

  /**
   * objectui#6750 — the DEGENERATE axis, the third site of the same empty-list
   * question and the one that fails silently instead of loudly.
   *
   * `totalDuration` is `0` whenever the axis has no width: every task starting
   * and ending on the same day (a one-day plan, or a single same-day task), or
   * an author pinning `minDate === maxDate`. Both divisions below then evaluate
   * `0 / 0`, which is `NaN`, and the bar is handed `left: NaN%; width: NaN%`.
   * That is not a crash and not a visible error — the CSSOM REJECTS both
   * declarations, so React leaves the element with no `style` attribute at all
   * and the bar renders unpositioned and zero-width. Measured on b76ca6764:
   * a single `{ startDate: '2024-05-01', endDate: '2024-05-01' }` row produced
   * `<div class="absolute h-8 rounded-md …">` carrying no `style`.
   *
   * On a zero-width axis every task covers the whole of it, by definition —
   * there is no sub-interval for a bar to occupy. `{ start: 0, width: 100 }` is
   * that answer written down, and it keeps the bar visible instead of
   * collapsing it. Guarded on `totalDuration === 0` and nothing looser, so the
   * normal path is arithmetically untouched.
   */
  if (totalDuration === 0) {
    return { start: 0, width: 100 };
  }

  return {
    start: (startOffset / totalDuration) * 100,
    width: (duration / totalDuration) * 100,
  };
}

/**
 * Format one item date for display.
 *
 * `locale` is a REQUIRED parameter, not an optional one (#4513): this helper is
 * module-private, every call site sits inside `TimelineRenderer`, and the two
 * ways it used to get a locale were both wrong in the same session. `'short'`
 * passed nothing at all — and no tag means the MACHINE's locale, which has
 * nothing to do with the user — while `'long'` passed a literal `'en-US'`. A
 * required parameter is what keeps a future branch from quietly reintroducing
 * either. `'iso'` is a machine format by definition and stays locale-free.
 */
function formatDate(dateString: string, format: string | undefined, locale: string): string {
  const date = new Date(dateString);
  if (format === 'short') {
    return date.toLocaleDateString(locale);
  }
  if (format === 'long') {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return date.toISOString().split('T')[0];
}

/**
 * Render an inline option chip for the per-item metadata strip
 * (status, priority, …). Uses the option color when supplied so the
 * chip visually echoes the marker, falling back to a neutral pill
 * when the option has no color metadata.
 */
function MetaChip({ label, color }: { label: string; color?: string }) {
  const style = color
    ? { backgroundColor: `${color}22`, color, borderColor: `${color}55` }
    : undefined;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        !color && 'bg-muted text-muted-foreground border-transparent'
      )}
      style={style}
    >
      {label}
    </span>
  );
}

/** Group adjacent items that share the same `group` key (already in
 *  display order) into a single section so the renderer can drop a
 *  sticky header above each bucket. */
function groupAdjacent<T extends { group?: string | null }>(items: T[]): Array<{ key: string; items: T[] }> {
  const out: Array<{ key: string; items: T[] }> = [];
  for (const it of items) {
    const key = it.group == null ? '' : String(it.group);
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(it);
    else out.push({ key, items: [it] });
  }
  return out;
}

export const TimelineRenderer = ({ schema, className, ...props }: { schema: TimelineSchema; className?: string; [key: string]: any }) => {
    const {
      variant = 'vertical',
      items = [],
      dateFormat = 'short',
      onItemClick,
    } = schema;

    // The one locale channel every renderer in this repo resolves through:
    // tenant regional default → active UI language → 'en' (#4513, the channel
    // #4468 / PR #4512 converged `@object-ui/fields` onto). Read once here,
    // above every variant's early return so the hook count can never depend on
    // `variant`, and threaded down — `formatDate` and `generateTimeScaleHeaders`
    // are module-level functions and cannot host a hook themselves.
    const displayLocale = useDisplayLocale();

    // The package's translate channel, read on the same terms and for the same
    // structural reason as the locale above: one read, above every variant's
    // early return, threaded down into the module-level helpers that cannot
    // host a hook (#4520).
    //
    // It is a SECOND channel, not a duplicate of the first, and the two are
    // allowed to disagree: `useDisplayLocale()` puts the tenant's regional
    // default first (how this org writes dates), while `t` follows the UI
    // language (what this user reads). A tenant configured `en` with a user
    // reading Chinese chrome therefore renders `Aug 2026` beside `第 1 周` —
    // the same split `timeline.bucket.*` has always had in `ObjectTimeline`.
    const { t } = useTimelineTranslation();

    // Vertical Timeline
    if (variant === 'vertical') {
      // Detect whether the data was annotated with a `group` key
      // (ObjectTimeline does this for both explicit groupBy and the
      // automatic date bucketing fallback). When present we render
      // sticky bucket headers; when absent we keep the historical flat
      // list so JSON-defined timelines aren't visually disturbed.
      const groups = groupAdjacent(items as Array<any>);
      const hasGroups = groups.some((g) => g.key !== '');

      const renderItem = (item: any, key: React.Key) => {
        // Custom CSS color from objectDef option metadata overrides the
        // CVA variant — that lets the marker reflect the live status
        // colour (e.g. amber for "in progress") without us hard-coding
        // every status into the variants enum.
        const markerStyle = item.color
          ? { backgroundColor: `${item.color}33`, borderColor: item.color }
          : undefined;
        const dateLabel = item.time
          ? formatDate(item.time, dateFormat, displayLocale)
          : (item.startDate ? formatDate(item.startDate, dateFormat, displayLocale) : '');
        const endLabel = item.endDate && item.endDate !== item.startDate
          ? formatDate(item.endDate, dateFormat, displayLocale)
          : '';
        const meta = Array.isArray(item.meta) ? item.meta : [];
        return (
          <TimelineItem
            key={key}
            density="compact"
            className={cn(item.className, onItemClick && 'cursor-pointer')}
            onClick={() => onItemClick?.(item)}
          >
            <TimelineMarker
              variant={item.color ? 'default' : (item.variant || 'default')}
              style={markerStyle}
            >
              {item.icon && <span className="text-xs">{item.icon}</span>}
            </TimelineMarker>
            <TimelineContent>
              {(dateLabel || endLabel) && (
                <TimelineTime
                  dateTime={item.time || item.startDate}
                  className="!mb-1 text-xs"
                >
                  {dateLabel}
                  {endLabel && <span className="text-muted-foreground/70"> → {endLabel}</span>}
                </TimelineTime>
              )}
              {item.title && <TimelineTitle className="text-sm sm:text-base mb-1">{item.title}</TimelineTitle>}
              {meta.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1 mb-1">
                  {meta.map((m: any) => (
                    <MetaChip key={m.key} label={m.label} color={m.color} />
                  ))}
                </div>
              )}
              {item.description && (
                <TimelineDescription className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-none">
                  {item.description}
                </TimelineDescription>
              )}
              {item.content && renderChildren(item.content)}
            </TimelineContent>
          </TimelineItem>
        );
      };

      if (!hasGroups) {
        return (
          <Timeline className={className} {...props}>
            {(items as Array<any>).map((item, index) => renderItem(item, index))}
          </Timeline>
        );
      }

      return (
        <div className={cn('px-4 sm:px-6 py-2', className)} {...props}>
          {groups.map((g, gi) => (
            <section key={`${g.key}-${gi}`} className="mb-4">
              <header className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-1.5 backdrop-blur bg-background/90 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                <span>{g.key}</span>
                <span className="ml-2 text-muted-foreground/60 font-normal normal-case">
                  {g.items.length}
                </span>
              </header>
              <Timeline className="mt-3">
                {g.items.map((item, index) => renderItem(item, `${gi}-${index}`))}
              </Timeline>
            </section>
          ))}
        </div>
      );
    }

    // Horizontal Timeline
    if (variant === 'horizontal') {
      return (
        <TimelineHorizontal className={cn("overflow-x-auto [-webkit-overflow-scrolling:touch]", className)} {...props}>
          {items.map((item: any, index: number) => (
            <TimelineHorizontalItem key={index} className={cn(item.className, onItemClick && 'cursor-pointer')} onClick={() => onItemClick?.(item)}>
              <div className="flex flex-col items-center">
                <TimelineMarker variant={item.variant || 'default'}>
                  {item.icon && <span className="text-xs">{item.icon}</span>}
                </TimelineMarker>
                <div className="mt-4 text-center">
                  {item.time && (
                    <TimelineTime dateTime={item.time}>
                      {formatDate(item.time, dateFormat, displayLocale)}
                    </TimelineTime>
                  )}
                  {item.title && <TimelineTitle>{item.title}</TimelineTitle>}
                  {item.description && (
                    <TimelineDescription className="text-center line-clamp-2 sm:line-clamp-none">
                      {item.description}
                    </TimelineDescription>
                  )}
                  {item.content && renderChildren(item.content)}
                </div>
              </div>
              {index < items.length - 1 && (
                <div className="absolute left-full w-16 border-t-2 border-gray-200 top-3" />
              )}
            </TimelineHorizontalItem>
          ))}
        </TimelineHorizontal>
      );
    }

    // Gantt/Airtable-style Timeline
    if (variant === 'gantt') {
      /**
       * objectui#6759 — an UNUSABLE date range refuses loudly, naming the value
       * that made it unusable.
       *
       * ## The policy, and why it is not a new adjudication
       *
       * Two defects arrived together because a fixer has to decide ONE policy
       * for both, and they failed in OPPOSITE directions, which is itself the
       * evidence that no policy existed yet: a malformed date crashed the
       * render (`RangeError: Invalid time value`), while an inverted
       * author-pinned range drew a bar at `left: 157.9%; width: -4.3%` under a
       * header row with zero cells and said nothing. The 2026-08-29 triage
       * ruled both are ordinary defects rather than policy questions, and that
       * the WORDING — the only genuinely open question — already has a
       * precedent one file away: objectui#6655 refuses the object-bound gantt
       * with a `role="alert"` diagnostic. So this is that neighbour's shape,
       * copied rather than invented.
       *
       * ## Why HERE, above everything
       *
       * Placed before `calculateDateRange` and before
       * `generateTimeScaleHeaders`, and it establishes an invariant for both:
       * every date reaching them parses, and the resolved range is not
       * inverted. That matters most for `generateTimeScaleHeaders`, whose own
       * guard already refuses an unparseable or inverted range by returning NO
       * headers — the zero-column axis case 2 rendered under. That guard is
       * pinned by objectui#6750 as "a different input class, left exactly as it
       * was", and it stays untouched: it is now simply unreachable from this
       * branch, rather than being widened or relaxed. Downstream,
       * `calculateBarDimensions` can no longer see a `NaN` or negative
       * `totalDuration` at all, so #6750's `totalDuration === 0` guard keeps
       * covering exactly the degenerate case it was written for.
       *
       * ## What this deliberately does NOT do
       *
       * It does not widen #6750's `emptyGanttDateRange` sentinel to absorb
       * these. The card and its triage both rejected that path for the same
       * reason: substituting a plausible range for a value the author got wrong
       * is consumer-side tolerance, and hiding an author error behind a
       * believable render is precisely case 2's disease. An EMPTY list stays an
       * ordinary state with a sentinel; an UNPARSEABLE value is refused.
       */
      const unusableDate = findUnusableGanttDate(items, schema.minDate, schema.maxDate);
      if (unusableDate) {
        return (
          <div className="p-4 text-destructive" data-testid="timeline-unusable-date-range" role="alert">
            {t('timeline.gantt.unusableRange.malformedDate', {
              path: unusableDate.path,
              value: spellGanttDateValue(unusableDate.value),
            })}
          </div>
        );
      }

      // Calculate date range from all items
      const dateRange = calculateDateRange(items);
      const minDate = schema.minDate || dateRange.minDate;
      const maxDate = schema.maxDate || dateRange.maxDate;

      /**
       * objectui#6759 case 2 — the INVERTED range, refused on the same policy.
       *
       * Only a pin can invert it: `calculateDateRange` builds its pair with
       * `Math.min` / `Math.max`, so the computed range is ordered by
       * construction, and the sentinel is a single day. It is the caller's
       * `schema.minDate || dateRange.minDate` resolution — one pinned end, or
       * both — that can put the start after the end.
       *
       * The comparison is `>` on timestamps, deliberately the same test
       * `generateTimeScaleHeaders` makes (`start > end` on two `Date`s, which
       * compares by `valueOf`). Equal is NOT inverted: a degenerate
       * `minDate === maxDate` range is objectui#6750's one-bucket axis and must
       * keep rendering. Measured on this card's base b98352a15:
       *
       *     CASE-2 minDate 2030-01-01 / maxDate 2026-03-15
       *            -> axis: [] bars: ["left: 157.9250720461095%; width: -4.322766570605188%;"]
       */
      if (new Date(minDate).getTime() > new Date(maxDate).getTime()) {
        return (
          <div className="p-4 text-destructive" data-testid="timeline-unusable-date-range" role="alert">
            {t('timeline.gantt.unusableRange.inverted', {
              minDate: spellGanttDateValue(minDate),
              maxDate: spellGanttDateValue(maxDate),
            })}
          </div>
        );
      }

      // Generate time scale headers — the spec `scale` key is the only axis
      // spelling (the `timeScale` alias is retired, objectui#6355); every spec
      // scale produces a header row (#2942).
      const timeHeaders = generateTimeScaleHeaders(
        resolveTimelineScale(schema as { scale?: unknown }),
        minDate,
        maxDate,
        displayLocale,
        t,
      );

      return (
        <TimelineGantt className={cn("overflow-x-auto [-webkit-overflow-scrolling:touch]", className)} {...props}>
          {/* Header */}
          <TimelineGanttHeader>
            <TimelineGanttRowLabels className="flex items-center px-2 sm:px-4 py-2 sm:py-3">
              <span className="font-semibold text-xs sm:text-sm">
                {schema.rowLabel || t('timeline.gantt.rowLabel')}
              </span>
            </TimelineGanttRowLabels>
            <TimelineGanttGrid>
              <div className="flex h-full">
                {timeHeaders.map((header, index) => (
                  <div
                    key={index}
                    className="flex-1 px-1 sm:px-2 py-2 sm:py-3 border-r text-xs font-medium text-center"
                  >
                    {header}
                  </div>
                ))}
              </div>
            </TimelineGanttGrid>
          </TimelineGanttHeader>

          {/* Rows */}
          <div>
            <div className="flex">
              <TimelineGanttRowLabels>
                {items.map((row: any, rowIndex: number) => (
                  <TimelineGanttRow key={rowIndex}>
                    <TimelineGanttLabel title={row.label} className="truncate">
                      {row.label}
                    </TimelineGanttLabel>
                  </TimelineGanttRow>
                ))}
              </TimelineGanttRowLabels>
              <TimelineGanttGrid className="relative">
                {items.map((row: any, rowIndex: number) => (
                  <TimelineGanttRow key={rowIndex} className="relative">
                    {(row.items || []).map((item: any, itemIndex: number) => {
                      const dimensions = calculateBarDimensions(
                        item.startDate,
                        item.endDate,
                        minDate,
                        maxDate
                      );

                      return (
                        <TimelineGanttBar
                          key={itemIndex}
                          start={dimensions.start}
                          width={dimensions.width}
                          variant={item.variant || 'default'}
                          onClick={() => onItemClick?.(item, row, rowIndex, itemIndex)}
                          title={`${item.title || ''}\n${formatDate(item.startDate, dateFormat, displayLocale)} - ${formatDate(item.endDate, dateFormat, displayLocale)}`}
                        >
                          <TimelineGanttBarContent>
                            {item.title}
                          </TimelineGanttBarContent>
                        </TimelineGanttBar>
                      );
                    })}
                  </TimelineGanttRow>
                ))}
              </TimelineGanttGrid>
            </div>
          </div>
        </TimelineGantt>
      );
    }

    return null;
  };

// `skipFallback` — the bare `timeline` key belongs to the OBJECT-BOUND renderer
// (`view:timeline`, registered in `./index`), not to this presentational one
// (objectui#6353).
//
// Both registrations name the same short key. Until this flag existed, both also
// claimed the bare fallback (`Registry.register`, the `meta?.namespace &&
// !meta?.skipFallback` branch), so which renderer answered `type: 'timeline'` was
// decided by which module evaluated LAST — `./index` re-exports this module at its
// line 300, before its own `import` at 307, so this file registered first and was
// then overwritten. The outcome was right and the mechanism was not: swapping those
// two lines would have silently handed `type: 'timeline'` to this renderer, which
// reads none of the object-bound keys, so an authored timeline would stop fetching
// with no error. The registry's own collision guard names this remedy in its warning.
//
// Now the answer is DECLARED: only `view:timeline` claims the bare key, in any
// evaluation order. `plugin-timeline:timeline` stays reachable by its explicit
// namespaced key, which is the lookup a presentational host uses.
// Pinned by `./__tests__/timeline-bare-key-ownership.test.ts`.
ComponentRegistry.register(
  'timeline',
  TimelineRenderer,
  {
    namespace: 'plugin-timeline',
    skipFallback: true,
    label: 'Timeline',
    category: 'data-display',
    inputs: [
      {
        name: 'variant',
        type: 'enum',
        enum: ['vertical', 'horizontal', 'gantt'],
        label: 'Timeline Variant',
        defaultValue: 'vertical',
      },
      {
        name: 'items',
        type: 'array',
        label: 'Timeline Items',
        description:
          'For vertical/horizontal: Array of { time, title, description, variant, icon, content }. For gantt: Array of { label, items: [{ title, startDate, endDate, variant }] }',
      },
      {
        name: 'dateFormat',
        type: 'enum',
        enum: ['short', 'long', 'iso'],
        label: 'Date Format',
        defaultValue: 'short',
      },
      // The designer's axis key is `scale` — the spec's spelling
      // (`ui/TimelineConfig.json`) and, since objectui#6355 retired the
      // `timeScale` alias, the only one `resolveTimelineScale` reads.
      // It offers all six buckets: `hour` / `quarter` / `year` have rendered
      // correctly since #2942 but were offered by neither the designer nor the
      // exported type, so they were authorable and undiscoverable (objectui#6170).
      {
        name: 'scale',
        type: 'enum',
        enum: [...TIMELINE_SCALES],
        label: 'Time Scale (Gantt only)',
        defaultValue: 'month',
      },
      {
        name: 'rowLabel',
        type: 'string',
        label: 'Row Label (Gantt only)',
        defaultValue: 'Items',
      },
      {
        name: 'minDate',
        type: 'string',
        label: 'Min Date (Gantt only)',
        description: 'Override auto-calculated min date (YYYY-MM-DD)',
      },
      {
        name: 'maxDate',
        type: 'string',
        label: 'Max Date (Gantt only)',
        description: 'Override auto-calculated max date (YYYY-MM-DD)',
      },
      { name: 'className', type: 'string', label: 'CSS Class' },
    ],
    defaultProps: {
      variant: 'vertical',
      dateFormat: 'short',
      items: [
        {
          time: '2024-01-15',
          title: 'Project Started',
          description: 'Kickoff meeting and initial planning',
          variant: 'success',
          icon: '🚀',
        },
        {
          time: '2024-02-01',
          title: 'First Milestone',
          description: 'Completed initial design phase',
          variant: 'info',
          icon: '🎨',
        },
        {
          time: '2024-03-15',
          title: 'Beta Release',
          description: 'Released beta version to testers',
          variant: 'warning',
          icon: '⚡',
        },
        {
          time: '2024-04-01',
          title: 'Launch',
          description: 'Official product launch',
          variant: 'success',
          icon: '🎉',
        },
      ],
    },
    examples: {
      vertical: {
        variant: 'vertical',
        dateFormat: 'long',
        items: [
          {
            time: '2024-01-15',
            title: 'Project Started',
            description: 'Kickoff meeting and initial planning',
            variant: 'success',
          },
          {
            time: '2024-02-01',
            title: 'First Milestone',
            description: 'Completed initial design phase',
            variant: 'info',
          },
        ],
      },
      horizontal: {
        variant: 'horizontal',
        dateFormat: 'short',
        items: [
          {
            time: '2024-01-01',
            title: 'Q1',
            description: 'First quarter',
            variant: 'default',
          },
          {
            time: '2024-04-01',
            title: 'Q2',
            description: 'Second quarter',
            variant: 'info',
          },
          {
            time: '2024-07-01',
            title: 'Q3',
            description: 'Third quarter',
            variant: 'warning',
          },
          {
            time: '2024-10-01',
            title: 'Q4',
            description: 'Fourth quarter',
            variant: 'success',
          },
        ],
      },
      gantt: {
        variant: 'gantt',
        dateFormat: 'short',
        scale: 'month',
        rowLabel: 'Projects',
        items: [
          {
            label: 'Backend Development',
            items: [
              {
                title: 'API Design',
                startDate: '2024-01-01',
                endDate: '2024-01-31',
                variant: 'success',
              },
              {
                title: 'Implementation',
                startDate: '2024-02-01',
                endDate: '2024-03-31',
                variant: 'info',
              },
            ],
          },
          {
            label: 'Frontend Development',
            items: [
              {
                title: 'UI Design',
                startDate: '2024-01-15',
                endDate: '2024-02-15',
                variant: 'warning',
              },
              {
                title: 'Component Dev',
                startDate: '2024-02-15',
                endDate: '2024-04-15',
                variant: 'default',
              },
            ],
          },
          {
            label: 'Testing',
            items: [
              {
                title: 'QA Phase',
                startDate: '2024-03-01',
                endDate: '2024-04-30',
                variant: 'danger',
              },
            ],
          },
        ],
      },
    },
  }
);
