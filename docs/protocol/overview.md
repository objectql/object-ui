# Protocol Specifications

The Object UI Protocol defines the standard schemas and conventions for describing user interfaces in JSON. This protocol is the foundation of Object UI and ensures consistency across all implementations.

## Overview

The protocol is organized into several core types, each representing a different aspect of application UI:

### Core Types

- **[Object](/protocol/object)** - Data models and CRUD operations
- **[View](/protocol/view)** - Data visualization (list, table, kanban, etc.)
- **[Page](/protocol/page)** - Page layouts and structure
- **[Form](/protocol/form)** - Form definitions and validation
- **[Menu](/protocol/menu)** - Navigation menus and breadcrumbs
- **[App](/protocol/app)** - Application configuration
- **[Report](/protocol/report)** - Reports and analytics

## Design Principles

The protocol follows these key principles:

### 1. JSON-First

All UI definitions are valid JSON, making them:
- Easy to serialize and transmit
- Language-agnostic
- Version control friendly
- AI-friendly for generation

### 2. Type-Safe

Complete TypeScript definitions for all schemas:
```typescript
interface PageSchema {
  type: 'page'
  title: string
  body: ComponentSchema | ComponentSchema[]
  // ... more properties
}
```

### 3. Composable

Schemas can be nested and reused:
```json
{
  "type": "page",
  "body": {
    "type": "grid",
    "items": [
      { "type": "card", ... },
      { "type": "form", ... }
    ]
  }
}
```

### 4. Extensible

Add custom properties for your needs:
```json
{
  "type": "button",
  "label": "Click Me",
  "customData": { ... },
  "onCustomEvent": "handleCustom"
}
```

## Schema Structure

All schemas follow a common structure:

### Base Properties

Every schema includes these base properties:

```typescript
interface BaseSchema {
  type: string           // Component type
  id?: string           // Unique identifier
  name?: string         // Field name for forms
  className?: string    // Tailwind classes
  style?: object        // Inline styles
  visible?: boolean     // Visibility flag
  visibleOn?: string    // Conditional visibility
}
```

### Type-Specific Properties

Each type adds its own properties:

```json
{
  "type": "input",
  "name": "email",
  "label": "Email Address",
  "required": true,
  "placeholder": "you@example.com"
}
```

## Expression System

The protocol includes a powerful expression system for dynamic behavior:

### Variable References

```json
{
  "value": "${data.user.name}"
}
```

### Computed Values

```json
{
  "value": "${data.price * data.quantity}"
}
```

### Conditional Logic

```json
{
  "visibleOn": "${user.role === 'admin'}"
}
```

### Function Calls

```json
{
  "value": "${formatDate(data.createdAt, 'YYYY-MM-DD')}"
}
```

## Validation

All schemas can be validated using:

1. **JSON Schema** - Standard JSON validation
2. **Zod** - Runtime TypeScript validation
3. **TypeScript** - Compile-time type checking

Example validation:

```typescript
import { PageSchema } from '@object-ui/protocol'
import { z } from 'zod'

const pageSchema = z.object({
  type: z.literal('page'),
  title: z.string(),
  body: z.any()
})

// Validate at runtime
pageSchema.parse(myPageData)
```

## Versioning

The protocol follows semantic versioning:

- **Major** version: Breaking changes
- **Minor** version: New features (backward compatible)
- **Patch** version: Bug fixes

Current version: **0.1.0** (Preview)

## Migration

When the protocol changes:

1. **Backward compatibility**: Old schemas continue to work
2. **Deprecation warnings**: Get notified of deprecated features
3. **Migration tools**: Automated schema updates
4. **Documentation**: Clear migration guides

## Example: Complete Page

Here's a complete example using multiple protocol types:

```json
{
  "type": "page",
  "title": "User Management",
  "body": {
    "type": "crud",
    "api": "/api/users",
    "columns": [
      {
        "name": "name",
        "label": "Name",
        "type": "text"
      },
      {
        "name": "email",
        "label": "Email",
        "type": "email"
      },
      {
        "name": "role",
        "label": "Role",
        "type": "select",
        "options": ["admin", "user", "guest"]
      }
    ],
    "actions": [
      {
        "type": "button",
        "label": "Add User",
        "action": "create"
      }
    ]
  }
}
```

This single schema creates a complete user management interface with:
- Data table with sorting and pagination
- Search functionality
- Create/edit/delete operations
- Form validation
- API integration

## Reference Implementation

The reference implementation is available in TypeScript:

```bash
npm install @object-ui/protocol
```

```typescript
import {
  PageSchema,
  ViewSchema,
  ObjectSchema
} from '@object-ui/protocol'
```

## Contributing

Help us improve the protocol:

1. [Report issues](https://github.com/objectql/object-ui/issues)
2. [Propose changes](https://github.com/objectql/object-ui/pulls)
3. [Join discussions](https://github.com/objectql/object-ui/discussions)

## Next Steps

- [Object Protocol](/protocol/object) - Learn about data models
- [View Protocol](/protocol/view) - Understand data visualization
- [Page Protocol](/protocol/page) - Master page layouts

---

**Version**: 0.1.0 (Preview)  
**Last Updated**: January 2026  
**Status**: Active Development
