import { SchemaRendererProvider } from '@object-ui/react';
import type { DashboardRendererProps } from '../types';

/**
 * DashboardRenderer - Renders dashboard layouts from schema
 *
 * Framework-agnostic component that renders a dashboard based on JSON schema.
 * Delegates to registered dashboard plugins.
 */
export function DashboardRenderer({
  schema,
  dataSource,
  dashboardName,
}: DashboardRendererProps) {
  if (!schema) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">No dashboard schema provided</div>
      </div>
    );
  }

  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <div className="dashboard-renderer h-full p-4">
        <h1 className="mb-4 text-2xl font-bold">
          {schema.title || dashboardName || 'Dashboard'}
        </h1>
        {/* TODO: Integrate with actual SchemaRenderer for dashboard */}
        <div className="text-muted-foreground">
          Dashboard rendering: {schema.title || dashboardName}
        </div>
      </div>
    </SchemaRendererProvider>
  );
}
