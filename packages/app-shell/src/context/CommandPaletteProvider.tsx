/**
 * CommandPaletteProvider
 *
 * Single source of truth for whether the global ⌘K command palette is open,
 * plus the shared, idempotent commands used to open / close it.
 *
 * Open state is delegated to {@link useUrlOverlay} (`?palette=1`, `?cmdk=1`
 * alias), so it is URL-addressable (deep-linkable, restore-on-reload,
 * back/forward) per ADR-0054 invariant C3, and every "open" affordance — the
 * top-bar search button, a programmatic caller, a deep-link — shares the same
 * idempotent `openCommandPalette()` (never a toggle) per C1.
 *
 * `⌘K` stays an *accelerator*: the keydown handler toggles (close-on-repeat is
 * a keyboard nicety), but the OPEN path used by buttons / links / programmatic
 * callers is the idempotent `openCommandPalette()`.
 *
 * @module
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useUrlOverlay } from '../hooks/useUrlOverlay';

export interface CommandPaletteContextValue {
  /** Whether the palette is currently open (derived from the URL). */
  open: boolean;
  /** Idempotent open — calling when already open is a no-op (C1). */
  openCommandPalette: () => void;
  /** Idempotent close. */
  closeCommandPalette: () => void;
  /** Toggle — reserved for the keyboard accelerator, not the open affordances. */
  toggleCommandPalette: () => void;
  /** Imperative setter, used by the dialog's `onOpenChange`. */
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const { open, setOpen, openOverlay, closeOverlay, toggleOverlay } = useUrlOverlay('palette', {
    alias: 'cmdk',
  });

  // ⌘K / Ctrl+K accelerator. Lives here (not in CommandPalette) so the command
  // and its shortcut share one definition and one open-state source. Toggle is
  // fine for the *keyboard* (close-on-repeat); buttons/links/programmatic open
  // paths use the idempotent openOverlay().
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleOverlay();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggleOverlay]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({
      open,
      openCommandPalette: openOverlay,
      closeCommandPalette: closeOverlay,
      toggleCommandPalette: toggleOverlay,
      setOpen,
    }),
    [open, openOverlay, closeOverlay, toggleOverlay, setOpen],
  );

  return (
    <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
  );
}

/**
 * Access the shared command-palette controls.
 *
 * Falls back to a no-op implementation when used outside a
 * `<CommandPaletteProvider>` (e.g. an `AppHeader` rendered in the `home`/`orgs`
 * variants, where no palette is mounted, or isolated unit tests). The trigger is
 * then inert rather than throwing — matching the prior behavior where the
 * synthetic `⌘K` had nothing to open.
 */
export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    return {
      open: false,
      openCommandPalette: () => {},
      closeCommandPalette: () => {},
      toggleCommandPalette: () => {},
      setOpen: () => {},
    };
  }
  return ctx;
}
