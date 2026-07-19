/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:history` — renders an audit-log timeline for the current record.
 * Thin wrapper around `<HistoryTimeline>`.
 *
 * Data model: a host MAY pass `entries` (array of history rows) + `loading`
 * directly (RecordDetailView's synthesizer path does this). When no host
 * entries are supplied — e.g. the block is hand-authored inside a `page:tabs`
 * on a custom record page — the renderer SELF-FETCHES from `sys_activity`
 * (the same source the discussion/activity feed reads), scoped to the current
 * record via `useRecordContext`. This makes `record:history` drop-anywhere,
 * matching `record:related_list`'s self-fetch behaviour, instead of silently
 * showing "No history yet".
 */

import React from 'react';
import { useRecordContext } from '@object-ui/react';
import { HistoryTimeline, type HistoryEntry } from '../HistoryTimeline';

const splitDesigner = (props: Record<string, any>) => {
  const { 'data-obj-id': id, 'data-obj-type': type, style, ...rest } = props || {};
  return { designer: { 'data-obj-id': id, 'data-obj-type': type, style }, rest };
};

export interface RecordHistoryRendererProps {
  schema?: {
    entries?: HistoryEntry[];
    loading?: boolean;
    emptyText?: string;
    unknownUserText?: string;
    limit?: number;
    properties?: Record<string, any>;
    [k: string]: any;
  };
  className?: string;
  [k: string]: any;
}

/** sys_activity row → HistoryEntry. Only field-mutating activity types map to
 *  history (comments/mentions/logins are not record-history). */
const HISTORY_TYPES = new Set(['created', 'updated', 'assigned', 'shared', 'deleted']);

export const RecordHistoryRenderer: React.FC<RecordHistoryRendererProps> = ({
  schema = {} as any,
  className,
  ...props
}) => {
  const { designer } = splitDesigner(props);
  const ctx = useRecordContext() as any;

  // Spec bridge inlines `properties.*` onto the node but also preserves the raw
  // bag. Read from either location for compatibility.
  const hostEntries: HistoryEntry[] | undefined = Array.isArray(schema.entries)
    ? schema.entries
    : Array.isArray(schema.properties?.entries)
      ? (schema.properties!.entries as HistoryEntry[])
      : undefined;
  const hostLoading = schema.loading ?? schema.properties?.loading;
  const emptyText = schema.emptyText ?? schema.properties?.emptyText;
  const unknownUserText = schema.unknownUserText ?? schema.properties?.unknownUserText;
  const limit: number = Number(schema.limit ?? schema.properties?.limit ?? 50) || 50;

  // Self-fetch only when the host did not supply entries.
  const objectName: string | undefined = ctx?.objectName;
  const recordId = ctx?.data?.id ?? ctx?.data?._id ?? ctx?.recordId;
  const dataSource = ctx?.dataSource;
  const canSelfFetch = hostEntries === undefined && !!dataSource?.find && !!objectName && recordId != null;

  const [fetched, setFetched] = React.useState<HistoryEntry[] | null>(null);
  const [selfLoading, setSelfLoading] = React.useState(false);

  React.useEffect(() => {
    if (!canSelfFetch) return;
    let cancelled = false;
    setSelfLoading(true);
    Promise.resolve(
      dataSource.find('sys_activity', {
        $filter: { object_name: objectName, record_id: recordId },
        $orderby: { timestamp: 'desc' },
        $top: Math.max(1, limit),
      }),
    )
      .then((res: any) => {
        if (cancelled) return;
        const rows: any[] = res?.data ?? res?.records ?? [];
        const mapped: HistoryEntry[] = rows
          .filter((r) => HISTORY_TYPES.has(r?.type))
          .map((r) => {
            let when = r.timestamp;
            if (!when || when === 'NOW()' || Number.isNaN(Date.parse(when))) when = r.created_at;
            return {
              id: r.id,
              created_at: when,
              action: r.type,
              user_name: r.actor_name ?? null,
              user_avatar: r.actor_avatar_url ?? null,
              summary: r.summary ?? null,
            } as HistoryEntry;
          });
        setFetched(mapped);
      })
      .catch(() => { if (!cancelled) setFetched([]); })
      .finally(() => { if (!cancelled) setSelfLoading(false); });
    return () => { cancelled = true; };
  }, [canSelfFetch, dataSource, objectName, recordId, limit]);

  const entries: HistoryEntry[] = hostEntries ?? fetched ?? [];
  const loading = hostLoading ?? (canSelfFetch && fetched === null ? selfLoading || true : false);

  return (
    <div className={className} {...designer}>
      <HistoryTimeline entries={entries} loading={loading} emptyText={emptyText} unknownUserText={unknownUserText} />
    </div>
  );
};

export default RecordHistoryRenderer;
