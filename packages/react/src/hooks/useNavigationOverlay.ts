/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * useNavigationOverlay
 *
 * A reusable hook for handling NavigationConfig-driven row/item click behavior.
 * Manages overlay state (drawer/modal/split/popover) and generates click handlers
 * that respect the ViewNavigationConfig specification.
 *
 * Used by plugin-grid, plugin-list, plugin-detail and any component that needs
 * NavigationConfig support.
 */

import { useState, useCallback, useMemo } from 'react';

import type { NavigationConfigSchema, NavigationMode as SpecNavigationMode } from '@objectstack/spec/ui';
import type { SpecAuthoredInput } from '../spec-input';

/**
 * The spec's `NavigationConfigSchema`, authoring side, with `mode` required.
 *
 * This was a hand copy carrying the note "inline … to avoid importing from
 * @object-ui/types (which may not be a direct dependency of @object-ui/react)".
 * That reasoning is about the wrong package: the vocabulary belongs to
 * `@objectstack/spec`, which IS a direct dependency of this one — the same
 * expired "kept local to avoid a dependency" comment objectui#3169 found in
 * `@object-ui/app-shell`, where the dependency had likewise been there all
 * along. Check `package.json` before believing such a note (objectstack#4115).
 *
 * The ONE divergence: the spec defaults `mode`, so its authoring side makes it
 * optional; this hook dispatches on `mode` and its callers always supply one,
 * so it is required here. Every other key is the spec's, by reference. Pinned
 * by `__tests__/offline-nav-performance-spec-parity.test.ts`.
 *
 * Two per-key notes the hand copy carried, kept here because a derived alias
 * has no members to hang them on:
 *  - `size` is the coarse overlay bucket added by #2578; `resolveOverlayWidth`
 *    below maps it through {@link OVERLAY_SIZE_WIDTHS}.
 *  - `width` is DEPRECATED by #2578 in favour of `size`. It still wins when
 *    present, because app-shell pre-resolves `size` into it.
 */
export type NavigationConfig = Omit<
  SpecAuthoredInput<typeof NavigationConfigSchema>,
  'mode'
> & {
  mode: NonNullable<SpecAuthoredInput<typeof NavigationConfigSchema>['mode']>;
};

/**
 * Pixel cap per overlay `size` bucket, clamped to the viewport at render —
 * mirrors `plugin-view/src/recordSurface.ts` (`OVERLAY_SIZE_PX`), which owns
 * the `size: 'auto'` field-count derivation this layer cannot perform (no
 * object schema here). Kept in lockstep by the spec-parity test.
 *
 * Before #2942 this hook only read the deprecated `width`, so an authored
 * `size` bucket was silently ignored by every host except app-shell (which
 * pre-resolves it before calling in).
 */
const OVERLAY_SIZE_WIDTHS: Record<'sm' | 'md' | 'lg' | 'xl' | 'full', string> = {
  sm: 'min(92vw, 480px)',
  md: 'min(92vw, 720px)',
  lg: 'min(92vw, 960px)',
  xl: 'min(92vw, 1200px)',
  full: 'min(92vw, 1600px)',
};

/**
 * Resolve the overlay width from a NavigationConfig: an explicit `width` wins
 * (app-shell pre-resolves `size` into it); otherwise a declared bucket maps
 * through {@link OVERLAY_SIZE_WIDTHS}. `'auto'`/absent stays `undefined` — the
 * host's default width — because deriving `auto` needs the object's field
 * count, which only schema-aware hosts have. Exported for the parity test.
 */
export function resolveOverlayWidth(navigation: NavigationConfig | undefined): string | number | undefined {
  if (!navigation) return undefined;
  if (navigation.width !== undefined) return navigation.width;
  const size = navigation.size;
  if (size && size !== 'auto') return OVERLAY_SIZE_WIDTHS[size];
  return undefined;
}

/**
 * The overlay modes — the spec's own union, DERIVED since objectui#4167.
 *
 * rc.6 publishes `NavigationMode` (`z.input<typeof NavigationModeSchema>`), and
 * this alias resolved to exactly it already: `NavigationConfig['mode']` above is
 * `NonNullable<…['mode']>`, and stripping the `undefined` that the schema's
 * `.default()` puts on the authoring side leaves the seven-member enum itself.
 * So the spec reference was one hop away rather than absent — the alias just
 * reached it through a member access, which reads as a hand-written union to
 * `check:spec-symbols` and, more to the point, to a person.
 *
 * Bound to the spec directly instead: the seven members now arrive from the
 * schema that validates them. `__tests__/offline-nav-performance-spec-parity.test.ts`
 * pins that this stays the same type as `NavigationConfig['mode']`, so the two
 * spellings cannot silently come apart if the spec ever stops defaulting `mode`.
 */
export type NavigationMode = SpecNavigationMode;

export interface UseNavigationOverlayOptions {
  /** The navigation configuration from the schema */
  navigation?: NavigationConfig;
  /** Object name — used to build default URLs for page/new_window modes */
  objectName?: string;
  /** External onNavigate callback (e.g., from ActionProvider or parent) */
  onNavigate?: (recordId: string | number, action?: string) => void;
  /** External onRowClick callback — if set, takes full priority */
  onRowClick?: (record: Record<string, unknown>) => void;
}

/**
 * Optional event-like payload accepted by `handleClick`. We don't depend on
 * React's synthetic event type to keep this hook framework-agnostic — only
 * the few fields needed for modifier detection are read.
 */
export interface HandleClickModifiers {
  /** macOS Command key — open in new tab when held */
  metaKey?: boolean;
  /** Windows/Linux Control key — open in new tab when held */
  ctrlKey?: boolean;
  /** Mouse button — 1 = middle click (treated as new tab) */
  button?: number;
}

