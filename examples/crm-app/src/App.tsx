import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, useParams } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger, Separator } from '@object-ui/components';
import { SchemaRendererProvider, SchemaRenderer } from '@object-ui/react';
import { registerFields } from '@object-ui/fields';
import { registerLayout } from '@object-ui/layout';
import '@object-ui/plugin-dashboard'; 
import { registerPlaceholders } from '@object-ui/components';
import { SidebarNav } from './components/SidebarNav';

// Schemas
import { dashboardSchema } from './schemas/dashboard';
import { contactListSchema, contactDetailSchema } from './schemas/contacts';
import { opportunityListSchema } from './schemas/opportunities';
import { opportunityDetailSchema } from './schemas/opportunity-detail';

import { registerCustomWidgets } from './components/registry';

// 1. Register components
registerFields();
registerLayout();
registerPlaceholders();
registerCustomWidgets();

// Generic Layout Shell
const Layout = () => {
  return (
    <SidebarProvider>
      <SidebarNav />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="font-semibold">CRM Demo (MSW Enabled)</span>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-8 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

// Async Detail Page Loader
const ContactDetailPage = () => {
    const { id } = useParams();
    const [contact, setContact] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        setLoading(true);
        // Using the MSW intercepted endpoint
        fetch(`/api/v1/data/contact/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(setContact)
            .catch(() => setContact(null))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-4">Loading Contact...</div>;
    if (!contact) return <div className="p-4">Contact not found</div>;

    return (
        <SchemaRendererProvider dataSource={contact} debug={true}>
            <SchemaRenderer schema={contactDetailSchema} />
        </SchemaRendererProvider>
    );
}

const OpportunityDetailPage = () => {
    const { id } = useParams();
    const [opportunity, setOpportunity] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        setLoading(true);
        fetch(`/api/v1/data/opportunity/${id}`)
            .then(res => {
                if (!res.ok) throw new Error("Not found");
                return res.json();
            })
            .then(setOpportunity)
            .catch(() => setOpportunity(null))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="p-4">Loading Opportunity...</div>;
    if (!opportunity) return <div className="p-4">Opportunity not found</div>;

    return (
        <SchemaRendererProvider dataSource={opportunity} debug={true}>
            <SchemaRenderer schema={opportunityDetailSchema} />
        </SchemaRendererProvider>
    );
}

function App() {
  // Global Data State (Dashboard, Lists)
  const [appData, setAppData] = useState<any>(null);
  
  useEffect(() => {
     // Fetch bootstrap data
     fetch('/api/bootstrap')
        .then(res => res.json())
        .then(setAppData)
        .catch(err => console.error("Failed to load bootstrap data", err));
  }, []);

  if (!appData) return <div className="flex h-screen items-center justify-center">Loading Application Data...</div>;

  return (
    <SchemaRendererProvider 
      dataSource={appData}
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

            <Route path="opportunities">
                <Route index element={<SchemaRenderer schema={opportunityListSchema} />} />
                <Route path=":id" element={<OpportunityDetailPage />} />
            </Route>
            
            <Route path="products" element={<div className="p-4">Products Module (Coming Soon)</div>} />
            <Route path="settings" element={<div className="p-4">Settings Module (Coming Soon)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SchemaRendererProvider>
  );
}

export default App;


