/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Card, CardHeader, CardTitle, CardContent, Button } from '@object-ui/components';
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
  onAddComment?: (text: string) => void | Promise<void>;
  /** Called when a reply is submitted */
  onAddReply?: (parentId: string | number, text: string) => void | Promise<void>;
  /** Called when user toggles a reaction */
  onToggleReaction?: (itemId: string | number, emoji: string) => void | Promise<void>;
  /** Subscription state */
  subscription?: RecordSubscription;
  /** Called when user toggles subscription */
  onToggleSubscription?: (subscribed: boolean) => void | Promise<void>;
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

const FILTER_OPTIONS: { value: FeedFilterMode; label: string }[] = [
  { value: 'all', label: 'All Activity' },
  { value: 'comments_only', label: 'Comments Only' },
  { value: 'changes_only', label: 'Field Changes' },
  { value: 'tasks_only', label: 'Tasks Only' },
];

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
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
  loading = false,
  onAddComment,
  onAddReply,
  onToggleReaction,
  subscription,
  onToggleSubscription,
  className,
}) => {
  const [internalFilter, setInternalFilter] = React.useState<FeedFilterMode>('all');
  const [commentText, setCommentText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

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
    if (!text || !onAddComment) return;
    setIsSubmitting(true);
    try {
      await onAddComment(text);
      setCommentText('');
    } finally {
      setIsSubmitting(false);
    }
  }, [commentText, onAddComment]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleAddComment();
      }
    },
    [handleAddComment],
  );

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
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Activity
            <span className="text-sm font-normal text-muted-foreground">
              ({filtered.length})
            </span>
          </CardTitle>
          <div className="flex items-center gap-1">
            {showSubscription && subscription && (
              <SubscriptionToggle
                subscription={subscription}
                onToggle={onToggleSubscription}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter dropdown */}
        {showFilter && (
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-input bg-background px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={activeFilter}
              onChange={(e) => handleFilterChange(e.target.value as FeedFilterMode)}
              aria-label="Filter activity"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Comment Input */}
        {showCommentInput && (
          <div className="flex gap-2">
            <textarea
              className="flex-1 min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Leave a comment… (Ctrl+Enter to submit)"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
            />
            <Button
              size="icon"
              variant="default"
              onClick={handleAddComment}
              disabled={!commentText.trim() || isSubmitting}
              className="shrink-0 self-end"
              aria-label="Submit comment"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Timeline */}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity recorded
          </p>
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
                              via {item.source}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(item.createdAt)}
                          </span>
                          {item.edited && (
                            <span className="text-xs text-muted-foreground italic">(edited)</span>
                          )}
                          {item.pinned && (
                            <span className="text-xs text-amber-600">📌 Pinned</span>
                          )}
                        </div>

                        {/* Body text */}
                        {item.body && (
                          <p className="text-sm whitespace-pre-wrap break-words text-muted-foreground">
                            {item.body}
                          </p>
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
              aria-label="Load more activity"
            >
              {isLoadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-1" />
              )}
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
