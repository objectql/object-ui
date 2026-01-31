
import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton } from '../ui/sidebar';
import { 
    LayoutDashboard, 
    Users, 
    Settings, 
    FileText,
    GalleryVerticalEnd,
    Building2,
    UserPlus,
    TrendingUp
} from 'lucide-react';

/* --- MOCK DATA --- */

const DASHBOARD_DATA = {
    revenue: "$45,231.89",
    subscriptions: "+2350",
    sales: "+12,234",
    revenueGrowth: "+20.1% from last month",
    subGrowth: "+180.1% from last month",
    salesGrowth: "+19% from last month",
    overview: [
        { name: "Jan", total: 1200 }, { name: "Feb", total: 1500 }, { name: "Mar", total: 1300 },
        { name: "Apr", total: 1800 }, { name: "May", total: 2200 }, { name: "Jun", total: 2600 }
    ],
    // For view:simple list
    recentSales: [
        { name: "Olivia Martin", email: "olivia.martin@email.com", amount: "+$1,999.00" },
        // ... handled manually in schema for view:simple until we support loops
    ]
};

const CONTACTS_DATA = {
    contacts: [
        { id: 1, name: "Alice Johnson", company: "TechCorp", email: "alice@techcorp.com", status: "Active" },
        { id: 2, name: "Bob Smith", company: "SalesInc", email: "bob@salesinc.com", status: "Inactive" },
        { id: 3, name: "Charlie Davis", company: "StartupHub", email: "charlie@startuphub.com", status: "Lead" },
        { id: 4, name: "Dana Wilson", company: "Enterprise Ltd", email: "dana@enterprise.com", status: "Active" },
        { id: 5, name: "Evan Brown", company: "Innovate LLC", email: "evan@innovate.com", status: "Active" },
    ]
};

const OPPORTUNITIES_DATA = {
    opportunities: [
        { id: 101, name: "TechCorp License Renewal", amount: 50000, stage: "Negotiation", probability: "80%", closeDate: "2026-02-15", contact: "Alice Johnson" },
        { id: 102, name: "SalesInc New Deal", amount: 12000, stage: "Qualified", probability: "40%", closeDate: "2026-03-01", contact: "Bob Smith" },
        { id: 103, name: "StartupHub Seed", amount: 5000, stage: "Closed Won", probability: "100%", closeDate: "2026-01-20", contact: "Charlie Davis" },
        { id: 104, name: "Enterprise Ltd Expansion", amount: 150000, stage: "Proposal", probability: "60%", closeDate: "2026-02-28", contact: "Dana Wilson" }
    ]
};

const ACCOUNTS_DATA = {
    accounts: [
        { id: 1, name: "TechCorp", industry: "Technology", revenue: 5000000, employees: 250, status: "Active" },
        { id: 2, name: "SalesInc", industry: "Sales & Marketing", revenue: 1200000, employees: 50, status: "Active" },
        { id: 3, name: "StartupHub", industry: "Venture Capital", revenue: 500000, employees: 15, status: "Lead" },
        { id: 4, name: "Enterprise Ltd", industry: "Enterprise Software", revenue: 15000000, employees: 500, status: "Active" },
        { id: 5, name: "Innovate LLC", industry: "Innovation", revenue: 3000000, employees: 100, status: "Active" }
    ]
};

/* --- SCHEMAS --- */

