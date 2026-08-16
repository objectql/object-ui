# JSON Protocol Rules

> **Critical:** All ObjectUI schemas MUST strictly follow `@objectstack/spec` definitions.

## Rule: Expression Evaluation Boundaries

### Fields That ARE Evaluated

SchemaRenderer evaluates these fields automatically. **Evaluated is not the
same as read** — see "Rule: Keys Live on the Node" below for the second gate a
value must clear before it reaches the screen.

| Field | Evaluation Type | Return Type | Example |
|---|---|---|---|
| `content` | Template (`${}`) | string | `"content": "Total: ${data.total}"` |
| `hidden` | Condition | boolean | `"hidden": "${data.role !== 'admin'}"` |
| `hiddenOn` | Condition | boolean | `"hiddenOn": "data.status === 'draft'"` |
| `visible` | Condition | boolean | `"visible": "${data.isActive}"` |
| `visibleOn` | Condition | boolean | `"visibleOn": "data.permissions.canView"` |
| `disabled` | Condition | boolean | `"disabled": "${form.isSubmitting}"` |
| `disabledOn` | Condition | boolean | `"disabledOn": "!data.hasPermission"` |
| `props.*` | Template (`${}`) | Preserves original type | Evaluated, then spread as **React props** — a `ui:*` / `page:*` renderer reads `schema.*` and never sees the result. Consumed only by `element:*` components. |

**Precedence rule:** `visible` takes priority over `hidden`.

### Fields That are NOT Evaluated

These top-level schema fields are passed as raw strings:

- `value`, `label`, `description`, `title` — read by the renderers, but never
  template-evaluated. **Do not "move them to `props`"** to make an expression
  work: under `props` they are evaluated and then discarded, so the component
  paints an empty frame instead. Resolve the value in the host before handing
  the schema to `SchemaRenderer`, or carry it on a `text` node's `content`,
  which is the one text key that is both evaluated and read.
- `className` — always a static Tailwind class string
- `id` — always a static string
- `type` — component type identifier
- `bind` — data scope path (resolved by `useDataScope`, not by expressions)

## Rule: Component Schema Structure

Every UI component node MUST follow this shape:

```typescript
interface UIComponent {
  type: string;              // Required: component type identifier
  id?: string;               // Optional: unique identifier
  props?: Record<string, any>; // Optional: component properties
  bind?: string;             // Optional: data binding path
  className?: string;        // Optional: Tailwind CSS classes
  hidden?: string;           // Optional: visibility expression
  disabled?: string;         // Optional: disabled expression
  events?: Record<string, ActionDef[]>; // Optional: event handlers
  children?: UIComponent[];  // Optional: nested components
}
```

## Rule: Keys Live on the Node, Not in a `props` Envelope

Every `ui:*` / `page:*` renderer reads its configuration off the node —
`schema.title`, `schema.content`, `schema.value`, `schema.columns`.
`SchemaRenderer` does **not** merge `schema.props` into the node; it spreads it
as React props (`packages/react/src/SchemaRenderer.tsx`), which those renderers
ignore. A key parked under `props` is therefore silently dropped: the component
renders an empty frame, and the envelope itself lands in the DOM as the invalid
attribute `props="[object Object]"`.

**❌ WRONG — renders an empty card:**
```json
{
  "type": "card",
  "props": { "title": "Customer Summary" }
}
```

**✅ CORRECT:**
```json
{
  "type": "card",
  "title": "Customer Summary"
}
```

**The one exception is the `element:*` namespace.** Those components read their
config out of `properties` / `props` by design (`readProps` in
`packages/components/src/renderers/basic/elements.tsx`), so
`{ "type": "element:text", "properties": { "content": "Hi" } }` is correct and
the same keys on the node would be ignored. Match the envelope to the
namespace; do not apply either shape everywhere.

## Rule: No Schema Property Invention

**❌ FORBIDDEN:** Adding custom properties not defined in `@objectstack/spec`.

**Example violation:**
```json
{
  "type": "data-table",
  "fields": [...],  // ❌ spec uses "columns"
  "customProp": "value"  // ❌ not in spec
}
```

