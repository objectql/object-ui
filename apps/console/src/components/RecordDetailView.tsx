/**
 * RecordDetailView Component
 *
 * Renders a detail view for a single record, resolved by URL params.
 * Uses the DetailView plugin component with auto-generated sections from
 * the object field definitions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DetailView, RecordChatterPanel } from '@object-ui/plugin-detail';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { PresenceAvatars, type PresenceUser } from '@object-ui/collaboration';
import { useAuth } from '@object-ui/auth';
import { ActionProvider, useObjectTranslation } from '@object-ui/react';
import { toast } from 'sonner';
import { Database, Users } from 'lucide-react';
import { MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDetail } from './skeletons';
import { ActionConfirmDialog, type ConfirmDialogState } from './ActionConfirmDialog';
import { ActionParamDialog, type ParamDialogState } from './ActionParamDialog';
import type { DetailViewSchema, FeedItem, HighlightField, SectionGroup } from '@object-ui/types';
import type { ActionDef, ActionParamDef } from '@object-ui/core';

interface RecordDetailViewProps {
  dataSource: any;
  objects: any[];
  onEdit: (record: any) => void;
}

const FALLBACK_USER = { id: 'current-user', name: 'Demo User' };

/** Field names automatically promoted to the highlight banner when present. */
const HIGHLIGHT_FIELD_NAMES = ['status', 'stage', 'priority', 'category', 'type', 'owner', 'amount'];

