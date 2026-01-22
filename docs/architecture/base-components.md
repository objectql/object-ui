---
title: "Platform Base Components Metadata Specification"
---

## 1. Overview

This specification defines the metadata structure for ObjectQL's built-in platform base components. These are the core, production-ready components that provide essential UI functionality out of the box.

**Purpose:**
- Provide a standard interface for all base components
- Enable component customization and override
- Facilitate AI understanding and generation
- Support type-safe component usage
- Enable marketplace distribution

**Scope:** This document covers the complete metadata specification for all platform base components, including data display, data entry, layout, navigation, and visualization components.
For the low-level UI component library (Button, Input, Dialog, etc.), please refer to the [Component Library Reference](component-library.md).

## 2. Base Component Categories

| Category | Purpose | Examples |
|:---|:---|:---|
| `data_display` | Display object records | ObjectTable, ObjectList, ObjectDetail |
| `data_entry` | Create/edit records | ObjectForm, QuickCreateForm, FieldInput |
| `layout` | Structure page content | GridLayout, Section, TabContainer |
| `navigation` | Navigate app structure | Sidebar, NavBar, Menu |
| `visualization` | Visualize data | Chart, Metric, KanbanBoard |
| `feedback` | User notifications | Toast, Modal, Alert |
| `utility` | Helper components | Loading, ErrorBoundary, Empty |

## 3. Common Metadata Structure

All base components share this common structure:

```yaml
# Component Identity
name: component_name
label: Display Name
description: Component description
category: data_display | data_entry | layout | navigation | visualization | feedback | utility
version: 1.0.0

# Implementation
framework: react
render_mode: client | server | hybrid
implementation: Internal (built-in components reference internal implementation)

# Component API
props: [...]
events: [...]
methods: [...]
slots: [...]

# Behavior
features: {...}
dependencies: [...]
platforms: {...}

# Styling
styling: {...}
accessibility: {...}
performance: {...}

# Documentation
ai_context: {...}
examples: [...]
```

## 4. Data Display Components

### 4.1 ObjectTable

**Purpose:** Display object records in a tabular format with sorting, filtering, and pagination.

