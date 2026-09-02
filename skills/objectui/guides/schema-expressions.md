# ObjectUI Schema Expressions

Writing and debugging dynamic expressions in ObjectUI schemas. The expression system is the core of ObjectUI's dynamic behavior — it controls visibility, disabled states, computed content, and data-driven props.

## Architecture overview

ObjectUI uses a two-tier expression evaluator:

1. **Template expressions** — strings containing `${...}` placeholders: `"Hello ${user.name}"`
2. **Condition expressions** — raw boolean expressions without wrappers: `data.role === 'admin'`

Both are parsed by a **recursive-descent parser** (no `eval()`, no `new Function()`). This means expressions are CSP-safe and work under strict Content Security Policy headers.

Key files (for reference, not for editing):
- `packages/core/src/evaluator/ExpressionEvaluator.ts` — main entry point
- `packages/core/src/evaluator/SafeExpressionParser.ts` — recursive-descent parser
- `packages/core/src/evaluator/ExpressionContext.ts` — scope stacking
- `packages/core/src/evaluator/FormulaFunctions.ts` — built-in functions
- `packages/core/src/evaluator/ExpressionCache.ts` — LFU caching
- `packages/react/src/SchemaRenderer.tsx` — integration layer (the
  `evaluatedSchema` memo; grep that name rather than a line number)

## What gets expression-evaluated

Evaluation and *readback* are two separate gates: a value is visible only if
`SchemaRenderer` evaluates it **and** the renderer reads the key it sits on. The
full boundary tables -- the evaluated fields, the raw ones, `visible` over
`hidden` precedence, and what `props` versus `properties` each do with a value
-- are in [`rules/protocol.md`](../rules/protocol.md), which is the anchor for
this rule. The four cases that decide most schemas:

```json
// Evaluated, then dropped -- renders an empty card
{ "type": "card", "props": { "title": "${data.customer.name}" } }

// `card` declares `title`, so on the node it is evaluated AND read
{ "type": "card", "title": "${data.customer.name}" }

// `text` does not declare `value` -- renders the literal "${data.customer.name}"
{ "type": "text", "value": "${data.customer.name}" }

// `content` is evaluated on every component type
{ "type": "text", "content": "${data.customer.name}" }
```

