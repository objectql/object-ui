/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * NavigationOverlay
 *
 * A reusable component that renders record detail overlays based on
 * ViewNavigationConfig mode. Supports drawer (Sheet), modal (Dialog),
 * split (ResizablePanelGroup), and popover modes.
 *
 * Works in conjunction with useNavigationOverlay hook from @object-ui/react —
 * the hook manages state while this component handles the visual presentation.
 *
 * @example
 * ```tsx
 * import { useNavigationOverlay } from '@object-ui/react';
 * import { NavigationOverlay } from '@object-ui/components';
 *
 * const nav = useNavigationOverlay({
 *   navigation: schema.navigation,
 *   objectName: schema.objectName,
 * });
 *
 * return (
 *   <>
 *     <DataTable onRowClick={nav.handleClick} />
 *     <NavigationOverlay {...nav} title="Record Detail">
 *       {(record) => <RecordDetail record={record} />}
 *     </NavigationOverlay>
 *   </>
 * );
 * ```
 */

import React from 'react';
import { cn } from '../lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '../ui/resizable';

/** Navigation mode type — matches ViewNavigationConfig.mode */
export type NavigationOverlayMode =
  | 'page'
  | 'drawer'
  | 'modal'
  | 'split'
  | 'popover'
  | 'new_window'
  | 'none';

export interface NavigationOverlayProps {
  /** Whether the overlay is open */
  isOpen: boolean;
  /** The selected record */
  selectedRecord: Record<string, unknown> | null;
  /** The navigation mode */
  mode: NavigationOverlayMode;
  /** Close the overlay */
  close: () => void;
  /** Set open state (for controlled Sheet/Dialog onOpenChange) */
  setIsOpen: (open: boolean) => void;
  /** Width for the overlay (drawer/modal/split) */
  width?: string | number;
  /** Whether navigation is an overlay mode */
  isOverlay: boolean;
  /** Target view/form name from NavigationConfig */
  view?: string;
  /** Title for the overlay header */
  title?: string;
  /** Description for the overlay header */
  description?: string;
  /** CSS class for the overlay container */
  className?: string;
  /**
   * Render function for the overlay content.
   * Receives the selected record.
   */
  children: (record: Record<string, unknown>) => React.ReactNode;
  /**
   * Optional render function for a specific view/form based on `view` prop.
   * When provided, this takes priority over `children` for rendering overlay content.
   * Receives the selected record and the view name.
   */
  renderView?: (record: Record<string, unknown>, viewName: string) => React.ReactNode;
  /**
   * The main content to wrap (for split mode only).
   * In split mode, the main content is rendered in the left panel.
   */
  mainContent?: React.ReactNode;
  /**
   * Popover trigger element (for popover mode).
   */
  popoverTrigger?: React.ReactNode;
}

/**
 * Resolve width to CSS-compatible value
 */
function resolveWidth(width: string | number | undefined): string | undefined {
  if (width == null) return undefined;
  if (typeof width === 'number') return `${width}px`;
  return width;
}

/**
 * Compute CSS style from NavigationConfig width
 */
function getWidthStyle(width: string | number | undefined): React.CSSProperties {
  const resolved = resolveWidth(width);
  if (!resolved) return {};
  return { maxWidth: resolved, width: '100%' };
}

/**
 * NavigationOverlay — renders record detail in the configured overlay mode.
 *
 * Supports:
 * - **drawer**: Right-side Sheet panel
 * - **modal**: Center Dialog overlay
 * - **split**: Side-by-side ResizablePanelGroup
 * - **popover**: Hoverable/clickable popover card
 * - **page / new_window / none**: No overlay rendered (handled by hook)
 */
export const NavigationOverlay: React.FC<NavigationOverlayProps> = ({
  isOpen,
  selectedRecord,
  mode,
  close,
  setIsOpen,
  width,
  view,
  title,
  description,
  className,
  children,
  renderView,
  mainContent,
  popoverTrigger,
}) => {
  // Non-overlay modes don't render anything
  if (mode === 'page' || mode === 'new_window' || mode === 'none') {
    return null;
  }

  if (!selectedRecord) {
    return null;
  }

  const widthStyle = getWidthStyle(width);
  const resolvedTitle = title || 'Record Detail';

  // Use renderView when both renderView and view are provided; otherwise fallback to children
  const renderContent = (record: Record<string, unknown>) => {
    if (renderView && view) {
      return renderView(record, view);
    }
    return children(record);
  };

  // --- Drawer Mode (Sheet) ---
  if (mode === 'drawer') {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="right"
          className={cn('w-full sm:max-w-2xl overflow-y-auto', className)}
          style={widthStyle}
        >
          <SheetHeader>
            <SheetTitle>{resolvedTitle}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="mt-4">
            {renderContent(selectedRecord)}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // --- Modal Mode (Dialog) ---
  if (mode === 'modal') {
    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          className={cn('max-w-2xl max-h-[90vh] overflow-y-auto', className)}
          style={widthStyle}
        >
          <DialogHeader>
            <DialogTitle>{resolvedTitle}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="mt-4">
            {renderContent(selectedRecord)}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // --- Split Mode (Resizable Panels) ---
  if (mode === 'split') {
    if (!isOpen || !mainContent) {
      return null;
    }

    // Calculate panel sizes based on width config
    const detailPercent = width
      ? typeof width === 'number'
        ? Math.min(70, Math.max(20, (width / 1200) * 100))
        : 40
      : 40;
    const mainPercent = 100 - detailPercent;

    // Cast needed: ResizablePanelGroup has correct runtime behavior but
    // vite-plugin-dts may not resolve the direction prop type correctly
    const PanelGroup = ResizablePanelGroup as React.FC<any>;

    return (
      <PanelGroup direction="horizontal" className={cn('h-full', className)}>
        <ResizablePanel defaultSize={mainPercent} minSize={30}>
          {mainContent}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={detailPercent} minSize={20}>
          <div className="h-full overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{resolvedTitle}</h3>
              <button
                onClick={close}
                className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                aria-label="Close panel"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground mb-4">{description}</p>
            )}
            {renderContent(selectedRecord)}
          </div>
        </ResizablePanel>
      </PanelGroup>
    );
  }

  // --- Popover Mode ---
  if (mode === 'popover') {
    return (
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        {popoverTrigger && (
          <PopoverTrigger asChild>
            {popoverTrigger}
          </PopoverTrigger>
        )}
        <PopoverContent
          className={cn('w-96 max-h-[400px] overflow-y-auto p-4', className)}
          style={widthStyle}
        >
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{resolvedTitle}</h4>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {renderContent(selectedRecord)}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return null;
};

NavigationOverlay.displayName = 'NavigationOverlay';
