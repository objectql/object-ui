/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * notificationPreferences — the two switches that govern inbox announcements
 * (objectui#7011).
 *
 * Deliberately localStorage-only for this iteration. A server-side preference
 * object is real work with its own surface (a settings namespace, a manifest, a
 * migration) and the card scopes it out explicitly; what it buys — the same
 * answer on a second device — is also the thing these two settings care least
 * about, because both describe THIS browser: whether toasts may cover this
 * screen, and whether this browser's notification permission should be used.
 *
 * Storage is scoped per user id (`scopedKey`) for the same reason every other
 * local preference in this package is: two accounts on one browser must not
 * inherit each other's choices.
 *
 * ## Defaults, and why they differ
 *
 * - **Toast: on.** It is in-page, it costs nothing to refuse, and a silent
 *   inbox is the defect the card was raised for. A feature that ships off by
 *   default fixes nothing for the users who never find the switch.
 * - **Desktop: off.** Turning it on PROMPTS for browser permission, and a
 *   prompt nobody asked for is answered "block" often enough that shipping it
 *   on by default would spend the channel on the user's behalf, permanently.
 *   Off is also exactly today's behaviour, so a user who touches nothing is not
 *   surprised by their operating system.
 *
 * @module
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@object-ui/auth';
import { scopedKey, useStorageSync } from '../context/UserStateAdapters.js';
import {
  desktopNotificationPermission,
  isDesktopNotificationSupported,
  requestDesktopNotificationPermission,
  type DesktopNotificationPermission,
} from './desktopNotifications.js';

/** localStorage key base; `scopedKey` appends `:u:<userId>` when signed in. */
export const NOTIFICATION_PREFERENCES_KEY = 'objectui.notificationPreferences';

export interface NotificationPreferences {
  /** In-page toast when a message arrives and the tab is visible. */
  toast: boolean;
  /** System notification when a message arrives and the tab is hidden. */
  desktop: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = Object.freeze({
  toast: true,
  desktop: false,
});

/**
 * Parse a stored value into preferences.
 *
 * Every member is defaulted individually rather than the object being accepted
 * or rejected whole: a stored blob written before a member existed is a normal
 * state, and dropping the user's other choice because of it would be a
 * regression they never asked for.
 */
export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  const value = raw as Partial<NotificationPreferences> | null | undefined;
  return {
    toast: typeof value?.toast === 'boolean' ? value.toast : DEFAULT_NOTIFICATION_PREFERENCES.toast,
    desktop: typeof value?.desktop === 'boolean' ? value.desktop : DEFAULT_NOTIFICATION_PREFERENCES.desktop,
  };
}

/** Read the stored preferences for a user, defaulting on anything unusable. */
export function readNotificationPreferences(userId?: string | null): NotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(scopedKey(NOTIFICATION_PREFERENCES_KEY, userId));
    return parseNotificationPreferences(raw ? JSON.parse(raw) : null);
  } catch {
    // A disabled/full/parse-hostile store costs the preference, never the page.
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/** Persist preferences for a user. Best-effort — storage may be unavailable. */
export function writeNotificationPreferences(
  userId: string | null | undefined,
  preferences: NotificationPreferences,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      scopedKey(NOTIFICATION_PREFERENCES_KEY, userId),
      JSON.stringify(preferences),
    );
  } catch {
    /* best-effort */
  }
}

/**
 * ONE live value per storage key, shared by every hook instance in this tab.
 *
 * ## Why a store and not `useState` in the hook (measured in a real browser)
 *
 * Two surfaces call {@link useNotificationPreferences}: the settings menu that
 * WRITES, and the arrival notifier that READS. With per-hook `useState` those
 * are two independent copies of the same fact — the menu flipped its own copy
 * and wrote localStorage, and the presenter kept the value it had read at
 * mount. `useStorageSync` did not cover it either: the `storage` event fires
 * only in OTHER tabs, by design, so it is exactly the same-tab case that was
 * missed. Symptom: switching desktop notifications on had no effect at all
 * until the page was reloaded — the switch said `granted`, the presenter still
 * believed `desktop: false`, and the tab stayed silent. Found by the browser
 * fixture (`apps/console/src/inbox-arrival-preview.tsx`), not by the unit pins,
 * because a unit pin mounts one hook instance.
 *
 * The snapshot is cached per key so `useSyncExternalStore` gets a STABLE
 * reference — handing back a fresh object per call re-renders forever (the same
 * rule `sharedUserFeeds` records for its own store).
 */
