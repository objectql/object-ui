# ObjectUI Roadmap

> Aligning ObjectUI with `@objectstack/spec` UI Protocol

## Current Status

**Version:** v0.5.x  
**Spec Version:** @objectstack/spec v1.1.0  
**Overall Spec Coverage:** ~95%

## Package Maturity Matrix

| Package | Status | Spec Coverage | Notes |
|---------|--------|--------------|-------|
| @object-ui/types | ✅ Complete | 100% | Full spec re-export + local types |
| @object-ui/core | ✅ Complete | 100% | Registry, Plugin, Expression (formulas), Action, Validation, ThemeEngine, Widget System |
| @object-ui/components | ✅ Complete | 100% | 80+ renderers, 50 Shadcn primitives |
| @object-ui/fields | ✅ Complete | 95% | 36 widgets, 20+ cell renderers |
| @object-ui/layout | ✅ Complete | 95% | Page, Grid, Columns, LayoutTemplate, Flex, Stack, Container |
| @object-ui/react | ✅ Complete | 100% | SchemaRenderer, hooks, providers, ThemeProvider |
| @object-ui/plugin-form | ✅ Complete | 90% | All 6 variants (simple/tabbed/wizard/split/drawer/modal), FormField enhancements |
| @object-ui/plugin-grid | ✅ Complete | 95% | Full ListView support |
| @object-ui/plugin-aggrid | ✅ Complete | 100% | AG Grid integration |
| @object-ui/plugin-kanban | ✅ Complete | 100% | Kanban board |
| @object-ui/plugin-calendar | ✅ Complete | 100% | Calendar view |
| @object-ui/plugin-gantt | ✅ Complete | 100% | Gantt chart |
| @object-ui/plugin-charts | ✅ Complete | 100% | 7 chart types |
| @object-ui/plugin-dashboard | ✅ Complete | 100% | Dashboard layout |
| @object-ui/plugin-detail | ✅ Complete | 100% | Record detail view |
| @object-ui/plugin-list | ✅ Complete | 100% | List with view switching |
| @object-ui/plugin-view | ✅ Complete | 90% | Multi-view rendering, named listViews, NavigationConfig |
| @object-ui/plugin-object | ⚪ Prebuilt | N/A | No source, has dist |
| @object-ui/plugin-report | 🟡 Partial | 60% | Basic report rendering |
| @object-ui/plugin-timeline | ✅ Complete | 100% | 3 timeline variants |
| @object-ui/plugin-map | ✅ Complete | 100% | Map view |
| @object-ui/plugin-editor | ✅ Complete | 100% | Monaco editor |
| @object-ui/plugin-markdown | ✅ Complete | 100% | Markdown rendering |
| @object-ui/plugin-chatbot | ✅ Complete | 100% | Chat interface |
| @object-ui/data-objectql | ⚪ Prebuilt | N/A | No source, has dist |
| @object-ui/data-objectstack | ✅ Complete | 100% | Full DataSource adapter |
| @object-ui/runner | ✅ Complete | 100% | App runner |
| @object-ui/cli | ✅ Complete | 100% | 15 commands |

---

## Gap Analysis

### 🔴 Critical Gaps (High Priority)

#### 1. Form Variants (plugin-form)

**Spec Requirement:**
```typescript
FormView.type: 'simple' | 'tabbed' | 'wizard' | 'split' | 'drawer' | 'modal'
```

**Current State:** Only `simple` form implemented.

**Missing Features:**
- [x] Tabbed Form - Fields organized in tab groups
- [x] Wizard Form - Multi-step form with navigation
- [x] Split Form - Side-by-side panels (ResizablePanelGroup)
- [x] Drawer Form - Slide-out form panel (Sheet)
- [x] Modal Form - Dialog-based form (Dialog)
- [x] Section/Group support (collapsible, columns per section)
- [x] FormField.colSpan support
- [x] FormField.dependsOn (field dependencies) — runtime evaluation via useFieldDependency hook
- [x] FormField.widget (custom widget override)

