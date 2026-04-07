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
 * `customRoute` to point at their existing dedicated page and are excluded
 * from the generic manager's route generation.
 *
 * @module config/metadataTypeRegistry
 */

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
   * If `true`, this type already has a dedicated management page and should
   * NOT generate a `/system/metadata/:type` route. The hub card will link
   * to `customRoute` instead.
   */
  hasCustomPage?: boolean;

  /**
   * Existing route path (relative to basePath) for types with custom pages.
   * Only used when `hasCustomPage` is `true`.
   * Example: `'/system/objects'`
   */
  customRoute?: string;

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
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * The canonical list of all metadata types.
 *
 * Order determines display order on the SystemHub page.
 * Types with `hasCustomPage: true` link to their existing route.
 * All other types use the generic MetadataManagerPage.
 */
export const METADATA_TYPES: MetadataTypeConfig[] = [
  // -- Types with existing custom pages --
  {
    type: 'app',
    label: 'Application',
    pluralLabel: 'Applications',
    description: 'Manage all configured applications',
    icon: 'layout-grid',
    hasCustomPage: true,
    customRoute: '/system/apps',
    countSource: 'metadata',
  },
  {
    type: 'object',
    label: 'Object',
    pluralLabel: 'Object Manager',
    description: 'Manage object definitions and field configurations',
    icon: 'database',
    hasCustomPage: true,
    customRoute: '/system/objects',
    countSource: 'metadata',
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
  },
  {
    type: 'report',
    label: 'Report',
    pluralLabel: 'Reports',
    description: 'Manage report configurations and templates',
    icon: 'bar-chart-3',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'label', label: 'Label' },
      { key: 'description', label: 'Description' },
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
 * (i.e. those without a custom page).
 */
export function getGenericMetadataTypes(): MetadataTypeConfig[] {
  return METADATA_TYPES.filter((m) => !m.hasCustomPage);
}

/**
 * Return all metadata types for display on the SystemHub page.
 */
export function getHubMetadataTypes(): MetadataTypeConfig[] {
  return METADATA_TYPES;
}