```yaml
name: ObjectTable
label: Object Table
description: Production-grade data table for displaying and managing object records
category: data_display
version: 1.7.0

framework: react
render_mode: client

# Props
props:
  # Required Props
  - name: object
    type: string
    required: true
    description: ObjectQL object name to display
    examples:
      - projects
      - tasks
      - customers
    validation:
      pattern: "^[a-z][a-z0-9_]*$"
  
  # Column Configuration
  - name: columns
    type: array
    required: false
    description: Column definitions. Auto-generated from object if not specified.
    schema:
      - field: string          # Field path (supports dot notation)
        label: string          # Column header
        width: number          # Column width in pixels
        sortable: boolean      # Enable sorting
        renderer: string       # Custom renderer type
        format: string         # Format string
        hidden: boolean        # Hide by default
        align: left | center | right
    examples:
      - [{ field: 'name', label: 'Project Name', width: 200, sortable: true }]
  
  # Data Filtering
  - name: filters
    type: array
    description: Default filters to apply
    schema:
      - field: string
        operator: string
        value: any
    examples:
      - [{ field: 'status', operator: '!=', value: 'archived' }]
  
  - name: filterable
    type: boolean
    default: true
    description: Show filter UI
  
  - name: searchable
    type: boolean
    default: true
    description: Enable global search
  
  - name: searchFields
    type: array
    description: Fields to include in global search. Auto-detected if not specified.
    examples:
      - [name, description, owner.name]
  
  # Sorting
  - name: sortable
    type: boolean
    default: true
    description: Enable column sorting
  
  - name: defaultSort
    type: object
    description: Default sort configuration
    schema:
      field: string
      direction: asc | desc
    examples:
      - { field: 'created_at', direction: 'desc' }
  
  # Pagination
  - name: paginated
    type: boolean
    default: true
    description: Enable pagination
  
  - name: pageSize
    type: number
    default: 25
    description: Records per page
    validation:
      min: 10
      max: 100
  
  - name: pageSizeOptions
    type: array
    default: [10, 25, 50, 100]
    description: Available page size options
  
  # Selection
  - name: selectable
    type: boolean
    default: false
    description: Enable row selection
  
  - name: selectionMode
    type: string
    default: multiple
    enum: [single, multiple]
    description: Selection behavior
  
  # Actions
  - name: rowActions
    type: array
    description: Actions available on each row
    schema:
      - name: string
        label: string
        icon: string
        handler: function
        visible_when: object
    examples:
      - [{ name: 'edit', label: 'Edit', icon: 'edit' }]
  
  - name: bulkActions
    type: array
    description: Actions available for selected rows
    examples:
      - [{ name: 'delete', label: 'Delete Selected', icon: 'trash' }]
  
  # Export
  - name: exportable
    type: boolean
    default: true
    description: Enable data export
  
  - name: exportFormats
    type: array
    default: [csv, excel]
    enum: [csv, excel, pdf, json]
    description: Available export formats
  
  # Display
  - name: density
    type: string
    default: comfortable
    enum: [compact, comfortable, spacious]
    description: Row height density
  
  - name: striped
    type: boolean
    default: false
    description: Alternate row colors
  
  - name: bordered
    type: boolean
    default: true
    description: Show cell borders
  
  - name: hoverable
    type: boolean
    default: true
    description: Highlight row on hover
  
  # Advanced Features
  - name: virtualScroll
    type: boolean
    default: false
    description: Enable virtual scrolling for large datasets
  
  - name: reorderable
    type: boolean
    default: false
    description: Allow column reordering
  
  - name: resizable
    type: boolean
    default: false
    description: Allow column resizing
  
  - name: editable
    type: boolean
    default: false
    description: Enable inline editing
  
  - name: groupable
    type: boolean
    default: false
    description: Enable row grouping
  
  # Styling
  - name: theme
    type: string
    default: light
    enum: [light, dark, auto]
    description: Color theme
  
  - name: stickyHeader
    type: boolean
    default: true
    description: Sticky table header
  
  # Callbacks
  - name: onRowClick
    type: function
    description: Handler for row click events
    signature: "(row: Record, index: number) => void"
  
  - name: onSelectionChange
    type: function
    description: Handler for selection changes
    signature: "(selectedRows: Record[]) => void"
  
  - name: onSort
    type: function
    description: Handler for sort changes
    signature: "(field: string, direction: 'asc' | 'desc') => void"
  
  - name: onFilter
    type: function
    description: Handler for filter changes
    signature: "(filters: Filter[]) => void"

# Events
events:
  - name: onRowClick
    description: Fired when a row is clicked
    payload: "{ row: Record, index: number, event: MouseEvent }"
  
  - name: onRowDoubleClick
    description: Fired when a row is double-clicked
    payload: "{ row: Record, index: number }"
  
  - name: onSelectionChange
    description: Fired when row selection changes
    payload: "{ selectedRows: Record[], selectedIds: string[] }"
  
  - name: onSortChange
    description: Fired when sort order changes
    payload: "{ field: string, direction: 'asc' | 'desc' }"
  
  - name: onFilterChange
    description: Fired when filters change
    payload: "{ filters: Filter[] }"
  
  - name: onPageChange
    description: Fired when page changes
    payload: "{ page: number, pageSize: number }"
  
  - name: onExport
    description: Fired when export is triggered
    payload: "{ format: string, data: Record[] }"

# Methods
methods:
  - name: refresh
    description: Refresh table data
    parameters: []
    returns: Promise<void>
  
  - name: clearSelection
    description: Clear all selected rows
    parameters: []
    returns: void
  
  - name: selectAll
    description: Select all rows
    parameters: []
    returns: void
  
  - name: exportData
    description: Export table data
    parameters:
      - name: format
        type: string
        required: true
    returns: Promise<Blob>
  
  - name: applyFilters
    description: Apply filters programmatically
    parameters:
      - name: filters
        type: Filter[]
        required: true
    returns: void

# Dependencies
dependencies:
  - name: react
    version: "^18.0.0"
    type: peer
  
  - name: "@objectstack/client"
    version: "^1.7.0"
    type: library
  
  - name: "@objectstack/spec"
    version: "^1.7.0"
    type: library

# Features
features:
  realtime: true              # Support real-time data updates
  offline: false              # Offline support
  exportable: true            # Data export capability
  printable: true             # Print-friendly view
  responsive: true            # Responsive design
  themeable: true             # Theme customization
  i18n: true                  # Internationalization
  rtl: true                   # Right-to-left support

# Platform Support
platforms:
  web: true
  mobile: true
  tablet: true
  desktop: true
  ssr: true                   # Server-side rendering
  ssg: false                  # Static site generation

# Styling
styling:
  framework: tailwind
  css_variables: true
  dark_mode: true
  customizable:
    - name: headerBackground
      description: Table header background color
      type: color
      default: bg-gray-100
      dark: bg-gray-800
    
    - name: rowHeight
      description: Table row height
      type: size
      default: h-12
      values: [h-8, h-10, h-12, h-14, h-16]
    
    - name: borderColor
      description: Cell border color
      type: color
      default: border-gray-200
      dark: border-gray-700

# Accessibility
accessibility:
  wcag_level: AAA
  role: grid
  keyboard_navigation: true
  keyboard_shortcuts:
    - key: "Arrow Up/Down"
      action: Navigate rows
    - key: "Space"
      action: Select row
    - key: "Ctrl+A"
      action: Select all
  screen_reader: true
  focus_management: true
  aria_attributes:
    - aria-label
    - aria-sort
    - aria-rowcount
    - aria-colcount
    - aria-selected
  color_contrast: true

# Performance
performance:
  lazy_loadable: true         # Component code splitting
  bundle_size: 85             # KB (gzipped)
  complexity: medium
  virtual_scroll: true        # For large datasets
  memoization: true           # React.memo usage
  debounced_search: true      # Search input debouncing
  optimistic_updates: true    # Optimistic UI updates

# AI Context
ai_context:
  purpose: "Display and interact with tabular data from ObjectQL objects"
  
  user_persona: "Data analyst, manager, or administrator who needs to browse, search, filter, and analyze object records"
  
  typical_use_cases:
    - "Browse and search through lists of records"
    - "Filter and sort data for analysis"
    - "Perform bulk operations on multiple records"
    - "Export data for reporting or external use"
    - "Monitor real-time data changes"
  
  best_practices:
    - "Use virtual scrolling for datasets > 1000 rows"
    - "Provide clear, descriptive column headers"
    - "Include search/filter for tables with > 20 rows"
    - "Show appropriate row actions based on permissions"
    - "Use sticky headers for long tables"
    - "Implement pagination for better performance"
  
  common_errors:
    - "Not specifying object name"
    - "Defining columns that don't exist in object"
    - "Setting pageSize too high (> 100)"
    - "Forgetting to handle onRowClick for navigation"
  
  quality_guidance: |
    - Column labels should be human-readable, not field names
    - Default sort should be logical (e.g., newest first)
    - Include status/priority fields prominently
    - Consider mobile view - limit columns for small screens
    - Use renderers for complex field types (badges, dates, etc.)

# Examples
examples:
  - title: Basic Table
    description: Simple table displaying project records
    code: |
      <ObjectTable
        object="projects"
        columns={[
          { field: 'name', label: 'Project Name', width: 300 },
          { field: 'status', label: 'Status', renderer: 'badge' },
          { field: 'owner.name', label: 'Owner', width: 200 },
          { field: 'due_date', label: 'Due Date', renderer: 'date' }
        ]}
        sortable={true}
        filterable={true}
      />
  
  - title: Table with Selection and Actions
    description: Table with row selection and bulk actions
    code: |
      <ObjectTable
        object="tasks"
        selectable={true}
        selectionMode="multiple"
        rowActions={[
          { name: 'edit', label: 'Edit', icon: 'edit' },
          { name: 'delete', label: 'Delete', icon: 'trash' }
        ]}
        bulkActions={[
          { name: 'bulk_complete', label: 'Mark Complete' },
          { name: 'bulk_delete', label: 'Delete Selected' }
        ]}
        onRowClick={(row) => navigate(`/tasks/${row.id}`)}
        onSelectionChange={(rows) => console.log('Selected:', rows)}
      />
  
  - title: Advanced Table with Filters
    description: Table with default filters and virtual scrolling
    code: |
      <ObjectTable
        object="customers"
        filters={[
          { field: 'status', operator: '=', value: 'active' },
          { field: 'created_at', operator: '>', value: '2024-01-01' }
        ]}
        virtualScroll={true}
        exportable={true}
        exportFormats={['csv', 'excel', 'pdf']}
        density="compact"
      />
  
  - title: Inline Editable Table
    description: Table with inline editing capability
    code: |
      <ObjectTable
        object="inventory"
        editable={true}
        columns={[
          { field: 'product', label: 'Product' },
          { field: 'quantity', label: 'Quantity', editable: true },
          { field: 'price', label: 'Price', editable: true }
        ]}
        onCellEdit={(row, field, value) => {
          updateRecord(row.id, { [field]: value });
        }}
      />

# Usage in Page Metadata
usage:
  - title: In Page Component
    code: |
      # dashboard.page.yml
      components:
        - id: projects_table
          component: ObjectTable
          props:
            object: projects
            sortable: true
            filterable: true
            defaultSort:
              field: created_at
              direction: desc
```

