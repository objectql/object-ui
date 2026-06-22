/**
 * CommandPaletteProvider
 *
 * Single source of truth for whether the global ⌘K command palette is open,
 * plus the shared, idempotent commands used to open / close it.
 *
 * Why this exists — ADR-0054 "UI testability contract", Phase 1:
 *
 *  - **C1 (idempotent, direct triggers).** Every "open the palette" affordance —
 *    the top-bar search button, a programmatic caller, a deep-link — calls the
 *    SAME `openCommandPalette()`, which is idempotent (`setOpen(true)`), never a
 *    `toggle()`. Re-issuing "open" when already open is a no-op, so an automated
 *    driver can always *ensure* it is open. The previous header button re-emitted
 *    a synthetic `⌘K` `KeyboardEvent` and relied on the palette's global listener
 *    being mounted and the browser/OS not having reserved `⌘K` — which silently
 *    did nothing under automation (and in `⌘K`-reserving browsers).
 *  - **C3 (URL-addressable state).** Open state lives in the `?palette=1` search
 *    param, not component `useState`, so the palette is deep-linkable
 *    (`/apps/foo?palette=1`), restores on reload, and works with back/forward.
 *
 * `⌘K` stays an *accelerator*: the keydown handler toggles (close-on-repeat is a
 * keyboard nicety), but the OPEN path used by buttons / links / programmatic
 * callers is the idempotent `openCommandPalette()`.
 *
 * @module
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';

/** Canonical URL param reflecting the palette's open state. */
const PALETTE_PARAM = 'palette';
/** Legacy/alias param accepted on read (e.g. `?cmdk=1`). */
const PALETTE_PARAM_ALIAS = 'cmdk';

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

function isOpenParam(params: URLSearchParams): boolean {
  return params.get(PALETTE_PARAM) === '1' || params.get(PALETTE_PARAM_ALIAS) === '1';
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Open state is URL-derived (C3): one source of truth that makes the palette
  // deep-linkable + restore-on-reload, and makes "ensure open" idempotent for
  // free.
  const open = isOpenParam(searchParams);

  const setOpen = useCallback(
    (next: boolean) => {
      // Truly idempotent: when already in the target state, do nothing — no
      // redundant history navigation.
      if (next === isOpenParam(searchParams)) return;
      const sp = new URLSearchParams(searchParams);
      if (next) {
        sp.set(PALETTE_PARAM, '1');
        sp.delete(PALETTE_PARAM_ALIAS);
      } else {
        sp.delete(PALETTE_PARAM);
        sp.delete(PALETTE_PARAM_ALIAS);
      }
      // `replace` — toggling a transient overlay shouldn't pile up history.
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const openCommandPalette = useCallback(() => setOpen(true), [setOpen]);
  const closeCommandPalette = useCallback(() => setOpen(false), [setOpen]);

  // Toggle uses the functional updater so it never depends on `open` — keeping
  // the keydown listener below stable across navigations.
  const toggleCommandPalette = useCallback(() => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        if (isOpenParam(sp)) {
          sp.delete(PALETTE_PARAM);
          sp.delete(PALETTE_PARAM_ALIAS);
        } else {
          sp.set(PALETTE_PARAM, '1');
          sp.delete(PALETTE_PARAM_ALIAS);
        }
        return sp;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // ⌘K / Ctrl+K accelerator. Lives here (not in CommandPalette) so the command
  // and its shortcut share one definition and one open-state source. Toggle is
  // fine for the *keyboard* (close-on-repeat); buttons/links/programmatic open
  // paths use the idempotent openCommandPalette().
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggleCommandPalette]);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open, openCommandPalette, closeCommandPalette, toggleCommandPalette, setOpen }),
    [open, openCommandPalette, closeCommandPalette, toggleCommandPalette, setOpen],
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
