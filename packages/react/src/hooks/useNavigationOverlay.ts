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

/**
 * Inline ViewNavigationConfig to avoid importing from @object-ui/types
 * (which may not be a direct dependency of @object-ui/react).
 * Mirrors the canonical definition in @object-ui/types/objectql.ts.
 */
export interface NavigationConfig {
  mode: 'page' | 'drawer' | 'modal' | 'split' | 'popover' | 'new_window' | 'none';
  view?: string;
  preventNavigation?: boolean;
  openNewTab?: boolean;
  width?: string | number;
}

export type NavigationMode = NavigationConfig['mode'];

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
  /** The click handler to attach to rows/items */
  handleClick: (record: Record<string, unknown>) => void;
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
  const width = navigation?.width;
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
    (record: Record<string, unknown>) => {
      // External onRowClick takes full priority
      if (onRowClick) {
        onRowClick(record);
        return;
      }

      // No navigation config — default to page navigation
      if (!navigation) {
        const recordId = record._id || record.id;
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
        const recordId = record._id || record.id;
        if (onNavigate && recordId != null) {
          onNavigate(recordId as string | number, 'new_window');
          return;
        }
        const viewPath = view ? `/${view}` : '';
        const url = objectName ? `/${objectName}/${recordId}${viewPath}` : `/${recordId}${viewPath}`;
        window.open(url, '_blank');
        return;
      }

      // page — delegate to onNavigate callback
      if (mode === 'page') {
        const recordId = record._id || record.id;
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
    [onRowClick, navigation, mode, objectName, onNavigate, isOverlay]
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