const dashboardSchema = {
    type: "page",
    props: { title: "Dashboard" },
    children: [
        {
            type: "div",
            className: "flex items-center justify-between mb-6",
            children: [
                {
                    type: "page:header",
                    props: { title: "Dashboard", description: "Overview of your business performance." },
                    className: "mb-0" 
                },
                {
                    type: "div",
                    className: "flex gap-2",
                    children: [
                         { type: "button", props: { variant: "outline", size: "sm", children: "Download Report" } },
                         { type: "button", props: { size: "sm", children: "Refresh" } }
                    ]
                }
            ]
        },
        {
            type: "grid",
            props: { cols: 4, gap: 4, className: "mb-8 mt-2" },
            children: [
                { type: "card", props: { title: "Total Revenue", description: "${data.revenueGrowth}" }, children: [{type: "text", content: "${data.revenue}", className: "text-2xl font-bold"}] },
                { type: "card", props: { title: "Subscriptions", description: "${data.subGrowth}" }, children: [{type: "text", content: "${data.subscriptions}", className: "text-2xl font-bold"}] },
                { type: "card", props: { title: "Sales", description: "${data.salesGrowth}" }, children: [{type: "text", content: "${data.sales}", className: "text-2xl font-bold"}] },
                { type: "card", props: { title: "Active Now", description: "+201 since last hour" }, children: [{type: "text", content: "+573", className: "text-2xl font-bold"}] },
            ]
        },
        {
            type: "grid",
            props: { cols: 7, gap: 4 },
            children: [
                { 
                    type: "page:card", 
                    props: { title: "Revenue Overview", className: "col-span-4" },
                    children: [{ type: "chart:bar", props: { 
                        data: "${data.overview}",
                        index: "name",
                        categories: ["total"],
                        colors: ["blue"]
                    }}] 
                },
                { 
                    type: "page:card", 
                    props: { title: "Recent Sales", description: "You made 265 sales this month.", className: "col-span-3" },
                    children: [
                        { type: "view:simple", children: [
                             { type: "div", className: "flex items-center justify-between py-3 border-b hover:bg-muted/50 px-2 rounded transition-colors", children: [
                                { type: "div", className: "flex items-center gap-3", children: [{type:"avatar", props:{fallback:"OM"}}, {type:"div", children:[{type:"text", content:"Olivia Martin", className:"font-medium block"}, {type:"text", content:"olivia.martin@email.com", className:"text-xs text-muted-foreground block"}]}] },
                                { type: "text", content: "+$1,999.00", className: "font-medium" }
                            ]},
                             { type: "div", className: "flex items-center justify-between py-3 border-b hover:bg-muted/50 px-2 rounded transition-colors", children: [
                                { type: "div", className: "flex items-center gap-3", children: [{type:"avatar", props:{fallback:"JL"}}, {type:"div", children:[{type:"text", content:"Jackson Lee", className:"font-medium block"}, {type:"text", content:"jackson.lee@email.com", className:"text-xs text-muted-foreground block"}]}] },
                                { type: "text", content: "+$39.00", className: "font-medium" }
                            ]},
                             { type: "div", className: "flex items-center justify-between py-3 border-b hover:bg-muted/50 px-2 rounded transition-colors", children: [
                                { type: "div", className: "flex items-center gap-3", children: [{type:"avatar", props:{fallback:"IN"}}, {type:"div", children:[{type:"text", content:"Isabella Nguyen", className:"font-medium block"}, {type:"text", content:"isabella.nguyen@email.com", className:"text-xs text-muted-foreground block"}]}] },
                                { type: "text", content: "+$299.00", className: "font-medium" }
                            ]},
                             { type: "div", className: "flex items-center justify-between py-3 border-b hover:bg-muted/50 px-2 rounded transition-colors", children: [
                                { type: "div", className: "flex items-center gap-3", children: [{type:"avatar", props:{fallback:"WK"}}, {type:"div", children:[{type:"text", content:"William Kim", className:"font-medium block"}, {type:"text", content:"will@email.com", className:"text-xs text-muted-foreground block"}]}] },
                                { type: "text", content: "+$99.00", className: "font-medium" }
                            ]},
                             { type: "div", className: "flex items-center justify-between py-3 hover:bg-muted/50 px-2 rounded transition-colors", children: [
                                { type: "div", className: "flex items-center gap-3", children: [{type:"avatar", props:{fallback:"SD"}}, {type:"div", children:[{type:"text", content:"Sofia Davis", className:"font-medium block"}, {type:"text", content:"sofia.davis@email.com", className:"text-xs text-muted-foreground block"}]}] },
                                { type: "text", content: "+$39.00", className: "font-medium" }
                            ]},
                        ]}
                    ]
                }
            ]
        }
    ]
};

