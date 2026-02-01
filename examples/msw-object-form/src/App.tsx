import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { AppShell, SidebarNav } from '@object-ui/layout';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ObjectForm } from '@object-ui/plugin-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from '@object-ui/components';
import { ObjectStackDataSource } from './dataSource';
import { LayoutDashboard, Users, Plus, Database, Settings } from 'lucide-react';

import appConfig from '../objectstack.config';

const APPS: any = {
  // Filter objects based on source config (heuristic: contacts->crm, todo->todo)
  crm: { 
    ...appConfig, 
    name: 'crm', 
    label: 'CRM App',
    objects: appConfig.objects?.filter((o: any) => ['account', 'contact', 'opportunity'].includes(o.name)) || []
  },
  todo: { 
    ...appConfig, 
    name: 'todo', 
    label: 'Todo App',
    objects: appConfig.objects?.filter((o: any) => ['todo_task'].includes(o.name)) || [] 
  }
};

function ObjectView({ dataSource, config, onEdit }: any) {
    const { objectName } = useParams();
    const [refreshKey, setRefreshKey] = useState(0);
    const objectDef = config.objects.find((o: any) => o.name === objectName);

    if (!objectDef) return <div>Object {objectName} not found</div>;

    // Generate columns from fields if not specified (simple auto-generation)
    // Handle both array fields and object fields definitions
    const normalizedFields = Array.isArray(objectDef.fields) 
        ? objectDef.fields 
        : Object.entries(objectDef.fields || {}).map(([key, value]: [string, any]) => ({ name: key, ...value }));

    const columns = normalizedFields.map((f: any) => ({
        field: f.name,
        label: f.label || f.name,
        width: 150
    })).slice(0, 8); // Limit to 8 columns for demo

    return (
        <div className="h-full flex flex-col gap-4">
             <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                 <div>
                    <h1 className="text-xl font-bold text-slate-900">{objectDef.label}</h1>
                    <p className="text-slate-500 text-sm">{objectDef.description || 'Manage your records'}</p>
                 </div>
                 <Button onClick={() => onEdit(null)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" /> New {objectDef.label}
                 </Button>
             </div>

             <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-4">
                <ObjectGrid
                    key={`${objectName}-${refreshKey}`}
                    schema={{
                        type: 'object-grid',
                        objectName: objectDef.name,
                        filterable: true,
                        columns: columns,
                    }}
                    dataSource={dataSource}
                    onEdit={onEdit}
                    onDelete={async (record: any) => {
                        if (confirm(`Delete record?`)) {
                            await dataSource.delete(objectName, record.id);
                            setRefreshKey(k => k + 1);
                        }
                    }}
                    className="h-full"
                />
             </div>
        </div>
    );
}

function AppContent() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);
  const [dataSource, setDataSource] = useState<ObjectStackDataSource | null>(null);
  const [activeAppKey, setActiveAppKey] = useState<string>('crm');
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    initializeClient();
  }, []);

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

  const activeConfig = APPS[activeAppKey];
  const currentObjectDef = activeConfig.objects.find((o: any) => location.pathname === `/${o.name}`);

  // Sidebar items from active app objects
  const sidebarItems = useMemo(() => {
      // Filter out objects that might not be top-level or are internal if needed
      return [
          ...activeConfig.objects.map((obj: any) => ({
              title: obj.label,
              href: `/${obj.name}`,
              icon: obj.name === 'contact' ? Users : Database
          }))
      ];
  }, [activeConfig]);

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setIsDialogOpen(true);
  };

  if (!client || !dataSource) return <div className="flex items-center justify-center h-screen">Loading ObjectStack...</div>;

  return (
    <AppShell
      sidebar={
        <SidebarNav 
          title={activeConfig.label}
          items={sidebarItems}
        />
      }
      navbar={
         <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Workspace</h2>
                <select 
                    className="border rounded px-2 py-1 text-sm bg-white"
                    value={activeAppKey} 
                    onChange={(e) => {
                        setActiveAppKey(e.target.value);
                        navigate('/');
                    }}
                >
                    <option value="crm">CRM App</option>
                    <option value="todo">Todo App</option>
                </select>
            </div>
            <div className="flex gap-2">
                 <Button variant="outline" size="sm">Help</Button>
            </div>
         </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to={`/${activeConfig.objects[0]?.name || ''}`} replace />} />
        <Route path="/:objectName" element={
            <ObjectView dataSource={dataSource} config={activeConfig} onEdit={handleEdit} />
        } />
      </Routes>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
             <DialogHeader className="p-6 pb-2 border-b border-slate-100">
                <DialogTitle>{editingRecord ? 'Edit' : 'Create'} {currentObjectDef?.label}</DialogTitle>
                <DialogDescription>Fill out the details below.</DialogDescription>
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

export function App() {
  return (
    <BrowserRouter>
        <AppContent />
    </BrowserRouter>
  );
}
