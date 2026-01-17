# Component Metadata Specification

Components are the reusable building blocks of ObjectQL's user interface. This specification defines how to create, configure, and customize frontend components in a metadata-driven way.

## 1. Overview

ObjectQL provides a **component system** that enables:

1. **Built-in Components**: Pre-built, production-ready components (ObjectTable, ObjectForm, etc.)
2. **Component Customization**: Override and extend built-in components
3. **Custom Components**: Create completely new component types
4. **Component Libraries**: Package and share collections of components
5. **Type-Safe Integration**: Full TypeScript support with metadata validation

**File Naming Convention:** `<component_name>.component.yml`

The filename (without `.component.yml`) becomes the component identifier.

**Examples:**
- `custom_table.component.yml` → Component name: `custom_table`
- `advanced_form.component.yml` → Component name: `advanced_form`

## 2. Why Component Metadata?

Traditional component systems tightly couple the UI implementation to the framework. ObjectQL's component metadata provides:

- **Framework Agnostic**: Components can be React, Vue, Svelte, or Web Components
- **AI-Understandable**: LLMs can reason about component capabilities and usage
- **Discoverable**: Components are self-documenting with metadata
- **Overridable**: Replace built-in components without forking
- **Composable**: Mix built-in and custom components seamlessly

## 3. Built-in Components

ObjectQL provides these core components out of the box:

### Data Display Components

| Component | Purpose | Key Features |
|:---|:---|:---|
| `ObjectTable` | Display records in a table | Sorting, filtering, pagination, inline editing |
| `ObjectList` | Display records as a list | Card-based layout, responsive design |
| `ObjectCardList` | Display records as cards | Grid layout, customizable card templates |
| `ObjectDetail` | Display a single record | Field groups, related lists, actions |
| `RelatedList` | Display related records | Embedded table/list, inline creation |

### Data Entry Components

| Component | Purpose | Key Features |
|:---|:---|:---|
| `ObjectForm` | Create/edit records | Sections, tabs, validation, wizards |
| `QuickCreateForm` | Fast record creation | Minimal fields, modal-based |
| `FieldInput` | Single field input | Type-specific rendering, validation |
| `LookupField` | Reference another object | Search, autocomplete, inline creation |

### Layout Components

| Component | Purpose | Key Features |
|:---|:---|:---|
| `GridLayout` | Grid-based layout | Responsive, drag-and-drop |
| `Section` | Group content | Collapsible, conditional visibility |
| `TabContainer` | Tab-based navigation | Lazy loading, state management |
| `Modal` | Modal dialogs | Size variants, animations |
| `Drawer` | Side panel | Position (left/right), overlay |

### Navigation Components

| Component | Purpose | Key Features |
|:---|:---|:---|
| `NavBar` | Top navigation | Branding, search, user menu |
| `Sidebar` | Side navigation | Collapsible, nested menus |
| `Breadcrumb` | Navigation trail | Auto-generation, clickable |
| `Menu` | Navigation menu | Hierarchical, icons, badges |

### Visualization Components

| Component | Purpose | Key Features |
|:---|:---|:---|
| `Chart` | Data visualization | Bar, line, pie, area charts |
| `Metric` | Display KPI | Trend indicators, comparisons |
| `KanbanBoard` | Kanban view | Drag-and-drop, WIP limits |
| `Calendar` | Calendar view | Day/week/month views, events |
| `Timeline` | Timeline/Gantt | Project timelines, dependencies |

## 4. Component Metadata Structure

