// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ConditionBuilder — a no-code editor for a CEL predicate (ServiceNow-style),
 * compiling rows of [subject][operator][value] joined by AND/OR into a CEL
 * string emitted via onCommit (empty ⇒ '' ⇒ caller should unset).
 *
 * Stateful by design: rows live in local state so an in-progress row (no
 * subject yet) stays on screen instead of vanishing the moment it compiles to
 * an empty string. The emitted CEL is recomputed from rows on every edit.
 *
 * Safety: on (re)load the builder only adopts an existing expression when it
 * parses AND round-trips byte-for-byte (whitespace-normalised). Anything it
 * can't round-trip cleanly opens in a raw expression textarea, so hand-authored
 * complex CEL is never silently rewritten.
 */

import * as React from 'react';
import {
  Button, Input, Label,
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@object-ui/components';
import { Plus, X, Code2, ListFilter } from 'lucide-react';
import { useObjectFields } from '../previews/useObjectFields';

type Op = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'truthy' | 'falsy';

interface Row { subject: string; op: Op; value: string }

const COMPARE_OPS: Array<{ value: Op; label: string }> = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '<', label: 'less than' },
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: 'truthy', label: 'is set / true' },
  { value: 'falsy', label: 'is empty / false' },
];

const CONTEXT_SUBJECTS = [
  { value: 'record.id', label: 'record.id' },
  { value: 'user.id', label: 'user.id' },
  { value: 'user.email', label: 'user.email' },
  { value: 'user.role', label: 'user.role' },
  { value: 'user.isAdmin', label: 'user.isAdmin' },
  { value: 'org.id', label: 'org.id' },
];

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Quote a raw value for CEL unless it is a number / boolean / null. */
function fmtValue(v: string): string {
  const t = v.trim();
  if (t === 'true' || t === 'false' || t === 'null') return t;
  if (t !== '' && !Number.isNaN(Number(t))) return t;
  return `'${t.replace(/'/g, "\\'")}'`;
}