export function RecordDetailView({ dataSource, objects, onEdit }: RecordDetailViewProps) {
  const { objectName, recordId } = useParams();
  const { showDebug } = useMetadataInspector();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useObjectTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [recordViewers, setRecordViewers] = useState<PresenceUser[]>([]);
  const [actionRefreshKey, setActionRefreshKey] = useState(0);
  const [childRelatedData, setChildRelatedData] = useState<Record<string, any[]>>({});
  const objectDef = objects.find((o: any) => o.name === objectName);

  // Use the URL recordId as-is — it contains the actual record _id.
  // Navigation code passes `record._id || record.id` directly into the URL
  // without adding any prefix, so no stripping is needed.
  const pureRecordId = recordId;

  // ─── Action Provider Handlers ───────────────────────────────────────

  // Confirm dialog state (promise-based)
  const [confirmState, setConfirmState] = useState<ConfirmDialogState>({ open: false, message: '' });

  // Param collection dialog state (promise-based)
  const [paramState, setParamState] = useState<ParamDialogState>({ open: false, params: [] });

  const confirmHandler = useCallback((message: string, options?: { title?: string; confirmText?: string; cancelText?: string }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ open: true, message, options, resolve });
    });
  }, []);

  const paramCollectionHandler = useCallback((params: ActionParamDef[]) => {
    return new Promise<Record<string, any> | null>((resolve) => {
      setParamState({ open: true, params, resolve });
    });
  }, []);

  const toastHandler = useCallback((message: string, options?: { type?: string }) => {
    if (options?.type === 'error') toast.error(message);
    else toast.success(message);
  }, []);

  const navigateHandler = useCallback((url: string, options?: { external?: boolean; newTab?: boolean }) => {
    if (options?.external || options?.newTab) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
    }
  }, [navigate]);

  // API action handler — maps logical action targets to dataSource operations
  const apiHandler = useCallback(async (action: ActionDef) => {
    try {
      const target = action.target || action.name;
      const params = action.params || {};

      switch (target) {
        case 'opportunity_change_stage':
          await dataSource.update(objectName!, pureRecordId!, { stage: params.new_stage });
          break;
        case 'opportunity_mark_won':
          await dataSource.update(objectName!, pureRecordId!, { stage: 'closed_won' });
          break;
        case 'opportunity_mark_lost':
          await dataSource.update(objectName!, pureRecordId!, { stage: 'closed_lost', loss_reason: params.loss_reason });
          break;
        default:
          // Generic: update record with collected params
          if (Object.keys(params).length > 0) {
            await dataSource.update(objectName!, pureRecordId!, params);
          }
          break;
      }

      const shouldRefresh = action.refreshAfter === true;
      if (shouldRefresh) {
        setActionRefreshKey(k => k + 1);
      }
      return { success: true, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }, [dataSource, objectName, pureRecordId]);

  // Discover reverse references: other objects with lookup/master_detail fields
  // pointing to the current object (e.g., order_item.order → order).
  const childRelations = useMemo(() => {
    if (!objectDef || !objects) return [];
    const relations: Array<{ childObject: string; childLabel: string; referenceField: string }> = [];
    for (const obj of objects) {
      if (obj.name === objectDef.name) continue;
      for (const [fieldName, fieldDef] of Object.entries<any>(obj.fields || {})) {
        if (
          fieldDef &&
          (fieldDef.type === 'lookup' || fieldDef.type === 'master_detail') &&
          (fieldDef.reference_to || fieldDef.reference) === objectDef.name
        ) {
          relations.push({
            childObject: obj.name,
            childLabel: obj.label || obj.name,
            referenceField: fieldName,
          });
        }
      }
    }
    return relations;
  }, [objectDef, objects]);

  // Fetch related child records for each reverse reference
  useEffect(() => {
    if (!dataSource || !pureRecordId || childRelations.length === 0) return;
    let cancelled = false;
    Promise.all(
      childRelations.map(({ childObject, referenceField }) =>
        dataSource.find(childObject, {
          $filter: { [referenceField]: pureRecordId },
        })
          .then((res: any) => {
            const items = Array.isArray(res) ? res : res?.data || [];
            return { childObject, items };
          })
          .catch((err: any) => {
            console.warn(`[RecordDetailView] Failed to fetch related ${childObject}:`, err);
            return { childObject, items: [] as any[] };
          })
      )
    ).then((results) => {
      if (cancelled) return;
      const data: Record<string, any[]> = {};
      for (const { childObject, items } of results) {
        data[childObject] = items;
      }
      setChildRelatedData(data);
    });
    return () => { cancelled = true; };
  }, [dataSource, pureRecordId, childRelations]);

  const currentUser = user
    ? { id: user.id, name: user.name, avatar: user.image }
    : FALLBACK_USER;

  // Fetch presence and comments from API
  useEffect(() => {
    if (!dataSource || !objectName || !pureRecordId) return;
    const threadId = `${objectName}:${pureRecordId}`;

    // Fetch record viewers
    dataSource.find('sys_presence', { $filter: `recordId eq '${pureRecordId}'` })
      .then((res: any) => { if (res.data?.length) setRecordViewers(res.data); })
      .catch(() => {});

    // Fetch persisted comments and map to FeedItem[]
    dataSource.find('sys_comment', { $filter: `threadId eq '${threadId}'`, $orderby: 'createdAt asc' })
      .then((res: any) => {
        if (res.data?.length) {
          setFeedItems(res.data.map((c: any) => ({
            id: c.id,
            type: 'comment' as const,
            actor: c.author?.name ?? 'Unknown',
            actorAvatarUrl: c.author?.avatar,
            body: c.content,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            parentId: c.parentId,
            reactions: c.reactions
              ? Object.entries(c.reactions as Record<string, string[]>).map(([emoji, userIds]) => ({
                  emoji,
                  count: userIds.length,
                  reacted: userIds.includes(currentUser.id),
                }))
              : undefined,
          })));
        }
      })
      .catch(() => {});
  }, [dataSource, objectName, pureRecordId, currentUser]);

  const handleAddComment = useCallback(
    async (text: string) => {
      const newItem: FeedItem = {
        id: crypto.randomUUID(),
        type: 'comment',
        actor: currentUser.name,
        actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
        body: text,
        createdAt: new Date().toISOString(),
      };
      setFeedItems(prev => [...prev, newItem]);
      // Persist to backend
      if (dataSource) {
        const threadId = `${objectName}:${pureRecordId}`;
        dataSource.create('sys_comment', {
          id: newItem.id,
          threadId,
          author: currentUser,
          content: text,
          mentions: [],
          createdAt: newItem.createdAt,
        }).catch(() => {});
      }
    },
    [currentUser, dataSource, objectName, pureRecordId],
  );

  const handleAddReply = useCallback(
    async (parentId: string | number, text: string) => {
      const newItem: FeedItem = {
        id: crypto.randomUUID(),
        type: 'comment',
        actor: currentUser.name,
        actorAvatarUrl: 'avatar' in currentUser ? (currentUser as any).avatar : undefined,
        body: text,
        createdAt: new Date().toISOString(),
        parentId,
      };
      setFeedItems(prev => {
        const updated = [...prev, newItem];
        // Increment replyCount on parent
        return updated.map(item =>
          item.id === parentId
            ? { ...item, replyCount: (item.replyCount ?? 0) + 1 }
            : item
        );
      });
      if (dataSource) {
        const threadId = `${objectName}:${pureRecordId}`;
        dataSource.create('sys_comment', {
          id: newItem.id,
          threadId,
          author: currentUser,
          content: text,
          mentions: [],
          createdAt: newItem.createdAt,
          parentId,
        }).catch(() => {});
      }
    },
    [currentUser, dataSource, objectName, pureRecordId],
  );

  const handleToggleReaction = useCallback(
    (itemId: string | number, emoji: string) => {
      setFeedItems(prev => prev.map(item => {
        if (item.id !== itemId) return item;
        const reactions = [...(item.reactions ?? [])];
        const idx = reactions.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          const r = reactions[idx];
          if (r.reacted) {
            // Remove user's reaction
            if (r.count <= 1) {
              reactions.splice(idx, 1);
            } else {
              reactions[idx] = { ...r, count: r.count - 1, reacted: false };
            }
          } else {
            reactions[idx] = { ...r, count: r.count + 1, reacted: true };
          }
        } else {
          reactions.push({ emoji, count: 1, reacted: true });
        }
        const updated = { ...item, reactions };
        // Persist reaction toggle to backend
        if (dataSource) {
          dataSource.update('sys_comment', String(itemId), {
            $toggleReaction: { emoji, userId: currentUser.id },
          }).catch(() => {});
        }
        return updated;
      }));
    },
    [currentUser.id, dataSource],
  );

  useEffect(() => {
    // Reset loading on navigation; the actual DetailView handles data fetching
    setIsLoading(true);
    queueMicrotask(() => setIsLoading(false));
  }, [objectName, recordId]);

  if (isLoading) {
    return <SkeletonDetail />;
  }

  if (!objectDef) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Database className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>Object Not Found</EmptyTitle>
          <EmptyDescription>
            Object &quot;{objectName}&quot; definition missing.
            Check your configuration or navigate back to select a valid object.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  // Auto-detect primary field: prefer objectDef metadata, then 'name' or 'title' heuristic
  const primaryField = objectDef.primaryField
    || Object.keys(objectDef.fields || {}).find(
      (key) => key === 'name' || key === 'title'
    );

  // Build sections: prefer form sections from objectDef, fallback to flat field list
  const formSections = objectDef.views?.form?.sections;
  const sections = formSections && formSections.length > 0
    ? formSections.map((sec: any) => ({
        title: sec.title,
        collapsible: sec.collapsible,
        defaultCollapsed: sec.defaultCollapsed,
        fields: (sec.fields || []).map((f: any) => {
          const fieldName = typeof f === 'string' ? f : f.name;
          const fieldDef = objectDef.fields[fieldName];
          if (!fieldDef) {
            console.warn(`[RecordDetailView] Field "${fieldName}" not found in ${objectDef.name} definition`);
            return { name: fieldName, label: fieldName };
          }
          const refTarget = fieldDef.reference_to || fieldDef.reference;
          return {
            name: fieldName,
            label: fieldDef.label || fieldName,
            type: fieldDef.type || 'text',
            ...(fieldDef.options && { options: fieldDef.options }),
            ...(refTarget && { reference_to: refTarget }),
            ...(fieldDef.reference_field && { reference_field: fieldDef.reference_field }),
            ...(fieldDef.currency && { currency: fieldDef.currency }),
          };
        }),
      }))
    : [
        {
          title: t('detail.details', { defaultValue: 'Details' }),
          fields: Object.keys(objectDef.fields || {}).map(key => {
            const fieldDef = objectDef.fields[key];
            const refTarget = fieldDef.reference_to || fieldDef.reference;
            return {
              name: key,
              label: fieldDef.label || key,
              type: fieldDef.type || 'text',
              ...(fieldDef.options && { options: fieldDef.options }),
              ...(refTarget && { reference_to: refTarget }),
              ...(fieldDef.reference_field && { reference_field: fieldDef.reference_field }),
              ...(fieldDef.currency && { currency: fieldDef.currency }),
            };
          }),
        },
      ];

  // Filter actions for record_header location
  const recordHeaderActions = (objectDef.actions || []).filter(
    (a: any) => a.locations?.includes('record_header'),
  );

  // Build highlightFields: prefer explicit config, fallback to auto-detect key fields
  const explicitHighlight: HighlightField[] | undefined = objectDef.views?.detail?.highlightFields;
  const highlightFields: HighlightField[] = explicitHighlight
    ?? Object.entries(objectDef.fields || {})
      .filter(([key]: [string, any]) => HIGHLIGHT_FIELD_NAMES.includes(key))
      .map(([key, def]: [string, any]) => ({
        name: key,
        label: def.label || key,
        ...(def.type && { type: def.type }),
      }));

  // Build sectionGroups from objectDef detail/form config if available
  const sectionGroups: SectionGroup[] | undefined =
    objectDef.views?.detail?.sectionGroups ?? objectDef.views?.form?.sectionGroups;

  // Build related entries from reverse-reference child objects
  const related = childRelations.map(({ childObject, childLabel }) => ({
    title: childLabel,
    type: 'table' as const,
    api: childObject,
    data: childRelatedData[childObject] || [],
  }));

  const detailSchema: DetailViewSchema = {
    type: 'detail-view',
    objectName: objectDef.name,
    resourceId: pureRecordId,
    showBack: true,
    onBack: 'history',
    showEdit: true,
    title: objectDef.label,
    primaryField,
    sections,
    autoTabs: true,
    autoDiscoverRelated: true,
    ...(related.length > 0 && { related }),
    ...(highlightFields.length > 0 && { highlightFields }),
    ...(sectionGroups && sectionGroups.length > 0 && { sectionGroups }),
    ...(recordHeaderActions.length > 0 && {
      actions: [{
        type: 'action:bar',
        location: 'record_header',
        actions: recordHeaderActions,
      } as any],
    }),
  };

  return (
    <div className="h-full bg-background overflow-hidden flex flex-col relative">
      <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-50 flex items-center gap-2">
        {/* Presence: who else is viewing this record */}
        {recordViewers.length > 0 && (
          <div className="flex items-center gap-1.5" title="Users viewing this record">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <PresenceAvatars users={recordViewers} size="sm" maxVisible={4} showStatus />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 scroll-pb-48">
          <ActionProvider
            context={{ record: {}, objectName, user: currentUser }}
            onConfirm={confirmHandler}
            onToast={toastHandler}
            onNavigate={navigateHandler}
            onParamCollection={paramCollectionHandler}
            handlers={{ api: apiHandler }}
          >
            <DetailView
              key={actionRefreshKey}
              schema={detailSchema}
              dataSource={dataSource}
              onEdit={() => {
                onEdit({ _id: pureRecordId, id: pureRecordId });
              }}
            />
          </ActionProvider>

          {/* Comments & Discussion */}
          <div className="mt-6 border-t pt-6">
            <RecordChatterPanel
              config={{
                position: 'bottom',
                collapsible: false,
                feed: {
                  enableReactions: true,
                  enableThreading: true,
                  showCommentInput: true,
                },
              }}
              items={feedItems}
              onAddComment={handleAddComment}
              onAddReply={handleAddReply}
              onToggleReaction={handleToggleReaction}
            />
          </div>
        </div>
        <MetadataPanel
          open={showDebug}
          sections={[{ title: 'View Schema', data: detailSchema }]}
        />
      </div>

      {/* Action Confirm Dialog */}
      <ActionConfirmDialog
        state={confirmState}
        onOpenChange={(open) => {
          if (!open) setConfirmState(s => ({ ...s, open: false }));
        }}
      />

      {/* Action Param Collection Dialog */}
      <ActionParamDialog
        state={paramState}
        onOpenChange={(open) => {
          if (!open) setParamState(s => ({ ...s, open: false }));
        }}
      />
    </div>
  );
}
