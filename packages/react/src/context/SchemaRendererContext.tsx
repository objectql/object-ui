import React, { createContext, useContext, useMemo } from 'react';

interface SchemaRendererContextType {
  dataSource: any;
  debug?: boolean;
}

const SchemaRendererContext = createContext<SchemaRendererContextType | null>(null);

export const SchemaRendererProvider = ({ 
  children, 
  dataSource, 
  debug 
}: { 
  children: React.ReactNode; 
  dataSource: any; 
  debug?: boolean 
}) => {
  const value = useMemo(() => ({ dataSource, debug }), [dataSource, debug]);
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
  const { dataSource } = useSchemaContext();
  if (!path) return dataSource;
  // Simple path resolution for now. In real app might be more complex
  return path.split('.').reduce((acc, part) => acc && acc[part], dataSource);
}
