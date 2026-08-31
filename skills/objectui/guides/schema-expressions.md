---
name: objectui-schema-expressions
description: Write, debug, and optimize expression bindings in Object UI schemas. Use this skill when the user works with dynamic expressions in JSON schemas — conditional visibility (hidden/visible), disabled states, template strings with ${} syntax, data binding, formula functions (SUM, IF, CONCAT), or when expressions aren't evaluating as expected. Also use it when the user mentions computed values, dynamic props, expression errors, or schema conditions that aren't working. Even if the user just says something like "my value shows ${data.x} literally" or "hidden isn't working", this skill applies.
---

# ObjectUI Schema Expressions

Use this skill to write correct dynamic expressions in Object UI schemas and to debug expression-related issues. The expression system is the core of Object UI's dynamic behavior — it controls visibility, disabled states, computed content, and data-driven props.

## Architecture overview

Object UI uses a two-tier expression evaluator:

1. **Template expressions** — strings containing `${...}` placeholders: `"Hello ${user.name}"`
2. **Condition expressions** — raw boolean expressions without wrappers: `data.role === 'admin'`

Both are parsed by a **recursive-descent parser** (no `eval()`, no `new Function()`). This means expressions are CSP-safe and work under strict Content Security Policy headers.

Key files (for reference, not for editing):
- `packages/core/src/evaluator/ExpressionEvaluator.ts` — main entry point
- `packages/core/src/evaluator/SafeExpressionParser.ts` — recursive-descent parser
- `packages/core/src/evaluator/ExpressionContext.ts` — scope stacking
- `packages/core/src/evaluator/FormulaFunctions.ts` — built-in functions
- `packages/core/src/evaluator/ExpressionCache.ts` — LFU caching
- `packages/react/src/SchemaRenderer.tsx` — integration layer (lines 117-175)

## What gets expression-evaluated

SchemaRenderer evaluates these fields before passing props to the resolved component:

### Automatically evaluated fields

Evaluation and *readback* are two different gates. A value is only visible if
`SchemaRenderer` evaluates it **and** the renderer reads the key it sits on —
see "The `props` envelope is evaluated but not read" below.

