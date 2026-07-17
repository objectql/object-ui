/**
 * ObjectUI Console - Conditional Auth Wrapper
 *
 * This component fetches discovery information from the server and conditionally
 * enables/disables authentication based on the server's auth service status.
 * Also detects preview mode from the server and configures the auth provider accordingly.
 */

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { getSharedDiscovery, isServiceUsable } from '@object-ui/data-objectstack';
import { AuthProvider } from '@object-ui/auth';
import type { PreviewModeOptions } from '@object-ui/auth';
import { LoadingScreen } from './LoadingScreen';
import type { DiscoveryInfo } from '@object-ui/react';

interface ConditionalAuthWrapperProps {
  children: ReactNode;
  authUrl: string;
}

const DISCOVERY_TIMEOUT_MS = 10_000;

// Bootstrap-critical UI: must render before i18n is loaded (especially when the
// server is unreachable, which is also when i18n can't load translations).
// We deliberately do NOT use useObjectTranslation here — it suspends on first
// render and would prevent the discovery fetch from ever running.
const STRINGS = {
  timeout: 'Connection timed out after 10 seconds.',
  serverUnreachable: (url: string) => `The server at ${url} is unreachable.`,
};

/**
 * Wrapper component that conditionally enables authentication based on server discovery.
 *
 * On startup it:
 * 1. Calls `/api/v1/discovery` (with a 10s AbortController timeout)
 * 2. Detects preview mode + auth.enabled from the response
 * 3. On failure, shows the LoadingScreen in error mode with a Retry button
 *    (no silent fallback to "auth enabled" — the user is told the server is unreachable)
 */
export function ConditionalAuthWrapper({ children, authUrl }: ConditionalAuthWrapperProps) {
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewModeOptions | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const runDiscovery = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    setError(null);

    const baseUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) || '';
    const discoveryUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/api/v1/discovery`
      : '/api/v1/discovery';

    try {
      const discovery = (await getSharedDiscovery(baseUrl, async () => {
        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), DISCOVERY_TIMEOUT_MS);
        try {
          const res = await fetch(discoveryUrl, {
            credentials: 'include',
            signal: ctrl.signal,
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
          }
          const body = await res.json();
          if (body && typeof body.success === 'boolean' && 'data' in body) {
            return body.data;
          }
          return body;
        } catch (e) {
          if ((e as Error).name === 'AbortError') {
            throw new Error('timeout');
          }
          throw e;
        } finally {
          clearTimeout(timeoutId);
        }
      })) as DiscoveryInfo | null;

      // Defensive: an empty/undefined discovery means the server didn't actually
      // respond with usable data (e.g. a cached rejection that resolved as null,
      // or an upstream adapter swallowed the error). Treat it as a connectivity
      // failure so the user sees the error UI instead of being silently dropped
      // onto a "auth enabled" code path against a non-existent server.
      if (!discovery) {
        throw new Error('empty discovery response');
      }

      if (discovery?.mode === 'preview') {
        setPreviewMode({
          autoLogin: discovery.previewMode?.autoLogin ?? true,
          simulatedRole: discovery.previewMode?.simulatedRole ?? 'admin',
          simulatedUserName: discovery.previewMode?.simulatedUserName ?? 'Preview User',
          readOnly: discovery.previewMode?.readOnly ?? false,
          expiresInSeconds: discovery.previewMode?.expiresInSeconds ?? 0,
          bannerMessage: discovery.previewMode?.bannerMessage,
        });
        setAuthEnabled(false);
      } else {
        // ADR-0076 D12 (framework#2462): gate the login requirement on a
        // GENUINELY usable auth service — a stubbed/dev-fake auth entry
        // (status 'stub', handlerReady false) must not force a login flow
        // that cannot succeed. Missing discovery/auth entry stays fail-closed
        // (assume auth exists).
        const authSvc = discovery?.services?.auth;
        const isAuthEnabled = authSvc ? isServiceUsable(authSvc) : true;
        setAuthEnabled(isAuthEnabled);
      }
      setIsLoading(false);
    } catch (e) {
      const err = e as Error;
      let message: string;
      if (err.message === 'timeout') {
        message = STRINGS.timeout;
      } else if (err.message?.startsWith('HTTP ')) {
        message = `${STRINGS.serverUnreachable(discoveryUrl)} (${err.message})`;
      } else {
        message = `${STRINGS.serverUnreachable(discoveryUrl)}${err.message ? ` (${err.message})` : ''}`;
      }
      console.warn('[ConditionalAuthWrapper] Discovery failed:', err);
      setError(message);
      // Keep isLoading true so the splash stays mounted with the error UI.
      setIsLoading(true);
    } finally {
      setRetrying(false);
    }
  }, []);

  useEffect(() => {
    runDiscovery();
  }, [runDiscovery]);

  if (isLoading) {
    return (
      <LoadingScreen
        error={error}
        onRetry={error ? () => runDiscovery(true) : undefined}
        retrying={retrying}
      />
    );
  }

  // If in preview mode, wrap with a preview-configured AuthProvider
  if (previewMode) {
    return (
      <AuthProvider authUrl={authUrl} previewMode={previewMode}>
        {children}
      </AuthProvider>
    );
  }

  // If auth is enabled, wrap with AuthProvider
  if (authEnabled) {
    return (
      <AuthProvider authUrl={authUrl}>
        {children}
      </AuthProvider>
    );
  }

  // If auth is disabled, wrap with a disabled AuthProvider (guest mode)
  return (
    <AuthProvider authUrl={authUrl} enabled={false}>
      {children}
    </AuthProvider>
  );
}
