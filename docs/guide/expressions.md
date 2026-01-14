# Expression System

Object UI includes a powerful expression system that enables dynamic, data-driven UIs. Expressions allow you to reference data, compute values, and create conditional logic directly in your JSON schemas.

## Overview

Expressions are JavaScript-like code snippets embedded in schemas using the `${}` syntax:

```json
{
  "type": "text",
  "value": "Hello, ${user.name}!"
}
```

With data:
```tsx
const data = { user: { name: "Alice" } }
```

This renders: **"Hello, Alice!"**

## Basic Syntax

### Simple Property Access

Access data properties using dot notation:

```json
{
  "type": "text",
  "value": "${user.firstName}"
}
```

### Nested Properties

Access nested objects:

```json
{
  "type": "text",
  "value": "${user.address.city}"
}
```

### Array Access

Access array elements:

```json
{
  "type": "text",
  "value": "${users[0].name}"
}
```

### String Interpolation

Mix expressions with static text:

```json
{
  "type": "text",
  "value": "Welcome, ${user.firstName} ${user.lastName}!"
}
```

## Operators

### Arithmetic Operators

```json
{
  "type": "text",
  "value": "Total: ${price * quantity}"
}
```

Supported: `+`, `-`, `*`, `/`, `%`

### Comparison Operators

```json
{
  "type": "badge",
  "variant": "${score >= 90 ? 'success' : 'default'}"
}
```

Supported: `>`, `<`, `>=`, `<=`, `==`, `===`, `!=`, `!==`

### Logical Operators

```json
{
  "type": "button",
  "visibleOn": "${user.isAdmin && user.isActive}"
}
```

Supported: `&&`, `||`, `!`

### Ternary Operator

```json
{
  "type": "text",
  "value": "${count > 0 ? count + ' items' : 'No items'}"
}
```

## Conditional Properties

### visibleOn

Show component when expression is true:

```json
{
  "type": "button",
  "label": "Admin Panel",
  "visibleOn": "${user.role === 'admin'}"
}
```

### hiddenOn

Hide component when expression is true:

```json
{
  "type": "section",
  "hiddenOn": "${user.settings.hideSection}"
}
```

### disabledOn

Disable component when expression is true:

```json
{
  "type": "button",
  "label": "Submit",
  "disabledOn": "${form.submitting || !form.isValid}"
}
```

## Data Context

### Accessing Root Data

The root data object is available directly:

```tsx
const data = {
  user: { name: "Alice" },
  settings: { theme: "dark" }
}

<SchemaRenderer schema={schema} data={data} />
```

```json
{
  "type": "text",
  "value": "Theme: ${settings.theme}"
}
```

### Scoped Data

Some components provide scoped data:

```json
{
  "type": "list",
  "items": "${users}",
  "itemTemplate": {
    "type": "card",
    "title": "${item.name}",    // 'item' is scoped data
    "body": "${item.email}"
  }
}
```

### Index in Loops

Access the current index in loops:

```json
{
  "type": "list",
  "items": "${users}",
  "itemTemplate": {
    "type": "text",
    "value": "#${index + 1}: ${item.name}"
  }
}
```

## Built-in Functions

### String Functions

```json
{
  "type": "text",
  "value": "${user.name.toUpperCase()}"
}
```

Available:
- `toUpperCase()`, `toLowerCase()`
- `trim()`, `trimStart()`, `trimEnd()`
- `substring(start, end)`
- `replace(search, replace)`
- `split(separator)`
- `includes(substring)`
- `startsWith(prefix)`, `endsWith(suffix)`

### Array Functions

```json
{
  "type": "text",
  "value": "Total users: ${users.length}"
}
```

```json
{
  "type": "text",
  "value": "${users.map(u => u.name).join(', ')}"
}
```

Available:
- `length`
- `map(fn)`, `filter(fn)`, `reduce(fn, initial)`
- `join(separator)`
- `slice(start, end)`
- `includes(item)`
- `find(fn)`, `findIndex(fn)`
- `some(fn)`, `every(fn)`

### Number Functions

```json
{
  "type": "text",
  "value": "Price: ${price.toFixed(2)}"
}
```

Available:
- `toFixed(decimals)`
- `toPrecision(digits)`
- `toString()`

### Math Functions

```json
{
  "type": "text",
  "value": "${Math.round(average)}"
}
```

Available: All standard `Math` functions
- `Math.round()`, `Math.floor()`, `Math.ceil()`
- `Math.min()`, `Math.max()`
- `Math.abs()`
- `Math.random()`

### Date Functions

```json
{
  "type": "text",
  "value": "${new Date().toLocaleDateString()}"
}
```

## Complex Expressions

### Nested Ternary

```json
{
  "type": "badge",
  "variant": "${
    status === 'active' ? 'success' :
    status === 'pending' ? 'warning' :
    status === 'error' ? 'destructive' :
    'default'
  }"
}
```

### Combining Operators

```json
{
  "type": "alert",
  "visibleOn": "${
    (user.role === 'admin' || user.role === 'moderator') &&
    user.isActive &&
    !user.isSuspended
  }"
}
```

### Array Methods

```json
{
  "type": "text",
  "value": "${
    users
      .filter(u => u.isActive)
      .map(u => u.name)
      .join(', ')
  }"
}
```

## Practical Examples

### User Greeting

