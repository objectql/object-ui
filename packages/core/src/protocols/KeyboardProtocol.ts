/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Keyboard Protocol Bridge
 *
 * Converts spec-aligned keyboard navigation and focus management
 * schemas into runtime-usable configurations, shortcut parsers,
 * and focus trap settings.
 *
 * @module protocols/KeyboardProtocol
 * @packageDocumentation
 */

import type {
  KeyboardNavigationConfig,
  KeyboardShortcut,
  FocusManagement,
  FocusTrapConfig,
} from '@object-ui/types';

// ============================================================================
// Resolved Types
// ============================================================================

/** Fully resolved keyboard navigation configuration. */
export interface ResolvedKeyboardConfig {
  shortcuts: KeyboardShortcut[];
  focusManagement: ResolvedFocusManagement;
  rovingTabindex: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  role?: string;
}

/** Fully resolved focus management configuration. */
export interface ResolvedFocusManagement {
  tabOrder: 'auto' | 'manual';
  skipLinks: boolean;
  focusVisible: boolean;
  focusTrap?: ResolvedFocusTrapConfig;
  arrowNavigation: boolean;
}

/** Fully resolved focus trap configuration. */
export interface ResolvedFocusTrapConfig {
  enabled: boolean;
  initialFocus?: string;
  returnFocus: boolean;
  escapeDeactivates: boolean;
}

/** Parsed keyboard shortcut descriptor. */
export interface ParsedShortcut {
  key: string;
  ctrlOrMeta: boolean;
  shift: boolean;
  alt: boolean;
}

/** Minimal keyboard event shape for matching (no React dependency). */
export interface KeyboardEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

// ============================================================================
// Keyboard Config Resolution
// ============================================================================

/**
 * Resolve a keyboard navigation configuration by applying spec defaults.
 *
 * @param config - KeyboardNavigationConfig from the spec
 * @returns Fully resolved keyboard navigation configuration
 */
export function resolveKeyboardConfig(config: KeyboardNavigationConfig): ResolvedKeyboardConfig {
  const ariaLabel = typeof config.ariaLabel === 'string'
    ? config.ariaLabel
    : config.ariaLabel?.defaultValue;

  return {
    shortcuts: config.shortcuts ?? [],
    focusManagement: resolveFocusManagement(config.focusManagement),
    rovingTabindex: config.rovingTabindex ?? false,
    ariaLabel,
    ariaDescribedBy: config.ariaDescribedBy,
    role: config.role,
  };
}

/**
 * Resolve focus management configuration with defaults.
 */
function resolveFocusManagement(fm?: FocusManagement): ResolvedFocusManagement {
  return {
    tabOrder: fm?.tabOrder ?? 'auto',
    skipLinks: fm?.skipLinks ?? false,
    focusVisible: fm?.focusVisible ?? true,
    focusTrap: fm?.focusTrap ? createFocusTrapConfig(fm.focusTrap) : undefined,
    arrowNavigation: fm?.arrowNavigation ?? false,
  };
}

// ============================================================================
// Shortcut Parsing
// ============================================================================

/**
 * Parse a shortcut string like "Ctrl+Shift+S" into a structured descriptor.
 * Recognises Ctrl, Meta, Cmd (mapped to ctrlOrMeta), Shift, and Alt modifiers.
 * The last segment is treated as the key.
 *
 * Keys are normalised to lowercase for case-insensitive matching. The Shift
 * modifier is tracked separately, so "Shift+A" and "Shift+a" are equivalent
 * (both represent the same physical key combination).
 *
 * @param shortcut - Shortcut string (e.g. "Ctrl+S", "Alt+Shift+N", "Escape")
 * @returns Parsed shortcut descriptor
 */
export function parseShortcutKey(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+').map(p => p.trim());
  const modifiers = new Set(parts.slice(0, -1).map(m => m.toLowerCase()));
  const key = (parts[parts.length - 1] ?? '').toLowerCase();

  return {
    key,
    ctrlOrMeta: modifiers.has('ctrl') || modifiers.has('meta') || modifiers.has('cmd'),
    shift: modifiers.has('shift'),
    alt: modifiers.has('alt'),
  };
}

// ============================================================================
// Shortcut Matching
// ============================================================================

/**
 * Test whether a keyboard event matches a shortcut string.
 * Comparison is case-insensitive; the Shift modifier is checked separately.
 *
 * @param event - The keyboard event (or a plain object with key + modifier flags)
 * @param shortcut - Shortcut string (e.g. "Ctrl+S")
 * @returns `true` if the event matches the shortcut
 */
export function matchesShortcut(event: KeyboardEventLike, shortcut: string): boolean {
  const parsed = parseShortcutKey(shortcut);

  if (event.key.toLowerCase() !== parsed.key) return false;

  const eventCtrlOrMeta = !!(event.ctrlKey || event.metaKey);
  if (parsed.ctrlOrMeta !== eventCtrlOrMeta) return false;

  if (parsed.shift !== !!(event.shiftKey)) return false;
  if (parsed.alt !== !!(event.altKey)) return false;

  return true;
}

// ============================================================================
// Focus Trap Configuration
// ============================================================================

/**
 * Create a resolved focus trap configuration from a spec FocusTrapConfig.
 *
 * @param config - FocusTrapConfig from the spec
 * @returns Resolved focus trap configuration with defaults applied
 */
export function createFocusTrapConfig(config: FocusTrapConfig): ResolvedFocusTrapConfig {
  return {
    enabled: config.enabled ?? false,
    initialFocus: config.initialFocus,
    returnFocus: config.returnFocus ?? true,
    escapeDeactivates: config.escapeDeactivates ?? true,
  };
}
