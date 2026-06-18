/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, DataEmptyState } from '@object-ui/components';
import {
  Activity,
  Edit,
  PlusCircle,
  Trash2,
  MessageSquare,
  ArrowRightLeft,
  Calendar,
  CheckSquare,
  Zap,
  Mail,
  Phone,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import type { FeedItem, FeedItemType, RecordActivityComponentProps, RecordSubscription } from '@object-ui/types';
import { FieldChangeItem } from './FieldChangeItem';
import { ReactionPicker } from './ReactionPicker';
import { ThreadedReplies } from './ThreadedReplies';
import { SubscriptionToggle } from './SubscriptionToggle';
import { RichTextCommentInput } from './RichTextCommentInput';
import { CommentAttachment, type Attachment } from './CommentAttachment';
import { useDetailTranslation } from './useDetailTranslation';

export type FeedFilterMode = 'all' | 'comments_only' | 'changes_only' | 'tasks_only';

export interface RecordActivityTimelineProps {
  /** Feed items to display */
  items: FeedItem[];
  /** Activity configuration from RecordActivityComponentProps */
  config?: RecordActivityComponentProps;
  /** Filter mode for the timeline */
  filterMode?: FeedFilterMode;
  /** Called when filter mode changes */
  onFilterChange?: (mode: FeedFilterMode) => void;
  /** Whether there are more items to load */
  hasMore?: boolean;
  /** Called when user wants to load more items */
  onLoadMore?: () => void | Promise<void>;
  /** Loading state */
  loading?: boolean;
  /** Called when a comment is submitted */
  onAddComment?: (text: string, attachments?: Attachment[]) => void | Promise<void>;
  /** Called when a reply is submitted */
  onAddReply?: (parentId: string | number, text: string) => void | Promise<void>;
  /** Called when user toggles a reaction */
  onToggleReaction?: (itemId: string | number, emoji: string) => void | Promise<void>;
  /** Subscription state */
  subscription?: RecordSubscription;
  /** Called when user toggles subscription */
  onToggleSubscription?: (subscribed: boolean) => void | Promise<void>;
  /** When true, collapse to only the comment input when there are no items */
  collapseWhenEmpty?: boolean;
  /** Optional list of mention suggestions for the rich comment input. */
  mentionSuggestions?: Array<{ id: string; label: string; avatarUrl?: string }>;
  /** Optional uploader for comment attachments. When provided, the composer
   *  exposes a drag-and-drop file panel. */
  onUploadAttachments?: (files: FileList) => Promise<Attachment[]>;
  /** Override the panel title (defaults to t('detail.activity')) */
  titleLabel?: string;
  /** Override the empty state copy (defaults to t('detail.noActivity')) */
  emptyLabel?: string;
  className?: string;
}

const FEED_TYPE_ICONS: Record<FeedItemType, React.ElementType> = {
  comment: MessageSquare,
  field_change: Edit,
  task: CheckSquare,
  event: Calendar,
  system: Zap,
  email: Mail,
  call: Phone,
};

const FEED_TYPE_COLORS: Record<FeedItemType, string> = {
  comment: 'bg-purple-100 text-purple-600',
  field_change: 'bg-blue-100 text-blue-600',
  task: 'bg-green-100 text-green-600',
  event: 'bg-amber-100 text-amber-600',
  system: 'bg-gray-100 text-gray-600',
  email: 'bg-indigo-100 text-indigo-600',
  call: 'bg-teal-100 text-teal-600',
};

function getFilterOptions(t: (key: string) => string): { value: FeedFilterMode; label: string }[] {
  return [
    { value: 'all', label: t('detail.allActivity') },
    { value: 'comments_only', label: t('detail.commentsOnly') },
    { value: 'changes_only', label: t('detail.fieldChangesFilter') },
    { value: 'tasks_only', label: t('detail.tasksOnly') },
  ];
}

function formatTimestamp(
  timestamp: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('detail.justNow');
    if (diffMins < 60) return t('detail.minutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('detail.hoursAgo', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('detail.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  } catch {
    return timestamp;
  }
}

function filterItems(items: FeedItem[], mode: FeedFilterMode): FeedItem[] {
  switch (mode) {
    case 'comments_only':
      return items.filter((i) => i.type === 'comment');
    case 'changes_only':
      return items.filter((i) => i.type === 'field_change');
    case 'tasks_only':
      return items.filter((i) => i.type === 'task');
    default:
      return items;
  }
}

/**
 * RecordActivityTimeline — Unified timeline renderer for Airtable-style activity feeds.
 *
 * Renders different feed item types (comment, field_change, task, event, system, etc.)
 * in a unified timeline. Supports filtering, pagination, reactions, and threading.
 *
 * Aligned with @objectstack/spec RecordActivityProps.
 */
export const RecordActivityTimeline: React.FC<RecordActivityTimelineProps> = ({
  items,
  config,
  filterMode: controlledFilter,
  onFilterChange,
  hasMore = false,
  onLoadMore,
  loading: _loading = false,
  onAddComment,
  onAddReply,
  onToggleReaction,
  subscription,
  onToggleSubscription,
  collapseWhenEmpty = false,
  mentionSuggestions,
  onUploadAttachments,
  titleLabel,
  emptyLabel,
  className,
}) => {
  const { t } = useDetailTranslation();
  const [internalFilter, setInternalFilter] = React.useState<FeedFilterMode>('all');
  const [commentText, setCommentText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [pendingAttachments, setPendingAttachments] = React.useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  const activeFilter = controlledFilter ?? internalFilter;
  const showFilter = config?.showFilterToggle !== false;
  const showCommentInput = config?.showCommentInput !== false && !!onAddComment;
  const enableReactions = config?.enableReactions ?? false;
  const enableThreading = config?.enableThreading ?? false;
  const showSubscription = config?.showSubscriptionToggle ?? false;

  const filtered = React.useMemo(
    () => filterItems(items, activeFilter),
    [items, activeFilter],
  );

  // Group replies by parentId
  const rootItems = React.useMemo(() => {
    if (!enableThreading) return filtered;
    return filtered.filter((i) => !i.parentId);
  }, [filtered, enableThreading]);

  const repliesByParent = React.useMemo(() => {
    if (!enableThreading) return new Map<string | number, FeedItem[]>();
    const map = new Map<string | number, FeedItem[]>();
    for (const item of filtered) {
      if (item.parentId) {
        const existing = map.get(item.parentId) ?? [];
        existing.push(item);
        map.set(item.parentId, existing);
      }
    }
    return map;
  }, [filtered, enableThreading]);

  const handleFilterChange = React.useCallback(
    (mode: FeedFilterMode) => {
      if (onFilterChange) {
        onFilterChange(mode);
      } else {
        setInternalFilter(mode);
      }
    },
    [onFilterChange],
  );

  const handleAddComment = React.useCallback(async () => {
    const text = commentText.trim();
    if (!onAddComment) return;
    // Allow attachment-only comments when at least one file is attached.
    if (!text && pendingAttachments.length === 0) return;
    setIsSubmitting(true);
    try {
      await onAddComment(
        text,
        pendingAttachments.length > 0 ? pendingAttachments : undefined,
      );
      setCommentText('');
      setPendingAttachments([]);
    } finally {
      setIsSubmitting(false);
    }
  }, [commentText, pendingAttachments, onAddComment]);

  const handleUpload = React.useCallback(
    async (files: FileList) => {
      if (!onUploadAttachments || files.length === 0) return;
      setIsUploading(true);
      try {
        const uploaded = await onUploadAttachments(files);
        if (Array.isArray(uploaded) && uploaded.length > 0) {
          setPendingAttachments((prev) => [...prev, ...uploaded]);
        }
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadAttachments],
  );

  const handleRemoveAttachment = React.useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleLoadMore = React.useCallback(async () => {
    if (!onLoadMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  }, [onLoadMore]);

  return (
    <section
      // De-boxed: render as a naked section with a top divider instead of
      // the previous bordered Card. This keeps the discussion panel
      // visually consistent with the rest of the record-detail page
      // (highlights + tabs are also naked). When the chatter panel is
      // pinned to the right rail it wraps this with its own border, so
      // we don't double up.
      className={cn(
        'border-t border-border/60 pt-5',
        className,
      )}
      aria-label="Discussion"
    >
      <header className="mb-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold leading-none tracking-tight">
            <Activity className="h-4 w-4" />
            {titleLabel ?? t('detail.activity')}
            <span className="text-sm font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </h2>
          <div className="flex items-center gap-1">
            {showSubscription && subscription && (
              <SubscriptionToggle
                subscription={subscription}
                onToggle={onToggleSubscription}
              />
            )}
          </div>
        </div>
      </header>
      <div className="space-y-4">
        {/* Filter dropdown */}
        {showFilter && (
          <div className="flex items-center gap-2">
            <Select
              value={activeFilter}
              onValueChange={(v) => handleFilterChange(v as FeedFilterMode)}
            >
              <SelectTrigger
                aria-label={t('detail.filterActivity')}
                className="h-8 w-auto min-w-[140px] py-1 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getFilterOptions(t).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Comment Input — rich text with @mention + bold/italic/list/code + preview */}
        {showCommentInput && (
          <RichTextCommentInput
            value={commentText}
            onChange={setCommentText}
            onSubmit={handleAddComment}
            mentionSuggestions={mentionSuggestions}
            placeholder={t('detail.leaveCommentPlaceholder')}
            disabled={isSubmitting}
            canSubmitEmpty={pendingAttachments.length > 0}
            extraSlot={
              onUploadAttachments ? (
                <CommentAttachment
                  attachments={pendingAttachments}
                  onUpload={handleUpload}
                  onRemove={handleRemoveAttachment}
                  readOnly={isSubmitting || isUploading}
                />
              ) : pendingAttachments.length > 0 ? (
                <CommentAttachment
                  attachments={pendingAttachments}
                  onRemove={handleRemoveAttachment}
                  readOnly={isSubmitting}
                />
              ) : undefined
            }
          />
        )}

        {/* Timeline */}
        {filtered.length === 0 ? (
          collapseWhenEmpty ? null : (
            <DataEmptyState
              title={emptyLabel ?? t('detail.noActivity')}
              className="py-6"
            />
          )
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {rootItems.map((item) => {
                const Icon = FEED_TYPE_ICONS[item.type] || Zap;
                const colorClass =
                  FEED_TYPE_COLORS[item.type] || 'bg-gray-100 text-gray-600';
                const replies = repliesByParent.get(item.id) ?? [];

                return (
                  <div key={item.id}>
                    <div className="flex gap-3 relative">
                      {/* Icon */}
                      <div
                        className={cn(
                          'shrink-0 h-8 w-8 rounded-full flex items-center justify-center z-10',
                          colorClass,
                        )}
                      >
                        {item.actorAvatarUrl ? (
                          <img
                            src={item.actorAvatarUrl}
                            alt={item.actor}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{item.actor}</span>
                          {item.source && (
                            <span className="text-xs text-muted-foreground">
                              {t('detail.via', { source: item.source })}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(item.createdAt, t)}
                          </span>
                          {item.edited && (
                            <span className="text-xs text-muted-foreground italic">{t('detail.edited')}</span>
                          )}
                          {item.pinned && (
                            <span className="text-xs text-amber-600">📌 {t('detail.pinned')}</span>
                          )}
                        </div>

                        {/* Body text */}
                        {item.body && (
                          <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
                            {item.body}
                          </p>
                        )}

                        {/* Drill to source rich entity (ADR-0052 ActivityPointer) */}
                        {item.sourceObject && item.sourceId != null && (
                          <a
                            href={`/objects/${item.sourceObject}/${item.sourceId}`}
                            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            data-testid="activity-source-link"
                          >
                            {t('detail.viewSource')}
                            <span aria-hidden>→</span>
                          </a>
                        )}

                        {/* Field changes */}
                        {item.type === 'field_change' && item.fieldChanges && (
                          <div className="space-y-1 mt-1">
                            {item.fieldChanges.map((change, idx) => (
                              <FieldChangeItem key={idx} change={change} />
                            ))}
                          </div>
                        )}

                        {/* Reactions */}
                        {enableReactions && item.reactions && item.reactions.length > 0 && (
                          <div className="mt-1.5">
                            <ReactionPicker
                              reactions={item.reactions}
                              onToggleReaction={
                                onToggleReaction
                                  ? (emoji) => onToggleReaction(item.id, emoji)
                                  : undefined
                              }
                            />
                          </div>
                        )}

                        {/* Add reaction button (even if no reactions yet) */}
                        {enableReactions && (!item.reactions || item.reactions.length === 0) && onToggleReaction && (
                          <div className="mt-1.5">
                            <ReactionPicker
                              reactions={[]}
                              onToggleReaction={(emoji) => onToggleReaction(item.id, emoji)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Threading */}
                    {enableThreading && (item.replyCount ?? 0) > 0 && (
                      <ThreadedReplies
                        parentItem={item}
                        replies={replies}
                        onAddReply={onAddReply}
                        showReplyInput={!!onAddReply}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              aria-label={t('detail.loadMore')}
            >
              {isLoadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-1" />
              )}
              {t('detail.loadMore')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};
