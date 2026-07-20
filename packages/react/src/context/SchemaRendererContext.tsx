import React, { createContext, useContext, useMemo } from 'react';
import type { DebugFlags } from '@object-ui/core';

/**
 * Host-provided fetch used for `provider: 'api'` view data sources so custom
 * endpoints carry the same credentials (Authorization, tenant, locale headers)
 * as the native data channel. Optional — when absent, ApiDataSource falls back
 * to the bare global fetch (cookies only).
 */
export type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface SchemaRendererContextType {
  dataSource: any;
  debug?: boolean;
  debugFlags?: DebugFlags;
  apiFetch?: ApiFetch;
}

const SchemaRendererContext = createContext<SchemaRendererContextType | null>(null);

export { SchemaRendererContext };

export const SchemaRendererProvider = ({
  children,
  dataSource,
  debug,
  debugFlags,
  apiFetch,
}: {
  children: React.ReactNode;
  dataSource: any;
  debug?: boolean;
  debugFlags?: DebugFlags;
  apiFetch?: ApiFetch;
}) => {
  // Nested providers (react-page, studio preview surfaces) re-wrap with their
  // own dataSource but rarely know about the host's authenticated fetch —
  // inherit it from the parent context so provider:'api' auth survives nesting.
  const parent = useContext(SchemaRendererContext);
  const effectiveApiFetch = apiFetch ?? parent?.apiFetch;
  const value = useMemo(
    () => ({ dataSource, debug, debugFlags, apiFetch: effectiveApiFetch }),
    [dataSource, debug, debugFlags, effectiveApiFetch],
  );
  return (
    <SchemaRendererContext.Provider value={value}>
      {children}
    </SchemaRendererContext.Provider>
  );
};

export const useSchemaContext = () => {
  const context = useContext(SchemaRendererContext);
  if (!context) {
    throw new Error('useSchemaContext must be used within a SchemaRendererProvider');
  }
  return context;
};

export const useDataScope = (path?: string) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = context?.dataSource;
  if (!path) return undefined;
  if (!dataSource) return undefined;
  // Simple path resolution for now. In real app might be more complex
  return path.split('.').reduce((acc, part) => acc && acc[part], dataSource);
}
