# HotCRM Console Integration Example

This document provides a complete working example of integrating `@object-ui/plugin-console` into the HotCRM project.

---

## Project Structure

```
hotcrm/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.tsx              # Application entry
│   ├── App.tsx               # Main app component
│   ├── config.ts             # HotCRM configuration
│   ├── datasource.ts         # Data source setup
│   ├── components/           # Custom HotCRM components
│   │   ├── Dashboard.tsx
│   │   ├── SalesAnalytics.tsx
│   │   └── CustomerTimeline.tsx
│   └── plugins/              # HotCRM-specific plugins
│       ├── crm/
│       ├── finance/
│       └── marketing/
└── public/
    └── hotcrm-logo.svg
```

---

## Step 1: Package Configuration

### package.json

```json
{
  "name": "hotcrm",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@object-ui/plugin-console": "^2.0.0",
    "@object-ui/plugin-grid": "^2.0.0",
    "@object-ui/plugin-kanban": "^2.0.0",
    "@object-ui/plugin-dashboard": "^2.0.0",
    "@object-ui/plugin-calendar": "^2.0.0",
    "@object-ui/plugin-charts": "^2.0.0",
    "@object-ui/core": "^2.0.0",
    "@object-ui/react": "^2.0.0",
    "@object-ui/components": "^2.0.0",
    "@object-ui/auth": "^2.0.0",
    "@object-ui/i18n": "^2.0.0",
    "@objectstack/client": "^3.0.0",
    "@objectstack/spec": "^3.0.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.13",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^5.1.3",
    "typescript": "^5.9.3",
    "vite": "^6.0.11"
  }
}
```

---