**✅ CORRECT:**
```json
{
  "type": "data-table",
  "columns": [...]  // ✅ declared by DataTableSchema, read off the node
}
```

## Rule: Type Preservation in Expressions

When the entire string is a single `${expression}`, the result preserves its type:

```json
"${data.count}"        // → returns number 42, not string "42"
"${data.isActive}"     // → returns boolean true, not string "true"
"Count: ${data.count}" // → returns string "Count: 42" (mixed template)
```

## Rule: Data Binding Path Resolution

The `bind` field is NOT expression-evaluated. It's a path string resolved by `useDataScope()`:

```json
{
  "type": "data-table",
  "bind": "customers",  // Resolved as dataSource.customers
  "columns": [...]
}
```

**Nested paths work:** `"bind": "app.settings.users"` resolves `dataSource.app.settings.users`.

## Rule: Action Event Structure

Events must be defined as arrays of action definitions:

```json
{
  "events": {
    "onClick": [
      { "action": "validate", "target": "form_1" },
      { "action": "submit", "target": "form_1" },
      { "action": "navigate", "params": { "url": "/success" } }
    ]
  }
}
```

**❌ DO NOT** use function references or inline callbacks in JSON schemas.

## Rule: Action Params Use Field Types (Shared Widget Renderer)

An action that needs user input declares `params` (spec `ActionParamSchema`).
Each param's `type` is a spec `FieldType`, and the param dialog renders it
through the **same field-widget renderer the object form uses** — so any
form-supported type (`select`, `lookup`, `date`, `file`, `image`, `richtext`,
`color`, …) gets its real widget, never a text-box fallback (ADR-0059):

```json
{
  "name": "approve",
  "params": [
    { "name": "comment", "type": "textarea", "required": true },
    { "name": "attachments", "type": "file", "multiple": true, "accept": ["application/pdf"] },
    { "name": "assignee", "field": "owner_id" }
  ]
}
```

- Inline params: `name` + `type` + widget config (`options`, `multiple`,
  `accept`, `maxSize`, `defaultValue`, `placeholder`, `helpText`).
- Field-backed params: `field` (+ `objectOverride`) inherits label, type,
  options, lookup config, `multiple`/`accept`/`maxSize` from the object field;
  inline properties override.
- `required` blocks submit; `visible` is a CEL predicate
  (`features` / `current_user` / `app` / `data`) that hides the param.

**❌ DO NOT** invent param-only type spellings — use spec `FieldType` values.
**❌ DO NOT** add bespoke per-type render branches to `ActionParamDialog`;
extend `fieldWidgetMap` in `@object-ui/fields` instead (the drift test pins
param support ⊇ form support).

## Rule: Layout Responsiveness

`grid` declares its column count as `columns` — either a number, or a
breakpoint object keyed `xs` / `sm` / `md` / `lg` / `xl` (`GridSchema` in
`packages/types/src/layout.ts`):

```json
{
  "type": "grid",
  "columns": { "xs": 1, "md": 2, "lg": 4 },
  "gap": 4
}
```

`xs` is the base breakpoint; omit it and the base falls back to one column.
A bare `"columns": 4` already gets a mobile-first ramp (1 column, 2 at `sm`,
4 at `md`), so reach for the object form only when you need the breakpoints
spelled out.

**❌ DO NOT** spell it `cols` — no schema, renderer or registry declares that
key, so the value is dropped on the floor and the grid renders a flat two
columns at *every* breakpoint (objectui#4001).
**❌ DO NOT** wrap layout keys in a `props` envelope. `columns` / `gap` /
`className` are read off the node itself; under `props` they are never read
and the same silent two-column fallback appears.

## Rule: Expression Security

The expression parser blocks dangerous patterns:

**❌ BLOCKED:**
- `eval()`
- `Function()`
- `setTimeout()`, `setInterval()`
- `import()`, `require()`
- `process.*`, `global.*`
- `window.*`, `document.*`
- `__proto__`, `constructor`, `prototype`

**✅ SAFE GLOBALS:**
- `Math` — `${Math.round(price)}`
- `JSON` — `${JSON.stringify(obj)}`
- `parseInt`, `parseFloat`, `isNaN`, `isFinite`
