# @object-ui/views

## Unreleased

### Changed

- **Package Renamed**: This package was formerly known as `@object-ui/plugin-object`
- Upgraded from plugin status to core package
- Package name changed from `@object-ui/plugin-object` to `@object-ui/views`
- All functionality remains the same

## 0.3.0

### Minor Changes

- Unified version across all packages to 0.3.0 for consistent versioning

## 0.2.0

### Minor Changes

- New plugin-object and ObjectQL SDK updates

  **Added:**
  - New Plugin: @object-ui/plugin-object - ObjectQL plugin for automatic table and form generation
    - ObjectTable: Auto-generates tables from ObjectQL object schemas
    - ObjectForm: Auto-generates forms from ObjectQL object schemas with create/edit/view modes
    - Full TypeScript support with comprehensive type definitions
  - Type Definitions: Added ObjectTableSchema and ObjectFormSchema to @object-ui/types
  - ObjectQL Integration: Enhanced ObjectQLDataSource with getObjectSchema() method using MetadataApiClient

  **Changed:**
  - Updated @objectql/sdk from ^1.8.3 to ^1.9.1
  - Updated @objectql/types from ^1.8.3 to ^1.9.1

### Patch Changes

- Updated dependencies
  - @object-ui/types@0.3.0
  - @object-ui/data-objectql@0.3.0
  - @object-ui/core@0.2.2
  - @object-ui/react@0.2.2
  - @object-ui/components@0.2.2

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