const contactsSchema = {
    type: "page",
    props: { title: "Contacts" },
    children: [
        {
            type: "page:header",
            props: { title: "Contacts", description: "Manage your customers and leads." },
            children: [
                { type: "button", props: { children: "New Contact" } }
            ]
        },
        {
            type: "page:card",
            className: "mt-6",
            children: [
                {
                    type: "view:grid",
                    bind: "contacts",
                    props: {
                        columns: [
                            { key: "name", label: "Name", type: "text" },
                            { key: "company", label: "Company", type: "text" },
                            { key: "email", label: "Email", type: "text" },
                            { key: "status", label: "Status", type: "text" }
                        ]
                    }
                }
            ]
        }
    ]
};

const opportunitiesSchema = {
    type: "page",
    props: { title: "Opportunities" },
    children: [
        {
            type: "page:header",
            props: { title: "Opportunities", description: "View and track sales deals." },
            children: [
                { type: "button", props: { children: "New Opportunity", size: "sm" } }
            ]
        },
        {
            type: "page:card",
            className: "mt-6",
            children: [
                {
                    type: "view:grid",
                    bind: "opportunities",
                    props: {
                        columns: [
                            { key: "name", label: "Deal Name", type: "text" },
                            { key: "contact", label: "Contact", type: "text" },
                            { key: "stage", label: "Stage", type: "text" },
                            { key: "amount", label: "Amount ($)", type: "number" },
                            { key: "probability", label: "Probability", type: "text" },
                            { key: "closeDate", label: "Close Date", type: "text" }
                        ]
                    }
                }
            ]
        }
    ]
};

