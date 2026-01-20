---
title: "Component Library Reference"
---

This document provides a reference for all the low-level UI components available in the **Object-UI Renderer**.
These components are registered in the `ComponentRegistry` and can be used directly in your JSON Schema definitions.

## 1. Basic Components
Fundamental building blocks for structure and text.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `div` | A standard container element | `className`, `children` |
| `span` | Inline container element | `className`, `children` |
| `text` | Simple text node | `value`, `className` |
| `separator` | A visual divider | `orientation` |

## 2. Form Components
Input controls for data collection.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `button` | Clickable button | `label`, `variant`, `size`, `onClick` |
| `input` | Single-line text input | `type`, `placeholder` |
| `textarea` | Multi-line text input | `placeholder`, `rows` |
| `checkbox` | Boolean toggle box | `label`, `checked` |
| `switch` | Boolean toggle switch | `label`, `checked` |
| `select` | Dropdown selection | `placeholder`, `options` |
| `slider` | Range slider | `min`, `max`, `step`, `defaultValue` |
| `radio-group` | Single selection from list | `items`, `defaultValue` |
| `toggle` | Two-state button | `pressed`, `size`, `variant` |
| `toggle-group` | Set of two-state buttons | `type`, `items` |
| `input-otp` | One-time password input | `maxLength` |
| `calendar` | Date picker view | `mode`, `selected` |

## 3. Layout Components
Components for organizing page structure.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `card` | Container with header/content/footer | `title`, `description`, `content`, `footer` |
| `tabs` | Tabbed content areas | `defaultValue`, `items` |
| `resizable` | Resizable panel groups | `direction`, `panels` |
| `scroll-area` | Scrollable container | `height`, `width`, `orientation` |

## 4. Navigation Components
Components for moving between views or contexts.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `header-bar` | Top navigation bar | `title`, `user`, `items` |
| `sidebar-provider` | Root provider for sidebar context | - |
| `sidebar` | Main sidebar container | `side`, `collapsible`, `variant` |
| `sidebar-header` | Sidebar top section | `children` |
| `sidebar-content` | Sidebar scrollable content | `children` |
| `sidebar-group` | Grouping of sidebar items | `label` |
| `sidebar-menu` | Menu list within a group | `children` |
| `sidebar-menu-item` | Individual menu item wrapper | `children` |
| `sidebar-menu-button` | Clickable menu button | `isActive`, `tooltip`, `children` |
| `sidebar-footer` | Sidebar bottom section | `children` |
| `sidebar-trigger` | Button to toggle sidebar | - |

## 5. Data Display Components
Components for visualizing data.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `badge` | Status/Tag indicator | `variant`, `children` |
| `avatar` | User image/initials | `src`, `alt`, `fallback` |
| `alert` | Highlighted message | `variant`, `title`, `description` |
| `table` | Data-driven table | `columns`, `data`, `caption`, `footer` |
| `carousel` | Slideshow component | `items`, `orientation`, `showArrows` |
| `calendar-view` | Airtable-style calendar | `data`, `view`, `titleField`, `startDateField`, `endDateField`, `colorField` |

## 6. Feedback Components
Indicators for system status or feedback.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `progress` | Progress bar | `value` |
| `skeleton` | Loading placeholder state | `width`, `height` |
| `toaster` | Toast notification provider | `provider` |

## 7. Overlay Components
Content that appears on top of other content.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `dialog` | Modal dialog window | `trigger`, `content`, `title`, `description` |
| `alert-dialog` | Urgent modal interruption | `title`, `description`, `actionText`, `cancelText` |
| `sheet` | Slide-out panel | `side`, `trigger`, `content` |
| `drawer` | Bottom/Side drawer | `trigger`, `content`, `shouldScaleBackground` |
| `popover` | Content popup on trigger | `trigger`, `content`, `align` |
| `tooltip` | Hover info tip | `trigger`, `content`, `side` |
| `hover-card` | Preview card on hover | `trigger`, `content` |
| `dropdown-menu` | Menu from a trigger | `trigger`, `items` (recursive) |
| `context-menu` | Menu from right-click | `trigger`, `items` (recursive) |

## 8. Disclosure Components
Components that hide/show content.

| Component Name | Description | Key Properties |
|:---|:---|:---|
| `accordion` | Vertically stacked headers | `items`, `type`, `collapsible` |
| `collapsible` | Expandable section | `trigger`, `content`, `open` |

