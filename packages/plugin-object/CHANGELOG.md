# @object-ui/plugin-object

## 0.1.1

### Patch Changes

- Updated dependencies [99cf828]
  - @object-ui/types@0.2.2
  - @object-ui/core@0.2.2
  - @object-ui/react@0.2.2
  - @object-ui/components@0.2.2
  - @object-ui/data-objectql@0.2.2

## 0.1.0 (2026-01-17)

### Features

- **New Plugin**: Created `@object-ui/plugin-object` plugin for ObjectQL-specific components
- **ObjectTable**: Added ObjectTable component that automatically generates tables from ObjectQL object schemas
  - Auto-fetches object metadata from ObjectQL
  - Auto-generates columns based on field definitions
  - Supports custom column configurations
  - Integrates seamlessly with ObjectQLDataSource
- **ObjectForm**: Added ObjectForm component that automatically generates forms from ObjectQL object schemas
  - Auto-fetches object metadata from ObjectQL
  - Auto-generates form fields based on field definitions
  - Supports create, edit, and view modes
  - Handles form submission with proper validation
  - Integrates seamlessly with ObjectQLDataSource
- **Type Definitions**: Added comprehensive TypeScript definitions
  - ObjectTableSchema type for table configuration
  - ObjectFormSchema type for form configuration
  - Full JSDoc documentation

### Dependencies

- Updated `@objectql/sdk` to ^1.9.1
- Updated `@objectql/types` to ^1.9.1
- Added MetadataApiClient integration for object schema fetching
