// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Left sidebar listing the signed-in user's AI conversations. Active row is
 * derived from `useParams<{ conversationId }>()`; clicking a row navigates to
 * `/ai/:id`, the "New chat" button navigates to `/ai`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

export type ConversationGroupKey = 'today' | 'yesterday' | 'previous7Days' | 'previous30Days' | 'older';

export interface ConversationGroup {
  key: ConversationGroupKey;
  items: ConversationSummary[];
}

const GROUP_ORDER: ConversationGroupKey[] = ['today', 'yesterday', 'previous7Days', 'previous30Days', 'older'];

/** English fallbacks for the section headers (overridable via i18n). */
export const CONVERSATION_GROUP_LABELS: Record<ConversationGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  previous7Days: 'Previous 7 days',
  previous30Days: 'Previous 30 days',
  older: 'Older',
};

/**
 * Bucket conversations into recency sections (ChatGPT/Claude-style), newest
 * first within each. Boundaries are calendar-day based off local midnight, so
 * "Today"/"Yesterday" track the actual day rather than a rolling 24h. Pure +
 * exported for tests; `nowMs` defaults to the current time (kept out of the
 * component's render path). Empty sections are omitted.
 */
export function groupConversationsByDate(
  conversations: ConversationSummary[],
  nowMs: number = Date.now(),
): ConversationGroup[] {
  const startOfToday = new Date(nowMs);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const DAY = 24 * 60 * 60 * 1000;
  const stamp = (c: ConversationSummary): number => {
    const v = new Date(c.updatedAt ?? c.createdAt ?? 0).getTime();
    return Number.isNaN(v) ? 0 : v;
  };
  const buckets: Record<ConversationGroupKey, ConversationSummary[]> = {
    today: [],
    yesterday: [],
    previous7Days: [],
    previous30Days: [],
    older: [],
  };
  for (const c of [...conversations].sort((a, b) => stamp(b) - stamp(a))) {
    const v = stamp(c);
    if (v >= todayMs) buckets.today.push(c);
    else if (v >= todayMs - DAY) buckets.yesterday.push(c);
    else if (v >= todayMs - 7 * DAY) buckets.previous7Days.push(c);
    else if (v >= todayMs - 30 * DAY) buckets.previous30Days.push(c);
    else buckets.older.push(c);
  }
  return GROUP_ORDER.filter((k) => buckets[k].length > 0).map((key) => ({ key, items: buckets[key] }));
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
          <div className="flex flex-col py-1">
            {groupConversationsByDate(visible).map((group) => (
              <section key={group.key} data-testid={`ai-conversation-group-${group.key}`}>
                <h3 className="px-3 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`console.ai.group.${group.key}`, { defaultValue: CONVERSATION_GROUP_LABELS[group.key] })}
                </h3>
                <ul className="flex flex-col">
                  {group.items.map((c) => (
                    <ConversationRow
                      key={c.id}
                      conversation={c}
                      query={filter.trim()}
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
              </section>
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}

interface RowProps {
  conversation: ConversationSummary;
  /** Active search query — matched substrings are highlighted in title/preview. */
  query?: string;
  active: boolean;
  renaming: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onSubmitRename: (title: string) => void;
}

/**
 * Wrap each case-insensitive occurrence of `query` inside `text` in a styled
 * <mark>, so a conversation-list search makes clear WHICH term matched a row.
 * Returns the text untouched when there is no active query (the common case),
 * so non-searching renders pay nothing.
 */
function highlightQuery(text: string | undefined | null, query: string | undefined): ReactNode {
  if (!text) return text ?? null;
  const needle = query?.trim().toLowerCase();
  if (!needle) return text;
  const haystack = text.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, cursor);
    if (idx === -1) {
      parts.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark key={key++} className="rounded-[2px] bg-primary/20 px-0.5 text-foreground">
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    cursor = idx + needle.length;
  }
  return parts;
}

function ConversationRow({
  conversation,
  query,
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
          <span className="line-clamp-1 font-medium">{highlightQuery(title, query)}</span>
          {conversation.preview && conversation.preview !== title ? (
            <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
              {highlightQuery(conversation.preview, query)}
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
