# @objectstack/client Evaluation for Low-Code App UI Development

> **Date:** February 11, 2026  
> **Spec Version:** @objectstack/spec v3.0.0  
> **Client Version:** @objectstack/client v3.0.0  
> **Auth Plugin Version:** @objectstack/plugin-auth v3.0.0  
> **ObjectUI Version:** v0.5.x  
> **Scope:** Evaluate whether @objectstack/client can fully support developing a complete low-code application UI based on the @objectstack/spec protocol

---

## 1. Executive Summary

**Verdict: ✅ Fully Capable — @objectstack/client provides all the runtime primitives necessary to build a complete low-code app UI based on @objectstack/spec.**

The @objectstack/spec protocol defines the "constitution" — the canonical type definitions for Data, UI, System, AI, API, and more. The @objectstack/client v3.0.0 package provides the runtime bridge to ObjectStack backends with 13/13 API namespaces (100%), 95+ protocol methods, full batch operations support, ETag caching, and comprehensive error handling. Combined with ObjectUI's existing 35 packages and 91+ components, the full low-code app UI surface can be implemented. The client is fully compliant with @objectstack/spec v3.0.0.

This document evaluates each protocol domain, maps it to @objectstack/client capabilities, identifies gaps, and proposes a concrete action plan.

---

## 2. Protocol Domain Coverage Analysis

### 2.1 Data Layer — @objectstack/client Data API

The @objectstack/spec `Data` namespace defines object schemas, field types, relationships, and query semantics. The client SDK provides:

| Capability | Client API | Status | Notes |
|------------|-----------|--------|-------|
| **CRUD Operations** | `client.data.find/get/create/update/delete` | ✅ Complete | Wrapped by `ObjectStackAdapter` |
| **Bulk Operations** | `client.data.createMany/deleteMany` | ✅ Complete | `updateMany` via fallback |
| **Query Filtering** | `QueryOptions.filters` (FilterNode AST) | ✅ Complete | Converted from OData-style params |
| **Sorting** | `QueryOptions.sort` | ✅ Complete | Supports multi-field sort |
| **Pagination** | `QueryOptions.skip/top` | ✅ Complete | Cursor-based pagination possible |
| **Field Selection** | `QueryOptions.select` | ✅ Complete | Projection support |
| **Relationships (JOIN)** | Via ObjectQL query syntax | ✅ Complete | Nested expand/include |
| **Aggregation** | ObjectQL aggregate functions | ✅ Complete | SUM, AVG, COUNT, etc. |
| **Subqueries** | ObjectQL subquery support | ✅ Complete | Nested query conditions |
| **Real-time Subscriptions** | `client.realtime.*` (connect, subscribe) | ✅ Complete | WebSocket via client v3.0.0 |
| **Offline Sync** | Service Worker + local cache | ✅ Complete | ETag caching in client v3.0.0 |
| **File/Blob Storage** | `client.storage.upload()` | ✅ Complete | Storage namespace in client v3.0.0 |

**Data Layer Assessment: 100% — Core CRUD, queries, bulk ops, real-time subscriptions, offline caching, and file storage are fully covered in @objectstack/client v3.0.0.**

### 2.2 Metadata Layer — Schema-Driven UI

The @objectstack/spec protocol is fundamentally metadata-driven. The client v3.0.0 provides 13/13 API namespaces including storage and notifications:

| Capability | Client API | Status | Notes |
|------------|-----------|--------|-------|
| **Object Schema Retrieval** | `client.meta.getObject(name)` | ✅ Complete | With MetadataCache |
| **View Definition Retrieval** | `client.meta.getItem(object, 'views/id')` | ✅ Complete | Adapter `getView()` |
| **App Definition Retrieval** | `client.meta.getItem('apps', id)` | ✅ Complete | Adapter `getApp()` |
| **Field Metadata** | Part of object schema | ✅ Complete | 35+ field types supported |
| **List View Config** | Part of object schema | ✅ Complete | Columns, filters, sort |
| **Dynamic Schema Loading** | Fetch + render at runtime | ✅ Complete | SchemaRenderer pipeline |
| **Schema Validation** | @object-ui/core Validation | ✅ Complete | Zod-based validators |
| **Schema Caching** | MetadataCache (TTL + LRU) | ✅ Complete | Configurable max/TTL |
| **Hot Schema Reload** | Cache invalidation + re-fetch | ✅ Complete | `invalidateCache()` |
| **Dashboard Definitions** | Via app/stack metadata | ✅ Complete | `defineStack({ dashboards })` |
| **Report Definitions** | Via app/stack metadata | ✅ Complete | `defineStack({ reports })` |
| **Storage Metadata** | `client.storage.*` | ✅ Complete | File upload/download via v3.0.0 |
| **Notifications Metadata** | `client.notifications.*` | ✅ Complete | Device registration, preferences via v3.0.0 |

