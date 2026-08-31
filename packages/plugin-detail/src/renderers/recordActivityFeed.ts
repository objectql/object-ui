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
 * ## The vocabulary is OPEN — ruled. Do NOT restore set-equality.
 *
 * Maintainer ruling of 2026-08-24 on objectstack#11507, **direction 4**:
 * `sys_activity.type` is AUTHOR-EXTENSIBLE. The declared select options are the
 * platform's BUILT-IN set, not the column's domain, and the two facts above are
 * why — readonly fields are never validated on write, and ADR-0052 §5b.2
 * forwards an author's `activityMilestones[].type` into the column verbatim.
 *
 * So the relation this table stands in is a SUPERSET, in one direction only:
 *
 *  - **map ⊇ built-ins** — every value the platform declares has an entry here,
 *    either a feed type or a deliberate `undefined` exclusion. A new built-in
 *    with no entry is a gap, and objectui#5969's pin turns red for it.
 *  - **NOT built-ins ⊇ map**, and NOT set-equality in either spelling. An
 *    author-extended value legitimately exists outside the declaration, so a
 *    pin that required the two sets to match would be false by construction.
 *
 * ⛔ A reader who finds no equality check here is looking at a DECISION, not an
 * omission: objectui#5840 removed the old set-equality pin on purpose, because
 * pinning to the closed declaration meant dropping stored rows, and
 * objectui#5969 replaced it with the two-directional pin under this ruling.
 *
 * (`scheduled` — the value #5840 was about — has since been declared upstream
 * by objectstack#11522, superseding objectstack#11424. That is precisely the
 * drift a hand-maintained equality pin cannot survive, and the reason the pin
 * is a superset assertion plus a fallback rather than a census of two groups.)
 *
 * A value outside this table is NO LONGER DROPPED: it renders through
 * {@link UNMAPPED_ACTIVITY_FEED_TYPE}. See {@link activityRowToFeedItem}.
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
 * The presentation an `sys_activity.type` value outside
 * {@link ACTIVITY_TYPE_TO_FEED_TYPE} renders through.
 *
 * The second half of the objectstack#11507 direction-4 ruling (2026-08-24): if
 * the column is author-extensible, then a value this map has never heard of is
 * REAL RECORD ACTIVITY that an author extended the platform with — not a
 * mistake — and dropping it is the objectui#5840 failure mode reappearing for
 * every author who ever writes one. Stored, queryable, invisible.
 *
 * `system` is the generic bucket rather than a new feed type because
 * `FeedItemType` is a CLOSED spec enum owned by `@objectstack/spec` — minting a
 * kind for "we don't know" is a platform change, not this block's.
 *
 * ⚠️ This is a FLOOR under the map, never a substitute for it. objectui#5840
 * rejected a catch-all *offered as the fix* — an unmeasured type rendering as
 * `system` is not the same data as a type someone read and mapped. What makes
 * the catch-all safe here is that it does not stand alone: the superset pin
 * above forces every built-in to keep its OWN presentation, so the fallback can
 * only ever receive values nobody has ruled on yet, and the diagnostic below
 * names each one so somebody can.
 */
export const UNMAPPED_ACTIVITY_FEED_TYPE: FeedItemType = 'system';

/**
 * Feed kinds an ObjectUI surface produces WITHOUT going through
 * {@link ACTIVITY_TYPE_TO_FEED_TYPE}.
 *
 * Exactly one today: `comment`, built from `sys_comment` rows by app-shell's
 * `RecordDetailView` (the `sys_comment` read, and the two optimistic rows the
 * composer writes) and handed to this block through `DiscussionContext`. It
 * cannot be derived here — app-shell depends on this package, not the other way
 * round — so it is DECLARED, and `feedTypeProducerCensus-5877.test.ts` re-runs
 * the census over the repository so the declaration cannot go stale silently.
 *
 * ## Census, and the pathspec it was taken over (objectui#5877)
 *
 * Every `.ts` / `.tsx` file in the repository that is not a test, at every top
 * level (`packages/`, `apps/`, `examples/`, `scripts/`, `e2e/`), narrowed to the
 * files that mention `FeedItem` at all — you cannot construct one without
 * naming the type — then read for `FeedItemType` literals. 1622 files scanned,
 * 13 mention `FeedItem`, one produces a kind off this map. A census is only as
 * wide as its pathspec, so the pathspec is stated rather than implied, and the
 * test above holds it.
 *
 * ⛔ NOT counted, deliberately: app-shell's `sharedUserFeeds.ts` /
 * `activityItemType.ts` read the same `sys_activity` rows but produce
 * `ActivityItemType` (`create` / `update` / `delete` / `comment` / `system`), a
 * DIFFERENT five-value vocabulary that is not a projection of this one in either
 * direction (objectui#6730 records why converging them costs rows). A row it
 * turns into an `ActivityItem` never becomes a `FeedItem`, so it produces
 * nothing for this feed. `ActivityEntry` in `@object-ui/types` is a third
 * vocabulary again, and has no producer at all.
 *
 * ⚠️ Also NOT counted, and the reason the diagnostic below names it: a HOST can
 * hand this block a feed of its own (`items` on the node, or a
 * `DiscussionContext` it mounts itself). Those items are produced outside this
 * repository, so no census taken here can bound their kinds.
 */
