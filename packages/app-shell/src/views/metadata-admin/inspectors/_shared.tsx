// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Shared building blocks for scoped metadata inspectors.
 *
 * Every inspector renders the same three regions:
 *   • Header strip — kind chip + element label + close button
 *   • Scrollable form area — labelled inputs in a single column
 *   • Footer — destructive "remove this element" button
 *
 * The widgets below factor those regions out so each per-type
 * inspector can stay focused on field definitions and update logic.
 *
 * All inputs are uncontrolled-from-outside: parent owns the draft
 * record, inspectors call `onCommit(value)` which trips an immutable
 * splice + `onPatch({...})`. Locale-aware via the `useT` hook the
 * caller already has in scope — the shared shell takes raw strings.
 */

import * as React from 'react';
import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react';
import { cn } from '@object-ui/components';
import { Badge, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@object-ui/components';

/* ─────────────── Layout shell ─────────────── */

export interface InspectorShellProps {
  kindLabel: string;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /**
   * Optional reorder controls rendered to the left of the close button.
   * Use {@link InspectorReorderButtons} for the standard ↑/↓ pair.
   */
  headerActions?: React.ReactNode;
  /**
   * Hide the close (×) button. Used by "home" inspectors that have no
   * better state to fall back to (e.g. the View inspector is the default
   * right-panel for a view, so closing it would just re-open it).
   */
  hideClose?: boolean;
}

export function InspectorShell({ kindLabel, title, onClose, closeLabel = 'Close', children, footer, headerActions, hideClose }: InspectorShellProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b px-4 py-2.5">
        <div className="min-w-0">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{kindLabel}</Badge>
          <div className="mt-1 truncate text-sm font-medium" title={title}>{title}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {headerActions}
          {!hideClose && (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label={closeLabel} className="h-7 w-7 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">{children}</div>
      {footer && <div className="border-t px-4 py-2.5">{footer}</div>}
    </div>
  );
}

/* ─────────────── Reorder buttons ─────────────── */

export interface InspectorReorderButtonsProps {
  /** Current 0-based index of the selected item. */
  index: number;
  /** Total number of siblings. */
  total: number;
  /** Called with the new index when the user clicks ↑ or ↓. */
  onMove: (toIndex: number) => void;
  /** Localized aria-labels (e.g. tr('engine.inspector.reorder.up', locale)). */
  upLabel?: string;
  downLabel?: string;
  /** Disable both buttons (read-only inspectors). */
  disabled?: boolean;
}

/**
 * Compact ↑/↓ pair sized to fit alongside the close button in the
 * inspector header. Auto-disables boundaries (↑ at index 0, ↓ at
 * `total - 1`) and the whole pair when `total <= 1`.
 */
export function InspectorReorderButtons({
  index,
  total,
  onMove,
  upLabel = 'Move up',
  downLabel = 'Move down',
  disabled,
}: InspectorReorderButtonsProps) {
  if (total <= 1 || index < 0) return null;
  const canUp = !disabled && index > 0;
  const canDown = !disabled && index < total - 1;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => canUp && onMove(index - 1)}
        disabled={!canUp}
        aria-label={upLabel}
        title={upLabel}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={() => canDown && onMove(index + 1)}
        disabled={!canDown}
        aria-label={downLabel}
        title={downLabel}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </>
  );
}

/* ─────────────── Form atoms ─────────────── */

