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
import { useObjectFields } from '../previews/useObjectFields.js';
import { CelPredicateField } from '../CelPredicateField.js';
import type { CelLintIssue } from '../celAuthoring.js';
import { t, useMetadataLocale } from '../i18n.js';

type Op = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'truthy' | 'falsy';

/** The quote character a string literal was authored with. Remembered per row
 *  so the builder re-emits the author's own spelling instead of normalising it
 *  (objectui#6296) — see {@link fmtValue}. */
type Quote = '"' | "'";

interface Row { subject: string; op: Op; value: string; quote?: Quote }

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

/**
 * The context subjects a record-scoped mount site binds. This is the DEFAULT
 * vocabulary — a caller that binds something else declares it via
 * {@link ConditionSubjectVocabulary.context}.
 */
const CONTEXT_SUBJECTS = [
  { value: 'record.id', label: 'record.id' },
  { value: 'user.id', label: 'user.id' },
  { value: 'user.email', label: 'user.email' },
  { value: 'user.role', label: 'user.role' },
  { value: 'user.isAdmin', label: 'user.isAdmin' },
  { value: 'org.id', label: 'org.id' },
];

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * The subject vocabulary a mount site binds (objectui#6296).
 *
 * The builder used to hardcode one: `record.` + field name, plus `record.id` /
 * `user.*` / `org.*`. That is right for every RECORD-scoped site — which is
 * all five that mount it today — and wrong for a FLATTENED-scoped one such as
 * the flow designer's entry condition, where the trigger record's fields ARE
 * the top-level evaluation context (bare `status`) and the prior values arrive
 * as `previous.FIELD`. See `flow-scope.ts`, which already computes exactly
 * this shape (`fieldPrefix: onStart ? '' : 'record.'`, `includePrevious`), and
 * objectstack's `packages/formula/src/validate.ts` for the two scopes.
 *
 * Declared, not inferred: the component never guesses a site's scope from the
 * value it is handed. A caller that declares nothing gets the record-scoped
 * default, unchanged.
 */
export interface ConditionSubjectVocabulary {
  /**
   * Prefix put in front of each catalog field name. Defaults to `'record.'`.
   * Pass `''` to declare a flattened scope, where bare `status` is the subject.
   */
  fieldPrefix?: string;
  /**
   * Also offer `previous.FIELD` for each catalog field, plus the whole-record
   * `previous` token — which is what makes the create-path idiom
   * `previous == null` selectable rather than something the author has to
   * recall from help text. Defaults to `false`.
   */
  includePrevious?: boolean;
  /**
   * Replace the context subjects. Defaults to {@link CONTEXT_SUBJECTS}. A
   * flattened site passes its own list rather than inheriting `record.id`,
   * whose root that site does not bind — offering it would make this editor
   * emit the one spelling its own sibling ref-check flags as out of scope.
   */
  context?: ReadonlyArray<{ value: string; label?: string }>;
}

/**
 * Scope roots a value typed into the value box may plainly REFERENCE, rather
 * than name as literal text (objectui#6293).
 *
 * Deliberately the roots this builder's own vocabulary already commits to —
 * not every root the CEL engine advertises:
 *
 *  - `record` / `user` / `org` — this component's own subject vocabulary
 *    (`record.<field>` from the field catalog, plus {@link CONTEXT_SUBJECTS}).
 *    A value under one of these is the same identifier the subject dropdown
 *    emits one control to its left.
 *  - `previous` — the prior persisted record, bound by `evalFieldPredicate`
 *    (`@object-ui/core`) and by the server-side hook / validation evaluators.
 *    This is the change-detection idiom the defect was measured on.
 *  - `current_user` — the canonical spelling of `user` (ADR-0068); the shell
 *    binds one identity object under both names, so which alias the author
 *    happened to type must not decide whether it reads as a reference.
 *  - `parent` — the header row an inline line-item cell compares against,
 *    bound through `evalFieldPredicate`'s `scope` extra.
 *
 * NOT included, on purpose: `data`, `os`, `app`, `features`, `input`, `vars`,
 * `page`. Those are real roots at some surfaces, but this builder never offers
 * them, and over-capturing there fails in the WRONG direction — `data.csv` is
 * a plausible literal, and `data` IS bound, so reading it as a reference would
 * produce another silently-false predicate instead of a loud one. Which roots
 * a mounting surface actually binds is caller-supplied vocabulary
 * (objectui#6296) and is that card's to declare, not this one's to guess.
 */
const REFERENCE_ROOTS = ['record', 'previous', 'parent', 'user', 'current_user', 'org'] as const;

/**
 * A dotted path under a declared root — i.e. plainly a reference.
 *
 * Anchored, and dotted identifiers only. "Contains a dot" is NOT the test: a
 * version string (`1.2.3`), a filename, and a path under a root nothing binds
 * all stay literal text.
 */
const REFERENCE_RE = new RegExp(
  `^(?:${REFERENCE_ROOTS.join('|')})(?:\\.[A-Za-z_][A-Za-z0-9_]*)+$`,
);

/**
 * Quote a raw value for CEL unless it is a number / boolean / null — or a
 * reference (objectui#6293).
 *
 * Quoting a reference was silent in both directions: `previous ==
 * 'previous.status'` is valid CEL, `previous` is a declared root, and a string
 * literal's contents are deliberately not scanned for references by
 * `flow-ref-check` or by the server-side validator — so the predicate parsed,
 * registered, evaluated, and was always false, with no author-time signal at
 * any layer. Emitting the reference is also what makes it CHECKABLE: it is now
 * an identifier those existing checkers can see.
 */
function fmtValue(v: string, quote: Quote = "'"): string {
  const t = v.trim();
  if (t === 'true' || t === 'false' || t === 'null') return t;
  if (t !== '' && !Number.isNaN(Number(t))) return t;
  if (REFERENCE_RE.test(t)) return t;
  // `quote` defaults to the single quote this function has always emitted, so
  // a row the author built here — and every row parsed from single-quoted CEL
  // — is byte-for-byte what it was before objectui#6296. Only a row parsed
  // from a DOUBLE-quoted literal carries `"`, and those did not reach row mode
  // at all until this change.
  const esc = quote === "'" ? t.replace(/'/g, "\\'") : t.replace(/"/g, '\\"');
  return `${quote}${esc}${quote}`;
}

/**
 * Inverse of fmtValue for display in the value input. A bare reference has no
 * quotes to strip and passes through unchanged, which is what keeps an emitted
 * `previous == previous.status` round-tripping back into the row builder.
 */
function unfmtValue(raw: string): { value: string; quote?: Quote } {
  const t = raw.trim();
  const sq = /^'(.*)'$/.exec(t);
  if (sq) return { value: sq[1].replace(/\\'/g, "'"), quote: "'" };
  // Double-quoted literals are the spelling every shipped flow-entry condition
  // uses, and the field's own placeholder teaches. Stripping only single
  // quotes while re-emitting only single quotes meant they could never
  // round-trip, so they were handed to the raw editor (objectui#6296).
  const dq = /^"(.*)"$/.exec(t);
  if (dq) return { value: dq[1].replace(/\\"/g, '"'), quote: '"' };
  return { value: t };
}

/** Compile rows → CEL. Rows without a subject are skipped (in-progress). */
function compile(rows: Row[], join: '&&' | '||'): string {
  return rows
    .filter((r) => r.subject)
    .map((r) => {
      if (r.op === 'truthy') return r.subject;
      if (r.op === 'falsy') return `!${r.subject}`;
      return `${r.subject} ${r.op} ${fmtValue(r.value, r.quote)}`;
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
    if (cmp) {
      const v = unfmtValue(cmp[3]);
      rows.push({ subject: cmp[1], op: cmp[2] as Op, value: v.value, quote: v.quote });
      continue;
    }
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

export function ConditionBuilder({ label, value, onCommit, objectName, fields: fieldsProp, disabled, onBlockingIssuesChange, subjects }: {
  label?: string;
  value: string;
  onCommit: (cel: string) => void;
  objectName?: string;
  /** Pre-fetched field catalog (e.g. from the generic form's widget context);
   *  when omitted, fields are loaded from `objectName`. */
  fields?: Array<{ name: string; label?: string; hidden?: boolean }>;
  disabled?: boolean;
  /**
   * Report how many BLOCKING author-time issues this editor is showing — a CEL
   * predicate that does not parse (objectui#4527). The inspector above
   * aggregates these and hands the total to the host through
   * `MetadataInspectorProps.onBlockingIssuesChange`, because the Save button
   * belongs to the host, not here.
   *
   * Optional: mount sites with no Save to gate simply omit it. Fires whenever
   * the aggregate changes, `0` when everything is clean.
   */
  onBlockingIssuesChange?: (count: number) => void;
  /**
   * What this mount site's subjects are called (objectui#6296). Omit for the
   * record-scoped default every existing consumer relies on.
   */
  subjects?: ConditionSubjectVocabulary;
}) {
  const { fields: hookFields } = useObjectFields(objectName);
  const fields = fieldsProp ?? hookFields;
  const fieldPrefix = subjects?.fieldPrefix ?? 'record.';
  const includePrevious = subjects?.includePrevious ?? false;
  const contextSubjects = subjects?.context ?? CONTEXT_SUBJECTS;
  const subjectOptions = React.useMemo(() => {
    const visible = fields.filter((f) => !f.hidden);
    const fieldOpts = visible.map((f) => ({
      value: `${fieldPrefix}${f.name}`,
      label: `${fieldPrefix}${f.name}`,
    }));
    // The whole-record `previous` comes first: `previous == null` is how an
    // author branches on the create leg of a create-or-update trigger, and it
    // reads as the head of the group rather than as one more field.
    const previousOpts = includePrevious
      ? [
          { value: 'previous', label: 'previous' },
          ...visible.map((f) => ({ value: `previous.${f.name}`, label: `previous.${f.name}` })),
        ]
      : [];
    const contextOpts = contextSubjects.map((c) => ({ value: c.value, label: c.label ?? c.value }));
    return [...fieldOpts, ...previousOpts, ...contextOpts];
  }, [fields, fieldPrefix, includePrevious, contextSubjects]);
  // The raw-expression editor's CEL assists (#1582): field-existence lint +
  // autocomplete need the bare field-name catalog and a locale-bound `t`.
  const locale = useMetadataLocale();
  const tLocal = React.useCallback((k: string) => t(k, locale), [locale]);
  const fieldNames = React.useMemo(
    () => fields.filter((f) => !f.hidden).map((f) => f.name),
    [fields],
  );

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

  /* ─── Blocking CEL verdicts → the inspector's aggregate (objectui#4527) ───
   *
   * The raw-expression editor is this component's ONLY CEL site — the row
   * builder compiles rows itself and mounts no `CelPredicateField` — so the
   * aggregate is that one editor's error count, DERIVED against the mode
   * rather than repaired by a reset effect.
   *
   * Deriving is what prevents the wedge. The raw editor exists only while
   * `raw` is true, and it can vanish while its last verdict was "1 error":
   * the adopt effect above flips `raw` false in the same commit when an
   * externally-changed value round-trips as a simple predicate, which
   * unmounts the editor and cancels its pending debounced lint. Nothing will
   * ever report `0` for it again, so a remembered count would hold Save shut
   * with no editor left on screen to fix it. */
  const [celErrors, setCelErrors] = React.useState(0);
  const reportCel = React.useCallback((issues: CelLintIssue[]) => {
    // Only `error` blocks Save; `warning` is advisory (typo / blast-radius),
    // matching the RLS editor and objectui#4306.
    const errs = issues.filter((i) => i.severity === 'error').length;
    setCelErrors((prev) => (prev === errs ? prev : errs));
  }, []);
  const blockingIssues = raw ? celErrors : 0;
  // Held in a ref so an unmemoized parent callback cannot re-fire the effect.
  const onBlockingIssuesChangeRef = React.useRef(onBlockingIssuesChange);
  React.useEffect(() => {
    onBlockingIssuesChangeRef.current = onBlockingIssuesChange;
  });
  React.useEffect(() => {
    onBlockingIssuesChangeRef.current?.(blockingIssues);
  }, [blockingIssues]);

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
        {/* CEL editor with inline lint + field autocomplete (#1582) — the same
            author-time assists the RLS policy editor gets, on the canonical
            @objectstack/formula engine. Replaces the bare <textarea>. */}
        <CelPredicateField
          label={tLocal('engine.condition.celLabel')}
          value={value}
          onChange={(v) => { lastEmitted.current = v; onCommit(v); }}
          onLintChange={reportCel}
          disabled={disabled}
          placeholder="record.status != 'done' && user.isAdmin"
          objectName={objectName}
          fieldNames={fieldNames}
          t={tLocal}
        />
        {value && !parse(value) && (
          <div className="text-[10px] text-muted-foreground/70">{tLocal('engine.condition.advancedHint')}</div>
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
