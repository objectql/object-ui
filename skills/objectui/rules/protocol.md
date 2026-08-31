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
| `title` / `label` / `value` / `description` | Template (`${}`) | Preserves original type | **Only on the component types the spec declares** — see "Rule: Bindable Text Keys" below. `"value": "${data.total}"` on a `statistic` renders the number. |
| `properties.*` | Template (`${}`) | Preserves original type | Evaluated, then **hoisted onto the node** (`type` / `id` excepted), so the result lands where every renderer reads. See "Rule: Keys Live on the Node" below. |
| `props.*` | Template (`${}`) | Preserves original type | Evaluated, then spread as **React props** — a `ui:*` / `page:*` renderer reads `schema.*` and never sees the result. Consumed only by `element:*` components. |

**Precedence rule:** `visible` takes priority over `hidden`.

### Fields That are NOT Evaluated

These top-level schema fields are passed as raw strings:

- `value`, `label`, `description`, `title` — evaluated **only on the component
  types that declare them** (see "Rule: Bindable Text Keys"); read raw
  everywhere else. **Do not "move them to `props`"** to make an expression work
  on a type that does not declare them: under `props` they are evaluated and
  then discarded, so the component paints an empty frame instead. On an
  undeclared type, resolve the value in the host before handing the schema to
  `SchemaRenderer`, or carry it on a `text` node's `content`.
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
  properties?: Record<string, any>; // Optional: spec config bag, hoisted onto
                                    // the node. See "Rule: Keys Live on the Node".
  props?: Record<string, any>; // Optional: element:* config envelope — NOT a
                               // general bag. See "Rule: Keys Live on the Node".
  bind?: string;             // Optional: data binding path
  className?: string;        // Optional: Tailwind CSS classes
  hidden?: string;           // Optional: visibility expression
  disabled?: string;         // Optional: disabled expression
  events?: Record<string, ActionDef[]>; // Optional: event handlers
  children?: UIComponent[];  // Optional: nested components
}
```

## Rule: Bindable Text Keys

Four text keys can carry a `${}` expression **on the node itself** — `title`,
`label`, `value`, `description` — but only on the component types that declare
them. The list is closed and lives in `@objectstack/spec`
(`EXPRESSION_BINDABLE_TEXT_KEYS_BY_COMPONENT`); the renderer reads that
declaration rather than keeping its own copy.

| Component | Bindable node keys |
|---|---|
| `statistic` | `label`, `value`, `description` |
| `card` | `title`, `description` |
| `button` | `label` |

**✅ CORRECT — a dashboard number that moves with the data:**
```json
{
  "type": "statistic",
  "label": "Active users",
  "value": "${data.metrics.activeUsers}"
}
```

On any other component type these four keys are read **raw**: the expression
reaches the screen as literal text. There is no way to opt a type in from
metadata — a new type/key pair is a change to the spec's declaration, not
something the renderer infers. Until then, resolve the value in the host, or
use a `text` node's `content`, which every type evaluates.

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

**`props` and `properties` are two different envelopes, and only one of them is
dropped.** The rule above is about `props`. `properties` is the spec spelling of
the same bag, and `SchemaRenderer` evaluates it and then **hoists every key onto
the node** (`type` / `id` excepted) before the renderer runs — so it is read by
every namespace, not just `element:*`. Measured on `origin/main` `f1c27f037`
with `dataSource = { label: "Evaluated Title" }`:

| node | rendered card header |
|---|---|
| `{ "type": "card", "title": "Customer Summary" }` | `Customer Summary` |
| `{ "type": "card", "props": { "title": "Customer Summary" } }` | *no header element at all* |
| `{ "type": "card", "properties": { "title": "Customer Summary" } }` | `Customer Summary` |
| `{ "type": "card", "title": "${data.label}" }` | `${data.label}` — read, never evaluated |
| `{ "type": "card", "properties": { "title": "${data.label}" } }` | `Evaluated Title` |

The `element:*` namespace is where `props` is *also* read: those components take
their config from `properties` / `props` by design (`readProps` in
`packages/components/src/renderers/basic/elements.tsx`), so
`{ "type": "element:text", "properties": { "content": "Hi" } }` is correct there.

**What to write.** Keep keys on the node and let the host resolve values before
it hands the schema to `SchemaRenderer` — that is the supported route and the
one this skill teaches. The last row above is real and is the only spelling that
carries an expression into a key a `ui:*` / `page:*` renderer reads, but whether
`properties` is an official authoring channel for those namespaces is an open
contract question (objectui#4795), so it is recorded here rather than
recommended. What is *not* open: a `${...}` on the node is never evaluated, and a
key under `props` never reaches a `ui:*` / `page:*` renderer at all.

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

The `bind` field is NOT expression-evaluated. It's a path string resolved by `useDataScope()`, and only a component that calls that hook reads it:

```json
{
  "type": "list",
  "bind": "customerNames"  // Resolved as dataSource.customerNames
}
```

**Nested paths work:** `"bind": "app.settings.users"` resolves `dataSource.app.settings.users`.

**Readers only.** `list` and `tree-view` (`@object-ui/components`) and the `object-*` plugin widgets call `useDataScope`. `data-table` does NOT: it reads its rows from an inline `data` array on the node, so a `bind` on it is ignored and the table renders its header over an empty body — no error, no warning.

**Provider rows into a `data-table`.** Measured on `origin/main` `f1c27f037`,
real `SchemaRenderer` inside a `SchemaRendererProvider` holding
`{ customers: [ 2 records ] }`, identical `columns` in every leg, reading
`tbody td`:

| node | rendered body cells |
|---|---|
| `{ "type": "data-table", "data": "${data.customers}", "columns": [...] }` | `No results found` |
| `{ "type": "data-table", "props": { "data": "${data.customers}" }, ... }` | `No results found` |
| `{ "type": "data-table", "properties": { "data": "${data.customers}" }, ... }` | the two rows |
| `{ "type": "data-table", "data": [ 2 literal records ], ... }` | the two rows |

Both failing legs fail the same way this file keeps warning about: a correct
header over the empty state, nothing thrown, nothing logged. **Do not read that
empty table as "the provider has no data."** The route this skill teaches is the
last row — the host resolves the array and puts it on the node — for the reason
given under "Rule: Keys Live on the Node": the third row works today, but its
channel is objectui#4795's open question, not a taught surface.

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

**`2xl` is accepted and then dropped.** The spec's `BreakpointColumnMapSchema`
declares six keys — `xs` … `xl` **plus `2xl`** — but the `grid` renderer reads
only the first five, so `{ "xs": 1, "2xl": 6 }` validates, emits no `2xl:`
class, and renders at the `xs` count forever. Measured: `{xs:1, xl:5}` →
`grid grid-cols-1 xl:grid-cols-5 gap-4`; `{xs:1, "2xl":6}` →
`grid grid-cols-1 gap-4`. Stop at `xl`, or carry the widest step in
`className`.

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