## Step 2: Vite Configuration

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@hotcrm/crm': resolve(__dirname, './src/plugins/crm'),
      '@hotcrm/finance': resolve(__dirname, './src/plugins/finance'),
      '@hotcrm/marketing': resolve(__dirname, './src/plugins/marketing'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-objectui': [
            '@object-ui/core',
            '@object-ui/react',
            '@object-ui/components',
          ],
          'plugins': [
            '@object-ui/plugin-grid',
            '@object-ui/plugin-kanban',
            '@object-ui/plugin-dashboard',
          ],
        },
      },
    },
  },
});
```

---

## Step 3: TypeScript Configuration

### tsconfig.json

```json
{
  "extends": "@object-ui/tsconfig/react.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@hotcrm/crm": ["./src/plugins/crm"],
      "@hotcrm/finance": ["./src/plugins/finance"],
      "@hotcrm/marketing": ["./src/plugins/marketing"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

## Step 4: Application Entry

### src/main.tsx

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Import ObjectUI plugins
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import '@object-ui/plugin-calendar';
import '@object-ui/plugin-dashboard';
import '@object-ui/plugin-charts';

// Import HotCRM plugins (these will register custom components)
import './plugins/crm';
import './plugins/finance';
import './plugins/marketing';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

## Step 5: Main Application Component

### src/App.tsx (Option A - Full Console App)

```typescript
import { ConsoleApp } from '@object-ui/plugin-console/app';
import { hotcrmConfig } from './config';
import { createHotCRMDataSource } from './datasource';
import './App.css';

function App() {
  const dataSource = createHotCRMDataSource();

  return (
    <ConsoleApp 
      appConfig={hotcrmConfig}
      dataSource={dataSource}
      basename="/"
    />
  );
}

export default App;
```

### src/App.tsx (Option B - Custom Integration)

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { I18nProvider } from '@object-ui/i18n';
import { AuthProvider } from '@object-ui/auth';
import { SchemaRendererProvider } from '@object-ui/react';
import { 
  ConsoleLayout, 
  ObjectView,
  DashboardView,
  ErrorBoundary
} from '@object-ui/plugin-console';

import { hotcrmConfig } from './config';
import { createHotCRMDataSource } from './datasource';
import { HotCRMDashboard } from './components/Dashboard';
import { SalesAnalytics } from './components/SalesAnalytics';
import './App.css';

function App() {
  const dataSource = createHotCRMDataSource();

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider config={hotcrmConfig.auth}>
            <SchemaRendererProvider dataSource={dataSource}>
              <ConsoleLayout appConfig={hotcrmConfig}>
                <Routes>
                  {/* Home redirects to dashboard */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  
                  {/* Custom HotCRM Dashboard */}
                  <Route path="/dashboard" element={<HotCRMDashboard />} />
                  
                  {/* Sales Analytics (custom) */}
                  <Route path="/sales/analytics" element={<SalesAnalytics />} />
                  
                  {/* Object views (using console component) */}
                  <Route 
                    path="/:app/objects/:objectName" 
                    element={<ObjectView />} 
                  />
                  
                  {/* Dashboard views (using console component) */}
                  <Route 
                    path="/dashboards/:dashboardId" 
                    element={<DashboardView />} 
                  />
                  
                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </ConsoleLayout>
            </SchemaRendererProvider>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
```

---

## Step 6: HotCRM Configuration

### src/config.ts

```typescript
import type { ObjectStackConfig } from '@objectstack/spec';

// Import plugin metadata
import { CRMPlugin } from '@hotcrm/crm';
import { FinancePlugin } from '@hotcrm/finance';
import { MarketingPlugin } from '@hotcrm/marketing';

const plugins = [CRMPlugin, FinancePlugin, MarketingPlugin];

/**
 * HotCRM Application Configuration
 */
export const hotcrmConfig: ObjectStackConfig = {
  // Branding
  branding: {
    name: 'HotCRM',
    logo: '/hotcrm-logo.svg',
    favicon: '/favicon.ico',
    primaryColor: '#FF6B35',
    secondaryColor: '#004E89',
  },

  // Applications (extracted from plugins)
  apps: [
    {
      name: 'crm',
      label: 'CRM',
      icon: 'users',
      isDefault: true,
      active: true,
    },
    {
      name: 'sales',
      label: 'Sales',
      icon: 'trending-up',
      active: true,
    },
    {
      name: 'marketing',
      label: 'Marketing',
      icon: 'megaphone',
      active: true,
    },
    {
      name: 'finance',
      label: 'Finance',
      icon: 'dollar-sign',
      active: true,
    },
    {
      name: 'support',
      label: 'Support',
      icon: 'headphones',
      active: true,
    },
    ...plugins.flatMap(p => p.apps || []),
  ],

  // Objects (extracted from plugins)
  objects: plugins.flatMap(plugin => 
    Object.values(plugin.objects || {})
  ),

  // Navigation
  navigation: [
    {
      label: 'Dashboard',
      icon: 'layout-dashboard',
      href: '/dashboard',
    },
    {
      label: 'CRM',
      icon: 'users',
      children: [
        { label: 'Contacts', href: '/crm/objects/contacts' },
        { label: 'Accounts', href: '/crm/objects/accounts' },
        { label: 'Leads', href: '/crm/objects/leads' },
        { label: 'Opportunities', href: '/crm/objects/opportunities' },
      ],
    },
    {
      label: 'Sales',
      icon: 'trending-up',
      children: [
        { label: 'Analytics', href: '/sales/analytics' },
        { label: 'Deals', href: '/sales/objects/deals' },
        { label: 'Quotes', href: '/sales/objects/quotes' },
        { label: 'Orders', href: '/sales/objects/orders' },
      ],
    },
    {
      label: 'Marketing',
      icon: 'megaphone',
      children: [
        { label: 'Campaigns', href: '/marketing/objects/campaigns' },
        { label: 'Emails', href: '/marketing/objects/emails' },
        { label: 'Events', href: '/marketing/objects/events' },
      ],
    },
    {
      label: 'Finance',
      icon: 'dollar-sign',
      children: [
        { label: 'Invoices', href: '/finance/objects/invoices' },
        { label: 'Payments', href: '/finance/objects/payments' },
        { label: 'Reports', href: '/finance/reports' },
      ],
    },
  ],

  // Authentication
  auth: {
    providers: ['email', 'google', 'microsoft'],
    enableRegistration: false,
    requireEmailVerification: true,
  },

  // Features
  features: {
    enableDesigner: false,
    enableAuditLog: true,
    enableNotifications: true,
    enableSearch: true,
  },

  // Permissions
  permissions: {
    defaultRole: 'user',
    roles: [
      { name: 'admin', label: 'Administrator' },
      { name: 'manager', label: 'Manager' },
      { name: 'user', label: 'User' },
      { name: 'guest', label: 'Guest' },
    ],
  },
};
```

---

## Step 7: Data Source Setup

### src/datasource.ts

```typescript
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import type { DataSource } from '@object-ui/types';

/**
 * Create HotCRM data source
 */
export function createHotCRMDataSource(): DataSource {
  const adapter = new ObjectStackAdapter({
    baseUrl: import.meta.env.VITE_API_URL || '/api',
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
    cache: {
      maxSize: 100,
      ttl: 5 * 60 * 1000, // 5 minutes
    },
  });

  // Initialize connection
  adapter.connect().catch(err => {
    console.error('[HotCRM] Failed to connect to data source:', err);
  });

  // Monitor connection state
  adapter.onConnectionStateChange((event) => {
    console.log('[HotCRM] Connection state:', event.state);
    if (event.error) {
      console.error('[HotCRM] Connection error:', event.error);
    }
  });

  return adapter;
}
```

---

## Step 8: Custom Components

### src/components/Dashboard.tsx

```typescript
import { useState, useEffect } from 'react';
import { useDataSource } from '@object-ui/react';
import { Card, CardHeader, CardTitle, CardContent } from '@object-ui/components';
import { MetricCard } from '@object-ui/plugin-dashboard';
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react';

export function HotCRMDashboard() {
  const dataSource = useDataSource();
  const [metrics, setMetrics] = useState({
    totalContacts: 0,
    activeDeals: 0,
    revenue: 0,
    conversions: 0,
  });

  useEffect(() => {
    // Fetch dashboard metrics
    async function loadMetrics() {
      try {
        const [contacts, deals, revenue] = await Promise.all([
          dataSource.find({ object: 'contacts', filters: [] }),
          dataSource.find({ object: 'deals', filters: [{ field: 'status', operator: 'eq', value: 'active' }] }),
          dataSource.aggregate({ object: 'deals', field: 'amount', operation: 'sum' }),
        ]);

        setMetrics({
          totalContacts: contacts.data?.length || 0,
          activeDeals: deals.data?.length || 0,
          revenue: revenue.result || 0,
          conversions: 42, // Calculate from analytics
        });
      } catch (error) {
        console.error('[Dashboard] Failed to load metrics:', error);
      }
    }

    loadMetrics();
  }, [dataSource]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">HotCRM Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your overview.</p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Contacts"
          value={metrics.totalContacts.toLocaleString()}
          icon="users"
          trend="up"
          trendValue="+12.5%"
          description="vs. last month"
        />
        
        <MetricCard
          title="Active Deals"
          value={metrics.activeDeals.toLocaleString()}
          icon="trending-up"
          trend="up"
          trendValue="+8.2%"
          description="in pipeline"
        />
        
        <MetricCard
          title="Revenue"
          value={`$${(metrics.revenue / 1000).toFixed(1)}k`}
          icon="dollar-sign"
          trend="up"
          trendValue="+23.1%"
          description="this quarter"
        />
        
        <MetricCard
          title="Conversion Rate"
          value={`${metrics.conversions}%`}
          icon="activity"
          trend="down"
          trendValue="-2.4%"
          description="vs. last week"
        />
      </div>

      {/* Charts and Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Activity feed */}
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Opportunities</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Opportunities list */}
            <p className="text-sm text-muted-foreground">No opportunities</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Step 9: Plugin Integration

### src/plugins/crm/index.ts

```typescript
import { ComponentRegistry } from '@object-ui/core';
import type { ObjectDefinition } from '@objectstack/spec';

/**
 * CRM Plugin - Contacts, Accounts, Leads, Opportunities
 */

export const CRMPlugin = {
  name: 'crm',
  version: '1.0.0',
  
  apps: [
    {
      name: 'crm',
      label: 'CRM',
      icon: 'users',
      isDefault: true,
    },
  ],
  
  objects: {
    contacts: {
      name: 'contacts',
      label: 'Contacts',
      pluralLabel: 'Contacts',
      icon: 'user',
      fields: [
        { name: 'firstName', type: 'text', label: 'First Name', required: true },
        { name: 'lastName', type: 'text', label: 'Last Name', required: true },
        { name: 'email', type: 'email', label: 'Email', required: true, unique: true },
        { name: 'phone', type: 'phone', label: 'Phone' },
        { name: 'company', type: 'lookup', label: 'Company', reference: 'accounts' },
        { name: 'title', type: 'text', label: 'Job Title' },
        { name: 'status', type: 'select', label: 'Status', options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ]},
      ],
      views: [
        {
          name: 'all',
          label: 'All Contacts',
          type: 'grid',
          isDefault: true,
        },
        {
          name: 'active',
          label: 'Active Contacts',
          type: 'grid',
          filters: [{ field: 'status', operator: 'eq', value: 'active' }],
        },
      ],
    } as ObjectDefinition,
    
    accounts: {
      name: 'accounts',
      label: 'Account',
      pluralLabel: 'Accounts',
      icon: 'building',
      fields: [
        { name: 'name', type: 'text', label: 'Account Name', required: true },
        { name: 'industry', type: 'select', label: 'Industry', options: [
          { label: 'Technology', value: 'tech' },
          { label: 'Finance', value: 'finance' },
          { label: 'Healthcare', value: 'healthcare' },
        ]},
        { name: 'website', type: 'url', label: 'Website' },
        { name: 'employees', type: 'number', label: 'Employees' },
      ],
      views: [
        {
          name: 'all',
          label: 'All Accounts',
          type: 'grid',
          isDefault: true,
        },
      ],
    } as ObjectDefinition,
  },
};

// Register custom CRM components if needed
// ComponentRegistry.register('crm-timeline', CRMTimelineComponent, { ... });
```

---

## Step 10: Styling

### src/App.css

```css
/* HotCRM-specific styles */
:root {
  --hotcrm-primary: #FF6B35;
  --hotcrm-secondary: #004E89;
}

/* Override console theme if needed */
.console-layout {
  --primary: var(--hotcrm-primary);
}

/* Custom dashboard styles */
.hotcrm-dashboard {
  /* ... */
}
```

---

## Step 11: Environment Configuration

### .env.development

```env
VITE_API_URL=http://localhost:8080/api
VITE_USE_MOCK_SERVER=false
```

### .env.production

```env
VITE_API_URL=https://api.hotcrm.com
```

---

## Step 12: Build and Run

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

---

## Summary

This example demonstrates three integration approaches:

1. **Full Console App** (Option A in App.tsx)
   - Quickest integration
   - Complete console functionality
   - Minimal customization

2. **Custom Integration** (Option B in App.tsx)
   - Mix console and custom components
   - Full routing control
   - Moderate customization

3. **Component-Level** (Dashboard.tsx)
   - Maximum flexibility
   - Use console components where needed
   - Full customization

Choose the approach that best fits your needs!

---

*Last Updated: 2026-02-13*
