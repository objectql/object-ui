/**
 * useBranding Hook
 *
 * Thin wrapper around @object-ui/layout's useAppShellBranding.
 * Accepts the app definition and delegates CSS custom property injection.
 *
 * @deprecated Prefer passing `branding` directly to `<AppShell>` from `@object-ui/layout`.
 */

import { useAppShellBranding } from '@object-ui/layout';
import { getProductName } from '@object-ui/app-shell';

interface AppBranding {
  primaryColor?: string;
  accentColor?: string;
  favicon?: string;
}

export function useBranding(app: { branding?: AppBranding; label?: string } | undefined) {
  useAppShellBranding(
    app?.branding
      ? {
          primaryColor: app.branding.primaryColor,
          accentColor: app.branding.accentColor,
          favicon: app.branding.favicon,
        }
      : undefined,
    app?.label ? `${app.label} — ${getProductName()}` : undefined,
  );
}
