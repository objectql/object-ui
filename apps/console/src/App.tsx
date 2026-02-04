import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { ObjectForm } from '@object-ui/plugin-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Empty, EmptyTitle } from '@object-ui/components';
import { SchemaRendererProvider } from '@object-ui/react';
import { ObjectStackDataSource } from './dataSource';
import appConfig from '../objectstack.config';

// Components
import { ConsoleLayout } from './components/ConsoleLayout';
import { LoadingScreen } from './components/LoadingScreen';
import { ObjectView } from './components/ObjectView';
import { DashboardView } from './components/DashboardView';
import { PageView } from './components/PageView';

import { DetailView } from '@object-ui/plugin-detail';
import { useParams } from 'react-router-dom';

// ... existing imports ...

// Detail View Component
function RecordDetailView({ dataSource, objects, onEdit }: any) {
  const { objectName, recordId } = useParams();
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

  return (
    <div className="h-full bg-background overflow-auto p-4 lg:p-6">
       <DetailView 
         schema={{
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
         }}
         dataSource={dataSource}
         onEdit={() => onEdit({ _id: recordId, id: recordId })}
       />
    </div>
  );
}

export function AppContent() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);
  const [dataSource, setDataSource] = useState<ObjectStackDataSource | null>(null);
  
  // App Selection
  const navigate = useNavigate();
  const location = useLocation();
  const apps = appConfig.apps || [];
  
  // Determine active app based on URL or default
  const activeApps = apps.filter((a: any) => a.active !== false);
  const defaultApp = activeApps.find((a: any) => a.isDefault === true) || activeApps[0];
  const [activeAppName, setActiveAppName] = useState<string>(defaultApp?.name || 'default');

  const activeApp = apps.find((a: any) => a.name === activeAppName) || apps[0];

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

  const allObjects = appConfig.objects || [];
  
  // Find current object definition for Dialog (Create/Edit)
  const pathParts = location.pathname.split('/');
  const objectNameFromPath = pathParts[1]; // /contact -> contact
  const currentObjectDef = allObjects.find((o: any) => o.name === objectNameFromPath);

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setIsDialogOpen(true);
  };
  
  const handleRowClick = (record: any) => {
     // Check for both string ID and Mongo/ObjectQL _id
     const id = record._id || record.id;
     if (id && currentObjectDef) {
        navigate(`/${currentObjectDef.name}/${id}`);
     }
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
        activeAppName={activeAppName}
        activeApp={activeApp}
        onAppChange={handleAppChange}
        objects={allObjects}
    >
      <SchemaRendererProvider dataSource={dataSource || {}}>
      <Routes>
        <Route path="/" element={
             <Navigate to={findFirstRoute(activeApp.navigation)} replace />
        } />
        <Route path="/:objectName" element={
            <ObjectView 
                dataSource={dataSource} 
                objects={allObjects} 
                onEdit={handleEdit} 
                onRowClick={handleRowClick}
            />
        } />
        <Route path="/:objectName/:recordId" element={
            <RecordDetailView dataSource={dataSource} objects={allObjects} onEdit={handleEdit} />
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
                                : Object.keys(currentObjectDef.fields || {}).map(k => k), /* Ensure all keys are mapped */
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
      </SchemaRendererProvider>
    </ConsoleLayout>
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

import { ThemeProvider } from './components/theme-provider';

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="object-ui-theme">
      <BrowserRouter>
          <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}
