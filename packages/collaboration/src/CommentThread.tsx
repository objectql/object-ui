/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';

export interface Comment {
  id: string;
  author: { id: string; name: string; avatar?: string };
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt?: string;
  parentId?: string;
  resolved?: boolean;
  reactions?: Record<string, string[]>;
}

export interface CommentThreadProps {
  /** Thread ID */
  threadId: string;
  /** Comments in the thread */
  comments: Comment[];
  /** Current user */
  currentUser: { id: string; name: string; avatar?: string };
  /** Available users for @mentions */
  mentionableUsers?: { id: string; name: string; avatar?: string }[];
  /** Callback when a new comment is posted */
  onAddComment?: (content: string, mentions: string[], parentId?: string) => void;
  /** Callback when a comment is edited */
  onEditComment?: (commentId: string, content: string) => void;
  /** Callback when a comment is deleted */
  onDeleteComment?: (commentId: string) => void;
  /** Callback when thread is resolved/reopened */
  onResolve?: (resolved: boolean) => void;
  /** Callback when a reaction is toggled */
  onReaction?: (commentId: string, emoji: string) => void;
  /** Whether the thread is resolved */
  resolved?: boolean;
  /** Additional className */
  className?: string;
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return iso;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/** Parse @mentions from text content */
function parseMentions(
  content: string,
  users: { id: string; name: string }[],
): string[] {
  const mentions: string[] = [];
  const mentionPattern = /@(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(content)) !== null) {
    const matchStr = match[1];
    const mentioned = users.find(
      u => u.name.toLowerCase().replace(/\s+/g, '') === matchStr.toLowerCase()
        || u.id === matchStr
    );
    if (mentioned && !mentions.includes(mentioned.id)) {
      mentions.push(mentioned.id);
    }
  }
  return mentions;
}

const styles = {
  thread: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: '12px',
    color: '#64748b',
  },
  resolveBtn: {
    background: 'none',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#475569',
  },
  commentList: {
    maxHeight: '400px',
    overflowY: 'auto' as const,
  },
  comment: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    borderBottom: '1px solid #f1f5f9',
  },
  reply: {
    paddingLeft: '32px',
  },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#94a3b8',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '2px',
  },
  authorName: {
    fontWeight: 600,
    fontSize: '13px',
    color: '#1e293b',
  },
  timestamp: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  content: {
    color: '#334155',
    wordBreak: 'break-word' as const,
  },
  mention: {
    color: '#3b82f6',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  actionBtn: {
    background: 'none',
    border: 'none',
    fontSize: '12px',
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
  },
  sortSelect: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    color: '#64748b',
    cursor: 'pointer',
    outline: 'none',
  },
  reactionBar: {
    display: 'flex',
    gap: '4px',
    marginTop: '4px',
    flexWrap: 'wrap' as const,
  },
  reactionBtn: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1px 6px',
    fontSize: '12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    lineHeight: '1.5',
  },
  reactionBtnActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  reactionPicker: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '1px 6px',
    fontSize: '12px',
    cursor: 'pointer',
    color: '#94a3b8',
    lineHeight: '1.5',
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '10px 12px',
    borderTop: '1px solid #e2e8f0',
    position: 'relative' as const,
  },
  textarea: {
    flex: 1,
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '13px',
    fontFamily: 'inherit',
    resize: 'none' as const,
    outline: 'none',
    minHeight: '36px',
    maxHeight: '120px',
    lineHeight: '1.5',
  },
  submitBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '6px 14px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  submitBtnDisabled: {
    backgroundColor: '#cbd5e1',
    cursor: 'default',
  },
  mentionPopup: {
    position: 'absolute' as const,
    bottom: '100%',
    left: '12px',
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,.1)',
    maxHeight: '150px',
    overflowY: 'auto' as const,
    zIndex: 10,
    minWidth: '180px',
  },
  mentionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#1e293b',
  },
  mentionItemHighlighted: {
    backgroundColor: '#f1f5f9',
  },
} as const;

/** Render comment content with highlighted @mentions */
function renderContent(content: string): React.ReactNode {
  const parts = content.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return React.createElement('span', { key: i, style: styles.mention }, part);
    }
    return part;
  });
}

/**
 * Comment thread component with @mentions support.
 *
 * Renders a list of comments with author avatars, timestamps,
 * reply functionality, and an @mention suggestions popup.
 */
