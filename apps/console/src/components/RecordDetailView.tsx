/**
 * RecordDetailView Component
 *
 * Renders a detail view for a single record, resolved by URL params.
 * Uses the DetailView plugin component with auto-generated sections from
 * the object field definitions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DetailView } from '@object-ui/plugin-detail';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { CommentThread, PresenceAvatars, type Comment, type PresenceUser } from '@object-ui/collaboration';
import { useAuth } from '@object-ui/auth';
import { Database, MessageSquare, Users } from 'lucide-react';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDetail } from './skeletons';

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
  const [comments, setComments] = useState<Comment[]>([]);
  const [threadResolved, setThreadResolved] = useState(false);
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

    // Fetch persisted comments
    dataSource.find('sys_comment', { $filter: `threadId eq '${threadId}'`, $orderby: 'createdAt asc' })
      .then((res: any) => { if (res.data?.length) setComments(res.data); })
      .catch(() => {});
  }, [dataSource, objectName, recordId]);

  const handleAddComment = useCallback(
    async (content: string, mentions: string[], parentId?: string) => {
      const newComment: Comment = {
        id: crypto.randomUUID(),
        author: currentUser,
        content,
        mentions,
        createdAt: new Date().toISOString(),
        parentId,
      };
      setComments(prev => [...prev, newComment]);
      // Persist to backend
      if (dataSource) {
        const threadId = `${objectName}:${recordId}`;
        dataSource.create('sys_comment', { ...newComment, threadId }).catch(() => {});
      }
    },
    [currentUser, dataSource, objectName, recordId],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (dataSource) {
        dataSource.delete('sys_comment', commentId).catch(() => {});
      }
    },
    [dataSource],
  );

  const handleReaction = useCallback(
    (commentId: string, emoji: string) => {
      setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c;
        const reactions = { ...(c.reactions || {}) };
        const userIds = reactions[emoji] || [];
        if (userIds.includes(currentUser.id)) {
          reactions[emoji] = userIds.filter(id => id !== currentUser.id);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...userIds, currentUser.id];
        }
        const updated = { ...c, reactions };
        // Persist reaction update to backend
        if (dataSource) {
          dataSource.update('sys_comment', commentId, { reactions }).catch(() => {});
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

  const detailSchema = {
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
        fields: Object.keys(objectDef.fields || {}).map(key => ({
          name: key,
          label: objectDef.fields[key].label || key,
          type: objectDef.fields[key].type || 'text',
        })),
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
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments & Discussion
            </h3>
            <CommentThread
              threadId={`${objectName}:${recordId}`}
              comments={comments}
              currentUser={currentUser}
              onAddComment={handleAddComment}
              onDeleteComment={handleDeleteComment}
              onReaction={handleReaction}
              resolved={threadResolved}
              onResolve={setThreadResolved}
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
