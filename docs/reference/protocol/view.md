---
title: "View & Layout Metadata"
---

> **Implementation Status**: ✅ **100% Complete** - All view types are fully implemented and production-ready.
> 
> See [Implementation Status](./implementation-status.md#view-components) for detailed component status.

Views define how data is presented to users in different contexts (list, detail, grid, kanban, calendar, etc.). They are the UI presentation layer of ObjectQL metadata.

## 1. Overview

View metadata separates the presentation logic from the data model, allowing the same object to be displayed differently based on context, user role, or device type.

**File Naming Convention:** `<view_name>.view.yml`

The filename (without the `.view.yml` extension) automatically becomes the view's identifier. This eliminates the need for a redundant `name` property.

**Examples:**
- `task_list.view.yml` → View name: `task_list`
- `customer_kanban.view.yml` → View name: `customer_kanban`
- `project_calendar.view.yml` → View name: `project_calendar`

## 2. View Types

ObjectQL supports multiple view types for different use cases:

| View Type | Status | Description | Use Case |
|:---|:------|:---|:---|
| `list` | ✅ Implemented | Tabular list of records | Default view for browsing data |
| `grid` | ✅ Implemented | Data grid with inline editing | Power user data entry |
| `kanban` | ✅ Implemented | Kanban board grouped by field | Task/project management |
| `calendar` | ✅ Implemented | Calendar view with events | Scheduling, timeline views |
| `timeline` | ✅ Implemented | Gantt-style timeline | Project planning |
| `card` | ✅ Implemented | Card-based layout | Mobile-friendly browsing |
| `detail` | ✅ Implemented | Single record detail view | Record inspection |
| `form` | ✅ Implemented | Editable form layout | Data entry/editing |

### View Rendering Components

These are the UI components used to render the view types above:

| Component | Status | Package | Used By View Types | Notes |
|:----------|:-------|:--------|:-------------------|:------|
| List | ✅ Implemented | @object-ui/components | `list` | Ordered/unordered lists |
| Table | ✅ Implemented | @object-ui/components | `list`, `grid` | Basic HTML table |
| Data Table | ✅ Implemented | @object-ui/components | `list`, `grid` | Advanced table with sorting, filtering, pagination |
| Kanban | ✅ Implemented | @object-ui/components | `kanban` | Drag-and-drop kanban board |
| Calendar View | ✅ Implemented | @object-ui/components | `calendar` | Full calendar with events |
| Timeline | ✅ Implemented | @object-ui/components | `timeline` | Timeline/Gantt chart |
| Card | ✅ Implemented | @object-ui/components | `card` | Card layout component |
| Grid | ✅ Implemented | @object-ui/components | `grid` | CSS Grid layout |

## 3. Root Properties

```yaml
# File: task_list.view.yml
# View name is inferred from filename!

label: Task List
type: list
object: tasks  # Must specify which object to display
description: Default task listing view

# View Configuration
config:
  columns: [...]
  filters: [...]
  sort: [...]
  actions: [...]
```

| Property | Type | Required | Description |
|:---|:---|:---|:---|
| `label` | `string` | ✓ | Display name for the view |
| `type` | `ViewType` | ✓ | Type of view (list, grid, kanban, etc.) |
| `object` | `string` | ✓ | Target object name |
| `description` | `string` | | Help text or purpose |
| `icon` | `string` | | Icon identifier |
| `default` | `boolean` | | Whether this is the default view for the object |
| `config` | `object` | ✓ | View-specific configuration |

**Note:** The `name` property is **no longer needed** - it's automatically inferred from the filename.

## 4. List View Configuration

The most common view type for browsing records.

```yaml
# File: task_list.view.yml

type: list
object: tasks
config:
  # Column Definitions
  columns:
    - field: name
      label: Task Name
      width: 300
      sortable: true
      searchable: true
      
    - field: status
      label: Status
      width: 120
      renderer: badge
      
    - field: priority
      label: Priority
      width: 100
      renderer: priority_indicator
      
    - field: assignee.name
      label: Assigned To
      width: 150
      
    - field: due_date
      label: Due Date
      width: 120
      renderer: date
      format: MM/DD/YYYY
  
  # Default Filters
  default_filters:
    - field: status
      operator: "!="
      value: completed
  
  # Default Sort Order
  default_sort:
    - field: priority
      direction: desc
    - field: due_date
      direction: asc
  
  # Pagination
  page_size: 50
  
  # Available Actions
  row_actions:
    - complete_task
    - edit
    - delete
  
  bulk_actions:
    - bulk_assign
    - bulk_delete
```

### 4.1 Column Configuration

| Property | Type | Description |
|:---|:---|:---|
| `field` | `string` | Field path (supports dot notation for related fields) |
| `label` | `string` | Column header text |
| `width` | `number` | Column width in pixels |
| `sortable` | `boolean` | Enable column sorting |
| `searchable` | `boolean` | Include in search filter |
| `renderer` | `string` | Custom renderer type (badge, link, date, etc.) |
| `format` | `string` | Format string for dates/numbers |
| `hidden` | `boolean` | Hide by default (user can unhide) |

## 5. Kanban View Configuration

Kanban views group records by a specific field value.

```yaml
name: task_kanban
type: kanban
object: tasks
config:
  # Grouping Field
  group_by: status
  
  # Card Configuration
  card:
    title_field: name
    subtitle_field: assignee.name
    description_field: description
    image_field: cover_image
    
    # Additional fields to display on card
    fields:
      - field: priority
        renderer: badge
      - field: due_date
        renderer: date_badge
    
    # Card Actions
    actions:
      - edit
      - delete
  
  # Column Configuration
  columns:
    - value: backlog
      label: Backlog
      color: gray
      
    - value: in_progress
      label: In Progress
      color: blue
      limit: 5  # WIP limit
      
    - value: done
      label: Done
      color: green
  
  # Enable drag & drop between columns
  draggable: true
  
  # Filter
  filters:
    - field: archived
      operator: "="
      value: false
```

## 6. Calendar View Configuration

Calendar views display records as events on a timeline.

```yaml
name: event_calendar
type: calendar
object: events
config:
  # Date Field Mapping
  start_date_field: start_time
  end_date_field: end_time
  all_day_field: is_all_day
  
  # Event Display
  title_field: name
  color_field: event_type
  
  # Color Mapping
  color_mapping:
    meeting: blue
    deadline: red
    holiday: green
  
  # Default View
  default_view: month  # month, week, day, agenda
  
  # Allow creation via click
  allow_create: true
  
  # Actions
  event_actions:
    - edit
    - delete
    - duplicate
```

## 7. Detail View Configuration

Detail views show a single record with full field display.

```yaml
name: project_detail
type: detail
object: projects
config:
  # Layout Sections
  sections:
    - name: overview
      label: Project Overview
      columns: 2
      fields:
        - name
        - status
        - owner
        - start_date
        - end_date
        - budget
    
    - name: description
      label: Description
      columns: 1
      fields:
        - description
        - objectives
    
    - name: team
      label: Team Members
      type: related_list
      relation: team_members
      columns:
        - member.name
        - role
        - hours_allocated
  
  # Related Lists (child objects)
  related_lists:
    - object: tasks
      relation_field: project_id
      label: Project Tasks
      default_view: task_list
      allow_create: true
      
    - object: files
      relation_field: project_id
      label: Attachments
      view_type: grid
```

## 8. Responsive Design

Views can define responsive breakpoints for mobile/tablet optimization.

```yaml
config:
  responsive:
    mobile:
      # Show fewer columns on mobile
      columns:
        - name
        - status
      
      # Use card layout instead of table
      layout: card
      
    tablet:
      columns:
        - name
        - status
        - assignee
        - due_date
```

## 9. Conditional Rendering

Show/hide elements based on conditions.

```yaml
config:
  columns:
    - field: internal_notes
      label: Internal Notes
      # Only show to admins
      visible_if:
        user_role: admin
    
    - field: approval_status
      label: Approval
      # Only show if amount > 1000
      visible_if:
        field: amount
        operator: ">"
        value: 1000
```

## 10. Custom Renderers

Define custom rendering logic for specific field types.

```yaml
config:
  renderers:
    priority_indicator:
      type: component
      component: PriorityBadge
      props:
        showIcon: true
        
    status_badge:
      type: badge
      color_mapping:
        draft: gray
        pending: yellow
        approved: green
        rejected: red
```

## 11. View Permissions

Control who can see and use specific views.

```yaml
permissions:
  # Who can see this view
  read:
    - admin
    - manager
    - user
  
  # Who can modify view settings
  modify:
    - admin
  
  # Field-level visibility
  field_permissions:
    salary:
      visible_to: [admin, hr_manager]
```

## 12. Implementation Example

```typescript
// src/views/task_list.view.yml
import { ViewDefinition } from '@objectql/types';

export const task_list: ViewDefinition = {
  name: 'task_list',
  type: 'list',
  object: 'tasks',
  config: {
    columns: [
      { field: 'name', label: 'Task', width: 300 },
      { field: 'status', label: 'Status', renderer: 'badge' }
    ],
    default_filters: [
      ['status', '!=', 'completed']
    ],
    default_sort: [
      ['priority', 'desc']
    ]
  }
};
```

## 13. Best Practices

1. **Start Simple**: Begin with list and detail views, add specialized views as needed
2. **Reusable Renderers**: Create custom renderers for commonly used patterns
3. **Mobile First**: Always define responsive behavior for mobile devices
4. **Performance**: Limit initial column count for large datasets
5. **User Customization**: Allow users to save personal view preferences
6. **Accessibility**: Ensure proper ARIA labels and keyboard navigation

## 14. Related Specifications

- [Objects & Fields](./object.md) - Data model definition
- [Forms](./form.md) - Editable form layouts
- [Permissions](./permission.md) - Access control
- [Actions](./action.md) - Available operations
