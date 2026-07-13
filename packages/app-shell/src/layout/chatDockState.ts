/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3a — pure state helpers for the ChatDock (the right-docked console
 * AI rail). Kept dependency-free so the width math and the keyboard matcher are
 * unit-testable without React or the DOM.
 */

export const DOCK_WIDTH_STORAGE_KEY = 'ai-chat-dock-width';
/** Default rail width (px). */
export const DOCK_DEFAULT_WIDTH = 420;
/** The rail never narrower than this. */
export const DOCK_MIN_WIDTH = 340;
/** The main content always keeps at least this much room (caps rail growth). */
export const DOCK_CONTENT_MIN_WIDTH = 520;
/** Keyboard resize step (px) when the divider is focused. */
export const DOCK_KEYBOARD_STEP = 24;

/**
 * Clamp a desired rail width so neither pane collapses: at least
 * {@link DOCK_MIN_WIDTH}, and never so wide that the main content drops below
 * {@link DOCK_CONTENT_MIN_WIDTH}. `containerWidth <= 0` (unmeasured) skips the
 * upper bound. Pure + exported for tests.
 */
export function clampDockWidth(desired: number, containerWidth: number): number {
  const upper =
    containerWidth > 0 ? Math.max(DOCK_MIN_WIDTH, containerWidth - DOCK_CONTENT_MIN_WIDTH) : Infinity;
  return Math.min(Math.max(desired, DOCK_MIN_WIDTH), upper);
}

export type ChatDockShortcut = 'toggle';

/**
 * Match a keydown to the ChatDock toggle — ⌘/Ctrl+Shift+I (the ADR's ⌘I idiom,
 * made composer-safe with Shift so ordinary typing can't produce it, mirroring
 * {@link matchAiChatShortcut}). Distinct from the AI-chat page shortcuts (O / S).
 * Pure + exported for tests.
 */
export function matchChatDockShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): ChatDockShortcut | null {
  if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey) return null;
  return e.key.toLowerCase() === 'i' ? 'toggle' : null;
}
