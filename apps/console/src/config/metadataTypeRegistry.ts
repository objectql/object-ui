/**
 * Metadata Type Registry
 *
 * Centralized configuration for all metadata types manageable through the
 * unified Metadata Manager. Each entry describes a metadata category
 * (e.g. `dashboard`, `page`, `report`) with its label, icon, description,
 * and optional column / form definitions used by the generic
 * MetadataManagerPage.
 *
 * To add a new metadata type:
 *   1. Add an entry to `METADATA_TYPES` below.
 *   2. That's it — routes, hub cards, and CRUD pages are auto-generated.
 *
 * Types that require a fully custom detail view (e.g. `object`) can specify
 * `pageSchemaFactory` for schema-driven detail rendering. Types that need
 * a custom list view can specify `listComponent` to replace the default
 * card/grid list — the generic manager handles the page shell.
 *
 * @module config/metadataTypeRegistry
 */

import type React from 'react';
import type { PageSchema } from '@object-ui/types';
import { buildObjectDetailPageSchema } from '../schemas/objectDetailPageSchema';
import { ObjectManagerListAdapter } from '../components/ObjectManagerListAdapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Column definition used by the generic metadata list view. */
export interface MetadataColumnDef {
  /** Field key in the metadata item. */
  key: string;
  /** Human-readable header label. */
  label: string;
  /** Optional width hint (e.g. '120px', '1fr'). */
  width?: string;
}

/** Form field definition used by MetadataFormDialog for create/edit forms. */
export interface MetadataFormFieldDef {
  /** Field key in the metadata item (e.g. `'name'`, `'label'`). */
  key: string;
  /** Human-readable label shown next to the input. */
  label: string;
  /** Input type. Defaults to `'text'`. */
  type?: 'text' | 'textarea' | 'select' | 'number' | 'boolean';
  /** Placeholder text for the input. */
  placeholder?: string;
  /** Whether the field is required. Defaults to `false`. */
  required?: boolean;
  /**
   * Whether the field is disabled when editing an existing item.
   * Useful for immutable keys like `name`. Defaults to `false`.
   */
  disabledOnEdit?: boolean;
  /** Options for `type: 'select'`. */
  options?: { label: string; value: string }[];
}

/** Action definition for custom page-level or row-level buttons. */
export interface MetadataActionDef {
  /** Unique key for the action. */
  key: string;
  /** Human-readable label shown on the button. */
  label: string;
  /** Lucide icon name (lowercase, hyphenated). Reserved for future icon rendering in action buttons. */
  icon?: string;
  /** Whether this action appears on each row (`'row'`) or at the page level (`'page'`). */
  scope: 'page' | 'row';
  /** Action variant for styling (e.g. `'default'`, `'destructive'`, `'outline'`). */
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';
  /**
   * Handler called when the action is triggered.
   * - For `scope: 'page'`: called with no arguments.
   * - For `scope: 'row'`: called with the metadata item.
   */
  handler?: (item?: Record<string, unknown>) => void;
}

/** Full configuration for a single metadata type. */
export interface MetadataTypeConfig {
  /**
   * The metadata category string sent to `client.meta.getItems(type)` /
   * `client.meta.saveItem(type, name, data)`.
   */
  type: string;

  /** Human-readable singular label shown in headings and cards. */
  label: string;

  /** Human-readable plural label shown in list headings. */
  pluralLabel: string;

  /** Description shown on the SystemHub card and page subtitle. */
  description: string;

  /** Lucide icon name (lowercase, hyphenated, e.g. `'layout-dashboard'`). */
  icon: string;

  /**
   * Column definitions for the generic list view.
   * When omitted, the list view shows `name` and `label` columns.
   */
  columns?: MetadataColumnDef[];

  /**
   * Form field definitions for the create/edit dialog.
   * When omitted, the dialog shows `name`, `label`, and `description` fields.
   */
  formFields?: MetadataFormFieldDef[];

  /**
   * Custom list route for the SystemHub card (relative to basePath).
   * When set, the hub card links here instead of `/system/metadata/:type`.
   * Example: `'/system/objects'`
   */
  customRoute?: string;

  /**
   * Factory function that generates a PageSchema for the detail page.
   * When provided, MetadataDetailPage renders the schema via SchemaRenderer
   * instead of the default card layout or `detailComponent`.
   *
   * @param itemName - The item's API name (from the URL param)
   * @param item     - The loaded metadata item (may be null while loading)
   * @returns A PageSchema to render
   */
  pageSchemaFactory?: (itemName: string, item: Record<string, unknown> | null) => PageSchema;

  /**
   * Data source for the hub card count.
   * - `'metadata'` (default): count via `client.meta.getItems(type)` length
   * - `'dataSource'`: count via `dataSource.find(countObjectName)` length
   */
  countSource?: 'metadata' | 'dataSource';

  /**
   * When `countSource` is `'dataSource'`, the object name to query.
   * E.g. `'sys_user'` for the Users card.
   */
  countObjectName?: string;

