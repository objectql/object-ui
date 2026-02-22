/**
 * RecordDetailView Component
 *
 * Renders a detail view for a single record, resolved by URL params.
 * Uses the DetailView plugin component with auto-generated sections from
 * the object field definitions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DetailView, RecordChatterPanel } from '@object-ui/plugin-detail';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { PresenceAvatars, type PresenceUser } from '@object-ui/collaboration';
import { useAuth } from '@object-ui/auth';
import { Database, Users } from 'lucide-react';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDetail } from './skeletons';
import type { DetailViewSchema, FeedItem } from '@object-ui/types';

interface RecordDetailViewProps {
  dataSource: any;
  objects: any[];
  onEdit: (record: any) => void;
}

const FALLBACK_USER = { id: 'current-user', name: 'Demo User' };

export function RecordDetailView({ dataSource, objects, onEdit }: RecordDetailViewProps) {
  const { objectName, recordId } = useParams();
  const { showDebug, toggleDebug } = useMetadataInspector();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [recordViewers, setRecordViewers] = useState<PresenceUser[]>([]);
  const objectDef = objects.find((o: any) => o.name === objectName);

  const currentUser = user
    ? { id: user.id, name: user.name, avatar: user.image }
    : FALLBACK_USER;

  // Fetch presence and comments from API
  useEffect(() => {
    if (!dataSource || !objectName || !recordId) return;
    const threadId = `${objectName}:${recordId}`;

    // Fetch record viewers
    dataSource.find('sys_presence', { $filter: `recordId eq '${recordId}'` })
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
  }, [dataSource, objectName, recordId]);

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
        const threadId = `${objectName}:${recordId}`;
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
    [currentUser, dataSource, objectName, recordId],
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
        const threadId = `${objectName}:${recordId}`;
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
    [currentUser, dataSource, objectName, recordId],
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
        // Persist reaction update
        if (dataSource) {
          const reactionsMap: Record<string, string[]> = {};
          for (const r of reactions) {
            reactionsMap[r.emoji] = r.reacted
              ? [currentUser.id, ...Array(r.count - 1).fill('other')]
              : Array(r.count).fill('other');
          }
          dataSource.update('sys_comment', String(itemId), { reactions: reactionsMap }).catch(() => {});
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

  const detailSchema: DetailViewSchema = {
    type: 'detail-view',
    objectName: objectDef.name,
    resourceId: recordId,
    showBack: true,
    onBack: 'history',
    showEdit: true,
    title: objectDef.label,
    sections: [
      {
        title: 'Details',
        fields: Object.keys(objectDef.fields || {}).map(key => {
          const fieldDef = objectDef.fields[key];
          return {
            name: key,
            label: fieldDef.label || key,
            type: fieldDef.type || 'text',
            ...(fieldDef.options && { options: fieldDef.options }),
            ...(fieldDef.reference_to && { reference_to: fieldDef.reference_to }),
            ...(fieldDef.reference_field && { reference_field: fieldDef.reference_field }),
            ...(fieldDef.currency && { currency: fieldDef.currency }),
          };
        }),
        columns: 2,
      },
    ],
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
        <MetadataToggle open={showDebug} onToggle={toggleDebug} />
      </div>

      <div className="flex-1 overflow-hidden flex flex-row">
        <div className="flex-1 overflow-auto p-3 sm:p-4 lg:p-6 scroll-pb-48">
          <DetailView
            schema={detailSchema}
            dataSource={dataSource}
            onEdit={() => onEdit({ _id: recordId, id: recordId })}
          />

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
    </div>
  );
}
