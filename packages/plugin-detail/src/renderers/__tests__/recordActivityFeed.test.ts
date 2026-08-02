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

import { describe, it, expect } from 'vitest';
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
} from '../recordActivityFeed';

const item = (over: Partial<FeedItem> & Pick<FeedItem, 'id' | 'type'>): FeedItem => ({
  actor: 'Ada',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('sys_activity row → FeedItem', () => {
  it('maps every activity type the platform writes, and only to spec feed types', () => {
    // The keys are `sys_activity.type`'s select options (plugin-audit
    // sys-activity.object.ts). Pinned as a set so a new activity type added
    // upstream shows up here as a decision rather than silently rendering
    // nothing.
    expect(Object.keys(ACTIVITY_TYPE_TO_FEED_TYPE).sort()).toEqual([
      'assigned', 'commented', 'completed', 'created', 'deleted',
      'login', 'logout', 'mentioned', 'shared', 'system', 'updated',
    ]);
    for (const mapped of Object.values(ACTIVITY_TYPE_TO_FEED_TYPE)) {
      if (mapped) expect(SpecFeedItemType.options).toContain(mapped);
    }
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

  it('keeps only spec feed types in `types`, and treats an all-garbage list as unset', () => {
    expect(normalizeFeedTypes(['comment', 'not_a_type', 'task'])).toEqual(['comment', 'task']);
    expect(normalizeFeedTypes(['not_a_type'])).toBeUndefined();
    expect(normalizeFeedTypes('comment')).toBeUndefined();
    expect(normalizeFeedTypes(undefined)).toBeUndefined();
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

  it('a `types` list of nothing but typos does not silently empty the feed', () => {
    expect(ids(applyFeedConfig(feed, { types: ['commnet'] }, 50))).toEqual(['c1', 'f1', 's1']);
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
