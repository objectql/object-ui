/**
 * ObjectUI — list-view vocabulary canonicalization
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RowHeight } from '@objectstack/spec/ui';

import { normalizeColumnIdentities } from './column-identity.js';

/** ListView's toolbar density vocabulary — three steps, not the spec's five. */
export type DensityMode = 'compact' | 'comfortable' | 'spacious';

/**
 * The spec's `RowHeightSchema` vocabulary — **re-exported, not re-declared**.
 *
 * The hand-written union that used to sit here already advertised itself as
 * "the spec's `RowHeightSchema` vocabulary" in its doc comment, which is the
 * failure class objectstack#4115 is about: the claim was true when written and
 * nothing would have caught the day it stopped being true. The maps below are
 * `Record<RowHeight, …>`, so a spec-side addition now fails the build here
 * instead of silently leaving a row height with no density mapping.
 */
export type { RowHeight };

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
 * Runtime reader for {@link ROW_HEIGHT_TO_DENSITY_MODE}: the spec's five row
 * heights narrowed onto the renderer's three densities, and **nothing else**.
 *
 * The parameter stays `unknown` because this is the boundary user-authored view
 * metadata actually crosses — `ListViewSchema.rowHeight` is statically a
 * `RowHeight`, but the value arrives from stored view definitions TypeScript
 * never saw (`ObjectView`: `viewDef.rowHeight ?? listSchema.rowHeight`). The
 * type-level half of the guarantee is the `Record<RowHeight, …>` on the table
 * above, which fails the build when the spec grows a row height.
 *
 * An off-spec value gets NO density (objectui#4440). It used to be coerced to
 * `comfortable`, which is the opposite of what `@object-ui/react`'s spec bridge
 * answers for the same string after objectui#4352 — one metadata-driven system
 * holding two answers for one input. AGENTS.md #0.1 decides which one survives:
 * a renderer-side rehabilitation of off-spec metadata is a second de-facto
 * contract, and one strict contract beats N. The producer is where a bad
 * `rowHeight` gets fixed.
 *
 * Callers apply their own "nothing was said" default to `undefined`, so an
 * off-spec row height now renders exactly like an absent one — `'compact'` in
 * both `ListView` and `ObjectGrid`.
 *
 * `hasOwnProperty`, not `in`: `in` walks the prototype chain, so `'toString'`
 * used to come back as `Object.prototype.toString` — a FUNCTION returned from
 * something typed `DensityMode`.
 */
export function rowHeightToDensityMode(rowHeight: unknown): DensityMode | undefined {
  if (typeof rowHeight !== 'string') return undefined;
  if (!Object.prototype.hasOwnProperty.call(ROW_HEIGHT_TO_DENSITY_MODE, rowHeight)) {
    return undefined;
  }
  return ROW_HEIGHT_TO_DENSITY_MODE[rowHeight as RowHeight];
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
 * Per-view-type config aliases → the spec key each one aliases (#2890, the
 * phase-3 carry-over).
 *
 * Phase 3 derived `kanban` / `gallery` / `timeline` from the spec configs but
 * kept the pre-#2231 objectui spellings declared alongside the spec keys so
 * stored view metadata would keep validating
 * (`packages/types/src/zod/objectql.zod.ts`, each marked `@deprecated legacy
 * alias for the spec's X`). Folding them here is what lets a read-site stop
 * carrying its own `canonical || legacy` pair — the same move A1–A5 made for
 * the top-level vocabulary.
 *
 * `calendar` is deliberately absent: its one local key, `defaultView`, is not
 * an alias of anything. It has no spec counterpart at all, so it wants
 * PROMOTION upstream, not a rename — folding it would delete an authored value
 * with nowhere to put it.
 *
 * Note `kanban.columns` is the spec's "fields shown on each card", NOT the
 * table columns that the same word names at the ListView top level. The fold
 * is scoped to the nested config, so the two never meet.
 */
const PER_VIEW_CONFIG_ALIASES: Record<string, Readonly<Record<string, string>>> = {
  kanban: { groupField: 'groupByField', cardFields: 'columns' },
  gallery: { imageField: 'coverField' },
  timeline: { dateField: 'startDateField' },
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
 *  - each `columns` entry's IDENTITY — `name` / `fieldName` → the spec's `field`
 *    (#3104). This one MIRRORS instead of deleting, for the reason given on
 *    {@link normalizeColumnIdentities}: `columns` entries cross the package
 *    boundary into host renderers, so dropping `name` from under them is a
 *    breaking change with no inventory. Runs AFTER the `fields` → `columns` fold
 *    above, so a view that spells its column list the legacy way still gets its
 *    entries canonicalized.
 *  - the four PER-VIEW-TYPE config aliases phase 3 carried over
 *    ({@link PER_VIEW_CONFIG_ALIASES}): `kanban.groupField` → `groupByField`,
 *    `kanban.cardFields` → `columns`, `gallery.imageField` → `coverField`,
 *    `timeline.dateField` → `startDateField`. One read-site changes behaviour
 *    as a result, and it is a CORRECTION of the same inverted precedence A2
 *    fixed for `densityMode`: `ListView`'s kanban adapter resolves
 *    `cardFields || columns`, i.e. legacy over canonical, so a config carrying
 *    BOTH used to render the legacy value. After the fold the canonical
 *    `columns` reaches it. Every other reader of these four was already
 *    canonical-first and is unaffected.
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
  // The columns array the identity fold will see — mirroring the `foldColumns`
  // precedence below (canonical `columns` wins; otherwise the legacy `fields`
  // that is about to become it). `normalizeColumnIdentities` returns its input
  // by reference when every entry is already canonical, so this comparison is
  // also the "is there anything to do" test.
  const columnsSource = Array.isArray(s.columns)
    ? s.columns
    : foldColumns
      ? (legacyFields as unknown[])
      : undefined;
  const foldedColumns = normalizeColumnIdentities(columnsSource);
  const foldColumnIdentity = foldedColumns !== columnsSource;
  // Per-view-type config aliases (#2890 phase-3 carry-over). Collected before
  // the early return so an otherwise-canonical view carrying only a nested
  // legacy key still folds — and so a view carrying none still returns by
  // reference.
  const perViewFolds = Object.entries(PER_VIEW_CONFIG_ALIASES)
    .map(([viewKey, aliases]) => {
      const cfg = isRecord(s[viewKey]) ? s[viewKey] : undefined;
      if (!cfg) return undefined;
      const legacyKeys = Object.keys(aliases).filter((legacy) => cfg[legacy] !== undefined);
      return legacyKeys.length ? { viewKey, aliases, cfg, legacyKeys } : undefined;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  if (
    !foldColumns && !foldRowHeight && !foldFilter && !legacyFlags.length &&
    !foldDescription && !foldAria && !foldSharing && !defaultViewKind &&
    !foldColumnIdentity && !perViewFolds.length
  ) {
    return schema;
  }

  const next: Record<string, unknown> = { ...s };
  if (foldColumns) {
    if (!Array.isArray(next.columns)) next.columns = legacyFields;
    delete next.fields;
  }
  // After the `fields` → `columns` rename, so a legacy-spelled column LIST gets
  // its per-entry identities canonicalized in the same pass.
  if (foldColumnIdentity) next.columns = foldedColumns;
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
  for (const { viewKey, aliases, cfg, legacyKeys } of perViewFolds) {
    const nextCfg: Record<string, unknown> = { ...cfg };
    for (const legacy of legacyKeys) {
      const canonical = aliases[legacy];
      // Same one-directional shape as every fold above: the canonical key wins
      // when both are present, and the legacy key is REMOVED so a missed
      // read-site fails loudly instead of quietly taking the legacy path.
      if (nextCfg[canonical] === undefined) nextCfg[canonical] = cfg[legacy];
      delete nextCfg[legacy];
    }
    next[viewKey] = nextCfg;
  }
  if (defaultViewKind) next.viewType = 'grid';
  return next as T;
}
