import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { ObjectForm } from '@object-ui/plugin-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Empty, EmptyTitle } from '@object-ui/components';
import { toast } from 'sonner';
import { SchemaRendererProvider } from '@object-ui/react';
import { ObjectStackAdapter } from './dataSource';
import type { ConnectionState } from './dataSource';
import appConfig from '../objectstack.shared';
import { AuthGuard, useAuth } from '@object-ui/auth';

// Components (eagerly loaded — always needed)
import { ConsoleLayout } from './components/ConsoleLayout';
import { CommandPalette } from './components/CommandPalette';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { ObjectView } from './components/ObjectView';
import { ExpressionProvider, evaluateVisibility } from './context/ExpressionProvider';
import { ExpressionEvaluator } from '@object-ui/core';
import { ConditionalAuthWrapper } from './components/ConditionalAuthWrapper';
import { KeyboardShortcutsDialog } from './components/KeyboardShortcutsDialog';
import { OnboardingWalkthrough } from './components/OnboardingWalkthrough';
import { useRecentItems } from './hooks/useRecentItems';

// Route-based code splitting — lazy-load less-frequently-used routes
const RecordDetailView = lazy(() => import('./components/RecordDetailView').then(m => ({ default: m.RecordDetailView })));
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const PageView = lazy(() => import('./components/PageView').then(m => ({ default: m.PageView })));
const ReportView = lazy(() => import('./components/ReportView').then(m => ({ default: m.ReportView })));
const ViewDesignerPage = lazy(() => import('./components/ViewDesignerPage').then(m => ({ default: m.ViewDesignerPage })));
const SearchResultsPage = lazy(() => import('./components/SearchResultsPage').then(m => ({ default: m.SearchResultsPage })));

// Auth Pages (lazy — only needed before login)
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));