  /**
   * Whether this metadata type supports CRUD mutations (create/edit/delete).
   * Defaults to `true`. Set to `false` for read-only types (e.g. audit log).
   */
  editable?: boolean;

  /**
   * Optional custom React component for the detail page.
   * When set, the detail page will render this component instead of the
   * generic layout.
   */
  detailComponent?: React.ComponentType<{ item: Record<string, unknown> }>;

  /**
   * Custom action definitions for page-level and row-level buttons.
   * Page-level actions are rendered in the header area; row-level actions
   * appear alongside each item's edit/delete buttons.
   */
  actions?: MetadataActionDef[];

  /**
   * Display mode for the list view.
   * - `'card'` (default): Responsive card grid layout.
   * - `'grid'`: Professional table/grid layout with column headers.
   * - `'table'`: Alias for `'grid'` (same rendering).
   */
  listMode?: 'card' | 'grid' | 'table';

  /**
   * Custom list component for the manager page.
   * When provided, replaces the default card/grid list rendering entirely.
   * The component is responsible for its own data fetching and interaction.
   */
  listComponent?: React.ComponentType<MetadataListComponentProps>;
}

/** Props passed to a custom `listComponent` by MetadataManagerPage. */
export interface MetadataListComponentProps {
  /** The resolved registry configuration for the current metadata type. */
  config: MetadataTypeConfig;
  /** Base URL path (e.g. `''` or `'/apps/my_app'`). */
  basePath: string;
  /** The metadata type string (e.g. `'object'`). */
  metadataType: string;
  /** Whether the current user has admin privileges. */
  isAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The canonical list of all metadata types.
 *
 * Order determines display order on the SystemHub page.
 * Types with `customRoute` link to their existing list page.
 * Types with `pageSchemaFactory` render detail pages via PageSchema.
 * All other types use the generic MetadataManagerPage.
 */
export const METADATA_TYPES: MetadataTypeConfig[] = [
  // -- Types with dedicated list pages --
  {
    type: 'app',
    label: 'Application',
    pluralLabel: 'Applications',
    description: 'Manage all configured applications',
    icon: 'layout-grid',
    customRoute: '/system/apps',
    countSource: 'metadata',
  },
  {
    type: 'object',
    label: 'Object',
    pluralLabel: 'Object Manager',
    description: 'Manage object definitions and field configurations',
    icon: 'database',
    countSource: 'metadata',
    pageSchemaFactory: (itemName, item) => buildObjectDetailPageSchema(itemName, item),
    listComponent: ObjectManagerListAdapter,
  },

  // -- Generic metadata types (managed by MetadataManagerPage) --
  {
    type: 'dashboard',
    label: 'Dashboard',
    pluralLabel: 'Dashboards',
    description: 'Manage dashboard layouts and widgets',
    icon: 'layout-dashboard',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'label', label: 'Label' },
      { key: 'description', label: 'Description' },
    ],
    formFields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'dashboard_name', disabledOnEdit: true },
      { key: 'label', label: 'Label', required: true, placeholder: 'My Dashboard' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description' },
    ],
  },
  {
    type: 'page',
    label: 'Page',
    pluralLabel: 'Pages',
    description: 'Manage custom page definitions',
    icon: 'file-text',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'label', label: 'Label' },
      { key: 'description', label: 'Description' },
    ],
    formFields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'page_name', disabledOnEdit: true },
      { key: 'label', label: 'Label', required: true, placeholder: 'My Page' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description' },
    ],
  },
  {
    type: 'report',
    label: 'Report',
    pluralLabel: 'Reports',
    description: 'Manage report configurations and templates',
    icon: 'bar-chart-3',
    listMode: 'grid',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'label', label: 'Label' },
      { key: 'description', label: 'Description' },
    ],
    formFields: [
      { key: 'name', label: 'Name', required: true, placeholder: 'report_name', disabledOnEdit: true },
      { key: 'label', label: 'Label', required: true, placeholder: 'My Report' },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a metadata type config by its `type` string.
 * Returns `undefined` if not found.
 */
export function getMetadataTypeConfig(type: string): MetadataTypeConfig | undefined {
  return METADATA_TYPES.find((m) => m.type === type);
}

/**
 * Return only the metadata types that use the generic MetadataManagerPage
 * (i.e. those without a custom list route).
 */
export function getGenericMetadataTypes(): MetadataTypeConfig[] {
  return METADATA_TYPES.filter((m) => !m.customRoute);
}

/**
 * Return all metadata types for display on the SystemHub page.
 */
export function getHubMetadataTypes(): MetadataTypeConfig[] {
  return METADATA_TYPES;
}

/**
 * Default form fields used by MetadataFormDialog when a type does not define
 * its own `formFields`. Covers the `name`, `label`, and `description` fields.
 */
export const DEFAULT_FORM_FIELDS: MetadataFormFieldDef[] = [
  { key: 'name', label: 'Name', required: true, placeholder: 'api_name', disabledOnEdit: true },
  { key: 'label', label: 'Label', required: true, placeholder: 'Display Label' },
  { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief description' },
];
