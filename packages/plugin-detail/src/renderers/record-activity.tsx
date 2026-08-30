/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:activity` — unified activity feed (field changes, tasks, system
 * events, comments) scoped to the current record.
 *
 * ## Where the feed comes from (objectui#3165)
 *
 * Three sources, in precedence order:
 *
 *  1. `items` on the node — a host that already owns the feed passes it in,
 *     exactly as `record:history` takes `entries`;
 *  2. `DiscussionContext` — mounted by the page host (app-shell
 *     `RecordDetailView`) with the merged `sys_comment` + `sys_activity` feed
 *     AND the comment / reply / reaction handlers. When it is present the
 *     block presents the host's feed rather than fetching a second, poorer
 *     copy of it;
 *  3. SELF-FETCH from `sys_activity`, scoped to the bound record off
 *     `useRecordContext`. This is what makes the block drop-anywhere — inside
 *     a `page:tabs` on a hand-authored record page, with no host feeding it —
 *     and it mirrors the path `record:history` already has.
 *
 * Until #3165 there was no source at all: the renderer called
 * `useRecordContext()`, discarded the result and rendered
 * `<RecordActivityTimeline items={[]}>` with the empty array hard-coded, while
 * the registration declared eleven inputs that were all filters and
 * affordances over that permanently-empty feed. That is objectstack#4413's
 * shape — declared, published to `sdui.manifest.json`, inert at runtime — and
 * `apps/console/src/__tests__/record-block-record-reach.test.tsx` carried it in
 * its `NO_RECORD_REACH` ledger until this file grew a data path.
 *
 * ## Which declared inputs are live, and where
 *
 * READ side, live on every path (the filters themselves live in
 * `recordActivityFeed.ts`, where they can be asserted without a DOM):
 *   `types` · `limit` · `showCompleted` · `unifiedTimeline` · `filterMode` ·
 *   `showFilterToggle`
 *
 * WRITE side, live exactly when a host `DiscussionContext` supplies the
 * matching handler — the same standing `record:discussion` has, and the reason
 * the wiring below reads them off that context instead of inventing a private
 * one (this package has no access to the current user, so it cannot author a
 * `sys_comment` row on its own):
 *   `showCommentInput` (needs `onAddComment`) · `enableThreading` (replies
 *   need `onAddReply`) · `enableReactions` (needs `onToggleReaction`) ·
 *   `enableMentions` (withholds the @-autocomplete suggestions when off)
 *
 * KNOWN GAP, stated at the registration site and in the docs so an author
 * reading the manifest meets it before writing it:
 *   `showSubscriptionToggle` — the bell needs a `RecordSubscription` and a
 *   persist handler, and the platform has no record-subscription backend to
 *   read or write one (no `sys_*` object for it exists). Declared because
 *   `@objectstack/spec` declares it; inert until that backend does.
 */

import React from 'react';
import { useRecordContext, useDiscussionContext } from '@object-ui/react';
import { useSafeTranslate } from '@object-ui/i18n';
import type { FeedItem, RecordActivityComponentProps } from '@object-ui/types';
import { RecordActivityTimeline, type FeedFilterMode } from '../RecordActivityTimeline';
import {
  activityRowToFeedItem,
  applyFeedConfig,
  mergeFeedItems,
  normalizeFilterMode,
  normalizeLimit,
  type SysActivityRow,
} from './recordActivityFeed';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordActivityRendererProps {
  schema?: RecordActivityComponentProps & {
    /** Host-supplied feed. When present the block presents it instead of
     *  fetching — the `record:history` `entries` convention. */
    items?: FeedItem[];
    /** Host-supplied loading flag, paired with `items`. */
    loading?: boolean;
    properties?: Record<string, any>;
    [k: string]: any;
  };
  className?: string;
  [k: string]: any;
}

export const RecordActivityRenderer: React.FC<RecordActivityRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const { designer } = splitDesigner(props);
  const ctx = useRecordContext() as any;
  const discussion = useDiscussionContext();
  const tt = useSafeTranslate();

  // The spec bridge inlines `properties.*` onto the node but also preserves the
  // raw bag. Read from either location, same as `record:history`.
  const bag = (schema.properties ?? {}) as Record<string, any>;
  const read = (key: string) => (schema as any)[key] ?? bag[key];

  const limit = normalizeLimit(read('limit'));
  const defaultFilterMode = normalizeFilterMode(read('filterMode'));
  const types = read('types');
  const showCompleted = read('showCompleted');
  const unifiedTimeline = read('unifiedTimeline');

  /** Only the declared inputs, normalized — never the whole node. */
  const config: RecordActivityComponentProps = {
    types,
    filterMode: defaultFilterMode,
    showFilterToggle: read('showFilterToggle'),
    limit,
    showCompleted,
    unifiedTimeline,
    showCommentInput: read('showCommentInput'),
    enableMentions: read('enableMentions'),
    enableReactions: read('enableReactions'),
    enableThreading: read('enableThreading'),
    showSubscriptionToggle: read('showSubscriptionToggle'),
  };

  const hostItems: FeedItem[] | undefined = Array.isArray(schema.items)
    ? (schema.items as FeedItem[])
    : Array.isArray(bag.items)
      ? (bag.items as FeedItem[])
      : undefined;
  const hostLoading: boolean | undefined = schema.loading ?? bag.loading;

  const objectName: string | undefined = ctx?.objectName;
  const recordId = ctx?.data?.id ?? ctx?.data?._id ?? ctx?.recordId;
  // `RecordContextValue.dataSource` is typed `string` (a datasource id) while
  // every host passes the object; `record:history` / `record:reference_rail`
  // cast the same way. Matching the runtime beats matching the declaration.
  const dataSource = ctx?.dataSource as any;

  // Self-fetch only when nobody else owns the feed. A mounted DiscussionContext
  // has already merged `sys_comment` + `sys_activity` for this record; fetching
  // again would duplicate the round-trip and render a strictly poorer feed.
  const canSelfFetch =
    hostItems === undefined &&
    !discussion &&
    typeof dataSource?.find === 'function' &&
    !!objectName &&
    recordId != null;

  // Page window. Starts at `limit` and grows by `limit` per "Load more", so the
  // authored `limit` is a page size (the spec's wording) rather than a hard cap.
  //
  // The extra PAGES are the state, not the resulting size: re-authoring `limit`
  // then flows through without an effect that resets a second copy of it (and
  // without the cascading render that pattern costs).
  const [extraPages, setExtraPages] = React.useState(0);
  const pageSize = limit * (extraPages + 1);

  const [fetched, setFetched] = React.useState<FeedItem[] | null>(null);
  // Whether the server had rows beyond the window. Tracked separately from the
  // post-filter count because the filters run AFTER the fetch: a page whose
  // rows were all filtered out still has more rows behind it, and "Load more"
  // has to stay offered or the feed silently truncates.
  const [fetchedHasMore, setFetchedHasMore] = React.useState(false);
  const [selfLoading, setSelfLoading] = React.useState(false);

  const systemActorLabel = tt('detail.systemActor', 'System');

  React.useEffect(() => {
    if (!canSelfFetch) return;
    let cancelled = false;
    setSelfLoading(true);
    Promise.resolve(
      dataSource.find('sys_activity', {
        $filter: { object_name: objectName, record_id: recordId },
        $orderby: { timestamp: 'desc' },
        // One row past the window so "Load more" can be offered honestly.
        $top: Math.max(1, pageSize) + 1,
      }),
    )
      .then((res: any) => {
        if (cancelled) return;
        // `data` is the ONE rows member `QueryResult` (`@object-ui/types`)
        // declares. A `res?.records` arm sat behind it until objectui#6726 — a
        // below-the-adapter spelling (`ObjectStackAdapter.normalizeQueryResult`
        // maps the server/SDK `records` envelope to `data` before returning),
        // so no producer emits it at this `DataSource.find()` seam and the arm
        // was dead. Pinned by `record-activity.contractEnvelope-6726.test.tsx`.
        const raw: unknown = res?.data ?? [];
        const rows: SysActivityRow[] = Array.isArray(raw) ? (raw as SysActivityRow[]) : [];
        const mapped: FeedItem[] = [];
        for (const row of rows) {
          const item = activityRowToFeedItem(row, systemActorLabel);
          if (item) mapped.push(item);
        }
        setFetchedHasMore(rows.length > Math.max(1, pageSize));
        setFetched(mergeFeedItems(mapped));
      })
      .catch(() => {
        // `sys_activity` is system-owned and optional: a 404 on a deployment
        // without the audit plugin is "no activity", not an error to surface.
        if (!cancelled) {
          setFetched([]);
          setFetchedHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) setSelfLoading(false);
      });
    return () => { cancelled = true; };
  }, [canSelfFetch, dataSource, objectName, recordId, pageSize, systemActorLabel]);

  const discussionItems = discussion?.items as FeedItem[] | undefined;
  const applied = React.useMemo(() => {
    const sourceItems: FeedItem[] = hostItems ?? discussionItems ?? fetched ?? [];
    return applyFeedConfig(sourceItems, { types, showCompleted, unifiedTimeline }, pageSize);
  }, [hostItems, discussionItems, fetched, types, showCompleted, unifiedTimeline, pageSize]);
  const items = applied.items;
  const hasMore = applied.hasMore || (canSelfFetch && fetchedHasMore);

  const loading =
    hostLoading ?? discussion?.loading ?? (canSelfFetch && fetched === null ? true : selfLoading);

  // The timeline takes `filterMode` as a CONTROLLED prop, so the authored
  // `filterMode` becomes the initial state here and the dropdown stays usable —
  // passing it straight through would freeze the dropdown on the authored value.
  const [filterMode, setFilterMode] = React.useState<FeedFilterMode>(defaultFilterMode);
  React.useEffect(() => { setFilterMode(defaultFilterMode); }, [defaultFilterMode]);

  const handleLoadMore = React.useCallback(() => {
    setExtraPages((n) => n + 1);
  }, []);

  // Write path: whatever the host's DiscussionContext provides, nothing more.
  // `enableMentions: false` withholds the suggestion list, which is what turns
  // the composer's @-autocomplete off.
  const mentionsEnabled = config.enableMentions !== false;

  return (
    <div className={className} {...designer}>
      <RecordActivityTimeline
        items={items}
        config={config}
        loading={loading}
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onAddComment={discussion?.onAddComment as any}
        onAddReply={discussion?.onAddReply as any}
        onToggleReaction={discussion?.onToggleReaction as any}
        mentionSuggestions={mentionsEnabled ? (discussion?.mentionSuggestions as any) : undefined}
        onUploadAttachments={discussion?.onUploadAttachments as any}
      />
    </div>
  );
};

export default RecordActivityRenderer;