`title` / `label` / `value` / `description` are template-evaluated on the types
that declare them -- `statistic` (`label` / `value` / `description`), `card`
(`title` / `description`), `button` (`label`) -- and read raw everywhere else.
The set is closed and declared in `@objectstack/spec` (objectui#4795).

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
- Unary: `!`, unary `-` / `+`, `typeof`
- Method calls: `.toUpperCase()`, `.includes()`, `.filter()`, `.map()`, `.length`
- Primaries: literals, identifiers, `( … )`, array literals `[1, 2]`, and a
  single-param arrow (`items.filter(i => i.active)`)

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
${MEDIAN(values)}  ${PERCENTILE(90, values)}  ${STDEV(values)}  ${VARIANCE(values)}
```

### Logic
```
${IF(score > 90, "A", IF(score > 80, "B", "C"))}
${SWITCH(tier, 1, "gold", 2, "silver", "other")}
${AND(isActive, hasPermission)}
${OR(isAdmin, isOwner)}
${NOT(isLocked)}
```

### String
```
${UPPER(name)}                  → "ALICE"
${LOWER(email)}                 → "alice@example.com"
${CONCAT(firstName, " ", lastName)}  → "Alice Smith"
${TRIM(s)}  ${LEN(s)}  ${LEFT(s, 3)}  ${RIGHT(s, 3)}  ${SUBSTRING(s, 0, 3)}
${FIND("@", s)}  ${REPLACE(s, "a", "b")}  ${REGEX(s, "^[0-9]+$")}
```

`PERCENTILE` takes 0–100, not 0–1; `FIND(search, text)` puts the needle first
and returns a **0-based** index (`-1` when absent).

### Date
```
${TODAY()}                      → current date
${NOW()}                        → current datetime
${DATEADD(startDate, 7, 'days')}
${DATEDIFF(startDate, endDate, 'days')}
${DATEFORMAT(createdAt, 'YYYY-MM-DD')}
```

That is the whole registry — **30 functions**, all of them registered by
`FormulaFunctions.registerDefaults()`. `register(name, fn)` upper-cases the
name, so calls are case-insensitive.

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

## Field-level conditional rules (`visibleWhen` / `readonlyWhen` / `requiredWhen`)

These live on the **object's field metadata**, are written in CEL, and are
evaluated by `@objectstack/formula` -- a different tier from the `${}` / `On`
conditions above, which are schema/widget-level and run on the recursive-descent
`SafeExpressionParser`. **How to author them is the `objectstack-data` skill's
job**, under "Conditional Field Rules": the predicate scope, the client-only vs
client-and-server enforcement split, the invariant-vs-transition-gate choice,
and the protocol-17 removal of the `conditionalRequired` alias are all there.
Author them in the canonical tagged-template form that skill teaches
(``requiredWhen: P`record.status == 'paid'` ``), not as a bare string.

Renderer-side, and only here: the form renderer **re-evaluates these reactively
as the user edits**, via `resolveFieldRuleState` in `@object-ui/core`. A static
`required: true` / `readonly: true` is a floor a FALSE predicate cannot weaken.
Evaluation is **fail-open** -- a broken predicate never hides content, never
blocks submit and never locks a field -- so `visibleWhen` is never a security
boundary on the client.

## CEL predicates over a row record

Conditional formatting on a list/grid/kanban, a row action's `visible` /
`disabled`, and `SelectOption.visibleWhen` are all **CEL over `record.*`**,
evaluated by `@objectstack/formula` -- not by the `${}` evaluator above.
**The predicate language, the surfaces that take one, and the authoring rules
are the `objectstack-formula` skill's job**, under "Surfaces that take an
Expression"; the cascading-select and options-vs-lookup decision is
`objectstack-data`'s.

Three renderer-side facts that live nowhere else:

- **Failure direction is not uniform.** A row action's `visible` **fails
  closed** (a broken predicate hides the action and warns), matching the
  record-header `ActionEngine`; `disabled` fails soft (not disabled, warns);
  a field-level `visibleWhen` fails open. Do not generalise from one to another.
- **Legacy shapes are translated, with a one-time warning.** The native
  `{ field, operator, value }` form (`operator` in `equals` / `not_equals` /
  `greater_than` / `less_than` / `contains` / `in`) and the
  `{ expression: "${…}" }` template form still work and are rewritten to CEL
  transparently. A string carrying legacy-only syntax (`${…}`, `===`, `?.`,
  `.includes()`) is routed to the old engine with a **one-time deprecation
  warning** -- rewrite it as CEL (`==`, `record.x`, `.contains()`).
- **`data.*` is the trap in a row predicate.** The row binds three ways --
  `record.status` (canonical), bare `status` and `data.status`, the last two
  deprecated and warned once in dev
  (`packages/core/src/evaluator/rowPredicateCanon.ts`). The authoring oracle
  accepts `data.*` silently and then binds nothing at runtime: a constant
  `false`, not an error.
- **`field.dependsOn` gates the control, not just the list.** While any declared
  parent is empty the select is gated ("Select country first"); a parent change
  re-evaluates the option list and **auto-clears** a value that is no longer
  valid.

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
    { "header": "Name", "accessorKey": "name" },
    { "header": "Email", "accessorKey": "email" }
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

That list is `isDangerous`'s regex table, matched against the expression source
before compilation. Property access has a second gate the list omits: the
parser's `BLOCKED_PROPS` also rejects `__defineGetter__`, `__defineSetter__`,
`__lookupGetter__` and `__lookupSetter__`.

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

### `new X()` — only `Date` and `RegExp`

`parseNewExpression` permits exactly two constructors and throws
`new X() is not supported in expressions` for every other name. `new Date(…)`
is **not** blocked — measured through the schema path, it returns a real
`Date`. Prefer a formula function anyway: a `Date` object stringifies into
the DOM as a locale-dependent blob.

```json
// ✅ Works, but renders "Thu Jan 01 1970 …"
{ "type": "text", "content": "${new Date(data.timestamp)}" }

// ✅ Preferred — formatted, and stable across locales
{ "type": "text", "content": "${DATEFORMAT(data.timestamp, 'YYYY-MM-DD')}" }

// ❌ Rejected — any constructor other than Date / RegExp
{ "type": "text", "content": "${new Function('return 1')()}" }
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

1. **Which key is it on, and does that type declare the key?** `content` and the predicate keys are evaluated and read on every type. `title` / `label` / `value` / `description` are evaluated **only on the types that declare them** — `statistic` (`label` / `value` / `description`), `card` (`title` / `description`), `button` (`label`) — and read raw everywhere else, including on a namespaced spelling such as `ui:statistic`. A `${...}` inside a `props` envelope is evaluated and then discarded. (A `properties` envelope is the one that is evaluated *and* hoisted onto the node — see [`rules/protocol.md`](../rules/protocol.md) for why that is recorded, not recommended.)
2. Is the `${}` syntax correct? Check for unmatched braces.
3. Is the data actually available in scope? Check `SchemaRendererProvider dataSource`.
4. For conditions: are you using `On` suffix correctly? (`hiddenOn` takes raw expression, `hidden` needs `${}` if it's a string).
5. Does the expression use a blocked pattern? Check for constructors, `eval`, `window`, etc.
6. Is type coercion causing issues? `${0 && "yes"}` returns `0`, not `false`.