### 4.2 ObjectList

**Purpose:** Display object records in a vertical list layout with card-style items.

```yaml
name: ObjectList
label: Object List
description: Display records as a vertical list with customizable card layout
category: data_display
version: 1.7.0

framework: react
render_mode: client

# Props
props:
  - name: object
    type: string
    required: true
    description: ObjectQL object name to display
  
  - name: fields
    type: array
    description: Fields to display in each list item
    examples:
      - [name, status, owner, due_date]
  
  - name: titleField
    type: string
    description: Field to use as item title
    default: name
  
  - name: subtitleField
    type: string
    description: Field to use as item subtitle
  
  - name: descriptionField
    type: string
    description: Field to use as item description
  
  - name: imageField
    type: string
    description: Field to use for item image/avatar
  
  - name: layout
    type: string
    default: comfortable
    enum: [compact, comfortable, spacious]
    description: List item spacing
  
  - name: dividers
    type: boolean
    default: true
    description: Show dividers between items
  
  - name: hoverable
    type: boolean
    default: true
    description: Highlight items on hover
  
  - name: onItemClick
    type: function
    description: Handler for item click
    signature: "(item: Record) => void"

# Events
events:
  - name: onItemClick
    description: Fired when a list item is clicked
    payload: "{ item: Record, index: number }"

# AI Context
ai_context:
  purpose: "Display records in a vertical list format, ideal for mobile or card-based layouts"
  typical_use_cases:
    - "Mobile-friendly record browsing"
    - "Activity feeds or timelines"
    - "Contact lists or directories"
  best_practices:
    - "Use for 5-50 items, paginate beyond that"
    - "Include clear visual hierarchy (title, subtitle, description)"
    - "Add avatars or icons for visual scanning"

# Examples
examples:
  - title: Basic List
    code: |
      <ObjectList
        object="contacts"
        titleField="name"
        subtitleField="company"
        descriptionField="email"
        imageField="avatar"
        onItemClick={(item) => navigate(`/contacts/${item.id}`)}
      />
```

