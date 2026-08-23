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
} from '../recordActivityFeed';

const item = (over: Partial<FeedItem> & Pick<FeedItem, 'id' | 'type'>): FeedItem => ({
  actor: 'Ada',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

/**
 * The two vocabularies this map has to cover (objectui#5840).
 *
 * They are LITERALS on purpose, in both groups, for the reason plugin-audit's
 * own `sys-activity-type-vocabulary.test.ts` gives: a pin that read its
 * expectation out of the thing it is pinning cannot fail. The cost is that a
 * human redoes the census when either group moves, which is the point.
 */

/**
 * plugin-audit's declared `sys_activity.type` select options
 * (`sys-activity.object.ts`). A new option added upstream should show up here
 * as a DECISION rather than as a row that silently renders nothing.
 */
const DECLARED_UPSTREAM_TYPES = [
  'assigned', 'commented', 'completed', 'created', 'deleted',
  'login', 'logout', 'mentioned', 'shared', 'system', 'updated',
] as const;

/**
 * Values a shipped producer measurably WRITES while being undeclared upstream.
 *
 * This group exists because the declaration is not a contract: every field on
 * `sys_activity` is `readonly: true` and objectql's `validateRecord` skips
 * readonly fields, so an undeclared value is stored silently. The second
 * element names the producer — add the producer before adding the row.
 *
 * Whether the upstream enum should absorb these is a platform ruling, not this
 * block's; until it is made, rendering them is what stops a stored row from
 * being invisible.
 */
const UNDECLARED_BUT_WRITTEN_TYPES: ReadonlyArray<readonly [type: string, writer: string]> = [
  [
    'scheduled',
    'hotcrm/src/actions/global.actions.ts — schedule_meeting: '
      + "type: EVENT_STATUS === 'held' ? 'completed' : 'scheduled'; registered for "
      + 'crm_lead / crm_contact / crm_account / crm_opportunity / crm_case',
  ],
];

describe('sys_activity row → FeedItem', () => {
  it('covers the declared vocabulary AND the values producers actually write', () => {
    expect(Object.keys(ACTIVITY_TYPE_TO_FEED_TYPE).sort()).toEqual(
      [...DECLARED_UPSTREAM_TYPES, ...UNDECLARED_BUT_WRITTEN_TYPES.map(([t]) => t)].sort(),
    );
    for (const mapped of Object.values(ACTIVITY_TYPE_TO_FEED_TYPE)) {
      if (mapped) expect(SpecFeedItemType.options).toContain(mapped);
    }
  });

  it.each(UNDECLARED_BUT_WRITTEN_TYPES)(
    'renders %s — it is stored by a real producer, so dropping it loses data',
    (type, writer) => {
      expect(
        activityRowToFeedItem({ id: 'x', type }, 'System'),
        `'${type}' must keep reaching the feed: it is written by ${writer}. `
          + 'It is absent from plugin-audit\'s declared options and lands anyway, '
          + 'because readonly fields are never validated on write — so the enum '
          + 'cannot be used as the list of what this map has to handle.',
      ).not.toBeNull();
    },
  );

  /**
   * Regression control for the #5840 change: the entries that existed before
   * `scheduled` was added still resolve exactly as they did. Written as the
   * whole table rather than as "not broken" so a future edit that RE-points an
   * existing type has to say so here.
   */
  it('leaves every previously-mapped type pointing where it did', () => {
    expect({ ...ACTIVITY_TYPE_TO_FEED_TYPE, scheduled: undefined }).toEqual({
      created: 'field_change',
      updated: 'field_change',
      deleted: 'field_change',
      assigned: 'field_change',
      shared: 'field_change',
      system: 'system',
      completed: 'task',
      commented: undefined,
      mentioned: undefined,
      login: undefined,
      logout: undefined,
      scheduled: undefined,
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

  it('still DROPS a type nothing maps — the fix is an addition, not a catch-all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(activityRowToFeedItem({ id: 'z', type: 'teleported' }, 'System')).toBeNull();
    expect(activityRowToFeedItem({ id: 'z2' }, 'System')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0][0])).toContain('teleported');
  });

  it('warns once per unknown type, not once per row', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 5; i += 1) {
      activityRowToFeedItem({ id: `z${i}`, type: 'teleported' }, 'System');
    }
    expect(warn).toHaveBeenCalledTimes(1);
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
