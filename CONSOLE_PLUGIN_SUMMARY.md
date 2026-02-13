# Console Plugin Architecture & Integration Summary

## Quick Reference Guide

This document provides a visual summary of the console plugin transformation and HotCRM integration architecture.

---

## Current State vs. Proposed State

### Current: Standalone Application

```
┌─────────────────────────────────────────────┐
│         @object-ui/console (App)            │
│         apps/console/                       │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Plugin   │  │ Plugin   │  │ Plugin   │ │
│  │  Grid    │  │ Kanban   │  │Dashboard │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   Components (18+)                   │  │
│  │   - ConsoleLayout                    │  │
│  │   - ObjectView                       │  │
│  │   - DashboardView                    │  │
│  │   - AppSidebar, AppHeader...         │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │   Pages                              │  │
│  │   - Login, Register                  │  │
│  │   - UserManagement, RoleManagement   │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Build: Vite App → Static Bundle (5-10 MB) │
│  Distribution: Standalone deployment only   │
│  Dependencies: Direct (all plugins)         │
└─────────────────────────────────────────────┘
```

### Proposed: Hybrid Plugin

```
┌─────────────────────────────────────────────────────────┐
│      @object-ui/plugin-console (Hybrid)                 │
│      packages/plugin-console/                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────┐  ┌────────────────────┐        │
│  │  Library Mode      │  │  App Mode          │        │
│  │  (for npm)         │  │  (standalone)      │        │
│  ├────────────────────┤  ├────────────────────┤        │
│  │                    │  │                    │        │
│  │  dist/             │  │  dist/app/         │        │
│  │  ├─ index.js       │  │  ├─ index.html     │        │
│  │  ├─ index.umd.cjs  │  │  ├─ assets/        │        │
│  │  ├─ index.d.ts     │  │  └─ ...            │        │
│  │  └─ app.js         │  │                    │        │
│  │                    │  │  All plugins       │        │
│  │  50-200 KB         │  │  bundled           │        │
│  │  Tree-shakeable    │  │  5-10 MB           │        │
│  │                    │  │                    │        │
│  │  Exports:          │  │  Usage:            │        │
│  │  - Components      │  │  - Deploy as SPA   │        │
│  │  - Hooks           │  │  - Serve via CDN   │        │
│  │  - ConsoleApp      │  │                    │        │
│  │                    │  │                    │        │
│  └────────────────────┘  └────────────────────┘        │
│                                                         │
│  peerDependencies: React, Router, Core libs            │
│  devDependencies: Build tools only                     │
└─────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Console Components Hierarchy

```
ConsoleApp
├── ThemeProvider
│   └── I18nProvider
│       └── AuthProvider
│           └── SchemaRendererProvider
│               └── ConsoleLayout
│                   ├── AppHeader
│                   │   ├── Logo
│                   │   ├── AppSwitcher
│                   │   ├── SearchBar
│                   │   ├── ModeToggle
│                   │   └── UserMenu
│                   │
│                   ├── AppSidebar
│                   │   ├── Navigation
│                   │   ├── RecentItems
│                   │   └── Favorites
│                   │
│                   └── MainContent
│                       └── Router
│                           ├── ObjectView
│                           │   ├── Toolbar
│                           │   ├── ViewSwitcher
│                           │   └── SchemaRenderer
│                           │       └── Plugin Components
│                           │           ├── Grid
│                           │           ├── Kanban
│                           │           ├── Calendar
│                           │           └── ...
│                           │
│                           ├── DashboardView
│                           ├── ReportView
│                           ├── RecordDetailView
│                           └── Custom Routes
```

### Plugin Registration Flow

```
┌──────────────────────────────────────────────┐
│  Step 1: Import Plugin                      │
│  import '@object-ui/plugin-console'         │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Step 2: Plugin Index (Side Effect)         │
│  ComponentRegistry.register(...)            │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  Step 3: Component Available                │
│  SchemaRenderer can now use component       │
└──────────────────────────────────────────────┘

