import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { ObjectForm } from '@object-ui/plugin-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Empty, EmptyTitle, Button } from '@object-ui/components';
import { SchemaRendererProvider } from '@object-ui/react';
import { ObjectStackDataSource } from './dataSource';
import appConfig from '../objectstack.shared';
import { Code2 } from 'lucide-react';

// Components
import { ConsoleLayout } from './components/ConsoleLayout';
import { LoadingScreen } from './components/LoadingScreen';
import { ObjectView } from './components/ObjectView';
import { DashboardView } from './components/DashboardView';
import { PageView } from './components/PageView';
import { ReportView } from './components/ReportView';

import { DetailView } from '@object-ui/plugin-detail';
import { useParams } from 'react-router-dom';

// ... existing imports ...

// Detail View Component
function RecordDetailView({ dataSource, objects, onEdit }: any) {
  const { objectName, recordId } = useParams();
  const [showDebug, setShowDebug] = useState(false);
  const objectDef = objects.find((o: any) => o.name === objectName);

  if (!objectDef) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Empty>
          <EmptyTitle>Object Not Found</EmptyTitle>
          <p>Object "{objectName}" definition missing.</p>
        </Empty>
      </div>
    );
  }

  const detailSchema = {
    type: 'detail-view',
    objectName: objectDef.name,
    resourceId: recordId,
    showBack: true,
    onBack: 'history',
    showEdit: true,
    title:  objectDef.label,
    sections: [
       {
          title: 'Details',
          fields: Object.keys(objectDef.fields || {}).map(key => ({
             name: key, 
             label: objectDef.fields[key].label || key,
             type: objectDef.fields[key].type || 'text'
          })),
          columns: 2
       }
    ]
  };

  return (
    <div className="h-full bg-background overflow-hidden flex flex-col relative">
       <div className="absolute top-4 right-4 z-50">
           <Button 
              variant="outline" 
              size="icon"
              onClick={() => setShowDebug(!showDebug)}
              title="Toggle Metadata Inspector"
              className="bg-background/80 backdrop-blur shadow-sm"
           >
             <Code2 className="h-4 w-4" />
           </Button>
       </div>

       <div className="flex-1 overflow-hidden flex flex-row">
           <div className="flex-1 overflow-auto p-4 lg:p-6">
               <DetailView 
                 schema={detailSchema}
                 dataSource={dataSource}
                 onEdit={() => onEdit({ _id: recordId, id: recordId })}
               />
           </div>
           {showDebug && (
                <div className="w-[400px] border-l bg-muted/30 p-0 overflow-hidden flex flex-col shrink-0 shadow-xl z-20 transition-all">
                    <div className="p-3 border-b bg-muted/50 font-semibold text-sm flex items-center justify-between">
                        <span>Metadata Inspector</span>
                        <span className="text-xs text-muted-foreground">JSON Protocol</span>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-6">
                        <div>
                            <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">View Schema</h4>
                            <div className="relative rounded-md border bg-slate-950 text-slate-50 overflow-hidden">
                                <pre className="text-xs p-3 overflow-auto max-h-[800px]">
                                    {JSON.stringify(detailSchema, null, 2)}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
           )}
       </div>
    </div>
  );
}

