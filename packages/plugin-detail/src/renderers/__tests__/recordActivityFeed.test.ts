/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:activity` — the declared filters actually filter (objectui#3165).
 *
 * These assert the pure half directly: the `sys_activity` → `FeedItem` map and
 * `applyFeedConfig`. Asserting them here rather than only through the DOM is
 * deliberate — the defect #3165 fixes was that `types` / `limit` /
 * `showCompleted` / `unifiedTimeline` were DECLARED inputs with nothing behind
 * them, and "the panel rendered something" is exactly the evidence that stayed
 * green while that was true.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { FeedFilterMode as SpecFilterMode, FeedItemType as SpecFeedItemType } from '@objectstack/spec/data';
import type { FeedItem } from '@object-ui/types';
import {
  ACTIVITY_TYPE_TO_FEED_TYPE,
  DEFAULT_ACTIVITY_LIMIT,
  activityRowToFeedItem,
  activityTimestamp,
  applyFeedConfig,
  mergeFeedItems,
  normalizeFeedTypes,
  normalizeFilterMode,
  normalizeLimit,
  resetUnknownActivityTypeWarnings,
  resetUnrecognisedFeedTypeWarnings,
  UNMAPPED_ACTIVITY_FEED_TYPE,
} from '../recordActivityFeed';

const item = (over: Partial<FeedItem> & Pick<FeedItem, 'id' | 'type'>): FeedItem => ({
  actor: 'Ada',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

/**
 * The platform's BUILT-IN `sys_activity.type` set.
 *
 * ## Provenance — read this before editing the list
 *
 * Source: objectstack `packages/plugins/plugin-audit/src/objects/sys-activity.object.ts`,
 * the `type: Field.select([...])` declaration. Read at objectstack commit
 * `91b1342` ("declare sys_activity.type 'scheduled' and record its writer",
 * objectstack#11522) on 2026-08-24. That file is the ONLY declaration of this
 * vocabulary in the platform — `@objectstack/spec` declares `FeedItemType`, the
 * vocabulary this map's VALUES come from, and never the keys.
 *
 * ## Why it is a hand census and not a live read
 *
 * There is no live source for it in reach: `@objectstack/plugin-audit` is a
 * server plugin, and the packages this repo depends on (`@objectstack/spec`,
 * `client`, `formula`, `lint`) do not carry the declaration. Reading it live
 * would mean a UI package taking a dependency on a services plugin.
 *
 * ⚠️ So this list CAN go stale, and measurably has: `scheduled` was declared
 * upstream on 2026-08-24 and the previous census still had it filed as
 * "undeclared but written". Two things keep that from being a data loss rather
 * than a labelling one, and both are load-bearing:
 *
 *  1. the fallback below — an undeclared or newly-declared value RENDERS, so a
 *     stale census costs a specific icon, never a vanished row; and
 *  2. objectstack#11807 — the platform-side ask to publish this vocabulary
 *     where a UI package can read it, which is what would let this list be
 *     deleted.
 *
 * ⛔ Do not derive this list from `ACTIVITY_TYPE_TO_FEED_TYPE`. A pin that reads
 * its expectation out of the thing it is pinning cannot fail.
 */
const PLATFORM_BUILTIN_ACTIVITY_TYPES = [
  'assigned', 'commented', 'completed', 'created', 'deleted', 'login',
  'logout', 'mentioned', 'scheduled', 'shared', 'system', 'updated',
] as const;

/**
 * A value no built-in declares — what an author extends the column with.
 *
 * `sys_activity.type` is author-extensible (objectstack#11507, ruled direction
 * 4 on 2026-08-24): every field on the object is `readonly: true`, objectql's
 * `validateRecord` skips readonly fields on both write branches, and ADR-0052
 * §5b.2 forwards an author's `activityMilestones[].type` into the column
 * verbatim. So a value like this is STORED, queryable, and legitimate.
 */
const AUTHOR_EXTENDED_TYPE = 'crm_contract_signed';

describe('sys_activity row → FeedItem', () => {
  /**
   * SUPERSET, one direction only: **the map covers every built-in**.
   *
   * In words, because the direction is easy to get backwards: every value the
   * platform DECLARES must have an entry in `ACTIVITY_TYPE_TO_FEED_TYPE` — a
   * feed type, or a deliberate `undefined` exclusion. A new built-in with no
   * entry turns this red, which is what forces the map to keep up.
   *
   * ⛔ The converse — every map key must be declared upstream — is NOT asserted,
   * and neither is set equality in any spelling. Under the objectstack#11507
   * direction-4 ruling (2026-08-24) `sys_activity.type` is author-extensible,
   * so map keys outside the declaration are legitimate by construction.
   * objectui#5840 removed the old equality pin because pinning to the closed
   * declaration meant dropping stored rows; ⛔ do not put it back. What replaces
   * it is this leg plus the fallback leg below — either alone is worse than
   * neither: a superset pin on its own re-creates the closed-vocabulary
   * failure slowly, and a fallback on its own lets the map fall behind.
   */
  it('covers every BUILT-IN type — superset, not equality (objectstack#11507)', () => {
    for (const type of PLATFORM_BUILTIN_ACTIVITY_TYPES) {
      expect(
        Object.prototype.hasOwnProperty.call(ACTIVITY_TYPE_TO_FEED_TYPE, type),
        `'${type}' is declared by plugin-audit's sys_activity.type and has no entry in `
          + 'ACTIVITY_TYPE_TO_FEED_TYPE. Every built-in needs a decision here: a feed '
          + 'type, or an explicit `undefined` that says the exclusion was meant.',
      ).toBe(true);
    }
    for (const mapped of Object.values(ACTIVITY_TYPE_TO_FEED_TYPE)) {
      if (mapped) expect(SpecFeedItemType.options).toContain(mapped);
    }
  });

  it('does NOT require the map to be contained by the declaration', () => {
    // The other direction, stated as an assertion rather than as a comment so
    // that "re-add the equality check" has to delete a passing test to happen.
    // An author-extended value has no entry and still renders (see the fallback
    // leg), and a mapped key that upstream later drops is not an error here.
    const declared = new Set<string>(PLATFORM_BUILTIN_ACTIVITY_TYPES);
    expect(declared.has(AUTHOR_EXTENDED_TYPE)).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(
      ACTIVITY_TYPE_TO_FEED_TYPE, AUTHOR_EXTENDED_TYPE,
    )).toBe(false);
    expect(activityRowToFeedItem({ id: 'ext', type: AUTHOR_EXTENDED_TYPE }, 'System'))
      .not.toBeNull();
  });

  /**
   * Regression control on the map's OWN table, not on the platform's.
   *
   * This is `toEqual` over the map and it is deliberately not the pin the
   * ruling forbids: it compares the map to the readings this repo recorded, so
   * a future edit that RE-POINTS or drops an existing type has to say so here.
   * It says nothing about which values the platform declares — that is the
   * superset leg above, and only that leg moves when upstream moves.
   */
  it('leaves every mapped type pointing where it did', () => {
    expect({ ...ACTIVITY_TYPE_TO_FEED_TYPE }).toEqual({
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
    });
  });

  it('drops the rows that are not record activity', () => {
    for (const type of ['commented', 'mentioned', 'login', 'logout']) {
      expect(activityRowToFeedItem({ id: '1', type }, 'System')).toBeNull();
    }
  });

  it('carries actor, summary and the ADR-0052 source pointer onto the feed item', () => {
    const mapped = activityRowToFeedItem(
      {
        id: 'act-1',
        type: 'updated',
        summary: 'Stage: draft → qualified',
        timestamp: '2026-03-04T05:06:07.000Z',
        actor_name: 'Grace',
        actor_avatar_url: 'https://example.test/g.png',
        source_object: 'sys_email',
        source_id: 'email-9',
      },
      'System',
    );
    expect(mapped).toEqual({
      id: 'act-1',
      type: 'field_change',
      actor: 'Grace',
      actorAvatarUrl: 'https://example.test/g.png',
      body: 'Stage: draft → qualified',
      createdAt: '2026-03-04T05:06:07.000Z',
      sourceObject: 'sys_email',
      sourceId: 'email-9',
    });
  });

  it('falls back to the system actor label when the row has no actor', () => {
    expect(activityRowToFeedItem({ id: 'a', type: 'system' }, '系统')?.actor).toBe('系统');
  });

  it('falls back to created_at when the driver leaked the literal NOW() default', () => {
    expect(activityTimestamp({ timestamp: 'NOW()', created_at: '2026-02-02T00:00:00.000Z' }))
      .toBe('2026-02-02T00:00:00.000Z');
    expect(activityTimestamp({ timestamp: null, created_at: '2026-02-03T00:00:00.000Z' }))
      .toBe('2026-02-03T00:00:00.000Z');
  });
});

