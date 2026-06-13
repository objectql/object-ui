/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * URL persistence for end-user filter selections (ADR-0047).
 *
 * Selections live in `uf_<field>` search params (comma-joined values,
 * each URI-encoded so literal commas survive); the active tab preset is
 * carried as `uf__tab=<tabId>` via the reserved `_tab` key. Mirroring the
 * state into the URL makes filter selections survive a reload and makes
 * filtered lists shareable as links — Airtable Interfaces parity.
 */

const PREFIX = 'uf_';

/** Read `uf_*` params into the UserFilters `initialSelections` shape. */
export function parseUserFilterParams(
  searchParams: URLSearchParams,
): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  searchParams.forEach((value, key) => {
    if (key.startsWith(PREFIX) && value !== '') {
      const field = key.slice(PREFIX.length);
      out[field] = value.split(',').map(v => {
        try { return decodeURIComponent(v); } catch { return v; }
      });
    }
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Mirror a selections payload into a copy of the given params. Only the
 * fields present in `selections` are touched — empty value lists delete
 * their param. Returns the next URLSearchParams (caller decides replace).
 */
export function applyUserFilterParams(
  prev: URLSearchParams,
  selections: Record<string, Array<string | number | boolean>>,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const [field, values] of Object.entries(selections)) {
    const key = PREFIX + field;
    if (values && values.length > 0) {
      next.set(key, values.map(v => encodeURIComponent(String(v))).join(','));
    } else {
      next.delete(key);
    }
  }
  return next;
}
