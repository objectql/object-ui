import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Link, useLocation } from 'react-router-dom';
import { SchemaRendererProvider, SchemaRenderer, useRenderer } from '@object-ui/react';
import { registerFields } from '@object-ui/fields';
import { registerLayout } from '@object-ui/layout';
import { SidebarNav } from './components/SidebarNav';

// 1. Register components from packages (The "Controls Repository")
registerFields();
registerLayout();

// 2. Define Mock Data (In a real app, this comes from an API)
const mockData = {
  user: { name: "Demo User", role: "admin" },
  stats: { revenue: 125000, leads: 45, deals: 12 },
  contacts: [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", status: "Active" },
    { id: 2, name: "Bob Smith", email: "bob@tech.com", status: "Lead" },
    { id: 3, name: "Charlie Brown", email: "charlie@peanuts.com", status: "Customer" }
  ]
};

// 3. Define Page Schemas (The "JSON Rendering")

// Dashboard Page
const dashboardSchema = {
  type: "page",
  props: { title: "Executive Dashboard" },
  children: [
    {
      type: "grid",
      props: { cols: 3, gap: 4, className: "mb-8" },
      children: [
        {
          type: "card",
          props: { title: "Total Revenue" },
          children: [{ type: "text", props: { value: "$125,000", className: "text-2xl font-bold" } }]
        },
        {
          type: "card",
          props: { title: "Active Leads" },
          children: [{ type: "text", props: { value: "45", className: "text-2xl font-bold" } }]
        },
        {
          type: "card",
          props: { title: "Open Deals" },
          children: [{ type: "text", props: { value: "12", className: "text-2xl font-bold" } }]
        }
      ]
    },
    {
      type: "card", 
      props: { title: "Recent Activity", className: "col-span-3" },
      children: [
         { type: "text", props: { value: "Activity list would go here...", className: "text-gray-500" } }
      ]
    }
  ]
};

// Contacts List Page
const contactsSchema = {
  type: "page",
  props: { title: "Contacts" },
  children: [
    {
      type: "page-header",
      props: { 
        title: "All Contacts", 
        description: "Manage your customer relationships" 
      },
      children: [
        { 
          type: "button", 
          props: { label: "Add Contact", variant: "default" },
          events: { onClick: [{ action: "navigate", params: { url: "/contacts/new" } }] } 
        }
      ]
    },
    {
      type: "card",
      className: "mt-6",
      children: [
        {
          type: "table", // Note: We need to implement 'table' in plugins soon
          bind: "contacts", 
          props: {
            columns: [
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
              { key: "status", label: "Status" }
            ]
          }
        }
      ]
    }
  ]
};

// Layout Shell Component
const Layout = () => {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

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
            <Route path="contacts" element={<SchemaRenderer schema={contactsSchema} />} />
            <Route path="opportunities" element={<div className="p-4">Opportunities Module (Coming Soon)</div>} />
            <Route path="settings" element={<div className="p-4">Settings Module (Coming Soon)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SchemaRendererProvider>
  );
}

export default App;
