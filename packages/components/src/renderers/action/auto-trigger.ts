/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `autoTrigger` — the client-composed "run this action as soon as a renderer
 * receives it" flag (#844), and the ONE implementation of its once-ness (#4162).
 *
 * ## What the flag means
 *
 * A caller (a welcome-page CTA that deep-links into "create", say) marks an
 * action `autoTrigger: true` to have it run once on mount, through the exact
 * same execute path as a click — so param dialogs, confirms and entitlement
 * gates all still apply. It is NOT persisted metadata: the flag only ever
 * exists on client-composed schemas, which makes hosts its only producers.
 *
 * ## Why this lives in a shared module (#4162)
 *
 * It was consumed by `action:button` alone. `action:bar` splits its post-gate
 * list at `maxVisible` (3 desktop, 1 mobile) and hands the tail to
 * `action:menu`, which had no `autoTrigger` handling — so an auto-triggered
 * action that happened to sort past the threshold was rendered as an ordinary
 * "More" menu entry and never ran, while the caller had already spent the
 * one-shot signal it stood for (the #844 deep link is consumed by stripping it
 * from the URL: measured `urlParam=null execute=0`, unrecoverable). Which
 * actions lost their auto-trigger was a function of viewport width.
 *
 * The ruling on that card: **the flag's contract is "execute once on mount by
 * whichever renderer receives the action"**. So every renderer that can receive
 * an action consumes it — by EXECUTING, not by rendering an affordance and
 * hoping — and they all consume it through this hook. Once-ness written twice
 * is two behaviours waiting to drift apart, which is the same shape as the
 * defect being fixed.
 *
 * ## The guard's exact semantics (unchanged from `action:button`'s original)
 *
 * A ref, not state: it must not re-render, and it must survive the identity
 * churn of `schema` / `handleClick`, which change on every parent render. One
 * ref per rendered action, for the lifetime of that action's component, so:
 *
 *   - re-renders never re-fire it;
 *   - a flag that flips true LATER (a state-dependent toolbar attaches it once
 *     entitlements resolve) still fires exactly once, when it flips;
 *   - and it can never fire twice, whatever the flag does afterwards.
 *
 * Container visibility still governs mounting, and that is deliberate: a
 * renderer that returns null before its children mount (an `action:bar` whose
 * own `visible` is false, or a hidden `action:menu`) auto-triggers nothing,
 * because nothing received the action. The action's OWN declared `visible`
 * gate is a different question and does not suppress the trigger — in either
 * renderer, measured: an `action:button` with `visible: false` renders nothing
 * and still executes. That parity is what keeps a deep link from depending on
 * where the bar happened to put the action.
 */

import { useEffect, useRef } from 'react';

/**
 * Is this action asking to be auto-triggered? One spelling of the test, so the
 * flag cannot be read as `!== undefined` in one renderer and `=== true` in
 * another. Deliberately strict: only the literal `true` arms it.
 */
export function hasAutoTrigger(action: unknown): boolean {
  return (action as { autoTrigger?: unknown } | null | undefined)?.autoTrigger === true;
}

/**
 * Run `run` at most once, as soon as `armed` is true.
 *
 * `run` may change identity freely (it is rebuilt from `schema` on most
 * renders); the ref is what makes this once-only, so depending on it is safe.
 */
export function useAutoTriggerOnce(armed: boolean, run: () => void | Promise<void>): void {
  const fired = useRef(false);
  useEffect(() => {
    if (!armed || fired.current) return;
    fired.current = true;
    void run();
  }, [armed, run]);
}
