---
name: objectui-console-development
description: Develop features for the Object UI Console application — the reference admin interface. Use this skill when the user works on apps/console code, adds admin pages, modifies the metadata management system, extends the MetadataTypeRegistry, creates schema-driven detail pages with PageSchema factories, modifies the UnifiedSidebar or navigation, works with ConsoleLayout/HomeLayout, builds system hub pages, or debugs console-specific routing. Also applies when the user mentions metadata types, object management, admin panel, system settings, app management, or console navigation patterns.
---

# ObjectUI Console Development

Use this skill when working on the Console application (`apps/console/`), the reference admin interface for Object UI. The Console demonstrates schema-driven patterns at scale and serves as the blueprint for enterprise admin interfaces.

## Console architecture overview

### App entry and provider stack

`apps/console/src/App.tsx` composes providers in this order:

```
BrowserRouter
└── ThemeProvider
    └── SchemaRendererProvider (dataSource)
        └── AuthGuard
            └── NavigationProvider
                └── FavoritesProvider
                    └── AdapterProvider (ObjectStackAdapter)
                        └── ConnectedShell
                            └── MetadataProvider (apps, objects, dashboards, etc.)
                                └── ExpressionProvider
                                    └── ConditionalAuthWrapper
                                        └── AppContent (Routes)
```

### Page structure

```
apps/console/src/pages/
├── home/                    # Workspace hub
│   ├── HomeLayout.tsx       # Home shell (AppShell + sidebar, sets nav context)
│   ├── HomePage.tsx         # Workspace dashboard
│   ├── QuickActions.tsx     # Quick action buttons
│   ├── RecentApps.tsx       # Recently-accessed apps
│   └── AppCard.tsx          # App preview card
├── system/                  # Admin panel
│   ├── SystemHubPage.tsx    # Card-based admin hub
│   ├── MetadataManagerPage.tsx  # Registry-driven list page
│   ├── MetadataDetailPage.tsx   # Registry-driven detail page
│   ├── AppManagementPage.tsx
│   ├── UserManagementPage.tsx
│   ├── RoleManagementPage.tsx
│   └── PermissionManagementPage.tsx
├── CreateAppPage.tsx
├── EditAppPage.tsx
├── PageDesignPage.tsx
└── DashboardDesignPage.tsx
```

## Metadata Type Registry

The registry at `apps/console/src/config/metadataTypeRegistry.ts` is the central configuration for all admin-managed entity types (app, dashboard, page, report, object, etc.).

### MetadataTypeConfig interface

```typescript
interface MetadataTypeConfig {
  type: string;                    // API metadata category ('dashboard', 'page', 'object')
  label: string;                   // Singular display name
  pluralLabel: string;             // Plural display name
  icon: string;                    // Lucide icon name
  columns?: MetadataColumnDef[];   // Columns for list view
  formFields?: MetadataFormFieldDef[]; // Fields for create/edit dialog
  customRoute?: string;            // Override hub card link URL
  pageSchemaFactory?: (name: string, item?: any) => PageSchema; // Schema-driven detail page
  countSource?: 'metadata' | 'dataSource';  // Where to get item count
  editable?: boolean;              // Enable CRUD (default: true)
  listComponent?: React.ComponentType<MetadataListComponentProps>; // Custom list UI
}
```

### How MetadataManagerPage works

Instead of hardcoding pages per type, `MetadataManagerPage` reads the registry config:

1. Gets `metadataType` from URL params
2. Looks up `getMetadataTypeConfig(metadataType)`
3. Uses `config.columns` to render the list table
4. Uses `config.formFields` to render create/edit dialog
5. If `config.listComponent` is set, renders that instead of the default grid

### How MetadataDetailPage works

1. Gets `metadataType` and `itemName` from URL params
2. Looks up config from registry
3. If `config.pageSchemaFactory` exists: generates PageSchema → renders via `SchemaRenderer`
4. Otherwise: renders a generic detail card

### Adding a new metadata type

