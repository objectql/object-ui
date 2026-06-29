/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * MobileDialogContent
 *
 * A mobile-optimized wrapper around the upstream Shadcn DialogContent.
 * On mobile (< sm breakpoint), the dialog is full-screen with a larger
 * close-button touch target (≥ 44×44px per WCAG 2.5.5).
 * On tablet+ (≥ sm), it falls back to the standard centered dialog.
 *
 * This lives in `custom/` to avoid modifying the Shadcn-synced `ui/dialog.tsx`.
 */

import * as React from 'react';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DialogOverlay, DialogPortal } from '../ui/dialog';

/**
 * Radix Select / Popover / DropdownMenu render their flyout into a portal at
 * `document.body` — physically OUTSIDE this DialogContent's DOM. So clicking an
 * empty part of an open dropdown reads as an "interact outside" and would close
 * the whole dialog. Suppress that: if the interaction's real target sits inside
 * a Radix popper layer, keep the dialog open (the popper closes itself). A real
 * backdrop click (target = overlay) is untouched and still closes the dialog.
 */
const POPPER_LAYER_SELECTOR =
  '[data-radix-popper-content-wrapper],[data-radix-select-content],[data-radix-select-viewport]';

/**
 * True when `target` sits inside a Radix popper flyout (Select / Popover /
 * DropdownMenu). Such elements are portalled to `document.body`, so an
 * "interact outside" the dialog whose target is one of them is really an
 * interaction with the dialog's own dropdown — it must not close the dialog.
 */
export function isInsidePopperLayer(target: Element | null | undefined): boolean {
  return !!target?.closest?.(POPPER_LAYER_SELECTOR);
}

export const MobileDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onInteractOutside, ...props }, ref) => {
  const handleInteractOutside = React.useCallback(
    (event: Parameters<NonNullable<typeof onInteractOutside>>[0]) => {
      const target = (event.detail?.originalEvent?.target ?? null) as Element | null;
      if (isInsidePopperLayer(target)) {
        event.preventDefault();
        return;
      }
      onInteractOutside?.(event);
    },
    [onInteractOutside],
  );
  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      onInteractOutside={handleInteractOutside}
      className={cn(
        // Mobile-first: full-screen
        'fixed inset-0 z-50 w-full bg-background p-4 shadow-lg duration-200',
        'h-[100dvh]',
        // Desktop (sm+): centered dialog with border + rounded corners
        'sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]',
        'sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-lg sm:border sm:p-6',
        // Animations
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
        'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className={cn(
          'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity',
          'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground',
          // Mobile touch target ≥ 44×44px (WCAG 2.5.5)
          'min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center',
        )}
      >
        <X className="h-5 w-5 sm:h-4 sm:w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
  );
});
MobileDialogContent.displayName = 'MobileDialogContent';