```yaml
# File: custom_table.component.yml

name: custom_table
label: Custom Data Table
description: An enhanced table component with advanced filtering
category: data_display
version: 1.0.0
author: MyCompany

# Implementation
implementation: ./components/CustomTable.tsx
framework: react
render_mode: client

# This component extends the built-in ObjectTable
extends: ObjectTable

# Component properties
props:
  - name: data
    type: array
    description: Array of records to display
    required: true
    
  - name: columns
    type: array
    description: Column definitions
    required: true
    examples:
      - [{ field: 'name', label: 'Name' }]
    
  - name: sortable
    type: boolean
    description: Enable column sorting
    default: true
    
  - name: filterable
    type: boolean
    description: Enable filtering
    default: true
    
  - name: pageSize
    type: number
    description: Records per page
    default: 25
    validation:
      min: 10
      max: 100

# Events this component emits
events:
  - name: onRowClick
    description: Fired when a row is clicked
    payload: "{ row: Record, index: number }"
    examples:
      - scenario: User clicks on a row
        payload: { row: { id: 1, name: 'Project A' }, index: 0 }
  
  - name: onSort
    description: Fired when sorting changes
    payload: "{ column: string, direction: 'asc' | 'desc' }"

# Component methods
methods:
  - name: refresh
    description: Reload table data
    parameters: []
    returns: Promise<void>
    
  - name: exportToCSV
    description: Export table data to CSV
    parameters:
      - name: filename
        type: string
        required: false
    returns: void

# Styling
styling:
  framework: tailwind
  customizable:
    - name: headerBg
      description: Table header background color
      type: color
      default: 'bg-gray-100'
    
    - name: rowHeight
      description: Row height
      type: size
      default: 'h-12'

# Accessibility
accessibility:
  role: grid
  keyboard_navigation: true
  screen_reader: true
  aria_attributes:
    - aria-label
    - aria-sort
    - aria-rowcount

# Performance
performance:
  lazy_loadable: true
  bundle_size: 45
  complexity: medium
  virtual_scroll: true

# Features
features:
  realtime: true
  offline: false
  i18n: true
  themeable: true
  responsive: true
  exportable: true

# AI Context
ai_context:
  purpose: "Display tabular data with advanced filtering and sorting capabilities"
  use_cases:
    - "Displaying lists of business objects (projects, tasks, customers)"
    - "Data exploration and analysis"
    - "Record selection interfaces"
  best_practices:
    - "Use virtual scrolling for large datasets (>1000 rows)"
    - "Provide clear column headers with sort indicators"
    - "Include search/filter for tables with >20 rows"
  common_mistakes:
    - "Loading all data at once without pagination"
    - "Not providing keyboard navigation"
    - "Missing loading states"

# Examples
examples:
  - title: Basic Usage
    description: Simple table with sorting
    code: |
      <ObjectTable
        object="projects"
        columns={[
          { field: 'name', label: 'Project Name' },
          { field: 'status', label: 'Status' },
          { field: 'owner', label: 'Owner' }
        ]}
        sortable={true}
        pageSize={25}
      />
  
  - title: With Custom Actions
    description: Table with row actions
    code: |
      <CustomTable
        data={projects}
        columns={columns}
        onRowClick={(row) => navigate(`/projects/${row.id}`)}
        actions={[
          { label: 'Edit', icon: 'edit', onClick: handleEdit },
          { label: 'Delete', icon: 'delete', onClick: handleDelete }
        ]}
      />
```

## 5. Overriding Built-in Components

To replace a built-in component (e.g., `ObjectTable`), create a component with the same name:

```yaml
# File: ObjectTable.component.yml

name: ObjectTable  # Same name as built-in
label: Custom Object Table
description: Custom implementation of ObjectTable
category: data_display

# Your custom implementation
implementation: ./components/MyCustomTable.tsx
framework: react

# Indicate this overrides the built-in component
extends: ObjectTable

# Define the same props as the original (or extend them)
props:
  - name: object
    type: string
    required: true
  
  - name: columns
    type: array
    required: false
  
  # Add your custom props
  - name: customFeature
    type: boolean
    default: false

# ... rest of configuration
```

When ObjectQL loads components, custom components with the same name as built-in components will **override** the built-in ones.

## 6. Creating Custom Components

Create completely new component types:

