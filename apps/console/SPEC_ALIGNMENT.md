# ObjectStack Spec Alignment

This document details how the ObjectUI Console aligns with the ObjectStack Specification v0.8.2.

## Overview

The ObjectStack Spec defines a universal protocol for building data-driven applications. The ObjectUI Console implements this specification to provide a standard, dynamic UI that can render any ObjectStack-compliant application.

## Specification Coverage

### 1. AppSchema (UI Layer)

The `AppSchema` defines the structure and behavior of applications in ObjectStack.

| Feature | Spec Field | Implementation Status | Location |
|---------|-----------|----------------------|----------|
| **Basic Metadata** |
| App Name | `name` | ✅ Implemented | `App.tsx`, `AppSidebar.tsx` |
| App Label | `label` | ✅ Implemented | `AppSidebar.tsx` |
| App Icon | `icon` | ✅ Implemented | `AppSidebar.tsx` (Lucide icons) |
| App Version | `version` | ✅ Implemented | Plugin metadata |
| App Description | `description` | ✅ Implemented | `AppSidebar.tsx` (shown in dropdown) |
| **Navigation** |
| Home Page | `homePageId` | ✅ Implemented | `App.tsx` - navigates on app load |
| Navigation Tree | `navigation[]` | ✅ Implemented | `AppSidebar.tsx` |
| **Branding** |
| Primary Color | `branding.primaryColor` | ✅ Implemented | `AppSidebar.tsx` (inline styles) |
| Logo | `branding.logo` | ✅ Implemented | `AppSidebar.tsx` (image rendering) |
| Favicon | `branding.favicon` | ⚠️ Partial | Not yet applied to document head |
| **Security** |
| Required Permissions | `requiredPermissions[]` | ⚠️ Partial | Parsed but not enforced (no auth system) |
| Active Flag | `active` | 🔄 Planned | Filter inactive apps |
| Default App | `isDefault` | 🔄 Planned | Auto-select on first load |

### 2. NavigationItem (Navigation Layer)

The spec supports multiple navigation item types for flexible menu structures.

| Type | Spec Fields | Implementation Status | Location |
|------|------------|----------------------|----------|
| **Object Navigation** | | |
| Type | `type: "object"` | ✅ Implemented | `AppSidebar.tsx` |
| Object Name | `objectName` | ✅ Implemented | Routes to `/{objectName}` |
| View Name | `viewName` | 🔄 Planned | Custom views not yet supported |
| **Dashboard Navigation** | | |
| Type | `type: "dashboard"` | ✅ Implemented | `AppSidebar.tsx` |
| Dashboard Name | `dashboardName` | ✅ Implemented | Routes to `/dashboard/{name}` |
| **Page Navigation** | | |
| Type | `type: "page"` | ✅ Implemented | `AppSidebar.tsx` |
| Page Name | `pageName` | ✅ Implemented | Routes to `/page/{name}` |
| Parameters | `params` | 🔄 Planned | URL params not yet passed |
| **URL Navigation** | | |
| Type | `type: "url"` | ✅ Implemented | `AppSidebar.tsx` |
| URL | `url` | ✅ Implemented | Opens external links |
| Target | `target` (_self/_blank) | ✅ Implemented | Respects target attribute |
| **Group Navigation** | | |
| Type | `type: "group"` | ✅ Implemented | `AppSidebar.tsx` |
| Children | `children[]` | ✅ Implemented | Recursive rendering |
| Expanded | `expanded` | 🔄 Planned | Collapsible groups |
| **Common Fields** | | |
| ID | `id` | ✅ Implemented | Used as React key |
| Label | `label` | ✅ Implemented | Display text |
| Icon | `icon` | ✅ Implemented | Lucide icon mapping |
| Visibility | `visible` | ✅ Implemented | Basic string/boolean check |

### 3. ObjectSchema (Data Layer)

Objects define the data model and CRUD operations.

| Feature | Spec Field | Implementation Status | Location |
|---------|-----------|----------------------|----------|
| **Object Definition** |
| Object Name | `name` | ✅ Implemented | `ObjectView.tsx`, `dataSource.ts` |
| Object Label | `label` | ✅ Implemented | Page headers, breadcrumbs |
| Object Icon | `icon` | ✅ Implemented | Navigation items |
| Title Format | `titleFormat` | 🔄 Planned | Record title rendering |
| **Fields** |
| Field Types | All standard types | ✅ Implemented | `@object-ui/fields` package |
| Field Labels | `label` | ✅ Implemented | Form and grid headers |
| Required Fields | `required` | ✅ Implemented | Form validation |
| Default Values | `defaultValue` | ✅ Implemented | Form initialization |
| **CRUD Operations** |
| Create | API Integration | ✅ Implemented | `ObjectForm.tsx` |
| Read | API Integration | ✅ Implemented | `ObjectGrid.tsx` |
| Update | API Integration | ✅ Implemented | `ObjectForm.tsx` |
| Delete | API Integration | ✅ Implemented | `ObjectGrid.tsx` |
| **Advanced Features** |
| Permissions | `permissions` | 🔄 Planned | Field-level permissions |
| Triggers | `triggers` | 🔄 Planned | Before/after hooks |
| Validation Rules | `validationRules` | 🔄 Planned | Advanced validation |