---

#### 2. Action System Runtime

**Spec Requirement:**
```typescript
Action.type: 'script' | 'url' | 'modal' | 'flow' | 'api'
Action.locations: ('list_toolbar' | 'list_item' | 'record_header' | 'record_more' | 'record_related' | 'global_nav')[]
Action.component: 'action:button' | 'action:icon' | 'action:menu' | 'action:group'
Action.params: ActionParam[]
```

**Current State:** ActionRunner handles all 5 spec action types + navigation. Action components implemented.

**Completed Features:**
- [x] `script` action type - Execute client-side expressions via ExpressionEvaluator
- [x] `modal` action type - Open modal dialog (via ModalHandler or schema return)
- [x] `flow` action type - Trigger automation workflow (via registered handler)
- [x] `api` action type - Full HttpRequest support (headers, body, method, queryParams, responseType)
- [x] `url` action type - URL navigation (via NavigationHandler or redirect)
- [x] Action location-based rendering (toolbar, item, header, etc.)
- [x] Action component variants: `action:button`, `action:icon`, `action:menu`, `action:group`
- [x] successMessage display (via ToastHandler)
- [x] refreshAfter behavior
- [x] Action chaining (sequential + parallel)
- [x] onSuccess / onFailure callbacks
- [x] ActionProvider context (shared runner for component tree)
- [x] Conditional visibility & enabled state (via expression evaluation)

**Remaining:**
- [x] ActionParam UI collection (before execution) — ActionParamCollector dialog + ActionRunner integration
- [x] FormField.dependsOn (field dependencies) — useFieldDependency hook in @object-ui/react

---

#### 3. NavigationConfig ✅ (v0.5.0)

**Spec Requirement:**
```typescript
NavigationConfig: {
  mode: 'page' | 'drawer' | 'modal' | 'split' | 'popover' | 'new_window' | 'none'
  view?: string
  preventNavigation?: boolean
  openNewTab?: boolean
}
```

**Current State:** Fully implemented. `ViewNavigationConfig` interface in @object-ui/types.
Reusable `useNavigationOverlay` hook in @object-ui/react + `NavigationOverlay` component in @object-ui/components.

**Completed:**
- [x] `ViewNavigationConfig` interface in @object-ui/types (7 modes, width, view, preventNavigation, openNewTab)
- [x] `navigation?: ViewNavigationConfig` on ObjectGridSchema, ListViewSchema, ObjectViewSchema
- [x] `onNavigate` callback on ObjectGridSchema, ListViewSchema, DetailViewSchema
- [x] `useNavigationOverlay` hook (state management, click handler, overlay control)
- [x] `NavigationOverlay` component (Sheet/Dialog/Popover/ResizablePanelGroup rendering)
- [x] Implement in plugin-grid (row click → drawer/modal/split/popover/page/new_window/none)
- [x] Implement in plugin-list (onRowClick passthrough to child views + overlay rendering)
- [x] Implement in plugin-detail (SPA-aware back/edit/delete navigation via onNavigate)
- [x] Drawer navigation mode (Sheet, right-side panel)
- [x] Modal navigation mode (Dialog, center overlay)
- [x] Split view navigation mode (ResizablePanelGroup, side-by-side)
- [x] Popover preview mode (Popover, hover/click card)
- [x] 51 useNavigationOverlay hook tests + 20 NavigationOverlay component tests

**Remaining:**
- [x] `navigation.view` property — ViewResolver integration in useNavigationOverlay
- [ ] ObjectForm integration in overlay content (render forms when editing)
- [x] ActionParam UI collection (before execution) — ActionParamCollector dialog
- [x] FormField.dependsOn (field dependencies) — useFieldDependency hook

---

### 🟡 Medium Priority Gaps

