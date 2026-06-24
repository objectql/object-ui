/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0067 — the package "Build history" timeline. Lists every commit an AI
 * build (or edit) landed, newest-first, with "Revert" per apply commit: undo
 * that change set (artifacts it created are soft-removed; ones it edited are
 * restored) as a NEW append-only revert commit. This is the history-not-confirm
 * surface — the user reviews and reverts instead of approving each publish.
 *
 * Sibling of DraftChangesPanel (which lists PENDING drafts before a publish);
 * this lists what already LANDED, and can undo it.
 */

import { useCallback, useEffect, useState } from 'react';
import { GitBranch, Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { fetchCommits, revertCommit, type CommitEntry } from './commitHistory';

export interface CommitTimelineProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  /** Called after a successful revert so the host can refresh the app view. */
  onReverted?: () => void;
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function CommitTimeline({ open, onOpenChange, packageId, onReverted }: CommitTimelineProps) {
  const { t } = useObjectTranslation();
  const [commits, setCommits] = useState<CommitEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reverting, setReverting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCommits(null);
    setError(null);
    try {
      setCommits(await fetchCommits(packageId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [packageId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const onRevert = async (commitId: string) => {
    setReverting(commitId);
    try {
      await revertCommit(packageId, commitId);
      toast.success(t('preview.history.reverted', { defaultValue: 'Reverted — the change has been undone.' }));
      onReverted?.();
      await load();
    } catch (e) {
      toast.error(
        `${t('preview.history.revertFailed', { defaultValue: 'Revert failed' })}: ${(e as Error).message}`,
      );
    } finally {
      setReverting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px]" data-testid="commit-timeline-panel">
        <SheetHeader>
          <SheetTitle>{t('preview.history.title', { defaultValue: 'Build history' })}</SheetTitle>
          <SheetDescription>
            {t('preview.history.description', {
              defaultValue:
                'Every change to this app, newest first. Revert any step to undo it — no publish confirmation needed.',
            })}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-2 overflow-y-auto px-4 pb-6">
          {error ? (
            <p className="text-sm text-destructive">
              {t('preview.history.loadFailed', { defaultValue: 'Could not load history:' })} {error}
            </p>
          ) : commits === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('preview.history.loading', { defaultValue: 'Loading history…' })}
            </div>
          ) : commits.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('preview.history.empty', { defaultValue: 'No history yet for this app.' })}
            </p>
          ) : (
            commits.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-sm"
                data-testid="commit-row"
              >
                <GitBranch
                  className={`mt-0.5 h-4 w-4 shrink-0 ${c.operation === 'revert' ? 'text-muted-foreground' : 'text-primary'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {c.message ??
                      (c.operation === 'revert'
                        ? t('preview.history.revertLabel', { defaultValue: 'Reverted a change' })
                        : t('preview.history.applyLabel', { defaultValue: 'Build change' }))}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {c.operation === 'revert' ? (
                      <Badge variant="outline" className="border-muted-foreground/30">
                        {t('preview.history.revert', { defaultValue: 'revert' })}
                      </Badge>
                    ) : null}
                    <span>
                      {c.itemCount} {t('preview.history.items', { defaultValue: 'item(s)' })}
                    </span>
                    {c.actor ? <span>· {c.actor}</span> : null}
                    {c.createdAt ? <span>· {relativeTime(c.createdAt)}</span> : null}
                  </p>
                </div>
                {c.operation === 'apply' ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    disabled={reverting !== null}
                    onClick={() => onRevert(c.id)}
                    data-testid="commit-revert"
                  >
                    {reverting === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Undo2 className="mr-1 h-3.5 w-3.5" />
                        {t('preview.history.revertAction', { defaultValue: 'Revert' })}
                      </>
                    )}
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
