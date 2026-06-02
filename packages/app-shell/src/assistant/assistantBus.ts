// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Assistant bus — a tiny framework-agnostic singleton that connects the
 * metadata designers to the global AI chat (`ConsoleFloatingChatbot`).
 *
 * Two channels:
 *   1. **Editor context** — a designer publishes *what the user is
 *      currently editing* (`{ type, name, label, fields }`). The chatbot
 *      reads it and merges it into the `context` it sends the agent, so
 *      "add a priority field" acts on the open object without the user
 *      restating which object they mean.
 *   2. **Open signal** — a designer can ask the global chat to open (e.g.
 *      an "Ask AI" button). The lazy chat FAB arms + opens on the signal.
 *
 * Why a singleton bus instead of React context? The chat FAB is
 * lazy-mounted on a different branch of the tree from the designers, and
 * the open-signal must cross that boundary without a shared Provider
 * being threaded through every layout. A module singleton + (subscribe,
 * getSnapshot) reads cleanly via `useSyncExternalStore`.
 */

import { useEffect, useSyncExternalStore } from 'react';

export interface AssistantEditorField {
  name: string;
  type?: string;
  label?: string;
  required?: boolean;
}

export interface AssistantEditorContext {
  /** Metadata type, e.g. 'object'. */
  type: string;
  /** Item primary-key name (may be empty in create mode). */
  name: string;
  label?: string;
  /** Lightweight field summary — enough for the agent to reason, not the full draft. */
  fields?: AssistantEditorField[];
}

export interface AssistantSnapshot {
  /** What the user is currently editing, or null when no designer is active. */
  editor: AssistantEditorContext | null;
  /** Monotonic counter — bumped each time a surface requests the chat to open. */
  openSeq: number;
}

let editor: AssistantEditorContext | null = null;
let openSeq = 0;
// Cached snapshot — its reference only changes on a real state change so
// useSyncExternalStore doesn't loop.
let snapshot: AssistantSnapshot = { editor, openSeq };

const listeners = new Set<() => void>();

function commit(): void {
  snapshot = { editor, openSeq };
  for (const l of listeners) l();
}

function sameEditor(a: AssistantEditorContext | null, b: AssistantEditorContext | null): boolean {
  if (a === b) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

export const assistantBus = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): AssistantSnapshot {
    return snapshot;
  },
  /** Publish the currently-edited item (or null to clear). No-op if unchanged. */
  setEditor(next: AssistantEditorContext | null): void {
    if (sameEditor(editor, next)) return;
    editor = next;
    commit();
  },
  /** Ask the global chat to open (and warm/mount the lazy FAB). */
  requestOpen(): void {
    openSeq += 1;
    commit();
  },
};

/** Subscribe a component to the assistant bus snapshot. */
export function useAssistant(): AssistantSnapshot {
  return useSyncExternalStore(
    assistantBus.subscribe,
    assistantBus.getSnapshot,
    assistantBus.getSnapshot,
  );
}

/**
 * Publish the currently-edited item to the assistant for the lifetime of
 * the calling component (auto-clears on unmount). Pass `null` to register
 * nothing. Stable across renders with equal content.
 */
export function useRegisterAssistantEditor(ctx: AssistantEditorContext | null): void {
  // Serialize for a cheap, content-based effect dependency.
  const key = ctx ? JSON.stringify(ctx) : '';
  useEffect(() => {
    assistantBus.setEditor(ctx);
    return () => assistantBus.setEditor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Open the global AI chat from anywhere (e.g. an "Ask AI" button). */
export function requestAssistantOpen(): void {
  assistantBus.requestOpen();
}
