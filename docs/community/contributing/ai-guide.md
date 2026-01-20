---
title: "AI Generation Guide: Object UI"
---

**This document is optimized for LLMs.** Use this context to generate high-quality, bug-free Object UI JSON schemas.

## 1. Core Mental Model

*   **You are a Schema Engine**: You do not write React code. You write **JSON** that describes a UI.
*   **Recursive Structure**: Every component is a node. `children` prop can contain arrays of other nodes.
*   **Tailwind Native**: Styling is done via `className`. Use standardized margins/padding (e.g., `p-4`, `gap-4`).

## 2. The Enterprise Component Palette

Use these strictly typed components. Do not hallucinate `type` names.

### Layout (The Skeleton)
*   **`page`**: Top-level container. Properties: `title`, `body[]`.
*   **`grid`**: CSS Grid. Properties: `columns` (number), `gap` (number), `children[]`.
*   **`flex`**: Flexbox. Properties: `direction` ('row'|'col'), `gap`, `justify`, `align`, `children[]`.
*   **`card`**: Content container. Properties: `title`, `description`, `header` (node), `children` (body), `footer` (node).
*   **`tabs`**: Tabbed interface. Properties: `items: [{ label, value, content }]`.
*   **`resizable`**: Split pane. Properties: `direction`, `panels: [{ defaultSize, content }]`.

### Form (The Input)
*   **`form`**: Data context wrapper. Properties: `mode` ('edit'|'read'), `layout`, `actions` (toolbar), `body[]`. **Crucial**: Inputs must be inside a form to bind data.
*   **`input`**: Text/Number. Properties: `name` (key), `label`, `inputType`, `required`, `colSpan` (grid width).
*   **`select`**: Dropdown. Properties: `name`, `label`, `options: [{ label, value }]`, `colSpan`.
*   **`date-picker`**: Date/Time. Properties: `name`, `label`, `mode`, `colSpan`.
*   **`checkbox` / `switch`**: Boolean.
*   **`upload`**: File handling.

### Data (The Output)
*   **`data-table`**: Enterprise Grid. Properties: `data` (array), `toolbar`, `columns: [{ header, accessorKey, fixed, align, width, type }]`.
*   **`statistic`**: KPI Metrics. Properties: `label`, `value`, `trend`.
*   **`tag`** / **`badge`**: Status indicators.

## 3. Golden Rules for Generation

1.  **Always use `name` in Inputs**: Without `name`, the form cannot save data.
2.  **Combine Layouts**: Don't just dump fields. Wrap them in `grid` -> `card` for structure.
3.  **Strict Types**:
    *   `className` is always a STRING.
    *   `children` is an ARRAY of objects.
4.  **Data Binding**:
    *   In `table`, `field` matches the data key.
    *   In `form`, `name` matches the submission key.

## 4. One-Shot Examples

### Scenario: CRM Customer Detail Page
*Pattern: Header + Sidebar Layout + Tabbed Content*

```json
{
  "type": "page",
  "title": "Customer: Acme Corp",
  "body": [
    {
      "type": "grid",
      "columns": 12,
      "gap": 6,
      "children": [
        {
          "type": "div",
          "className": "col-span-12 md:col-span-4",
          "children": [
             {
               "type": "card",
               "title": "Contact Info",
               "children": [
                 { "type": "text", "value": "email@acme.com", "className": "text-sm" },
                 { "type": "text", "value": "+1 555 0199", "className": "text-sm" }
               ]
             }
          ]
        },
        {
          "type": "div",
          "className": "col-span-12 md:col-span-8",
          "children": [
            {
              "type": "tabs",
              "defaultValue": "activity",
              "items": [
                {
                  "label": "Activity",
                  "value": "activity",
                  "content": { "type": "timeline", "items": [] }
                },
                {
                  "label": "Opportunities",
                  "value": "opportunities",
                  "content": {
                    "type": "table",
                    "columns": [
                      { "title": "Deal Name", "field": "name" },
                      { "title": "Amount", "field": "amount" }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### Scenario: Enterprise Settings Form
*Pattern: Card-based Sections + Form Context*

```json
{
  "type": "form",
  "submitLabel": "Save Changes",
  "layout": "vertical",
  "body": [
    {
      "type": "card",
      "title": "General Settings",
      "description": "Basic account configuration",
      "children": [
        {
          "type": "grid",
          "columns": 2,
          "gap": 4,
          "children": [
            { "type": "input", "name": "companyName", "label": "Company Name", "required": true },
            { "type": "select", "name": "industry", "label": "Industry", "options": [{"label": "Tech", "value": "tech"}] }
          ]
        }
      ]
    },
    {
      "type": "card",
      "title": "Notifications",
      "className": "mt-4",
      "children": [
        { "type": "switch", "name": "emailAlerts", "label": "Email Alerts" },
        { "type": "switch", "name": "smsAlerts", "label": "SMS Alerts" }
      ]
    }
  ]
}
```
