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

| Schema field | Evaluation type | Return type | Example |
|---|---|---|---|
| `props.*` | Template (`${}`) | Preserves original type | `"props": { "count": "${items.length}" }` → number |
| `content` | Template (`${}`) | string | `"content": "Total: ${data.total}"` |
| `hidden` | Condition | boolean | `"hidden": "${data.role !== 'admin'}"` |
| `hiddenOn` | Condition | boolean | `"hiddenOn": "data.status === 'draft'"` |
| `visible` | Condition | boolean | `"visible": "${data.isActive}"` |
| `visibleOn` | Condition | boolean | `"visibleOn": "data.permissions.canView"` |
| `disabled` | Condition | boolean | `"disabled": "${form.isSubmitting}"` |
| `disabledOn` | Condition | boolean | `"disabledOn": "!data.hasPermission"` |

**Precedence rule:** `visible` takes priority over `hidden`. If both are present, `visible` wins.

### NOT evaluated (passed as raw strings)

These top-level schema fields are **not** processed by ExpressionEvaluator:

- `value` — use `props.value` instead
- `label` — use `props.label` instead
- `description` — use `props.description` instead
- `title` — use `props.title` instead
- `className` — always a static Tailwind class string
- `id` — always a static string
- `type` — component type identifier
- `bind` — data scope path (resolved by `useDataScope`, not by expressions)

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
| `item` | Current array element (in loops) | `${item.name}` |
| `index` | Current array index (in loops) | `${index + 1}` |

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
- `conditionalRequired` is a **deprecated alias** of `requiredWhen`.
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

The predicate binds the row three ways — `record.status` (canonical), bare
`status`, and `data.status` (legacy) — plus the host predicate scope
(`features.*`, `user.*`). The legacy ObjectUI shapes still work and are
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

The `bind` field is NOT expression-evaluated. It's a path string resolved by `useDataScope()`:

```json
{
  "type": "data-table",
  "bind": "customers",
  "props": {
    "columns": [
      { "name": "name", "label": "Name" },
      { "name": "email", "label": "Email" }
    ]
  }
}
```

When `SchemaRendererProvider` receives `dataSource = { customers: [...] }`, the table component calls `useDataScope("customers")` and gets the array.

**Nested paths work:** `"bind": "app.settings.users"` resolves `dataSource.app.settings.users`.

## Iteration scopes (loops)

Components like Grid, List, and Table inject scoped variables for each item:

```json
{
  "type": "list",
  "bind": "users",
  "children": [
    {
      "type": "card",
      "props": {
        "title": "${item.name}",
        "subtitle": "#${index + 1}"
      }
    }
  ]
}
```

Inside the loop body, `item` refers to the current element and `index` to its 0-based position.

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
- Multiple complex expressions in a single `props` object in frequently re-rendered components

## Common mistakes and how to fix them

### Expression shows as literal text (`${data.x}` visible in UI)

**Cause:** The field isn't expression-evaluated. Move to `props`.

```json
// ❌ Won't evaluate
{ "type": "text", "value": "${data.total}" }

// ✅ Evaluated
{ "type": "text", "props": { "value": "${data.total}" } }
// or
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
{ "props": { "date": "${new Date(data.timestamp)}" } }

// ✅ Use formula functions
{ "props": { "date": "${DATEFORMAT(data.timestamp, 'YYYY-MM-DD')}" } }
```

### Object literal in expression

```json
// ❌ Object literals not supported
{ "props": { "style": "${{ color: 'red' }}" } }

// ✅ Use individual props or className
{ "className": "text-red-500" }
```

### Missing variable returns undefined silently

Expressions don't throw on missing variables — they return `undefined`. Use fallback patterns:

```json
{ "props": { "name": "${data.user?.name || 'Unknown'}" } }
```

## Debugging checklist

When an expression isn't working:

1. Is the field in `props.*` or `content`? If not, it won't be evaluated.
2. Is the `${}` syntax correct? Check for unmatched braces.
3. Is the data actually available in scope? Check `SchemaRendererProvider dataSource`.
4. For conditions: are you using `On` suffix correctly? (`hiddenOn` takes raw expression, `hidden` needs `${}` if it's a string).
5. Does the expression use a blocked pattern? Check for constructors, `eval`, `window`, etc.
6. Is type coercion causing issues? `${0 && "yes"}` returns `0`, not `false`.