#### 4. ListColumn Extensions ✅

**Spec Requirement:**
```typescript
ListColumn.link: boolean    // Primary navigation column
ListColumn.action: string   // Associated action ID
```

**Current State:** ✅ Complete — types aligned with @objectstack/spec, rendering implemented.

**Completed:**
- [x] Add `link` and `action` to ListColumn interface + Zod schema
- [x] Add `col.cell()` custom renderer support to data-table
- [x] Render link columns with navigation behavior (triggers useNavigationOverlay)
- [x] Render action columns with ActionRunner integration (dispatches registered handler)
- [x] Support `hidden` columns (filtered out of data-table)
- [x] Support `type` columns (getCellRenderer for typed cell rendering)
- [x] Support `wrap` and `resizable` passthrough
- [x] 28 plugin-grid tests + 4 data-table cell renderer tests, all passing

---

#### 5. Page System ✅

**Spec Requirement:**
```typescript
Page: {
  type: 'record' | 'home' | 'app' | 'utility'
  variables: PageVariable[]
  template: string
  object?: string
  regions: PageRegion[]
}
```

**Current State:** ✅ Complete — PageSchema fully aligned with @objectstack/spec.
PageRenderer supports four page types with region-based layouts and page-level variables.

**Completed:**
- [x] Add `PageType` = 'record' | 'home' | 'app' | 'utility' to @object-ui/types
- [x] Add `PageVariable` interface (name, type, defaultValue) to @object-ui/types
- [x] Add `PageRegionWidth` = 'small' | 'medium' | 'large' | 'full' to @object-ui/types
- [x] Enhanced `PageRegion` (name, width, components, className) in @object-ui/types
- [x] Enhanced `PageSchema` with pageType, object, template, variables, regions, isDefault, assignedProfiles
- [x] Full Zod schemas: PageTypeSchema, PageVariableSchema, PageRegionSchema, PageRegionWidthSchema
- [x] `PageVariablesProvider` + `usePageVariables` hook in @object-ui/react
- [x] `useHasPageVariables` hook for context detection
- [x] Upgraded PageRenderer with type-aware routing (Record / Home / App / Utility layouts)
- [x] Region-based layout engine: header, sidebar, main, aside, footer named slots
- [x] Region width mapping (small→w-64, medium→w-80, large→w-96, full→w-full)
- [x] Page max-width by type (record→7xl, home→screen-2xl, app→screen-xl, utility→4xl)
- [x] Legacy body/children fallback for backward compatibility
- [x] Resolved duplicate 'page' registration between @object-ui/components and @object-ui/layout
- [x] 36 PageRenderer tests + 23 usePageVariables tests, all passing

**Remaining:**
- [x] Page.template support (5 predefined layout templates: default, header-main, header-sidebar-main, sidebar-main-aside, full-width)
- [x] Page.object data binding (auto-fetch record data via PageObjectContext)

---

#### 6. Widget System (WidgetManifest) ✅

**Spec Requirement:**
```typescript
WidgetManifest: {
  lifecycle: { onMount, onUpdate, onUnmount, ... }
  events: WidgetEvent[]
  properties: WidgetProperty[]
  implementation: 'npm' | 'remote' | 'inline'
}
```

**Current State:** Fully implemented. WidgetManifest types, Zod schemas, WidgetRegistry, and widget loading system.

**Completed:**
- [x] Add WidgetManifest types to @object-ui/types (WidgetManifest, WidgetProperty, WidgetEvent, WidgetLifecycle, WidgetSource, WidgetCatalog, LoadedWidget)
- [x] Implement dynamic widget loading (npm, remote, inline routing)
- [x] Widget lifecycle hooks (onMount, onUpdate, onUnmount, onError, onResize, onDataChange)
- [x] Widget property validation (validateWidgetProps — required, type, enum checks)
- [x] Widget default props application (applyWidgetDefaults)
- [x] WidgetRegistry class (register, catalog, search, category filter, load with caching, unregister)
- [x] Zod validation schemas for all widget types
- [x] Full test coverage (validateWidgetProps, applyWidgetDefaults, WidgetRegistry)