Example:
  ComponentRegistry.register('object-view', ObjectView, {
    namespace: 'console',
    label: 'Object View',
    inputs: [
      { name: 'objectName', type: 'string', required: true }
    ]
  });
```

---

## HotCRM Integration Patterns

### Pattern 1: Full App Embedding

```
┌─────────────────────────────────────────────┐
│             HotCRM Application              │
├─────────────────────────────────────────────┤
│                                             │
│  main.tsx:                                  │
│  ┌────────────────────────────────────────┐ │
│  │ import { ConsoleApp }                  │ │
│  │   from '@object-ui/plugin-console/app'│ │
│  │                                        │ │
│  │ <ConsoleApp                            │ │
│  │   appConfig={hotcrmConfig}            │ │
│  │   dataSource={hotcrmDataSource}       │ │
│  │ />                                     │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  Pros: Zero config, full features          │
│  Cons: Large bundle, less customization    │
└─────────────────────────────────────────────┘
```

### Pattern 2: Component-Level Integration

```
┌─────────────────────────────────────────────┐
│             HotCRM Application              │
├─────────────────────────────────────────────┤
│                                             │
│  App.tsx:                                   │
│  ┌────────────────────────────────────────┐ │
│  │ import { ConsoleLayout, ObjectView }  │ │
│  │   from '@object-ui/plugin-console'    │ │
│  │                                        │ │
│  │ <ConsoleLayout appConfig={config}>   │ │
│  │   <Routes>                             │ │
│  │     <Route path="/objects/:name"      │ │
│  │       element={<ObjectView />} />     │ │
│  │     <Route path="/custom"             │ │
│  │       element={<HotCRMCustom />} />   │ │
│  │   </Routes>                            │ │
│  │ </ConsoleLayout>                       │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  Pros: Flexible, tree-shakeable            │
│  Cons: Manual routing, more setup          │
└─────────────────────────────────────────────┘
```

### Pattern 3: Hybrid Approach (Recommended)

```
┌─────────────────────────────────────────────────────────┐
│                HotCRM Application                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  ConsoleLayout (from plugin)                   │    │
│  │  ├─ AppHeader (from plugin)                    │    │
│  │  ├─ AppSidebar (from plugin)                   │    │
│  │  └─ Routes                                      │    │
│  │      ├─ ObjectView (from plugin)               │    │
│  │      │   └─ For standard CRUD                   │    │
│  │      ├─ DashboardView (from plugin)            │    │
│  │      │   └─ For standard dashboards            │    │
│  │      ├─ HotCRMDashboard (custom)               │    │
│  │      │   └─ CRM-specific analytics             │    │
│  │      └─ SalesAnalytics (custom)                │    │
│  │          └─ Sales-specific features            │    │
│  └────────────────────────────────────────────────┘    │
│                                                         │
│  Strategy:                                              │
│  ✓ Use console components for standard features        │
│  ✓ Build custom components for HotCRM-specific needs   │
│  ✓ Balance bundle size vs. functionality               │
└─────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Console to HotCRM Data Flow

```
┌──────────────────┐
│   HotCRM Config  │
│  (metadata)      │
└────────┬─────────┘
         │
         │ Configuration
         ▼
┌──────────────────────────────────────┐
│      ConsoleApp / ConsoleLayout      │
│  SchemaRendererProvider              │
└────────┬─────────────────────────────┘
         │
         │ Data Queries
         ▼
┌──────────────────────────────────────┐
│      Data Source Adapter             │
│  (ObjectStackAdapter)                │
└────────┬─────────────────────────────┘
         │
         │ HTTP/API Calls
         ▼
┌──────────────────────────────────────┐
│      HotCRM Backend                  │
│  (ObjectStack Server)                │
└──────────────────────────────────────┘

Data Operations:
- find()      → List records
- get()       → Get single record
- create()    → Create record
- update()    → Update record
- delete()    → Delete record
- aggregate() → Calculate metrics
```

