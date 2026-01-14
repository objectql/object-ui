# Page Specification

> **Implementation Status**: 🚧 **75% Complete** - Core page features implemented, advanced features in progress.
> 
> See [Implementation Status](./implementation-status.md#page-components) for detailed feature status.

## Overview

Pages are the visual interface layer in ObjectQL applications. They define composable UI layouts that can render data from objects, display custom components, and orchestrate user interactions. Pages are defined using `*.page.yml` files and follow a declarative, component-based architecture.

## File Convention

```
src/
  ├── dashboard.page.yml
  ├── project_detail.page.yml
  └── create_wizard.page.yml
```

## Page Feature Implementation Status

| Feature | Status | Notes |
|:--------|:-------|:------|
| Basic Page Layout | ✅ Implemented | Single/multi-column layouts working |
| Schema-based Body | ✅ Implemented | Full schema rendering support |
| Component Composition | ✅ Implemented | Nested components working |
| Data Sources | 🚧 Partial | Basic data binding implemented |
| Actions & Events | 🚧 Partial | onClick, onSubmit working; custom actions partial |
| Styling (className) | ✅ Implemented | Tailwind className support |
| Responsive Config | 📝 Planned | Planned for Q2 2026 |
| Permissions | 📝 Planned | Planned for Q4 2026 |
| Page Metadata | ✅ Implemented | Title, description supported |
| State Management | 🚧 Partial | Basic state, persistence planned |
| Real-time Updates | 📝 Planned | Planned for Q2 2026 |
| AI Context | 📝 Planned | Future feature |

## Schema

### Root Structure

```typescript
interface PageConfig {
  // Identity
  name: string;                    // Unique identifier
  label: string;                   // Display name
  description?: string;            // Page description
  icon?: string;                   // Icon identifier
  
  // Layout
  body: SchemaNode | SchemaNode[]; // The schema body, following the JSON Schema Rendering spec.

  
  // Data & Logic
  data_sources?: Record<string, ComponentDataSource>;
  actions?: Record<string, ComponentAction>;
  
  // Styling & Behavior
  style?: ComponentStyle;
  responsive?: ResponsiveConfig;
  
  // Access Control
  permissions?: {
    view?: string[];
    edit?: string[];
  };
  
  // Metadata
  meta?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  
  // State Management
  state?: {
    initial?: Record<string, any>;
    persist?: boolean;
    storage_key?: string;
  };
  
  // Features
  realtime?: boolean;
  refresh_interval?: number;
  
  // AI Context
  ai_context?: {
    intent?: string;
    persona?: string;
    tasks?: string[];
  };
}
```

### Layout Types

```typescript
type PageLayoutType = 
  | 'single_column'   // Single vertical column
  | 'two_column'      // Left and right columns
  | 'three_column'    // Left, center, right
  | 'dashboard'       // Grid-based dashboard
  | 'canvas'          // Free-form positioning
  | 'tabs'            // Tab-based layout
  | 'wizard'          // Multi-step wizard
  | 'custom';         // Custom layout
```

### Component Types

```typescript
type PageComponentType =
  // Data Display
  | 'data_grid'       // Table/grid
  | 'detail_view'     // Record details
  | 'list'            // List view
  | 'chart'           // Visualizations
  | 'metric'          // KPI display
  | 'calendar'        // Calendar view
  | 'kanban'          // Kanban board
  | 'timeline'        // Timeline/Gantt
  
  // Data Input
  | 'form'            // Data entry form
  | 'button'          // Action button
  
  // Layout
  | 'container'       // Group components
  | 'tabs'            // Tab container
  | 'divider'         // Visual separator
  
  // Content
  | 'text'            // Text/markdown
  | 'html'            // Custom HTML
  | 'image'           // Image display
  | 'iframe'          // Embedded content
  
  | 'custom';         // Custom component
```

### Component Structure

```typescript
interface PageComponent {
  id: string;                      // Unique component ID
  type: PageComponentType;         // Component type
  label?: string;                  // Display label
  description?: string;            // Description
  
  // Data binding
  data_source?: ComponentDataSource;
  
  // Component configuration
  config?: Record<string, any>;
  
  // Actions
  actions?: {
    on_click?: ComponentAction;
    on_submit?: ComponentAction;
    on_load?: ComponentAction;
    on_change?: ComponentAction;
    [key: string]: ComponentAction | undefined;
  };
  
  // Styling
  style?: ComponentStyle;
  responsive?: ResponsiveConfig;
  
  // Visibility & Access
  visible_when?: Record<string, any>;
  permissions?: string[];
  
  // Nested components
  components?: PageComponent[];
  
  // Grid positioning (for dashboard layout)
  grid?: {
    x: number;      // Column (0-11)
    y: number;      // Row
    w: number;      // Width in grid units
    h: number;      // Height in grid units
  };
  
  // Custom component reference
  component?: string;
}
```

### Data Sources

```typescript
interface ComponentDataSource {
  object?: string;                 // Object to query
  filters?: any[];                 // Filter conditions
  fields?: string[];               // Fields to display
  sort?: Array<[string, 'asc' | 'desc']>;
  limit?: number;
  paginate?: boolean;
  expand?: Record<string, any>;    // Related objects
  query?: any;                     // Custom query
}
```

### Actions

```typescript
interface ComponentAction {
  type: 'navigate' | 'open_modal' | 'run_action' | 'submit_form' | 'refresh' | 'custom';
  
  // Navigation
  path?: string;
  
  // Modal
  modal?: string;
  
  // Action execution
  action?: string;
  object?: string;
  
  // Custom handler
  handler?: string;
  
  // User feedback
  confirm?: string;
  success_message?: string;
  on_error?: 'show_toast' | 'show_modal' | 'ignore';
}
```

### Responsive Configuration

```typescript
interface ResponsiveConfig {
  mobile?: {
    columns?: number;
    visible?: boolean;
    order?: number;
  };
  tablet?: {
    columns?: number;
    visible?: boolean;
    order?: number;
  };
  desktop?: {
    columns?: number;
    visible?: boolean;
    order?: number;
  };
}
```

## Examples

### Dashboard Layout

```yaml
name: dashboard
label: Project Dashboard
layout: dashboard

components:
  # KPI Metric
  - id: total_projects
    type: metric
    label: Total Projects
    data_source:
      object: projects
      query:
        op: count
    config:
      format: number
      icon: folder
      color: blue
    grid:
      x: 0
      y: 0
      w: 3
      h: 2
  
  # Chart
  - id: status_chart
    type: chart
    label: Projects by Status
    data_source:
      object: projects
      fields: ['status']
      query:
        op: group_by
        field: status
        aggregate: count
    config:
      chart_type: pie
    grid:
      x: 3
      y: 0
      w: 6
      h: 4
  
  # Data Grid
  - id: tasks_grid
    type: data_grid
    label: Recent Tasks
    data_source:
      object: tasks
      fields: ['name', 'status', 'due_date']
      sort: [['created_at', 'desc']]
      limit: 10
    grid:
      x: 0
      y: 2
      w: 12
      h: 6

permissions:
  view: ['admin', 'manager', 'user']
```

### Two-Column Detail Page

```yaml
name: project_detail
label: Project Details
layout: two_column

sections:
  # Main content
  - id: main_content
    type: content
    style:
      width: 70%
    components:
      - id: edit_form
        type: form
        label: Project Information
        data_source:
          object: projects
          query:
            op: findOne
            filter: [['_id', '=', '{{route.params.id}}']]
        config:
          mode: edit
          fields:
            - name: name
              label: Name
              type: text
            - name: description
              label: Description
              type: textarea
        actions:
          on_submit:
            type: run_action
            object: projects
            action: update
  
  # Sidebar
  - id: sidebar
    type: sidebar
    style:
      width: 30%
    components:
      - id: stats
        type: metric
        label: Task Count
        data_source:
          object: tasks
          filters:
            - ['project', '=', '{{route.params.id}}']
          query:
            op: count
```

### Wizard Layout

```yaml
name: create_project
label: Create Project
layout: wizard

components:
  # Step 1
  - id: step_basic
    type: container
    label: Basic Information
    config:
      step: 1
    components:
      - id: basic_form
        type: form
        config:
          fields:
            - name: name
              label: Name
              type: text
              required: true
  
  # Step 2
  - id: step_team
    type: container
    label: Team
    config:
      step: 2
    components:
      - id: team_form
        type: form
        config:
          fields:
            - name: owner
              label: Owner
              type: lookup
              reference_to: users

actions:
  submit_wizard:
    type: run_action
    object: projects
    action: create
    success_message: Project created!
```

## Usage in Applications

Pages can be referenced in application navigation:

```yaml
# app.yml
navigation:
  type: sidebar
  items:
    - type: page
      name: dashboard
      label: Dashboard
      icon: dashboard
      path: /dashboard
    
    - type: section
      label: Projects
      items:
        - type: page
          name: project_list
          path: /projects
```

## Best Practices

1. **Component IDs**: Use descriptive IDs (e.g., `tasks_grid` not `grid1`)
2. **Data Binding**: Leverage `{{}}` syntax for dynamic values
3. **Responsive Design**: Always configure responsive behavior
4. **Access Control**: Define clear permissions
5. **AI Context**: Provide intent and tasks for AI understanding
6. **State Management**: Use page state for complex interactions
7. **Performance**: Use pagination and limits for large datasets

## Validation Rules

- `name` must be unique within the application
- `layout` is required
- Either `sections` or `components` must be defined (not both for simple layouts)
- Component `id` must be unique within the page
- Grid positions must not overlap in dashboard layouts
- Responsive breakpoints must be valid

## File Loading

Pages are automatically loaded from `*.page.yml` files by the ObjectQL loader:

```typescript
// Automatically registered
loader.load('./src');

// Access via registry
const page = registry.get('page', 'dashboard');
```

## Integration with Studio

The ObjectQL Studio provides a visual interface for:
- Browsing registered pages
- Previewing page layouts
- Editing page metadata
- Testing responsive behavior
- Managing permissions

## See Also

- [Application Configuration](./application.md)
- [Form Specification](./form.md)
- [View Specification](./view.md)
- [Component Library](../guide/components.md)

### 1.5 JSON Logic & Expressions

The schema supports expression evaluation for dynamic behavior, using a syntax similar to template strings.

- **Variables**: `${data.username}`
- **Ternary**: `${isAdmin ? 'Show' : 'Hide'}`
- **Filters**: `${value | date: 'YYYY-MM-DD'}`

See [Schema Rendering Specification](../spec/schema-rendering.md) for deeper details on the rendering engine.
