/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Regression tests for HistoryTimeline. The original implementation rendered
 * a raw user UUID and the action verb only; these tests lock in the new
 * mainstream-style contract: never expose raw IDs, always render a
 * resolved display name (or "Unknown user"), and surface field-level diffs.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HistoryTimeline, type HistoryEntry } from '../HistoryTimeline';

describe('HistoryTimeline', () => {
  it('renders display name + avatar initials instead of raw user_id', () => {
    const entries: HistoryEntry[] = [
      {
        id: 1,
        action: 'update',
        user_id: 'kie15eCYTcCTAUE6REeyW3qcsF9LdfOa',
        user_name: 'Jane Doe',
        created_at: new Date().toISOString(),
      },
    ];
    render(<HistoryTimeline entries={entries} />);
    expect(screen.getByText('Jane Doe')).toBeTruthy();
    expect(screen.queryByText('kie15eCYTcCTAUE6REeyW3qcsF9LdfOa')).toBeNull();
    expect(screen.getByText('JD')).toBeTruthy(); // initials
  });

  it('falls back to "Unknown user" when no name is resolved (never shows raw id)', () => {
    const entries: HistoryEntry[] = [
      {
        id: 2,
        action: 'update',
        user_id: 'abc123XYZopaque',
        created_at: new Date().toISOString(),
      },
    ];
    render(<HistoryTimeline entries={entries} />);
    expect(screen.getByText('Unknown user')).toBeTruthy();
    expect(screen.queryByText('abc123XYZopaque')).toBeNull();
  });

  it('uses the localized unknownUserText when provided', () => {
    const entries: HistoryEntry[] = [
      {
        id: 5,
        action: 'update',
        user_id: 'abc123XYZopaque',
        created_at: new Date().toISOString(),
      },
    ];
    render(<HistoryTimeline entries={entries} unknownUserText="未知用户" />);
    expect(screen.getByText('未知用户')).toBeTruthy();
    expect(screen.queryByText('Unknown user')).toBeNull();
  });

  it('renders per-field diff (old → new) with friendly labels', () => {
    const entries: HistoryEntry[] = [
      {
        id: 3,
        action: 'update',
        user_name: 'Jane Doe',
        created_at: new Date().toISOString(),
        changes: [
          { field: 'industry', label: 'Industry', from: 'finance', to: 'healthcare' },
          { field: 'name', label: 'Name', from: 'Acme', to: 'Acme Corp' },
        ],
      },
    ];
    render(<HistoryTimeline entries={entries} />);
    expect(screen.getByText('Industry')).toBeTruthy();
    expect(screen.getByText('finance')).toBeTruthy();
    expect(screen.getByText('healthcare')).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
  });

  it('renders empty state when no entries', () => {
    render(<HistoryTimeline entries={[]} emptyText="Nothing here yet" />);
    expect(screen.getByText('Nothing here yet')).toBeTruthy();
  });
});