### Plugin Metadata Flow

```
┌──────────────────────────────────────┐
│    HotCRM Plugin Packages            │
│  @hotcrm/crm                         │
│  @hotcrm/finance                     │
│  @hotcrm/marketing                   │
└────────┬─────────────────────────────┘
         │
         │ Export objects[], apps[]
         ▼
┌──────────────────────────────────────┐
│    Plugin Bridge / Config Merger     │
│  hotcrm/src/config.ts                │
│                                      │
│  const allPlugins = [                │
│    CRMPlugin,                        │
│    FinancePlugin,                    │
│    MarketingPlugin                   │
│  ];                                  │
│                                      │
│  objects: plugins.flatMap(...)       │
│  apps: plugins.flatMap(...)          │
└────────┬─────────────────────────────┘
         │
         │ Pass to console
         ▼
┌──────────────────────────────────────┐
│    Console Components                │
│  - Render objects in ObjectView      │
│  - Display apps in AppSwitcher       │
│  - Build navigation from metadata    │
└──────────────────────────────────────┘
```

---

## Migration Checklist

### Phase 1: Package Preparation
- [ ] Move apps/console → packages/plugin-console
- [ ] Update package.json (private: false, exports, etc.)
- [ ] Configure dual build (lib + app modes)
- [ ] Update workspace configuration
- [ ] Set up vite-plugin-dts for TypeScript types

### Phase 2: Code Restructuring
- [ ] Create src/index.tsx (library entry)
- [ ] Create src/app.tsx (full app export)
- [ ] Move main.tsx to src/app-entry/
- [ ] Register components with ComponentRegistry
- [ ] Export hooks and utilities
- [ ] Update imports across files

### Phase 3: Dependency Management
- [ ] Convert dependencies → peerDependencies
- [ ] Keep only utilities as direct dependencies
- [ ] Update vite.config.ts externals
- [ ] Test tree-shaking works correctly
- [ ] Verify no circular dependencies

### Phase 4: Testing & Documentation
- [ ] Update test files for new structure
- [ ] Run full test suite
- [ ] Create README with examples
- [ ] Add TypeScript JSDoc comments
- [ ] Create Storybook stories
- [ ] Write migration guide for consumers

### Phase 5: Publishing
- [ ] Build library and app
- [ ] Verify bundle sizes
- [ ] Test in isolated project
- [ ] Publish to npm
- [ ] Update main docs site
- [ ] Create GitHub release

### Phase 6: HotCRM Integration
- [ ] Create HotCRM project structure
- [ ] Install @object-ui/plugin-console
- [ ] Configure HotCRM metadata
- [ ] Implement custom components
- [ ] Test end-to-end
- [ ] Deploy to production

---

## Key Technical Decisions

### Decision 1: Dual Build vs. Separate Packages

**Chosen:** Dual Build (Library + App in one package)

**Rationale:**
- Single source of truth
- No code duplication
- Easier maintenance
- Consumers can choose mode

**Alternative:** Separate @object-ui/console-app and @object-ui/console-components
- Pros: Clear separation
- Cons: Duplicate code, maintenance burden

### Decision 2: Peer Dependencies Strategy

**Chosen:** Externalize all framework and UI libraries

```json
{
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0",
    "react-router-dom": "^7.0.0",
    "@object-ui/core": "workspace:*",
    "@object-ui/components": "workspace:*",
    // ... more
  }
}
```

**Rationale:**
- Avoid version conflicts
- Enable tree-shaking
- Reduce bundle size
- Let consumer control versions

### Decision 3: Plugin Auto-Import

**Library Mode:** No auto-imports (consumer imports plugins)
**App Mode:** Auto-import all plugins

**Rationale:**
- Library: Flexibility, tree-shaking
- App: Convenience, feature parity

