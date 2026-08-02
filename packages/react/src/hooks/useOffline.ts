/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type {
  OfflineStrategy,
  ConflictResolution,
  PersistStorage,
  EvictionPolicy,
  OfflineCacheConfigSchema,
  OfflineConfigSchema,
  SyncConfigSchema,
} from '@objectstack/spec/ui';
import type { SpecAuthoredInput } from '../spec-input';

// ---------------------------------------------------------------------------
// The offline vocabulary is the spec's (`OfflineConfigSchema` and friends in
// `@objectstack/spec/ui`), so these are its bindings rather than the hand
// copies that used to sit here under the same names (objectstack#4115). The
// header comment claimed alignment with "spec v2.0.7"; the installed spec is
// 17.0.0-rc.1, and a claim that stale is exactly what an import replaces.
// ---------------------------------------------------------------------------

/** Offline strategy determines how data is fetched when connectivity is limited. */
export type { OfflineStrategy };

/**
 * Conflict resolution strategy for sync operations.
 *
 * Renamed from `ConflictResolutionStrategy` — that name belongs to a DIFFERENT
 * spec export (`@objectstack/spec/api`: `error | priority | first-wins |
 * last-wins`, the metadata-merge policy). The spec's name for the union this
 * hook actually uses is `ConflictResolution`, so the fix was to take the spec's
 * own name and its binding at once, the same move `FieldGroup` →
 * `ObjectFieldGroup` made in objectui#3169.
 */
export type { ConflictResolution };

/** Persist storage backend. */
export type PersistStorageType = PersistStorage;

/** Eviction policy for cache management. */
export type EvictionPolicyType = EvictionPolicy;

/** Sync state of the offline system. */
export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

/** A queued mutation waiting to be synced. */
export interface QueuedMutation {
  id: string;
  timestamp: number;
  operation: 'create' | 'update' | 'delete';
  resource: string;
  data?: Record<string, unknown>;
}

/**
 * Cache configuration — the AUTHORING side of the spec's
 * `OfflineCacheConfigSchema`.
 *
 * `persistStorage` and `evictionPolicy` carry `.default()`s, so they are
 * optional to write and present after a parse. This hook is handed what an app
 * author wrote, hence the input side; see {@link SpecAuthoredInput}.
 */
export type OfflineCacheConfig = SpecAuthoredInput<typeof OfflineCacheConfigSchema>;

/**
 * Sync configuration — the AUTHORING side of the spec's `SyncConfigSchema`.
 *
 * `strategy` and `conflictResolution` carry `.default()`s, so the output type
 * makes them required; this hook is handed what an app author wrote.
 */
export type OfflineSyncConfig = SpecAuthoredInput<typeof SyncConfigSchema>;

/**
 * Top-level offline configuration — the AUTHORING side of the spec's
 * `OfflineConfigSchema`.
 *
 * This name stays with `@object-ui/react` (objectui#3156 / objectui#3159): the
 * `OfflineConfig` that used to sit in `@object-ui/types` was a service-worker
 * ROUTE cache and has been renamed `PWAOfflineConfig`, so there is no
 * cross-package clash left — this hook's config is the spec's concept, key for
 * key, and takes the spec's binding.
 *
 * Input side, not `z.infer`, and here the reason is visible in the signature:
 * `useOffline(config: OfflineConfig = {})` defaults to the empty object, which
 * the output type — where `enabled`, `strategy` and `offlineIndicator` are all
 * required once their `.default()`s have run — would reject outright.
 */
export type OfflineConfig = SpecAuthoredInput<typeof OfflineConfigSchema>;

/** Result returned by the useOffline hook. */
export interface OfflineResult {
  /** Whether the browser is currently online. */
  isOnline: boolean;
  /** Whether offline mode is enabled in config. */
  enabled: boolean;
  /** Current sync state. */
  syncState: SyncState;
  /** The active offline strategy. */
  strategy: OfflineStrategy;
  /** Number of pending mutations in the queue. */
  pendingCount: number;
  /** Queue a mutation for later sync. */
  queueMutation: (mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) => void;
  /** Manually trigger a sync attempt. */
  sync: () => Promise<void>;
  /** Clear the mutation queue. */
  clearQueue: () => void;
  /** Whether to show the offline indicator UI. */
  showIndicator: boolean;
  /** The offline message to display. */
  offlineMessage: string;
}

// ---------------------------------------------------------------------------
// Online/offline external store (SSR-safe)
// ---------------------------------------------------------------------------

