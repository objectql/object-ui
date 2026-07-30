/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/react - Notification Context
 *
 * Provides a spec-driven notification system to the component tree.
 * Implements NotificationSchema, NotificationConfigSchema, and
 * NotificationActionSchema from @objectstack/spec v2.0.7.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/** Notification severity levels aligned with NotificationSeveritySchema */
export type NotificationSeverityLevel = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification presentation — the spec `NotificationTypeSchema`
 * (`ui/notification.zod.ts`: toast / snackbar / banner / alert / inline).
 * Every member has a DISTINCT presentation; see {@link NOTIFICATION_PRESENTATIONS}.
 */
export type NotificationPresentation =
  | 'toast'
  | 'snackbar'
  | 'banner'
  | 'alert'
  | 'inline';

/**
 * Notification display type as AUTHORED. Identical to
 * {@link NotificationPresentation} plus the deprecated renderer-local `modal`
 * spelling, which stored items may still carry (#2942) and which resolves to
 * `alert`. Use {@link resolveNotificationPresentation} to get the presentation.
 */
export type NotificationDisplayType =
  | NotificationPresentation
  /** @deprecated renderer dialect — never in the spec; presented as `alert` */
  | 'modal';

/**
 * Where a presentation is rendered.
 *
 * - `delegate` — handed to the provider's `onToast` callback; the host owns the
 *   overlay (sonner in the console). Historically EVERY type took this path,
 *   which is why a `banner` surfaced as a toast (#3014).
 * - everything else names a surface component that subscribes to the context
 *   and renders the items in place. `@object-ui/components` ships one per
 *   surface (`NotificationSnackbar` / `NotificationBanners` /
 *   `NotificationAlerts` / `NotificationInline`).
 */
export type NotificationSurface = 'delegate' | 'snackbar' | 'banner' | 'alert' | 'inline';

export interface NotificationPresentationBehavior {
  /** The surface responsible for rendering this presentation. */
  surface: NotificationSurface;
  /**
   * Whether the presentation auto-dismisses when the raiser declares no
   * `duration`. A toast/snackbar is transient by definition; a banner is a
   * persistent strip and an alert is a blocking acknowledgement, so neither may
   * evaporate on the shared 5s timer. An explicit `duration` always wins.
   */
  transient: boolean;
}

/**
 * The presentation table — one entry per spec `NotificationTypeSchema` member.
 *
 * Typed as `Record<NotificationPresentation, …>`, so adding a member to the
 * spec enum fails type-check here until its presentation is decided, rather
 * than silently falling back to a toast.
 */
export const NOTIFICATION_PRESENTATIONS: Record<
  NotificationPresentation,
  NotificationPresentationBehavior
> = {
  toast: { surface: 'delegate', transient: true },
  snackbar: { surface: 'snackbar', transient: true },
  banner: { surface: 'banner', transient: false },
  alert: { surface: 'alert', transient: false },
  inline: { surface: 'inline', transient: false },
};

/**
 * Resolve an authored `displayType` to the presentation that renders it:
 * the spec default (`toast`) when absent, and `alert` for the deprecated
 * `modal` dialect.
 */
export function resolveNotificationPresentation(
  displayType?: NotificationDisplayType,
): NotificationPresentation {
  if (displayType === 'modal') return 'alert';
  if (displayType && displayType in NOTIFICATION_PRESENTATIONS) return displayType;
  return 'toast';
}

/**
 * Notification position — the spec `NotificationPositionSchema`
 * (underscore spellings). The hyphen forms are this context's historical
 * dialect, kept accepted for stored items.
 */
export type NotificationPositionValue =
  | 'top_left'
  | 'top_center'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_center'
  | 'bottom_right'
  /** @deprecated legacy spelling — use `top_left` */
  | 'top-left'
  /** @deprecated legacy spelling — use `top_center` */
  | 'top-center'
  /** @deprecated legacy spelling — use `top_right` */
  | 'top-right'
  /** @deprecated legacy spelling — use `bottom_left` */
  | 'bottom-left'
  /** @deprecated legacy spelling — use `bottom_center` */
  | 'bottom-center'
  /** @deprecated legacy spelling — use `bottom_right` */
  | 'bottom-right';

/**
 * The spec vocabularies this context implements — exported for the parity
 * tests (#2942), which fail the moment `NotificationTypeSchema` /
 * `NotificationPositionSchema` and these sets drift in either direction.
 */
export const SUPPORTED_NOTIFICATION_DISPLAY_TYPES: ReadonlySet<string> = new Set(
  Object.keys(NOTIFICATION_PRESENTATIONS),
);
export const SUPPORTED_NOTIFICATION_POSITIONS: ReadonlySet<string> = new Set([
  'top_left', 'top_center', 'top_right', 'bottom_left', 'bottom_center', 'bottom_right',
]);

/** Action button on a notification */
export interface NotificationActionButton {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline';
}

