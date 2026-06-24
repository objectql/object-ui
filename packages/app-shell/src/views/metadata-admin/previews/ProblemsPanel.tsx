// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ProblemsPanel — lists every structural + server validation issue for the
 * flow draft. Each row shows the severity icon and the message; clicking a row
 * selects and reveals (pans to) the offending node/edge on the canvas. Mirrors
 * the "Problems" tab of an IDE / the error panel in Salesforce Flow Builder.
 *
 * Pure presentation: the issue list is derived upstream (see `flow-problems`)
 * from the live draft, so rows clear as the author fixes each problem.
 */

import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, CircleDot, GitBranch } from 'lucide-react';
import { cn } from '@object-ui/components';
import type { FlowProblem } from './flow-problems';

export interface ProblemsPanelProps {
  problems: FlowProblem[];
  /** Selected element key (`node:<id>` or an edge's `edgeKey`) to highlight matching rows. */
  selectedKey?: string | null;
  onSelectProblem: (problem: FlowProblem) => void;
}

function targetLabel(p: FlowProblem): string {
  if (p.target.kind === 'node') return p.target.nodeId;
  if (p.target.kind === 'edge') return `${p.target.source} → ${p.target.target}`;
  return 'flow';
}

export function ProblemsPanel({ problems, selectedKey, onSelectProblem }: ProblemsPanelProps) {
  const errorCount = problems.filter((p) => p.level === 'error').length;
  const warningCount = problems.length - errorCount;

  return (
    <div className="flex h-full flex-col text-xs">
      <div className="flex items-center gap-2 border-b px-3 py-2 font-medium text-muted-foreground">
        <span>Problems</span>
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" /> {errorCount}
          </span>
        )}
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3" /> {warningCount}
          </span>
        )}
      </div>
      {problems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-4 text-center text-muted-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          <span>No problems — this flow is structurally valid.</span>
        </div>
      ) : (
        <ul className="flex-1 overflow-auto p-1.5">
          {problems.map((p) => {
            const isEdge = p.target.kind === 'edge';
            const isFlow = p.target.kind === 'flow';
            const key =
              p.target.kind === 'node'
                ? `node:${p.target.nodeId}`
                : p.target.kind === 'edge'
                  ? p.target.edgeKey
                  : null;
            const active = !!key && key === selectedKey;
            const Icon = p.level === 'error' ? AlertCircle : AlertTriangle;
            const TargetIcon = isEdge ? GitBranch : CircleDot;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={isFlow}
                  onClick={() => onSelectProblem(p)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                    isFlow ? 'cursor-default' : 'cursor-pointer hover:bg-accent',
                    active && 'bg-accent ring-1 ring-primary/40',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 h-3.5 w-3.5 shrink-0',
                      p.level === 'error' ? 'text-destructive' : 'text-amber-500',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug text-foreground">{p.message}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <TargetIcon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate font-mono">{targetLabel(p)}</span>
                      {p.source === 'server' && <span className="uppercase tracking-wide">· schema</span>}
                      {p.source === 'expression' && <span className="uppercase tracking-wide">· expression</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