```yaml
# File: project_timeline.component.yml

name: project_timeline
label: Project Timeline
description: Interactive timeline for project planning
category: visualization

implementation: ./components/ProjectTimeline.tsx
framework: react

props:
  - name: projectId
    type: string
    required: true
    description: ID of the project
  
  - name: startDate
    type: string
    description: Timeline start date
  
  - name: endDate
    type: string
    description: Timeline end date
  
  - name: milestones
    type: array
    description: Project milestones
    examples:
      - [{ date: '2024-01-15', label: 'Launch' }]
  
  - name: editable
    type: boolean
    default: false
    description: Allow editing dates

events:
  - name: onMilestoneUpdate
    description: Fired when milestone is moved
    payload: "{ milestoneId: string, newDate: Date }"
  
  - name: onTaskMove
    description: Fired when task is dragged
    payload: "{ taskId: string, newStart: Date, newEnd: Date }"

methods:
  - name: zoomToFit
    description: Auto-zoom to show all content
    
  - name: exportImage
    description: Export timeline as PNG
    returns: Blob

ai_context:
  purpose: "Visualize project timeline with tasks and milestones"
  use_cases:
    - "Project planning and scheduling"
    - "Deadline tracking"
    - "Resource allocation visualization"
  best_practices:
    - "Use color coding for task status"
    - "Show dependencies between tasks"
    - "Include zoom controls for long timelines"
```

## 7. Component Variants

Create variations of existing components:

```yaml
# File: compact_table.component.yml

name: compact_table
label: Compact Table
description: Space-efficient table variant
category: data_display

implementation: ./components/CompactTable.tsx

# This is a variant of ObjectTable
variant_of: ObjectTable

props:
  # Inherits all ObjectTable props
  # Can add variant-specific props
  - name: density
    type: string
    default: compact
    validation:
      enum: [compact, normal, comfortable]

styling:
  framework: tailwind
  customizable:
    - name: rowHeight
      type: size
      default: 'h-8'  # Smaller than standard table
```

## 8. Using Components in Pages

Reference components in page metadata:

```yaml
# File: project_dashboard.page.yml

name: project_dashboard
label: Project Dashboard
layout: dashboard

components:
  # Use built-in component
  - id: project_table
    component: ObjectTable
    props:
      object: projects
      columns:
        - field: name
        - field: status
        - field: owner
  
  # Use custom component
  - id: timeline
    component: project_timeline
    props:
      projectId: "{{current_project_id}}"
      editable: true
    on:
      onMilestoneUpdate: handleMilestoneUpdate
  
  # Use overridden component (automatically uses your custom version)
  - id: task_list
    component: ObjectTable  # Will use your custom ObjectTable if registered
    props:
      object: tasks
```

## 9. Component Slots

Components can define slots for composition:

```yaml
name: card_container
label: Card Container
category: layout

slots:
  - name: header
    description: Card header content
    required: false
  
  - name: default
    description: Main card content
    required: true
  
  - name: footer
    description: Card footer (actions, etc.)
    required: false
    allowed_types:
      - ActionButton
      - ButtonGroup

examples:
  - title: Card with Header and Footer
    code: |
      <CardContainer>
        <template #header>
          <h2>Project Details</h2>
        </template>
        
        <ObjectDetail object="projects" recordId={id} />
        
        <template #footer>
          <ActionButton label="Edit" />
          <ActionButton label="Delete" />
        </template>
      </CardContainer>
```

## 10. Component Libraries

Package related components into libraries:

```yaml
# File: my_components.library.yml

name: myapp_ui_library
label: MyApp UI Components
description: Custom UI components for MyApp
version: 1.0.0
author: MyApp Team

components:
  - custom_table
  - advanced_form
  - project_timeline
  - compact_table

dependencies:
  react: ^18.0.0
  "@tanstack/react-table": ^8.0.0

repository: https://github.com/myapp/ui-components
license: MIT
```

## 11. Component Registration

Components are automatically registered when ObjectQL scans your directories:

