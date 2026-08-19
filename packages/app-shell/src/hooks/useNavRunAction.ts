/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `useNavRunAction` — the console-side consumer of the DECLARED nav
 * `runAction` slot (`ObjectNavItemSchema.runAction`, objectstack#7253).
 *
 * ## What it consumes
 *
 * `NavigationRenderer.resolveHref` encodes an object nav entry's declared
 * `runAction` as {@link NAV_RUN_ACTION_PARAM} on the list href. When the shell
 * lands on that list, this hook reads the name back through the SAME constant
 * and hands it to the toolbar, which marks the matching action `autoTrigger` so
 * it runs through the ordinary execute path — param dialogs, confirms and
 * entitlement gates all still apply.
 *
 * ## Why this is a hook and not two `window.location` reads (#5216)
 *
 * It replaces a private convention: `EnvironmentListToolbar` used to read a
 * bare `'runAction'` literal off `window.location.search` and compare it to a
 * hard-coded `'create_environment'`, while `CloudOnboardingNext` hand-built the
 * matching query string at the other end. Two literals, no schema, no registry
 * — a second de-facto contract that `objectui validate` could not see and no
 * gate could check. The name now has one definition and the VALUE comes from
 * declared metadata, so the deep link is authored, validated and rendered
 * through one contract.
 *
 * ## Arming is destructive — the #4123 rule, kept
 *
 * Consumption is modelled as "strip the param", so arming SPENDS a one-shot
 * user intent: once stripped, a reload cannot retry it. So the caller passes an
 * `armed` predicate and the hook consumes only when it answers true — i.e. only
 * when there is genuinely something to run. This is also the client's answer to
 * a name no action declares: `defineStack`'s cross-reference walk rejects those
 * at AUTHORING time ("deep-link references action '…' (via runAction)"), and a
 * client that somehow arrives holding one runs nothing AND leaves the URL
 * alone, so a later mount with fresher metadata can still honour it. Degrading
 * quietly is right here precisely because the loud rejection already happened
 * upstream, where the author could act on it.
 *
 * Router-free on purpose (`window.location` + `history.replaceState`): the
 * toolbars that call this also render in tests and hosts without a Router, and
 * the param is a one-shot signal rather than navigation state.
 */

import { useEffect, useRef, useState } from 'react';
import { NAV_RUN_ACTION_PARAM } from '@object-ui/layout';

/**
 * Read the declared deep link once, and consume it once `armed` says something
 * can act on it.
 *
 * @param armed Called with the requested action name; return `true` only when
 *   that action is actually present and runnable on this surface. Returning
 *   `false` leaves the URL untouched — the intent stays recoverable.
 * @returns The requested action name while it is armed and unconsumed, else
 *   `null`. Callers use it to mark exactly that action `autoTrigger: true`.
 */
export function useNavRunAction(armed: (requested: string) => boolean): string | null {
  // Read at mount, from the URL as it was on arrival. `useState`'s initializer
  // (not a ref assignment) so a re-render caused by the strip below cannot
  // re-read an already-emptied search string and lose the name mid-flight.
  const [requested] = useState<string | null>(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get(NAV_RUN_ACTION_PARAM);
      return raw && raw !== '' ? raw : null;
    } catch {
      return null;
    }
  });
  const consumed = useRef(false);
  const shouldRun = requested !== null && !consumed.current && armed(requested);
  useEffect(() => {
    if (!shouldRun) return;
    consumed.current = true;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(NAV_RUN_ACTION_PARAM);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      /* URL cleanup is cosmetic — never fail the trigger over it */
    }
  }, [shouldRun]);
  return shouldRun ? requested : null;
}

/**
 * Build a list-surface deep link that runs `actionName` on arrival.
 *
 * For the one producer that is NOT a nav item: a page widget whose target route
 * came from page metadata rather than from a `NavigationItem` (see
 * `CloudOnboardingNext`). It still goes through {@link NAV_RUN_ACTION_PARAM},
 * so there is no second spelling of the wire format — only a second, equally
 * declared, source for the action NAME.
 */
export function navRunActionHref(route: string, actionName: string): string {
  if (!actionName) return route;
  const sep = route.includes('?') ? '&' : '?';
  return `${route}${sep}${NAV_RUN_ACTION_PARAM}=${encodeURIComponent(actionName)}`;
}