const listeners = new Set<() => void>();
let cache: { key: string; value: NotificationPreferences } | null = null;

function snapshot(key: string, userId: string | null | undefined): NotificationPreferences {
  if (!cache || cache.key !== key) cache = { key, value: readNotificationPreferences(userId) };
  return cache.value;
}

function publish(key: string, value: NotificationPreferences): void {
  cache = { key, value };
  for (const listener of [...listeners]) listener();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => { listeners.delete(onStoreChange); };
}

/** Test seam — drop the cached value so cases do not inherit each other's. */
export function __resetNotificationPreferences(): void {
  cache = null;
  for (const listener of [...listeners]) listener();
}

export interface NotificationPreferencesController {
  preferences: NotificationPreferences;
  /** The browser's current verdict, READ (never requested) on every render. */
  desktopPermission: DesktopNotificationPermission;
  /** Whether this browser has a Notification API at all. */
  desktopSupported: boolean;
  setToastEnabled: (enabled: boolean) => void;
  /**
   * Turn desktop notifications on. ⭐ This is the ONLY path in the console that
   * reaches `Notification.requestPermission()`, and it is reachable only from
   * the toggle's change handler — see `desktopNotifications.ts` for why that
   * matters permanently.
   *
   * The preference is written from the VERDICT, not from the intent: a user who
   * flips the switch and then blocks the prompt gets the switch back off, which
   * is the truth (nothing will be delivered) rather than a switch that claims a
   * channel it does not have.
   */
  enableDesktop: () => Promise<DesktopNotificationPermission>;
  disableDesktop: () => void;
}

/**
 * The two switches, live: current values, the browser's permission verdict, and
 * the only sanctioned way to change either.
 */
export function useNotificationPreferences(): NotificationPreferencesController {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = scopedKey(NOTIFICATION_PREFERENCES_KEY, userId);

  // A different key (a different signed-in user) re-reads: the previous
  // account's choices live under a different key and are not this one's.
  const preferences = useSyncExternalStore(
    subscribe,
    () => snapshot(key, userId),
    () => snapshot(key, userId),
  );

  // Another tab flipping a switch flips it here too — one browser, one answer.
  useStorageSync<Partial<NotificationPreferences>>(key, (value) => {
    publish(key, parseNotificationPreferences(value));
  });

  /**
   * Read the verdict on every render rather than caching it: the user can
   * change it in browser chrome at any moment, and a stale `denied` would leave
   * the toggle greyed out after they fixed it. Reading is free and never
   * prompts.
   */
  const desktopPermission = desktopNotificationPermission();
  const desktopSupported = isDesktopNotificationSupported();

  const persist = useCallback(
    (next: NotificationPreferences) => {
      writeNotificationPreferences(userId, next);
      publish(scopedKey(NOTIFICATION_PREFERENCES_KEY, userId), next);
    },
    [userId],
  );

  const setToastEnabled = useCallback(
    (enabled: boolean) => {
      persist({ ...readNotificationPreferences(userId), toast: enabled });
    },
    [persist, userId],
  );

  const enableDesktop = useCallback(async (): Promise<DesktopNotificationPermission> => {
    const verdict = await requestDesktopNotificationPermission();
    persist({ ...readNotificationPreferences(userId), desktop: verdict === 'granted' });
    return verdict;
  }, [persist, userId]);

  const disableDesktop = useCallback(() => {
    persist({ ...readNotificationPreferences(userId), desktop: false });
  }, [persist, userId]);

  return useMemo(
    () => ({
      preferences,
      desktopPermission,
      desktopSupported,
      setToastEnabled,
      enableDesktop,
      disableDesktop,
    }),
    [preferences, desktopPermission, desktopSupported, setToastEnabled, enableDesktop, disableDesktop],
  );
}