**Metadata Layer Assessment: 100% — Full schema-driven architecture is supported.**

### 2.3 UI Rendering — Component Mapping

The @objectstack/spec `UI` namespace defines view types. ObjectUI maps these to React components:

| Spec View Type | ObjectUI Package | Client Dependency | Status |
|---------------|-----------------|-------------------|--------|
| **ListView** | `plugin-grid`, `plugin-aggrid` | `data.find()` | ✅ Complete |
| **DetailView** | `plugin-detail` | `data.get()` | ✅ Complete |
| **FormView** | `plugin-form` (6 variants) | `data.create/update()` | ✅ Complete |
| **KanbanView** | `plugin-kanban` | `data.find()` + `data.update()` | ✅ Complete |
| **CalendarView** | `plugin-calendar` | `data.find()` | ✅ Complete |
| **GanttView** | `plugin-gantt` | `data.find()` | ✅ Complete |
| **TimelineView** | `plugin-timeline` | `data.find()` | ✅ Complete |
| **MapView** | `plugin-map` | `data.find()` | ✅ Complete |
| **DashboardView** | `plugin-dashboard` | Aggregation queries | ✅ Complete |
| **ChartView** | `plugin-charts` | Aggregation queries | ✅ Complete |
| **EditorView** | `plugin-editor` | `data.get/update()` | ✅ Complete |
| **MarkdownView** | `plugin-markdown` | Static/dynamic content | ✅ Complete |
| **ChatbotView** | `plugin-chatbot` | AI API integration | ✅ Complete |

**UI Rendering Assessment: 100% — All spec-defined view types have corresponding implementations.**

### 2.4 Action System

The @objectstack/spec defines `ActionSchema` with 5 action types:

| Action Type | Implementation | Client Dependency | Status |
|------------|---------------|-------------------|--------|
| **script** | Expression evaluator | None (client-side) | ✅ Complete |
| **url** | Navigation/redirect | None (client-side) | ✅ Complete |
| **modal** | Dialog/Sheet/Drawer | None (client-side) | ✅ Complete |
| **flow** | Workflow engine | `data.*` for state | ✅ Complete |
| **api** | HTTP request execution | `client.data.*` or custom fetch | ✅ Complete |
| **Batch Operations** | BatchOperationConfig | `data.createMany/deleteMany` | ✅ Complete |
| **Transactions** | TransactionConfig | Server-side transaction | ⚠️ Partial |
| **Undo/Redo** | UndoRedoConfig | Client-side state | ✅ Complete |

**Action System Assessment: 95% — Full action types supported. Server-side transactions depend on backend capability.**

### 2.5 Authentication & Authorization

| Capability | Implementation | Client Dependency | Status |
|------------|---------------|-------------------|--------|
| **Server-Side Auth** | `@objectstack/plugin-auth` (AuthPlugin) | ObjectKernel plugin | ✅ Complete |
| **Token Authentication** | `ObjectStackAdapter({ token })` | Client constructor | ✅ Complete |
| **Dynamic Token Injection** | `ObjectStackAdapter({ fetch })` | Custom fetch wrapper | ✅ Complete |
| **Session Management** | `@object-ui/auth` (AuthProvider) | better-auth integration | ✅ Complete |
| **Route Guards** | `AuthGuard` component | Session check | ✅ Complete |
| **RBAC** | `@object-ui/permissions` | Server-side role data | ✅ Complete |
| **Field-Level Permissions** | FieldLevelPermission type | Metadata-driven | ✅ Complete |
| **Row-Level Security** | RowLevelPermission type | Server-filtered queries | ✅ Complete |
| **OAuth/SSO** | better-auth plugins | External auth providers | ✅ Complete |
| **Multi-Factor Auth** | better-auth 2FA plugin | External auth providers | ✅ Available |

**Auth Assessment: 100% — Full auth stack is implemented. Server-side via @objectstack/plugin-auth (better-auth powered, ObjectQL persistence). Client-side via @object-ui/auth + better-auth.**

