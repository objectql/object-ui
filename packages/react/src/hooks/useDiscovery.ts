/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useEffect, useContext } from 'react';
import { SchemaRendererContext } from '../context/SchemaRendererContext';
import { isServiceUsable, type DiscoveryServiceInfo } from '@object-ui/data-objectstack';

/**
 * Discovery service information structure.
 * Represents server capabilities and service status.
 */
export interface DiscoveryInfo {
  /** Server name and version */
  name?: string;
  version?: string;
  
  /** Runtime mode (e.g., 'development', 'production', 'preview') */
  mode?: string;

  /** Preview mode configuration from the kernel (present when mode is 'preview') */
  previewMode?: {
    autoLogin?: boolean;
    simulatedRole?: 'admin' | 'user' | 'viewer';
    simulatedUserName?: string;
    readOnly?: boolean;
    expiresInSeconds?: number;
    bannerMessage?: string;
  };
  
  /**
   * Service availability status map. Entries mirror the framework's
   * ServiceInfoSchema — since ADR-0076 D12 (framework#2462) stubs/fallbacks
   * report `status: 'stub' | 'degraded'` and `handlerReady`; gate real
   * functionality with `isServiceUsable(...)`, never on `enabled` alone.
   */
  services?: {
    /** Authentication service status */
    auth?: DiscoveryServiceInfo;
    /** Data access service status */
    data?: DiscoveryServiceInfo;
    /** Metadata service status */
    metadata?: DiscoveryServiceInfo;
    /** AI service configuration */
    ai?: DiscoveryServiceInfo;
    [key: string]: any;
  };
  
  /** API capabilities */
  capabilities?: string[];
  
  /** Additional discovery metadata */
  [key: string]: any;
}

/**
 * Hook to access discovery information from the ObjectStack server.
 * 
 * This hook retrieves server capabilities and service status, which can be used
 * to conditionally enable/disable features based on server configuration.
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { discovery, isLoading } = useDiscovery();
 *   
 *   if (isLoading) {
 *     return <LoadingScreen />;
 *   }
 *   
 *   // Check if auth is enabled on the server
 *   const authEnabled = discovery?.services?.auth?.enabled ?? true;
 *   
 *   return (
 *     <div>
 *       {authEnabled ? <AuthProvider>...</AuthProvider> : <App />}
 *     </div>
 *   );
 * }
 * ```
 * 
 * @returns Discovery information and loading state
 */
export function useDiscovery() {
  const context = useContext(SchemaRendererContext);
  const dataSource = context?.dataSource;
  const [discovery, setDiscovery] = useState<DiscoveryInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDiscovery() {
      if (!dataSource) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Check if dataSource has getDiscovery method
        if (typeof (dataSource as any).getDiscovery === 'function') {
          const discoveryData = await (dataSource as any).getDiscovery();
          
          if (!cancelled) {
            setDiscovery(discoveryData);
            setError(null);
          }
        } else {
          // DataSource doesn't support discovery
          if (!cancelled) {
            setDiscovery(null);
            setError(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to fetch discovery'));
          setDiscovery(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchDiscovery();

    return () => {
      cancelled = true;
    };
  }, [dataSource]);

  return {
    discovery,
    isLoading,
    error,
    /**
     * Check if authentication is genuinely usable on the server
     * (ADR-0076 D12: a stubbed/dev-fake auth service does not count).
     * Defaults to true (fail closed: assume auth exists) when discovery
     * data or the auth entry is not available.
     */
    isAuthEnabled: discovery?.services?.auth
      ? isServiceUsable(discovery.services.auth)
      : true,
    /**
     * Check if the AI service is genuinely usable on the server.
     * Defaults to false if discovery data is not available.
     */
    isAiEnabled: isServiceUsable(discovery?.services?.ai),
  };
}

