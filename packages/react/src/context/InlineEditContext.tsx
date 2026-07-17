/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * InlineEditContext — record-level inline-edit session shared across the
 * `record:*` renderers of a record page (objectui#2407 P1). Lifting the
 * edit session out of `DetailView`'s private state lets the details body and
 * (P2) the highlights strip share ONE draft + ONE atomic Save.
 *
 * This is a *separate* context from `RecordContext` (mirrors
 * `HighlightFieldsContext`) on purpose: the draft mutates on every keystroke,
 * and routing that churn through `RecordContext` would re-render every
 * `record:*` consumer. Consumers that don't edit stay subscribed only to
 * `RecordContext` and never re-render on draft changes.
 *
 * The context holds PURE UI state — it knows nothing about the DataSource,
 * OCC, or how a draft is persisted. The atomic save + conflict handling live
 * in `<InlineEditSaveBar>` (@object-ui/plugin-detail), which reads this
 * context for the draft/editing flags and drives `saving`/`error`/`reset`.
 */

import React from 'react';

export interface InlineEditContextValue {
  /** True while the record is in inline-edit mode. */
  editing: boolean;
  /**
   * Whether inline editing is allowed at all for this record — the object
   * lifecycle / permission gate, decided by the host. When false, `enter()`
   * is a no-op and consumers must not surface the edit affordance.
   */
  canEdit: boolean;
  /**
   * Whether this record is *approval-locked* — a pending approval request has
   * the record locked for writes (the backend rejects updates with
   * `RECORD_LOCKED`). This is a DISTINCT signal from `!canEdit`: a record can
   * be non-editable for many reasons (no permission, wrong lifecycle stage),
   * but only an approval lock warrants the "Locked for approval" band + recall
   * affordance. The host computes it (objectui#2618) — typically from the
   * record's `approval_status` field OR an open request in the approvals API —
   * so the band renders from the same signal that gated `canEdit`, keeping the
   * renderer DataSource-agnostic. Defaults to `false`.
   */
  locked: boolean;
  /**
   * Human-readable reason for the approval lock, surfaced as the band's
   * tooltip. Optional — consumers fall back to their own localized default
   * when omitted.
   */
  lockedReason?: string;
  /**
   * Draft of user-edited values. Holds ONLY the keys the user actually
   * changed, so the save path never writes computed / read-only / untouched
   * fields. Read a field's live value as `draft[name] ?? data[name]`.
   */
  draft: Record<string, any>;
  /** Field to auto-focus when edit was entered from a specific field. */
  autoFocusField: string | null;
  /** True while an atomic save is in flight (driven by the save bar). */
  saving: boolean;
  /** Last save error message, or null (driven by the save bar). */
  error: string | null;
  /** Enter inline-edit mode, optionally focused on `field`. No-op when `!canEdit`. */
  enter: (field?: string) => void;
  /** Stage a single field edit into the draft. */
  setField: (field: string, value: any) => void;
  /** Exit edit mode and discard the draft (Cancel). */
  cancel: () => void;
  /** Exit edit mode and clear the draft — used after a successful save. */
  reset: () => void;
  /** Set the in-flight saving flag (used by the save bar). */
  setSaving: (saving: boolean) => void;
  /** Set or clear the save error message (used by the save bar). */
  setError: (error: string | null) => void;
}

const InlineEditContext = React.createContext<InlineEditContextValue | null>(null);

export interface InlineEditProviderProps {
  /**
   * Whether inline editing is allowed (object-lifecycle + permission gate).
   * Threaded into `canEdit` so `enter()` and the edit affordance are gated at
   * a single source. Defaults to `true`.
   */
  canEdit?: boolean;
  /**
   * Whether the record is approval-locked (objectui#2618). Surfaced verbatim
   * on the context so lock-aware consumers (the DetailView "Locked for
   * approval" band) render from the host's signal instead of re-deriving it
   * from a record field the backend may not materialize. Defaults to `false`.
   */
  locked?: boolean;
  /** Optional human-readable lock reason, surfaced as the band tooltip. */
  lockedReason?: string;
  children: React.ReactNode;
}

export const InlineEditProvider: React.FC<InlineEditProviderProps> = ({
  canEdit = true,
  locked = false,
  lockedReason,
  children,
}) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<Record<string, any>>({});
  const [autoFocusField, setAutoFocusField] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const enter = React.useCallback(
    (field?: string) => {
      // Object-lifecycle / permission gate: never enter edit on a record the
      // host has marked non-editable, even if a stray affordance fires.
      if (!canEdit) return;
      setAutoFocusField(field ?? null);
      setEditing(true);
      setError(null);
    },
    [canEdit],
  );

  const setField = React.useCallback((field: string, value: any) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Cancel and reset share the same teardown (clear draft, exit edit, clear
  // transient state). They are named separately so call sites read
  // intentionally — `cancel()` on the Cancel button, `reset()` after a
  // successful save — and so the two can diverge later without touching callers.
  const teardown = React.useCallback(() => {
    setDraft({});
    setEditing(false);
    setAutoFocusField(null);
    setSaving(false);
    setError(null);
  }, []);

  const value = React.useMemo<InlineEditContextValue>(
    () => ({
      editing,
      canEdit,
      locked,
      lockedReason,
      draft,
      autoFocusField,
      saving,
      error,
      enter,
      setField,
      cancel: teardown,
      reset: teardown,
      setSaving,
      setError,
    }),
    [editing, canEdit, locked, lockedReason, draft, autoFocusField, saving, error, enter, setField, teardown],
  );

  return <InlineEditContext.Provider value={value}>{children}</InlineEditContext.Provider>;
};

/**
 * Read the current inline-edit session. Returns `null` when called outside an
 * `<InlineEditProvider>` — a `DetailView` rendered without a provider (bare /
 * legacy usage) simply treats the record as read-only rather than throwing.
 */
export function useInlineEdit(): InlineEditContextValue | null {
  return React.useContext(InlineEditContext);
}
