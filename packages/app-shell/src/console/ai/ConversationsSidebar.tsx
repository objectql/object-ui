// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Left sidebar listing the signed-in user's AI conversations. Active row is
 * derived from `useParams<{ conversationId }>()`; clicking a row navigates to
 * `/ai/:id`, the "New chat" button navigates to `/ai`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Pencil, MessageSquare, Search, Check, X } from 'lucide-react';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  Button,
  Input,
  ScrollArea,
  Empty,
  EmptyTitle,
  EmptyDescription,
  cn,
} from '@object-ui/components';
import { useConversationList, type ConversationSummary } from '../../hooks/useConversationList';

export interface ConversationsSidebarProps {
  userId: string | undefined;
  apiBase: string;
  className?: string;
  refreshKey?: number | string;
  titleHints?: Record<string, string>;
  onNavigate?: () => void;
}

function formatTimestamp(
  iso: string | undefined,
  t: ReturnType<typeof useObjectTranslation>['t'],
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = now - d.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return t('console.ai.justNow');
  if (diff < hour) return t('console.ai.minutesAgo', { count: Math.floor(diff / min) });
  if (diff < day) return t('console.ai.hoursAgo', { count: Math.floor(diff / hour) });
  if (diff < 7 * day) return t('console.ai.daysAgo', { count: Math.floor(diff / day) });
  return d.toLocaleDateString();
}

export function ConversationsSidebar({
  userId,
  apiBase,
  className,
  refreshKey,
  titleHints,
  onNavigate,
}: ConversationsSidebarProps) {
  const { t } = useObjectTranslation();
  const navigate = useNavigate();
  const { conversationId: activeId } = useParams<{ conversationId?: string }>();
  const { conversations, isLoading, error, remove, rename } = useConversationList({
    userId,
    apiBase,
    refreshKey,
  });

  const [filter, setFilter] = useState('');
  const [renamingId, setRenamingId] = useState<string | undefined>(undefined);

  const decoratedConversations = useMemo(() => {
    return conversations.map((conversation) => {
      const hint = titleHints?.[conversation.id]?.trim();
      if (!hint || conversation.title?.trim() || conversation.preview?.trim()) {
        return conversation;
      }
      return { ...conversation, preview: hint };
    });
  }, [conversations, titleHints]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return decoratedConversations;
    return decoratedConversations.filter((c) => {
      const hay = `${c.title ?? ''} ${c.preview ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [decoratedConversations, filter]);

  const handleNew = useCallback(() => {
    // `?new=1` is the explicit new-conversation intent. A bare `/ai` resumes
    // the last cached conversation (by design), so without the flag this
    // button silently landed back on the current chat.
    navigate('/ai?new=1');
    onNavigate?.();
  }, [navigate, onNavigate]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      await remove(id);
      if (id === activeId) {
        navigate('/ai', { replace: true });
        onNavigate?.();
      }
    },
    [remove, activeId, navigate, onNavigate],
  );

  const handleRenameSubmit = useCallback(
    async (id: string, title: string) => {
      setRenamingId(undefined);
      try {
        await rename(id, title);
      } catch {
        // optimistic update already rolled back via refetch in the hook
      }
    },
    [rename],
  );

  return (
    <aside
      className={cn('flex h-full min-h-0 flex-col bg-muted/30', className)}
      data-testid="ai-conversations-sidebar"
    >
      <div className="flex shrink-0 flex-col gap-2 border-b px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{t('console.ai.chats')}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleNew}
            data-testid="ai-new-chat"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('console.ai.newChat')}
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('console.ai.searchChats')}
            className="h-7 pl-7 text-xs"
            data-testid="ai-conversations-search"
          />
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        {isLoading && conversations.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">{t('common.loading')}</div>
        ) : error ? (
          <div className="px-3 py-4 text-xs text-destructive">
            {error.message}
          </div>
        ) : conversations.length === 0 ? (
          <Empty className="px-3 py-8">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
            <EmptyTitle>{t('console.ai.noChatsYet')}</EmptyTitle>
            <EmptyDescription>{t('console.ai.noChatsDescription')}</EmptyDescription>
          </Empty>
        ) : visible.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">{t('console.ai.noMatchingChats')}</div>
        ) : (
          <ul className="flex flex-col py-1">
            {visible.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                renaming={c.id === renamingId}
                onSelect={() => {
                  navigate(`/ai/${c.id}`);
                  onNavigate?.();
                }}
                onDelete={(e) => handleDelete(e, c.id)}
                onStartRename={() => setRenamingId(c.id)}
                onCancelRename={() => setRenamingId(undefined)}
                onSubmitRename={(title) => handleRenameSubmit(c.id, title)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </aside>
  );
}

interface RowProps {
  conversation: ConversationSummary;
  active: boolean;
  renaming: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSubmitRename: (title: string) => void;
}

function ConversationRow({
  conversation,
  active,
  renaming,
  onSelect,
  onDelete,
  onStartRename,
  onCancelRename,
  onSubmitRename,
}: RowProps) {
  const { t } = useObjectTranslation();
  const title = conversation.title?.trim() || conversation.preview?.trim() || t('console.ai.newConversation');
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      setDraft(conversation.title?.trim() || conversation.preview?.trim() || '');
      // Focus the input on next paint so the click that opened it doesn't blur immediately.
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [renaming, conversation.title, conversation.preview]);

  if (renaming) {
    return (
      <li>
        <div
          className={cn(
            'flex w-full items-center gap-1 border-l-2 px-3 py-2',
            active ? 'border-primary bg-accent' : 'border-transparent',
          )}
          data-testid={`ai-conversation-rename-row-${conversation.id}`}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmitRename(draft);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancelRename();
              }
            }}
            className="h-7 flex-1 text-sm"
            data-testid={`ai-conversation-rename-input-${conversation.id}`}
            aria-label={t('console.ai.renameConversation')}
          />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => onSubmitRename(draft)}
            data-testid={`ai-conversation-rename-confirm-${conversation.id}`}
            aria-label={t('console.ai.saveRename')}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onCancelRename}
            aria-label={t('console.ai.cancelRename')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div
        className={cn(
          'group flex w-full items-start gap-2 border-l-2 border-transparent px-3 py-2 text-sm transition-colors hover:bg-accent/50',
          active && 'border-primary bg-accent',
        )}
        data-testid={`ai-conversation-row-${conversation.id}`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
          data-testid={`ai-conversation-select-${conversation.id}`}
        >
          <span className="line-clamp-1 font-medium">{title}</span>
          {conversation.preview && conversation.preview !== title ? (
            <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
              {conversation.preview}
            </span>
          ) : null}
          <span className="mt-0.5 block text-[10px] text-muted-foreground">
            {formatTimestamp(conversation.updatedAt ?? conversation.createdAt, t)}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:text-primary"
            onClick={onStartRename}
            data-testid={`ai-conversation-rename-${conversation.id}`}
            aria-label={t('console.ai.renameConversation')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 hover:text-destructive"
            onClick={onDelete}
            data-testid={`ai-conversation-delete-${conversation.id}`}
            aria-label={t('console.ai.deleteConversation')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}