```typescript
import { ObjectQL } from '@objectql/core';

const app = new ObjectQL({
  source: './src',
  // Component search paths
  components: [
    './src/components/**/*.component.yml',
    './node_modules/@myapp/ui-lib/components'
  ]
});

await app.init();

// Access registered components
const components = app.registry.list('component');

// Get a specific component
const tableComponent = app.registry.get('component', 'ObjectTable');
```

## 12. Programmatic Component Registration

Register components programmatically:

```typescript
import { ComponentConfig } from '@objectql/types';

const customTable: ComponentConfig = {
  name: 'custom_table',
  label: 'Custom Table',
  category: 'data_display',
  implementation: './components/CustomTable',
  framework: 'react',
  props: [
    { name: 'data', type: 'array', required: true }
  ]
};

// Register the component
app.registry.register('component', 'custom_table', customTable);

// Override a built-in component
app.registry.register('component', 'ObjectTable', customTableOverride);
```

## 13. Component Discovery

ObjectQL provides tools for discovering available components:

```typescript
// List all components
const all = app.registry.list('component');

// List by category
const dataTables = app.registry.list('component', {
  filter: { category: 'data_display' }
});

// Search components
const searchResults = app.registry.search('component', 'table');

// Get component metadata
const meta = app.registry.getMetadata('component', 'ObjectTable');
console.log(meta.props); // Component props
console.log(meta.events); // Component events
console.log(meta.ai_context); // AI context
```

## 14. TypeScript Integration

Generate TypeScript types from component metadata:

```typescript
// Auto-generated types from component metadata
import type { ObjectTableProps } from '@objectql/types/components';

const props: ObjectTableProps = {
  object: 'projects',
  columns: [
    { field: 'name', label: 'Project Name' }
  ],
  sortable: true,
  onRowClick: (row) => console.log(row)
};
```

## 15. Component Testing

Test components using ObjectQL's testing utilities:

```typescript
import { renderComponent } from '@objectql/test-utils';

describe('CustomTable', () => {
  it('renders with data', async () => {
    const { container } = await renderComponent('custom_table', {
      data: [{ id: 1, name: 'Test' }],
      columns: [{ field: 'name', label: 'Name' }]
    });
    
    expect(container).toHaveTextContent('Test');
  });
  
  it('emits row click event', async () => {
    const onRowClick = jest.fn();
    
    const { findByText } = await renderComponent('custom_table', {
      data: [{ id: 1, name: 'Test' }],
      columns: [{ field: 'name' }],
      onRowClick
    });
    
    const cell = await findByText('Test');
    cell.click();
    
    expect(onRowClick).toHaveBeenCalledWith(
      { id: 1, name: 'Test' },
      0
    );
  });
});
```

## 16. Best Practices

### Component Design

1. **Single Responsibility**: Each component should do one thing well
2. **Composability**: Design for composition with slots and children
3. **Accessibility**: Always include ARIA attributes and keyboard navigation
4. **Performance**: Use lazy loading and virtual scrolling for large datasets
5. **Documentation**: Provide clear examples and AI context

### Naming Conventions

1. **PascalCase for Built-in**: `ObjectTable`, `ActionButton`
2. **snake_case for Custom**: `my_custom_table`, `project_timeline`
3. **Namespacing**: Use prefixes for organization-specific components: `acme.CustomTable`

### Overriding Components

1. **Match the Interface**: When overriding, implement all required props and events
2. **Extend, Don't Replace**: Use `extends` to indicate you're enhancing the original
3. **Document Differences**: Clearly document what's changed from the original

### Versioning

1. **Semantic Versioning**: Use semver (1.0.0, 1.1.0, 2.0.0)
2. **Breaking Changes**: Increment major version for breaking changes
3. **Deprecation**: Use `deprecated` field before removing features

## 17. Component Examples

### Example 1: Data Table Component