function subscribeOnline(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getOnlineSnapshot(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

function getServerSnapshot(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Mutation queue storage helpers
// ---------------------------------------------------------------------------

const QUEUE_STORAGE_KEY = 'objectui-offline-queue';

function loadQueue(): QueuedMutation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: QueuedMutation[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

let idCounter = 0;
function generateId(): string {
  idCounter += 1;
  return `mut_${Date.now()}_${idCounter}`;
}

// ---------------------------------------------------------------------------
// useOffline hook
// ---------------------------------------------------------------------------

const DEFAULTS: Required<
  Pick<OfflineConfig, 'enabled' | 'strategy' | 'offlineIndicator' | 'queueMaxSize'>
> & { offlineMessage: string } = {
  enabled: true,
  strategy: 'network_first',
  offlineIndicator: true,
  offlineMessage: 'You are currently offline. Changes will be synced when reconnected.',
  queueMaxSize: 100,
};

/**
 * Hook for offline mode detection and sync queue management. Its config types
 * ARE the spec's `OfflineConfigSchema` / `SyncConfigSchema` / `ConflictResolution`
 * (authoring side) — see {@link OfflineConfig}.
 *
 * @example
 * ```tsx
 * function App() {
 *   const offline = useOffline({
 *     enabled: true,
 *     strategy: 'cache_first',
 *     sync: { conflictResolution: 'last_write_wins' },
 *   });
 *
 *   if (!offline.isOnline && offline.showIndicator) {
 *     return <Banner>{offline.offlineMessage}</Banner>;
 *   }
 *
 *   return <div>Pending mutations: {offline.pendingCount}</div>;
 * }
 * ```
 */
export function useOffline(config: OfflineConfig = {}): OfflineResult {
  const {
    enabled = DEFAULTS.enabled,
    strategy = DEFAULTS.strategy,
    offlineIndicator = DEFAULTS.offlineIndicator,
    offlineMessage = DEFAULTS.offlineMessage,
    queueMaxSize = DEFAULTS.queueMaxSize,
    sync: syncConfig,
  } = config;

  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerSnapshot);
  const [queue, setQueue] = useState<QueuedMutation[]>(loadQueue);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const syncConfigRef = useRef(syncConfig);
  syncConfigRef.current = syncConfig;

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    persistQueue(queue);
  }, [queue]);

  // Update sync state based on online status
  useEffect(() => {
    if (!enabled) return;
    if (!isOnline) {
      setSyncState('offline');
    } else if (syncState === 'offline') {
      setSyncState('idle');
    }
  }, [isOnline, enabled, syncState]);

  const queueMutation = useCallback(
    (mutation: Omit<QueuedMutation, 'id' | 'timestamp'>) => {
      if (!enabled) return;
      setQueue((prev) => {
        const newEntry: QueuedMutation = {
          ...mutation,
          id: generateId(),
          timestamp: Date.now(),
        };
        const next = [...prev, newEntry];
        // Enforce max queue size (FIFO eviction)
        if (next.length > queueMaxSize) {
          return next.slice(next.length - queueMaxSize);
        }
        return next;
      });
    },
    [enabled, queueMaxSize],
  );

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const sync = useCallback(async () => {
    if (!enabled || queue.length === 0) return;
    setSyncState('syncing');
    try {
      // In a real implementation, this would batch-send mutations to the server.
      // For now, we simulate a successful sync by clearing the queue.
      const batchSize = syncConfigRef.current?.batchSize ?? queue.length;
      const batch = queue.slice(0, batchSize);

      // Simulate network round-trip
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      // Remove synced mutations from queue
      setQueue((prev) => prev.filter((m) => !batch.some((b) => b.id === m.id)));
      setSyncState('idle');
    } catch {
      setSyncState('error');
    }
  }, [enabled, queue]);

  // Auto-sync when coming back online (short stabilization delay)
  useEffect(() => {
    if (!enabled || !isOnline || queue.length === 0) return;
    const timer = setTimeout(() => {
      void sync();
    }, 100);
    return () => clearTimeout(timer);
    // Only trigger on isOnline changes, not on every queue change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, enabled]);

  return useMemo<OfflineResult>(
    () => ({
      isOnline,
      enabled,
      syncState,
      strategy,
      pendingCount: queue.length,
      queueMutation,
      sync,
      clearQueue,
      showIndicator: offlineIndicator && !isOnline,
      offlineMessage,
    }),
    [
      isOnline,
      enabled,
      syncState,
      strategy,
      queue.length,
      queueMutation,
      sync,
      clearQueue,
      offlineIndicator,
      offlineMessage,
    ],
  );
}
