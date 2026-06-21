/**
 * LocalizationFetchProvider — loads the tenant's resolved regional defaults
 * (currency / locale) from `GET /api/v1/auth/me/localization` (ADR-0053) and
 * feeds the pure `LocalizationProvider` so every field / measure renderer can
 * resolve a currency code down to the org default.
 *
 * Cosmetic, NOT fail-closed: while loading or on error it renders children with
 * an empty value (no tenant default → renderers show a plain number), so a slow
 * or missing endpoint never blocks the app.
 */
import { useEffect, useState } from 'react';
import { LocalizationProvider, type LocalizationValue } from '@object-ui/i18n';

interface MeLocalizationResponse {
  authenticated?: boolean;
  currency?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

export function LocalizationFetchProvider({
  endpoint,
  children,
}: {
  endpoint: string;
  children: React.ReactNode;
}) {
  const [value, setValue] = useState<LocalizationValue>({});

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<MeLocalizationResponse>) : null))
      .then((json) => {
        if (cancelled || !json) return;
        setValue({ currency: json.currency ?? undefined, locale: json.locale ?? undefined });
      })
      .catch(() => {
        /* cosmetic — leave the empty value, renderers show plain numbers */
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return <LocalizationProvider value={value}>{children}</LocalizationProvider>;
}
