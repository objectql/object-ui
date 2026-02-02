import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { AppShell } from '@object-ui/layout';
import { ObjectForm } from '@object-ui/plugin-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@object-ui/components';
import { ObjectStackDataSource } from './dataSource';
import appConfig from '../objectstack.config';

// New Components
import { AppSidebar } from './components/AppSidebar';
import { ObjectView } from './components/ObjectView';
import { AppHeader } from './components/AppHeader';
import { DashboardView } from './components/DashboardView';
import { PageView } from './components/PageView';

function AppContent() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);
  const [dataSource, setDataSource] = useState<ObjectStackDataSource | null>(null);
  
  // App Selection
  const navigate = useNavigate();
  const location = useLocation();
  const apps = appConfig.apps || [];
  
  // Determine active app based on URL or default
  // Filter active apps and find default app
  const activeApps = apps.filter((a: any) => a.active !== false);
  const defaultApp = activeApps.find((a: any) => a.isDefault === true) || activeApps[0];
  const [activeAppName, setActiveAppName] = useState<string>(defaultApp?.name || 'default');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);

  useEffect(() => {
    initializeClient();
  }, []);

  // Apply favicon from app branding
  useEffect(() => {
    const favicon = activeApp?.branding?.favicon;
    if (favicon) {
      const link = document.querySelector<HTMLLinkElement>('#favicon');
      if (link) {
        link.href = favicon;
      }
    }
    // Update document title with app label
    if (activeApp?.label) {
      document.title = `${activeApp.label} - ObjectStack Console`;
    }
  }, [activeApp]);

  async function initializeClient() {
    try {
      const stackClient = new ObjectStackClient({ baseUrl: '' });
      await new Promise(resolve => setTimeout(resolve, 500));
      await stackClient.connect();
      setClient(stackClient);
      setDataSource(new ObjectStackDataSource(stackClient));
    } catch (err) {
      console.error(err);
    }
  }

  const activeApp = apps.find((a: any) => a.name === activeAppName) || apps[0];
  const allObjects = appConfig.objects || [];
  
  // Find current object definition for Dialog (Create/Edit)
  const pathParts = location.pathname.split('/');
  const objectNameFromPath = pathParts[1]; // /contact -> contact
  const currentObjectDef = allObjects.find((o: any) => o.name === objectNameFromPath);

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setIsDialogOpen(true);
  };

  const handleAppChange = (appName: string) => {
      setActiveAppName(appName);
      const app = apps.find((a: any) => a.name === appName);
      if (app) {
         // Navigate to homePageId if defined in spec, otherwise first nav item
         if (app.homePageId) {
             navigate(app.homePageId);
         } else {
             const firstRoute = findFirstRoute(app.navigation);
             navigate(firstRoute);
         }
      }
  };

  if (!client || !dataSource) return <div className="flex items-center justify-center h-screen text-muted-foreground animate-pulse">Initializing ObjectStack Console...</div>;
  if (!activeApp) return <div className="p-4">No Apps configured.</div>;

  return (
    <AppShell
      sidebar={
         <AppSidebar 
            activeAppName={activeAppName} 
            onAppChange={handleAppChange} 
         />
      }
      navbar={
          <AppHeader appName={activeApp.label} objects={allObjects} />
      }
    >
      <Routes>
        <Route path="/" element={
             <Navigate to={findFirstRoute(activeApp.navigation)} replace />
        } />
        <Route path="/:objectName" element={
            <ObjectView dataSource={dataSource} objects={allObjects} onEdit={handleEdit} />
        } />
        <Route path="/dashboard/:dashboardName" element={
            <DashboardView />
        } />
        <Route path="/page/:pageName" element={
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
                            fields: Array.isArray(currentObjectDef.fields) 
                                ? currentObjectDef.fields.map((f: any) => f.name)
                                : Object.keys(currentObjectDef.fields || {}),
                            onSuccess: () => { setIsDialogOpen(false); navigate(location.pathname); }, 
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
    </AppShell>
  );
}

// Helper to find first valid route in navigation tree
function findFirstRoute(items: any[]): string {
    if (!items || items.length === 0) return '/';
    for (const item of items) {
        if (item.type === 'object') return `/${item.objectName}`;
        if (item.type === 'page') return item.pageName ? `/page/${item.pageName}` : '/';
        if (item.type === 'dashboard') return item.dashboardName ? `/dashboard/${item.dashboardName}` : '/';
        if (item.type === 'url') continue; // Skip external URLs
        if (item.type === 'group' && item.children) {
            const childRoute = findFirstRoute(item.children); // Recurse
            if (childRoute !== '/') return childRoute;
        }
    }
    return '/';
}

export function App() {
  return (
    <BrowserRouter>
        <AppContent />
    </BrowserRouter>
  );
}
