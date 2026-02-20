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
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { DialogOverlay, DialogPortal } from '../ui/dialog';

export const MobileDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
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
));
MobileDialogContent.displayName = 'MobileDialogContent';
