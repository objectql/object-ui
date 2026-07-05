/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * urlParams — the single registry of RESERVED console URL query params
 * (objectui#2269 P3; ADR-0054 C3 "URL-addressable state").
 *
 * These params form the console's cross-route URL contract: they are read
 * and written by app-shell chrome (overlays, record surfaces, tabs) and must
 * never be repurposed by a page/view for something else. Every reader/writer
 * imports the constant from here — no string literals — so the contract has
 * ONE definition, collisions are caught at review time, and an AI author
 * (north star: all metadata is AI-authored) has a single place to learn it.
 *
 * | Param       | Meaning                                        | History      |
 * |-------------|------------------------------------------------|--------------|
 * | `recordId`  | Record detail DRAWER over a list (light        | push (open)  |
 * |             | objects; heavy ones use the `/record/:id`      |              |
 * |             | route instead). URL is the drawer's source of  |              |
 * |             | truth.                                         |              |
 * | `form`      | The global record-form overlay: `new` = create,|              |
 * |             | a record id = edit (framework#2604 D1/D2).     | push (open), |
 * |             | Back closes the overlay.                       | replace (close) |
 * | `formObject`| Child-task override for `form`: the object the |              |
 * |             | overlay edits when it is NOT the route's       | with `form`  |
 * |             | object (subtable child over a parent detail,   |              |
 * |             | framework#2604 D3).                            |              |
 * | `formLink`  | `"<fkField>:<parentId>"` — create-mode parent  |              |
 * |             | pre-link for a child task; refresh-safe.       | with `form`  |
 * | `tab`       | Active record-detail tab (stable semantic      | replace      |
 * |             | values: `details` / `related:<child>` /        |              |
 * |             | `related` / `activity` / `history`,            |              |
 * |             | objectui#2257). Never stacks history.          |              |
 * | `palette`   | Command palette overlay (alias `cmdk`).        | replace      |
 * | `shortcuts` | Keyboard-shortcuts dialog overlay.             | replace      |
 * | `from`      | Ancestor breadcrumb trail for a record route,  | push (with   |
 * |             | so drilling record→related-record keeps a      | the drill-in) |
 * |             | clickable path back (`Account → #p → Invoice`).|              |
 *
 * Push-vs-replace rule of thumb: an overlay the user OPENED (form, drawer)
 * pushes one entry so browser Back closes it; passive state that tracks an
 * in-page selection (tab) or transient chrome (palette) replaces, so Back
 * never pages through it.
 *
 * Page-scoped params (`q`, `limit`, `offset`, `view`, `type`, `review`,
 * `package`, …) belong to their page's own contract and are NOT reserved
 * here — but they must not collide with the names above.
 */

/** Record detail drawer over a list (`?recordId=<id>`). */
export const RECORD_DRAWER_PARAM = 'recordId';

/** Global record-form overlay: `new` | `<recordId>` (framework#2604). */
export const RECORD_FORM_PARAM = 'form';

/** Child-task object override for the record-form overlay (#2604 D3). */
export const RECORD_FORM_OBJECT_PARAM = 'formObject';

/** Child-task parent pre-link `"<fkField>:<parentId>"` (#2604 D3). */
export const RECORD_FORM_LINK_PARAM = 'formLink';

/** Active record-detail tab (objectui#2257; stable semantic values). */
export const RECORD_DETAIL_TAB_PARAM = 'tab';

/** Command palette overlay (ADR-0054 Phase 1; alias `cmdk`). */
export const COMMAND_PALETTE_PARAM = 'palette';

/** Keyboard-shortcuts dialog overlay. */
export const KEYBOARD_SHORTCUTS_PARAM = 'shortcuts';

/**
 * Ancestor breadcrumb trail for a record route (`?from=<encoded trail>`).
 * When you drill from one record into a related child record (e.g. an
 * account → one of its invoices), the child URL carries the ancestors that
 * led here so the top-bar breadcrumb can render them as clickable segments
 * (`Account → #parent → Invoice → #child`) and the record body can show an
 * inline "← back to parent" link. Refresh- and share-safe (URL, not history
 * state). Value is a JSON array of {@link RecordTrailEntry}; use
 * {@link encodeRecordTrail} / {@link decodeRecordTrail} / {@link appendRecordTrail}
 * rather than reading it raw.
 */
export const RECORD_TRAIL_PARAM = 'from';

/**
 * All reserved params, for collision checks (e.g. a lint or a dev-time
 * assertion that a page-scoped param doesn't shadow the console contract).
 */
export const RESERVED_URL_PARAMS: readonly string[] = [
  RECORD_DRAWER_PARAM,
  RECORD_FORM_PARAM,
  RECORD_FORM_OBJECT_PARAM,
  RECORD_FORM_LINK_PARAM,
  RECORD_DETAIL_TAB_PARAM,
  COMMAND_PALETTE_PARAM,
  KEYBOARD_SHORTCUTS_PARAM,
  RECORD_TRAIL_PARAM,
];

/**
 * One ancestor in a record breadcrumb trail (see {@link RECORD_TRAIL_PARAM}).
 * Kept intentionally terse — this rides in the URL, so short keys keep it
 * compact: `o` = object name, `i` = record id, `t` = display title (optional;
 * falls back to a shortened id when absent).
 */
export interface RecordTrailEntry {
  /** Object (table) name of the ancestor record. */
  o: string;
  /** Primary-key id of the ancestor record. */
  i: string;
  /** Human-readable title, truncated. Optional — id is the fallback. */
  t?: string;
}

/** Cap trail depth so deeply-nested drill-ins can't grow the URL unbounded. */
const MAX_TRAIL_DEPTH = 8;
/** Cap per-entry title length so one long name can't bloat the URL. */
const MAX_TRAIL_TITLE = 48;

/**
 * Parse the raw `?from=` value into a validated trail (outermost ancestor
 * first). Returns `[]` for missing/malformed input — a broken trail must
 * never throw or break the page; it just yields no ancestor breadcrumbs.
 */
export function decodeRecordTrail(raw: string | null | undefined): RecordTrailEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is RecordTrailEntry =>
          !!e && typeof e.o === 'string' && e.o.length > 0 && typeof e.i === 'string' && e.i.length > 0,
      )
      .slice(-MAX_TRAIL_DEPTH)
      .map((e) => ({
        o: e.o,
        i: e.i,
        ...(typeof e.t === 'string' && e.t.trim() ? { t: e.t.trim().slice(0, MAX_TRAIL_TITLE) } : {}),
      }));
  } catch {
    return [];
  }
}

/**
 * Serialize a trail into the string stored under `?from=`. Callers pass the
 * result to `URLSearchParams.set`, which handles percent-encoding.
 */
export function encodeRecordTrail(trail: RecordTrailEntry[]): string {
  return JSON.stringify(trail.slice(-MAX_TRAIL_DEPTH));
}

/**
 * Append the current record to an existing raw trail, producing the value to
 * store under `?from=` when navigating into a child record. Dedupes a trailing
 * self-reference (re-entering the same record shouldn't stack duplicate
 * crumbs) and caps depth.
 */
export function appendRecordTrail(
  rawCurrent: string | null | undefined,
  entry: RecordTrailEntry,
): string {
  const trail = decodeRecordTrail(rawCurrent);
  const last = trail[trail.length - 1];
  if (!last || last.o !== entry.o || last.i !== entry.i) {
    trail.push({
      o: entry.o,
      i: entry.i,
      ...(entry.t && entry.t.trim() ? { t: entry.t.trim().slice(0, MAX_TRAIL_TITLE) } : {}),
    });
  }
  return encodeRecordTrail(trail);
}

/**
 * Build the `/apps/:app/:object/record/:id` href for one ancestor in a trail,
 * carrying the ancestors that precede it so clicking that breadcrumb lands on
 * the ancestor record with ITS own trail intact.
 */
export function buildRecordTrailHref(
  baseAppUrl: string,
  entry: RecordTrailEntry,
  ancestorsBefore: RecordTrailEntry[],
): string {
  const url = `${baseAppUrl}/${entry.o}/record/${encodeURIComponent(entry.i)}`;
  if (ancestorsBefore.length === 0) return url;
  const sp = new URLSearchParams();
  sp.set(RECORD_TRAIL_PARAM, encodeRecordTrail(ancestorsBefore));
  return `${url}?${sp.toString()}`;
}
