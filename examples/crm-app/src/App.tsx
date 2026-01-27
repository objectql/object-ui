import { BrowserRouter, Routes, Route, Outlet, useParams } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@object-ui/components';
import { SchemaRendererProvider, SchemaRenderer } from '@object-ui/react';
import { registerFields } from '@object-ui/fields';
import { registerLayout } from '@object-ui/layout';
import '@object-ui/plugin-dashboard'; 
import { registerPlaceholders } from '@object-ui/components';
import { SidebarNav } from './components/SidebarNav';

// Data & Schemas
import { mockData, getContact } from './data';
import { dashboardSchema } from './schemas/dashboard';
import { contactListSchema, contactDetailSchema } from './schemas/contacts';
import { opportunityListSchema } from './schemas/opportunities';

// 1. Register components
registerFields();
registerLayout();
registerPlaceholders();

// Generic Layout Shell
const Layout = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50 dark:bg-gray-900">
        <SidebarNav />
        <SidebarInset>
          <div className="p-4 border-b bg-background flex items-center md:hidden">
             <SidebarTrigger />
             <span className="ml-2 font-semibold">CRM Demo</span>
          </div>
          <main className="flex-1 overflow-y-auto w-full p-4 md:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

// Generic Detail Page Loader
const ContactDetailPage = () => {
    const { id } = useParams();
    const contact = getContact(id || "");
    
    if (!contact) return <div>Contact not found</div>;

    // In a real app, SchemaRendererProvider would be at the App root, 
    // but here we nest it to inject specific record data into the context
    return (
        <SchemaRendererProvider dataSource={contact} debug={true}>
            <SchemaRenderer schema={contactDetailSchema} />
        </SchemaRendererProvider>
    );
}

function App() {
  return (
    <SchemaRendererProvider 
      dataSource={mockData}
      debug={true}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<SchemaRenderer schema={dashboardSchema} />} />
            
            <Route path="contacts">
                <Route index element={<SchemaRenderer schema={contactListSchema} />} />
                <Route path=":id" element={<ContactDetailPage />} />
            </Route>

            <Route path="opportunities" element={<SchemaRenderer schema={opportunityListSchema} />} />
            
            <Route path="products" element={<div className="p-4">Products Module (Coming Soon)</div>} />
            <Route path="settings" element={<div className="p-4">Settings Module (Coming Soon)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SchemaRendererProvider>
  );
}

export default App;