### 4. Manifest (Data Seeding)

Initial data population for apps.

| Feature | Spec Field | Implementation Status | Location |
|---------|-----------|----------------------|----------|
| Manifest ID | `manifest.id` | ✅ Implemented | `objectstack.config.ts` |
| Data Seeds | `manifest.data[]` | ✅ Implemented | Loaded via MSW plugin |
| Upsert Mode | `mode: "upsert"` | ✅ Implemented | MSW data handlers |
| Insert Mode | `mode: "insert"` | ✅ Implemented | MSW data handlers |

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  ObjectStack Console                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   App.tsx    │  │ AppSidebar   │  │  AppHeader   │  │
│  │              │  │              │  │              │  │
│  │ - App Switch │  │ - Nav Tree   │  │ - Breadcrumb │  │
│  │ - Routing    │  │ - Branding   │  │ - Actions    │  │
│  │ - homePageId │  │ - Icons      │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │              ObjectView.tsx                       │  │
│  │                                                   │  │
│  │  - Object Grid (List View)                       │  │
│  │  - Object Form (Create/Edit Dialog)              │  │
│  │  - CRUD Operations                               │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
                          │ Implements
                          │
┌─────────────────────────────────────────────────────────┐
│              ObjectStack Spec v0.8.2                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  • AppSchema          • ObjectSchema                    │
│  • NavigationItem     • FieldSchema                     │
│  • AppBranding        • Manifest                        │
│  • Permission System  • Trigger System                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Future Enhancements

### Short Term (Next Release)

1. **Favicon Support** - Apply `branding.favicon` to document head
2. **Default App Selection** - Auto-select app with `isDefault: true`
3. **Active App Filtering** - Hide apps with `active: false`
4. **Collapsible Groups** - Support `expanded` flag on navigation groups
5. **View Selection** - Support `viewName` for object navigation items

### Medium Term (Q2 2026)

1. **Permission Enforcement** - Integrate with authentication system
2. **Custom Pages** - Support `page` navigation type with custom components
3. **Dashboard Routing** - Implement dashboard view rendering
4. **URL Parameters** - Pass params to page navigation items
5. **Advanced Visibility** - Evaluate expression strings for `visible` field

### Long Term (Q3-Q4 2026)

1. **Trigger Support** - Execute object triggers on CRUD operations
2. **Field-Level Permissions** - Show/hide/readonly based on user permissions
3. **Advanced Validation** - Implement validation rules engine
4. **Custom Views** - Support multiple views per object
5. **Theme Customization** - Full theme support from branding config

## Testing Strategy

### Unit Tests

- ✅ Navigation rendering (`AppSidebar.test.tsx`)
- ✅ Object CRUD operations (`ObjectForm.test.tsx`, `ObjectGrid.test.tsx`)
- ⚠️ Spec compliance tests (`SpecCompliance.test.tsx` - needs expansion)

### Integration Tests

- ✅ MSW server mocking (`MSWServer.test.tsx`)
- ✅ Server definitions (`ServerDefinitions.test.tsx`)
- 🔄 Multi-app navigation (planned)
- 🔄 Permission enforcement (planned)

### E2E Tests

- 🔄 Full app workflows (planned)
- 🔄 Cross-app navigation (planned)
- 🔄 CRUD operations end-to-end (planned)

## Version Compatibility

| ObjectStack Spec Version | Console Version | Support Status |
|-------------------------|-----------------|----------------|
| 0.8.x | 0.1.0 | ✅ Current |
| 0.7.x | 0.1.0 | ✅ Compatible |
| 0.6.x and below | - | ❌ Not supported |

## References

- [ObjectStack Spec Repository](https://github.com/objectstack-ai/objectstack)
- [ObjectUI Documentation](https://www.objectui.org)
- [Console Source Code](https://github.com/objectstack-ai/objectui/tree/main/apps/console)

## Contributing

To improve spec alignment:

1. Check this document for unimplemented features (🔄 or ⚠️)
2. Refer to the ObjectStack Spec for expected behavior
3. Implement the feature with tests
4. Update this document to reflect the changes
5. Submit a pull request

---

**Last Updated**: 2026-02-02  
**Spec Version**: 0.8.2  
**Console Version**: 0.1.0