/**
 * objectui#5840 — a `scheduled` meeting reaches the timeline, and the fix is an
 * ADDITION rather than a loosening.
 *
 * Both directions are asserted on purpose. "`scheduled` now renders" alone
 * would stay green if the map had been replaced by a catch-all bucket, which is
 * the wrong fix (an unmeasured type rendering as `system` is new wrong data,
 * not recovered data). So the unknown-type leg below is not decoration: it is
 * what makes the pair discriminate between the fix that was made and the fix
 * that was rejected.
 *
 * ⚠️ objectui#5969 changed what that unknown-type leg asserts, and the reason
 * the sentence above survives is that the objection it records still stands.
 * Under the objectstack#11507 direction-4 ruling an unknown value now renders
 * through a defined FALLBACK rather than being dropped — but a catch-all is
 * still not a substitute for reading a type and mapping it, which is why the
 * superset leg exists and why `scheduled` keeps its own `event` presentation
 * here instead of landing in the bucket. The pair still discriminates; what it
 * discriminates between is now "mapped on purpose" and "shown pending a
 * decision", rather than "mapped on purpose" and "invisible".
 */
describe('a scheduled activity reaches the feed (objectui#5840)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetUnknownActivityTypeWarnings();
  });

  it('maps a scheduled meeting row onto an `event` feed item, carrying its ADR-0052 pointer', () => {
    const mapped = activityRowToFeedItem(
      {
        id: 'act-9',
        type: 'scheduled',
        summary: 'Discovery call (30 min)',
        timestamp: '2026-04-01T09:00:00.000Z',
        actor_name: 'Grace',
        source_object: 'crm_event',
        source_id: 'evt-3',
      },
      'System',
    );
    expect(mapped).toEqual({
      id: 'act-9',
      type: 'event',
      actor: 'Grace',
      actorAvatarUrl: undefined,
      body: 'Discovery call (30 min)',
      createdAt: '2026-04-01T09:00:00.000Z',
      sourceObject: 'crm_event',
      sourceId: 'evt-3',
    });
  });

  it('produces a feed type the spec actually declares, so `types` can name it', () => {
    // The other half of #5840's complaint: `event` was a declared FeedItemType
    // that nothing could produce, so `types: ['event']` was a permanently empty
    // tab. It is reachable now.
    expect(SpecFeedItemType.options).toContain('event');
    expect(ACTIVITY_TYPE_TO_FEED_TYPE.scheduled).toBe('event');
  });

  const scheduledItem: FeedItem = item({ id: 'e1', type: 'event' });

  it('survives the default filters — an upcoming meeting is not "completed"', () => {
    // Reaching activityRowToFeedItem is not enough: the row is only visible if
    // it also survives the pipeline every page runs. `showCompleted` defaults
    // to false, and a scheduled meeting must NOT be caught by it — that is the
    // whole difference from the held branch of the same producer.
    expect(applyFeedConfig([scheduledItem], {}, 50).items.map((i) => i.id)).toEqual(['e1']);
  });

  it('survives `types: [\'event\']`, the filter an author writes to show meetings', () => {
    expect(applyFeedConfig([scheduledItem], { types: ['event'] }, 50).items.map((i) => i.id))
      .toEqual(['e1']);
  });

  it('survives unifiedTimeline:false — a meeting is not a field change', () => {
    expect(applyFeedConfig([scheduledItem], { unifiedTimeline: false }, 50).items.map((i) => i.id))
      .toEqual(['e1']);
  });

  it('is excluded when the author asks for other kinds, like any other item', () => {
    // Control for the three legs above: they pass because `event` is genuinely
    // carried through the pipeline, not because the pipeline stopped filtering.
    expect(applyFeedConfig([scheduledItem], { types: ['comment'] }, 50).items).toEqual([]);
  });

  /**
   * FALLBACK leg of the objectstack#11507 pin — the second half of the ruling.
   *
   * The observable is POSITIVE, not "did not throw": the row is present, it
   * carries its own summary and actor, and its feed type is the declared
   * fallback. "Unknown types do not crash" would also be true of a feed that
   * drops every row, which is exactly what this replaces.
   *
   * The counter-probe rides in the same run: a built-in with its own reading
   * still gets THAT reading, not the bucket. Without it, a map replaced
   * wholesale by the fallback would read as green here.
   */
  it('RENDERS an author-extended type through the fallback presentation', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mapped = activityRowToFeedItem(
      {
        id: 'ext-1',
        type: AUTHOR_EXTENDED_TYPE,
        summary: 'Contract countersigned',
        timestamp: '2026-05-06T07:08:09.000Z',
        actor_name: 'Grace',
      },
      'System',
    );
    // Present, and carrying the row — not a husk, and not `null`.
    expect(mapped).not.toBeNull();
    expect(mapped).toMatchObject({
      id: 'ext-1',
      type: UNMAPPED_ACTIVITY_FEED_TYPE,
      actor: 'Grace',
      body: 'Contract countersigned',
      createdAt: '2026-05-06T07:08:09.000Z',
    });

    // COUNTER-PROBE — a built-in keeps its own presentation, so "everything
    // renders" cannot be reached by pointing the whole map at the fallback.
    expect(activityRowToFeedItem({ id: 'b1', type: 'created' }, 'System')?.type)
      .toBe('field_change');
    expect(activityRowToFeedItem({ id: 'b2', type: 'scheduled' }, 'System')?.type)
      .toBe('event');
    // ...and the fallback is DISTINGUISHABLE from the one it was compared with.
    expect(UNMAPPED_ACTIVITY_FEED_TYPE).not.toBe('field_change');

    // Shown, but not silently: the missing decision is still announced once.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(AUTHOR_EXTENDED_TYPE);
  });

  it('renders a row whose type is missing entirely rather than dropping it', () => {
    // A stored row with no `type` is still a stored row. Same posture: visible
    // through the fallback, announced once.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(activityRowToFeedItem({ id: 'z2', summary: 'no type' }, 'System'))
      .toMatchObject({ id: 'z2', type: UNMAPPED_ACTIVITY_FEED_TYPE, body: 'no type' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns once per unknown type, not once per row', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i += 1) {
      expect(activityRowToFeedItem({ id: `z${i}`, type: 'teleported' }, 'System'))
        .not.toBeNull();
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('teleported');
  });

  it('stays SILENT for the types it deliberately drops', () => {
    // A warning about a decision teaches authors to ignore the channel. Only a
    // value outside the table entirely is a missing decision.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const type of ['commented', 'mentioned', 'login', 'logout']) {
      expect(activityRowToFeedItem({ id: '1', type }, 'System')).toBeNull();
    }
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('input normalisation reads its vocabulary from the spec', () => {
  it('accepts every FeedFilterMode the spec declares, and only those', () => {
    for (const mode of SpecFilterMode.options) {
      expect(normalizeFilterMode(mode)).toBe(mode);
    }
    // An unrecognised value is SKIPPED, not passed through — a <Select> handed
    // a value with no matching item renders blank (objectui#3151's posture).
    expect(normalizeFilterMode('x')).toBe('all');
    expect(normalizeFilterMode(undefined)).toBe('all');
    expect(normalizeFilterMode(7)).toBe('all');
  });

  it('accepts every FeedItemType the spec declares, read from the spec itself', () => {
    // The allow-list vocabulary is never hand-typed here: a pin that re-states
    // the enum it is pinning cannot fail when the enum moves.
    const declared = [...SpecFeedItemType.options];
    expect(normalizeFeedTypes(declared)).toEqual(declared);
  });

  it('distinguishes "no `types` authored" from "nothing survived" (objectui#5841)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // `undefined` is now reserved for ONE meaning: the author wrote no filter.
    expect(normalizeFeedTypes(undefined)).toBeUndefined();
    expect(normalizeFeedTypes(null)).toBeUndefined();

    // Everything else is an authored filter, and an authored filter that keeps
    // nothing is `[]` — a filter that selects nothing, never "no filter".
    expect(normalizeFeedTypes([])).toEqual([]);
    expect(normalizeFeedTypes(['crm_task'])).toEqual([]);
    expect(normalizeFeedTypes(['comment', 'crm_task', 'task'])).toEqual(['comment', 'task']);

    // Brackets dropped. Also refused rather than ignored: `types` that cannot be
    // read is not a request to remove the filter.
    expect(normalizeFeedTypes('comment')).toEqual([]);

    resetUnrecognisedFeedTypeWarnings();
    warn.mockRestore();
  });

  it('coerces `limit` to a positive integer, defaulting to the spec default', () => {
    expect(normalizeLimit(5)).toBe(5);
    expect(normalizeLimit('5')).toBe(5);
    expect(normalizeLimit(0)).toBe(DEFAULT_ACTIVITY_LIMIT);
    expect(normalizeLimit(-3)).toBe(DEFAULT_ACTIVITY_LIMIT);
    expect(normalizeLimit(undefined)).toBe(DEFAULT_ACTIVITY_LIMIT);
    expect(normalizeLimit('lots')).toBe(DEFAULT_ACTIVITY_LIMIT);
    expect(DEFAULT_ACTIVITY_LIMIT).toBe(20); // @objectstack/spec RecordActivityProps.limit
  });
});

describe('applyFeedConfig — the declared inputs change what is rendered', () => {
  const feed: FeedItem[] = [
    item({ id: 'c1', type: 'comment', createdAt: '2026-01-01T00:00:00.000Z' }),
    item({ id: 'f1', type: 'field_change', createdAt: '2026-01-02T00:00:00.000Z' }),
    item({ id: 't1', type: 'task', createdAt: '2026-01-03T00:00:00.000Z' }),
    item({ id: 's1', type: 'system', createdAt: '2026-01-04T00:00:00.000Z' }),
  ];
  const ids = (f: { items: FeedItem[] }) => f.items.map((i) => i.id);

  it('shows everything but completed activities by default (spec: showCompleted=false)', () => {
    expect(ids(applyFeedConfig(feed, {}, 50))).toEqual(['c1', 'f1', 's1']);
  });

  it('showCompleted:true admits the completed activities', () => {
    expect(ids(applyFeedConfig(feed, { showCompleted: true }, 50))).toEqual(['c1', 'f1', 't1', 's1']);
  });

  it('unifiedTimeline:false un-mixes field changes from the comment stream', () => {
    expect(ids(applyFeedConfig(feed, { unifiedTimeline: false, showCompleted: true }, 50)))
      .toEqual(['c1', 't1', 's1']);
    // …and true is the spec default, i.e. mixed.
    expect(ids(applyFeedConfig(feed, { unifiedTimeline: true, showCompleted: true }, 50)))
      .toEqual(['c1', 'f1', 't1', 's1']);
  });

  it('types is an allow-list over feed item types', () => {
    expect(ids(applyFeedConfig(feed, { types: ['comment'] }, 50))).toEqual(['c1']);
    expect(ids(applyFeedConfig(feed, { types: ['comment', 'system'] }, 50))).toEqual(['c1', 's1']);
  });

  it('a `types` list of nothing but typos renders nothing, not everything (objectui#5841)', () => {
    // Replaces the pin that asserted the opposite. That expectation WAS the
    // defect: `['commnet']` selected no kind, and serving every kind instead is
    // the one answer the author cannot have meant.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(ids(applyFeedConfig(feed, { types: ['commnet'] }, 50))).toEqual([]);
    resetUnrecognisedFeedTypeWarnings();
    warn.mockRestore();
  });

  it('limit pages the feed newest-first and reports hasMore', () => {
    const page = applyFeedConfig(feed, { showCompleted: true }, 2);
    // Chronological render order, but the PAGE is the newest two.
    expect(ids(page)).toEqual(['t1', 's1']);
    expect(page.total).toBe(4);
    expect(page.hasMore).toBe(true);

    const all = applyFeedConfig(feed, { showCompleted: true }, 4);
    expect(all.hasMore).toBe(false);
  });

  it('counts the page AFTER filtering, so limit means "items the author sees"', () => {
    // 3 comments + 3 field changes; with field changes excluded a limit of 3
    // must yield all three comments, not "3 of the 6 raw rows".
    const mixed: FeedItem[] = [
      item({ id: 'c1', type: 'comment', createdAt: '2026-01-01T00:00:00.000Z' }),
      item({ id: 'f1', type: 'field_change', createdAt: '2026-01-02T00:00:00.000Z' }),
      item({ id: 'c2', type: 'comment', createdAt: '2026-01-03T00:00:00.000Z' }),
      item({ id: 'f2', type: 'field_change', createdAt: '2026-01-04T00:00:00.000Z' }),
      item({ id: 'c3', type: 'comment', createdAt: '2026-01-05T00:00:00.000Z' }),
      item({ id: 'f3', type: 'field_change', createdAt: '2026-01-06T00:00:00.000Z' }),
    ];
    const page = applyFeedConfig(mixed, { unifiedTimeline: false }, 3);
    expect(ids(page)).toEqual(['c1', 'c2', 'c3']);
    expect(page.hasMore).toBe(false);
  });

  it('never mutates the feed it was handed', () => {
    const source = feed.slice();
    applyFeedConfig(source, { types: ['comment'] }, 1);
    expect(source).toHaveLength(4);
  });
});

/**
 * objectui#5841 — a sanitiser may NARROW an author's request or refuse it, but
 * it must never silently WIDEN it.
 *
 * Three authored intents used to collapse into one rendering, and the collapse
 * was invisible because its result was PLAUSIBLE: a populated timeline reads as
 * working, so a page shipped for as long as nobody counted the rows. The table
 * below is the ruled behaviour, and the two controls are what stop the suite
 * from passing for the wrong reason — "renders empty" is trivially satisfiable
 * by a pipeline that has stopped filtering at all, so a run that did not also
 * pin the unchanged legs would not discriminate.
 */
describe('an unusable `types` filter narrows or refuses, never widens (objectui#5841)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetUnrecognisedFeedTypeWarnings();
  });

  const feed: FeedItem[] = [
    item({ id: 'c1', type: 'comment', createdAt: '2026-01-01T00:00:00.000Z' }),
    item({ id: 'f1', type: 'field_change', createdAt: '2026-01-02T00:00:00.000Z' }),
    item({ id: 's1', type: 'system', createdAt: '2026-01-03T00:00:00.000Z' }),
  ];
  const ids = (f: { items: FeedItem[] }) => f.items.map((i) => i.id);
  const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  /**
   * An object name where a feed kind belongs — the shape that was measured in a
   * real app. Its unrecognisedness is DERIVED from the spec, never asserted by
   * hand: if `crm_task` ever became a declared feed type this guard fails loudly
   * instead of the suite quietly testing nothing.
   */
  const UNRECOGNISED = 'crm_task';
  it('the value this suite treats as unrecognised is outside the spec vocabulary', () => {
    expect(SpecFeedItemType.options).not.toContain(UNRECOGNISED);
    expect(SpecFeedItemType.options).toContain('comment');
  });

  it('CONTROL — `types` omitted still means no filter: every kind renders', () => {
    expect(ids(applyFeedConfig(feed, {}, 50))).toEqual(['c1', 'f1', 's1']);
  });

  it('CONTROL — a recognised list still filters to exactly those kinds', () => {
    const warn = quiet();
    expect(ids(applyFeedConfig(feed, { types: ['comment', 'system'] }, 50)))
      .toEqual(['c1', 's1']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('`types: []` filters to NOTHING — the author said "no kinds"', () => {
    expect(ids(applyFeedConfig(feed, { types: [] }, 50))).toEqual([]);
  });

  it('a list whose every member is unrecognised filters to NOTHING', () => {
    quiet();
    expect(ids(applyFeedConfig(feed, { types: [UNRECOGNISED] }, 50))).toEqual([]);
  });

  it('a MIXED list keeps the recognised members and drops the rest', () => {
    quiet();
    expect(ids(applyFeedConfig(feed, { types: ['comment', UNRECOGNISED] }, 50)))
      .toEqual(['c1']);
  });

  it('`types` that is not a list at all is refused, not ignored', () => {
    // `types: 'comment'` — brackets dropped. The kind is spelled correctly, so
    // this cannot be caught by vocabulary alone; ignoring it rendered the whole
    // audit stream.
    quiet();
    expect(ids(applyFeedConfig(feed, { types: 'comment' }, 50))).toEqual([]);
  });

  it('names the unrecognised kinds, once, however many times the feed re-renders', () => {
    const warn = quiet();
    for (let i = 0; i < 5; i += 1) {
      applyFeedConfig(feed, { types: [UNRECOGNISED] }, 50);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(UNRECOGNISED);
    // The message is actionable: it carries the vocabulary the author needed.
    expect(String(warn.mock.calls[0][0])).toContain('comment');
  });

  it('names EVERY unrecognised kind in the list, in one diagnostic', () => {
    const warn = quiet();
    applyFeedConfig(feed, { types: [UNRECOGNISED, 'crm_deal', 'comment'] }, 50);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(UNRECOGNISED);
    expect(String(warn.mock.calls[0][0])).toContain('crm_deal');
  });

  it('stays SILENT for a well-formed filter — including the empty one', () => {
    // `types: []` is honoured exactly, so there is nothing to report. Warning
    // about a request that was carried out teaches authors to ignore the channel
    // (same posture the unknown-activity-type warning takes above).
    const warn = quiet();
    applyFeedConfig(feed, {}, 50);
    applyFeedConfig(feed, { types: [] }, 50);
    applyFeedConfig(feed, { types: [...SpecFeedItemType.options] }, 50);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the two warning channels apart — one does not silence the other', () => {
    // The vocabularies overlap: `crm_task` is a plausible unmapped
    // `sys_activity.type` AND a plausible unrecognised `types` entry. A shared
    // dedupe bucket would let whichever fired first swallow the other.
    const warn = quiet();
    activityRowToFeedItem({ id: 'z', type: UNRECOGNISED }, 'System');
    applyFeedConfig(feed, { types: [UNRECOGNISED] }, 50);
    expect(warn).toHaveBeenCalledTimes(2);
    resetUnknownActivityTypeWarnings();
  });
});

describe('mergeFeedItems', () => {
  it('de-duplicates by id and sorts chronologically', () => {
    const merged = mergeFeedItems(
      [item({ id: 'b', type: 'comment', createdAt: '2026-01-02T00:00:00.000Z' })],
      [
        item({ id: 'a', type: 'comment', createdAt: '2026-01-01T00:00:00.000Z' }),
        item({ id: 'b', type: 'comment', createdAt: '2026-01-02T00:00:00.000Z', body: 'newer' }),
      ],
    );
    expect(merged.map((i) => i.id)).toEqual(['a', 'b']);
    expect(merged[1].body).toBe('newer');
  });
});
