/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:activity` — the pure half (objectui#3165).
 *
 * Two things live here, both testable without a DOM:
 *
 *  1. the `sys_activity` row → {@link FeedItem} map the block's self-fetch
 *     uses (the same map `RecordDetailView` applies to the rows it merges
 *     into its own feed — one shape for one table);
 *  2. {@link applyFeedConfig}, the filter/pagination pipeline that turns the
 *     block's DECLARED inputs (`types` / `showCompleted` / `unifiedTimeline`
 *     / `limit`) into observable behaviour.
 *
 * (2) exists as its own function on purpose. Before #3165 every one of those
 * inputs was a filter over a feed that was hard-coded empty — declared,
 * published to `sdui.manifest.json`, inert (objectstack#4413's shape). Making
 * them filter *whatever items the block has* — host-supplied or self-fetched —
 * is what stops the declaration from lying, and keeping the rule in one pure
 * function is what lets a test assert it directly rather than through a DOM.
 *
 * Enum membership is read from `@objectstack/spec` at runtime, never re-typed
 * here: a hand copy of a spec enum is how `FEED_TYPE_ICONS` lost six of the
 * thirteen feed types (objectstack#4115).
 */

import { FeedFilterMode as FeedFilterModeEnum, FeedItemType as FeedItemTypeEnum } from '@objectstack/spec/data';
import type { FeedItem, FeedItemType } from '@object-ui/types';
import type { FeedFilterMode } from '../RecordActivityTimeline';

const FILTER_MODE_VALUES: readonly string[] = FeedFilterModeEnum.options;
const FEED_ITEM_TYPE_VALUES: readonly string[] = FeedItemTypeEnum.options;

/** Spec default for `RecordActivityProps.limit`. */
export const DEFAULT_ACTIVITY_LIMIT = 20;

/**
 * `sys_activity.type` → `FeedItem.type`.
 *
 * Meant to be one reading with the map `RecordDetailView` uses when it merges
 * `sys_activity` into the discussion feed. Two renderers that disagree about what a `created` row IS would put
 * the same record's history under two different icons depending on which block
 * an author reached for, so the richer `record_create` / `record_delete` /
 * `sharing` feed types the spec offers are NOT used here — adopting them is a
 * change to that shared map, not to this block.
 *
 * ⚠️ That copy is a hand-written literal in `app-shell`, not an import of this
 * one, and nothing fails when the two disagree — so the `scheduled` entry below
 * is currently present here and absent there. Tracked as objectui#5878; fixing
 * it means the second copy reading this export, which is a different package's
 * surface than this card's.
 *
 * `commented` / `mentioned` map to nothing because their content lives in
 * `sys_comment` (with reactions and threading attached) — a host that has both
 * merges the comment rows, and the block on its own has no comment write path
 * to pair them with. `login` / `logout` are account events, not record
 * activity.
 *
 * ## Two vocabularies, not one (objectui#5840)
 *
 * The keys were originally set-equal to plugin-audit's declared
 * `sys_activity.type` select options, and the test pinned exactly that. They no
 * longer are, because those options are **not** what the column stores:
 *
 *  - Every field on `sys_activity` is `readonly: true`, and objectql's
 *    `validateRecord` skips readonly fields on both the insert and the update
 *    branch. The eleven-value enum is therefore documentation, not a contract —
 *    an undeclared value is written silently (measured upstream by
 *    plugin-audit's own `sys-activity-type-vocabulary.test.ts`).
 *  - The platform itself forwards author-declared values into the column:
 *    ADR-0052 §5b.2 `activityMilestones[].type` is applied verbatim by
 *    plugin-audit's `audit-writers.ts` (`if (milestone.type) activityType =
 *    milestone.type`). That is how `completed` is produced, and it is a general
 *    door, not a special case.
 *
 * So `scheduled` is a value that is written, stored and queryable while being
 * undeclared upstream. Dropping it was not a decision this map made; it was the
 * absence of one. Its producer is HotCRM's `schedule_meeting` action
 * (`src/actions/global.actions.ts` — `type: EVENT_STATUS === 'held' ?
 * 'completed' : 'scheduled'`), registered for `crm_lead`, `crm_contact`,
 * `crm_account`, `crm_opportunity` and `crm_case`: the held branch reached the
 * timeline, the scheduled branch never did.
 *
 * `scheduled` → `event` is the semantic pairing and it is what makes the
 * declared `event` feed type reachable at all. Note the two branches of that
 * one producer now land at different DEFAULT visibility, which is the intended
 * reading: a held meeting is `completed` → `task`, hidden unless
 * `showCompleted`; a not-yet-held meeting is `scheduled` → `event`, shown,
 * because an upcoming meeting is the part of a timeline you still act on.
 *
 * Whether the upstream enum should GAIN `scheduled` is a platform ruling, not
 * this block's to make — filed as objectstack#11424. Until it is ruled, the
 * honest statement of this table is the one the test now pins: the upstream
 * declaration PLUS the values a shipped producer measurably writes.
 *
 * Values outside BOTH groups are still dropped — see
 * {@link activityRowToFeedItem}, which now says so out loud instead of
 * silently.
 */
export const ACTIVITY_TYPE_TO_FEED_TYPE: Readonly<Record<string, FeedItemType | undefined>> = {
  created: 'field_change',
  updated: 'field_change',
  deleted: 'field_change',
  assigned: 'field_change',
  shared: 'field_change',
  system: 'system',
  completed: 'task',
  scheduled: 'event',
  commented: undefined,
  mentioned: undefined,
  login: undefined,
  logout: undefined,
};

/**
 * The feed types a COMPLETED activity produces.
 *
 * `showCompleted` (spec default `false`) is stated over feed types rather than
 * over `sys_activity.type` so that one rule covers both paths — the block's own
 * read AND a feed a host hands it, which arrives already mapped. It is exact
 * today because `completed` is the only activity type that means "this
 * finished" and the only one that maps to `task` (see
 * {@link ACTIVITY_TYPE_TO_FEED_TYPE}, pinned in the tests). A future producer
 * that emits OPEN tasks makes this coarse, and would need a completion marker
 * on `FeedItem` before `showCompleted` could stay honest.
 */
const COMPLETED_FEED_TYPES = new Set<string>(['task']);

/** A row as `sys_activity` returns it. Loose on purpose: the block reads a
 *  system table it does not own, and an unknown column is not an error. */
export interface SysActivityRow {
  id?: string | number;
  type?: string;
  summary?: string | null;
  timestamp?: string | null;
  created_at?: string | null;
  actor_name?: string | null;
  actor_avatar_url?: string | null;
  source_object?: string | null;
  source_id?: string | number | null;
  [k: string]: unknown;
}

/**
 * Coerce an authored `filterMode` to a value the timeline understands.
 *
 * Unknown values fall back to `'all'` rather than being passed through: a
 * `<Select>` handed a value with no matching item renders blank and the
 * dropdown reads as broken. Same posture as objectui#3151 — an unrecognised
 * filter token is skipped, never turned into a filter that can't match.
 */
export function normalizeFilterMode(value: unknown): FeedFilterMode {
  return typeof value === 'string' && FILTER_MODE_VALUES.includes(value)
    ? (value as FeedFilterMode)
    : 'all';
}

/** Keep only the `types` entries the spec actually defines. */
export function normalizeFeedTypes(value: unknown): FeedItemType[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const kept = value.filter(
    (v): v is FeedItemType => typeof v === 'string' && FEED_ITEM_TYPE_VALUES.includes(v),
  );
  return kept.length > 0 ? kept : undefined;
}

/** Coerce `limit` to a positive integer, falling back to the spec default. */
export function normalizeLimit(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ACTIVITY_LIMIT;
}

/**
 * Timestamp of a `sys_activity` row.
 *
 * Prefers the explicit `timestamp` column but tolerates older rows where the
 * driver leaked the literal default `"NOW()"` — `created_at` is always a real
 * ISO date. Copied from `RecordDetailView`'s merge for the same reason the
 * type map is: same rows, same quirk.
 */
export function activityTimestamp(row: SysActivityRow): string {
  const when = row.timestamp;
  if (!when || when === 'NOW()' || Number.isNaN(Date.parse(String(when)))) {
    return String(row.created_at ?? '');
  }
  return String(when);
}

/**
 * `sys_activity.type` values this map has never heard of, already warned about.
 *
 * Module scope so one unknown type warns ONCE rather than once per row: a
 * 200-row page of the same unknown type is one authoring mistake, not two
 * hundred. Same shape as the evaluator's fail-open warning
 * (`core/src/evaluator/fieldRules.ts`, objectstack#5149) — skipping something
 * an author declared is loud, not silent.
 */
const warnedUnknownActivityTypes = new Set<string>();

/**
 * Say out loud that a row was dropped for having a type nothing maps.
 *
 * Deliberately NOT fired for a type this map knows and deliberately drops
 * (`commented` / `mentioned` / `login` / `logout` → `undefined`): those are
 * decisions, and a warning about a decision is noise that teaches authors to
 * ignore the channel. It fires only for a value outside the table entirely —
 * which is the objectui#5840 failure mode: written, stored, invisible, no
 * diagnostic anywhere.
 */
function warnUnknownActivityType(type: string): void {
  if (warnedUnknownActivityTypes.has(type)) return;
  warnedUnknownActivityTypes.add(type);
  console.warn(
    `[record:activity] dropped a sys_activity row with type "${type}": no feed `
      + 'item type is mapped for it, so it cannot appear on any timeline whatever '
      + 'the page authors. `sys_activity.type` is not validated on write (every '
      + 'field on that object is readonly), so a producer can store a value the '
      + 'platform never declared. Map it in ACTIVITY_TYPE_TO_FEED_TYPE '
      + '(@object-ui/plugin-detail) if it is record activity.',
  );
}

/** Test seam: forget which unknown types have already been warned about. */
export function resetUnknownActivityTypeWarnings(): void {
  warnedUnknownActivityTypes.clear();
}

/**
 * One `sys_activity` row → one {@link FeedItem}, or `null` when the row is not
 * record activity (see {@link ACTIVITY_TYPE_TO_FEED_TYPE}).
 *
 * Two different `null`s, and the difference is the point: a type the table
 * maps to `undefined` is a deliberate exclusion and returns quietly; a type the
 * table does not contain at all is an unmapped producer and says so once.
 */
export function activityRowToFeedItem(
  row: SysActivityRow,
  systemActorLabel: string,
): FeedItem | null {
  const rawType = String(row?.type);
  if (!Object.prototype.hasOwnProperty.call(ACTIVITY_TYPE_TO_FEED_TYPE, rawType)) {
    warnUnknownActivityType(rawType);
    return null;
  }
  const feedType = ACTIVITY_TYPE_TO_FEED_TYPE[rawType];
  if (!feedType) return null;
  return {
    id: row.id as string | number,
    type: feedType,
    actor: row.actor_name ?? systemActorLabel,
    actorAvatarUrl: row.actor_avatar_url ?? undefined,
    body: row.summary ?? '',
    createdAt: activityTimestamp(row),
    // ADR-0052 ActivityPointer: drill from the one-line summary to the rich
    // source record (a `sys_email` row, a call/meeting task, …).
    sourceObject: row.source_object ?? undefined,
    sourceId: (row.source_id ?? undefined) as string | number | undefined,
  };
}

/** The subset of `RecordActivityProps` that decides which items survive. */
export interface FeedConfigFilters {
  types?: unknown;
  showCompleted?: unknown;
  unifiedTimeline?: unknown;
  limit?: unknown;
}

export interface AppliedFeed {
  /** Items to render, newest last (chronological, as the timeline reads). */
  items: FeedItem[];
  /** How many items the filters kept before `limit` trimmed the page. */
  total: number;
  /** True when `total` exceeds the current page — drives "Load more". */
  hasMore: boolean;
}

/**
 * Apply the block's declared filters to a feed, whatever its source.
 *
 * Order matters and is asserted: structural exclusions first
 * (`unifiedTimeline`, `showCompleted`), then the explicit `types` allow-list,
 * then pagination — so `limit` counts items the author can actually see.
 *
 * `pageSize` is the effective window (`limit` on first render, grown by
 * "Load more"); it is separate from `config.limit` so paging does not have to
 * rewrite the authored config.
 */
export function applyFeedConfig(
  items: readonly FeedItem[],
  config: FeedConfigFilters,
  pageSize: number,
): AppliedFeed {
  let kept = items.slice();

  // `unifiedTimeline: false` — do not mix field changes into the comment
  // stream. The spec's own wording for the default is "Mix field changes and
  // comments in one timeline (Airtable style)", so switching it off is
  // precisely the un-mixing: the panel becomes a discussion stream and the
  // record's field history stays in `record:history`, where it has its own
  // block.
  if (config.unifiedTimeline === false) {
    kept = kept.filter((i) => i.type !== 'field_change');
  }

  // `showCompleted` — spec default false, i.e. completed activities are hidden
  // unless asked for. See COMPLETED_FEED_TYPES for why this reads as a feed
  // type here.
  if (config.showCompleted !== true) {
    kept = kept.filter((i) => !COMPLETED_FEED_TYPES.has(i.type));
  }

  // `types` — an explicit allow-list of feed item types. Unknown entries are
  // dropped by normalizeFeedTypes; an all-unknown list is treated as "not
  // configured" rather than "show nothing", so a typo cannot empty the feed
  // silently.
  const types = normalizeFeedTypes(config.types);
  if (types) {
    const allowed = new Set<string>(types);
    kept = kept.filter((i) => allowed.has(i.type));
  }

  const total = kept.length;
  const size = Math.max(1, Math.floor(pageSize) || DEFAULT_ACTIVITY_LIMIT);
  // Newest first when trimming a page, chronological when rendering: the feed
  // reads oldest→newest, so a page of `size` is the LAST `size` items.
  const page = total > size ? kept.slice(total - size) : kept;
  return { items: page, total, hasMore: total > size };
}

/** Sort a feed chronologically and de-duplicate by id (feeds are append-only). */
export function mergeFeedItems(...groups: readonly FeedItem[][]): FeedItem[] {
  const byId = new Map<string, FeedItem>();
  for (const group of groups) {
    for (const item of group) byId.set(String(item.id), item);
  }
  return Array.from(byId.values()).sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
  });
}