### 4.3 ObjectDetail

**Purpose:** Display complete details of a single object record.

```yaml
name: ObjectDetail
label: Object Detail View
description: Display all fields of a single record in sections
category: data_display
version: 1.7.0

framework: react
render_mode: client

# Props
props:
  - name: object
    type: string
    required: true
    description: ObjectQL object name
  
  - name: recordId
    type: string
    required: true
    description: ID of the record to display
  
  - name: sections
    type: array
    description: Field sections for organized display
    schema:
      - name: string
        label: string
        columns: number
        fields: string[]
        collapsible: boolean
    examples:
      - [{ name: 'basic', label: 'Basic Info', columns: 2, fields: ['name', 'status'] }]
  
  - name: relatedLists
    type: array
    description: Related object lists to display
    schema:
      - object: string
        relationField: string
        label: string
        limit: number
  
  - name: editable
    type: boolean
    default: false
    description: Show edit button
  
  - name: actions
    type: array
    description: Available actions on the record
    examples:
      - [{ name: 'edit', label: 'Edit' }, { name: 'delete', label: 'Delete' }]

# AI Context
ai_context:
  purpose: "Display comprehensive view of a single record with all fields and related data"
  typical_use_cases:
    - "Record detail pages"
    - "Profile views"
    - "Order/transaction details"
  best_practices:
    - "Group related fields into logical sections"
    - "Show related lists at the bottom"
    - "Include quick actions at the top"
    - "Make key fields prominent"

# Examples
examples:
  - title: Project Detail View
    code: |
      <ObjectDetail
        object="projects"
        recordId={projectId}
        sections={[
          {
            name: 'overview',
            label: 'Project Overview',
            columns: 2,
            fields: ['name', 'status', 'owner', 'start_date', 'end_date']
          },
          {
            name: 'description',
            label: 'Description',
            columns: 1,
            fields: ['description', 'objectives']
          }
        ]}
        relatedLists={[
          { object: 'tasks', relationField: 'project_id', label: 'Tasks' },
          { object: 'files', relationField: 'project_id', label: 'Files' }
        ]}
        editable={true}
        actions={[
          { name: 'edit', label: 'Edit', icon: 'edit' },
          { name: 'archive', label: 'Archive', icon: 'archive' }
        ]}
      />
```

