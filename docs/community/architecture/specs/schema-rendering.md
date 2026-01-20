---
title: "JSON Schema Rendering Specification"
---

This document defines the Object UI rendering architecture, inspired by [Amis](https://github.com/baidu/amis). It allows building dynamic, data-driven user interfaces strictly through JSON configuration, decoupling the UI definition from the implementation.

## 1. Core Concepts

The rendering system is built on a recursive JSON structure where every UI element is a **Schema Node**. The renderer traverses this tree and transforms it into React components. The architecture follows the [Next-Gen Architecture Blueprint](./architecture.md), utilizing React 18, Tailwind CSS, and Shadcn/UI.

### 1.1 Schema Node

The fundamental unit of the UI.

```typescript
interface SchemaNode {
  /**
   * Component type, e.g., "page", "form", "button", "tpl"
   */
  type: string;

  /**
   * CSS class name
   */
  className?: string;

  /**
   * Visibility expression.
   * e.g., "${data.isAdmin}"
   */
  visibleOn?: string;

  /**
   * Hidden expression
   */
  hiddenOn?: string;
  
  /**
   * Unique ID for the node, useful for actions targeting this component
   */
  id?: string;

  /**
   * Child nodes (for container components)
   */
  body?: SchemaNode | SchemaNode[];

  /**
   * Other props specific to the component type
   */
  [key: string]: any;
}
```

### 1.2 The Page

The root of the schema is typically a `Page` component.

```json
{
  "type": "page",
  "title": "Welcome",
  "body": {
    "type": "form",
    "body": [
      {
        "type": "input-text",
        "name": "username",
        "label": "Username"
      }
    ]
  }
}
```

## 2. Data Scope & Context

A key feature of the rendering system is the hierarchical **Data Scope**.

*   **Inheritance**: Children inherit data from their parents.
*   **Isolation**: Some components (like Form) can create a new data scope.
*   **Variable Substitution**: Values in the schema can be dynamic using `${variable}` syntax.

### 2.1 Variable Substitution

Any string value in the schema beginning with `$` can be treated as an expression or variable.

- **Variables**: `${username}` maps to `data.username` in the current scope.
- **Lodash/Path**: `${items[0].title}` supported.

### 2.2 Expressions

Used in `visibleOn`, `disabledOn`, etc.

```json
{
  "type": "button",
  "label": "Delete",
  "visibleOn": "${data.role === 'admin'}"
}
```

## 3. Component Registry

The `SchemaRenderer` relies on a registry mapping `type` strings to React components.

```typescript
// Conceptual Registry
const registry = {
  'page': PageComponent,
  'form': FormComponent,
  'input-text': InputTextComponent,
  // ...
};
```

Developers can register custom components:

```typescript
registerRenderer({
  type: 'my-custom-component',
  component: MyReactComponent
});
```

## 4. Actions & Events

Components interact through standardized actions.

```json
{
  "type": "button",
  "label": "Save",
  "onEvent": {
    "click": {
      "actions": [
        {
          "actionType": "ajax",
          "api": "/api/save",
          "args": {
             "payload": "${data}"
          }
        }
      ]
    }
  }
}
```

## 5. Layouts & Containers

Components that contain other components.

- **Wrapper**: Simple container.
- **Grid**: Column-based layout.
- **HBox / VBox**: Flex layouts.
- **Service**: Loads data effectively creating a new data scope for its `body`.

Example Grid:

```json
{
  "type": "grid",
  "columns": [
    {
      "md": 6,
      "body": { "type": "tpl", "tpl": "Left Column" }
    },
    {
      "md": 6,
      "body": { "type": "tpl", "tpl": "Right Column" }
    }
  ]
}
```

## 6. Remote Schemas

The schema itself can be loaded dynamically from an API, enabling Backend-Driven UI.

```json
{
  "type": "service",
  "schemaApi": "/api/pages/dashboard"
}
```
