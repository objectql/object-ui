/**
 * ObjectUI — list-view vocabulary canonicalization
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/** ListView's toolbar density vocabulary — three steps, not the spec's five. */
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

/** The spec's `RowHeightSchema` vocabulary. */
export type RowHeight = 'compact' | 'short' | 'medium' | 'tall' | 'extra_tall';

/**
 * `densityMode` → `rowHeight`. The two vocabularies are not the same size: the
 * spec has five row heights, ListView's toolbar offers three. Widening maps
 * each density onto the spec value the renderer already resolves it back to
 * (see {@link ROW_HEIGHT_TO_DENSITY_MODE}), so a fold followed by a read is a
 * round trip — `spacious` → `tall` → `spacious`.
 */
export const DENSITY_MODE_TO_ROW_HEIGHT: Record<DensityMode, RowHeight> = {
  compact: 'compact',
  comfortable: 'medium',
  spacious: 'tall',
};

/**
 * `rowHeight` → `densityMode`, the read direction. Narrowing five values onto
 * three is lossy by construction: `short` collapses into `compact` and
 * `extra_tall` into `spacious`. Exported so the renderer and the persistence
 * layer agree on the collapse instead of each hard-coding its own table.
 */
export const ROW_HEIGHT_TO_DENSITY_MODE: Record<RowHeight, DensityMode> = {
  compact: 'compact',
  short: 'compact',
  medium: 'comfortable',
  tall: 'spacious',
  extra_tall: 'spacious',
};

/**
 * Tolerant reader for {@link ROW_HEIGHT_TO_DENSITY_MODE}. View metadata is
 * user-authored, so `rowHeight` is not guaranteed to be one of the five spec
 * values — an unknown one lands on `comfortable` rather than rendering an
 * undefined density. Keeping the fallback here means every surface collapses
 * the same way.
 */