export function AppContent() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);
  const [dataSource, setDataSource] = useState<ObjectStackDataSource | null>(null);
  
  // App Selection
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const { appName } = useParams();
  const apps = appConfig.apps || [];
  
  // Determine active app based on URL
  const activeApps = apps.filter((a: any) => a.active !== false);
  const activeApp = apps.find((a: any) => a.name === appName) || activeApps.find((a: any) => a.isDefault === true) || activeApps[0];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    initializeClient();
  }, []);

  // Sync title
  useEffect(() => {
    const favicon = activeApp?.branding?.favicon;
    if (favicon) {
      const link = document.querySelector<HTMLLinkElement>('#favicon');
      if (link) {
        link.href = favicon;
      }
    }
    if (activeApp?.label) {
      document.title = `${activeApp.label} - ObjectStack Console`;
    }
  }, [activeApp]);

  async function initializeClient() {
    try {
      const stackClient = new ObjectStackClient({ baseUrl: '/' });
      await new Promise(resolve => setTimeout(resolve, 500));
      await stackClient.connect();
      
      // FIX: MSW Mock Server returns incorrect 'endpoints' in discovery.
      // The 'routes' property has the correct paths with /v1 prefix.
      // @ts-ignore - accessing private property for fix
      if (stackClient.discoveryInfo && stackClient.discoveryInfo.routes) {
        // @ts-ignore - accessing private property for fix
        stackClient.discoveryInfo.endpoints = stackClient.discoveryInfo.routes;
      }

      setClient(stackClient);
      setDataSource(new ObjectStackDataSource(stackClient));
    } catch (err) {
      console.error(err);
    }
  }

  const allObjects = appConfig.objects || [];
  
  // Find current object for Dialog
  // Path is now relative to /apps/:appName/
  // e.g. /apps/crm/contact -> contact is at index 3 (0=, 1=apps, 2=crm, 3=contact)
  const pathParts = location.pathname.split('/');
  // Filter out empty parts
  const cleanParts = pathParts.filter(p => p);
  // [apps, crm, contact]
  let objectNameFromPath = cleanParts[2];
  if (objectNameFromPath === 'view' || objectNameFromPath === 'record' || objectNameFromPath === 'page' || objectNameFromPath === 'dashboard') {
      objectNameFromPath = ''; // Not an object root
  }

  const currentObjectDef = allObjects.find((o: any) => o.name === objectNameFromPath);

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setIsDialogOpen(true);
  };
  
  const handleRowClick = (record: any) => {
     const id = record._id || record.id;
     if (id) {
        // Open Drawer
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('recordId', id);
            return next;
        });
     }
  };

  const handleAppChange = (newAppName: string) => {
      navigate(`/apps/${newAppName}`);
  };

  if (!client || !dataSource) return <LoadingScreen />;
  if (!activeApp) return (
    <div className="h-screen flex items-center justify-center">
      <Empty>
        <EmptyTitle>No Apps configured</EmptyTitle>
      </Empty>
    </div>
  );

  return (
    <ConsoleLayout
        activeAppName={activeApp.name}
        activeApp={activeApp}
        onAppChange={handleAppChange}
        objects={allObjects}
    >
      <SchemaRendererProvider dataSource={dataSource || {}}>
      <Routes>
        <Route path="/" element={
            // Redirect to first route within the app
             <Navigate to={findFirstRoute(activeApp.navigation)} replace />
        } />
        
        {/* List View */}
        <Route path=":objectName" element={
            <ObjectView 
                dataSource={dataSource} 
                objects={allObjects} 
                onEdit={handleEdit} 
                onRowClick={handleRowClick}
            />
        } />

          {/* List View with specific view */}
        <Route path=":objectName/view/:viewId" element={
             <ObjectView 
                dataSource={dataSource} 
                objects={allObjects} 
                onEdit={handleEdit} 
                onRowClick={handleRowClick}
            />
        } />
        
        {/* Detail Page */}
        <Route path=":objectName/record/:recordId" element={
            <RecordDetailView key={refreshKey} dataSource={dataSource} objects={allObjects} onEdit={handleEdit} />
        } />

        <Route path="dashboard/:dashboardName" element={
            <DashboardView />
        } />
        <Route path="report/:reportName" element={
            <ReportView />
        } />
        <Route path="page/:pageName" element={
            <PageView />
        } />
      </Routes>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
             <DialogHeader className="p-6 pb-4 border-b">
                <DialogTitle>{editingRecord ? 'Edit' : 'Create'} {currentObjectDef?.label}</DialogTitle>
                <DialogDescription>
                    {editingRecord ? `Update details for ${currentObjectDef?.label}` : `Add a new ${currentObjectDef?.label} to your database.`}
                </DialogDescription>
             </DialogHeader>
             <div className="flex-1 overflow-y-auto p-6">
                {currentObjectDef && (
                    <ObjectForm
                        key={editingRecord?.id || 'new'}
                        schema={{
                            type: 'object-form',
                            objectName: currentObjectDef.name,
                            mode: editingRecord ? 'edit' : 'create',
                            recordId: editingRecord?.id,
                            layout: 'vertical',
                            columns: 1,
                            fields: currentObjectDef.fields 
                                ? (Array.isArray(currentObjectDef.fields) 
                                    ? currentObjectDef.fields.map((f: any) => typeof f === 'string' ? f : f.name)
                                    : Object.keys(currentObjectDef.fields))
                                : [],
                            onSuccess: () => { setIsDialogOpen(false); setRefreshKey(k => k + 1); }, 
                            onCancel: () => setIsDialogOpen(false),
                            showSubmit: true,
                            showCancel: true,
                            submitText: 'Save Record',
                            cancelText: 'Cancel'
                        }}
                        dataSource={dataSource}
                    />
                )}
             </div>
          </DialogContent>
       </Dialog>
      </SchemaRendererProvider>
    </ConsoleLayout>
  );
}

// Helper to find first valid route in navigation tree
function findFirstRoute(items: any[]): string {
    if (!items || items.length === 0) return '';
    for (const item of items) {
        if (item.type === 'object') return `${item.objectName}`;
        if (item.type === 'page') return item.pageName ? `page/${item.pageName}` : '';
        if (item.type === 'dashboard') return item.dashboardName ? `dashboard/${item.dashboardName}` : '';
        if (item.type === 'url') continue; // Skip external URLs
        if (item.type === 'group' && item.children) {
            const childRoute = findFirstRoute(item.children); // Recurse
            if (childRoute !== '') return childRoute;
        }
    }
    return '';
}

// Redirect root to default app
function RootRedirect() {
    const apps = appConfig.apps || [];
    const activeApps = apps.filter((a: any) => a.active !== false);
    const defaultApp = activeApps.find((a: any) => a.isDefault === true) || activeApps[0];
    
    if (defaultApp) {
        return <Navigate to={`/apps/${defaultApp.name}`} replace />;
    }
    return <LoadingScreen />;
}

import { ThemeProvider } from './components/theme-provider';

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="object-ui-theme">
      <BrowserRouter basename="/">
          <Routes>
              <Route path="/apps/:appName/*" element={<AppContent />} />
              <Route path="/" element={<RootRedirect />} />
          </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
