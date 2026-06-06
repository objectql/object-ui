// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * RuntimeDraftBar — ADR-0034 step 3 (#1515): the draft/publish chrome for the
 * runtime config panels (ViewConfigPanel / ReportConfigPanel /
 * DashboardConfigPanel).
 *
 * It mirrors studio's `ResourceEditPage` affordances — an "unpublished
 * changes" indicator, a **Publish** button, and a **Discard draft** button —
 * but is **entirely gated by {@link isViaMeta}**:
 *
 *   • flag OFF (default) → renders `null`. Mounting it adds NO DOM, so the
 *     existing panel footers are byte-identical to before this change.
 *   • flag ON → on open it reads the pending draft (`?state=draft`), shows the
 *     indicator when one exists, optionally resumes it into the editor
 *     (`onResume`), and exposes Publish / Discard.
 *
 * Hooks are always called (no conditional hooks); only the rendered output and
 * the network effects are gated, so flipping the flag never changes hook order.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@object-ui/components';
import { Loader2, Send, Undo2 } from 'lucide-react';
import {
  isViaMeta,
  publishRuntimeMetadata,
  discardRuntimeDraft,
  readRuntimeDraft,
  type RuntimeArtifactType,
} from './runtime-metadata-persistence';
import { detectLocale, t, tFormat } from './metadata-admin/i18n';

export interface RuntimeDraftBarProps {
  /** Artifact type — the `:type` in `/meta/:type/:name`. */
  type: RuntimeArtifactType;
  /** Artifact name — the `:name`. Chrome stays inert until this is known. */
  name?: string;
  /** Studio metadata client (flag-ON path). */
  metadataClient: any;
  /**
   * Disable Publish while the panel has unsaved local edits, mirroring
   * studio's "save first, then publish" rule.
   */
  dirty?: boolean;
  /**
   * Seed an existing draft back into the editor when the panel opens, so a
   * half-finished edit is restored. Called at most once per `name` per mount.
   */
  onResume?: (body: Record<string, unknown>) => void;
  /** Called after a successful publish / discard so the host can refresh. */
  onAfterChange?: () => void;
  /**
   * Monotonic counter the host bumps right after it saves a draft. The bar
   * reads the pending draft only on open, so without this a save in an
   * already-open panel wouldn't surface the indicator until reopen. Bumping
   * this marks the indicator immediately (a save just created a draft) — no
   * dependence on the fire-and-forget write's timing.
   */
  savedSignal?: number;
}

export function RuntimeDraftBar({
  type,
  name,
  metadataClient,
  dirty,
  onResume,
  onAfterChange,
  savedSignal,
}: RuntimeDraftBarProps) {
  const enabled = isViaMeta();
  const locale = detectLocale();
  const [hasDraft, setHasDraft] = useState(false);
  const [busy, setBusy] = useState(false);
  // Track the `name` we've already resumed so reopening the same item doesn't
  // clobber in-flight edits with the stored draft on every effect run.
  const resumedRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !name || !metadataClient) {
      setHasDraft(false);
      return;
    }
    let body: Record<string, unknown> | null;
    try {
      body = await readRuntimeDraft<Record<string, unknown>>(type, name, {
        metadataClient,
      });
    } catch {
      // A failed draft read must not break the editor — treat as "no draft".
      setHasDraft(false);
      return;
    }
    setHasDraft(!!body);
    // Resume is best-effort: a failure to seed the editor must NOT hide the
    // "unpublished changes" indicator (the draft still exists on the server).
    if (body && onResume && resumedRef.current !== name) {
      resumedRef.current = name;
      try {
        onResume(body);
      } catch (err) {
        console.error('[RuntimeDraftBar] Resume draft failed:', err);
      }
    }
  }, [enabled, type, name, metadataClient, onResume]);

  // Read the pending draft on open / when the edited item changes.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // A host save just wrote a draft → surface the indicator immediately,
  // without waiting for a reopen or racing the fire-and-forget write.
  // Skip the initial mount (savedSignal === 0 / undefined).
  const lastSavedSignal = useRef(savedSignal);
  useEffect(() => {
    if (savedSignal === lastSavedSignal.current) return;
    lastSavedSignal.current = savedSignal;
    if (enabled && savedSignal) setHasDraft(true);
  }, [savedSignal, enabled]);

  const handlePublish = useCallback(async () => {
    if (!name) return;
    setBusy(true);
    try {
      await publishRuntimeMetadata(type, name, { metadataClient });
      setHasDraft(false);
      onAfterChange?.();
    } catch (err) {
      console.error('[RuntimeDraftBar] Publish failed:', err);
    } finally {
      setBusy(false);
    }
  }, [type, name, metadataClient, onAfterChange]);

  const handleDiscard = useCallback(async () => {
    if (!name) return;
    if (
      typeof confirm === 'function' &&
      !confirm(tFormat('engine.edit.discardDraftConfirm', locale, { type, name }))
    ) {
      return;
    }
    setBusy(true);
    try {
      await discardRuntimeDraft(type, name, { metadataClient });
      setHasDraft(false);
      onAfterChange?.();
    } catch (err) {
      console.error('[RuntimeDraftBar] Discard draft failed:', err);
    } finally {
      setBusy(false);
    }
  }, [type, name, metadataClient, onAfterChange, locale]);

  // flag OFF, or nothing pending → render nothing (zero DOM, zero layout shift).
  if (!enabled || !hasDraft) return null;

  return (
    <div
      className="mr-auto flex items-center gap-2"
      data-testid="runtime-draft-bar"
    >
      <span
        className="text-xs text-amber-700 dark:text-amber-400"
        title={t('engine.edit.draftPending', locale)}
        data-testid="runtime-draft-indicator"
      >
        ● {t('engine.edit.draftPending', locale)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDiscard}
        disabled={busy}
        className="h-7 w-7 p-0 text-muted-foreground"
        title={t('engine.edit.discardDraft', locale)}
        aria-label={t('engine.edit.discardDraft', locale)}
        data-testid="runtime-draft-discard"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        onClick={handlePublish}
        disabled={busy || dirty}
        className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-emerald-50"
        title={
          dirty
            ? t('engine.edit.publishBlockedDirty', locale)
            : t('engine.edit.publish', locale)
        }
        data-testid="runtime-draft-publish"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <Send className="h-3.5 w-3.5 mr-1" />
            {t('engine.edit.publish', locale)}
          </>
        )}
      </Button>
    </div>
  );
}
