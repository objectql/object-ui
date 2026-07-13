/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3a — ChatDock pure state: the width clamp keeps neither pane from
 * collapsing, and the toggle shortcut is composer-safe (⌘/Ctrl+Shift+I).
 */
import { describe, it, expect } from 'vitest';
import {
  clampDockWidth,
  matchChatDockShortcut,
  DOCK_MIN_WIDTH,
  DOCK_CONTENT_MIN_WIDTH,
} from '../chatDockState';

describe('clampDockWidth', () => {
  it('never narrower than the minimum', () => {
    expect(clampDockWidth(100, 1600)).toBe(DOCK_MIN_WIDTH);
    expect(clampDockWidth(DOCK_MIN_WIDTH - 1, 1600)).toBe(DOCK_MIN_WIDTH);
  });

  it('never so wide the main content drops below its minimum', () => {
    const container = 1200;
    const max = container - DOCK_CONTENT_MIN_WIDTH;
    expect(clampDockWidth(9999, container)).toBe(max);
    expect(clampDockWidth(max - 20, container)).toBe(max - 20);
  });

  it('skips the upper bound when the container is unmeasured', () => {
    expect(clampDockWidth(4000, 0)).toBe(4000);
  });
});

describe('matchChatDockShortcut', () => {
  const base = { key: 'i', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  it('matches ⌘/Ctrl+Shift+I', () => {
    expect(matchChatDockShortcut({ ...base, metaKey: true, shiftKey: true })).toBe('toggle');
    expect(matchChatDockShortcut({ ...base, ctrlKey: true, shiftKey: true })).toBe('toggle');
    expect(matchChatDockShortcut({ ...base, key: 'I', metaKey: true, shiftKey: true })).toBe('toggle');
  });
  it('is composer-safe — needs the ⌘/Ctrl+Shift modifier, no bare I', () => {
    expect(matchChatDockShortcut({ ...base })).toBeNull();
    expect(matchChatDockShortcut({ ...base, metaKey: true })).toBeNull(); // no Shift
    expect(matchChatDockShortcut({ ...base, metaKey: true, shiftKey: true, altKey: true })).toBeNull();
  });
  it('does not collide with the AI-chat page shortcuts (O / S)', () => {
    expect(matchChatDockShortcut({ ...base, key: 'o', metaKey: true, shiftKey: true })).toBeNull();
    expect(matchChatDockShortcut({ ...base, key: 's', metaKey: true, shiftKey: true })).toBeNull();
  });
});
