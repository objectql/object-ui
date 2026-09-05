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
import type { SpecAuthoredInput } from '../spec-input.js';

/**
 * The spec's `NavigationConfigSchema`, authoring side — by reference, with no
 * divergence of its own.
 *
 * This was a hand copy carrying the note "inline … to avoid importing from
 * @object-ui/types (which may not be a direct dependency of @object-ui/react)".
 * That reasoning is about the wrong package: the vocabulary belongs to
 * `@objectstack/spec`, which IS a direct dependency of this one — the same
 * expired "kept local to avoid a dependency" comment objectui#3169 found in
 * `@object-ui/app-shell`, where the dependency had likewise been there all
 * along. Check `package.json` before believing such a note (objectstack#4115).
 *
 * `mode` is OPTIONAL, because the spec says so and this hook agrees.
 * `packages/spec/src/ui/view.zod.ts` declares
 * `mode: NavigationModeSchema.default('page')`, and a `.default()` lands on the
 * AUTHORING side as `| undefined` — so `navigation: { view: 'summary_view' }`
 * is legal authored metadata that lets the mode default.
 *
 * Until objectui#4550 this alias `Omit`ted `mode` and re-added it as
 * `NonNullable<…>`, on the stated reasoning that "this hook dispatches on
 * `mode` and its callers always supply one". Both halves were false.
 * `useNavigationOverlay` does not require `mode` — it DEFAULTS it
 * (`navigation?.mode ?? 'page'`, ~140 lines below), and `'page'` is meaningful
 * behaviour rather than a placeholder. And callers did not always supply one:
 * `ListView` carried `schema.navigation as NavigationConfig | undefined` purely
 * to get a spec-shaped value past this declaration — a value the hook had
 * always been willing to take.
 *
 * The rule that makes this a producer-side fix rather than a caller-side one:
 * a type in front of an implementation must not be stricter than the
 * implementation. When it is, every caller pays in assertions, and an assertion
 * is exactly the renderer-side workaround AGENTS.md #0.1 sends back to the
 * producer. Here the producer was this line.
 *
 * `@object-ui/types` re-exports the spec's own `NavigationConfig` unchanged, so
 * that published name and this one now agree — they did not before, which is
 * how one monorepo shipped two `NavigationConfig`s that disagreed about whether
 * `mode` could be omitted. Pinned by
 * `__tests__/offline-nav-performance-spec-parity.test.ts` (the type) and
 * `__tests__/useNavigationOverlay.modeDefault.test.tsx` (the default behaviour
 * the relaxation rests on).
 *
 * Two per-key notes the hand copy carried, kept here because a derived alias
 * has no members to hang them on:
 *  - `size` is the coarse overlay bucket added by #2578; `resolveOverlayWidth`
 *    below maps it through {@link OVERLAY_SIZE_WIDTHS}.
 *  - `width` is DEPRECATED by #2578 in favour of `size`. It still wins when
 *    present, because app-shell pre-resolves `size` into it.
 */
export type NavigationConfig = SpecAuthoredInput<typeof NavigationConfigSchema>;

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
 * this alias resolved to exactly it already: `NavigationConfig['mode']` was then
 * `NonNullable<…['mode']>`, and stripping the `undefined` that the schema's
 * `.default()` puts on the authoring side leaves the seven-member enum itself.
 * So the spec reference was one hop away rather than absent — the alias just
 * reached it through a member access, which reads as a hand-written union to
 * `check:spec-symbols` and, more to the point, to a person.
 *
 * Bound to the spec directly instead: the seven members now arrive from the
 * schema that validates them. `__tests__/offline-nav-performance-spec-parity.test.ts`
 * pins that this stays the same type as `NonNullable<NavigationConfig['mode']>`,
 * so the two spellings cannot silently come apart if the spec ever stops
 * defaulting `mode` or defaults it on a narrower union.
 *
 * The `NonNullable` in that pin is objectui#4550's mark and is load-bearing:
 * `NavigationConfig` no longer strips the authoring-side `undefined`, so
 * `NavigationConfig['mode']` is `NavigationMode | undefined` and a bare
 * equality would now fail for a reason unrelated to the drift being guarded.
 * What stays pinned is the MEMBERSHIP — the seven modes this hook switches on
 * are exactly the seven the exported union publishes.
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
 * ## What to hand `objectName`
 *
 * The block's RECORD SOURCE — the object the clicked rows actually came from —
 * and never a bare top-level `schema.objectName` read in its place. objectui#6939
 * published `objectName` as the THIRD RUNG of one record-source ladder (`data`,
 * then `staticData`, then `objectName`), not as a parallel "page object"
 * concept, so a block has exactly ONE record source. `handleClick` below builds
 * the record-page URL `/{objectName}/record/{id}` out of whatever it is handed:
 * a caller that hands it the top-level key while its rows came from
 * `data.object` navigates to a record that the URL's own object does not
 * contain (objectui#7638).
 *
 * A caller that resolves a data config reads that ladder through the ONE shared
 * reader — `resolveRecordSourceObjectName` from `@object-ui/core`
 * (objectui#7627) — as the example does. A caller with NO data config has
 * nothing above rung three, and its `schema.objectName` already IS its record
 * source; that spelling is correct there and needs no conversion.
 *
 * @example
 * ```tsx
 * import {
 *   resolveRecordSourceConfig,
 *   resolveRecordSourceObjectName,
 * } from '@object-ui/core';
 *
 * const dataConfig = useMemo(() => resolveRecordSourceConfig(schema), [schema]);
 * const { handleClick, isOpen, selectedRecord, mode, close, width } =
 *   useNavigationOverlay({
 *     navigation: schema.navigation,
 *     objectName: resolveRecordSourceObjectName(schema, dataConfig),
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