```json
{
  "type": "text",
  "value": "${
    new Date().getHours() < 12 ? 'Good morning' :
    new Date().getHours() < 18 ? 'Good afternoon' :
    'Good evening'
  }, ${user.firstName}!"
}
```

### Status Badge

```json
{
  "type": "badge",
  "text": "${status}",
  "variant": "${
    status === 'completed' ? 'success' :
    status === 'in_progress' ? 'info' :
    status === 'pending' ? 'warning' :
    'default'
  }"
}
```

### Price Formatting

```json
{
  "type": "text",
  "value": "$${(price * quantity).toFixed(2)}"
}
```

### Empty State

```json
{
  "type": "empty-state",
  "visibleOn": "${items.length === 0}",
  "message": "No items to display",
  "description": "Start by adding your first item"
}
```

### Percentage Bar

```json
{
  "type": "progress",
  "value": "${(completed / total) * 100}",
  "label": "${completed} of ${total} completed"
}
```

### Conditional Styling

```json
{
  "type": "card",
  "className": "${
    isPriority ? 'border-red-500 border-2' :
    isCompleted ? 'opacity-50' :
    'border-gray-200'
  }"
}
```

## Form Expressions

### Dependent Fields

```json
{
  "type": "form",
  "body": [
    {
      "type": "select",
      "name": "country",
      "label": "Country",
      "options": ["USA", "Canada", "Mexico"]
    },
    {
      "type": "select",
      "name": "state",
      "label": "State/Province",
      "visibleOn": "${form.country === 'USA'}",
      "options": ["CA", "NY", "TX"]
    }
  ]
}
```

### Dynamic Validation

```json
{
  "type": "input",
  "name": "email",
  "label": "Email",
  "required": true,
  "validations": {
    "isEmail": true,
    "errorMessage": "Please enter a valid email"
  }
}
```

### Computed Fields

```json
{
  "type": "input",
  "name": "total",
  "label": "Total",
  "value": "${form.price * form.quantity}",
  "disabled": true
}
```

## Performance Considerations

### Expensive Computations

Expressions are re-evaluated when data changes. Avoid expensive operations:

```json
// ❌ Bad: Complex computation in expression
{
  "type": "text",
  "value": "${users.map(u => expensiveOperation(u)).join(', ')}"
}

// ✅ Good: Pre-compute in data
```

```tsx
const data = {
  processedUsers: users.map(u => expensiveOperation(u))
}
```

### Caching

The expression engine automatically caches results when data doesn't change.

## Security

### Sandboxed Execution

Expressions run in a sandboxed environment and can only access:
- The data context you provide
- Built-in JavaScript functions (Math, Date, String, Array methods)

They **cannot** access:
- Browser APIs (window, document, localStorage)
- Node.js APIs (fs, path, etc.)
- Global variables
- Function constructors

### Sanitization

All expression outputs are automatically sanitized to prevent XSS attacks.

## Debugging Expressions

### Expression Errors

Invalid expressions show helpful error messages:

```json
{
  "type": "text",
  "value": "${user.invalidProperty}"
}
```

Error: "Cannot read property 'invalidProperty' of undefined"

### Debug Mode

Enable debug mode to see expression evaluation:

```tsx
<SchemaRenderer 
  schema={schema} 
  data={data}
  debug={true}
/>
```

This logs all expression evaluations to the console.

## Advanced Usage

### Custom Functions

Extend the expression context with custom functions:

```tsx
import { getExpressionEvaluator } from '@object-ui/core'

const evaluator = getExpressionEvaluator()

evaluator.registerFunction('formatCurrency', (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value)
})
```

Use in schemas:

```json
{
  "type": "text",
  "value": "${formatCurrency(price)}"
}
```

### Custom Operators

Register custom operators for domain-specific logic:

```tsx
evaluator.registerOperator('contains', (array, item) => {
  return array.includes(item)
})
```

```json
{
  "type": "button",
  "visibleOn": "${user.permissions contains 'admin'}"
}
```

## Best Practices

### 1. Keep Expressions Simple

```json
// ❌ Bad: Too complex
{
  "value": "${users.filter(u => u.age > 18).map(u => ({...u, isAdult: true})).reduce((acc, u) => acc + u.score, 0)}"
}

// ✅ Good: Pre-compute complex logic
{
  "value": "${adultUsersScore}"
}
```

### 2. Use Meaningful Variable Names

```json
// ❌ Bad
{
  "visibleOn": "${x && y || z}"
}

// ✅ Good
{
  "visibleOn": "${isAdmin && isActive || isSuperUser}"
}
```

### 3. Handle Null/Undefined

```json
// ❌ Bad: Might throw error
{
  "value": "${user.address.city}"
}

// ✅ Good: Safe access
{
  "value": "${user.address?.city || 'N/A'}"
}
```

### 4. Use TypeScript

Define your data types:

```tsx
interface UserData {
  user: {
    name: string
    role: 'admin' | 'user'
    isActive: boolean
  }
}

const data: UserData = { /* ... */ }
<SchemaRenderer schema={schema} data={data} />
```

## Next Steps

- [Schema Rendering](./schema-rendering.md) - Learn the rendering engine
- [Component Registry](./component-registry.md) - Understand components
- [Protocol Overview](/protocol/overview) - Explore schema specifications

## Related Documentation

- [Core API](/api/core) - Expression evaluator API
- [Form Protocol](/protocol/form) - Form-specific expressions
- [View Protocol](/protocol/view) - Data view expressions
