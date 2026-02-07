/**
 * Dashboard View Component
 * Renders a dashboard based on the dashboardName parameter
 */

import { useParams } from 'react-router-dom';
import { DashboardRenderer } from '@object-ui/plugin-dashboard';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import appConfig from '../../objectstack.shared';

export function DashboardView({ dataSource }: { dataSource?: any }) {
  const { dashboardName } = useParams<{ dashboardName: string }>();
  const { showDebug, toggleDebug } = useMetadataInspector();
  
  // Find dashboard definition in config
  // In a real implementation, this would fetch from the server
  const dashboard = appConfig.dashboards?.find((d: any) => d.name === dashboardName);

  if (!dashboard) {
    return (
      <div className="h-full flex items-center justify-center p-8">
         <Empty>
          <EmptyTitle>Dashboard Not Found</EmptyTitle>
          <EmptyDescription>The dashboard "{dashboardName}" could not be found.</EmptyDescription>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex justify-between items-center p-6 border-b shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{dashboard.label || dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-muted-foreground mt-1">{dashboard.description}</p>
          )}
        </div>
        <MetadataToggle open={showDebug} onToggle={toggleDebug} />
      </div>

      <div className="flex-1 overflow-hidden flex flex-row relative">
         <div className="flex-1 overflow-auto p-6">
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
