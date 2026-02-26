import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback, lazy, Suspense, useMemo, type ReactNode } from 'react';
import { ModalForm } from '@object-ui/plugin-form';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { toast } from 'sonner';
import { SchemaRendererProvider, useActionRunner, useGlobalUndo } from '@object-ui/react';
import type { ConnectionState } from './dataSource';
import { AuthGuard, useAuth, PreviewBanner } from '@object-ui/auth';
import { MetadataProvider, useMetadata } from './context/MetadataProvider';
import { AdapterProvider, useAdapter } from './context/AdapterProvider';

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
import { NavigationSyncEffect } from './hooks/useNavigationSync';

// Route-based code splitting — lazy-load less-frequently-used routes
const RecordDetailView = lazy(() => import('./components/RecordDetailView').then(m => ({ default: m.RecordDetailView })));
const DashboardView = lazy(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const PageView = lazy(() => import('./components/PageView').then(m => ({ default: m.PageView })));
const ReportView = lazy(() => import('./components/ReportView').then(m => ({ default: m.ReportView })));
const SearchResultsPage = lazy(() => import('./components/SearchResultsPage').then(m => ({ default: m.SearchResultsPage })));

// App Creation / Edit Pages (lazy — only needed during app management)
const CreateAppPage = lazy(() => import('./pages/CreateAppPage').then(m => ({ default: m.CreateAppPage })));
const EditAppPage = lazy(() => import('./pages/EditAppPage').then(m => ({ default: m.EditAppPage })));

// Design Pages (lazy — only needed when editing pages/dashboards)
const PageDesignPage = lazy(() => import('./pages/PageDesignPage').then(m => ({ default: m.PageDesignPage })));
const DashboardDesignPage = lazy(() => import('./pages/DashboardDesignPage').then(m => ({ default: m.DashboardDesignPage })));

// Auth Pages (lazy — only needed before login)
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));