/** A single notification item */
export interface NotificationItem {
  id: string;
  title: string;
  message?: string;
  severity: NotificationSeverityLevel;
  /**
   * The presentation the raiser asked for. Materialized by `notify()` — stored
   * items always carry a resolved {@link NotificationPresentation}, never
   * `modal` and never `undefined`.
   */
  displayType?: NotificationDisplayType;
  actions?: NotificationActionButton[];
  /**
   * Duration in ms (0 = persistent). Defaults to the configured duration for
   * TRANSIENT presentations (toast / snackbar) and to persistent for the rest —
   * a banner that evaporates after 5s is not a banner.
   */
  duration?: number;
  /**
   * Whether the surface offers a dismiss control (spec `dismissible`, default
   * `true`). Only meaningful for the persistent presentations — a transient
   * one dismisses itself.
   */
  dismissible?: boolean;
  /**
   * `inline` only — names the surface that raised it, so the matching
   * `<NotificationInline scope="…" />` renders it in place instead of every
   * inline outlet on the page showing every inline notification. Renderer-local
   * routing metadata, not a spec field: the spec describes what a notification
   * IS, not which React subtree hosts it.
   */
  scope?: string;
  /** Whether the notification has been read */
  read?: boolean;
  /** Timestamp */
  createdAt: Date;
  /** Optional icon name (lucide icon) */
  icon?: string;
}

/** Configuration for the notification system */
export interface NotificationSystemConfig {
  /** Default position for toast notifications */
  position?: NotificationPositionValue;
  /** Default duration in ms */
  defaultDuration?: number;
  /** Maximum number of visible notifications */
  maxVisible?: number;
  /** Whether to stack notifications */
  stacking?: boolean;
}

export interface NotificationProviderProps {
  children: React.ReactNode;
  /** System configuration */
  config?: NotificationSystemConfig;
  /**
   * External toast handler (e.g. Sonner) — the `toast` presentation's surface.
   *
   * Called ONLY for `displayType: 'toast'`. It used to receive every
   * notification, which is why the other four spec types all surfaced as
   * toasts (#3014); they now render through their own surface components,
   * which subscribe via {@link useNotificationsByPresentation}.
   */
  onToast?: (notification: NotificationItem) => void;
}