export function rowHeightToDensityMode(rowHeight: unknown): DensityMode {
  if (typeof rowHeight === 'string' && rowHeight in ROW_HEIGHT_TO_DENSITY_MODE) {
    return ROW_HEIGHT_TO_DENSITY_MODE[rowHeight as RowHeight];
  }
  return 'comfortable';
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Legacy toolbar-visibility flags → their `userActions` key (#2890 scope A
 * step 3). The spec documents `userActions` as "which interactive actions are
 * available to users in the view toolbar", and already carries `rowHeight` —
 * objectui's `showDensity` under its spec name. `group` / `hideFields` /
 * `rowColor` are the same kind of toggle and are named after the config key
 * they gate (`grouping`, `hiddenFields`, `rowColor`), pending promotion into
 * `UserActionsConfigSchema` upstream.
 */
const SHOW_FLAG_TO_USER_ACTION: Record<string, string> = {
  showSearch: 'search',
  showSort: 'sort',
  showFilters: 'filter',
  showDensity: 'rowHeight',
  showGroup: 'group',
  showHideFields: 'hideFields',
  showColor: 'rowColor',
};

/**
 * Legacy `sharing.visibility` → the spec's `ViewSharing.type`. The spec models
 * two ownership kinds; objectui's four-value audience enum collapses onto them:
 * only `private` is personal, everything wider is collaborative.
 */
const VISIBILITY_TO_SHARING_TYPE: Record<string, 'personal' | 'collaborative'> = {
  private: 'personal',
  team: 'collaborative',
  organization: 'collaborative',
  public: 'collaborative',
};

/** Legacy ARIA spellings → the spec's `AriaProps` keys. */
const ARIA_KEY_ALIASES: Record<string, string> = {
  label: 'ariaLabel',
  describedBy: 'ariaDescribedBy',
};

/**
 * ObjectUI's `list-view` node historically used a different vocabulary from
 * `@objectstack/spec` for the same concepts (`fields` where the spec says
 * `columns`, `viewType` where it says `type`, …). Issue #2231 closed the
 * type-level fork; #2890 closes the vocabulary fork.
 *
 * Stored view metadata in user databases still carries the legacy keys, so the
 * renderer cannot simply stop accepting them. Per AGENTS.md Commandment #0.1 the
 * answer is NOT a per-read-site `??` fallback — those fossilize a second de-facto
 * contract and drift apart (they already had: `ObjectGrid` preferred `columns`
 * in one branch and `fields` in another). Instead legacy acceptance lives HERE,
 * in one documented normalizer at the component boundary, mirroring
 * `normalizeSchemaReferenceKeys` (object schemas) and the spec's own
 * `normalizeVisibleWhen` / `normalizeFilterOperator` migration bridges.
 *
 * Note this cannot be a `z.preprocess` on `ListViewSchema`: nothing on the
 * render path parses view metadata through zod (the zod schemas are used by the
 * CLI validator, the VS Code extension and tests only), so a schema-level fold
 * would never run. The guarantee comes from the call site instead — `ListView`
 * normalizes before it reads anything.
 *
 * The fold is deliberately one-directional: the canonical key wins when both are
 * present, and the legacy key is REMOVED from the result so a read-site that was
 * missed fails loudly instead of quietly taking the legacy path. Like a spec
 * migration bridge, this is expected to be dropped in a future major once stored
 * metadata has been migrated.
 *
 * Non-mutating and allocation-frugal: returns the input by reference when there
 * is nothing to fold, so `ListView`'s downstream `useMemo`s keep a stable
 * dependency identity on the common (already-canonical) path.
 *
 * Currently folded:
 *  - `fields` → `columns` (#2890 scope A step 1)
 *  - `densityMode` → `rowHeight` (#2890 scope A step 2)
 *  - the `show*` toolbar flags → `userActions` (#2890 scope A step 3), and
 *    `showDescription` → `appearance.showDescription`. The canonical key wins
 *    per-flag, so a view may carry `userActions` for some toggles and a legacy
 *    flag for others. NOTE the fold does not apply any default: an absent flag
 *    stays absent, because the defaults are per-toggle (search/sort/filter/
 *    rowHeight/group default ON, hideFields/rowColor default OFF) and belong to
 *    the renderer, not to the vocabulary bridge.
 *  - `aria: { label, describedBy }` → the spec's `AriaProps`
 *    (`{ ariaLabel, ariaDescribedBy }`), and `sharing: { visibility, enabled }`
 *    → the spec's `ViewSharing` (`{ type }`) — #2890 scope A step 5. `aria.live`
 *    survives untouched: it has no spec counterpart.
 *  - `filters` → `filter` (#2890 scope A step 4). A key rename only: BOTH keys
 *    carry an ObjectQL FilterNode array (`[['stage','=','won']]`) everywhere in
 *    objectui — every consumer passes the value straight to `$filter`. The spec
 *    types `filter` as `ViewFilterRule[]` (`{field, operator, value}` objects),
 *    so objectui's field is typed from the spec but used as something else.
 *    That mismatch is real and out of scope here; converting formats inside a
 *    vocabulary fold would change what reaches the data source.
 *  - `viewType`: a missing kind, or the view CATEGORY `'list'` that AI-authored
 *    metadata stores and hosts forward verbatim, becomes the renderable `'grid'`
 *    — otherwise it reaches the renderer's typeless default branch and shows as
 *    a red "Unknown component type" box.
 */
export function normalizeListViewSchema<T>(schema: T): T {
  if (!schema || typeof schema !== 'object') return schema;
  const s = schema as Record<string, unknown>;

  const legacyFields = s.fields;
  const foldColumns = Array.isArray(legacyFields);
  const legacyDensity = s.densityMode;
  const foldRowHeight = typeof legacyDensity === 'string' && legacyDensity in DENSITY_MODE_TO_ROW_HEIGHT;
  const legacyFilters = s.filters;
  const foldFilter = Array.isArray(legacyFilters);
  const legacyFlags = Object.keys(SHOW_FLAG_TO_USER_ACTION).filter((k) => typeof s[k] === 'boolean');
  const foldDescription = typeof s.showDescription === 'boolean';
  const aria = isRecord(s.aria) ? s.aria : undefined;
  const foldAria = !!aria && Object.keys(ARIA_KEY_ALIASES).some((k) => aria[k] !== undefined);
  const sharing = isRecord(s.sharing) ? s.sharing : undefined;
  const foldSharing = !!sharing && (sharing.visibility !== undefined || sharing.enabled !== undefined);
  const viewType = s.viewType;
  const defaultViewKind = !viewType || viewType === 'list';
  if (
    !foldColumns && !foldRowHeight && !foldFilter && !legacyFlags.length &&
    !foldDescription && !foldAria && !foldSharing && !defaultViewKind
  ) {
    return schema;
  }

  const next: Record<string, unknown> = { ...s };
  if (foldColumns) {
    if (!Array.isArray(next.columns)) next.columns = legacyFields;
    delete next.fields;
  }
  if (foldRowHeight) {
    if (typeof next.rowHeight !== 'string') {
      next.rowHeight = DENSITY_MODE_TO_ROW_HEIGHT[legacyDensity as DensityMode];
    }
    delete next.densityMode;
  }
  if (foldFilter) {
    if (!Array.isArray(next.filter)) next.filter = legacyFilters;
    delete next.filters;
  }
  if (legacyFlags.length) {
    const ua: Record<string, unknown> = { ...(isRecord(next.userActions) ? next.userActions : {}) };
    for (const flag of legacyFlags) {
      const key = SHOW_FLAG_TO_USER_ACTION[flag];
      if (typeof ua[key] !== 'boolean') ua[key] = s[flag];
      delete next[flag];
    }
    next.userActions = ua;
  }
  if (foldDescription) {
    const appearance: Record<string, unknown> = {
      ...(isRecord(next.appearance) ? next.appearance : {}),
    };
    if (typeof appearance.showDescription !== 'boolean') {
      appearance.showDescription = s.showDescription;
    }
    delete next.showDescription;
    next.appearance = appearance;
  }
  if (foldAria && aria) {
    const nextAria: Record<string, unknown> = { ...aria };
    for (const [legacy, canonical] of Object.entries(ARIA_KEY_ALIASES)) {
      if (nextAria[canonical] === undefined && aria[legacy] !== undefined) {
        nextAria[canonical] = aria[legacy];
      }
      delete nextAria[legacy];
    }
    next.aria = nextAria;
  }
  if (foldSharing && sharing) {
    const nextSharing: Record<string, unknown> = { ...sharing };
    if (nextSharing.type === undefined) {
      const visibility = typeof sharing.visibility === 'string' ? sharing.visibility : undefined;
      // `enabled: true` with no audience is under-specified legacy input. It
      // used to render the share badge titled "private", so it maps to
      // `personal` — preserving what the user saw rather than adopting the
      // spec's `collaborative` default and silently relabeling the badge.
      const resolved = visibility
        ? VISIBILITY_TO_SHARING_TYPE[visibility]
        : sharing.enabled === true
          ? 'personal'
          : undefined;
      if (resolved) nextSharing.type = resolved;
    }
    delete nextSharing.visibility;
    delete nextSharing.enabled;
    next.sharing = nextSharing;
  }
  if (defaultViewKind) next.viewType = 'grid';
  return next as T;
}
