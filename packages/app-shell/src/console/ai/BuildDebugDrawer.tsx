// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * BuildDebugDrawer — self-serve "what actually landed?" panel for a build
 * conversation. Opens a right-side sheet, calls the admin build-debug endpoint
 * (see buildDebugApi.ts), and renders the reconciliation: agent-CLAIMED vs LIVE
 * `sys_metadata`. The headline is the verdict + the two failure modes the chat
 * can't show — PROPOSED-BUT-ORPHANED (a confirm card no turn applied) and
 * CLAIMED-BUT-MISSING (said applied, isn't live). Read-only; no DB credentials.
 *
 * Distinct from `useReconcileOnError` (ADR-0013 D2 stream-failure recovery) —
 * this reconciles the BUILD against live metadata, not a transport drop.
 */

import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@object-ui/components';
import { Bug, CheckCircle2, AlertTriangle, XCircle, Loader2, CircleSlash } from 'lucide-react';
import { fetchBuildDebug, type BuildDebugReport, type MutationFinding } from './buildDebugApi';

interface BuildDebugDrawerProps {
  apiBase: string;
  conversationId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuildDebugDrawer({ apiBase, conversationId, open, onOpenChange }: BuildDebugDrawerProps) {
  const [report, setReport] = useState<BuildDebugReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !conversationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setReport(null);
    fetchBuildDebug(apiBase, conversationId)
      .then((r) => {
        if (cancelled) return;
        if (!r) setError('Not available — the conversation was not found or you are not authorized.');
        else setReport(r);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, conversationId, apiBase]);

  const rec = report?.reconciliation;
  const problems = rec ? rec.orphaned.length + rec.missing.length + rec.errors.length : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bug className="h-4 w-4" /> Build Doctor
          </SheetTitle>
          <SheetDescription>
            What the agent claimed vs what is actually live. Read-only diagnostic.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reconciling…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              {error}
            </div>
          )}

          {report && !loading && (
            <>
              {/* Summary line */}
              <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">{report.title ?? '(untitled)'}</div>
                <div className="mt-1">
                  {report.summary.userTurns} turn(s) · {report.summary.messages} msgs ·{' '}
                  {report.summary.totalTokens.toLocaleString()} tok ·{' '}
                  {(report.summary.llmMs / 1000).toFixed(1)}s LLM
                  {report.summary.models.length ? ` · ${report.summary.models.join(', ')}` : ''}
                </div>
              </div>

              {/* Verdict */}
              {rec && (
                <div
                  className={
                    rec.ok
                      ? 'flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-400'
                      : 'flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive'
                  }
                >
                  {rec.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span className="font-medium">
                    {rec.ok
                      ? `All ${rec.liveCount} attempted change(s) are live — nothing evaporated.`
                      : `${problems} discrepancy(ies) — what the chat said doesn't match what's live.`}
                  </span>
                </div>
              )}

              {/* Orphaned — the headline failure */}
              {rec && rec.orphaned.length > 0 && (
                <FindingSection
                  icon={<CircleSlash className="h-4 w-4 text-destructive" />}
                  title="Proposed but never applied"
                  hint="A confirm card the agent proposed but no later turn applied — the change silently evaporated."
                  findings={rec.orphaned}
                  tone="destructive"
                />
              )}
              {rec && rec.missing.length > 0 && (
                <FindingSection
                  icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
                  title="Claimed but missing"
                  hint="A tool result said it was applied, but the artifact isn't live in sys_metadata."
                  findings={rec.missing}
                  tone="amber"
                />
              )}
              {rec && rec.errors.length > 0 && (
                <FindingSection
                  icon={<XCircle className="h-4 w-4 text-destructive" />}
                  title="Tool errors"
                  hint="Tool calls that returned an error during the build."
                  findings={rec.errors}
                  tone="destructive"
                />
              )}

              {/* verify_build, de-noised */}
              {report.verify && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="font-medium text-foreground">Build check (verify_build)</div>
                  <div className="mt-1 text-muted-foreground">
                    Your app:{' '}
                    {report.verify.userIssues.length === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">0 issues</span>
                    ) : (
                      <span className="text-destructive">{report.verify.userIssues.length} issue(s)</span>
                    )}
                    {report.verify.platformNoise > 0
                      ? ` · ${report.verify.platformNoise} platform sys_* finding(s) hidden`
                      : ''}
                  </div>
                  {report.verify.userIssues.map((is, i) => (
                    <div key={i} className="mt-1 text-destructive">
                      [{is.severity}] {is.code} {is.artifact ? `${is.artifact.type}:${is.artifact.name}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {/* Pending actions */}
              {report.pendingActions.length > 0 && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="font-medium text-foreground">Pending actions</div>
                  {report.pendingActions.map((p, i) => (
                    <div key={i} className="mt-1 text-muted-foreground">
                      {p.tool ?? '?'} · {p.object ?? '-'} · <span className="font-mono">{p.status ?? '-'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline (collapsed) */}
              <details className="rounded-md border p-3 text-xs">
                <summary className="cursor-pointer font-medium text-foreground">
                  Timeline ({report.timeline.length})
                </summary>
                <div className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed">
                  {report.timeline.map((e, i) => (
                    <TimelineRow key={i} entry={e} />
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FindingSection({
  icon,
  title,
  hint,
  findings,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  findings: MutationFinding[];
  tone: 'destructive' | 'amber';
}) {
  const border = tone === 'destructive' ? 'border-destructive/30' : 'border-amber-500/30';
  return (
    <div className={`rounded-md border ${border} p-3`}>
      <div className="flex items-center gap-2 font-medium text-foreground">
        {icon} {title} ({findings.length})
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      <div className="mt-2 space-y-1">
        {findings.map((f, i) => (
          <div key={i} className="font-mono text-xs">
            {f.t ? `${f.t} · ` : ''}
            {f.tool} → {f.artifact.type}:{f.artifact.name}
            <span className="text-muted-foreground"> ({f.status})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ entry }: { entry: BuildDebugReport['timeline'][number] }) {
  if (entry.kind === 'user') {
    return (
      <div>
        <span className="text-muted-foreground">{entry.t}</span> 👤 {entry.text}
      </div>
    );
  }
  if (entry.kind === 'assistant-text') {
    return (
      <div>
        <span className="text-muted-foreground">{entry.t}</span> 🤖 {entry.text}
      </div>
    );
  }
  if (entry.kind === 'assistant-calls') {
    return (
      <div>
        <span className="text-muted-foreground">{entry.t}</span> 🤖 →{' '}
        {entry.calls.map((c) => c.name).join(', ')}
      </div>
    );
  }
  return (
    <div className={entry.isError ? 'text-destructive' : ''}>
      <span className="text-muted-foreground">{entry.t}</span> ↳ {entry.name}
      {entry.status ? ` (${entry.status})` : ''}
    </div>
  );
}