### 2.6 Multi-Tenancy

| Capability | Implementation | Client Dependency | Status |
|------------|---------------|-------------------|--------|
| **Tenant Context** | `@object-ui/tenant` (TenantProvider) | X-Tenant-ID header | ✅ Complete |
| **Tenant Isolation** | Scoped queries | Server-side filtering | ✅ Complete |
| **Tenant Branding** | TenantBranding config | Metadata API | ✅ Complete |
| **Tenant Switching** | TenantGuard + switcher UI | Session update | ✅ Complete |
| **Tenant Limits** | TenantLimits config | Server enforcement | ✅ Complete |

**Multi-Tenancy Assessment: 100% — Full multi-tenant support via @object-ui/tenant.**

### 2.7 Advanced Features

| Capability | Implementation | Client Dependency | Status |
|------------|---------------|-------------------|--------|
| **Workflow Engine** | `plugin-workflow` | `data.*` for state | ✅ Complete |
| **AI Integration** | `plugin-ai` | AI API endpoints | ✅ Complete |
| **Report Export** | `plugin-report` (PDF/Excel/CSV) | `data.find()` for data | ✅ Complete |
| **i18n** | `@object-ui/i18n` (10+ languages) | None (client-side) | ✅ Complete |
| **Theme System** | Theme Provider + CSS variables | None (client-side) | ✅ Complete |
| **Expression Engine** | `@object-ui/core` evaluator | None (client-side) | ✅ Complete |
| **Visual Designer** | `plugin-designer` | Metadata save/load | ✅ Complete |
| **Real-time Collaboration** | `client.realtime.*` | WebSocket channels | ✅ Complete |
| **Offline Support** | ETag caching + Service Worker | `client` ETag support | ✅ Complete |

**Advanced Features Assessment: 100% — All features complete including real-time and offline support via @objectstack/client v3.0.0.**

---

## 3. End-to-End Low-Code App Flow

