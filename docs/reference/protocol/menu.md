---
title: "Menu & Navigation Metadata"
---

> **Implementation Status**: 🚧 **40% Complete** - Basic navigation components implemented, advanced features planned.
> 
> See [Implementation Status](./implementation-status.md#navigation-components) for detailed status.

Menu and navigation metadata defines the application structure, navigation hierarchy, and user interface organization.

## 1. Overview

Navigation features include:

- **Menu Structures**: Top nav, side nav, context menus
  - Header Bar: ✅ Implemented
  - Sidebar: ✅ Implemented
  - Dropdown Menu: ✅ Implemented
  - Context Menu: ✅ Implemented
- **Hierarchical Organization**: Nested menu items and folders 🚧 Partial
- **Dynamic Menus**: Role-based, permission-aware navigation 📝 Planned
- **Quick Actions**: Global actions and shortcuts 📝 Planned
- **Breadcrumbs**: Automatic navigation trails 📝 Planned (Q2 2026)
- **Search Integration**: Global search within navigation 📝 Planned

**File Naming Convention:** `<menu_name>.menu.yml`

The filename (without the `.menu.yml` extension) automatically becomes the menu's identifier.

**Examples:**
- `main_navigation.menu.yml` → Menu name: `main_navigation`
- `admin_menu.menu.yml` → Menu name: `admin_menu`

**Note:** Menu metadata is often embedded within Application metadata (`.app.yml` files) as the `navigation` property. See [Application Metadata](./application.md) for the recommended approach.

## 2. Root Structure

```yaml
# File: main_navigation.menu.yml
# Menu name is inferred from filename!

label: Main Menu
type: sidebar  # sidebar, topnav, context, mobile
app: sales     # Optional: Link to a specific application

# Menu Items
items:
  # Dashboard
  - name: home
    label: Home
    icon: home
    path: /
    type: page
  
  # Sales Section
  - name: sales
    label: Sales
    icon: currency
    type: section
    items:
      - name: leads
        label: Leads
        icon: users
        path: /sales/leads
        object: leads
        view: list
      
      - name: opportunities
        label: Opportunities
        icon: funnel
        path: /sales/opportunities
        object: opportunities
        view: kanban
      
      - name: quotes
        label: Quotes
        icon: document
        path: /sales/quotes
        object: quotes
  
  # Service Section
  - name: service
    label: Service
    icon: support
    type: section
    items:
      - name: cases
        label: Cases
        path: /service/cases
        object: cases
        badge:
          query:
            object: cases
            filters: [['status', '=', 'open']]
            function: count
          color: red
      
      - name: knowledge
        label: Knowledge Base
        path: /service/knowledge
        object: articles
  
  # Reports
  - name: reports
    label: Reports
    icon: chart
    type: section
    items:
      - name: sales_reports
        label: Sales Reports
        type: folder
        items:
          - name: revenue_report
            label: Revenue Report
            path: /reports/revenue
            icon: report
          
          - name: pipeline_report
            label: Pipeline Report
            path: /reports/pipeline
            icon: report
      
      - name: dashboards
        label: Dashboards
        type: folder
        items:
          - name: sales_dashboard
            label: Sales Dashboard
            path: /dashboards/sales
            icon: dashboard

  # Divider
  - type: divider
  
  # Settings
  - name: settings
    label: Settings
    icon: settings
    path: /settings
    permissions:
      - admin

# Quick Actions (Global)
quick_actions:
  - name: new_lead
    label: New Lead
    icon: add
    action: create_record
    object: leads
    hotkey: Ctrl+Shift+L
  
  - name: new_case
    label: New Case
    icon: add
    action: create_record
    object: cases
    hotkey: Ctrl+Shift+C
  
  - name: search
    label: Global Search
    icon: search
    action: open_search
    hotkey: Ctrl+K
```

## 3. Menu Types

| Type | Description | Use Case |
|:---|:---|:---|
| `sidebar` | Vertical side navigation | Main app navigation |
| `topnav` | Horizontal top bar | Secondary navigation |
| `context` | Context-sensitive menu | Right-click, actions menu |
| `mobile` | Mobile hamburger menu | Mobile navigation |
| `breadcrumb` | Navigation trail | Page hierarchy |

## 4. Menu Item Types

### 4.1 Page Links

```yaml
items:
  - name: dashboard
    label: Dashboard
    type: page
    path: /dashboard
    icon: home
    
    # Open behavior
    target: _self  # _self, _blank, modal
    
    # Highlight when active
    active_match: /dashboard*
```

### 4.2 Object Views

Direct links to object list views:

```yaml
items:
  - name: accounts
    label: Accounts
    type: object
    object: accounts
    view: list  # Uses default or specified view
    icon: company
    path: /accounts
    
    # Quick filters
    default_filters:
      - field: status
        operator: "="
        value: active
```

### 4.3 Sections/Folders

Group related items:

```yaml
items:
  - name: sales_section
    label: Sales
    type: section  # or 'folder'
    icon: currency
    
    # Collapsible
    collapsible: true
    collapsed: false
    
    # Nested items
    items:
      - name: leads
        label: Leads
        path: /leads
      
      - name: accounts
        label: Accounts
        path: /accounts
```

### 4.4 Actions

Execute actions from menu:

```yaml
items:
  - name: export_data
    label: Export Data
    type: action
    icon: download
    action: export_records
    
    # Confirmation
    confirm: Export all data?
    
    # Params
    params:
      format: csv
```

### 4.5 External Links

Link to external resources:

```yaml
items:
  - name: help_center
    label: Help Center
    type: external
    url: https://help.example.com
    icon: help
    target: _blank
```

### 4.6 Dividers

Visual separators:

```yaml
items:
  - type: divider
  
  # Or with label
  - type: divider
    label: Admin Tools
```

## 5. Dynamic Menu Items

Menu items that adapt based on context:

```yaml
items:
  # Show only if user has permission
  - name: admin_panel
    label: Admin Panel
    path: /admin
    icon: shield
    
    permissions:
      - admin
  
  # Show based on feature flag
  - name: beta_feature
    label: Beta Feature
    path: /beta
    
    visible_when:
      feature_flag: beta_features_enabled
  
  # Show based on condition
  - name: pending_approvals
    label: Pending Approvals
    path: /approvals
    
    visible_when:
      query:
        object: approvals
        filters: [['status', '=', 'pending']]
        function: count
        operator: ">"
        value: 0
```

## 6. Badges & Indicators

Show counts or status on menu items:

```yaml
items:
  - name: notifications
    label: Notifications
    path: /notifications
    icon: bell
    
    # Badge configuration
    badge:
      # Dynamic count
      query:
        object: notifications
        filters:
          - field: read
            operator: "="
            value: false
          - field: user_id
            operator: "="
            value: $current_user.id
        function: count
      
      # Styling
      color: red  # red, blue, green, yellow, gray
      max_value: 99  # Show "99+" if exceeds
      show_zero: false
```

## 7. Favorites & Pinned Items

User-customizable favorites:

```yaml
favorites:
  enabled: true
  
  # Default favorites
  default_items:
    - dashboard
    - my_tasks
    - my_calendar
  
  # Max favorites
  max_favorites: 10
  
  # Position
  position: top  # top, bottom, section
  
  # Label
  section_label: Favorites
```

## 8. Recent Items

Track recently accessed items:

```yaml
recent_items:
  enabled: true
  
  # Number to track
  max_items: 10
  
  # Include types
  include_types:
    - page
    - object
    - report
  
  # Position in menu
  position: top
  section_label: Recent
```

## 9. Search Integration

Global search in navigation:

```yaml
search:
  enabled: true
  
  # Position
  position: top
  
  # Hotkey
  hotkey: Ctrl+K
  
  # Search scope
  scope:
    - objects
    - reports
    - dashboards
    - help_articles
  
  # Quick actions in search
  quick_actions:
    - label: New Lead
      action: create_record
      object: leads
    
    - label: New Task
      action: create_record
      object: tasks
```

## 10. Breadcrumbs

Automatic navigation trail:

```yaml
breadcrumbs:
  enabled: true
  
  # Show on pages
  show_on:
    - object_detail
    - object_edit
    - reports
  
  # Format
  separator: "/"
  
  # Home link
  include_home: true
  home_label: Home
  
  # Truncation
  max_items: 5
  truncate_middle: true
```

## 11. Multi-Level Navigation

Complex nested structures:

```yaml
items:
  - name: sales
    label: Sales
    type: section
    icon: currency
    
    items:
      # Level 2
      - name: pipeline
        label: Pipeline Management
        type: folder
        
        items:
          # Level 3
          - name: leads
            label: Leads
            path: /sales/pipeline/leads
          
          - name: opportunities
            label: Opportunities
            path: /sales/pipeline/opportunities
      
      # Level 2
      - name: accounts
        label: Account Management
        type: folder
        
        items:
          # Level 3
          - name: all_accounts
            label: All Accounts
            path: /sales/accounts
          
          - name: my_accounts
            label: My Accounts
            path: /sales/accounts/mine
```

## 12. Responsive Navigation

Mobile-optimized menus:

```yaml
responsive:
  # Mobile behavior
  mobile:
    type: drawer  # drawer, tabs, bottom_nav
    
    # Collapsed by default
    collapsed: true
    
    # Show icons only
    compact: true
    
    # Bottom navigation
    bottom_nav:
      enabled: true
      max_items: 5
      items:
        - home
        - tasks
        - notifications
        - profile
  
  # Tablet
  tablet:
    type: sidebar
    collapsible: true
    width: 240
```

## 13. Context Menus

Right-click and action menus:

```yaml
# File: record_context_menu.menu.yml
# Menu name is inferred from filename!

type: context
object: tasks

items:
  - name: edit
    label: Edit
    icon: edit
    action: edit_record
  
  - name: delete
    label: Delete
    icon: delete
    action: delete_record
    confirm: Delete this task?
    destructive: true
  
  - type: divider
  
  - name: duplicate
    label: Duplicate
    icon: copy
    action: duplicate_record
  
  - name: share
    label: Share
    icon: share
    action: share_record
  
  - type: divider
  
  - name: change_status
    label: Change Status
    icon: status
    type: submenu
    items:
      - label: Mark Complete
        action: update_field
        field: status
        value: completed
      
      - label: Mark In Progress
        action: update_field
        field: status
        value: in_progress
```

## 14. Theme & Styling

Customize menu appearance:

```yaml
theme:
  # Width
  width: 280
  collapsed_width: 64
  
  # Colors
  background: "#1a1a1a"
  text_color: "#ffffff"
  active_background: "#2d2d2d"
  active_text_color: "#4CAF50"
  
  # Icons
  icon_size: 20
  show_icons: true
  
  # Typography
  font_size: 14
  font_weight: 400
  
  # Spacing
  item_padding: 12
  section_padding: 20
  
  # Animation
  animation_duration: 200
  hover_effect: true
```

## 15. Keyboard Navigation

Keyboard shortcuts and accessibility:

```yaml
keyboard_navigation:
  enabled: true
  
  # Shortcuts
  shortcuts:
    toggle_menu: Alt+M
    search: Ctrl+K
    next_item: ArrowDown
    prev_item: ArrowUp
    expand_section: ArrowRight
    collapse_section: ArrowLeft
    select: Enter
  
  # Accessibility
  aria_labels: true
  focus_visible: true
  skip_navigation: true
```

## 16. User Customization

Allow users to customize navigation:

```yaml
user_customization:
  # Reorder items
  allow_reorder: true
  
  # Show/hide items
  allow_toggle_visibility: true
  
  # Custom folders
  allow_custom_folders: true
  
  # Themes
  allow_theme_selection: true
  
  # Save preferences
  save_preferences: true
  per_user: true
```

## 17. Analytics & Tracking

Track navigation usage:

```yaml
analytics:
  enabled: true
  
  # Track events
  track:
    - menu_item_click
    - search_usage
    - quick_action_usage
  
  # Metrics
  metrics:
    - popular_items
    - user_navigation_paths
    - search_queries
```

## 18. Implementation Example

Complete menu definition:

```yaml
# File: main_navigation.menu.yml
# Menu name is inferred from filename!

label: Main Navigation
type: sidebar

items:
  - name: home
    label: Home
    icon: home
    path: /
  
  - name: sales
    label: Sales
    icon: currency
    type: section
    items:
      - name: leads
        label: Leads
        path: /leads
        object: leads
      
      - name: accounts
        label: Accounts
        path: /accounts
        object: accounts
```

**TypeScript Implementation:**

```typescript
// File: main_navigation.menu.ts
import { MenuDefinition } from '@objectql/types';

export const main_menu: MenuDefinition = {
  type: 'sidebar',
  items: [
    {
      name: 'home',
      label: 'Home',
      icon: 'home',
      path: '/'
    },
    {
      name: 'sales',
      label: 'Sales',
      icon: 'currency',
      type: 'section',
      items: [
        {
          name: 'leads',
          label: 'Leads',
          path: '/leads',
          object: 'leads'
        },
        {
          name: 'accounts',
          label: 'Accounts',
          path: '/accounts',
          object: 'accounts'
        }
      ]
    }
  ]
};
```

## 19. Best Practices

1. **Hierarchy**: Keep menu depth to 2-3 levels maximum
2. **Icons**: Use consistent, meaningful icons
3. **Labels**: Clear, concise menu labels
4. **Grouping**: Logically group related items
5. **Performance**: Lazy-load large menus
6. **Mobile**: Optimize for touch interfaces
7. **Accessibility**: Support keyboard navigation and screen readers
8. **Permissions**: Filter menu items by user permissions
9. **Testing**: Test navigation with different user roles

## 20. Related Specifications

- [Permissions](./permission.md) - Access control
- [Views](./view.md) - Page layouts
- [Objects](./object.md) - Data models
- [Actions](./action.md) - Menu actions
