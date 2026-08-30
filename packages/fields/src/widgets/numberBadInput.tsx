/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useCallback, useState } from 'react';

/**
 * ONE reading of "this box is showing text the browser cannot read", shared by
 * every `type="number"` widget in this package (objectui#6780).
 *
 * ## The defect this closes
 *
 * A `type="number"` box can DISPLAY one thing and hold another, with nothing
 * said. Measured on Chromium 141.0.7390.37 (Playwright 1.62.1), typing `1e`
 * into an empty number input:
 *
 * ```
 * .value            = ""            <- what every widget here reads
 * validity.badInput = true          <- what the browser actually thinks
 * pixels vs an untouched box: DIFFERENT   <- the box IS still showing `1e`
 * ```
 *
 * So the widget emitted `null`, `aria-invalid` stayed `"false"`, and no
 * diagnostic was drawn: objectui#6716's silent-refusal class, on a money field.
 *
 * ## Why `validity.badInput` and not a regex of our own
 *
 * It is the PLATFORM's own predicate — the browser stating, in its own words,
 * whether it can read the text — rather than a second renderer-side dialect of
 * "what a number is" (AGENTS.md #0.1).
 *
 * ⚠️ objectui#6765 recorded `badInput` as "the ONE signal happy-dom and Chromium
 * agree on". objectui#6780 measured that and NARROWED it, because the
 * difference decides which strings a unit test may drive: in Chromium
 * `badInput` is never true for a programmatic `.value` write (it reports that
 * the UA cannot read the USER's input), so on the only route a happy-dom test
 * has, the two engines agree on nothing. The agreement this guard rests on is
 * between happy-dom's programmatic verdict and Chromium's TYPED verdict, and it
 * holds for a measured subset — four strings agree on "bad", seven agree on
 * "fine", and eight disagree. The full matrix, and the lists the tests are
 * allowed to use, are in `__tests__/numberInputBrowserReadings.ts`.
 *
 * ⭐ And it is NOT objectui#6715's anchored guard wearing a different hat.
 * That one was measured to be a provable no-op here — it rejects only strings
 * this test environment fabricates. This one fires on keyboard-reachable
 * states, MEASURED in Chromium by typing each key by key into an empty box:
 *
 * ```
 * typed "1e"  "1e-"  "1e+"  "-"  "."  "+"  "-."  "e"  "5e"   -> badInput TRUE
 * typed "1."  "1e5"  "1.2.3"  "0x10"  "12abc"                -> badInput false
 * ```
 *
 * and never on anything the browser can actually emit: `12`, `1.23`, `010`,
 * `15`, `1`, `12.345` all read `badInput === false`.
 *
 * ## ⛔ What this deliberately does NOT do: change what is emitted
 *
 * objectui#6716's shape REFUSES (its `onChange` never fires and the prior value
 * stands). Here that would destroy the very text the diagnostic points at, so
 * these widgets keep emitting exactly what they emitted before and only stop
 * being silent about it. MEASURED, in both halves:
 *
 *  - Chromium: after typing `1e`, a script write of `.value` clears the raw
 *    display and flips `badInput` back to `false` — even writing `""`.
 *  - React 19.2.8's own `updateInput` (`react-dom/cjs/react-dom-client.
 *    development.js`) restores a number input with
 *    `if ((0 === value && "" === element.value) || element.value != value)
 *    element.value = "" + getToStringValue(value);`
 *
 * So for a box that already held `5`, refusing leaves `props.value` at `5`,
 * `element.value` at `""`, and React writes `"5"` back — wiping the `5e` the
 * user is looking at and the message is about. Emitting keeps `props.value` at
 * `""`, the write is skipped, and the raw text survives, which is what
 * objectui#6716 requires of a refusal ("keeps the refused text in the box, so
 * the message has something to point at").
 *
 * ⚠️ The text itself is NOT quotable. The browser displays it but never exposes
 * it — `.value` is `""` and there is no other channel — so unlike
 * objectui#6715's residue message this one cannot name what was typed. It
 * points at the box instead.
 */

/** The one sentence, in objectui#6716's `Not saved: …` shape. */
export function badInputMessage(example: string): string {
  return `Not saved: the text in this box is not a number. Enter a plain decimal (example: ${example}).`;
}

/**
 * The widget's OWN refusal state, and the reader that fills it.
 *
 * Named `refusal`, never `error`: `error` is the published validation slot on
 * the widget contract (objectui#3222) with exactly one author, the form
 * renderer. This is the widget's own reading, which no host can produce — the
 * same two-name split `LocationField` uses (objectui#6716).
 *
 * `readBadInput` is called from BOTH arms, because neither alone sees every
 * route (MEASURED in Chromium):
 *
 *  - TYPED `1e` into an empty box fires 2 `input` events — the `e` keystroke
 *    moves `.value` from `"1"` to `""`, so React does deliver an `onChange`.
 *  - PASTED `1e` into an empty box fires 1 `input` event, but `.value` never
 *    leaves `""`; React's own input-value tracking suppresses the synthetic
 *    `onChange`, so the CHANGE arm never runs. Blur fires, and `badInput` is
 *    still `true` at blur time — which is the whole reason for the blur arm.
 */
export function useBadInputRefusal(example: string) {
  const [refusal, setRefusal] = useState<string | null>(null);
  const readBadInput = useCallback(
    (target: HTMLInputElement | null | undefined): boolean => {
      const bad = target?.validity?.badInput === true;
      // Setting the same value is a React bail-out, so the good path costs no
      // extra render.
      setRefusal(bad ? badInputMessage(example) : null);
      return bad;
    },
    [example],
  );
  return { refusal, readBadInput };
}

/**
 * The drawn diagnostic — objectui#6716's exact markup, in one spelling so the
 * four widgets of this class cannot drift apart.
 */
export function BadInputMessage({ refusal }: { refusal: string | null }) {
  if (!refusal) return null;
  return <p className="text-xs text-red-500">{refusal}</p>;
}

/** The class that marks the refused control, in one spelling. */
export const BAD_INPUT_BORDER = 'border-red-500 focus-visible:ring-red-500';
