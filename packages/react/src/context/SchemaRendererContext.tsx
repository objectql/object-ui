import React, { createContext, useContext, useMemo } from 'react';
import type { DebugFlags } from '@object-ui/core';

interface SchemaRendererContextType {
  dataSource: any;
  debug?: boolean;
  debugFlags?: DebugFlags;
}

const SchemaRendererContext = createContext<SchemaRendererContextType | null>(null);

export { SchemaRendererContext };

export const SchemaRendererProvider = ({ 
  children, 
  dataSource, 
  debug,
  debugFlags,
}: { 
  children: React.ReactNode; 
  dataSource: any; 
  debug?: boolean;
  debugFlags?: DebugFlags;
}) => {
  const value = useMemo(() => ({ dataSource, debug, debugFlags }), [dataSource, debug, debugFlags]);
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
