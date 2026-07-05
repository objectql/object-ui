// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Package-identifier input shared by the three package wizards (switcher
 * create, landing create, landing duplicate). Fixes the dogfood wizard
 * findings (framework#2615 P2): illegal characters are still normalized
 * away, but no longer silently — a notice says so — and while the value
 * doesn't parse as a package id yet, an inline hint spells out the
 * reverse-domain format instead of leaving the user staring at a disabled
 * create button.
 */

import * as React from 'react';
import { PACKAGE_ID_RE, sanitizePackageId } from './packages-io';
import { t } from '../metadata-admin/i18n';

export interface PackageIdInputProps {
  value: string;
  /** Receives the sanitized value on every keystroke. */
  onChange: (value: string) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  locale?: string;
  testId?: string;
}

export function PackageIdInput({
  value,
  onChange,
  onEnter,
  onEscape,
  placeholder,
  autoFocus,
  locale,
  testId,
}: PackageIdInputProps): React.ReactElement {
  // "I typed something and it vanished" — show what was dropped until the
  // next clean keystroke.
  const [strippedNotice, setStrippedNotice] = React.useState(false);
  const invalid = value.trim().length > 0 && !PACKAGE_ID_RE.test(value.trim());

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          const { value: next, stripped } = sanitizePackageId(e.target.value);
          setStrippedNotice(stripped);
          onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.();
          if (e.key === 'Escape') onEscape?.();
        }}
        placeholder={placeholder}
        data-testid={testId}
        className="h-7 w-full rounded-md border bg-background px-2 font-mono text-[11px] outline-none focus:ring-1 focus:ring-primary"
      />
      {strippedNotice && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400" data-testid="pkg-id-stripped">
          {t('engine.studio.pkg.idStrippedNotice', locale)}
        </p>
      )}
      {invalid && (
        <p className="text-[10px] text-muted-foreground" data-testid="pkg-id-format-hint">
          {t('engine.studio.pkg.idFormatHint', locale)}
        </p>
      )}
    </div>
  );
}

/**
 * Hint under the display-name input when the name yields no identifier
 * suggestion (CJK-only names slug to nothing) — say the id must be typed
 * manually instead of leaving the id box silently empty.
 */
export function PackageIdSuggestionHint({
  show,
  locale,
}: {
  show: boolean;
  locale?: string;
}): React.ReactElement | null {
  if (!show) return null;
  return (
    <p className="text-[10px] text-muted-foreground" data-testid="pkg-id-manual-hint">
      {t('engine.studio.pkg.idFromNameUnavailable', locale)}
    </p>
  );
}