/** Inverse of fmtValue for display in the value input. */
function unfmtValue(raw: string): string {
  const t = raw.trim();
  const m = /^'(.*)'$/.exec(t);
  if (m) return m[1].replace(/\\'/g, "'");
  return t;
}

/** Compile rows → CEL. Rows without a subject are skipped (in-progress). */
function compile(rows: Row[], join: '&&' | '||'): string {
  return rows
    .filter((r) => r.subject)
    .map((r) => {
      if (r.op === 'truthy') return r.subject;
      if (r.op === 'falsy') return `!${r.subject}`;
      return `${r.subject} ${r.op} ${fmtValue(r.value)}`;
    })
    .join(` ${join} `);
}

/** Parse a simple AND/OR predicate. Returns null if it isn't the simple shape. */
function parse(expr: string): { rows: Row[]; join: '&&' | '||' } | null {
  const s = norm(expr);
  if (!s) return { rows: [], join: '&&' };
  const hasAnd = s.includes('&&');
  const hasOr = s.includes('||');
  if (hasAnd && hasOr) return null; // mixed joins → too complex
  const join: '&&' | '||' = hasOr ? '||' : '&&';
  const parts = s.split(hasOr ? '||' : '&&').map((p) => p.trim());
  const rows: Row[] = [];
  for (const p of parts) {
    const cmp = /^([a-zA-Z_][\w.]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(p);
    if (cmp) { rows.push({ subject: cmp[1], op: cmp[2] as Op, value: unfmtValue(cmp[3]) }); continue; }
    const neg = /^!\s*([a-zA-Z_][\w.]*)$/.exec(p);
    if (neg) { rows.push({ subject: neg[1], op: 'falsy', value: '' }); continue; }
    const truthy = /^([a-zA-Z_][\w.]*)$/.exec(p);
    if (truthy) { rows.push({ subject: truthy[1], op: 'truthy', value: '' }); continue; }
    return null; // unrecognised term
  }
  return { rows, join };
}

function initFrom(value: string): { rows: Row[]; join: '&&' | '||'; raw: boolean } {
  const p = parse(value || '');
  if (p && norm(compile(p.rows, p.join)) === norm(value || '')) {
    return { rows: p.rows, join: p.join, raw: false };
  }
  return { rows: [], join: '&&', raw: !!value };
}

export function ConditionBuilder({ label, value, onCommit, objectName, fields: fieldsProp, disabled }: {
  label?: string;
  value: string;
  onCommit: (cel: string) => void;
  objectName?: string;
  /** Pre-fetched field catalog (e.g. from the generic form's widget context);
   *  when omitted, fields are loaded from `objectName`. */
  fields?: Array<{ name: string; label?: string; hidden?: boolean }>;
  disabled?: boolean;
}) {
  const { fields: hookFields } = useObjectFields(objectName);
  const fields = fieldsProp ?? hookFields;
  const subjectOptions = React.useMemo(() => {
    const fieldOpts = fields
      .filter((f) => !f.hidden)
      .map((f) => ({ value: `record.${f.name}`, label: `record.${f.name}` }));
    return [...fieldOpts, ...CONTEXT_SUBJECTS];
  }, [fields]);

  const init = React.useMemo(() => initFrom(value), []); // first mount only
  const [rows, setRowsState] = React.useState<Row[]>(init.rows);
  const [join, setJoin] = React.useState<'&&' | '||'>(init.join);
  const [raw, setRaw] = React.useState<boolean>(init.raw);

  // Adopt an externally-changed value (e.g. switching records, or a raw edit
  // from elsewhere) when it isn't the CEL we just emitted.
  const lastEmitted = React.useRef<string>(value || '');
  React.useEffect(() => {
    const v = value || '';
    if (v === lastEmitted.current) return;
    lastEmitted.current = v;
    const next = initFrom(v);
    setRowsState(next.rows);
    setJoin(next.join);
    setRaw(next.raw);
  }, [value]);

  const emit = (nextRows: Row[], nextJoin: '&&' | '||') => {
    const cel = compile(nextRows, nextJoin);
    lastEmitted.current = cel;
    onCommit(cel);
  };
  const update = (nextRows: Row[], nextJoin: '&&' | '||' = join) => {
    setRowsState(nextRows);
    setJoin(nextJoin);
    emit(nextRows, nextJoin);
  };

  const compiled = compile(rows, join);

  if (raw) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : <span />}
          <button type="button" disabled={disabled}
            onClick={() => { const n = initFrom(value); if (!value || !n.raw) { setRowsState(n.rows); setJoin(n.join); setRaw(false); } }}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50">
            <ListFilter className="h-3 w-3" /> Builder
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => { lastEmitted.current = e.target.value; onCommit(e.target.value); }}
          disabled={disabled}
          spellCheck={false}
          rows={2}
          placeholder="CEL expression, e.g. record.status != 'done' && user.isAdmin"
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-primary resize-y disabled:opacity-60"
        />
        {value && !parse(value) && (
          <div className="text-[10px] text-muted-foreground/70">Advanced expression — Builder only supports simple AND/OR conditions.</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        {label ? <Label className="text-xs text-muted-foreground">{label}</Label> : <span />}
        <button type="button" disabled={disabled} onClick={() => setRaw(true)}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-50">
          <Code2 className="h-3 w-3" /> Expression
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground">Always — no condition.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="space-y-1 rounded-md border border-border p-1.5">
              {i > 0 && (
                <div className="flex justify-center">
                  <Select value={join} onValueChange={(v) => update(rows, v as '&&' | '||')} disabled={disabled}>
                    <SelectTrigger className="h-6 w-16 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="&&">AND</SelectItem>
                      <SelectItem value="||">OR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <Select value={r.subject} onValueChange={(v) => update(rows.map((x, j) => j === i ? { ...x, subject: v } : x))} disabled={disabled}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="field / context" /></SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      {r.subject && !subjectOptions.some((o) => o.value === r.subject) && (
                        <SelectItem value={r.subject}>{r.subject}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={disabled} aria-label="Remove condition"
                  onClick={() => update(rows.filter((_, j) => j !== i))}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-28 shrink-0">
                  <Select value={r.op} onValueChange={(v) => update(rows.map((x, j) => j === i ? { ...x, op: v as Op } : x))} disabled={disabled}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPARE_OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {r.op !== 'truthy' && r.op !== 'falsy' && (
                  <Input className="h-7 flex-1 text-xs" value={r.value} placeholder="value" disabled={disabled}
                    onChange={(e) => update(rows.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={() => update([...rows, { subject: '', op: 'truthy', value: '' }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add condition
        </Button>
      )}

      {compiled && (
        <div className="rounded bg-muted/40 px-2 py-1 text-[10px] font-mono text-muted-foreground break-all">{compiled}</div>
      )}
    </div>
  );
}