---

#### 7. Theme System Alignment ✅

**Spec Requirement:** Full theme schema with ColorPalette, Typography, Spacing, BorderRadius, Shadow, Breakpoints, Animation, ZIndex.

**Current State:** Fully aligned with @objectstack/spec v1.1.0. Complete ThemeEngine in core + ThemeProvider/useTheme in react.

**Completed:**
- [x] Realigned `Theme` interface with spec (name, label, mode, colors, typography, spacing, borderRadius, shadows, breakpoints, animation, zIndex, customVars, logo, extends)
- [x] Added `Shadow`, `Breakpoints`, `Animation`, `ZIndex`, `ThemeLogo` types to @object-ui/types
- [x] Aligned `ColorPalette` with spec (primary required, surface, textSecondary, primaryLight/Dark, secondaryLight/Dark, disabled)
- [x] Aligned `Typography` with spec (nested fontFamily/fontSize/fontWeight/lineHeight/letterSpacing)
- [x] Aligned `Spacing` with spec (explicit '0'–'24' scale keys)
- [x] Aligned `BorderRadius` with spec (none/sm/base/md/lg/xl/2xl/full)
- [x] Updated all Zod schemas (ColorPaletteSchema, TypographySchema, SpacingSchema, ShadowSchema, BreakpointsSchema, AnimationSchema, ZIndexSchema, ThemeDefinitionSchema)
- [x] `ThemeEngine` in @object-ui/core — `generateThemeVars()` converts Theme → CSS custom properties, `mergeThemes()`, `resolveThemeInheritance()`, `resolveMode()`, `hexToHSL()`/`toCSSColor()`
- [x] `ThemeProvider` + `useTheme()` + `useOptionalTheme()` in @object-ui/react — CSS var injection, mode class toggling, system preference detection, localStorage persistence, theme inheritance resolution
- [x] Branding support (logo.light, logo.dark, logo.favicon)
- [x] Legacy aliases (`ThemeDefinition` → `Theme`, `SpacingScale` → `Spacing`) for backward compatibility
- [x] Full test coverage: 57 ThemeEngine tests + 28 ThemeProvider tests (85 total)

---

#### 8. ViewData API Provider ✅

**Spec Requirement:**
```typescript
{ provider: 'api', read?: HttpRequest, write?: HttpRequest }
```

**Current State:** Fully implemented with three DataSource adapters and a unified React hook.

**Completed:**
- [x] `ApiDataSource` — HTTP-based adapter for `provider: 'api'` (GET/POST/PATCH/DELETE, URL building, response normalization for array/{data}/{items}/{results}/{records}/{value} shapes, header merging, configurable fetch)
- [x] `ValueDataSource` — In-memory adapter for `provider: 'value'` (filtering with $gt/$gte/$lt/$lte/$ne/$in/$contains, sorting, pagination, $search, full CRUD, auto-ID generation)
- [x] `resolveDataSource()` — Factory routing `ViewData.provider` → correct adapter (`'api'` → ApiDataSource, `'value'` → ValueDataSource, `'object'` → context fallback)
- [x] `useViewData` hook — React hook bridging ViewData → DataSource → reactive {data, loading, error, totalCount, refresh, fetchOne, hasMore}
- [x] Full test coverage: 26 ApiDataSource + 34 ValueDataSource + 13 resolveDataSource + 15 useViewData tests (88 total)

---

### 🟢 Low Priority / Future

#### 9. Expression System Enhancements ✅

