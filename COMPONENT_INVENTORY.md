# ObjectUI Component Inventory & Development Plan

> 📅 **Last Updated**: January 21, 2026  
> 🎯 **Purpose**: Organize existing components and prioritize development based on ObjectStack client integration  
> 👥 **Maintained by**: ObjectStack Team

---

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Component Inventory](#current-component-inventory)
3. [ObjectStack Client Integration](#objectstack-client-integration)
4. [Gap Analysis](#gap-analysis)
5. [Priority Development Plan](#priority-development-plan)
6. [Component Development Roadmap](#component-development-roadmap)

---

## Executive Summary

### Overview
ObjectUI has successfully integrated the **ObjectStack Client** (`@objectstack/client@^0.1.1`) and **ObjectStack Spec** (`@objectstack/spec@^0.1.2`), establishing a solid foundation for universal, protocol-driven UI components.

### Current Status
- **Total Components**: 60+ components across 9 categories
- **Core Packages**: 13+ packages (stable architecture)
- **Plugin System**: 5 plugin packages (charts, editor, kanban, markdown, object)
- **ObjectStack Integration**: ✅ Completed (DataSource adapter fully functional)
- **Test Coverage**: ~70% (target: 85%+)

### Key Achievement
The **ObjectStackAdapter** is now fully operational, providing:
- ✅ Full CRUD operations (find, findOne, create, update, delete)
- ✅ Bulk operations (createMany, updateMany, deleteMany)
- ✅ Filter conversion (MongoDB-like → ObjectStack AST)
- ✅ Query parameter mapping (OData → ObjectStack)
- ✅ Auto-discovery of server capabilities

---

## Current Component Inventory

### 1. Basic Components (8 components)
**Package**: `@object-ui/components/renderers/basic`

| Component | Type | Status | Description |
|-----------|------|--------|-------------|
| Div | `div` | ✅ Stable | Generic container element |
| Span | `span` | ✅ Stable | Inline text container |
| Text | `text` | ✅ Stable | Text display component |
| HTML | `html` | ✅ Stable | Raw HTML rendering |
| Icon | `icon` | ✅ Stable | Lucide icon display |
| Image | `image` | ✅ Stable | Image component with fallback |
| Separator | `separator` | ✅ Stable | Horizontal/vertical divider |

**ObjectStack Compatibility**: ✅ All components extend `UIComponent` from `@objectstack/spec`

### 2. Form Components (16 components)
**Package**: `@object-ui/components/renderers/form`

| Component | Type | Status | ObjectStack Integration | Notes |
|-----------|------|--------|-------------------------|-------|
| Form | `form` | ✅ Stable | ✅ Ready | Full form submission with validation |
| Input | `input` | ✅ Stable | ✅ Ready | Text input with variants |
| Textarea | `textarea` | ✅ Stable | ✅ Ready | Multi-line text input |
| Select | `select` | ✅ Stable | ✅ Ready | Dropdown selection |
| Checkbox | `checkbox` | ✅ Stable | ✅ Ready | Boolean input |
| Radio Group | `radio-group` | ✅ Stable | ✅ Ready | Single selection from options |
| Switch | `switch` | ✅ Stable | ✅ Ready | Toggle switch |
| Button | `button` | ✅ Stable | ✅ Ready | Action trigger |
| Label | `label` | ✅ Stable | ✅ Ready | Form field label |
| Slider | `slider` | ✅ Stable | ✅ Ready | Range input |
| Toggle | `toggle` | ✅ Stable | ✅ Ready | Toggle button |
| Calendar | `calendar` | ✅ Stable | ✅ Ready | Date selection calendar |
| Date Picker | `date-picker` | ✅ Stable | ✅ Ready | Date input with picker |
| Input OTP | `input-otp` | ✅ Stable | ✅ Ready | One-time password input |
| File Upload | `file-upload` | ✅ Stable | 🔄 Partial | Needs ObjectStack file storage integration |

**ObjectStack Priority**: 
- 🔴 **High**: File Upload (needs backend storage integration)
- 🟡 **Medium**: Form validation with ObjectStack metadata

### 3. Layout Components (9 components)
**Package**: `@object-ui/components/renderers/layout`

| Component | Type | Status | ObjectStack Integration | Notes |
|-----------|------|--------|-------------------------|-------|
| Container | `container` | ✅ Stable | ✅ Ready | Responsive container |
| Grid | `grid` | ✅ Stable | ✅ Ready | CSS Grid layout |
| Flex | `flex` | ✅ Stable | ✅ Ready | Flexbox layout |
| Stack | `stack` | ✅ Stable | ✅ Ready | Vertical/horizontal stack |
| Card | `card` | ✅ Stable | ✅ Ready | Content card |
| Tabs | `tabs` | ✅ Stable | ✅ Ready | Tabbed interface |
| Page | `page` | ✅ Stable | ✅ Ready | Page wrapper |
| Semantic | `semantic` | ✅ Stable | ✅ Ready | Semantic HTML elements |

**ObjectStack Priority**: All layout components are ready for ObjectStack integration.

### 4. Data Display Components (7 components)
**Package**: `@object-ui/components/renderers/data-display`

| Component | Type | Status | ObjectStack Integration | Notes |
|-----------|------|--------|-------------------------|-------|
| Alert | `alert` | ✅ Stable | ✅ Ready | Alert messages |
| Avatar | `avatar` | ✅ Stable | ✅ Ready | User avatar display |
| Badge | `badge` | ✅ Stable | ✅ Ready | Status badge |
| List | `list` | ✅ Stable | ✅ Ready | Simple list display |
| Statistic | `statistic` | ✅ Stable | ✅ Ready | Metric card |
| Tree View | `tree-view` | ✅ Stable | 🔄 Partial | Needs ObjectStack hierarchical data support |

**ObjectStack Priority**:
- 🔴 **High**: Tree View (needs hierarchical query support)
- 🟡 **Medium**: List (enhance with ObjectStack pagination)

### 5. Complex Components (10 components)
**Package**: `@object-ui/components/renderers/complex`

| Component | Type | Status | ObjectStack Integration | Priority | Notes |
|-----------|------|--------|-------------------------|----------|-------|
| Data Table | `data-table` | ✅ Stable | ✅ Ready | 🟢 Complete | Full CRUD with ObjectStackAdapter |
| Table | `table` | ✅ Stable | ✅ Ready | 🟢 Complete | Basic table rendering |
| Calendar View | `calendar-view` | ✅ Stable | 🔄 Partial | 🟡 Medium | Needs event management integration |
| Carousel | `carousel` | ✅ Stable | ✅ Ready | 🟢 Complete | Image/content carousel |
| Chatbot | `chatbot` | ✅ Stable | 🔄 Partial | 🟡 Medium | Needs AI/messaging integration |
| Filter Builder | `filter-builder` | ✅ Stable | 🔄 Partial | 🔴 Critical | **KEY**: Convert UI filters to ObjectStack FilterNode AST |
| Resizable | `resizable` | ✅ Stable | ✅ Ready | 🟢 Complete | Resizable panels |
| Scroll Area | `scroll-area` | ✅ Stable | ✅ Ready | 🟢 Complete | Custom scrollbars |
| Timeline | `timeline` | ✅ Stable | ✅ Ready | 🟢 Complete | Event timeline |

**ObjectStack Priority**:
- 🔴 **Critical**: Filter Builder (directly maps to ObjectStack query filters)
- 🟡 **Medium**: Calendar View (event CRUD operations)
- 🟡 **Medium**: Chatbot (message persistence)

### 6. Navigation Components (2 components)
**Package**: `@object-ui/components/renderers/navigation`

| Component | Type | Status | ObjectStack Integration | Notes |
|-----------|------|--------|-------------------------|-------|
| Header Bar | `header-bar` | ✅ Stable | ✅ Ready | Application header |
| Sidebar | `sidebar` | ✅ Stable | 🔄 Partial | Needs menu structure from ObjectStack |

**ObjectStack Priority**:
- 🟡 **Medium**: Sidebar (dynamic menu from ObjectStack metadata)

### 7. Overlay Components (9 components)
**Package**: `@object-ui/components/renderers/overlay`

| Component | Type | Status | Notes |
|-----------|------|--------|-------|
| Dialog | `dialog` | ✅ Stable | Modal dialog |
| Alert Dialog | `alert-dialog` | ✅ Stable | Confirmation dialog |
| Drawer | `drawer` | ✅ Stable | Side panel |
| Sheet | `sheet` | ✅ Stable | Bottom sheet |
| Popover | `popover` | ✅ Stable | Popover overlay |
| Tooltip | `tooltip` | ✅ Stable | Tooltip display |
| Dropdown Menu | `dropdown-menu` | ✅ Stable | Dropdown menu |
| Context Menu | `context-menu` | ✅ Stable | Right-click menu |
| Hover Card | `hover-card` | ✅ Stable | Hover card display |

**ObjectStack Priority**: All overlay components are ready (UI-only, no data integration needed).

### 8. Feedback Components (4 components)
**Package**: `@object-ui/components/renderers/feedback`

| Component | Type | Status | Notes |
|-----------|------|--------|-------|
| Loading | `loading` | ✅ Stable | Loading indicator |
| Progress | `progress` | ✅ Stable | Progress bar |
| Skeleton | `skeleton` | ✅ Stable | Skeleton loader |
| Toaster | `toaster` | ✅ Stable | Toast notifications |

**ObjectStack Priority**: All feedback components are ready (UI-only).

### 9. Disclosure Components (2 components)
**Package**: `@object-ui/components/renderers/disclosure`

| Component | Type | Status | Notes |
|-----------|------|--------|-------|
| Accordion | `accordion` | ✅ Stable | Accordion panel |
| Collapsible | `collapsible` | ✅ Stable | Collapsible content |

**ObjectStack Priority**: All disclosure components are ready (UI-only).

---

## Plugin Components

### 10. Chart Components (3 components)
**Package**: `@object-ui/plugin-charts`

| Component | Type | Status | ObjectStack Integration | Priority |
|-----------|------|--------|-------------------------|----------|
| Chart | `chart` | 🔄 Beta | 🔄 Partial | 🔴 High |
| Advanced Chart | `advanced-chart` | 🔄 Beta | 🔄 Partial | 🟡 Medium |
| Chart Container | `chart-container` | 🔄 Beta | ✅ Ready | 🟢 Complete |

**ObjectStack Priority**:
- 🔴 **High**: Chart data binding to ObjectStack queries
- 🟡 **Medium**: Real-time chart updates from ObjectStack events

### 11. Editor Components (1 component)
**Package**: `@object-ui/plugin-editor`

| Component | Type | Status | ObjectStack Integration | Priority |
|-----------|------|--------|-------------------------|----------|
| Monaco Editor | `monaco-editor` | 🔄 Beta | 🔄 Partial | 🟡 Medium |

**ObjectStack Priority**:
- 🟡 **Medium**: Code persistence to ObjectStack storage

### 12. Kanban Component (1 component)
**Package**: `@object-ui/plugin-kanban`

| Component | Type | Status | ObjectStack Integration | Priority |
|-----------|------|--------|-------------------------|----------|
| Kanban | `kanban` | 🔄 Beta | 🔴 Critical | 🔴 Critical |

**ObjectStack Priority**:
- 🔴 **Critical**: Full CRUD with ObjectStackAdapter
- 🔴 **Critical**: Drag-and-drop state persistence
- 🔴 **Critical**: Real-time collaboration support

### 13. Markdown Component (1 component)
**Package**: `@object-ui/plugin-markdown`

| Component | Type | Status | ObjectStack Integration | Priority |
|-----------|------|--------|-------------------------|----------|
| Markdown | `markdown` | 🔄 Beta | 🔄 Partial | 🟡 Medium |

**ObjectStack Priority**:
- 🟡 **Medium**: Content loading from ObjectStack

### 14. Object Components (2 components)
**Package**: `@object-ui/plugin-object`

| Component | Type | Status | ObjectStack Integration | Priority |
|-----------|------|--------|-------------------------|----------|
| Object Table | `object-table` | 🔄 Beta | 🔄 Partial | 🔴 Critical |
| Object Form | `object-form` | 🔄 Beta | 🔄 Partial | 🔴 Critical |

**ObjectStack Priority**:
- 🔴 **Critical**: These are THE flagship components for ObjectStack integration
- 🔴 **Critical**: Auto-generate UI from ObjectStack metadata
- 🔴 **Critical**: Full CRUD with validation from server schema

---

## ObjectStack Client Integration

### Current Integration Status

#### ✅ Completed
1. **ObjectStackAdapter** (`@object-ui/core/adapters`)
   - Full CRUD operations implemented
   - Filter conversion (MongoDB → ObjectStack AST)
   - Query parameter mapping (OData → ObjectStack)
   - Bulk operations support
   - Error handling and null safety

2. **Dependencies**
   - `@objectstack/client@^0.1.1` - Integrated
   - `@objectstack/spec@^0.1.2` - Integrated
   - Type safety across packages

3. **Documentation**
   - Migration guide (`MIGRATION_GUIDE_OBJECTSTACK.md`)
   - Adapter README (`packages/core/src/adapters/README.md`)
   - Architecture docs updated

### ObjectStack Client Capabilities

The ObjectStack Client provides the following features that ObjectUI can leverage:

#### 1. Data Operations
```typescript
interface ObjectStackClient {
  // Data CRUD
  data.find<T>(resource: string, options?: QueryOptions): Promise<QueryResult<T>>
  data.get<T>(resource: string, id: string): Promise<T>
  data.create<T>(resource: string, data: Partial<T>): Promise<T>
  data.update<T>(resource: string, id: string, data: Partial<T>): Promise<T>
  data.delete(resource: string, id: string): Promise<DeleteResult>
  data.createMany<T>(resource: string, data: Partial<T>[]): Promise<T[]>
  data.deleteMany(resource: string, ids: string[]): Promise<DeleteResult>
  
  // Metadata
  meta.getObject(name: string): Promise<ObjectMetadata>
  meta.getField(objectName: string, fieldName: string): Promise<FieldMetadata>
  meta.listObjects(): Promise<ObjectMetadata[]>
}
```

#### 2. Query Capabilities
- **Filtering**: FilterNode AST (complex nested conditions)
- **Sorting**: Multi-field sort
- **Pagination**: Skip/top pagination
- **Selection**: Field selection (sparse fieldsets)
- **Expansion**: Related entity loading (future)

#### 3. Metadata API
- Object definitions
- Field definitions
- Validation rules
- Relationships
- Permissions (future)

---

## Gap Analysis

### Critical Gaps (Must Address for v1.0)

#### 1. 🔴 Filter Builder → ObjectStack Integration
**Current State**: Filter Builder exists but doesn't integrate with ObjectStackAdapter  
**Required**: 
- UI for building FilterNode AST
- Convert filter UI state to ObjectStack query format
- Preview and validate filter expressions
- Save/load filter presets

**Impact**: High - This is critical for data querying

#### 2. 🔴 Object Components Completion
**Current State**: ObjectTable and ObjectForm are in beta  
**Required**:
- Auto-generate table columns from ObjectStack metadata
- Auto-generate form fields from ObjectStack metadata
- Field validation from ObjectStack rules
- Relationship handling (lookups, master-detail)

**Impact**: Critical - These are the flagship components

#### 3. 🔴 Kanban Full Integration
**Current State**: Basic Kanban exists, no ObjectStack integration  
**Required**:
- CRUD operations via ObjectStackAdapter
- Drag-and-drop state persistence
- Real-time updates from server
- Conflict resolution

**Impact**: High - Popular component for project management

### High Priority Gaps

#### 4. 🟡 File Upload Backend Integration
**Current State**: File Upload UI exists, no storage integration  
**Required**:
- ObjectStack file storage adapter
- Upload progress tracking
- File metadata management
- Preview and download

**Impact**: High - Common requirement

#### 5. 🟡 Tree View Hierarchical Queries
**Current State**: Tree View exists, no hierarchical data support  
**Required**:
- Load tree data from ObjectStack
- Lazy loading of child nodes
- Expand/collapse state persistence
- Search within tree

**Impact**: Medium - Needed for organizational hierarchies

#### 6. 🟡 Chart Data Binding
**Current State**: Charts render static data  
**Required**:
- Bind chart data to ObjectStack queries
- Automatic refresh on data changes
- Aggregation query support
- Export chart data

**Impact**: Medium - Common in dashboards

### Medium Priority Gaps

#### 7. 🟢 Real-time Updates
**Current State**: No real-time support  
**Required**:
- WebSocket integration (future ObjectStack capability)
- Optimistic updates
- Conflict resolution
- Event subscriptions

**Impact**: Medium - Future enhancement

#### 8. 🟢 Advanced Validation
**Current State**: Basic form validation  
**Required**:
- Validation rules from ObjectStack metadata
- Custom validation functions
- Async validation
- Cross-field validation

**Impact**: Medium - Improves data quality

---

## Priority Development Plan

### Phase 1: Critical ObjectStack Integration (Weeks 1-4)

#### Week 1-2: Object Components Enhancement
**Goal**: Complete ObjectTable and ObjectForm with full ObjectStack integration

**Tasks**:
- [ ] Implement metadata-driven column generation for ObjectTable
  - [ ] Fetch object metadata from ObjectStack
  - [ ] Map field types to column renderers
  - [ ] Support field-level permissions
  - [ ] Add column customization API
- [ ] Implement metadata-driven field generation for ObjectForm
  - [ ] Fetch object metadata from ObjectStack
  - [ ] Map field types to form controls
  - [ ] Apply validation rules from metadata
  - [ ] Support field dependencies
- [ ] Add CRUD operations via ObjectStackAdapter
  - [ ] Create operation with validation
  - [ ] Update with optimistic updates
  - [ ] Delete with confirmation
  - [ ] Bulk operations support
- [ ] Write comprehensive tests (85%+ coverage)
- [ ] Create showcase examples

**Success Criteria**:
- ✅ Can generate full CRUD UI from ObjectStack metadata
- ✅ All operations work correctly
- ✅ Validation rules enforced
- ✅ Test coverage ≥ 85%

#### Week 3: Filter Builder Integration
**Goal**: Enable visual filter building with ObjectStack query generation

**Tasks**:
- [ ] Design FilterNode AST builder UI
  - [ ] Field selector from metadata
  - [ ] Operator selector (=, !=, >, <, in, contains, etc.)
  - [ ] Value input with type validation
  - [ ] Group conditions (AND/OR)
- [ ] Implement filter to AST conversion
  - [ ] Convert UI state to FilterNode format
  - [ ] Support nested conditions
  - [ ] Handle all filter operators
  - [ ] Validate filter expressions
- [ ] Integrate with DataTable and ObjectTable
  - [ ] Apply filters to queries
  - [ ] Show active filters
  - [ ] Save/load filter presets
  - [ ] Clear filters
- [ ] Add filter preview and debugging
- [ ] Write tests and documentation

**Success Criteria**:
- ✅ Users can build complex filters visually
- ✅ Filters correctly convert to ObjectStack queries
- ✅ Integration works seamlessly with tables

#### Week 4: Kanban Integration
**Goal**: Full ObjectStack integration for Kanban component

**Tasks**:
- [ ] Connect Kanban to ObjectStackAdapter
  - [ ] Load cards from ObjectStack query
  - [ ] Support board/column configuration
  - [ ] Implement card CRUD operations
- [ ] Implement drag-and-drop persistence
  - [ ] Save card position changes
  - [ ] Update card status on column change
  - [ ] Handle concurrent modifications
- [ ] Add Kanban customization
  - [ ] Custom card renderer
  - [ ] Column configuration
  - [ ] Filters and search
  - [ ] Sort options
- [ ] Optimize performance for large boards
- [ ] Write tests and documentation

**Success Criteria**:
- ✅ Kanban board fully functional with ObjectStack
- ✅ Drag-and-drop works reliably
- ✅ Performance is acceptable (1000+ cards)

### Phase 2: High Priority Components (Weeks 5-6)

#### Week 5: File Upload Integration
**Goal**: Implement file storage with ObjectStack

**Tasks**:
- [ ] Design file storage adapter interface
- [ ] Implement ObjectStack file storage adapter
  - [ ] Upload files to ObjectStack
  - [ ] Generate file metadata
  - [ ] Handle progress events
  - [ ] Support multiple files
- [ ] Enhance File Upload component
  - [ ] Progress indicators
  - [ ] Preview for images
  - [ ] File list management
  - [ ] Error handling
- [ ] Add file download and deletion
- [ ] Write tests and documentation

**Success Criteria**:
- ✅ Files can be uploaded to ObjectStack
- ✅ Progress tracking works
- ✅ Preview and download work

#### Week 6: Chart Data Binding & Tree View
**Goal**: Enable dynamic data binding for charts and hierarchical data for trees

**Tasks**:
- [ ] Chart data binding
  - [ ] Bind chart series to ObjectStack queries
  - [ ] Support aggregation queries
  - [ ] Auto-refresh on data changes
  - [ ] Add loading states
- [ ] Tree View hierarchical queries
  - [ ] Load tree structure from ObjectStack
  - [ ] Implement lazy loading
  - [ ] Support expand/collapse
  - [ ] Add search functionality
- [ ] Write tests and documentation

**Success Criteria**:
- ✅ Charts display live data from ObjectStack
- ✅ Tree View handles hierarchical data efficiently

### Phase 3: Polish and Documentation (Week 7-8)

#### Week 7: Testing and Bug Fixes
**Goal**: Achieve 85%+ test coverage and fix critical bugs

**Tasks**:
- [ ] Write missing unit tests
- [ ] Add integration tests for ObjectStack components
- [ ] Add E2E tests for critical flows
- [ ] Fix identified bugs
- [ ] Performance optimization
- [ ] Accessibility audit

#### Week 8: Documentation and Examples
**Goal**: Complete documentation for all ObjectStack integrations

**Tasks**:
- [ ] Update API documentation
- [ ] Create integration guides
- [ ] Add showcase examples
- [ ] Record video tutorials
- [ ] Update migration guide
- [ ] Prepare release notes

---

## Component Development Roadmap

### Immediate (Q1 2026 - v1.0)
**Focus**: ObjectStack Integration Completion

1. ✅ ObjectStackAdapter (Completed)
2. 🔴 ObjectTable enhancement (Weeks 1-2)
3. 🔴 ObjectForm enhancement (Weeks 1-2)
4. 🔴 Filter Builder integration (Week 3)
5. 🔴 Kanban integration (Week 4)
6. 🟡 File Upload integration (Week 5)
7. 🟡 Chart data binding (Week 6)
8. 🟡 Tree View hierarchical data (Week 6)

### Short Term (Q2 2026 - v1.1)
**Focus**: Advanced Features

1. Advanced Data Grid (virtual scrolling, grouping, pivoting)
2. Real-time collaboration (when ObjectStack supports WebSocket)
3. Advanced validation (cross-field, async, custom rules)
4. Relationship management (lookups, master-detail)
5. Bulk operations UI (batch edit, mass delete)
6. Data import/export (CSV, Excel)

### Medium Term (Q3 2026 - v1.2)
**Focus**: Enterprise Features

1. Advanced permissions UI (based on ObjectStack RBAC)
2. Audit trail viewer
3. Workflow builder
4. Report builder
5. Dashboard builder
6. Mobile components (optimized for mobile)

### Long Term (Q4 2026+)
**Focus**: Innovation

1. AI-powered schema generation
2. Natural language to filter queries
3. Smart recommendations
4. Predictive analytics
5. 3D data visualizations

---

## Success Metrics

### Technical Metrics
| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| ObjectStack Integration | 100% of data components | ~40% | 🔴 In Progress |
| Test Coverage | ≥ 85% | ~70% | 🟡 Improving |
| Bundle Size | < 50KB | ~45KB | ✅ Good |
| Performance (TTI) | < 2s | ~1.5s | ✅ Good |

### Component Completion
| Category | Total | Completed | In Progress | Planned |
|----------|-------|-----------|-------------|---------|
| Basic | 8 | 8 | 0 | 0 |
| Form | 16 | 15 | 1 | 0 |
| Layout | 9 | 9 | 0 | 0 |
| Data Display | 7 | 6 | 1 | 0 |
| Complex | 10 | 7 | 3 | 0 |
| Navigation | 2 | 1 | 1 | 0 |
| Overlay | 9 | 9 | 0 | 0 |
| Feedback | 4 | 4 | 0 | 0 |
| Disclosure | 2 | 2 | 0 | 0 |
| **Plugins** | | | | |
| Charts | 3 | 0 | 3 | 0 |
| Editor | 1 | 0 | 1 | 0 |
| Kanban | 1 | 0 | 1 | 0 |
| Markdown | 1 | 0 | 1 | 0 |
| Object | 2 | 0 | 2 | 0 |
| **TOTAL** | **75** | **61** | **14** | **0** |

---

## Implementation Guidelines

### For ObjectStack-Integrated Components

#### 1. Use ObjectStackAdapter
```typescript
import { createObjectStackAdapter } from '@object-ui/core';

const dataSource = createObjectStackAdapter({
  baseUrl: process.env.API_URL,
  token: process.env.API_TOKEN
});
```

#### 2. Leverage Metadata API
```typescript
// Auto-generate UI from metadata
const metadata = await client.meta.getObject('contact');
const columns = metadata.fields.map(field => ({
  header: field.label,
  accessorKey: field.name,
  type: field.type
}));
```

#### 3. Use FilterNode AST for Queries
```typescript
// Convert UI filters to ObjectStack format
const filters: FilterNode = ['and',
  ['status', '=', 'active'],
  ['age', '>=', 18]
];

const result = await dataSource.find('users', {
  $filter: { status: 'active', age: { $gte: 18 } } // Auto-converts to AST
});
```

#### 4. Handle Loading and Error States
```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  dataSource.find('users')
    .then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
```

#### 5. Implement Optimistic Updates
```typescript
const handleUpdate = async (id: string, data: any) => {
  // Update UI immediately
  setItems(items.map(item => item.id === id ? { ...item, ...data } : item));
  
  try {
    // Persist to server
    await dataSource.update('users', id, data);
  } catch (error) {
    // Rollback on error
    setItems(originalItems);
    showError('Update failed');
  }
};
```

---

## Appendix

### References
- [ObjectStack Client Documentation](https://github.com/objectstack-ai/client)
- [ObjectStack Spec Documentation](https://github.com/objectstack-ai/spec)
- [ObjectUI Architecture](./docs/community/architecture/specs/architecture.md)
- [ObjectStack Integration Guide](./docs/community/architecture/objectstack-spec-integration.md)
- [Development Plan](./docs/community/contributing/development-plan.md)

### Related Documents
- [MIGRATION_GUIDE_OBJECTSTACK.md](./MIGRATION_GUIDE_OBJECTSTACK.md)
- [packages/core/src/adapters/README.md](./packages/core/src/adapters/README.md)
- [Development Plan](./docs/community/contributing/development-plan.md)
- [Project Status](./docs/community/contributing/project-status.md)
- [Roadmap](./docs/community/contributing/roadmap.md)

---

<div align="center">

**Building the future of Schema-Driven UI with ObjectStack** 🚀

[GitHub](https://github.com/objectstack-ai/objectui) · [Documentation](https://objectui.org) · [ObjectStack](https://objectstack.ai)

</div>