```yaml
# custom_table.component.yml
name: custom_table
label: Custom Data Table
category: data_display
implementation: ./components/CustomTable.tsx
framework: react

props:
  - name: object
    type: string
    required: true
  - name: columns
    type: array
    required: true
  - name: filters
    type: array
  - name: sortable
    type: boolean
    default: true

events:
  - name: onRowClick
    payload: "{ row: Record }"
  - name: onSort
    payload: "{ column: string, direction: string }"

features:
  realtime: true
  exportable: true
  responsive: true

ai_context:
  purpose: "Display and interact with tabular business data"
  use_cases:
    - "Browse and search records"
    - "Bulk operations on multiple records"
```

### Example 2: Form Component

```yaml
# advanced_form.component.yml
name: advanced_form
label: Advanced Form
category: data_entry
implementation: ./components/AdvancedForm.tsx
framework: react

props:
  - name: object
    type: string
    required: true
  - name: recordId
    type: string
    description: For edit mode
  - name: layout
    type: object
    description: Form layout configuration
  - name: onSubmit
    type: function
    required: true

events:
  - name: onSubmit
    payload: "{ values: Record }"
  - name: onChange
    payload: "{ field: string, value: any }"
  - name: onValidation
    payload: "{ errors: ValidationError[] }"

methods:
  - name: submit
    description: Programmatically submit the form
  - name: reset
    description: Reset form to initial values

features:
  i18n: true
  realtime: false
  themeable: true
```

### Example 3: Visualization Component

```yaml
# revenue_chart.component.yml
name: revenue_chart
label: Revenue Chart
category: visualization
implementation: ./components/RevenueChart.tsx
framework: react

props:
  - name: data
    type: array
    required: true
  - name: type
    type: string
    default: line
    validation:
      enum: [line, bar, area]
  - name: currency
    type: string
    default: USD

events:
  - name: onDataPointClick
    payload: "{ date: Date, value: number }"

dependencies:
  - name: recharts
    version: ^2.0.0
    type: library

performance:
  bundle_size: 120
  complexity: medium

ai_context:
  purpose: "Visualize revenue trends over time"
  use_cases:
    - "Financial dashboards"
    - "Revenue analysis"
    - "Trend monitoring"
```

## 18. Related Specifications

- [Protocol Overview](../protocol/overview.md) - Overall protocol system
- [Component Library](./component-library.md) - Built-in components reference
- [Architecture](./architecture.md) - System architecture

## 19. Migration Guide

### From Hardcoded Components to Metadata

**Before (Hardcoded):**
```tsx
// src/pages/Projects.tsx
import { DataTable } from './components/DataTable';

function ProjectsPage() {
  return <DataTable data={projects} columns={columns} />;
}
```

**After (Metadata-Driven):**
```yaml
# projects.page.yml
name: projects
layout: single_column

components:
  - id: projects_table
    component: ObjectTable
    props:
      object: projects
      columns:
        - field: name
        - field: status
```

### Overriding a Built-in Component

**Step 1:** Create your component implementation
```tsx
// src/components/MyCustomTable.tsx
export function MyCustomTable(props: ObjectTableProps) {
  // Your custom implementation
  return <div>Custom table with {props.data.length} rows</div>;
}
```

**Step 2:** Register via metadata
```yaml
# ObjectTable.component.yml
name: ObjectTable
implementation: ./components/MyCustomTable.tsx
extends: ObjectTable
```

**Step 3:** Use as normal - ObjectQL automatically uses your version
```yaml
# Any page using ObjectTable now uses YOUR component
components:
  - component: ObjectTable  # Uses MyCustomTable
```

## 20. Conclusion

The component metadata specification provides a powerful, flexible way to build, customize, and extend ObjectQL's UI layer. By defining components as metadata:

- **Developers** can override any built-in component
- **AI systems** can understand and generate component usage
- **Teams** can share component libraries
- **Applications** remain framework-agnostic

This approach makes ObjectQL truly customizable while maintaining consistency and type safety across the platform.