- [x] Formula functions (SUM, AVG, MIN, MAX, COUNT, TODAY, NOW, YEAR, MONTH, DAY, DATEDIFF, DATEADD, IF, COALESCE, AND, OR, NOT, SWITCH, UPPER, LOWER, TRIM, CONCAT, LEN, SUBSTRING, CONTAINS, ROUND, FLOOR, CEIL, ABS, POWER, FIXED, PERCENT)
- [x] Standardized context protocol (data, record, user, form, page, params, env, index, parent) via buildStandardContext + ExpressionEvaluator.fromStandardContext factory

#### 10. Report System

- [ ] Report export (PDF, Excel)
- [ ] Report scheduling
- [ ] Aggregation formula engine

#### 11. Layout System ✅

- [x] Responsive grid layout (GridSchema with responsive columns object: { xs, sm, md, lg, xl })
- [x] Multi-column layout components (ColumnsSchema with presets: equal-2/3/4, sidebar-main, golden, etc.)
- [x] Layout templates (LayoutTemplateSchema with named slots and 5 arrangements)

---

## Implementation Phases

### Phase 1: Form Variants (v0.6.0)

**Timeline:** 2-3 weeks

**Scope:**
1. Refactor ObjectForm to support FormView.type
2. Implement TabbedForm component
3. Implement WizardForm component
4. Add section/group support
5. Add FormField.colSpan, dependsOn, widget

**Deliverables:**
- [x] packages/plugin-form/src/TabbedForm.tsx
- [x] packages/plugin-form/src/WizardForm.tsx
- [x] packages/plugin-form/src/FormSection.tsx
- [x] Updated ObjectForm with type routing

---

### Phase 2: Action System (v0.7.0)

**Timeline:** 2-3 weeks

**Scope:**
1. Extend ActionRunner for all action types
2. Implement action location-based rendering
3. Add ActionButton, ActionMenu, ActionGroup components
4. ActionParam collection UI

**Deliverables:**
- [x] packages/core/src/action/handlers/ (script, modal, flow, api)
- [x] packages/components/src/custom/action-button.tsx
- [x] packages/components/src/custom/action-menu.tsx
- [x] ActionLocationRenderer utility
- [x] ActionParamCollector dialog

---

### Phase 3: Navigation System (v0.8.0)

**Timeline:** 1-2 weeks

**Scope:**
1. Add NavigationConfig to types
2. Implement all navigation modes in grid/list/detail plugins
3. Create NavigationProvider for centralized control

**Deliverables:**
- [x] packages/types/src/navigation.ts
- [x] packages/react/src/NavigationProvider.tsx
- [x] Updated plugin-grid, plugin-list, plugin-detail

---

### Phase 4: Page & Theme (v0.9.0)

**Timeline:** 2 weeks

**Scope:**
1. Full Page system implementation
2. Theme system alignment with spec
3. ThemeProvider for runtime theming

**Deliverables:**
- [x] packages/types/src/page.ts (enhanced)
- [x] packages/types/src/theme.ts (aligned)
- [x] packages/layout/src/PageRenderer.tsx
- [x] packages/react/src/ThemeProvider.tsx

---

### Phase 5: Widget System & Polish (v1.0.0)

**Timeline:** 2-3 weeks

**Scope:**
1. WidgetManifest implementation
2. Dynamic widget loading
3. Documentation completion
4. Full spec compliance audit

**Deliverables:**
- [x] packages/core/src/widget/ (loader, lifecycle, registry)
- [ ] Full documentation update
- [ ] Spec compliance test suite

---

## Success Metrics

- [x] All `@objectstack/spec/ui` types have corresponding runtime implementations
- [x] All 6 form variants working with examples
- [x] All 5 action types executable
- [x] All 7 navigation modes functional
- [ ] 100% spec coverage in automated tests
- [ ] Complete Storybook examples for all components

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

When implementing spec features:
1. Reference the Zod schema in `@objectstack/spec/ui`
2. Update types in `@object-ui/types` first
3. Implement in appropriate package
4. Add Storybook story
5. Update documentation in `content/docs/`
