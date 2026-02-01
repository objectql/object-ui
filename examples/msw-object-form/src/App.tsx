import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ObjectStackClient } from '@objectstack/client';
import { AppShell, SidebarNav } from '@object-ui/layout';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ObjectForm } from '@object-ui/plugin-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from '@object-ui/components';
import { ObjectStackDataSource } from './dataSource';
import { LayoutDashboard, Users, Settings, Plus } from 'lucide-react';
import appConfig from '../objectstack.config';

function AppContent() {
  const [client, setClient] = useState<ObjectStackClient | null>(null);
  const [dataSource, setDataSource] = useState<ObjectStackDataSource | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

  const handleCreate = () => {
    setEditingRecord(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setIsDialogOpen(true);
  };

  if (!client || !dataSource) return <div className="flex items-center justify-center h-screen">Loading ObjectStack...</div>;

  const contactsObject = appConfig.objects?.find(o => o.name === 'contact') || appConfig.objects?.[0];

  if (!contactsObject) return <div className="p-4">No object definition found in configuration.</div>;

  return (
    <AppShell
      sidebar={
        <SidebarNav 
          title="ObjectUI CRM"
          items={[
            { title: 'Dashboard', href: '/', icon: LayoutDashboard },
            { title: 'Contacts', href: '/contacts', icon: Users },
            { title: 'Settings', href: '/settings', icon: Settings }
          ]}
        />
      }
      navbar={
         <div className="flex items-center justify-between w-full">
            <h2 className="text-lg font-semibold">CRM Workspace</h2>
            <div className="flex gap-2">
                 <Button variant="outline" size="sm">Help</Button>
            </div>
         </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/contacts" replace />} />
        <Route path="/contacts" element={
          <div className="h-full flex flex-col gap-4">
             <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                 <div>
                    <h1 className="text-xl font-bold text-slate-900">{contactsObject.label}</h1>
                    <p className="text-slate-500 text-sm">Manage all your contacts in one place</p>
                 </div>
                 <Button onClick={handleCreate} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" /> New {contactsObject.label}
                 </Button>
             </div>

             <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-4">
                <ObjectGrid
                    key={refreshKey}
                    schema={{
                    type: 'object-grid',
                    objectName: contactsObject.name,
                    filterable: true,
                    searchableFields: ['name', 'email', 'company'],
                    columns: [
                        { field: 'name', label: 'Name', width: 200, fixed: 'left' },
                        { field: 'email', label: 'Email', width: 220 },
                        { field: 'phone', label: 'Phone', width: 150 },
                        { field: 'company', label: 'Company', width: 180 },
                        { field: 'department', label: 'Department', width: 150 },
                        { field: 'priority', label: 'Priority', width: 100 },
                        { field: 'salary', label: 'Salary', width: 120 },
                        { field: 'is_active', label: 'Active', width: 100 },
                    ]
                    }}
                    dataSource={dataSource}
                    onEdit={handleEdit}
                    onDelete={async (record) => {
                        if (confirm(`Delete ${record.name}?`)) {
                            await dataSource.delete(contactsObject.name, record.id);
                            setRefreshKey(k => k + 1);
                        }
                    }}
                    className="h-full"
                />
             </div>
          </div>
        } />
        <Route path="*" element={<div>Page not found</div>} />
      </Routes>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
             <DialogHeader className="p-6 pb-2 border-b border-slate-100">
                <DialogTitle>{editingRecord ? 'Edit' : 'Create'} {contactsObject.label}</DialogTitle>
                <DialogDescription>Fill out the details below.</DialogDescription>
             </DialogHeader>
             <div className="flex-1 overflow-y-auto p-6">
                <ObjectForm
                    schema={{
                    type: 'object-form',
                    objectName: contactsObject.name,
                    mode: editingRecord ? 'edit' : 'create',
                    recordId: editingRecord?.id,
                    layout: 'vertical',
                    columns: 2,
                    fields: [
                        'name', 'email', 'phone', 'company', 
                        'department', 'priority', 'salary', 'commission_rate',
                        'birthdate', 'available_time', 'is_active', 'notes',
                        'profile_url', 'avatar'
                    ],
                    onSuccess: () => { setIsDialogOpen(false); setRefreshKey(k => k + 1); },
                    onCancel: () => setIsDialogOpen(false),
                    showSubmit: true,
                    showCancel: true,
                    submitText: editingRecord ? 'Save Changes' : 'Create Record'
                    }}
                    dataSource={dataSource}
                />
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