## 5. Data Entry Components

### 5.1 ObjectForm

**Purpose:** Create and edit object records with comprehensive form capabilities.

```yaml
name: ObjectForm
label: Object Form
description: Production-grade form for creating and editing object records
category: data_entry
version: 1.7.0

framework: react
render_mode: client

# Props
props:
  # Core Configuration
  - name: object
    type: string
    required: true
    description: ObjectQL object name
  
  - name: mode
    type: string
    required: true
    enum: [create, edit, view, clone]
    description: Form mode
  
  - name: recordId
    type: string
    description: Record ID for edit/view modes
    required_when:
      mode: [edit, view]
  
  # Layout
  - name: layout
    type: object
    description: Form layout configuration
    schema:
      type: sections | tabs | wizard
      columns: number
      sections: Section[]
      tabs: Tab[]
      steps: Step[]
  
  - name: sections
    type: array
    description: Form sections (legacy, use layout.sections)
    schema:
      - name: string
        label: string
        columns: number
        fields: string[]
        collapsible: boolean
  
  # Field Configuration
  - name: fields
    type: array
    description: Fields to include. Auto-includes all if not specified.
    examples:
      - [name, description, status, owner]
  
  - name: excludeFields
    type: array
    description: Fields to exclude from form
    examples:
      - [created_at, modified_at, system_fields]
  
  - name: fieldConfig
    type: object
    description: Per-field configuration overrides
    schema:
      field_name:
        label: string
        placeholder: string
        helpText: string
        required: boolean
        readonly: boolean
        defaultValue: any
  
  # Behavior
  - name: autoSave
    type: boolean
    default: false
    description: Enable auto-save
  
  - name: autoSaveInterval
    type: number
    default: 30000
    description: Auto-save interval in ms
  
  - name: confirmOnCancel
    type: boolean
    default: true
    description: Show confirmation when canceling with unsaved changes
  
  - name: validationMode
    type: string
    default: onChange
    enum: [onChange, onBlur, onSubmit]
    description: When to validate fields
  
  # Actions
  - name: actions
    type: object
    description: Form action buttons
    schema:
      primary: Action[]
      secondary: Action[]
    default:
      primary: [{ label: 'Save', action: 'save' }]
      secondary: [{ label: 'Cancel', action: 'cancel' }]
  
  # Callbacks
  - name: onSubmit
    type: function
    description: Handler for form submission
    signature: "(values: Record) => Promise<void>"
  
  - name: onCancel
    type: function
    description: Handler for form cancellation
    signature: "() => void"
  
  - name: onFieldChange
    type: function
    description: Handler for field value changes
    signature: "(field: string, value: any) => void"

# Events
events:
  - name: onSubmit
    description: Fired when form is submitted
    payload: "{ values: Record, mode: string }"
  
  - name: onCancel
    description: Fired when form is canceled
    payload: "{ hasChanges: boolean }"
  
  - name: onFieldChange
    description: Fired when a field value changes
    payload: "{ field: string, value: any, previousValue: any }"
  
  - name: onValidationError
    description: Fired when validation fails
    payload: "{ errors: ValidationError[] }"

# Methods
methods:
  - name: submit
    description: Submit the form programmatically
    parameters: []
    returns: Promise<Record>
  
  - name: reset
    description: Reset form to initial values
    parameters: []
    returns: void
  
  - name: setFieldValue
    description: Set a field value programmatically
    parameters:
      - name: field
        type: string
      - name: value
        type: any
    returns: void
  
  - name: validate
    description: Validate all fields
    parameters: []
    returns: Promise<ValidationResult>

# AI Context
ai_context:
  purpose: "Comprehensive form for creating and editing object records with full validation and workflow support"
  
  typical_use_cases:
    - "Create new records with guided workflows"
    - "Edit existing records with validation"
    - "Clone records with modified fields"
    - "View read-only record details in form layout"
  
  best_practices:
    - "Group related fields into logical sections"
    - "Use tabs for complex forms with 15+ fields"
    - "Provide clear field labels and help text"
    - "Set sensible default values"
    - "Validate early and show clear error messages"
    - "Save user progress with auto-save"
  
  quality_guidance: |
    - Use 2-column layouts for better space utilization
    - Place most important fields at the top
    - Use wizards for multi-step processes
    - Include related records in tabs for context
    - Show field requirements clearly

# Examples
examples:
  - title: Create Form with Sections
    code: |
      <ObjectForm
        object="projects"
        mode="create"
        layout={{
          type: 'sections',
          columns: 2,
          sections: [
            {
              name: 'basic',
              label: 'Basic Information',
              fields: ['name', 'description', 'status']
            },
            {
              name: 'timeline',
              label: 'Timeline',
              fields: ['start_date', 'end_date', 'budget']
            }
          ]
        }}
        onSubmit={(values) => createProject(values)}
        onCancel={() => navigate('/projects')}
      />
  
  - title: Edit Form with Auto-Save
    code: |
      <ObjectForm
        object="tasks"
        mode="edit"
        recordId={taskId}
        autoSave={true}
        autoSaveInterval={30000}
        fields={['name', 'description', 'status', 'assignee', 'due_date']}
        onSubmit={(values) => updateTask(taskId, values)}
      />
  
  - title: Wizard Form
    code: |
      <ObjectForm
        object="projects"
        mode="create"
        layout={{
          type: 'wizard',
          steps: [
            { name: 'basic', label: 'Basic Info', fields: ['name', 'category'] },
            { name: 'team', label: 'Team', fields: ['owner', 'team_members'] },
            { name: 'timeline', label: 'Timeline', fields: ['start_date', 'end_date'] }
          ]
        }}
      />
```