interface NotificationContextValue {
  /** All notifications (including history) */
  notifications: NotificationItem[];
  /** Unread notification count */
  unreadCount: number;
  /** Add a notification */
  notify: (notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => string;
  /** Convenience: show info notification */
  info: (title: string, message?: string) => string;
  /** Convenience: show success notification */
  success: (title: string, message?: string) => string;
  /** Convenience: show warning notification */
  warning: (title: string, message?: string) => string;
  /** Convenience: show error notification */
  error: (title: string, message?: string) => string;
  /** Mark a notification as read */
  markAsRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Dismiss a notification */
  dismiss: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
  /** System configuration */
  config: NotificationSystemConfig;
  /**
   * Announce that a surface is mounted and will render `surface` items.
   * Returns the unregister callback. Surfaces call this from an effect; the
   * provider uses it only to warn (dev builds) when a notification is raised
   * with nothing on screen able to present it.
   */
  registerSurface: (surface: NotificationSurface) => () => void;
}

let notificationCounter = 0;

/** Dev-build check — same idiom as `SchemaRenderer`'s `__DEV__`. */
const __DEV__ = (() => {
  try {
    return (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV
      !== 'production';
  } catch {
    return true;
  }
})();

/** Dev-only guidance for a presentation raised with no surface mounted. */
const SURFACE_HINTS: Record<NotificationSurface, string> = {
  delegate: 'pass `onToast` to <NotificationProvider>',
  snackbar: 'mount <NotificationSnackbar /> from @object-ui/components',
  banner: 'mount <NotificationBanners /> from @object-ui/components',
  alert: 'mount <NotificationAlerts /> from @object-ui/components',
  inline: 'mount <NotificationInline /> from @object-ui/components at the raising surface',
};

const NotificationCtx = createContext<NotificationContextValue | null>(null);

/**
 * NotificationProvider — Provides a spec-driven notification system.
 *
 * Each spec display type is presented by its own surface. `toast` is delegated
 * to the host (`onToast`); the other four are rendered by surface components
 * that subscribe to this context — mount them where they belong:
 * `NotificationSnackbar` / `NotificationAlerts` anywhere inside the provider,
 * `NotificationBanners` at the top of the content area, and
 * `NotificationInline` in the surface that raises the notification.
 *
 * @example
 * ```tsx
 * <NotificationProvider
 *   config={{ position: 'top_right', defaultDuration: 5000, maxVisible: 5 }}
 *   onToast={(n) => toast[n.severity](n.title, { description: n.message })}
 * >
 *   <NotificationBanners />
 *   <App />
 *   <NotificationSnackbar />
 *   <NotificationAlerts />
 * </NotificationProvider>
 * ```
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  config: userConfig = {},
  onToast,
}) => {
  const config = useMemo<NotificationSystemConfig>(
    () => ({
      position: 'top-right',
      defaultDuration: 5000,
      maxVisible: 5,
      stacking: true,
      ...userConfig,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(userConfig)],
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Surfaces currently mounted, by presentation surface. A ref (not state) so
  // `notify` can read the live set without re-creating itself on every mount.
  const mountedSurfaces = useRef<Map<NotificationSurface, number>>(new Map());

  const registerSurface = useCallback((surface: NotificationSurface) => {
    const counts = mountedSurfaces.current;
    counts.set(surface, (counts.get(surface) ?? 0) + 1);
    return () => {
      const next = (counts.get(surface) ?? 1) - 1;
      if (next > 0) counts.set(surface, next);
      else counts.delete(surface);
    };
  }, []);

  const notify = useCallback(
    (input: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): string => {
      const id = `notification-${++notificationCounter}`;
      // Materialize the declared presentation (spec default: toast; the legacy
      // `modal` dialect presents as its nearest spec family, alert) so every
      // stored item carries the presentation that will render it (#2942).
      const presentation = resolveNotificationPresentation(input.displayType);
      const { surface, transient } = NOTIFICATION_PRESENTATIONS[presentation];
      const notification: NotificationItem = {
        ...input,
        displayType: presentation,
        id,
        createdAt: new Date(),
        read: false,
      };

      setNotifications((prev) => [notification, ...prev]);

      // Route to the presentation's surface. `onToast` is the `toast` surface —
      // it used to receive EVERY type, so a banner/alert/inline notification
      // presented as a toast (#3014). The other four are rendered by the
      // surface components subscribing through the context below.
      if (surface === 'delegate') onToast?.(notification);

      // A surface-rendered presentation with no surface mounted is invisible —
      // the "silently absent" shape this whole issue is about. Say so loudly in
      // dev. `toast` is exempt: a provider with no `onToast` is the supported
      // store-only mode (a notification centre with no overlay).
      if (__DEV__ && surface !== 'delegate' && (mountedSurfaces.current.get(surface) ?? 0) === 0) {
        console.warn(
          `[NotificationProvider] "${notification.title}" declares displayType ` +
            `'${presentation}' but no ${presentation} surface is mounted, so it will ` +
            `not be shown. To present it, ${SURFACE_HINTS[surface]}.`,
        );
      }

      // Auto-dismiss transient presentations. A banner/alert/inline stays until
      // it is dismissed unless the raiser asked for a duration explicitly —
      // sharing the toast timer made "persistent" presentations evaporate.
      const duration = input.duration ?? (transient ? config.defaultDuration ?? 5000 : 0);
      if (duration > 0) {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, duration);
      }

      return id;
    },
    [config.defaultDuration, onToast],
  );

  const info = useCallback(
    (title: string, message?: string) =>
      notify({ title, message, severity: 'info' }),
    [notify],
  );

  const success = useCallback(
    (title: string, message?: string) =>
      notify({ title, message, severity: 'success' }),
    [notify],
  );

  const warning = useCallback(
    (title: string, message?: string) =>
      notify({ title, message, severity: 'warning' }),
    [notify],
  );

  const error = useCallback(
    (title: string, message?: string) =>
      notify({ title, message, severity: 'error' }),
    [notify],
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      notify,
      info,
      success,
      warning,
      error,
      markAsRead,
      markAllAsRead,
      dismiss,
      clearAll,
      config,
      registerSurface,
    }),
    [
      notifications,
      unreadCount,
      notify,
      info,
      success,
      warning,
      error,
      markAsRead,
      markAllAsRead,
      dismiss,
      clearAll,
      config,
      registerSurface,
    ],
  );

  return (
    <NotificationCtx.Provider value={value}>
      {children}
    </NotificationCtx.Provider>
  );
};

NotificationProvider.displayName = 'NotificationProvider';

/**
 * Hook to consume the NotificationProvider context.
 *
 * @throws Error if used outside a NotificationProvider
 */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationCtx);
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within a <NotificationProvider>. ' +
        'Wrap your app with <NotificationProvider> to use the notification system.',
    );
  }
  return ctx;
}

/**
 * Hook to check if a NotificationProvider is available.
 */
export function useHasNotificationProvider(): boolean {
  return useContext(NotificationCtx) !== null;
}

/**
 * Subscribe to the live notifications for ONE presentation — the contract a
 * surface component implements (`@object-ui/components` ships one per spec
 * type). Registering also tells the provider the surface exists, so raising a
 * `banner` with no banner surface mounted warns in dev instead of vanishing.
 *
 * Items come back newest-first, matching `notifications`. A surface that wants
 * FIFO order (an `alert` queue) reverses them itself.
 *
 * @param presentation the spec display type this surface renders
 * @param scope optional `inline` routing key — when set, only items raised with
 *   the same `scope` are returned; when omitted, only unscoped items are.
 */
export function useNotificationsByPresentation(
  presentation: NotificationPresentation,
  scope?: string,
): NotificationItem[] {
  const { notifications, registerSurface } = useNotifications();
  const { surface } = NOTIFICATION_PRESENTATIONS[presentation];

  useEffect(() => registerSurface(surface), [registerSurface, surface]);

  return useMemo(
    () =>
      notifications.filter(
        (n) =>
          resolveNotificationPresentation(n.displayType) === presentation &&
          (presentation !== 'inline' || (n.scope ?? undefined) === scope),
      ),
    [notifications, presentation, scope],
  );
}