const settingsSchema = {
    type: "page",
    props: { title: "Settings" },
    children: [
        {
            type: "page:header",
            props: { title: "Settings", description: "Manage your account settings and preferences." }
        },
        {
            type: "div",
            className: "grid grid-cols-1 md:grid-cols-3 gap-8 mt-6",
            children: [
                {
                    type: "div",
                    className: "col-span-1",
                    children: [
                        { type: "text", content: "Profile Information", className: "text-lg font-semibold block mb-2" },
                        { type: "text", content: "Update your account's profile information and email address.", className: "text-sm text-muted-foreground" },
                        { 
                            type: "div", 
                            className: "mt-4 flex flex-col gap-1",
                            children: [
                                { type: "button", props: { variant: "ghost", className: "justify-start font-semibold bg-muted", children: "General" } },
                                { type: "button", props: { variant: "ghost", className: "justify-start", children: "Security" } },
                                { type: "button", props: { variant: "ghost", className: "justify-start", children: "Billing" } },
                                { type: "button", props: { variant: "ghost", className: "justify-start", children: "Notifications" } },
                            ]
                        }
                    ]
                },
                {
                    type: "page:card",
                    className: "col-span-2",
                    children: [
                        {
                            type: "div", // Using div as form container for now
                            className: "space-y-4",
                            children: [
                                { type: "field:text", props: { label: "Username", defaultValue: "${data.profile.name}", description: "This is your public display name." } },
                                { type: "field:text", props: { label: "Email", defaultValue: "${data.profile.email}", description: "Please enter a valid email address." } },
                                { type: "field:text", props: { label: "Role", defaultValue: "${data.profile.role}", readonly: true, disabled: true } },
                                { type: "div", className: "pt-4 flex justify-end", children: [
                                    { type: "button", props: { children: "Save Changes" } }
                                ]}
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

const SETTINGS_DATA = {
    profile: {
        name: "Admin User",
        email: "admin@objectui.dev",
        role: "Administrator",
        notifications: true
    }
};

const accountsSchema = {
    type: "page",
    props: { title: "Accounts" },
    children: [
        {
            type: "page:header",
            props: { title: "Accounts", description: "Manage your business accounts and companies." },
            children: [
                { type: "button", props: { children: "New Account", size: "sm" } }
            ]
        },
        {
            type: "page:card",
            className: "mt-6",
            children: [
                {
                    type: "view:grid",
                    bind: "accounts",
                    props: {
                        columns: [
                            { key: "name", label: "Account Name", type: "text" },
                            { key: "industry", label: "Industry", type: "text" },
                            { key: "revenue", label: "Annual Revenue ($)", type: "number" },
                            { key: "employees", label: "Employees", type: "number" },
                            { key: "status", label: "Status", type: "text" }
                        ]
                    }
                }
            ]
        }
    ]
};

/* --- APP COMPONENT --- */

const CRMStoryApp = () => {
    const [activePage, setActivePage] = useState("dashboard");

    const renderContent = () => {
        switch(activePage) {
            case "dashboard":
                return <SchemaRendererProvider dataSource={DASHBOARD_DATA}><SchemaRenderer schema={dashboardSchema} /></SchemaRendererProvider>;
            case "contacts":
                return <SchemaRendererProvider dataSource={CONTACTS_DATA}><SchemaRenderer schema={contactsSchema} /></SchemaRendererProvider>;
            case "accounts":
                return <SchemaRendererProvider dataSource={ACCOUNTS_DATA}><SchemaRenderer schema={accountsSchema} /></SchemaRendererProvider>;
            case "opportunities":
                return <SchemaRendererProvider dataSource={OPPORTUNITIES_DATA}><SchemaRenderer schema={opportunitiesSchema} /></SchemaRendererProvider>;
            case "settings":
                return <SchemaRendererProvider dataSource={SETTINGS_DATA}><SchemaRenderer schema={settingsSchema} /></SchemaRendererProvider>;
            default:
                return (
                    <div className="p-8">
                       <h2 className="text-2xl font-bold">Work in progress</h2>
                       <p className="text-muted-foreground mt-2">This page ({activePage}) is under construction.</p>
                    </div>
                );
        }
    };

    return (
        <SidebarProvider>
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <div className="flex items-center gap-2 px-2 py-3 text-sidebar-foreground">
                        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <GalleryVerticalEnd className="size-4" />
                        </div>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-semibold">Object UI</span>
                            <span className="truncate text-xs">CRM Demo</span>
                        </div>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Platform</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuButton 
                                    isActive={activePage === "dashboard"} 
                                    onClick={() => setActivePage("dashboard")}
                                    tooltip="Dashboard"
                                >
                                    <LayoutDashboard />
                                    <span>Dashboard</span>
                                </SidebarMenuButton>
                                <SidebarMenuButton 
                                    isActive={activePage === "contacts"} 
                                    onClick={() => setActivePage("contacts")}
                                    tooltip="Contacts"
                                >
                                    <Users />
                                    <span>Contacts</span>
                                </SidebarMenuButton>
                                <SidebarMenuButton 
                                    isActive={activePage === "accounts"} 
                                    onClick={() => setActivePage("accounts")}
                                    tooltip="Accounts"
                                >
                                    <Building2 />
                                    <span>Accounts</span>
                                </SidebarMenuButton>
                                <SidebarMenuButton 
                                    isActive={activePage === "opportunities"} 
                                    onClick={() => setActivePage("opportunities")}
                                    tooltip="Opportunities"
                                >
                                    <TrendingUp />
                                    <span>Opportunities</span>
                                </SidebarMenuButton>
                                <SidebarMenuButton 
                                    isActive={activePage === "settings"} 
                                    onClick={() => setActivePage("settings")}
                                    tooltip="Settings"
                                >
                                    <Settings />
                                    <span>Settings</span>
                                </SidebarMenuButton>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>

            <div className="flex flex-1 flex-col h-screen overflow-hidden bg-gray-50/50">
               <div className="flex-1 overflow-y-auto p-4 md:p-8">
                   {renderContent()}
               </div>
            </div>
        </SidebarProvider>
    );
};

const meta: Meta = {
  title: 'Apps/CRM',
  component: CRMStoryApp,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const Default: StoryObj = {};
