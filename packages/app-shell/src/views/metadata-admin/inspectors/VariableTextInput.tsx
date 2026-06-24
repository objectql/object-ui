// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * VariableTextInput — a single-line input (or textarea) for an expression /
 * template flow-config value, with a "{x}" data-picker (#1934) that inserts an
 * in-scope reference at the cursor.
 *
 * Brace handling is done FOR the author (ADR-0032): the picker inserts the BARE
 * reference (`discount_pct`) in `expression` fields and the braced
 * `{discount_pct}` in `template` (text / textarea) fields — killing the
 * recurring `{record.x}` brace-in-CEL trap. Free-text typing is untouched, and
 * the picker button is hidden entirely when nothing is in scope, so an empty
 * scope degrades to a plain input.
 */

import * as React from 'react';
import { Braces } from 'lucide-react';
import {
  cn,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@object-ui/components';
import type { ScopeGroup } from './useFlowScope';

export type VariableFieldMode = 'expression' | 'template';

/** Wrap a bare reference token for insertion into the given field mode. */
export function formatToken(token: string, mode: VariableFieldMode): string {
  return mode === 'template' ? `{${token}}` : token;
}

/**
 * Splice a reference into `value` at the selection `[selStart, selEnd]`, in the
 * brace mode for the field, returning the new string and the caret position
 * just after the inserted token. Pure (the DOM caret restore lives in the
 * component); selection bounds are clamped and order-normalized so a reversed or
 * out-of-range selection can't corrupt the value.
 */
export function insertToken(
  value: string,
  mode: VariableFieldMode,
  token: string,
  selStart: number,
  selEnd: number,
): { next: string; caret: number } {
  const text = formatToken(token, mode);
  const a = Math.min(Math.max(selStart, 0), value.length);
  const b = Math.min(Math.max(selEnd, 0), value.length);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { next: value.slice(0, lo) + text + value.slice(hi), caret: lo + text.length };
}

export interface VariableTextInputProps {
  value: string;
  onValueChange: (v: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Brace rule: bare token for `expression`, `{token}` for `template`. */
  mode: VariableFieldMode;
  /** In-scope reference groups (from useFlowScope). Empty → no picker button. */
  groups: ScopeGroup[];
  placeholder?: string;
  disabled?: boolean;
  /** Render a multi-line `<textarea>` instead of a single-line input. */
  multiline?: boolean;
  rows?: number;
  /** Monospace the input text (expressions). Textareas are always mono. */
  mono?: boolean;
  className?: string;
}

const PICK_LABEL = 'Insert a reference';
const SEARCH_LABEL = 'Search references…';
const EMPTY_LABEL = 'No matching references.';

export function VariableTextInput({
  value,
  onValueChange,
  onBlur,
  onKeyDown,
  mode,
  groups,
  placeholder,
  disabled,
  multiline,
  rows = 4,
  mono,
  className,
}: VariableTextInputProps) {
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Remember the caret across the button press (which blurs the field) so the
  // token lands where the author was typing — not appended at the end.
  const caret = React.useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const [open, setOpen] = React.useState(false);

  const setRef = (el: HTMLInputElement | HTMLTextAreaElement | null) => {
    inputRef.current = el;
  };

  const rememberCaret = () => {
    const el = inputRef.current;
    if (el) {
      caret.current = {
        start: el.selectionStart ?? value.length,
        end: el.selectionEnd ?? value.length,
      };
    }
  };

  const insert = (token: string) => {
    const { next, caret: pos } = insertToken(value, mode, token, caret.current.start, caret.current.end);
    onValueChange(next);
    setOpen(false);
    // Restore focus + place the caret just after the inserted token.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* some input types disallow setSelectionRange */
      }
      caret.current = { start: pos, end: pos };
    });
  };

  const hasScope = groups.some((g) => g.refs.length > 0);

  const shared = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValueChange(e.target.value),
    onBlur,
    onKeyDown,
    onSelect: rememberCaret,
    onKeyUp: rememberCaret,
    onClick: rememberCaret,
    placeholder,
    disabled,
  };

  return (
    <div className={cn('relative', className)}>
      {multiline ? (
        <textarea
          ref={setRef}
          {...shared}
          rows={rows}
          className="w-full rounded border bg-background px-2 py-1.5 pr-8 font-mono text-xs"
        />
      ) : (
        <Input ref={setRef} {...shared} className={cn('h-8 pr-8 text-sm', mono && 'font-mono')} />
      )}

      {hasScope && !disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={PICK_LABEL}
              title={PICK_LABEL}
              // Capture the caret on mousedown (fires before the input blur), so
              // the insertion point is the author's last position.
              onMouseDown={rememberCaret}
              className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Braces className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-72 p-0"
            // Keep our rAF focus-restore from fighting Radix's focus return.
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <Command>
              <CommandInput placeholder={SEARCH_LABEL} className="h-9" />
              <CommandList>
                <CommandEmpty>{EMPTY_LABEL}</CommandEmpty>
                {groups.map((g) => (
                  <CommandGroup key={g.id} heading={g.label}>
                    {g.refs.map((ref) => (
                      <CommandItem
                        key={`${g.id}:${ref.token}`}
                        value={`${ref.token} ${ref.label} ${ref.detail ?? ''}`}
                        onSelect={() => insert(ref.token)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate font-mono text-xs">{formatToken(ref.token, mode)}</span>
                        {ref.detail && (
                          <span className="shrink-0 truncate text-[10px] text-muted-foreground">{ref.detail}</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