// System Admin Pages (lazy — rarely accessed)
const UserManagementPage = lazy(() => import('./pages/system/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const OrgManagementPage = lazy(() => import('./pages/system/OrgManagementPage').then(m => ({ default: m.OrgManagementPage })));
const RoleManagementPage = lazy(() => import('./pages/system/RoleManagementPage').then(m => ({ default: m.RoleManagementPage })));
const AuditLogPage = lazy(() => import('./pages/system/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const ProfilePage = lazy(() => import('./pages/system/ProfilePage').then(m => ({ default: m.ProfilePage })));

import { useParams } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { ConsoleToaster } from './components/ConsoleToaster';

export function AppContent() {
  const [dataSource, setDataSource] = useState<ObjectStackAdapter | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const { user } = useAuth();
  
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
  const { addRecentItem } = useRecentItems();

  // Branding is now applied by AppShell via ConsoleLayout

  useEffect(() => {
    let cancelled = false;

    async function initializeDataSource() {
      try {
        const adapter = new ObjectStackAdapter({
          baseUrl: '',
          autoReconnect: true,
          maxReconnectAttempts: 5,
          reconnectDelay: 1000,
          cache: { maxSize: 50, ttl: 300_000 },
        });

        // Monitor connection state
        adapter.onConnectionStateChange((event) => {
          if (cancelled) return;
          setConnectionState(event.state);
          if (event.error) {
            console.error('[Console] Connection error:', event.error);
          }
        });

        await adapter.connect();

        if (!cancelled) {
          setDataSource(adapter);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Console] Failed to initialize:', err);
          setConnectionState('error');
        }
      }
    }

    initializeDataSource();

    return () => {
      cancelled = true;
    };
  }, []);

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

  // Track recent items on route change
  // Only depend on location.pathname — the sole external trigger.
  // All other values (activeApp, allObjects, cleanParts) are derived from
  // stable module-level config and the current pathname, so they don't need
  // to be in the dependency array (and including array refs would loop).
  useEffect(() => {
    if (!activeApp) return;
    const parts = location.pathname.split('/').filter(Boolean);
    let objName = parts[2];
    if (objName === 'view' || objName === 'record' || objName === 'page' || objName === 'dashboard') {
      objName = '';
    }
    const basePath = `/apps/${activeApp.name}`;
    const objects = appConfig.objects || [];
    if (objName) {
      const obj = objects.find((o: any) => o.name === objName);
      if (obj) {
        addRecentItem({
          id: `object:${obj.name}`,
          label: obj.label || obj.name,
          href: `${basePath}/${obj.name}`,
          type: 'object',
        });
      }
    } else if (parts[2] === 'dashboard' && parts[3]) {
      addRecentItem({
        id: `dashboard:${parts[3]}`,
        label: parts[3].replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        href: `${basePath}/dashboard/${parts[3]}`,
        type: 'dashboard',
      });
    } else if (parts[2] === 'report' && parts[3]) {
      addRecentItem({
        id: `report:${parts[3]}`,
        label: parts[3].replace(/[-_]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        href: `${basePath}/report/${parts[3]}`,
        type: 'report',
      });
    }
  }, [location.pathname, addRecentItem]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Expression evaluator for CRUD dialog field visibility (includes editing record data)
  const expressionEvaluator = useMemo(
    () => new ExpressionEvaluator({
      user: user ? { name: user.name, email: user.email, role: user.role ?? 'user' } : {},
      app: activeApp || {},
      data: editingRecord || {},
    }),
    [user, activeApp, editingRecord]
  );

  if (!dataSource) return <LoadingScreen />;
  if (!activeApp) return (
    <div className="h-screen flex items-center justify-center">
      <Empty>
        <EmptyTitle>No Apps Configured</EmptyTitle>
      </Empty>
    </div>
  );

  // Expression context for dynamic visibility/disabled/hidden expressions
  const expressionUser = user
    ? { name: user.name, email: user.email, role: user.role ?? 'user' }
    : { name: 'Anonymous', email: '', role: 'guest' };

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
      <KeyboardShortcutsDialog />
      <OnboardingWalkthrough />
      <SchemaRendererProvider dataSource={dataSource || {}}>
      <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
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

        {/* View Designer - Create/Edit Views */}
        <Route path=":objectName/views/new" element={
            <ViewDesignerPage objects={allObjects} />
        } />
        <Route path=":objectName/views/:viewId" element={
            <ViewDesignerPage objects={allObjects} />
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
        <Route path="search" element={
            <SearchResultsPage />
        } />

        {/* System Administration Routes */}
        <Route path="system/users" element={<UserManagementPage />} />
        <Route path="system/organizations" element={<OrgManagementPage />} />
        <Route path="system/roles" element={<RoleManagementPage />} />
        <Route path="system/audit-log" element={<AuditLogPage />} />
        <Route path="system/profile" element={<ProfilePage />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="h-[100dvh] sm:h-auto sm:max-w-xl sm:max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden w-[100vw] sm:w-full rounded-none sm:rounded-lg">
             <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b">
                <div className="mx-auto w-12 h-1.5 rounded-full bg-muted mb-2 sm:hidden" />
                <DialogTitle className="text-lg sm:text-xl">{editingRecord ? 'Edit' : 'Create'} {currentObjectDef?.label}</DialogTitle>
                <DialogDescription className="text-sm">
                    {editingRecord ? `Update details for ${currentObjectDef?.label}` : `Add a new ${currentObjectDef?.label} to your database.`}
                </DialogDescription>
             </DialogHeader>
             <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
                                    ? currentObjectDef.fields
                                        .filter((f: any) => {
                                          if (typeof f === 'string') return true;
                                          return evaluateVisibility(f.visible, expressionEvaluator);
                                        })
                                        .map((f: any) => typeof f === 'string' ? f : f.name)
                                    : Object.entries(currentObjectDef.fields)
                                        .filter(([_, f]: [string, any]) => evaluateVisibility(f.visible, expressionEvaluator))
                                        .map(([key]: [string, any]) => key))
                                : [],
                            onSuccess: () => {
                                setIsDialogOpen(false);
                                setRefreshKey(k => k + 1);
                                toast.success(
                                  editingRecord
                                    ? `${currentObjectDef?.label} updated successfully`
                                    : `${currentObjectDef?.label} created successfully`
                                );
                            }, 
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
      <ConsoleToaster position="bottom-right" />
      <ConditionalAuthWrapper authUrl="/api/auth">
        <BrowserRouter basename="/">
            <Suspense fallback={<LoadingScreen />}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/apps/:appName/*" element={
                  <AuthGuard fallback={<Navigate to="/login" />} loadingFallback={<LoadingScreen />}>
                    <AppContent />
                  </AuthGuard>
                } />
                <Route path="/" element={<RootRedirect />} />
            </Routes>
            </Suspense>
        </BrowserRouter>
      </ConditionalAuthWrapper>
    </ThemeProvider>
  );
}