export const FEED_TYPES_PRODUCED_OFF_MAP: readonly FeedItemType[] = ['comment'];

/**
 * Feed kinds this repository has decided NOT to adopt — as opposed to kinds
 * nothing happens to produce.
 *
 * The distinction matters more than the diagnostic that uses it. Reporting a
 * decision as a defect is how a warning channel gets trained out of an author's
 * attention, and these three are decisions: `created` / `deleted` / `shared`
 * rows are mapped to `field_change` ON PURPOSE, because `RecordDetailView` and
 * this block must agree about what a `created` row IS before either can move to
 * the richer kind. Adopting them is a change to that shared map, not to this
 * block. The reasoning is written out at {@link ACTIVITY_TYPE_TO_FEED_TYPE}.
 *
 * ⚠️ This list is a TRANSCRIPTION of that prose, not a derivation, and there is
 * no way to make it one: the decision exists as a comment, and a comment is not
 * machine-readable. Two consequences, both load-bearing:
 *
 *  1. it is only as true as the prose it was copied from, so it is edited
 *     together with that prose and never on its own;
 *  2. a kind that is NOT on this list is not thereby known to be an oversight.
 *     It is only known to have no producer. Whether somebody decided against it
 *     and did not write it down is not recorded anywhere this code can read, and
 *     the message below says so rather than guessing.
 *
 * ⛔ Do not extend it by inference. A kind belongs here when a decision about it
 * is written down, not when its absence looks deliberate.
 */
export const DELIBERATELY_UNADOPTED_FEED_TYPES: readonly FeedItemType[] = [
  'record_create',
  'record_delete',
  'sharing',
];

/**
 * Every feed kind some ObjectUI surface can put on a record feed.
 *
 * DERIVED from the producers themselves — the map's range, its fallback, and
 * the declared off-map producer above — never a second hand-written list of
 * kinds. Giving an unproduced kind a producer (one new entry in
 * {@link ACTIVITY_TYPE_TO_FEED_TYPE}) therefore retires its diagnostic in the
 * same edit, with nothing else to remember. A hand-kept copy would not, and
 * that copy is exactly what this file's header records the cost of.
 */
