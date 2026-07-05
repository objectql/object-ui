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
];