### 5.2 QuickCreateForm

**Purpose:** Minimal form for fast record creation.

```yaml
name: QuickCreateForm
label: Quick Create Form
description: Streamlined form with minimal fields for fast record creation
category: data_entry
version: 1.7.0

framework: react
render_mode: client

# Props
props:
  - name: object
    type: string
    required: true
    description: ObjectQL object name
  
  - name: fields
    type: array
    required: true
    description: Minimal fields to include (2-5 recommended)
    examples:
      - [name, assignee, due_date]
  
  - name: defaults
    type: object
    description: Default field values
    examples:
      - { status: 'open', priority: 'medium' }
  
  - name: modalMode
    type: boolean
    default: true
    description: Show as modal dialog
  
  - name: afterCreate
    type: string
    default: close
    enum: [close, stay, redirect]
    description: Behavior after successful creation
  
  - name: onSuccess
    type: function
    description: Handler for successful creation
    signature: "(record: Record) => void"

# AI Context
ai_context:
  purpose: "Enable rapid record creation with minimal friction"
  typical_use_cases:
    - "Quick task creation from anywhere"
    - "Add contact during a call"
    - "Log activity or note quickly"
  best_practices:
    - "Limit to 3-5 fields maximum"
    - "Use smart defaults aggressively"
    - "Show as modal for quick access"
    - "Auto-focus first field"

# Examples
examples:
  - title: Quick Task Creation
    code: |
      <QuickCreateForm
        object="tasks"
        fields={['name', 'assignee', 'due_date']}
        defaults={{ status: 'open', priority: 'medium' }}
        modalMode={true}
        afterCreate="close"
        onSuccess={(task) => showToast(`Task "${task.name}" created`)}
      />
```

## 6. Layout Components

### 6.1 GridLayout

**Purpose:** Responsive grid-based layout for dashboard and page composition.

