/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * useMonacoFallback — decide between the Monaco editor and a plain-textarea
 * fallback for the metadata designer's code surfaces (JSON source tab,
 * html/react page source).
 *
 * Monaco's core is fetched lazily from a public CDN (jsdelivr) and spins up
 * web workers. On offline / air-gapped / CSP-restricted installs — and the
 * console is explicitly meant to embed in ANY ObjectStack server, many of
 * which ship a strict CSP — that fetch fails. We detect it two ways:
 *
 *  - **Fast path:** `loader.init()` rejects the moment the CDN loader script
 *    fails to load, so we flip to the textarea immediately instead of making
 *    the user stare at Monaco's own "Loading…" for the full grace period
 *    (previously a hard-coded 4s of dead air on every CSP-blocked install).
 *  - **Backstop:** some failures still resolve the loader but paint nothing
 *    (e.g. blocked workers). A one-shot DOM poll after `fallbackDelayMs`
 *    checks for a rendered `.view-line` row and falls back if the editor
 *    mounted empty.
 *
 * `loader.init()` is an idempotent singleton, so calling it from multiple
 * editors (and alongside `<Editor>`'s own internal init) is safe — every
 * caller observes the same resolution.
 *
 * Returns `[unavailable, containerRef]`; attach `containerRef` to the element
 * that wraps the Monaco instance so the backstop can inspect it.
 */

import * as React from 'react';
import { loader } from '@monaco-editor/react';

export function useMonacoFallback(
  fallbackDelayMs = 4000,
): readonly [boolean, React.RefObject<HTMLDivElement | null>] {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [unavailable, setUnavailable] = React.useState(false);

  // Fast fail: the CDN loader script errored (offline / CSP). Optional-chained
  // so a test that mocks '@monaco-editor/react' without a `loader` export
  // simply skips the fast path and relies on the DOM-poll backstop.
  React.useEffect(() => {
    if (unavailable) return;
    let cancelled = false;
    const init = loader?.init?.();
    if (init && typeof init.catch === 'function') {
      init.catch(() => {
        if (!cancelled) setUnavailable(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [unavailable]);

  // Backstop: Monaco resolved but painted nothing (blocked workers, etc.).
  React.useEffect(() => {
    if (unavailable) return;
    const id = setTimeout(() => {
      const el = containerRef.current;
      if (!el || !el.querySelector('.view-line')) setUnavailable(true);
    }, fallbackDelayMs);
    return () => clearTimeout(id);
  }, [unavailable, fallbackDelayMs]);

  return [unavailable, containerRef] as const;
}
