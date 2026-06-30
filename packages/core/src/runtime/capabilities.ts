/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Runtime capability gates — opt-in switches a *host* turns on, never the
 * authored metadata. Default-closed: the open-source build ships with every
 * capability off, and an enterprise / private-deployment host explicitly
 * enables the ones it trusts.
 *
 * The motivating case (and currently the only one) is {@link CAP_REACT_PAGES}:
 * `kind:'react'` pages execute author-supplied JavaScript directly in the main
 * React tree (no sandbox). That is safe ONLY under trust — a private deployment
 * whose page authors are trusted and whose changes go through human review
 * (draft-gating, ADR-0033). It must therefore be impossible to turn on by
 * writing a page; only the host process can flip it.
 */

const enabled = new Set<string>();

let _seeded = false;
function seedFromGlobal(): void {
  if (_seeded) return;
  _seeded = true;
  // A host can pre-seed before any bundle code runs by setting a global array,
  // e.g. in its HTML bootstrap: `globalThis.__OBJECTUI_CAPABILITIES__ = ['react-pages']`.
  const g = globalThis as unknown as { __OBJECTUI_CAPABILITIES__?: unknown };
  if (Array.isArray(g.__OBJECTUI_CAPABILITIES__)) {
    for (const c of g.__OBJECTUI_CAPABILITIES__) {
      if (typeof c === 'string') enabled.add(c);
    }
  }
}

/** Turn a capability on. Call from the host process only (not from metadata). */
export function enableCapability(name: string): void {
  seedFromGlobal();
  enabled.add(name);
}

/** Turn a capability off. */
export function disableCapability(name: string): void {
  seedFromGlobal();
  enabled.delete(name);
}

/** Whether a capability is enabled (default false). */
export function isCapabilityEnabled(name: string): boolean {
  seedFromGlobal();
  return enabled.has(name);
}

/**
 * `kind:'react'` — execute trusted author JavaScript (full React: hooks, event
 * handlers, arbitrary JS) directly in the main React tree. Enterprise / private
 * deployment only. Default OFF.
 */
export const CAP_REACT_PAGES = 'react-pages';