```typescript
// In metadataTypeRegistry.ts
registerMetadataType({
  type: 'workflow',
  label: 'Workflow',
  pluralLabel: 'Workflows',
  icon: 'git-branch',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status', width: '100px' },
    { key: 'triggerObject', label: 'Object' },
  ],
  formFields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'triggerObject', label: 'Trigger Object', type: 'select', options: objectOptions },
    { key: 'active', label: 'Active', type: 'boolean' },
  ],
  editable: true,
});
```

### MetadataFormFieldDef types

Supported form field types:
- `'text'` — text input
- `'textarea'` — multiline text
- `'select'` — dropdown with options
- `'number'` — numeric input
- `'boolean'` — Switch toggle (stored as `'true'`/`'false'` strings)

## Schema-driven detail pages (PageSchema)

### The pattern

1. **Schema factory** generates a `PageSchema` from entity name/data
2. **Custom widgets** are self-contained React components registered in `ComponentRegistry`
3. **MetadataDetailPage** calls the factory and renders via `SchemaRenderer`

### Object detail page example

`apps/console/src/schemas/objectDetailPageSchema.ts`:

```typescript
export function buildObjectDetailPageSchema(objectName: string, item?: any): PageSchema {
  return {
    type: 'page',
    children: [
      {
        type: 'object-detail-tabs',
        props: { objectName },
      },
    ],
  };
}
```

### Registered custom widgets

`apps/console/src/components/schema/registerObjectDetailWidgets.ts` registers:

| Widget type | Component | Purpose |
|------------|-----------|---------|
| `object-detail-tabs` | `ObjectDetailTabsWidget` | Main tabs container (Details, Fields, Relationships, Data) |
| `object-properties` | `ObjectPropertiesWidget` | Object config form (name, label, icon, etc.) |
| `object-field-designer` | `ObjectFieldDesignerWidget` | Interactive field CRUD |
| `object-relationships` | `ObjectRelationshipsWidget` | Relationships & foreign keys |
| `object-data-experience` | `ObjectDataExperienceWidget` | Data experience config |
| `object-data-preview` | `ObjectDataPreviewWidget` | Data preview table |

### Creating a new schema-driven detail page

1. Create schema factory in `apps/console/src/schemas/`:
```typescript
export function buildMyDetailPageSchema(name: string, item?: any): PageSchema {
  return {
    type: 'page',
    children: [
      { type: 'my-detail-tabs', props: { entityName: name } },
    ],
  };
}
```

2. Create widget components in `apps/console/src/components/schema/`:
```typescript
export function MyDetailTabsWidget({ schema }: { schema: any }) {
  const entityName = schema.props?.entityName;
  // Fetch data, render tabs
}
```

3. Register widgets:
```typescript
ComponentRegistry.register('my-detail-tabs', MyDetailTabsWidget, {
  label: 'My Detail Tabs',
  category: 'admin',
});
```

4. Wire into MetadataTypeRegistry:
```typescript
registerMetadataType({
  type: 'my-entity',
  pageSchemaFactory: buildMyDetailPageSchema,
  // ...
});
```

## Navigation system

### UnifiedSidebar

`apps/console/src/components/UnifiedSidebar.tsx` — Airtable-style contextual sidebar:

- **Persistent** across all routes (embedded in AppShell)
- **Context-aware**: shows different items based on `NavigationContext` (`'home'` vs `'app'`)
- **Features**: App switcher, drag-to-reorder, favorites, search/filter, pinned bottom section

### NavigationContext

`apps/console/src/context/NavigationContext.tsx`:

```typescript
type NavigationContextType = 'home' | 'app';
```

- `HomeLayout` sets context to `'home'` → sidebar shows workspace nav
- `ConsoleLayout` sets context to `'app'` → sidebar shows app-specific nav

### ConsoleLayout vs HomeLayout

Both use `AppShell` + `UnifiedSidebar`. The difference is the navigation context:

