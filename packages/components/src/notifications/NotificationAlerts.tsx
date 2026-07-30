/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `displayType: 'alert'` — a blocking acknowledgement.
 *
 * Why NOT the action system's `ModalHandler` (#3014, open question 2): that
 * handler is `(schema, context) => Promise<ActionResult>` — it resolves a page
 * or object, renders it as a modal, and reports the outcome back to the
 * `ActionRunner`. A notification alert has no schema, no target and no action
 * result; it is a message plus an acknowledgement. Routing it there would mean
 * synthesizing a page just to say "OK" and requiring an action runtime to
 * present a notification. So `alert` renders through the Radix `AlertDialog`
 * primitive — the blocking-acknowledgement primitive — which duplicates none of
 * the action-modal machinery.
 */

import * as React from 'react';
import { useNotifications, useNotificationsByPresentation } from '@object-ui/react';
import { cn } from '../lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { notificationIcon, notificationSeverityStyle } from './severity';

export interface NotificationAlertsProps {
  /** Extra classes for the dialog content. */
  className?: string;
  /** Label of the acknowledge button. Default `OK`. */
  acknowledgeLabel?: string;
}

/**
 * Renders `alert` notifications one at a time as a blocking dialog.
 *
 * @example
 * ```tsx
 * <NotificationProvider>
 *   <App />
 *   <NotificationAlerts />
 * </NotificationProvider>
 * ```
 */
export function NotificationAlerts({ className, acknowledgeLabel = 'OK' }: NotificationAlertsProps) {
  const alerts = useNotificationsByPresentation('alert');
  const { dismiss } = useNotifications();

  // The list is newest-first; a blocking queue is FIFO, so the OLDEST unhandled
  // alert is the one the user is currently being asked to acknowledge.
  const notification = alerts[alerts.length - 1];
  if (!notification) return null;

  const { iconTone } = notificationSeverityStyle(notification.severity);
  const Icon = notificationIcon(notification);
  const acknowledge = () => dismiss(notification.id);
  // `dismissible: false` removes the wave-it-away paths (Escape); it never
  // removes the acknowledge button — an alert nobody can acknowledge is a trap.
  const blocking = notification.dismissible === false;

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open && !blocking) acknowledge(); }}>
      <AlertDialogContent
        className={className}
        data-notification-surface="alert"
        data-severity={notification.severity}
        onEscapeKeyDown={(event) => { if (blocking) event.preventDefault(); }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {/* eslint-disable-next-line react-hooks/static-components -- notificationIcon returns a module-cached stable component per name, not one created during render */}
            <Icon className={cn('h-5 w-5 shrink-0', iconTone)} aria-hidden="true" />
            {notification.title}
          </AlertDialogTitle>
          {notification.message ? (
            <AlertDialogDescription>{notification.message}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {notification.actions?.map((action) => (
            <AlertDialogAction
              key={action.label}
              className={cn(action.variant === 'destructive' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
              onClick={() => { action.onClick(); acknowledge(); }}
            >
              {action.label}
            </AlertDialogAction>
          ))}
          <AlertDialogAction
            className={cn(notification.actions?.length ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : undefined)}
            onClick={acknowledge}
          >
            {acknowledgeLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

NotificationAlerts.displayName = 'NotificationAlerts';