export const PRODUCED_FEED_TYPES: ReadonlySet<FeedItemType> = new Set<FeedItemType>([
  ...Object.values(ACTIVITY_TYPE_TO_FEED_TYPE).filter((v): v is FeedItemType => Boolean(v)),
  UNMAPPED_ACTIVITY_FEED_TYPE,
  ...FEED_TYPES_PRODUCED_OFF_MAP,
]);

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
 * Warn ONCE per distinct key on a channel, never again for a key already named.
 *
 * One plumbing for both diagnostics in this file rather than two conventions.
 * A page re-runs its filter on every state change and re-maps its rows on every
 * fetch, but an authoring mistake is ONE mistake however many times React runs
 * the pipeline — so the dedupe key is the offending value, not the call.
 *
 * Each channel keeps its OWN bucket because the two vocabularies overlap:
 * `crm_task` is a plausible unmapped `sys_activity.type` AND a plausible
 * unrecognised `types` entry (it is an object name, and naming an object where
 * a feed kind belongs is exactly how objectui#5841 was found). One channel
 * having spoken must not silence the other.
 *
 * The message is built from the keys that were actually fresh, so a list whose
 * second render adds one new typo names that typo rather than repeating a
 * warning the author has already read.
 */
function warnOnce(
  bucket: Set<string>,
  keys: readonly string[],
  build: (fresh: readonly string[]) => string,
): void {
  const fresh = keys.filter((k) => !bucket.has(k));
  if (fresh.length === 0) return;
  for (const k of fresh) bucket.add(k);
  console.warn(build(fresh));
}

/** Authored `types` values already named as unrecognised. See {@link warnOnce}. */
const warnedUnrecognisedFeedTypes = new Set<string>();

/** Test seam: forget which `types` entries have already been named. */
export function resetUnrecognisedFeedTypeWarnings(): void {
  warnedUnrecognisedFeedTypes.clear();
}

/** Authored `types` values already named as unproduced. See {@link warnOnce}. */
const warnedUnproducedFeedTypes = new Set<string>();

/** Test seam: forget which unproduced `types` entries have already been named. */
export function resetUnproducedFeedTypeWarnings(): void {
  warnedUnproducedFeedTypes.clear();
}

/** Authored `filterMode` values already named as unrecognised. See {@link warnOnce}. */
const warnedUnrecognisedFilterModes = new Set<string>();

/** Test seam: forget which `filterMode` values have already been named. */
export function resetUnrecognisedFilterModeWarnings(): void {
  warnedUnrecognisedFilterModes.clear();
}

/**
 * Coerce an authored `filterMode` to a value the timeline understands.
 *
 * Unknown values fall back to `'all'` rather than being passed through: a
 * `<Select>` handed a value with no matching item renders blank and the
 * dropdown reads as broken. Same posture as objectui#3151 — an unrecognised
 * filter token is skipped, never turned into a filter that can't match.
 *
 * ## Why that fallback needs a diagnostic (objectui#5891)
 *
 * `'all'` is the WIDEST of the four declared modes — `filterItems` in
 * `RecordActivityTimeline` narrows to ONE feed type for each of the other three
 * and returns the feed untouched for `'all'` — so every unrecognised value
 * lands on the one option that shows the author MORE than they asked for. A
 * near-miss like `comments-only` or `commentsOnly` therefore opens the panel on
 * the unfiltered stream, and the tell is a PLAUSIBLE result (a populated
 * timeline) rather than an empty one that gets investigated. That is the same
 * shape objectui#5841 removed from the sibling `types` sanitiser.
 *
 * The ruling on this card (triage, 2026-08-25) is that the defect is the
 * INVISIBILITY, not the fallback: `filterMode` seeds a control the user can
 * change, and there is no defensible narrower default to fall back to instead.
 * So nothing that renders changes here — what changes is that the fold is now
 * SAID OUT LOUD, once per distinct offending value (see {@link warnOnce}).
 *
 * Absent (`undefined` / `null`) is silent: no `filterMode` was authored, which
 * is not a mistake, and a warning about a decision teaches authors to ignore
 * the channel. Only a value the author actually wrote is reported.
 *
 * The declared modes named in the message are read from `@objectstack/spec`'s
 * `FeedFilterMode` at runtime, never re-typed here — see the file header for
 * what a hand copy of a spec enum cost.
 */
export function normalizeFilterMode(value: unknown): FeedFilterMode {
  if (typeof value === 'string' && FILTER_MODE_VALUES.includes(value)) {
    return value as FeedFilterMode;
  }

  // Absent means no `filterMode` was authored — not a mistake, nothing to report.
  // Anything else is a value the author wrote and this block cannot honour.
  if (value !== undefined && value !== null) {
    const shown = typeof value === 'string' ? `"${value}"` : typeof value;
    const key = typeof value === 'string' ? value : `non-string ${shown}`;
    warnOnce(warnedUnrecognisedFilterModes, [key], () =>
      `[record:activity] ignoring an unrecognised \`filterMode\` (${shown}) and opening `
        + 'on "all" instead — the WIDEST mode, which shows EVERY activity rather than the '
        + 'slice that was asked for. No declared filter mode matches it. The fallback is '
        + 'kept rather than passing the value through because a dropdown handed a value '
        + 'with no matching item renders blank (objectui#3151), so this is a diagnostic, '
        + 'not a refusal. Declared filter modes: '
        + `${FILTER_MODE_VALUES.join(', ')}.`);
  }

  return 'all';
}

/**
 * Say out loud that an authored `types` entry selects a kind nothing produces.
 *
 * ## The failure being repaired (objectui#5877)
 *
 * `types: ['approval']` parses, typechecks, builds, and renders a permanently
 * EMPTY tab with nothing said anywhere. Every entry is a declared member of the
 * spec's `FeedItemType`, so the sibling diagnostic above has nothing to report
 * — and the author, or the AI writing the metadata, reads the result as a
 * working feature that happens to have no data yet. That is the silent-inert
 * class: a declared surface enforced by nothing.
 *
 * ⛔ It is NOT a refusal. The entry is honoured exactly as authored, the same as
 * every other declared kind; nothing that renders changes. What changes is that
 * the emptiness is now diagnosable.
 *
 * ## Three populations, not two — and the message keeps them apart
 *
 * A kind with no producer can be either of two very different things, and
 * lumping the second into the third is worse than saying nothing at all,
 * because it teaches authors that this channel reports non-problems:
 *
 *  - PRODUCED ({@link PRODUCED_FEED_TYPES}) — silent. Nothing to report.
 *  - DELIBERATELY UNADOPTED ({@link DELIBERATELY_UNADOPTED_FEED_TYPES}) —
 *    reported as a decision with its reason, never as a defect.
 *  - NO PRODUCER, no recorded decision — reported as exactly that, and the
 *    message stops there rather than calling it a gap. Whether somebody ruled
 *    against the kind and left no note is not knowable from here.
 *
 * ## What this diagnostic cannot see, stated in the message itself
 *
 * The census is over THIS repository's producers. A host that supplies the feed
 * (`items` on the node, or its own `DiscussionContext`) produces kinds no census
 * taken here can bound, so the message names that exception instead of
 * pretending the list is exhaustive.
 *
 * It is also repo-wide rather than per-path: `comment` counts as produced
 * because `RecordDetailView` produces it, even though a bare self-fetching block
 * with no host cannot (`commented` maps to `undefined` — a deliberate exclusion,
 * see {@link ACTIVITY_TYPE_TO_FEED_TYPE}). Reporting per-path would need the
 * feed's source, which this pure sanitiser does not have.
 *
 * Deduped per distinct kind on its OWN channel — one authoring mistake is one
 * mistake however many times React re-runs the filter, and the unrecognised
 * channel must not silence this one (see {@link warnOnce}).
 */
function warnUnproducedFeedTypes(kinds: readonly FeedItemType[]): void {
  const unproduced = kinds.filter((k) => !PRODUCED_FEED_TYPES.has(k));
  if (unproduced.length === 0) return;

  warnOnce(warnedUnproducedFeedTypes, unproduced, (fresh) => {
    const quoted = (list: readonly string[]) => list.map((t) => `"${t}"`).join(', ');
    const unadopted = fresh.filter((t) => DELIBERATELY_UNADOPTED_FEED_TYPES.includes(t as FeedItemType));
    const noProducer = fresh.filter((t) => !DELIBERATELY_UNADOPTED_FEED_TYPES.includes(t as FeedItemType));

    let message =
      `[record:activity] \`types\` names ${fresh.length} declared feed item `
      + `type${fresh.length === 1 ? '' : 's'} that NO ObjectUI producer emits, so `
      + `${fresh.length === 1 ? 'it selects' : 'they select'} nothing: `
      + `${quoted(fresh)}. The entr${fresh.length === 1 ? 'y is' : 'ies are'} honoured as `
      + 'authored — nothing is dropped or widened — but a timeline filtered to '
      + `${fresh.length === 1 ? 'it' : 'them'} alone renders permanently empty, which is `
      + 'the thing that used to happen with no diagnostic at all.';

    if (unadopted.length > 0) {
      message +=
        ` DELIBERATELY NOT ADOPTED, a decision rather than a gap: ${quoted(unadopted)} — `
        + '`created` / `deleted` / `shared` activity is mapped to `field_change` on '
        + 'purpose, because the record page and this block have to agree about what a '
        + '`created` row IS before either can move to the richer kind. Adopting them is '
        + 'a change to that shared map (ACTIVITY_TYPE_TO_FEED_TYPE, @object-ui/plugin-detail), '
        + 'not to one block.';
    }

    if (noProducer.length > 0) {
      message +=
        ` NO PRODUCER on any ObjectUI surface: ${quoted(noProducer)} — @objectstack/spec `
        + 'declares the kind and nothing here emits it. Whether that is a gap or a '
        + 'decision nobody wrote down is not recorded anywhere this diagnostic can read, '
        + 'so it reports the measurement and stops there.';
    }

    message +=
      ` Feed item types ObjectUI produces today: ${[...PRODUCED_FEED_TYPES].sort().join(', ')}. `
      + 'If your HOST supplies the feed — `items` on the node, or a DiscussionContext it '
      + 'mounts — it may produce kinds this census cannot see, and this warning does not '
      + 'apply to them.';

    return message;
  });
}

/**
 * Sanitise an authored `types` allow-list. Narrowing or refusal, never widening.
 *
 * Three distinct authored intents used to collapse into one rendering
 * (objectui#5841). They are three again:
 *
 * | authored                      | returns     | rendered                       |
 * | ----------------------------- | ----------- | ------------------------------ |
 * | absent (`undefined`/`null`)   | `undefined` | every kind — no filter authored |
 * | `[]`                          | `[]`        | nothing — the author said "no kinds" |
 * | `['crm_task']` (none known)   | `[]`        | nothing, plus one diagnostic   |
 * | `['task', 'crm_task']`        | `['task']`  | the recognised members, plus one diagnostic |
 * | `['approval']` (no producer)  | `['approval']` | nothing, plus one diagnostic — the kind is declared and honoured, but nothing emits it (objectui#5877) |
 *
 * `undefined` now means "no `types` key was authored" and ONLY that. It used to
 * mean that OR "everything you authored was dropped", and {@link applyFeedConfig}
 * reads it as "apply no filter" — so a single typo served the author every
 * activity on the record with nothing said anywhere, and the tell was a
 * PLAUSIBLE result (a populated timeline) rather than an empty one that gets
 * investigated. That is the principle this function now holds: a sanitiser may
 * narrow an author's request or refuse it, but it must never silently widen it,
 * because widening turns a typo into "show the user everything" — the one
 * outcome no author asked for.
 *
 * `[]` is honoured rather than reinterpreted, and silently: rendering every kind
 * is the maximally wrong answer to "no kinds", and there is nothing to report
 * about a request that was carried out exactly.
 *
 * Membership is read from `@objectstack/spec`'s `FeedItemType` at runtime, never
 * re-typed here — see the file header for what a hand copy of a spec enum cost.
 *
 * NOT pure, on TWO independent channels (see {@link warnOnce}) — the failure
 * being repaired is invisibility in both cases, so the diagnostics are the other
 * half of the fix rather than a nicety:
 *
 *  - an entry it cannot recognise logs once (no declared kind matches it);
 *  - a RECOGNISED entry that no producer emits logs once as well, on its own
 *    channel — see {@link warnUnproducedFeedTypes}. That one changes nothing
 *    about the return value: the kind is declared, so it is kept and honoured.
 */
export function normalizeFeedTypes(value: unknown): FeedItemType[] | undefined {
  // The only shape that means "no filter": the author never wrote the key.
  if (value === undefined || value === null) return undefined;

  // Authored, but not a list of kinds at all (`types: 'task'` — brackets
  // dropped). Refused for the same reason an all-unrecognised list is: a filter
  // that cannot be read is not a request to REMOVE the filter.
  if (!Array.isArray(value)) {
    const shown = typeof value === 'string' ? `"${value}"` : typeof value;
    warnOnce(warnedUnrecognisedFeedTypes, [`non-array ${shown}`], () =>
      `[record:activity] ignoring an authored \`types\` that is not an array (${shown}). `
        + '`types` must be a LIST of feed item types. The timeline renders empty rather '
        + 'than falling back to every kind, because a filter that cannot be read is not a '
        + 'request to remove the filter. Declared feed item types: '
        + `${FEED_ITEM_TYPE_VALUES.join(', ')}.`);
    return [];
  }

  const kept: FeedItemType[] = [];
  const unrecognised: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && FEED_ITEM_TYPE_VALUES.includes(entry)) {
      kept.push(entry as FeedItemType);
    } else {
      unrecognised.push(typeof entry === 'string' ? entry : String(entry));
    }
  }

  if (unrecognised.length > 0) {
    warnOnce(warnedUnrecognisedFeedTypes, unrecognised, (fresh) =>
      `[record:activity] ignoring ${fresh.length} unrecognised \`types\` `
        + `entr${fresh.length === 1 ? 'y' : 'ies'}: ${fresh.map((t) => `"${t}"`).join(', ')}. `
        + 'No declared feed item type matches, so they select nothing; only the recognised '
        + 'entries narrow the timeline, and a list with NO recognised entry renders an '
        + 'EMPTY timeline rather than every kind. Declared feed item types: '
        + `${FEED_ITEM_TYPE_VALUES.join(', ')}.`);
  }

  // Second channel, over the entries that WERE recognised: a declared kind that
  // no producer emits is honoured exactly, and says so (objectui#5877).
  warnUnproducedFeedTypes(kept);

  return kept;
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
 * Say out loud that a row reached the timeline through the generic fallback.
 *
 * Deliberately NOT fired for a type this map knows and deliberately drops
 * (`commented` / `mentioned` / `login` / `logout` → `undefined`): those are
 * decisions, and a warning about a decision is noise that teaches authors to
 * ignore the channel. It fires only for a value outside the table entirely.
 *
 * Since objectui#5969 that value is RENDERED rather than dropped
 * ({@link UNMAPPED_ACTIVITY_FEED_TYPE}), so the diagnostic no longer reports
 * lost data — it reports a MISSING DECISION, which is the thing that is still
 * wrong. The row is visible; what it is missing is the specific icon and colour
 * a mapped type gets. That is the channel by which an author-extended value
 * becomes a mapping somebody made on purpose.
 */