```typescript
// ConsoleLayout (for app pages)
function ConsoleLayout({ activeAppName, children }) {
  const { setContext } = useNavigation();
  useEffect(() => setContext('app'), []);
  // ...
}

// HomeLayout (for home/workspace pages)
function HomeLayout({ children }) {
  const { setContext } = useNavigation();
  useEffect(() => setContext('home'), []);
  // ...
}
```

### Routing patterns

```typescript
// apps/console/src/App.tsx routes (simplified)
<Routes>
  {/* Home */}
  <Route path="/" element={<HomeLayout />}>
    <Route index element={<HomePage />} />
  </Route>

  {/* App context */}
  <Route path="/app/:appName" element={<ConsoleLayout />}>
    <Route path="view/:viewName" element={<ViewPage />} />
    <Route path="dashboard/:dashboardName" element={<DashboardView />} />
    <Route path="record/:objectName/:recordId" element={<RecordDetailView />} />
  </Route>

  {/* Admin */}
  <Route path="/system" element={<ConsoleLayout />}>
    <Route index element={<SystemHubPage />} />
    <Route path="metadata/:metadataType" element={<MetadataManagerPage />} />
    <Route path="metadata/:metadataType/:itemName" element={<MetadataDetailPage />} />
  </Route>

  {/* Legacy redirects */}
  <Route path="/system/objects" element={<Navigate to="/system/metadata/object" />} />
  <Route path="/system/objects/:name" element={<ObjectRedirect />} />
</Routes>
```

## Key contexts

| Context | Location | Purpose |
|---------|----------|---------|
| `AdapterProvider` | `context/AdapterProvider.tsx` | ObjectStackAdapter lifecycle, connection management |
| `MetadataProvider` | `context/MetadataProvider.tsx` | Apps, objects, dashboards, reports from API |
| `NavigationContext` | `context/NavigationContext.tsx` | Home vs App sidebar context |
| `FavoritesProvider` | `context/FavoritesProvider.tsx` | User's starred/pinned items |
| `ExpressionProvider` | `context/ExpressionProvider.tsx` | Expression evaluator instance |

## Key hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useBranding` | `hooks/useBranding.ts` | AppShell brand colors/logo |
| `useFavorites` | `hooks/useFavorites.ts` | Starred items state |
| `useMetadataService` | `hooks/useMetadataService.ts` | CRUD operations on metadata |
| `useNavPins` | `hooks/useNavPins.ts` | Pinned navigation items |
| `useNavigationSync` | `hooks/useNavigationSync.ts` | URL ↔ navigation context sync |
| `useObjectActions` | `hooks/useObjectActions.ts` | Custom actions on objects |
| `useRecentItems` | `hooks/useRecentItems.ts` | MRU tracking |
| `useResponsiveSidebar` | `hooks/useResponsiveSidebar.ts` | Sidebar collapse on mobile |

## Common console development patterns

### Adding a new admin page

1. Create the page component in `pages/system/`
2. Add route in `App.tsx` under the `/system` route group
3. Add card entry in `SystemHubPage.tsx` (icon, label, link)
4. Optionally register as metadata type in registry

### Extending object management

To add a new tab to the object detail page:
1. Create widget component in `components/schema/`
2. Register in `registerObjectDetailWidgets.ts`
3. Add tab entry in `ObjectDetailTabsWidget.tsx`
4. Update `buildObjectDetailPageSchema()` if needed

### Widget styling convention

Console widgets use clean form-style labels and sectioned layouts without card borders:

```typescript
function MyWidget({ schema }) {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-medium uppercase text-muted-foreground">Section Title</span>
        <div className="mt-2 space-y-3">
          {/* Content */}
        </div>
      </div>
    </div>
  );
}
```

## Common mistakes

- Creating standalone pages instead of using MetadataTypeRegistry for admin entities.
- Forgetting to set `NavigationContext` in custom layouts — sidebar shows wrong items.
- Not registering custom widgets before MetadataDetailPage renders — SchemaRenderer produces fallback.
- Using legacy routes (`/system/objects`) instead of unified metadata routes (`/system/metadata/object`).
- Modifying `src/ui/**/*.tsx` files directly — these are Shadcn upstream files that get overwritten by sync scripts.
