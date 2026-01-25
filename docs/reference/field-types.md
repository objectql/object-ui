# Field Types Reference

ObjectUI supports a comprehensive set of field types for ObjectGrid and ObjectForm components, designed to handle all data types commonly found in business applications.

## Overview

Each field type has two rendering modes:
- **Cell View** (Read Mode): Optimized display in tables and cards
- **Form Control** (Edit Mode): Interactive input component for forms

## Supported Field Types

### Basic Text Fields
- **text** - Single-line text with truncation
- **textarea** - Multi-line text input
- **markdown** - Markdown-formatted text
- **html** - Rich text HTML content

### Numeric Fields
- **number** - Numeric input with precision
- **currency** - Monetary values (`$1,234.56`)
- **percent** - Percentage values (`25.50%`)

### Boolean
- **boolean** - True/false with visual checkmarks (✓/✗)

### Date & Time
- **date** - Date picker (`Jan 15, 2024`)
- **datetime** - Date and time picker
- **time** - Time-only picker

### Selection
- **select** - Single/multi-select with colored badges

### Contact
- **email** - Email with mailto links
- **phone** - Phone with tel links
- **url** - Web address with external icon
- **password** - Secure password (masked)

### File & Media
- **file** - File upload with count display
- **image** - Image upload with thumbnails

### Relationship
- **lookup** - Reference to related records
- **master_detail** - Master-detail relationship

### Computed
- **formula** - Read-only calculated field
- **summary** - Aggregated values (sum, count, avg, min, max)
- **auto_number** - Auto-incrementing number

### User
- **user** - User selector with avatars
- **owner** - Owner selector

### Special
- **location** - Geographic coordinates
- **object** - JSON object data
- **vector** - Embedding/vector data
- **grid** - Sub-table/inline grid

## Implementation

All field renderers are exported from `@object-ui/views`:

```typescript
import { getCellRenderer } from '@object-ui/views';

const renderer = getCellRenderer('currency');
```

## See Also

- [Field Type TypeScript Definitions](../../packages/types/src/field-types.ts)
- [Field Renderers Implementation](../../packages/views/src/field-renderers.tsx)
