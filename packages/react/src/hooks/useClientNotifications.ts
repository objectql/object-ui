/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/react - useClientNotifications
 *
 * Bridge hook between the @objectstack/client notifications API
 * and the local NotificationContext state. Fetches server-side
 * notifications and surfaces them through the existing provider.
 */

import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SchemaRendererContext } from '../context/SchemaRendererContext';
import { useNotifications } from '../context/NotificationContext';
import type { NotificationSeverityLevel } from '../context/NotificationContext';

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

export interface UseClientNotificationsOptions {
  /** ObjectStack client instance (optional, from context if available) */
  client?: any;
  /** Whether to auto-fetch notifications on mount */
  autoFetch?: boolean;
  /** Polling interval in ms (0 to disable) */
  pollInterval?: number;
}

export interface UseClientNotificationsResult {
  /** Fetch notifications from server */
  fetchNotifications: () => Promise<void>;
  /** Register device for push notifications */
  registerDevice: (token: string, platform: string) => Promise<void>;
  /** Get notification preferences */
  getPreferences: () => Promise<any>;
  /** Update notification preferences */
  updatePreferences: (prefs: any) => Promise<void>;
  /** Mark a notification as read on the server */
  markAsRead: (id: string) => Promise<void>;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Normalise severity coming from the server into a valid local level. */
function toSeverity(value: unknown): NotificationSeverityLevel {
  const valid: NotificationSeverityLevel[] = ['info', 'success', 'warning', 'error'];
  if (typeof value === 'string' && valid.includes(value as NotificationSeverityLevel)) {
    return value as NotificationSeverityLevel;
  }
  return 'info';
}

/**
 * Resolve the ObjectStack client from explicit option or SchemaRendererContext.
 *
 * The dataSource stored in context is typically an ObjectStackAdapter which
 * exposes `getClient()`.  When the caller passes a client directly we use
 * that instead.
 */
function useResolvedClient(explicit?: any): any {
  const rendererCtx = useContext(SchemaRendererContext);
  if (explicit) return explicit;

  const dataSource = rendererCtx?.dataSource;
  if (dataSource && typeof dataSource.getClient === 'function') {
    return dataSource.getClient();
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

/**
 * Bridge between the `@objectstack/client` notifications API and the
 * local {@link NotificationContext}.
 *
 * The hook resolves the ObjectStack client either from the explicit
 * `client` option or from the `SchemaRendererContext` dataSource, then
 * delegates to `client.notifications.*` methods.  Fetched notifications
 * are fed into the local provider via `useNotifications().notify()`.
 *
 * @example
 * ```tsx
 * function NotificationBell() {
 *   const { fetchNotifications, loading } = useClientNotifications({
 *     autoFetch: true,
 *     pollInterval: 30_000,
 *   });
 *
 *   return <Button onClick={fetchNotifications} disabled={loading}>🔔</Button>;
 * }
 * ```
 */
export function useClientNotifications(
  options: UseClientNotificationsOptions = {},
): UseClientNotificationsResult {
  const { client: explicitClient, autoFetch = false, pollInterval = 0 } = options;

  const client = useResolvedClient(explicitClient);
  const { notify, markAsRead: localMarkAsRead } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track IDs that have already been pushed into the local context so we
  // don't add duplicates on subsequent fetches / polls.
  const seenIdsRef = useRef<Set<string>>(new Set());

  /* ---- fetchNotifications ---- */

  const fetchNotifications = useCallback(async () => {
    if (!client?.notifications) return;

    setLoading(true);
    setError(null);

    try {
      const result = await client.notifications.list({});
      const items: any[] = Array.isArray(result) ? result : result?.data ?? result?.items ?? [];

      for (const item of items) {
        const id = String(item.id ?? '');
        if (!id || seenIdsRef.current.has(id)) continue;

        seenIdsRef.current.add(id);
        notify({
          title: item.title ?? 'Notification',
          message: item.message ?? item.body,
          severity: toSeverity(item.severity ?? item.level),
          duration: 0, // server-driven notifications are persistent
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
    } finally {
      setLoading(false);
    }
  }, [client, notify]);

  /* ---- registerDevice ---- */

  const registerDevice = useCallback(
    async (token: string, platform: string) => {
      if (!client?.notifications) return;
      setError(null);
      try {
        await client.notifications.registerDevice(token, platform);
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error('Failed to register device');
        setError(wrapped);
        throw wrapped;
      }
    },
    [client],
  );

  /* ---- getPreferences ---- */

  const getPreferences = useCallback(async () => {
    if (!client?.notifications) return null;
    setError(null);
    try {
      return await client.notifications.getPreferences();
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error('Failed to get preferences');
      setError(wrapped);
      throw wrapped;
    }
  }, [client]);

  /* ---- updatePreferences ---- */

  const updatePreferences = useCallback(
    async (prefs: any) => {
      if (!client?.notifications) return;
      setError(null);
      try {
        await client.notifications.updatePreferences(prefs);
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error('Failed to update preferences');
        setError(wrapped);
        throw wrapped;
      }
    },
    [client],
  );

  /* ---- markAsRead (server + local) ---- */

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistically mark locally first
      localMarkAsRead(id);

      if (!client?.notifications) return;
      setError(null);
      try {
        await client.notifications.markAsRead(id);
      } catch (err) {
        const wrapped = err instanceof Error ? err : new Error('Failed to mark as read');
        setError(wrapped);
        throw wrapped;
      }
    },
    [client, localMarkAsRead],
  );

  /* ---- auto-fetch on mount ---- */

  useEffect(() => {
    if (autoFetch && client?.notifications) {
      fetchNotifications();
    }
  }, [autoFetch, client, fetchNotifications]);

  /* ---- polling ---- */

  useEffect(() => {
    if (!pollInterval || pollInterval <= 0 || !client?.notifications) return;

    const id = setInterval(() => {
      fetchNotifications();
    }, pollInterval);

    return () => clearInterval(id);
  }, [pollInterval, client, fetchNotifications]);

  return {
    fetchNotifications,
    registerDevice,
    getPreferences,
    updatePreferences,
    markAsRead,
    loading,
    error,
  };
}