```typescript
// Library usage - consumer controls plugins
import '@object-ui/plugin-grid';
import '@object-ui/plugin-kanban';
import { ObjectView } from '@object-ui/plugin-console';

// App usage - plugins pre-loaded
import { ConsoleApp } from '@object-ui/plugin-console/app';
```

---

## Performance Considerations

### Bundle Size Comparison

**Before (Standalone App):**
```
Total: ~5-10 MB
├─ React + Router: ~200 KB
├─ ObjectUI Core: ~150 KB
├─ All Plugins: ~2-3 MB
├─ Console Code: ~500 KB
└─ Dependencies: ~2-6 MB
```

**After (Library Mode):**
```
Console Plugin: ~50-200 KB (tree-shakeable)
├─ Components: ~100 KB
├─ Hooks: ~20 KB
└─ Utilities: ~10 KB

Consumer chooses plugins:
├─ Grid: ~150 KB
├─ Kanban: ~120 KB
└─ Dashboard: ~100 KB
Total: 50-200 KB (console) + selected plugins
```

### Performance Optimizations

1. **Code Splitting**
   ```typescript
   // Lazy load routes
   const RecordDetail = lazy(() => import('./RecordDetailView'));
   ```

2. **Tree Shaking**
   ```typescript
   // Import only what's needed
   import { ObjectView } from '@object-ui/plugin-console';
   // Not: import * as Console from '@object-ui/plugin-console';
   ```

3. **Dependency Externalization**
   ```typescript
   // vite.config.ts
   external: ['react', 'react-dom', '@object-ui/core']
   ```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes | High | Provide migration guide, deprecation warnings |
| Type incompatibility | Medium | Use generic types, peer dependencies |
| Bundle bloat | Medium | Tree-shaking, external dependencies |
| Plugin conflicts | Low | Namespace components, version constraints |
| Performance regression | Low | Bundle analysis, performance benchmarks |
| Documentation gaps | Medium | Comprehensive docs, examples, Storybook |

---

## Timeline Estimate

**Total Duration:** 6 weeks

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| 1. Package Restructuring | 1 week | New package location, config |
| 2. Code Refactoring | 1 week | Library/app split, exports |
| 3. Dependency Management | 1 week | Peer deps, externals |
| 4. Testing & Docs | 1 week | Tests, docs, examples |
| 5. Publishing | 1 week | npm publish, release |
| 6. HotCRM Integration | 1 week | Integration, deployment |

---

## Success Metrics

**Technical:**
- [ ] Library bundle < 300 KB (gzipped)
- [ ] App bundle same as before (~5-10 MB)
- [ ] 100% test coverage maintained
- [ ] Zero breaking changes for app mode users
- [ ] TypeScript types 100% accurate

**Business:**
- [ ] HotCRM successfully integrates console
- [ ] <2 day setup time for new integrations
- [ ] Positive community feedback
- [ ] 5+ external projects using console plugin
- [ ] npm downloads > 100/week

---

## Next Steps

1. **Review & Approval**
   - Team review of evaluation docs
   - Stakeholder approval
   - Resource allocation

2. **Proof of Concept**
   - Create minimal working version
   - Test HotCRM integration
   - Validate assumptions

3. **Implementation**
   - Follow migration guide step-by-step
   - Regular progress updates
   - Iterative testing

4. **Deployment**
   - Publish to npm
   - Deploy HotCRM with integration
   - Monitor performance

---

## Resources

- **Evaluation Document:** `CONSOLE_PLUGIN_EVALUATION.md`
- **Migration Guide:** `CONSOLE_PLUGIN_MIGRATION_GUIDE.md`
- **Integration Example:** `HOTCRM_INTEGRATION_EXAMPLE.md`
- **Architecture Diagrams:** This document

---

*Document Version: 1.0*  
*Created: 2026-02-13*  
*Author: ObjectUI Architecture Team*