```yaml
name: GridLayout
label: Grid Layout
description: Responsive grid system for arranging components
category: layout
version: 1.7.0

framework: react
render_mode: client

# Props
props:
  - name: columns
    type: number
    default: 12
    description: Number of grid columns
    validation:
      min: 1
      max: 24
  
  - name: gap
    type: string
    default: md
    enum: [none, xs, sm, md, lg, xl]
    description: Gap between grid items
  
  - name: responsive
    type: object
    description: Responsive breakpoint configuration
    schema:
      mobile: { columns: number }
      tablet: { columns: number }
      desktop: { columns: number }
  
  - name: draggable
    type: boolean
    default: false
    description: Enable drag-and-drop rearrangement
  
  - name: items
    type: array
    description: Grid items configuration
    schema:
      - id: string
        x: number
        y: number
        w: number
        h: number
        component: string
        props: object

# AI Context
ai_context:
  purpose: "Create responsive dashboard and page layouts with drag-and-drop support"
  typical_use_cases:
    - "Dashboard layouts with metrics and charts"
    - "Customizable home pages"
    - "Widget-based interfaces"

# Examples
examples:
  - title: Dashboard Layout
    code: |
      <GridLayout
        columns={12}
        gap="md"
        draggable={true}
        items={[
          { id: 'metrics', x: 0, y: 0, w: 12, h: 2, component: 'MetricRow' },
          { id: 'chart', x: 0, y: 2, w: 8, h: 4, component: 'Chart' },
          { id: 'list', x: 8, y: 2, w: 4, h: 4, component: 'ObjectList' }
        ]}
      />
```

### 6.2 TabContainer

**Purpose:** Organize content into tabbed sections.

```yaml
name: TabContainer
label: Tab Container
description: Tab-based content organization with lazy loading
category: layout
version: 1.7.0

# Props
props:
  - name: tabs
    type: array
    required: true
    description: Tab definitions
    schema:
      - name: string
        label: string
        icon: string
        component: string
        props: object
        lazy: boolean
  
  - name: defaultTab
    type: string
    description: Initially active tab
  
  - name: position
    type: string
    default: top
    enum: [top, bottom, left, right]
    description: Tab bar position
  
  - name: variant
    type: string
    default: line
    enum: [line, enclosed, pills]
    description: Tab visual style

# Examples
examples:
  - title: Project Detail Tabs
    code: |
      <TabContainer
        tabs={[
          { name: 'overview', label: 'Overview', component: 'ProjectOverview' },
          { name: 'tasks', label: 'Tasks', component: 'ObjectTable', props: { object: 'tasks' }, lazy: true },
          { name: 'files', label: 'Files', component: 'FileList', lazy: true }
        ]}
        defaultTab="overview"
      />
```

## 7. Visualization Components

### 7.1 Chart

**Purpose:** Data visualization with multiple chart types.

```yaml
name: Chart
label: Chart
description: Flexible charting component for data visualization
category: visualization
version: 1.7.0

# Props
props:
  - name: type
    type: string
    required: true
    enum: [bar, line, pie, area, scatter, radar, funnel, gauge]
    description: Chart type
  
  - name: data
    type: object | array
    required: true
    description: Chart data
  
  - name: dataSource
    type: object
    description: ObjectQL data source configuration
    schema:
      object: string
      query: object
      transform: function
  
  - name: xField
    type: string
    description: Field for X-axis
  
  - name: yField
    type: string
    description: Field for Y-axis
  
  - name: colorField
    type: string
    description: Field for color grouping
  
  - name: title
    type: string
    description: Chart title
  
  - name: legend
    type: boolean | object
    default: true
    description: Show legend

# Examples
examples:
  - title: Bar Chart from Object Data
    code: |
      <Chart
        type="bar"
        dataSource={{
          object: 'projects',
          query: {
            groupBy: 'status',
            aggregate: { count: '*' }
          }
        }}
        xField="status"
        yField="count"
        title="Projects by Status"
      />
```

### 7.2 Metric

**Purpose:** Display KPI metrics with trend indicators.

