/**
 * Dashboard View Component
 * Renders a dashboard based on the dashboardName parameter
 */

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DashboardRenderer } from '@object-ui/plugin-dashboard';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { LayoutDashboard } from 'lucide-react';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { SkeletonDashboard } from './skeletons';
import { useMetadata } from '../context/MetadataProvider';
import { resolveI18nLabel } from '../utils';

export function DashboardView({ dataSource }: { dataSource?: any }) {
  const { dashboardName } = useParams<{ dashboardName: string }>();
  const { showDebug, toggleDebug } = useMetadataInspector();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Reset loading on navigation; the actual DashboardRenderer handles data fetching
    setIsLoading(true);
    // Use microtask to let React render the skeleton before the heavy dashboard
    queueMicrotask(() => setIsLoading(false));
  }, [dashboardName]);
  
  // Find dashboard definition from API-driven metadata
  const { dashboards } = useMetadata();
  const dashboard = dashboards?.find((d: any) => d.name === dashboardName);

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  if (!dashboard) {
    return (
      <div className="h-full flex items-center justify-center p-8">
         <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>Dashboard Not Found</EmptyTitle>
          <EmptyDescription>
            The dashboard &quot;{dashboardName}&quot; could not be found.
            It may have been removed or renamed.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 sm:gap-4 p-4 sm:p-6 border-b shrink-0">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">{resolveI18nLabel(dashboard.label) || dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{resolveI18nLabel(dashboard.description)}</p>
          )}
        </div>
        <div className="shrink-0">
          <MetadataToggle open={showDebug} onToggle={toggleDebug} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row relative">
         <div className="flex-1 overflow-auto p-4 sm:p-6">
            <DashboardRenderer schema={dashboard} dataSource={dataSource} />
         </div>

         <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Dashboard Configuration', data: dashboard }]}
         />
      </div>
    </div>
  );
}