A complete low-code app built on @objectstack/spec follows this data flow:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Low-Code App Architecture                         │
│                                                                      │
│  ┌──────────────┐  defineStack()    ┌─────────────────────────────┐ │
│  │ objectstack.  │─────────────────▷│  @objectstack/spec          │ │
│  │ config.ts     │  (manifest,      │  (Protocol Types)           │ │
│  │               │   objects, apps,  │  Data, UI, System, AI, ... │ │
│  └──────┬───────┘   workflows)      └─────────────────────────────┘ │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────┐                   ┌─────────────────────────────┐ │
│  │ ObjectStack   │  connect + CRUD  │  @objectstack/client        │ │
│  │ Adapter       │─────────────────▷│  (Runtime SDK)              │ │
│  │ (data-        │  meta.getObject  │  data.find/get/create/...   │ │
│  │  objectstack) │  meta.getItem    │  meta.getObject/getItem     │ │
│  └──────┬───────┘                   └─────────────────────────────┘ │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   ObjectStack Server                          │   │
│  │                                                               │   │
│  │  ObjectKernel                                                 │   │
│  │    ├── ObjectQLPlugin     (query engine)                      │   │
│  │    ├── DriverPlugin       (data storage)                      │   │
│  │    ├── AuthPlugin         (@objectstack/plugin-auth)          │   │
│  │    │     └── better-auth  (session, OAuth, 2FA, passkeys)     │   │
│  │    ├── HonoServerPlugin   (HTTP /api/v1/*)                    │   │
│  │    └── AppPlugin          (stack config)                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    ObjectUI Runtime                           │   │
│  │                                                               │   │
│  │  AuthProvider → PermissionProvider → TenantProvider            │   │
│  │       → ExpressionProvider → SchemaRenderer                   │   │
│  │                                                               │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐     │   │
│  │  │  Grid   │ │  Form    │ │ Kanban   │ │  Dashboard   │     │   │
│  │  │ (List)  │ │ (Detail) │ │ (Board)  │ │  (Charts)    │     │   │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────────┘     │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐     │   │
│  │  │Calendar │ │  Gantt   │ │   Map    │ │  Workflow    │     │   │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────────┘     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Complete Feature Mapping

| Low-Code Feature | Spec Protocol | Client API | UI Package | Feasible |
|-----------------|--------------|-----------|-----------|----------|
| **Object Modeling** | `Data.ObjectSchema` | `meta.getObject()` | Schema-driven | ✅ Yes |
| **Field Configuration** | `Data.Field` (35+ types) | Part of object schema | `@object-ui/fields` | ✅ Yes |
| **List/Grid Views** | `UI.ListView` | `data.find()` | `plugin-grid/aggrid` | ✅ Yes |
| **Form Builder** | `UI.FormView` | `data.create/update()` | `plugin-form` | ✅ Yes |
| **Detail Pages** | `UI.DetailView` | `data.get()` | `plugin-detail` | ✅ Yes |
| **Dashboard Builder** | `UI.DashboardView` | Aggregation queries | `plugin-dashboard` | ✅ Yes |
| **Kanban Boards** | `UI.KanbanView` | `data.find/update()` | `plugin-kanban` | ✅ Yes |
| **Calendar Views** | `UI.CalendarView` | `data.find()` | `plugin-calendar` | ✅ Yes |
| **Gantt Charts** | `UI.GanttView` | `data.find()` | `plugin-gantt` | ✅ Yes |
| **Map Views** | `UI.MapView` | `data.find()` | `plugin-map` | ✅ Yes |
| **Report Builder** | `ReportSchema` | `data.find()` | `plugin-report` | ✅ Yes |
| **Workflow Designer** | `WorkflowSchema` | `data.*` for state | `plugin-workflow` | ✅ Yes |
| **Page Designer** | `Studio.PageDesigner` | `meta.getItem()` save/load | `plugin-designer` | ✅ Yes |
| **App Navigation** | `App.create()` | Stack config | `@object-ui/layout` | ✅ Yes |
| **Expression Engine** | `Shared.Expression` | None (client-side) | `@object-ui/core` | ✅ Yes |
| **Validation Rules** | `Data.Validation` | Server + client-side | `@object-ui/core` | ✅ Yes |
| **Permissions/RBAC** | `Security.RBAC` | Role data from server | `@object-ui/permissions` | ✅ Yes |
| **Multi-Tenancy** | `System.Tenant` | X-Tenant-ID header | `@object-ui/tenant` | ✅ Yes |
| **Authentication** | `Identity.Auth` | Token via custom fetch | `@object-ui/auth` + `@objectstack/plugin-auth` | ✅ Yes |
| **i18n** | `Shared.i18n` | None (client-side) | `@object-ui/i18n` | ✅ Yes |
| **Theming** | `UI.Theme` | None (client-side) | Theme Provider | ✅ Yes |
| **AI Assistance** | `AI.Config` | AI API endpoints | `plugin-ai` | ✅ Yes |
| **Real-time Collab** | `Hub.WebSocket` | `client.realtime.*` | `plugin-collaboration` | ✅ Yes |
| **Offline Mode** | `System.Offline` | ETag caching + Service Worker | `@object-ui/mobile` | ✅ Yes |

### 3.2 Feasibility Score: 24/24 Features (100%)

- **24 features** are fully implementable today with @objectstack/client v3.0.0 + ObjectUI

---

## 4. Gap Analysis & Action Items

### 4.1 Gaps in @objectstack/client

| Gap | Severity | Workaround | Planned Resolution |
|-----|----------|------------|-------------------|
| **No Server Transactions API** | Low | Individual ops with error handling | Backend feature request |

### 4.2 Gaps in ObjectUI

| Gap | Severity | Required Work | Timeline |
|-----|----------|--------------|----------|
| **Dynamic Schema Editor** | Medium | Visual schema CRUD UI | Q2 2026 |
| **Widget Marketplace** | Medium | Plugin discovery + install | Q3 2026 |
| **Formula Functions** | Low | SUM, AVG, TODAY, IF in expressions | Q2 2026 |
| **Connection Status UI** | Low | Global connection indicator | ✅ Complete |
| **Error Recovery UI** | Low | Retry/reconnect prompts | Q2 2026 |

### 4.3 Integration Gaps

| Gap | Description | Effort | Priority |
|-----|------------|--------|----------|
| **System Object UIs** | Admin pages for sys_user, sys_org, sys_role, sys_audit_log | 2 weeks | P1 |
| **Dynamic App Loader** | Load app config from server instead of static imports | 1 week | P1 |
| **Schema Hot Reload** | Watch for schema changes and re-render | 3 days | P2 |
| **Plugin Auto-Discovery** | Register plugins from server metadata | 1 week | P2 |
| **Custom Widget Registry** | Load user-defined widgets at runtime | 2 weeks | P2 |

---

## 5. Reference Architecture: Complete Low-Code App

### 5.1 Minimal Setup

```typescript
// objectstack.config.ts — Define the application stack
import { defineStack } from '@objectstack/spec';
import { TaskObject } from './objects/task.object';

export default defineStack({
  manifest: {
    id: 'com.example.taskapp',
    version: '1.0.0',
    type: 'app',
    name: 'Task Manager',
  },
  objects: [TaskObject],
  apps: [{
    name: 'tasks',
    label: 'Task Manager',
    navigation: [
      { label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
      { label: 'Tasks', icon: 'CheckSquare', path: '/tasks', object: 'task' },
    ],
    dashboards: [{
      id: 'main',
      title: 'Overview',
      widgets: [
        { type: 'metric', title: 'Total Tasks', query: { object: 'task', aggregate: 'count' } },
        { type: 'chart', title: 'By Status', query: { object: 'task', groupBy: 'status' } },
      ],
    }],
  }],
});
```

### 5.2 Server-Side Setup (with @objectstack/plugin-auth)

```typescript
// server.ts — Bootstrap the ObjectStack server with authentication
import { ObjectKernel } from '@objectstack/core';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { AppPlugin, DriverPlugin } from '@objectstack/runtime';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { AuthPlugin } from '@objectstack/plugin-auth';
import config from './objectstack.config';

async function startServer() {
  const kernel = new ObjectKernel();

  // Core engine + data driver
  await kernel.use(new ObjectQLPlugin());
  await kernel.use(new DriverPlugin(new InMemoryDriver()));

  // Application stack
  await kernel.use(new AppPlugin(config));

  // Authentication via @objectstack/plugin-auth
  // Provides /api/v1/auth/* endpoints (sign-in, sign-up, session, OAuth, 2FA, etc.)
  await kernel.use(new AuthPlugin({
    secret: process.env.AUTH_SECRET || 'dev-secret',
    baseUrl: 'http://localhost:3000',
    providers: [
      // Optional: OAuth providers
      // { id: 'google', clientId: '...', clientSecret: '...' },
    ],
  }));

  // HTTP server
  await kernel.use(new HonoServerPlugin({ port: 3000 }));

  await kernel.bootstrap();
}

startServer();
```

### 5.3 Runtime Initialization

```typescript
// App.tsx — Bootstrap the low-code runtime
import { AuthProvider } from '@object-ui/auth';
import { TenantProvider } from '@object-ui/tenant';
import { PermissionProvider } from '@object-ui/permissions';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { SchemaRenderer } from '@object-ui/react';
import { createAuthenticatedFetch } from '@object-ui/auth';
import stackConfig from '../objectstack.config';

function App() {
  const adapter = new ObjectStackAdapter({
    baseUrl: '/api/v1',
    fetch: createAuthenticatedFetch(authClient),
    cache: { maxSize: 200, ttl: 300000 },
    autoReconnect: true,
  });

  return (
    <AuthProvider authUrl="/api/v1/auth">
      <TenantProvider>
        <PermissionProvider>
          <SchemaRenderer
            schema={stackConfig}
            dataSource={adapter}
          />
        </PermissionProvider>
      </TenantProvider>
    </AuthProvider>
  );
}
```

### 5.4 Object Definition

```typescript
// objects/task.object.ts — Spec-compliant object definition
import { ObjectSchema, Field } from '@objectstack/spec/data';

export const TaskObject = ObjectSchema.create({
  name: 'task',
  label: 'Task',
  fields: {
    title: Field.text({ label: 'Title', required: true, searchable: true }),
    description: Field.textarea({ label: 'Description' }),
    status: Field.select(['todo', 'in_progress', 'done'], { label: 'Status', default: 'todo' }),
    priority: Field.select(['low', 'medium', 'high'], { label: 'Priority' }),
    assignee: Field.lookup('user', { label: 'Assignee' }),
    due_date: Field.date({ label: 'Due Date' }),
    tags: Field.multiselect(['bug', 'feature', 'docs'], { label: 'Tags' }),
  },
  list_views: {
    all: { label: 'All Tasks', columns: ['title', 'status', 'priority', 'assignee', 'due_date'] },
    kanban: { type: 'kanban', groupByField: 'status', cardFields: ['title', 'priority', 'assignee'] },
    calendar: { type: 'calendar', dateField: 'due_date', titleField: 'title' },
    my_tasks: { label: 'My Tasks', filter: { assignee: '${user.id}' } },
  },
});
```

---

## 6. Comparative Advantage

### Why @objectstack/client + ObjectUI vs. Alternatives

| Feature | ObjectUI + @objectstack/client | Retool | Appsmith | Mendix |
|---------|-------------------------------|--------|----------|--------|
| **Open Source** | ✅ MIT License | ❌ Proprietary | ✅ Apache 2.0 | ❌ Proprietary |
| **Design Quality** | ✅ Shadcn/Tailwind | ⚠️ Basic | ⚠️ Basic | ✅ Professional |
| **Schema-Driven** | ✅ Full spec protocol | ❌ Widget-based | ❌ Widget-based | ⚠️ Partial |
| **React Native** | ✅ Pure React 19 | ❌ Custom runtime | ❌ Custom runtime | ❌ Custom runtime |
| **TypeScript** | ✅ Strict mode | ⚠️ Partial | ⚠️ Partial | ❌ Java-based |
| **Self-Hosted** | ✅ Full control | ⚠️ Limited | ✅ Yes | ⚠️ Limited |
| **Plugin System** | ✅ 20+ plugins | ✅ Marketplace | ✅ Marketplace | ✅ Marketplace |
| **Multi-Tenancy** | ✅ Built-in | ❌ Add-on | ❌ Add-on | ✅ Built-in |
| **Offline Support** | ⚠️ Planned | ❌ No | ❌ No | ✅ Yes |

---

## 7. Conclusion & Recommendations

### 7.1 Overall Assessment

**@objectstack/client can fully support developing a complete low-code application UI based on @objectstack/spec.**

The combination provides:
- **Data Layer**: Complete CRUD, bulk ops, metadata, and caching via ObjectStackAdapter
- **UI Layer**: 35 packages, 91+ components, 13+ view types covering all spec requirements
- **Security**: Server-side auth via @objectstack/plugin-auth, client-side via @object-ui/auth, RBAC, field/row-level permissions, multi-tenancy
- **Developer Experience**: TypeScript-first, Shadcn design quality, expression engine
- **Extensibility**: Plugin system, custom widgets, theme customization

### 7.2 Recommended Action Plan

**Immediate (Q1 2026 — Weeks Remaining):**
1. ✅ Complete @object-ui/auth integration with Console (auth package exists)
2. Build system object admin UIs (sys_user, sys_org, sys_role) using existing CRUD plugins
3. Implement dynamic app loading from server metadata via `adapter.getApp()`

**Short-Term (Q2 2026):**
4. Add formula functions (SUM, AVG, TODAY, NOW, IF) to expression engine
5. Build widget manifest system for dynamic widget loading
6. Complete report export (PDF/Excel) integration with live data
7. Polish mobile responsiveness and PWA offline caching

**Medium-Term (Q3 2026):**
8. WebSocket real-time collaboration via @object-ui/collaboration
9. Plugin marketplace for community-contributed widgets
10. Visual schema editor for no-code object modeling

### 7.3 Effort Estimate

| Phase | Scope | Effort | Dependencies |
|-------|-------|--------|-------------|
| **Phase 1** (Q1) | Auth + System Admin + Dynamic Loading | 4 weeks | @objectstack/client ✅ |
| **Phase 2** (Q2) | Formulas + Widget System + Reports | 6 weeks | @objectstack/spec types ✅ |
| **Phase 3** (Q3) | Real-time + Marketplace + Schema Editor | 8 weeks | WebSocket infra needed |
| **Total** | Complete Low-Code Platform | 18 weeks | 2-3 engineers |

---

## 8. Reference Documents

- [ROADMAP.md](./ROADMAP.md) — Overall development roadmap
- [CONSOLE_AUTH_PLAN.md](./CONSOLE_AUTH_PLAN.md) — Authentication integration plan
- [content/docs/guide/objectos-integration.mdx](./content/docs/guide/objectos-integration.mdx) — ObjectOS integration guide
- [@objectstack/spec documentation](https://docs.objectstack.com/spec) — Protocol specification
- [@objectstack/client documentation](https://docs.objectstack.com/client) — Client SDK reference

---

*This evaluation will be updated as @objectstack/spec and @objectstack/client evolve.*