// System Admin Pages (lazy — rarely accessed)
const SystemHubPage = lazy(() => import('./pages/system/SystemHubPage').then(m => ({ default: m.SystemHubPage })));
const AppManagementPage = lazy(() => import('./pages/system/AppManagementPage').then(m => ({ default: m.AppManagementPage })));
const UserManagementPage = lazy(() => import('./pages/system/UserManagementPage').then(m => ({ default: m.UserManagementPage })));
const OrgManagementPage = lazy(() => import('./pages/system/OrgManagementPage').then(m => ({ default: m.OrgManagementPage })));
const RoleManagementPage = lazy(() => import('./pages/system/RoleManagementPage').then(m => ({ default: m.RoleManagementPage })));
const PermissionManagementPage = lazy(() => import('./pages/system/PermissionManagementPage').then(m => ({ default: m.PermissionManagementPage })));
const AuditLogPage = lazy(() => import('./pages/system/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const ProfilePage = lazy(() => import('./pages/system/ProfilePage').then(m => ({ default: m.ProfilePage })));

import { useParams } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { ConsoleToaster } from './components/ConsoleToaster';

/**
 * ConnectedShell
 *
 * Creates the ObjectStackAdapter (via AdapterProvider), waits for connection,
 * then wraps children in MetadataProvider for API-driven metadata.
 */
function ConnectedShell({ children }: { children: ReactNode }) {
  return (
    <AdapterProvider>
      <ConnectedShellInner>{children}</ConnectedShellInner>
    </AdapterProvider>
  );
}

function ConnectedShellInner({ children }: { children: ReactNode }) {
  const adapter = useAdapter();
  if (!adapter) return <LoadingScreen />;

  return (
    <MetadataProvider adapter={adapter}>
      {children}
    </MetadataProvider>
  );
}

export function AppContent() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const { user } = useAuth();
  const dataSource = useAdapter();
  
  // App Selection
  const navigate = useNavigate();
  const location = useLocation();
  const [, setSearchParams] = useSearchParams();
  const { appName } = useParams();
  const { apps, objects: allObjects, loading: metadataLoading } = useMetadata();
  
  // Determine active app based on URL
  const activeApps = apps.filter((a: any) => a.active !== false);
  const activeApp = apps.find((a: any) => a.name === appName) || activeApps.find((a: any) => a.isDefault === true) || activeApps[0];

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { addRecentItem } = useRecentItems();

  // ActionRunner for CRUD dialog callbacks (Phase 2.9)
  const { execute: executeAction, runner } = useActionRunner();

  // Global Undo/Redo with toast notifications (Phase 16 L2)
  useGlobalUndo({
    dataSource: dataSource ?? undefined,
    onUndo: (op) => {
      toast.info(`Undo: ${op.description}`, {
        duration: 4000,
      });
      setRefreshKey(k => k + 1);
    },
    onRedo: (op) => {
      toast.info(`Redo: ${op.description}`, {
        duration: 3000,
      });
      setRefreshKey(k => k + 1);
    },
  });

  useEffect(() => {
    runner.registerHandler('crud_success', async (action) => {
      setIsDialogOpen(false);
      setRefreshKey(k => k + 1);
      toast.success(action.params?.message ?? 'Record saved successfully');
      return { success: true, reload: true };
    });

    runner.registerHandler('dialog_cancel', async () => {
      setIsDialogOpen(false);
      return { success: true };
    });
  }, [runner]);

  // Branding is now applied by AppShell via ConsoleLayout

  useEffect(() => {
    if (!dataSource) return;
    const unsub = dataSource.onConnectionStateChange((event) => {
      setConnectionState(event.state);
      if (event.error) {
        console.error('[Console] Connection error:', event.error);
      }
    });
    // Sync current state
    setConnectionState(dataSource.getConnectionState());
    return unsub;
  }, [dataSource]);

  // allObjects already derived from useMetadata() above
  
  // Find current object for Dialog
  // Path is now relative to /apps/:appName/
  // e.g. /apps/crm/contact -> contact is at index 3 (0=, 1=apps, 2=crm, 3=contact)
  const pathParts = location.pathname.split('/');
  // Filter out empty parts
  const cleanParts = pathParts.filter(p => p);
  // [apps, crm, contact]
  let objectNameFromPath = cleanParts[2];
  if (objectNameFromPath === 'view' || objectNameFromPath === 'record' || objectNameFromPath === 'page' || objectNameFromPath === 'dashboard' || objectNameFromPath === 'design') {
      objectNameFromPath = ''; // Not an object root
  }

  const currentObjectDef = allObjects.find((o: any) => o.name === objectNameFromPath);

  const handleCrudSuccess = useCallback(() => {
    const label = currentObjectDef?.label || 'Record';
    executeAction({
      type: 'crud_success',
      params: {
        message: editingRecord
          ? `${label} updated successfully`
          : `${label} created successfully`,
      },
    });
  }, [executeAction, editingRecord, currentObjectDef?.label]);

  const handleDialogCancel = useCallback(() => {
    executeAction({ type: 'dialog_cancel' });
  }, [executeAction]);

  // Track recent items on route change
  // Only depend on location.pathname — the sole external trigger.
  // All other values (activeApp, allObjects, cleanParts) are derived from
  // stable module-level config and the current pathname, so they don't need
  // to be in the dependency array (and including array refs would loop).
  useEffect(() => {
    if (!activeApp) return;
    const parts = location.pathname.split('/').filter(Boolean);
    let objName = parts[2];
    if (objName === 'view' || objName === 'record' || objName === 'page' || objName === 'dashboard' || objName === 'design') {
      objName = '';
    }
    const basePath = `/apps/${activeApp.name}`;
    const objects = allObjects;
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

  if (!dataSource || metadataLoading) return <LoadingScreen />;

  // Allow create-app route even when no active app exists
  const isCreateAppRoute = location.pathname.endsWith('/create-app');

  if (!activeApp && !isCreateAppRoute) return (
    <div className="h-screen flex items-center justify-center">
      <Empty>
        <EmptyTitle>No Apps Configured</EmptyTitle>
        <EmptyDescription>No applications have been registered.</EmptyDescription>
        <button
          className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          onClick={() => navigate('create-app')}
          data-testid="create-first-app-btn"
        >
          Create Your First App
        </button>
      </Empty>
    </div>
  );

  // When on create-app without an active app, render a minimal layout with just the wizard
  if (!activeApp && isCreateAppRoute) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="create-app" element={<CreateAppPage />} />
        </Routes>
      </Suspense>
    );
  }

  // Expression context for dynamic visibility/disabled/hidden expressions
  const expressionUser = user
    ? { name: user.name, email: user.email, role: user.role ?? 'user' }
    : { name: 'Anonymous', email: '', role: 'guest' };

  return (
    <ExpressionProvider user={expressionUser} app={activeApp} data={{}}>
    <NavigationSyncEffect />
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

        <Route path="dashboard/:dashboardName" element={
            <DashboardView dataSource={dataSource} />
        } />
        <Route path="report/:reportName" element={
            <ReportView dataSource={dataSource} />
        } />
        <Route path="page/:pageName" element={
            <PageView />
        } />
        <Route path="design/page/:pageName" element={
            <PageDesignPage />
        } />
        <Route path="design/dashboard/:dashboardName" element={
            <DashboardDesignPage />
        } />
        <Route path="search" element={
            <SearchResultsPage />
        } />

        {/* App Creation & Editing */}
        <Route path="create-app" element={<CreateAppPage />} />
        <Route path="edit-app/:editAppName" element={<EditAppPage />} />

        {/* System Administration Routes */}
        <Route path="system" element={<SystemHubPage />} />
        <Route path="system/apps" element={<AppManagementPage />} />
        <Route path="system/users" element={<UserManagementPage />} />
        <Route path="system/organizations" element={<OrgManagementPage />} />
        <Route path="system/roles" element={<RoleManagementPage />} />
        <Route path="system/permissions" element={<PermissionManagementPage />} />
        <Route path="system/audit-log" element={<AuditLogPage />} />
        <Route path="system/profile" element={<ProfilePage />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>

       {currentObjectDef && (
          <ModalForm
              key={editingRecord?.id || 'new'}
              schema={{
                  type: 'object-form',
                  formType: 'modal',
                  objectName: currentObjectDef.name,
                  mode: editingRecord ? 'edit' : 'create',
                  recordId: editingRecord?.id,
                  title: `${editingRecord ? 'Edit' : 'Create'} ${currentObjectDef?.label}`,
                  description: editingRecord ? `Update details for ${currentObjectDef?.label}` : `Add a new ${currentObjectDef?.label} to your database.`,
                  open: isDialogOpen,
                  onOpenChange: setIsDialogOpen,
                  layout: 'vertical',
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
                  onSuccess: handleCrudSuccess, 
                  onCancel: handleDialogCancel,
                  showSubmit: true,
                  showCancel: true,
                  submitText: 'Save Record',
                  cancelText: 'Cancel',
              }}
              dataSource={dataSource}
          />
       )}
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
    const { apps, loading, error } = useMetadata();
    const navigate = useNavigate();
    const activeApps = apps.filter((a: any) => a.active !== false);
    const defaultApp = activeApps.find((a: any) => a.isDefault === true) || activeApps[0];
    
    if (loading) return <LoadingScreen />;
    if (defaultApp) {
        return <Navigate to={`/apps/${defaultApp.name}`} replace />;
    }
    return (
      <div className="h-screen flex items-center justify-center">
        <Empty>
          <EmptyTitle>{error ? 'Failed to Load Configuration' : 'No Apps Configured'}</EmptyTitle>
          <EmptyDescription>
            {error ? error.message : 'No applications have been registered. Check your ObjectStack configuration.'}
          </EmptyDescription>
          {!error && (
            <button
              className="mt-4 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate('/apps/_new/create-app')}
              data-testid="create-first-app-btn"
            >
              Create Your First App
            </button>
          )}
        </Empty>
      </div>
    );
}

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="object-ui-theme">
      <ConsoleToaster position="bottom-right" />
      <ConditionalAuthWrapper authUrl="/api/auth">
        <PreviewBanner />
        <BrowserRouter basename={import.meta.env.BASE_URL?.replace(/\/$/, '') || '/'}>
            <Suspense fallback={<LoadingScreen />}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/apps/:appName/*" element={
                  <AuthGuard fallback={<Navigate to="/login" />} loadingFallback={<LoadingScreen />}>
                    <ConnectedShell>
                      <AppContent />
                    </ConnectedShell>
                  </AuthGuard>
                } />
                <Route path="/" element={
                  <ConnectedShell>
                    <RootRedirect />
                  </ConnectedShell>
                } />
            </Routes>
            </Suspense>
        </BrowserRouter>
      </ConditionalAuthWrapper>
    </ThemeProvider>
  );
}
