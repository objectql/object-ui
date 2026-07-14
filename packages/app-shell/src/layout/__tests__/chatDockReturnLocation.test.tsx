/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c follow-up — the dock's remembered maximize origin: the storage
 * round trip, and the same-app-absolute-path trust boundary on read (a
 * corrupted/injected value must never become an open redirect). A `.test.tsx`
 * so it runs under happy-dom (sessionStorage exists).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  rememberDockReturnLocation,
  readDockReturnLocation,
  armChatDockExpanded,
  parseStoredDockExpanded,
  DOCK_EXPANDED_STORAGE_KEY,
  DOCK_RETURN_TO_STORAGE_KEY,
} from '../chatDockState';

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('dock return-location round trip', () => {
  it('remembers and reads an in-app path with its query', () => {
    rememberDockReturnLocation('/apps/crm/objects/deal?view=kanban');
    expect(readDockReturnLocation()).toBe('/apps/crm/objects/deal?view=kanban');
  });

  it('returns undefined when nothing was remembered', () => {
    expect(readDockReturnLocation()).toBeUndefined();
  });

  it('only trusts same-app absolute paths (no open redirect)', () => {
    window.sessionStorage.setItem(DOCK_RETURN_TO_STORAGE_KEY, 'https://evil.example/x');
    expect(readDockReturnLocation()).toBeUndefined();
    window.sessionStorage.setItem(DOCK_RETURN_TO_STORAGE_KEY, '//evil.example/x');
    expect(readDockReturnLocation()).toBeUndefined();
    window.sessionStorage.setItem(DOCK_RETURN_TO_STORAGE_KEY, 'apps/relative');
    expect(readDockReturnLocation()).toBeUndefined();
  });
});

describe('armChatDockExpanded', () => {
  it("writes the '1' the dock's stored-expanded parse accepts", () => {
    armChatDockExpanded();
    expect(
      parseStoredDockExpanded(window.sessionStorage.getItem(DOCK_EXPANDED_STORAGE_KEY)),
    ).toBe(true);
  });
});
