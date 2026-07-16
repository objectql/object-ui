/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * CEL predicate editor for RLS `USING` / `CHECK` clauses (objectui#2413).
 *
 * Replaces the bare `<textarea>` with the same visual field plus three
 * author-time safeties, all backed by the framework's canonical CEL engine
 * (see {@link file://./celAuthoring.ts}):
 *
 *  - inline LINT — parse faults (blocking) and typo / blast-radius advisories,
 *    surfaced under the field as you type (debounced);
 *  - as-you-type AUTOCOMPLETE — the target object's fields, the scope roots
 *    (`current_user`, `record`, …) and the stdlib functions, so a mistyped
 *    identifier is caught before it silently never matches.
 *
 * The test-run affordance lives one level up (per-policy) in
 * {@link file://./CelTestRunDialog.tsx}, so both `USING` and `CHECK` can be
 * dry-run against one sample record.
 */

import * as React from 'react';
import { Label, Textarea, cn } from '@object-ui/components';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  lintCelPredicate,
  introspectCelScope,
  tokenAt,
  buildCandidates,
  filterCandidates,
  type CelLintIssue,
  type CelSuggestion,
  type CelSuggestionKind,
} from './celAuthoring';

const LINT_DEBOUNCE_MS = 250;

const KIND_TAG: Record<CelSuggestionKind, string> = {
  field: 'field',
  root: 'scope',
  function: 'fn',
};

export interface CelPredicateFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Human label for the clause (e.g. "USING (read filter)"). */
  label: string;
  /** The policy's target object api-name — powers field lint + autocomplete. */
  objectName?: string;
  /** Known field names of {@link objectName}. */
  fieldNames?: string[];
  /** Which RLS clause this is (drives the pushdown / fail-open advisory). */
  clause?: 'using' | 'check';
  /** Reports the current lint issues up so the editor can gate Save on errors. */
  onLintChange?: (issues: CelLintIssue[]) => void;
  t: (k: string) => string;
  id?: string;
}

const EMPTY_FIELDS: string[] = [];

export function CelPredicateField({
  value,
  onChange,
  disabled,
  placeholder,
  label,
  objectName,
  fieldNames = EMPTY_FIELDS,
  clause,
  onLintChange,
  t,
  id,
}: CelPredicateFieldProps) {
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const [issues, setIssues] = React.useState<CelLintIssue[]>([]);
  const [linted, setLinted] = React.useState(false);
  const [candidates, setCandidates] = React.useState<CelSuggestion[]>([]);

  const [open, setOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<CelSuggestion[]>([]);
  const [active, setActive] = React.useState(0);
  const tokenRef = React.useRef<{ start: number; end: number } | null>(null);
  const pendingCaret = React.useRef<number | null>(null);

  // Stable dep for the field-name array (parent may pass a fresh array each render).
  const fieldsKey = fieldNames.join(',');

  // Keep the reporter out of the lint effect deps (parent may not memoize it).
  const onLintChangeRef = React.useRef(onLintChange);
  React.useEffect(() => {
    onLintChangeRef.current = onLintChange;
  });

  /* Debounced lint. */
  React.useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      lintCelPredicate(value, { objectName, fields: fieldNames, clause }).then((res) => {
        if (cancelled) return;
        setIssues(res);
        setLinted(true);
        onLintChangeRef.current?.(res);
      });
    }, LINT_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, objectName, fieldsKey, clause]);

  /* Report "clean" upward when the field empties (no debounce needed). */
  React.useEffect(() => {
    if (!value.trim()) {
      setIssues([]);
      setLinted(false);
      onLintChangeRef.current?.([]);
    }
  }, [value]);

  /* Load the autocomplete catalog when the target object / fields change. */
  React.useEffect(() => {
    let cancelled = false;
    introspectCelScope({ objectName, fields: fieldNames }).then((scope) => {
      if (!cancelled) setCandidates(buildCandidates(scope));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectName, fieldsKey]);

  /* Restore the caret after a controlled-value change from accepting a suggestion. */
  React.useEffect(() => {
    if (pendingCaret.current != null && taRef.current) {
      const pos = pendingCaret.current;
      pendingCaret.current = null;
      taRef.current.setSelectionRange(pos, pos);
    }
  }, [value]);

  const closeAc = React.useCallback(() => {
    setOpen(false);
    setSuggestions([]);
    tokenRef.current = null;
  }, []);

  const refreshAc = React.useCallback(() => {
    const ta = taRef.current;
    if (!ta || disabled) return closeAc();
    const text = ta.value;
    const caret = ta.selectionStart ?? text.length;
    const tok = tokenAt(text, caret);
    if (!tok) return closeAc();
    const matches = filterCandidates(candidates, tok.text);
    if (!matches.length) return closeAc();
    tokenRef.current = { start: tok.start, end: tok.end };
    setSuggestions(matches);
    setActive(0);
    setOpen(true);
  }, [candidates, disabled, closeAc]);

  const accept = React.useCallback(
    (s: CelSuggestion) => {
      const tok = tokenRef.current;
      const ta = taRef.current;
      if (!tok || !ta) return;
      const text = ta.value;
      const insert = s.kind === 'function' ? `${s.label}(` : s.label;
      const next = text.slice(0, tok.start) + insert + text.slice(tok.end);
      pendingCaret.current = tok.start + insert.length;
      closeAc();
      onChange(next);
    },
    [onChange, closeAc],
  );

  // When the async identifier catalog resolves while the author is mid-token,
  // surface the menu without requiring another keystroke.
  const refreshAcRef = React.useRef(refreshAc);
  React.useEffect(() => {
    refreshAcRef.current = refreshAc;
  }, [refreshAc]);
  React.useEffect(() => {
    if (taRef.current && document.activeElement === taRef.current) refreshAcRef.current();
  }, [candidates]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      accept(suggestions[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAc();
    }
  };

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const clean = linted && !!value.trim() && issues.length === 0;
  const listId = id ? `${id}-ac` : undefined;

  return (
    <div>
      <Label className="text-[10px] uppercase text-muted-foreground" htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <Textarea
          ref={taRef}
          id={id}
          value={value}
          disabled={disabled}
          rows={2}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={open ? listId : undefined}
          aria-invalid={errors.length > 0 || undefined}
          onChange={(e) => {
            onChange(e.target.value);
            refreshAc();
          }}
          onKeyDown={onKeyDown}
          onClick={refreshAc}
          onBlur={() => {
            // Delay so an option's onMouseDown can fire first.
            window.setTimeout(() => closeAc(), 120);
          }}
          className={cn(
            'font-mono text-xs',
            errors.length > 0 && 'border-destructive focus-visible:ring-destructive/40',
          )}
        />
        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            aria-label={t('perm.cel.suggestions')}
            className="absolute z-50 mt-1 max-h-48 w-72 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            {suggestions.map((s, i) => (
              <li
                key={`${s.kind}:${s.label}`}
                role="option"
                aria-selected={i === active}
                // onMouseDown (not onClick) so it fires before the textarea blur.
                onMouseDown={(e) => {
                  e.preventDefault();
                  accept(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1 text-xs',
                  i === active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                )}
              >
                <span className="font-mono">{s.label}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{KIND_TAG[s.kind]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Inline lint findings. */}
      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="mt-1 space-y-1" aria-live="polite">
          {errors.map((iss, i) => (
            <li key={`e${i}`} className="flex items-start gap-1.5 text-[11px] text-destructive">
              <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" />
              <span>{iss.message}</span>
            </li>
          ))}
          {warnings.map((iss, i) => (
            <li key={`w${i}`} className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-500">
              <AlertTriangle className="mt-[1px] h-3 w-3 shrink-0" />
              <span>{iss.message}</span>
            </li>
          ))}
        </ul>
      )}
      {clean && (
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-500" />
          {t('perm.cel.valid')}
        </p>
      )}
    </div>
  );
}

export default CelPredicateField;
