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
import { Maximize2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
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
  /**
   * Optional handler invoked when the user clicks the "Expand to full page"
   * affordance in the drawer/modal header. Mirrors Linear / Notion / Airtable
   * peek-to-full-page behavior — the consumer is responsible for closing the
   * overlay and router-pushing to the full record route.
   *
   * When omitted, the expand button is not rendered.
   */
  onExpand?: () => void;
  /** Optional label for the expand button (accessible name & tooltip). */
  expandLabel?: string;
  /**
   * Optional storage key for persisting the user's manually-resized drawer
   * width (drawer mode only). When provided, the drawer renders a drag
   * handle on its left edge and remembers the resized width in
   * `localStorage` across sessions. Use a stable, scoped key such as
   * `'drawer-width:lead'` so different objects get independent widths.
   *
   * When omitted, the drag handle is hidden and width is fully controlled
   * by the `width` prop / configured ceiling.
   */
  storageKey?: string;
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
 * Compute CSS style from NavigationConfig width.
 *
 * Exposes the requested width as a `--ov-w` CSS variable rather than
 * setting `maxWidth` directly. This lets the overlay's className apply the
 * cap only above the `sm` breakpoint (`sm:max-w-[var(--ov-w)]`), so on
 * mobile the drawer can occupy the full viewport — matching the Linear /
 * Notion / Salesforce mobile peek pattern. Setting an inline maxWidth
 * unconditionally caps the drawer at e.g. 70vw even on a 390px phone,
 * leaving an unusable empty strip on the side.
 */
function getWidthStyle(width: string | number | undefined): React.CSSProperties {
  const resolved = resolveWidth(width);
  if (!resolved) return {};
  return { ['--ov-w' as any]: resolved };
}

/** Hard floor for drag-resize — narrower than this and the body becomes unusable. */
const DRAWER_MIN_PX = 360;
/** Soft ceiling — keep at least a thin sliver of underlying page visible. */
const DRAWER_MAX_VW_FACTOR = 0.95;

/**
 * Drawer resize state — drag handle on the left edge, value persisted to
 * localStorage so the same user gets a consistent width across sessions /
 * objects. Returns `null` when storageKey is absent (resize disabled).
 */
function useDrawerResize(storageKey: string | undefined) {
  const [width, setWidth] = React.useState<number | null>(null);
  const draggingRef = React.useRef(false);

  // Restore persisted width on mount.
  React.useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(`ov:${storageKey}`);
      if (!raw) return;
      const n = Number(raw);
      if (Number.isFinite(n) && n >= DRAWER_MIN_PX) setWidth(n);
    } catch {
      // ignore (private mode / quota)
    }
  }, [storageKey]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (!storageKey || typeof window === 'undefined') return;
    e.preventDefault();
    draggingRef.current = true;

    const maxPx = Math.floor(window.innerWidth * DRAWER_MAX_VW_FACTOR);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      // Drawer is right-anchored: rightX = window.innerWidth, leftX = mouseX.
      const next = Math.min(maxPx, Math.max(DRAWER_MIN_PX, window.innerWidth - ev.clientX));
      setWidth(next);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      // Persist the latest value (read from state via functional setter to
      // avoid stale closures over the start-of-drag width).
      setWidth((latest) => {
        if (latest != null) {
          try {
            window.localStorage.setItem(`ov:${storageKey}`, String(latest));
          } catch {
            // ignore
          }
        }
        return latest;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [storageKey]);

  // Double-click handle resets to the host-configured width.
  const handleDoubleClick = React.useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return;
    setWidth(null);
    try {
      window.localStorage.removeItem(`ov:${storageKey}`);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { width, handleMouseDown, handleDoubleClick, enabled: !!storageKey };
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
  onExpand,
  expandLabel = 'Open as full page',
  storageKey,
}) => {
  const widthStyle = getWidthStyle(width);
  const resolvedTitle = title || 'Record Detail';
  // Keep hooks above all conditional returns. Opening a record changes
  // selectedRecord from null to an object, but hook order must stay stable.
  const resize = useDrawerResize(mode === 'drawer' ? storageKey : undefined);

  // Non-overlay modes don't render anything
  if (mode === 'page' || mode === 'new_window' || mode === 'none') {
    return null;
  }

  if (!selectedRecord) {
    return null;
  }

  // Drawer width policy:
  // - If the user explicitly drag-resized, honor that exact pixel value
  //   (their choice always wins).
  // - Otherwise, treat the authored width as a *floor*. On wide monitors,
  //   weakly-authored values like 600px get bumped up to a healthier
  //   `min(60vw, 880px)` so the drawer doesn't feel cramped on 1920px
  //   displays. Strongly-authored larger values still win via `max()`.
  // - The mobile gate (`sm:` on the className) prevents this from
  //   affecting phones.
  const authoredWidthCss = resolveWidth(width) ?? '42rem';
  const drawerStyle: React.CSSProperties = resize.width != null
    ? { ['--ov-w' as any]: `${resize.width}px` }
    : { ['--ov-w' as any]: `max(${authoredWidthCss}, min(60vw, 880px))` };

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
          className={cn(
            // Mobile: full width (no inline cap, no max-w from base sheet).
            // sm+: honor the host-supplied width via `--ov-w` CSS var with a
            // sensible 2xl ceiling so very wide configs don't dwarf the
            // page. The host's className still wins on more specific tokens.
            'w-screen max-w-none sm:w-full sm:max-w-[var(--ov-w,42rem)] p-0 flex flex-col gap-0 overflow-hidden',
            // Hide shadcn Sheet's auto-rendered close (X) — it's the LAST
            // direct <button> child of SheetContent. We render our own close
            // inside the header so it sits in a single button cluster
            // visually aligned with the expand action.
            '[&>button:last-of-type]:hidden',
            className,
          )}
          style={drawerStyle}
        >
          {/* Drag-resize handle — only rendered on sm+ (mobile uses full
              viewport so there's nothing meaningful to resize). The
              4px-wide invisible hit-area sits flush with the left edge;
              the visible 1px tint reacts on hover so users discover the
              affordance. Double-click resets to the configured default. */}
          {resize.enabled && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize drawer"
              onMouseDown={resize.handleMouseDown}
              onDoubleClick={resize.handleDoubleClick}
              className="hidden sm:block absolute left-0 top-0 bottom-0 z-30 w-1 cursor-col-resize touch-none bg-transparent hover:bg-primary/40 active:bg-primary/60 transition-colors"
            />
          )}
          {/* Chrome header — subdued breadcrumb-style label that does not
              compete with the record-title rendered by the embedded content.
              Buttons live in the same flex row so they share vertical
              centering with the title text (no absolute positioning, no
              pixel-perfect math to maintain). */}
          <SheetHeader className="shrink-0 flex-row items-center justify-between gap-2 space-y-0 px-4 py-2 border-b bg-muted/30">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-xs font-medium tracking-wide text-muted-foreground">
                {resolvedTitle}
              </SheetTitle>
              {description ? (
                <SheetDescription className="truncate text-xs">{description}</SheetDescription>
              ) : (
                <SheetDescription className="sr-only">
                  Record detail overlay for {resolvedTitle}.
                </SheetDescription>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {onExpand && (
                <button
                  type="button"
                  onClick={onExpand}
                  aria-label={expandLabel}
                  title={expandLabel}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              )}
              <SheetClose asChild>
                <button
                  type="button"
                  aria-label="Close"
                  title="Close"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </SheetClose>
            </div>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
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
          className={cn(
            'w-[calc(100vw-1rem)] max-w-none sm:max-w-[var(--ov-w,42rem)] max-h-[90vh] overflow-y-auto',
            className,
          )}
          style={widthStyle}
        >
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              aria-label={expandLabel}
              title={expandLabel}
              className="absolute right-12 top-4 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          <DialogHeader>
            <DialogTitle>{resolvedTitle}</DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                Record detail overlay for {resolvedTitle}.
              </DialogDescription>
            )}
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
    if (!popoverTrigger) {
      // Fallback: render as a compact floating card when no trigger element is provided
      if (!isOpen) return null;
      return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent
            className={cn('w-96 max-h-[80vh] overflow-y-auto p-4', className)}
            style={widthStyle}
          >
            <DialogHeader>
              <DialogTitle className="text-sm">{resolvedTitle}</DialogTitle>
              {description ? (
                <DialogDescription className="text-xs">{description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  Record detail overlay for {resolvedTitle}.
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="mt-2">
              {renderContent(selectedRecord)}
            </div>
          </DialogContent>
        </Dialog>
      );
    }
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
