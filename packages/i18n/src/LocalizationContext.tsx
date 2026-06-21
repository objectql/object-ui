/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * LocalizationContext — the tenant's resolved REGIONAL defaults (currency,
 * locale) for the current request, surfaced to every renderer.
 *
 * This is the client half of ADR-0053: the framework resolves a workspace
 * `localization.currency` / `locale` onto each request's ExecutionContext and
 * exposes them at `GET /api/v1/auth/me/localization`. A fetching wrapper (in
 * app-shell) loads them once and feeds this PURE context, so low-level field /
 * measure renderers can resolve a currency code down to the org default —
 * instead of hard-coding `$`/`¥`/`USD` or degrading to a bare number — without
 * any of them depending on app-shell or making their own fetch.
 *
 * Undefined values mean "no tenant default known" → consumers render a plain
 * number (the existing safe behavior).
 */

import * as React from 'react';

export interface LocalizationValue {
  /** Tenant default currency (ISO 4217), or undefined when unconfigured. */
  currency?: string;
  /** Tenant/display locale (BCP-47) for Intl formatting, or undefined. */
  locale?: string;
}

const LocalizationCtx = React.createContext<LocalizationValue>({});

/** Pure provider — the fetching/loading concern lives in the app shell. */
export function LocalizationProvider({
  value,
  children,
}: {
  value: LocalizationValue;
  children: React.ReactNode;
}) {
  // Stable identity unless the resolved values actually change.
  const memo = React.useMemo<LocalizationValue>(
    () => ({ currency: value.currency, locale: value.locale }),
    [value.currency, value.locale],
  );
  return <LocalizationCtx.Provider value={memo}>{children}</LocalizationCtx.Provider>;
}

/**
 * Read the tenant regional defaults. Safe outside a provider — returns `{}`
 * (no tenant default), so a renderer mounted standalone degrades gracefully.
 */
export function useLocalization(): LocalizationValue {
  return React.useContext(LocalizationCtx);
}