```yaml
name: Metric
label: Metric Card
description: Display key performance indicators with trends
category: visualization
version: 1.7.0

# Props
props:
  - name: label
    type: string
    required: true
    description: Metric label
  
  - name: value
    type: number | string
    required: true
    description: Metric value
  
  - name: format
    type: string
    default: number
    enum: [number, currency, percentage, duration]
    description: Value format
  
  - name: trend
    type: object
    description: Trend indicator
    schema:
      value: number
      direction: up | down
      label: string
  
  - name: icon
    type: string
    description: Icon identifier
  
  - name: color
    type: string
    default: blue
    enum: [blue, green, red, yellow, purple, gray]
    description: Color theme

# Examples
examples:
  - title: Revenue Metric
    code: |
      <Metric
        label="Total Revenue"
        value={125000}
        format="currency"
        trend={{ value: 12.5, direction: 'up', label: 'vs last month' }}
        icon="dollar"
        color="green"
      />
```

## 8. Component Inheritance & Override

### 8.1 Extending Built-in Components

Create enhanced versions of built-in components:

```yaml
# MyEnhancedTable.component.yml
name: ObjectTable  # Same name as built-in
extends: ObjectTable
implementation: ./components/MyEnhancedTable.tsx

# Inherit all base props
props:
  # Add new props
  - name: advancedSearch
    type: boolean
    default: true
    description: Enable advanced search UI
  
  - name: columnPresets
    type: array
    description: Predefined column configurations

# Inherit all events and methods from base component
```

### 8.2 Creating Derived Components

Create specialized variants:

```yaml
# ProjectTable.component.yml
name: ProjectTable
extends: ObjectTable
implementation: ./components/ProjectTable.tsx

# Pre-configure for projects
defaults:
  object: projects
  columns:
    - { field: 'name', label: 'Project Name' }
    - { field: 'status', label: 'Status', renderer: 'badge' }
    - { field: 'owner.name', label: 'Owner' }
  defaultSort:
    field: created_at
    direction: desc
```

## 9. Platform Standards

### 9.1 Prop Naming Conventions

- **Boolean props:** Use `is`, `has`, `show`, `enable` prefixes
  - `isDisabled`, `hasError`, `showFooter`, `enableVirtualScroll`

- **Event handlers:** Use `on` prefix
  - `onClick`, `onChange`, `onSubmit`, `onValidate`

- **Render functions:** Use `render` prefix
  - `renderCell`, `renderHeader`, `renderFooter`

- **Data configuration:** Use descriptive nouns
  - `data`, `dataSource`, `columns`, `filters`

### 9.2 Type System

All props must have explicit types:
- **Primitives:** `string`, `number`, `boolean`
- **Objects:** `object` with schema definition
- **Arrays:** `array` with item schema
- **Functions:** `function` with signature
- **Enums:** List of allowed values

### 9.3 Validation Standards

```yaml
validation:
  # Range validation
  min: number
  max: number
  
  # Pattern validation
  pattern: regex_string
  
  # Custom validation
  validator: function
  message: string
  
  # Conditional requirements
  required_when:
    field: value
```

### 9.4 Accessibility Requirements

All components must meet:
- WCAG 2.1 Level AA minimum (AAA preferred)
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- ARIA attributes
- Color contrast requirements

### 9.5 Performance Standards

- Bundle size < 100KB (gzipped) per component
- First render < 100ms
- Re-render < 16ms (60fps)
- Lazy loading support
- Code splitting capability
- Memoization for expensive computations

## 10. Documentation Requirements

Every base component must include:

1. **Purpose statement** - What the component does
2. **Complete prop definitions** - All configurable options
3. **Event documentation** - All emitted events
4. **Method signatures** - Imperative API
5. **AI context** - LLM-friendly usage guidance
6. **Examples** - At least 3 usage examples
7. **Best practices** - Recommendations
8. **Common errors** - Known pitfalls

## 11. Testing Standards

Base components require:

1. **Unit tests** - All props and methods
2. **Integration tests** - Component composition
3. **Accessibility tests** - A11y compliance
4. **Visual regression tests** - UI consistency
5. **Performance tests** - Bundle size and render time

## 12. See Also

- [Component Specification](./component.md) - Detailed component metadata spec
- [Page Specification](./page.md) - Page layout and composition
- [Form Specification](./form.md) - Form metadata structure
- [View Specification](./view.md) - Data view configurations
- [Component Package Specification](./component-package.md) - Packaging and distribution