export function InspectorTextField({
  label,
  value,
  onCommit,
  onBlur,
  placeholder,
  disabled,
  mono,
  testId,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  /** Fired on blur with the final value — e.g. to derive a dependent field. */
  onBlur?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mono?: boolean;
  /** Stable hook for e2e/dogfood selectors. */
  testId?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        onBlur={(e) => onBlur?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        className={cn('h-8 text-sm', mono && 'font-mono')}
      />
    </div>
  );
}

export function InspectorNumberField({
  label,
  value,
  onCommit,
  placeholder,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onCommit(v === '' ? undefined : Number(v));
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function InspectorSelectField({
  label,
  value,
  options,
  onCommit,
  placeholder = '—',
  disabled,
}: {
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onCommit: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  // Radix `<Select.Item>` forbids an empty-string value (it reserves ""
  // for the cleared/placeholder state), yet callers legitimately use ""
  // to mean "no value" (e.g. a "— None —" option). Bridge with an
  // internal sentinel so the public contract (value="" ⇄ none) holds.
  const toInner = (v: string) => (v === '' ? SELECT_NONE_SENTINEL : v);
  const fromInner = (v: string) => (v === SELECT_NONE_SENTINEL ? '' : v);
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select
        value={toInner(value ?? '')}
        onValueChange={(v) => onCommit(fromInner(v))}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={toInner(o.value)}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const SELECT_NONE_SENTINEL = '__inspector_select_none__';

export function InspectorCheckboxField({
  label,
  value,
  onCommit,
  disabled,
}: {
  label: string;
  value: boolean;
  onCommit: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onCommit(e.target.checked)}
        className="h-3.5 w-3.5"
      />
      <span>{label}</span>
    </label>
  );
}

export function InspectorRemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  // Calm by default (muted outline), escalating to destructive-red only on
  // hover — a full-width solid-red bar reads as alarming for what is a routine
  // "remove this element" footer action. The trash icon keeps intent clear.
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="w-full gap-1.5 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export function InspectorEmptyState({ message }: { message: string }) {
  return <div className="text-xs italic text-muted-foreground p-4 text-center">{message}</div>;
}

/**
 * Helper to immutably splice an item in an array on a draft.
 * Returns a new array; never mutates input.
 */
export function spliceArray<T>(arr: T[] | undefined, index: number, replacement: T | null): T[] {
  const a = Array.isArray(arr) ? [...arr] : [];
  if (replacement === null) a.splice(index, 1);
  else a[index] = replacement;
  return a;
}

/**
 * Insert `item` at `index` immutably. Index out of range clamps to
 * [0, length]. Returns a new array; never mutates input.
 */
export function insertArray<T>(arr: T[] | undefined, index: number, item: T): T[] {
  const a = Array.isArray(arr) ? [...arr] : [];
  const i = Math.max(0, Math.min(a.length, index));
  a.splice(i, 0, item);
  return a;
}

/**
 * Append `item` to the end immutably. Convenience wrapper over
 * insertArray for the common "+ Add at end" case.
 */
export function appendArray<T>(arr: T[] | undefined, item: T): T[] {
  const a = Array.isArray(arr) ? [...arr] : [];
  a.push(item);
  return a;
}

/**
 * Move an item from `from` to `to` immutably. Out-of-range or no-op
 * moves return a new copy unchanged. Useful for ↑/↓ reorder buttons.
 */
export function moveArray<T>(arr: T[] | undefined, from: number, to: number): T[] {
  const a = Array.isArray(arr) ? [...arr] : [];
  if (from < 0 || from >= a.length) return a;
  const clampedTo = Math.max(0, Math.min(a.length - 1, to));
  if (clampedTo === from) return a;
  const [item] = a.splice(from, 1);
  a.splice(clampedTo, 0, item);
  return a;
}

/**
 * Generate a snake_case id that doesn't collide with `existing`. Used
 * by Add helpers that need a stable identifier (Flow nodes, App nav,
 * Dashboard widgets) before the user fills in a meaningful name.
 *
 *   uniqueId('node', ['node_1', 'node_3']) -> 'node_2'
 */
export function uniqueId(prefix: string, existing: ReadonlyArray<string | undefined | null>): string {
  const taken = new Set(existing.filter((x): x is string => typeof x === 'string'));
  for (let i = 1; i < 10_000; i++) {
    const candidate = `${prefix}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${prefix}_${Date.now()}`;
}
