/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c follow-up — the Studio folded layout's side-by-side threshold,
 * extracted from StudioDesignSurface for the same reason {@link
 * ./centerTab} was: the surface itself is far too heavy to mount just to pin a
 * breakpoint, so the rule that decides "canvas beside properties" vs "canvas OR
 * properties as tabs" lives here and is directly testable.
 *
 * The value is deliberately `xl` (1280) and NOT `2xl` (1536) — issue #2477
 * item 3. At `2xl` the common laptop (1280–1512) fell into the tab layout,
 * whose auto-switch hides the canvas the moment you select a block, breaking
 * the WYSIWYG "edit it and watch it apply" loop that is the whole point of the
 * designer. Measured at the 1280 boundary with the chat dock expanded at its
 * 420px default: nav rail 208 (`w-52`) + inspector 288 (`w-72`) + dock 420
 * leaves the canvas ~364px — narrow, but LIVE, which beats hidden; collapsing
 * the dock (a preference that now sticks, item 2) hands the canvas 784px back,
 * and at 1440+ it is comfortable without touching the dock. Below `xl` the tabs
 * remain: there is genuinely no room for three columns plus chat.
 */
import * as React from 'react';

/**
 * Minimum viewport width (px) for the folded layout's side-by-side canvas +
 * properties. Tailwind's `xl`. Changing this back to 1536 (`2xl`) reintroduces
 * the hidden-canvas regression above — the pin in `__tests__/wideViewport.test.tsx`
 * exists to make that a red test rather than a silent UX loss.
 */
export const WIDE_VIEWPORT_BREAKPOINT = 1280;

/**
 * Is the viewport at least {@link WIDE_VIEWPORT_BREAKPOINT} wide? Mirrors
 * `useIsMobile`'s matchMedia idiom: subscribe to the query, but read the
 * authoritative width from `window.innerWidth` so the boundary is inclusive
 * (exactly 1280 IS wide) and consistent across the initial read and updates.
 *
 * Starts `undefined` and resolves in an effect — server/first paint has no
 * viewport, and coercing to `false` there keeps the narrow (tabs) layout as the
 * pre-measurement default rather than flashing a three-column layout it may not
 * have room for.
 */
export function useIsWideViewport(): boolean {
  const [isWide, setIsWide] = React.useState<boolean | undefined>(undefined);
  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${WIDE_VIEWPORT_BREAKPOINT}px)`);
    const onChange = () => setIsWide(window.innerWidth >= WIDE_VIEWPORT_BREAKPOINT);
    mql.addEventListener('change', onChange);
    setIsWide(window.innerWidth >= WIDE_VIEWPORT_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return !!isWide;
}
