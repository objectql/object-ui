/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';
import { cn, Button } from '@object-ui/components';
import { MessageSquare, ChevronDown, ChevronRight, Send } from 'lucide-react';
import type { FeedItem } from '@object-ui/types';

export interface ThreadedRepliesProps {
  /** Parent feed item (root comment) */
  parentItem: FeedItem;
  /** Reply feed items (children) */
  replies: FeedItem[];
  /** Called when a reply is submitted */
  onAddReply?: (parentId: string | number, text: string) => void | Promise<void>;
  /** Whether to show the reply input */
  showReplyInput?: boolean;
  className?: string;
}

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

/**
 * ThreadedReplies — Displays a collapsible thread of replies under a parent comment.
 * Supports adding new replies and showing reply count.
 */
export const ThreadedReplies: React.FC<ThreadedRepliesProps> = ({
  parentItem,
  replies,
  onAddReply,
  showReplyInput = true,
  className,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const [replyText, setReplyText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmitReply = React.useCallback(async () => {
    const text = replyText.trim();
    if (!text || !onAddReply) return;
    setIsSubmitting(true);
    try {
      await onAddReply(parentItem.id, text);
      setReplyText('');
    } finally {
      setIsSubmitting(false);
    }
  }, [replyText, onAddReply, parentItem.id]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmitReply();
      }
    },
    [handleSubmitReply],
  );

  if (replies.length === 0 && !showReplyInput) return null;

  return (
    <div className={cn('ml-10 mt-1', className)}>
      {/* Toggle */}
      {replies.length > 0 && (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <MessageSquare className="h-3 w-3" />
          <span>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</span>
        </button>
      )}

      {/* Replies list */}
      {expanded && (
        <div className="space-y-2 border-l-2 border-border pl-3">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <div className="shrink-0">
                {reply.actorAvatarUrl ? (
                  <img
                    src={reply.actorAvatarUrl}
                    alt={reply.actor}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                    {reply.actor.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{reply.actor}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTimestamp(reply.createdAt)}
                  </span>
                </div>
                <p className="text-xs whitespace-pre-wrap break-words">{reply.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && onAddReply && (
        <div className="flex gap-1.5 mt-1.5">
          <input
            className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={handleSubmitReply}
            disabled={!replyText.trim() || isSubmitting}
            aria-label="Send reply"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