| Schema field | Evaluation type | Return type | Example |
|---|---|---|---|
| `content` | Template (`${}`) | string | `"content": "Total: ${data.total}"` |
| `hidden` | Condition | boolean | `"hidden": "${data.role !== 'admin'}"` |
| `hiddenOn` | Condition | boolean | `"hiddenOn": "data.status === 'draft'"` |
| `visible` | Condition | boolean | `"visible": "${data.isActive}"` |
| `visibleOn` | Condition | boolean | `"visibleOn": "data.permissions.canView"` |
| `disabled` | Condition | boolean | `"disabled": "${form.isSubmitting}"` |
| `disabledOn` | Condition | boolean | `"disabledOn": "!data.hasPermission"` |
| `title` / `label` / `value` / `description` | Template (`${}`) | Preserves original type | **Declared types only** — `statistic` (`label`/`value`/`description`), `card` (`title`/`description`), `button` (`label`). Closed set, declared in `@objectstack/spec` (objectui#4795). |

**Precedence rule:** `visible` takes priority over `hidden`. If both are present, `visible` wins.

### NOT evaluated (passed as raw strings)

These top-level schema fields are **not** processed by ExpressionEvaluator:

- `value`, `label`, `description`, `title` **on a type that does not declare
  them** (see the row above) — read by the renderers, but not template-evaluated
  there. Resolve them in the host before rendering, or carry the bound text on a
  `text` node's `content`.
- `className` — always a static Tailwind class string
- `id` — always a static string
- `type` — component type identifier
- `bind` — data scope path (resolved by `useDataScope`, not by expressions)

### The `props` envelope is evaluated but not read

`SchemaRenderer` **does** run every value inside `props` through the evaluator —
and then spreads the object as React props rather than merging it into the node.
Every `ui:*` / `page:*` renderer reads `schema.title` / `schema.content` /
`schema.columns` off the node itself, so the evaluated value is discarded: the
component paints an empty frame and the envelope lands in the DOM as the invalid
attribute `props="[object Object]"`.

So `props` is not an escape hatch for the unevaluated keys above — it trades a
literal `${...}` on screen for nothing on screen. Put keys on the node.

```json
// ❌ Evaluated, then dropped — renders an empty card
{ "type": "card", "props": { "title": "${data.customer.name}" } }

// ✅ `card` declares `title`, so on the node it is evaluated AND read
{ "type": "card", "title": "${data.customer.name}" }

// ❌ `text` does not declare `value` — renders the literal "${data.customer.name}"
{ "type": "text", "value": "${data.customer.name}" }

// ✅ `content` is evaluated on every component type
{ "type": "text", "content": "${data.customer.name}" }
```

The `element:*` namespace is where `props` is read: those components take their
config out of `properties` / `props`, so the envelope is required there.

`properties` is not the same envelope as `props`. `SchemaRenderer` evaluates it
and then **hoists its keys onto the node**, so it is read by every namespace —
measured, `{ "type": "card", "properties": { "title": "${data.customer.name}" } }`
does render the evaluated name. Whether that is an authoring channel for
`ui:*` / `page:*` is an open contract question (objectui#4795); the measurement
and the failing legs beside it are in
[`rules/protocol.md`](../rules/protocol.md). Until it is ruled, the route this
guide teaches is unchanged: `content`, or resolve the value in the host.

## Template expression syntax (`${}`)

### Basic property access
```
${user.name}                    → "Alice"
${user.address.city}            → "San Francisco"
${items[0].name}                → "Widget A"
```

### Operators
```
${price * quantity}             → 150
${total > 1000 ? "High" : "Low"}  → "High"
${name || "Anonymous"}          → fallback value
${data.value ?? "default"}      → nullish coalescing
${!isLocked}                    → boolean negation
```

### Supported operators (full list)
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==`
- Logical: `&&`, `||`, `!`
- Ternary: `condition ? trueVal : falseVal`
- Nullish coalescing: `??`
- Optional chaining: `?.`
- Method calls: `.toUpperCase()`, `.includes()`, `.filter()`, `.map()`, `.length`

### Type preservation

When the entire string is a single `${expression}`, the result preserves its type:
```
"${data.count}"        → returns number 42, not string "42"
"${data.isActive}"     → returns boolean true, not string "true"
"Count: ${data.count}" → returns string "Count: 42" (mixed template)
```

### Multiple interpolations
```
"${user.firstName} ${user.lastName} (${user.role})"
→ "Alice Smith (admin)"
```

## Available scope variables

When expressions are evaluated, these variables are in scope:

| Variable | Source | Example |
|----------|--------|---------|
| Top-level data fields | `SchemaRendererProvider dataSource` | `${users}`, `${metrics.total}` |
| `data` | Alias for dataSource root | `${data.fieldName}` |
| `current_user` / `user` | Host predicate scope | `${current_user.email}` |
| `page` | Page-local state (`PageSchema.variables`) | `${page.selectedId}` |

That is the whole scope. There is **no `item` and no `index`** — the evaluator
context is built once per node, not once per array element. See "No per-item
template iteration" below.

### Safe globals (always available)
- `Math` — `${Math.round(price)}`, `${Math.max(a, b)}`
- `JSON` — `${JSON.stringify(obj)}`
- `parseInt`, `parseFloat`, `isNaN`, `isFinite`

## Formula functions

Built-in functions available in expressions (via `FormulaFunctions.ts`):

### Aggregation
```
${SUM(items, 'price')}          → sum of price field
${AVG(scores)}                  → average
${COUNT(users)}                 → count
${MIN(values)}                  → minimum
${MAX(values)}                  → maximum
```

### Logic
```
${IF(score > 90, "A", IF(score > 80, "B", "C"))}
${AND(isActive, hasPermission)}
${OR(isAdmin, isOwner)}
${NOT(isLocked)}
```

### String
```
${UPPER(name)}                  → "ALICE"
${LOWER(email)}                 → "alice@example.com"
${CONCAT(firstName, " ", lastName)}  → "Alice Smith"
```

### Date
```
${TODAY()}                      → current date
${NOW()}                        → current datetime
${DATEADD(startDate, 7, 'days')}
${DATEFORMAT(createdAt, 'YYYY-MM-DD')}
```

## Condition fields (visibility and disabled)

### Syntax options

Each condition field has two forms — a shorthand and an `On` suffix:

```json
{ "hidden": true }                              // static boolean
{ "hidden": "${data.role !== 'admin'}" }        // template expression
{ "hiddenOn": "data.role !== 'admin'" }         // raw expression (no ${} needed)
```

The `On` variants accept raw expressions without `${}` wrapping — the entire string is the expression.

### Visibility patterns

**Role-based:**
```json
{ "hidden": "${data.userRole !== 'admin'}" }
```

**Status-based:**
```json
{ "visible": "${data.record.status === 'active'}" }
```

**Data-dependent:**
```json
{ "hidden": "${!data.items || data.items.length === 0}" }
```

**Combined conditions:**
```json
{ "visibleOn": "data.isAuthenticated && data.permissions.canEdit" }
```

### Disabled patterns

```json
{ "disabled": "${form.isSubmitting}" }
{ "disabledOn": "!data.canPerformAction || data.isLocked" }
```

## Field-level conditional rules (CEL — `visibleWhen` / `readonlyWhen` / `requiredWhen`)

> **Different engine, different layer.** The `${}` / `On` conditions above are
> the *schema/widget* tier and run on the recursive-descent
> `SafeExpressionParser`. The three rules below are the **data-model tier**:
> they live on the **object's field metadata**, are written in **CEL**, and are
> evaluated by the canonical `@objectstack/formula` engine — the *same* engine
> the server uses. Use these when the rule belongs to the field itself and must
> hold everywhere the object is edited (and, for `readonlyWhen`/`requiredWhen`,
> be enforced server-side too). See ADR-0036.

```ts
// On the object's Field definition (server-side metadata):
issued_on: Field.date({ requiredWhen: "record.status in ['sent', 'paid']" }),
tax_rate:  Field.number({ readonlyWhen: "record.status == 'paid'" }),
paid_on:   Field.date({
  visibleWhen:  "record.status == 'paid'",   // UX-only — hide until paid
  requiredWhen: "record.status == 'paid'",   // enforced client AND server
}),
```

| Rule           | Predicate TRUE ⇒          | Where it's enforced     |
| -------------- | ------------------------- | ----------------------- |
| `visibleWhen`  | field shown (else hidden) | client only (UX)        |
| `readonlyWhen` | field read-only           | **client + server**     |
| `requiredWhen` | field required            | **client + server**     |

- Predicate scope is `record` (the live/merged record) and `previous` (the
  prior persisted record, for transition rules like
  `"record.status == 'paid' && previous.status != 'paid'"`).
- A predicate is `string` (treated as CEL) or `{ dialect: 'cel', source }`.
- `requiredWhen` is the **only** required-predicate slot. The old
  `conditionalRequired` alias was **removed** in `@objectstack/spec` 17
  (#3855): authoring it is a `tsc` error and a parse rejection, and nothing in
  ObjectUI reads it. Rename the key (the CEL value is unchanged), or run
  `os migrate meta --from 16` to rewrite it automatically.
- The form renderer re-evaluates these **reactively** as the user edits, via
  `resolveFieldRuleState` (`@object-ui/core`). Static `required: true` /
  `readonly: true` is a floor a FALSE predicate can't weaken.
- **Gotchas:** CEL throws on a *missing* map key but compares cleanly against
  `null` — author predicates against fields that exist (the renderer seeds
  declared fields to `null` so unregistered fields don't fault). Evaluation is
  **fail-open**: a broken predicate never hides content, never blocks submit,
  never locks a field. `visibleWhen` is client-only — never rely on it for
  security; use `readonlyWhen`/`requiredWhen` (or a validation rule) for guarantees.

## List-view conditional tier (CEL — conditional formatting + row-action visibility)

> **Same engine as the data-model tier.** Conditional formatting on a
> list/grid/kanban, and a row action's `visible` / `disabled`, are **CEL
> predicates over the row record**, evaluated by the canonical
> `@objectstack/formula` engine — *not* the `${}` schema/widget evaluator
> (issue #1584, framework ADR-0058). Per `@objectstack/spec` these were always
> typed as CEL (`ListViewSchema.conditionalFormatting[].condition` and
> `ActionSchema.visible` are `ExpressionInputSchema`); ObjectUI now honors that
> at runtime. Authors reuse the same `record.*` predicates everywhere.

**Conditional formatting** — first matching rule wins; author it the spec way:

```jsonc
{ "type": "list-view", "objectName": "invoice",
  "conditionalFormatting": [
    { "condition": "record.status == 'overdue'", "style": { "backgroundColor": "#fee2e2", "color": "#991b1b" } },
    { "condition": "record.amount > 10000",       "style": { "backgroundColor": "#fef9c3" } }
  ]
}
```

The predicate binds the row three ways — `record.status` (**canon**), bare
`status` and `data.status` (both **deprecated** here: still bound, warned
once in dev, retiring after a stored-metadata survey — see
`packages/core/src/evaluator/rowPredicateCanon.ts`) — plus the host
predicate scope (`features.*`, `user.*`). `data.*` is the trap: the server's
authoring oracle accepts it silently, then binds nothing at runtime — a
constant `false`, not an error. The legacy ObjectUI shapes still work and are
translated to CEL transparently: the native `{ field, operator, value }` form
(`operator` ∈ `equals` / `not_equals` / `greater_than` / `less_than` /
`contains` / `in`) and the `{ expression: "${…}" }` template form. A string
carrying legacy-only syntax (`${…}`, `===`, `?.`, `.includes()`) is routed to
the old engine **with a one-time deprecation warning** — rewrite it in CEL.

**Row-action visibility** — a row/list_item action's `visible` (and `disabled`)
is CEL over the row:

```jsonc
{ "name": "resume", "label": "Resume",
  "visible": "record.status in ['paused', 'stopped']" }   // `in` needs the CEL engine
```

- `visible` **fails closed** (broken predicate → action hidden + warn), matching
  the record-header `ActionEngine`; `disabled` fails soft (not disabled + warn).
- The CEL `in` operator, list membership, and `has()` — none of which the legacy
  JS evaluator parsed — now work; `===` / `?.` / `.includes()` do **not** (use
  `==` / `record.x` / `.contains()`).

**Legacy form-field `condition`.** `FormField.condition: { field, equals/notEquals/in }`
is retired in favor of `visibleWhen` (it is now translated to CEL internally, so
existing metadata keeps working). Prefer authoring `visibleWhen: "record.type == 'lookup'"`.

## Cascading & role-gated select options (`option.visibleWhen` + `dependsOn`)

For dependent selects (country → province → city) and role-gated options, do
**not** invent a `validFor` / `controllingField` matrix. Reuse the two primitives
you already have — the mechanism is uniform with dependent lookups, so both
humans and AI author it correctly by pattern-matching:

- **`SelectOption.visibleWhen`** — a per-option CEL predicate; the option is
  offered only when TRUE. Evaluated against the live `record` **plus
  `current_user`** (same engine/env as a field-level `visibleWhen`).
- **`field.dependsOn`** — declares the sibling field(s) the option list reacts
  to. While any is empty the control is **gated** ("Select country first"); a
  parent change re-evaluates the list and **auto-clears** a now-invalid value.

```jsonc
{ "type": "form", "fields": [
  { "name": "country", "type": "select", "options": [
    { "label": "China", "value": "cn" }, { "label": "United States", "value": "us" }
  ]},
  { "name": "province", "type": "select", "dependsOn": "country", "options": [
    { "label": "Zhejiang",   "value": "zj", "visibleWhen": "record.country == 'cn'" },
    { "label": "California", "value": "ca", "visibleWhen": "record.country == 'us'" }
  ]},
  // role gating — same predicate, references current_user instead of a sibling:
  { "name": "tier", "type": "select", "options": [
    { "label": "Standard",   "value": "standard" },
    { "label": "Admin only", "value": "admin_only", "visibleWhen": "'admin' in current_user.positions" }
  ]}
]}
```

**Decision rule — options vs. lookup.** Use `option.visibleWhen` only for
**small, static dictionaries** (a handful of provinces, category → subcategory).
When the data is large, changes over time, or is shared across forms (real
country/province/city tables, org units, product catalogs) model each level as a
**`lookup`** with `depends_on` — the candidate query is filtered and paginated
server-side. Wrong tool = a 4000-row `<select>`.

**Security.** Option `visibleWhen` only hides the choice on the client; the value
is still submittable. When an option is gated for **authorization**, the server
must also reject writes of that value (the rule-validator evaluates the picked
value's `visibleWhen`). Use it freely for cascades/UX; pair it with server
enforcement for access control. Multi-field conditions (`record.country == 'cn'
&& current_user.department == 'sales'`) work — just list every referenced sibling
in `dependsOn`.

## Data binding with `bind`

The `bind` field is NOT expression-evaluated. It's a path string resolved by
`useDataScope()` — and **only a component that calls that hook reads it**.

```json
{
  "type": "list",
  "bind": "customerNames"
}
```

When `SchemaRendererProvider` receives
`dataSource = { customerNames: ["Ada Lovelace", "Grace Hopper"] }`, `list` calls
`useDataScope("customerNames")` and renders one entry per array element.

**Nested paths work:** `"bind": "app.settings.users"` resolves `dataSource.app.settings.users`.

### Which components read `bind`

`useDataScope` is called by `list` and `tree-view` in `@object-ui/components`,
and by the `object-*` widgets the plugin packages register (`object-grid`,
`object-kanban`, `object-chart`, `object-data-table`, `object-gallery`,
`object-timeline`, `object-pivot`). Every other component ignores `bind`
completely — no error, no warning, nothing in the console.

`data-table` is the one that catches authors out. It takes its rows from an
inline `data` array on the node and never calls `useDataScope`, so a `bind` on
it resolves nothing: the table renders its header over the "No results found"
empty state. Nothing is thrown and nothing is logged — a table that looks built
and is blank is the whole failure.

```json
{
  "type": "data-table",
  "data": [
    { "name": "Ada Lovelace", "email": "ada@example.com" },
    { "name": "Grace Hopper", "email": "grace@example.com" }
  ],
  "columns": [
    { "name": "name", "label": "Name" },
    { "name": "email", "label": "Email" }
  ]
}
```

To show *provider* data in a `data-table`, resolve the array in the host and put
it on the node — the same "expand in the host" route the next section describes
for per-record nodes.

## No per-item template iteration (`list` is data-as-nodes)

**There is no loop construct in ObjectUI, and no `item` / `index` scope.** No
component renders a per-item *template*: the evaluator context is built once per
node (`data`, `page`, the host predicate scope), and nothing ever pushes a
per-element frame onto it. A `${item.name}` resolves against nothing — an
unknown root identifier is left alone, so the literal text `${item.name}` is
what reaches the screen.

`list` is the component authors reach for first, and it is **data-as-nodes**:
the array it renders *is* the node list. It never reads `children`.

```json
// ❌ Renders two EMPTY <li>. `children` is not a template — `list` never reads it,
//    and `${item.name}` would render literally even if it did.
{
  "type": "list",
  "bind": "users",
  "children": [{ "type": "text", "content": "${item.name}" }]
}
```

### What `list` renders

Each entry of `items` (or of the array `bind` resolves to) is read as a node
descriptor:

| Entry shape | Rendered as |
|---|---|
| `"Ada"` (a plain string) | the string |
| `{ "content": … }` | `content` verbatim — **not** expression-evaluated |
| `{ "body": node }` or `{ "body": [node, …] }` | rendered through `SchemaRenderer` |
| `{ "className": … }` | class on the `<li>` |
| anything else — e.g. a record `{ "name": "Ada" }` | an **empty `<li>`** |

`content` wins over `body` when both are present. The last row is the trap this
section exists to close: binding `list` to ordinary records produces one empty
`<li>` per record — the right number of bullets, no text in any of them.

```json
// ✅ Authored items — `title` and `ordered` are read off the node
{
  "type": "list",
  "title": "Team",
  "ordered": true,
  "items": [{ "content": "Ada" }, { "content": "Linus" }]
}
```

```json
// ✅ Bound data, already node-shaped: dataSource = { rows: [{ "content": "Ada" }, { "content": "Linus" }] }
{ "type": "list", "bind": "rows" }
```

Only `body` entries go back through `SchemaRenderer`, so they are the one place
inside a list where expressions are evaluated at all — against the host scope,
never against a current element:

```json
// ✅ `${data.*}` works inside `body`; there is still no `${item.*}`
{
  "type": "list",
  "items": [{ "body": { "type": "text", "content": "Owner: ${data.team.owner}" } }]
}
```

### Grid and Table are not iterators either

- **`grid`** has no data binding at all — it is a CSS-grid wrapper that renders
  its `children` **once** and lays them out in columns. A `bind` on a `grid` is
  inert.
- **`table`** renders rows from an inline `data` array against `columns`
  accessors (`accessorKey`). Cell values are plain property lookups — never
  expressions — and `table` does not read `bind`.

```json
// ✅ `table`: inline rows + column accessors, no per-row scope
{
  "type": "table",
  "columns": [{ "header": "Name", "accessorKey": "name" }],
  "data": [{ "name": "Ada" }, { "name": "Linus" }]
}
```

### Rendering one node per record

Template-per-item rendering is not something any component does today. The two
working routes:

1. **Expand in the host.** Map your records to nodes *before* handing the schema
   to `SchemaRenderer` — the host has the full array and can build one node per
   record with real string interpolation.
2. **Feed data-as-nodes.** Shape the data as list entries (`content` / `body`)
   and let `items` or `bind` render it, per the table above.

### The per-row scope that does exist

Row-level **predicates** on list views — conditional formatting and row-action
`visible` / `disabled` — are CEL over `record.*`, evaluated by
`@objectstack/formula`; see "List-view conditional tier" above. That is a
different engine with a different scope: it decides *whether* and *how* a row is
styled, and it gives `${}` templates no `item`.

## Security model

The expression parser blocks dangerous patterns to prevent injection:

**Blocked:** `eval()`, `Function()`, `setTimeout()`, `setInterval()`, `import()`, `require()`, `process.*`, `global.*`, `window.*`, `document.*`, `__proto__`, `constructor`, `prototype`

If a blocked pattern is detected, the expression throws an error at compile time.

**Safe by design:** The recursive-descent parser never converts expression strings into executable JavaScript code. It tokenizes and evaluates each node directly.

## Performance

Expressions are compiled once per unique `(expression, variableNames)` pair and cached using LFU eviction (default 1000 entries). Repeated evaluation of the same expression across re-renders uses the cached compiled form.

**Avoid:**
- Heavy array operations (`filter`, `map`, `reduce`) on large datasets inside expressions — move to derived state or the data layer
- Deeply nested optional chaining in hot paths
- Multiple complex expressions on a single node in frequently re-rendered components

## Common mistakes and how to fix them

### Expression shows as literal text (`${data.x}` visible in UI)

**Cause:** The field isn't expression-evaluated. Use `content`.

```json
// ❌ Won't evaluate — `value` is read but never templated
{ "type": "text", "value": "${data.total}" }

// ❌ Worse — evaluated inside the envelope, then discarded: renders nothing
{ "type": "text", "props": { "value": "${data.total}" } }

// ✅ Evaluated and read
{ "type": "text", "content": "Total: ${data.total}" }
```

### `hidden` expression doesn't hide the component

**Cause 1:** `visible` is also set and takes priority.
**Cause 2:** Expression returns a non-boolean truthy value — use explicit comparison.

```json
// ❌ Truthy but not boolean
{ "hidden": "${data.count}" }

// ✅ Explicit boolean
{ "hidden": "${data.count > 0}" }
```

### Cannot use constructor or `new Date()`

**Cause:** Security restriction blocks constructors.

```json
// ❌ Blocked
{ "type": "text", "content": "${new Date(data.timestamp)}" }

// ✅ Use formula functions
{ "type": "text", "content": "${DATEFORMAT(data.timestamp, 'YYYY-MM-DD')}" }
```

### Object literal in expression

```json
// ❌ Object literals not supported
{ "type": "text", "style": "${{ color: 'red' }}" }

// ✅ Use className
{ "type": "text", "className": "text-red-500" }
```

### Missing variable returns undefined silently

Expressions don't throw on missing variables — they return `undefined`. Use fallback patterns:

```json
{ "type": "text", "content": "${data.user?.name || 'Unknown'}" }
```

## Debugging checklist

When an expression isn't working:

1. Is it `content` (or a predicate key)? Those are the fields that are both evaluated and read. A `${...}` on `title` / `label` / `value` / `description` is never evaluated, and one inside a `props` envelope is evaluated and then discarded. (A `properties` envelope is the one that is evaluated *and* hoisted onto the node — see [`rules/protocol.md`](../rules/protocol.md) for why that is recorded, not recommended.)
2. Is the `${}` syntax correct? Check for unmatched braces.
3. Is the data actually available in scope? Check `SchemaRendererProvider dataSource`.
4. For conditions: are you using `On` suffix correctly? (`hiddenOn` takes raw expression, `hidden` needs `${}` if it's a string).
5. Does the expression use a blocked pattern? Check for constructors, `eval`, `window`, etc.
6. Is type coercion causing issues? `${0 && "yes"}` returns `0`, not `false`.
