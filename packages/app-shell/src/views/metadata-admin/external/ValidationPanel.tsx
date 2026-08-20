// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ValidationPanel — the "validation panel" surface of the external-datasource
 * Studio panel (ADR-0015 §6.4).
 *
 * Runs `POST …/validate` on demand and renders, per federated Object bound to
 * this datasource, whether it still matches the live remote table — plus the
 * structured schema diffs (missing column, type mismatch, …) when it doesn't.
 *
 * This doubles as the on-demand "drift" view: a previously-green object that
 * now reports `missing_column` / `type_mismatch` is exactly remote drift.
 */

import * as React from 'react';
import { ShieldCheck, ShieldAlert, Loader2, PlayCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@object-ui/components';
import {
  validateDatasource,
  ExternalServiceUnavailableError,
  type SchemaValidationResult,
  type SchemaDiffEntry,
} from './api.js';

export interface ValidationPanelProps {
  datasource: string;
}

type RunState = 'idle' | 'running' | 'done' | 'error' | 'unavailable';

/**
 * Every diff kind the server can report, labelled.
 *
 * Total over `SchemaDiffEntry['kind']` on purpose — now that the kind union is
 * imported from `@objectstack/spec/shared` rather than transcribed locally, a
 * kind added upstream fails THIS map to compile instead of rendering a blank
 * cell. `index_mismatch` and `unmapped_index` (framework#3728) were exactly
 * that: already emitted by the validate route, absent from the local copy of
 * the union, and therefore silently unlabelled here (objectstack#4115).
 * `default_mismatch` (spec 17.0.0-rc.2) is the mechanism working as intended —
 * it arrived with the pin bump and failed this build until labelled.
 */
const DIFF_LABEL: Record<SchemaDiffEntry['kind'], string> = {
  missing_table: 'Missing table',
  missing_column: 'Missing column',
  type_mismatch: 'Type mismatch',
  nullability_mismatch: 'Nullability mismatch',
  unmapped_column: 'Unmapped column',
  pk_mismatch: 'Primary-key mismatch',
  index_mismatch: 'Index mismatch',
  unmapped_index: 'Unmapped index',
  default_mismatch: 'Column default mismatch',
};

export function ValidationPanel({ datasource }: ValidationPanelProps) {
  const [state, setState] = React.useState<RunState>('idle');
  const [results, setResults] = React.useState<SchemaValidationResult[]>([]);
  const [ok, setOk] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = React.useCallback(async () => {
    setState('running');
    setError(null);
    try {
      const report = await validateDatasource(datasource);
      setResults(report.results);
      setOk(report.ok);
      setState('done');
    } catch (err) {
      if (err instanceof ExternalServiceUnavailableError) {
        setState('unavailable');
      } else {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    }
  }, [datasource]);

  if (state === 'unavailable') {
    return (
      <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
        Federation is not enabled on this server, so validation is unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Check that every federated object on{' '}
          <span className="font-mono">{datasource}</span> still matches its live
          remote table.
        </p>
        <Button variant="outline" size="sm" onClick={() => void run()} disabled={state === 'running'}>
          {state === 'running' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlayCircle className="h-3.5 w-3.5" />
          )}
          <span className="ml-1.5">Run validation</span>
        </Button>
      </div>

      {error && (
        <div className="rounded border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
          {error}
        </div>
      )}

      {state === 'done' && ok !== null && (
        <div
          className={`flex items-center gap-2 rounded border p-2.5 text-sm ${
            ok
              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
              : 'border-destructive/40 bg-destructive/5 text-destructive'
          }`}
        >
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {ok
            ? `All ${results.length} object${results.length === 1 ? '' : 's'} match the remote schema.`
            : `${results.filter((r) => !r.ok).length} of ${results.length} object${
                results.length === 1 ? '' : 's'
              } diverge from the remote schema.`}
        </div>
      )}

      {state === 'done' && results.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No federated objects are bound to this datasource yet. Import a table
          from the Tables tab to get started.
        </div>
      )}

      {results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <ResultRow key={r.object} result={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({ result }: { result: SchemaValidationResult }) {
  return (
    <li className="rounded border bg-background">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        {result.ok ? (
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
        )}
        <span className="font-mono text-xs font-medium">{result.object}</span>
        {!result.ok && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {result.diffs.length} diff{result.diffs.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {result.diffs.length > 0 && (
        <ul className="border-t divide-y">
          {result.diffs.map((d, i) => (
            <DiffRow key={`${d.kind}:${d.column ?? ''}:${i}`} diff={d} />
          ))}
        </ul>
      )}
    </li>
  );
}

function DiffRow({ diff }: { diff: SchemaDiffEntry }) {
  const where = [diff.remoteSchema, diff.remoteName].filter(Boolean).join('.');
  const isError = diff.severity === 'error';
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-2.5 py-1.5 text-[11px]">
      <span
        className={`rounded px-1 py-0.5 font-medium uppercase tracking-wide text-[9px] ${
          isError
            ? 'bg-destructive/10 text-destructive'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
        }`}
      >
        {DIFF_LABEL[diff.kind] ?? diff.kind}
      </span>
      {where && <span className="font-mono text-muted-foreground">{where}</span>}
      {diff.column && <span className="font-mono">.{diff.column}</span>}
      {(diff.expected !== undefined || diff.actual !== undefined) && (
        <span className="text-muted-foreground">
          expected <span className="font-mono">{diff.expected ?? '—'}</span>, actual{' '}
          <span className="font-mono">{diff.actual ?? '—'}</span>
        </span>
      )}
    </li>
  );
}
