/**
 * ObjectUI Console - Conditional Auth Wrapper
 * 
 * This component fetches discovery information from the server and conditionally
 * enables/disables authentication based on the server's auth service status.
 * Also detects preview mode from the server and configures the auth provider accordingly.
 */

import { useState, useEffect, ReactNode } from 'react';
import { ObjectStackAdapter } from '../dataSource';
import { AuthProvider } from '@object-ui/auth';
import type { PreviewModeOptions } from '@object-ui/auth';
import { LoadingScreen } from './LoadingScreen';
import type { DiscoveryInfo } from '@object-ui/react';

interface ConditionalAuthWrapperProps {
  children: ReactNode;
  authUrl: string;
}

/**
 * Wrapper component that conditionally enables authentication based on server discovery.
 * 
 * This component:
 * 1. Creates a temporary data source connection
 * 2. Fetches discovery information from the server
 * 3. Checks if auth.enabled is true in the discovery response
 * 4. Detects preview mode from discovery (mode === 'preview')
 * 5. Conditionally wraps children with AuthProvider with the appropriate config
 */
export function ConditionalAuthWrapper({ children, authUrl }: ConditionalAuthWrapperProps) {
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewModeOptions | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkAuthStatus() {
      try {
        // Create a temporary adapter to fetch discovery
        // Empty baseUrl allows the adapter to use browser-relative paths
        // This works because the console app is served from the same origin as the API
        const adapter = new ObjectStackAdapter({
          baseUrl: '',
          autoReconnect: false,
        });

        await adapter.connect();
        const discovery = await adapter.getDiscovery() as DiscoveryInfo | null;

        if (!cancelled) {
          // Detect preview mode from discovery
          if (discovery?.mode === 'preview') {
            setPreviewMode({
              autoLogin: discovery.previewMode?.autoLogin ?? true,
              simulatedRole: discovery.previewMode?.simulatedRole ?? 'admin',
              simulatedUserName: discovery.previewMode?.simulatedUserName ?? 'Preview User',
              readOnly: discovery.previewMode?.readOnly ?? false,
              expiresInSeconds: discovery.previewMode?.expiresInSeconds ?? 0,
              bannerMessage: discovery.previewMode?.bannerMessage,
            });
            // In preview mode, auth is effectively bypassed
            setAuthEnabled(false);
          } else {
            // Check if auth is enabled in discovery
            // Default to true if discovery doesn't provide this information
            const isAuthEnabled = discovery?.services?.auth?.enabled ?? true;
            setAuthEnabled(isAuthEnabled);
          }
        }
      } catch (error) {
        if (!cancelled) {
          // If discovery fails, default to auth enabled for security
          console.warn('[ConditionalAuthWrapper] Failed to fetch discovery, defaulting to auth enabled:', error);
          setAuthEnabled(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkAuthStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
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