function warnUnknownActivityType(type: string): void {
  warnOnce(warnedUnknownActivityTypes, [type], () =>
    `[record:activity] rendered a sys_activity row with type "${type}" through the `
      + `generic "${UNMAPPED_ACTIVITY_FEED_TYPE}" presentation: no feed item type is `
      + 'mapped for it. `sys_activity.type` is author-extensible (objectstack#11507, '
      + 'ruled 2026-08-24) and is not validated on write, so a producer can store a '
      + 'value the platform never declared — the row is shown rather than dropped. '
      + 'Map it in ACTIVITY_TYPE_TO_FEED_TYPE (@object-ui/plugin-detail) to give it '
      + 'its own presentation.');
}

/** Test seam: forget which unknown types have already been warned about. */
export function resetUnknownActivityTypeWarnings(): void {
  warnedUnknownActivityTypes.clear();
}

/**
 * One `sys_activity` row → one {@link FeedItem}, or `null` when the row is not
 * record activity (see {@link ACTIVITY_TYPE_TO_FEED_TYPE}).
 *
 * Three outcomes, and the difference between the last two is the whole of the
 * objectstack#11507 direction-4 ruling (2026-08-24):
 *
 *  - a type mapped to a feed type renders with THAT presentation;
 *  - a type the table maps to `undefined` is a DELIBERATE exclusion — `null`,
 *    quietly, because a warning about a decision teaches authors to ignore the
 *    channel;
 *  - a type the table does not contain at all is an AUTHOR-EXTENDED value under
 *    the ruled open vocabulary. It renders through
 *    {@link UNMAPPED_ACTIVITY_FEED_TYPE} and says so once. It used to return
 *    `null` here, which made every extended value invisible — the same outcome
 *    objectui#5840 was filed for, reached by a different route.
 */
export function activityRowToFeedItem(
  row: SysActivityRow,
  systemActorLabel: string,
): FeedItem | null {
  const rawType = String(row?.type);
  const known = Object.prototype.hasOwnProperty.call(ACTIVITY_TYPE_TO_FEED_TYPE, rawType);
  if (!known) warnUnknownActivityType(rawType);
  const feedType = known ? ACTIVITY_TYPE_TO_FEED_TYPE[rawType] : UNMAPPED_ACTIVITY_FEED_TYPE;
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

  // `types` — an explicit allow-list of feed item types.
  //
  // The test is `!== undefined`, not truthiness, and the difference is the whole
  // of objectui#5841: an EMPTY allow-list is a filter that keeps nothing, not an
  // absent filter. `normalizeFeedTypes` returns `undefined` only when no `types`
  // key was authored; `[]` means the author wrote one and nothing in it survived
  // — `types: []`, or a list whose every member is unrecognised. Both filter to
  // nothing, which is the NARROW answer. Reading either as "no filter" was the
  // defect: it widened a typo into "show the user every activity on the record".
  const types = normalizeFeedTypes(config.types);
  if (types !== undefined) {
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