export interface NavigationOverlayState {
  /** Whether the overlay (drawer/modal/split/popover) is open */
  isOpen: boolean;
  /** The record that triggered the navigation */
  selectedRecord: Record<string, unknown> | null;
  /** The resolved navigation mode */
  mode: NavigationMode;
  /** Close the overlay */
  close: () => void;
  /** Open the overlay with a specific record */
  open: (record: Record<string, unknown>) => void;
  /** Set the open state (for controlled Sheet/Dialog `onOpenChange`) */
  setIsOpen: (open: boolean) => void;
  /**
   * The click handler to attach to rows/items.
   *
   * Accepts an optional event (or any object with `metaKey`/`ctrlKey`/`button`)
   * to detect modifier clicks. When `Cmd`/`Ctrl`/middle-click is detected, the
   * record opens in a new browser tab as a full page regardless of the
   * configured mode — matches Linear / Notion / Airtable convention.
   */
  handleClick: (record: Record<string, unknown>, event?: HandleClickModifiers) => void;
  /** The width from NavigationConfig (for drawer/modal/split sizing) */
  width: string | number | undefined;
  /** Whether navigation is an overlay mode (drawer/modal/split/popover) */
  isOverlay: boolean;
  /** The target view/form name from NavigationConfig */
  view: string | undefined;
}

/**
 * Hook for NavigationConfig-driven navigation overlay.
 *
 * @example
 * ```tsx
 * const { handleClick, isOpen, selectedRecord, mode, close, width } =
 *   useNavigationOverlay({
 *     navigation: schema.navigation,
 *     objectName: schema.objectName,
 *     onNavigate: schema.onNavigate,
 *     onRowClick: props.onRowClick,
 *   });
 *
 * return (
 *   <>
 *     <DataTable onRowClick={handleClick} ... />
 *     {isOpen && mode === 'drawer' && (
 *       <Sheet open onOpenChange={() => close()}>
 *         <SheetContent style={{ maxWidth: width }}>
 *           <RecordDetail record={selectedRecord} />
 *         </SheetContent>
 *       </Sheet>
 *     )}
 *   </>
 * );
 * ```
 */
export function useNavigationOverlay(
  options: UseNavigationOverlayOptions
): NavigationOverlayState {
  const { navigation, objectName, onNavigate, onRowClick } = options;
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);

  const mode: NavigationMode = navigation?.mode ?? 'page';
  const width = resolveOverlayWidth(navigation);
  const view = navigation?.view;
  const isOverlay = mode === 'drawer' || mode === 'modal' || mode === 'split' || mode === 'popover';

  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedRecord(null);
  }, []);

  const open = useCallback((record: Record<string, unknown>) => {
    setSelectedRecord(record);
    setIsOpen(true);
  }, []);

  const handleClick = useCallback(
    (record: Record<string, unknown>, event?: HandleClickModifiers) => {
      // External onRowClick takes full priority. Forward the modifier event
      // so parent handlers (e.g. ObjectView) can still implement Cmd/Ctrl/
      // middle-click → open in new tab.
      if (onRowClick) {
        (onRowClick as (r: Record<string, unknown>, e?: HandleClickModifiers) => void)(record, event);
        return;
      }

      // Modifier / middle-click → always open in a new browser tab as a full
      // page. Mirrors browser link convention (Cmd/Ctrl+Click, middle-click)
      // so users can fan out multiple records into tabs from any list/board/
      // gallery, regardless of the configured navigation mode.
      const isModifierClick = !!(
        event && (event.metaKey || event.ctrlKey || event.button === 1)
      );
      if (isModifierClick) {
        const recordId = record.id || record._id;
        if (onNavigate && recordId != null) {
          onNavigate(recordId as string | number, 'new_window');
          return;
        }
      }

      // No navigation config — default to page navigation
      if (!navigation) {
        const recordId = record.id || record._id;
        if (onNavigate && recordId != null) {
          onNavigate(recordId as string | number, view ?? 'view');
        }
        return;
      }

      // 'none' or preventNavigation — do nothing
      if (mode === 'none' || navigation.preventNavigation) {
        return;
      }

      // new_window / openNewTab — delegate to onNavigate when available, else open directly
      if (mode === 'new_window' || navigation.openNewTab) {
        const recordId = record.id || record._id;
        if (onNavigate && recordId != null) {
          onNavigate(recordId as string | number, 'new_window');
          return;
        }
        // Build a URL that matches the AppContent route shape
        // `:objectName/record/:recordId`. Previously this used
        // `/{object}/{id}` which is unrouted and produced a silent
        // blank page when users middle-/Cmd-clicked a gallery card.
        const encodedId = encodeURIComponent(String(recordId));
        const url = objectName
          ? `/${objectName}/record/${encodedId}`
          : `/${encodedId}`;
        window.open(url, '_blank');
        return;
      }

      // page — delegate to onNavigate callback
      if (mode === 'page') {
        const recordId = record.id || record._id;
        if (onNavigate && recordId != null) {
          onNavigate(recordId as string | number, view ?? 'view');
        }
        return;
      }

      // Overlay modes: drawer, modal, split, popover
      if (isOverlay) {
        setSelectedRecord(record);
        setIsOpen(true);
        return;
      }
    },
    [onRowClick, navigation, mode, objectName, onNavigate, isOverlay, view]
  );

  return useMemo(
    () => ({
      isOpen,
      selectedRecord,
      mode,
      close,
      open,
      setIsOpen,
      handleClick,
      width,
      view,
      isOverlay,
    }),
    [isOpen, selectedRecord, mode, close, open, handleClick, width, view, isOverlay]
  );
}
