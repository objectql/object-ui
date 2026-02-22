/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCommentSearch } from '../useCommentSearch';
import type { CommentEntry } from '@object-ui/types';

const mockComments: CommentEntry[] = [
  {
    id: '1',
    text: 'Great progress on the dashboard feature',
    author: 'Alice',
    createdAt: '2026-02-20T10:00:00Z',
    objectName: 'Project',
    recordId: 'p1',
  },
  {
    id: '2',
    text: 'Need to fix the bug in the login page',
    author: 'Bob',
    createdAt: '2026-02-20T11:00:00Z',
    objectName: 'Task',
    recordId: 't1',
  },
  {
    id: '3',
    text: 'Dashboard design looks good',
    author: 'Charlie',
    createdAt: '2026-02-20T12:00:00Z',
    objectName: 'Project',
    recordId: 'p2',
  },
  {
    id: '4',
    text: 'Alice approved the PR',
    author: 'Diana',
    createdAt: '2026-02-20T13:00:00Z',
    objectName: 'Review',
    recordId: 'r1',
  },
];

describe('useCommentSearch', () => {
  it('returns empty results when query is empty', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );
    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(false);
    expect(result.current.query).toBe('');
  });

  it('searches by comment text', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );

    act(() => {
      result.current.setQuery('dashboard');
    });

    expect(result.current.isSearching).toBe(true);
    expect(result.current.results).toHaveLength(2);
    expect(result.current.results.map(r => r.comment.id)).toEqual(['1', '3']);
  });

  it('searches by author name', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );

    act(() => {
      result.current.setQuery('Alice');
    });

    // Comment 4 mentions "Alice" in its text, and Comment 1 has author "Alice"
    expect(result.current.results).toHaveLength(2);
    const ids = result.current.results.map(r => r.comment.id);
    expect(ids).toContain('1');
    expect(ids).toContain('4');
  });

  it('is case-insensitive', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );

    act(() => {
      result.current.setQuery('BUG');
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].comment.id).toBe('2');
  });

  it('returns results with objectName and recordId', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );

    act(() => {
      result.current.setQuery('login');
    });

    expect(result.current.results).toHaveLength(1);
    expect(result.current.results[0].objectName).toBe('Task');
    expect(result.current.results[0].recordId).toBe('t1');
  });

  it('provides highlighted text snippets', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );

    act(() => {
      result.current.setQuery('bug');
    });

    expect(result.current.results[0].highlight).toBeDefined();
    expect(result.current.results[0].highlight).toContain('bug');
  });

  it('clears search results', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );

    act(() => {
      result.current.setQuery('dashboard');
    });
    expect(result.current.results).toHaveLength(2);

    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.results).toEqual([]);
    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('returns empty results for non-matching query', () => {
    const { result } = renderHook(() =>
      useCommentSearch({ comments: mockComments }),
    );

    act(() => {
      result.current.setQuery('zzzznonexistent');
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.isSearching).toBe(true);
  });
});