export function CommentThread({
  threadId,
  comments,
  currentUser,
  mentionableUsers = [],
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolve,
  onReaction,
  resolved = false,
  className,
}: CommentThreadProps): React.ReactElement {
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('oldest');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const filteredMentions = useMemo(() => {
    if (mentionQuery === null) return [];
    const query = mentionQuery.toLowerCase();
    return mentionableUsers.filter(
      u => u.name.toLowerCase().includes(query) || u.id.toLowerCase().includes(query),
    );
  }, [mentionQuery, mentionableUsers]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  }, []);

  const insertMention = useCallback((user: { id: string; name: string }) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inputValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const before = textBeforeCursor.slice(0, mentionMatch.index);
      const after = inputValue.slice(cursorPos);
      const mentionText = `@${user.name.replace(/\s+/g, '')}`;
      setInputValue(`${before}${mentionText} ${after}`);
    }
    setMentionQuery(null);
  }, [inputValue]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !onAddComment) return;

    const mentions = parseMentions(trimmed, mentionableUsers);
    onAddComment(trimmed, mentions, replyTo ?? undefined);
    setInputValue('');
    setReplyTo(null);
    setMentionQuery(null);
  }, [inputValue, onAddComment, mentionableUsers, replyTo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, filteredMentions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [mentionQuery, filteredMentions, mentionIndex, insertMention, handleSubmit]);

  const handleEdit = useCallback((commentId: string) => {
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      setEditingId(commentId);
      setEditValue(comment.content);
    }
  }, [comments]);

  const handleEditSave = useCallback(() => {
    if (editingId && editValue.trim() && onEditComment) {
      onEditComment(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  }, [editingId, editValue, onEditComment]);

  // Keep mention index in bounds
  useEffect(() => {
    if (mentionIndex >= filteredMentions.length) {
      setMentionIndex(Math.max(0, filteredMentions.length - 1));
    }
  }, [filteredMentions.length, mentionIndex]);

  const rootComments = useMemo(
    () => {
      const roots = comments.filter(c => !c.parentId);
      if (sortOrder === 'newest') {
        return [...roots].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return roots;
    },
    [comments, sortOrder],
  );
  const replies = useMemo(
    () => comments.filter(c => c.parentId),
    [comments],
  );

  const renderComment = (comment: Comment, isReply = false) => {
    const isEditing = editingId === comment.id;
    const isOwner = comment.author.id === currentUser.id;

    return React.createElement('div', {
      key: comment.id,
      style: { ...styles.comment, ...(isReply ? styles.reply : {}) },
      'data-comment-id': comment.id,
    },
      // Avatar
      React.createElement('div', { style: styles.avatar },
        comment.author.avatar
          ? React.createElement('img', {
              src: comment.author.avatar,
              alt: comment.author.name,
              style: styles.avatarImg,
            })
          : getInitials(comment.author.name),
      ),
      // Body
      React.createElement('div', { style: styles.commentBody },
        // Header
        React.createElement('div', { style: styles.commentHeader },
          React.createElement('span', { style: styles.authorName }, comment.author.name),
          React.createElement('span', { style: styles.timestamp }, formatTimestamp(comment.createdAt)),
          comment.updatedAt
            ? React.createElement('span', { style: styles.timestamp }, '(edited)')
            : null,
        ),
        // Content or edit input
        isEditing
          ? React.createElement('div', { style: { display: 'flex', gap: '4px' } },
              React.createElement('textarea', {
                value: editValue,
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditValue(e.target.value),
                style: { ...styles.textarea, flex: 1 },
                rows: 2,
              }),
              React.createElement('button', {
                onClick: handleEditSave,
                style: { ...styles.submitBtn, padding: '4px 10px', fontSize: '12px' },
              }, 'Save'),
              React.createElement('button', {
                onClick: () => { setEditingId(null); setEditValue(''); },
                style: { ...styles.actionBtn },
              }, 'Cancel'),
            )
          : React.createElement('div', { style: styles.content }, renderContent(comment.content)),
        // Reactions display
        !isEditing && comment.reactions && Object.keys(comment.reactions).length > 0 && React.createElement('div', { style: styles.reactionBar },
          Object.entries(comment.reactions).map(([emoji, userIds]) =>
            React.createElement('button', {
              key: emoji,
              style: {
                ...styles.reactionBtn,
                ...(userIds.includes(currentUser.id) ? styles.reactionBtnActive : {}),
              },
              onClick: () => onReaction?.(comment.id, emoji),
              title: userIds.length === 1 ? '1 reaction' : `${userIds.length} reactions`,
            }, `${emoji} ${userIds.length}`),
          ),
          onReaction && React.createElement('button', {
            style: styles.reactionPicker,
            onClick: () => onReaction(comment.id, '👍'),
            title: 'Add thumbs up',
          }, '+'),
        ),
        // Actions
        !isEditing && React.createElement('div', { style: styles.actions },
          React.createElement('button', {
            style: styles.actionBtn,
            onClick: () => setReplyTo(comment.id),
          }, 'Reply'),
          onReaction && React.createElement('button', {
            style: styles.actionBtn,
            onClick: () => onReaction(comment.id, '👍'),
          }, '👍'),
          onReaction && React.createElement('button', {
            style: styles.actionBtn,
            onClick: () => onReaction(comment.id, '❤️'),
          }, '❤️'),
          isOwner && onEditComment && React.createElement('button', {
            style: styles.actionBtn,
            onClick: () => handleEdit(comment.id),
          }, 'Edit'),
          isOwner && onDeleteComment && React.createElement('button', {
            style: styles.actionBtn,
            onClick: () => onDeleteComment(comment.id),
          }, 'Delete'),
        ),
      ),
    );
  };

  return React.createElement('div', {
    style: styles.thread,
    className,
    'data-thread-id': threadId,
  },
    // Header
    React.createElement('div', { style: styles.header },
      React.createElement('span', null,
        `${comments.length} comment${comments.length !== 1 ? 's' : ''}`,
        resolved ? ' · Resolved' : '',
      ),
      React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
        React.createElement('select', {
          value: sortOrder,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSortOrder(e.target.value as 'newest' | 'oldest'),
          style: styles.sortSelect,
          'aria-label': 'Sort comments',
        },
          React.createElement('option', { value: 'oldest' }, 'Oldest'),
          React.createElement('option', { value: 'newest' }, 'Newest'),
        ),
        onResolve && React.createElement('button', {
          style: styles.resolveBtn,
          onClick: () => onResolve(!resolved),
        }, resolved ? 'Reopen' : 'Resolve'),
      ),
    ),
    // Comments list
    React.createElement('div', { style: styles.commentList },
      rootComments.map(comment => React.createElement(React.Fragment, { key: comment.id },
        renderComment(comment),
        replies
          .filter(r => r.parentId === comment.id)
          .map(r => renderComment(r, true)),
      )),
    ),
    // Reply indicator
    replyTo && React.createElement('div', {
      style: { padding: '4px 12px', fontSize: '12px', color: '#64748b', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between' },
    },
      React.createElement('span', null, `Replying to ${comments.find(c => c.id === replyTo)?.author.name ?? 'comment'}...`),
      React.createElement('button', {
        style: styles.actionBtn,
        onClick: () => setReplyTo(null),
      }, '✕'),
    ),
    // Input area
    React.createElement('div', { style: styles.inputArea },
      // Mention popup
      mentionQuery !== null && filteredMentions.length > 0 && React.createElement('div', { style: styles.mentionPopup },
        filteredMentions.map((user, idx) =>
          React.createElement('div', {
            key: user.id,
            style: { ...styles.mentionItem, ...(idx === mentionIndex ? styles.mentionItemHighlighted : {}) },
            onMouseDown: (e: React.MouseEvent) => {
              e.preventDefault();
              insertMention(user);
            },
            onMouseEnter: () => setMentionIndex(idx),
          },
            user.avatar
              ? React.createElement('img', {
                  src: user.avatar,
                  alt: user.name,
                  style: { width: '20px', height: '20px', borderRadius: '50%' },
                })
              : React.createElement('span', {
                  style: { ...styles.avatar, width: '20px', height: '20px', fontSize: '9px' },
                }, getInitials(user.name)),
            user.name,
          ),
        ),
      ),
      React.createElement('textarea', {
        ref: inputRef,
        value: inputValue,
        onChange: handleInputChange,
        onKeyDown: handleKeyDown,
        placeholder: 'Add a comment... (use @ to mention)',
        style: styles.textarea,
        rows: 1,
      }),
      React.createElement('button', {
        onClick: handleSubmit,
        disabled: !inputValue.trim(),
        style: {
          ...styles.submitBtn,
          ...(!inputValue.trim() ? styles.submitBtnDisabled : {}),
        },
      }, 'Send'),
    ),
  );
}
