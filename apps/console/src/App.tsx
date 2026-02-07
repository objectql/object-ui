import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ObjectForm } from '@object-ui/plugin-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Empty, EmptyTitle } from '@object-ui/components';
import { SchemaRendererProvider } from '@object-ui/react';
import { ObjectStackAdapter } from './dataSource';
import type { ConnectionState } from './dataSource';
import appConfig from '../objectstack.shared';

// Components
import { ConsoleLayout } from './components/ConsoleLayout';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { ObjectView } from './components/ObjectView';
import { RecordDetailView } from './components/RecordDetailView';
import { DashboardView } from './components/DashboardView';
import { PageView } from './components/PageView';
import { ReportView } from './components/ReportView';
import { ExpressionProvider } from './context/ExpressionProvider';

import { useParams } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';

export function AppContent() {
  const [dataSource, setDataSource] = useState<ObjectStackAdapter | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  
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

  // Branding is now applied by AppShell via ConsoleLayout

  useEffect(() => {
    initializeDataSource();
  }, []);

  async function initializeDataSource() {
    try {
      const adapter = new ObjectStackAdapter({
        baseUrl: '/api/v1',
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        cache: { maxSize: 50, ttl: 300_000 },
      });

      // Monitor connection state
      adapter.onConnectionStateChange((event) => {
        setConnectionState(event.state);
        if (event.error) {
          console.error('[Console] Connection error:', event.error);
        }
      });

      await adapter.connect();

      setDataSource(adapter);
    } catch (err) {
      console.error('[Console] Failed to initialize:', err);
      setConnectionState('error');
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

  if (!dataSource) return <LoadingScreen />;
  if (!activeApp) return (
    <div className="h-screen flex items-center justify-center">
      <Empty>
        <EmptyTitle>No Apps Configured</EmptyTitle>
      </Empty>
    </div>
  );

  // Expression context for dynamic visibility/disabled/hidden expressions
  const expressionUser = { name: 'John Doe', email: 'admin@example.com', role: 'admin' };

  return (
    <ExpressionProvider user={expressionUser} app={activeApp} data={{}}>
    <ConsoleLayout
        activeAppName={activeApp.name}
        activeApp={activeApp}
        onAppChange={handleAppChange}
        objects={allObjects}
        connectionState={connectionState}
    >
      <CommandPalette
        apps={apps}
        activeApp={activeApp}
        objects={allObjects}
        onAppChange={handleAppChange}
      />
      <SchemaRendererProvider dataSource={dataSource || {}}>
      <ErrorBoundary>
      <Routes>
        <Route path="/" element={
            // Redirect to first route within the app
             <Navigate to={findFirstRoute(activeApp.navigation || [])} replace />
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
            <DashboardView dataSource={dataSource} />
        } />
        <Route path="report/:reportName" element={
            <ReportView dataSource={dataSource} />
        } />
        <Route path="page/:pageName" element={
            <PageView />
        } />
      </Routes>
      </ErrorBoundary>

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
    </ExpressionProvider>
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
