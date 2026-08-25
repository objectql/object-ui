/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Visual Designer Types
 * 
 * Type definitions for the visual designer system including page designer,
 * data model designer, process designer, report designer,
 * and multi-user collaborative editing.
 * 
 * @module designer
 * @packageDocumentation
 */

import type { BaseSchema } from './base.js';

// ============================================================================
// Page Designer (Drag-and-Drop)
// ============================================================================

/** Drag-and-drop item position */
export interface DesignerPosition {
  /** X coordinate (pixels or grid units) */
  x: number;
  /** Y coordinate (pixels or grid units) */
  y: number;
  /** Width */
  width: number | string;
  /** Height */
  height: number | string;
}

/** Designer canvas configuration */
export interface DesignerCanvasConfig {
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** Grid snap size */
  gridSize?: number;
  /** Whether to show grid */
  showGrid?: boolean;
  /** Whether to enable snap-to-grid */
  snapToGrid?: boolean;
  /** Zoom level (1.0 = 100%) */
  zoom?: number;
  /** Background color */
  backgroundColor?: string;
}

/** Page designer component on canvas */
export interface DesignerComponent {
  /** Unique component ID */
  id: string;
  /** Component type */
  type: string;
  /** Display label */
  label?: string;
  /** Position on canvas */
  position: DesignerPosition;
  /** Component properties */
  props: Record<string, unknown>;
  /** Child components */
  children?: DesignerComponent[];
  /** Parent component ID */
  parentId?: string;
  /** Lock state */
  locked?: boolean;
  /** Visibility */
  visible?: boolean;
  /** Z-index for layering */
  zIndex?: number;
}

/** Page designer schema */
export interface PageDesignerSchema extends BaseSchema {
  type: 'page-designer';
  /** Canvas configuration */
  canvas: DesignerCanvasConfig;
  /** Components on the canvas */
  components: DesignerComponent[];
  /** Available component palette */
  palette?: DesignerPaletteCategory[];
  /** Property editor configuration */
  propertyEditor?: boolean;
  /** Component tree visibility */
  showComponentTree?: boolean;
  /** Undo/redo support */
  undoRedo?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

/** Component palette category */
export interface DesignerPaletteCategory {
  /** Category name */
  name: string;
  /** Category label */
  label: string;
  /** Category icon */
  icon?: string;
  /** Available components */
  items: DesignerPaletteItem[];
}

/** Palette item for drag-and-drop */
export interface DesignerPaletteItem {
  /** Component type */
  type: string;
  /** Display label */
  label: string;
  /** Icon */
  icon?: string;
  /** Default properties */
  defaultProps?: Record<string, unknown>;
  /** Default size */
  defaultSize?: { width: number | string; height: number | string };
  /** Preview image URL */
  preview?: string;
}

// ============================================================================
// Data Model Designer (ER Diagrams)
// ============================================================================

/** Data model entity (table/object) */
export interface DataModelEntity {
  /** Entity identifier */
  id: string;
  /** Entity name */
  name: string;
  /** Display label */
  label: string;
  /** Entity fields */
  fields: DataModelField[];
  /** Position on canvas */
  position: { x: number; y: number };
  /** Entity color */
  color?: string;
  /** Entity description */
  description?: string;
}

/** Data model field definition */
export interface DataModelField {
  /** Field name */
  name: string;
  /** Display label */
  label?: string;
  /** Field data type */
  type: string;
  /** Whether this is a primary key */
  primaryKey?: boolean;
  /** Whether this field is required */
  required?: boolean;
  /** Whether this field is unique */
  unique?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Field description */
  description?: string;
}

/** Relationship between entities */
export interface DataModelRelationship {
  /** Relationship identifier */
  id: string;
  /** Source entity ID */
  sourceEntity: string;
  /** Source field */
  sourceField: string;
  /** Target entity ID */
  targetEntity: string;
  /** Target field */
  targetField: string;
  /** Relationship type */
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  /** Relationship label */
  label?: string;
  /** Cascade behavior on delete */
  onDelete?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
  /** Cascade behavior on update */
  onUpdate?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
}

/** Data model designer schema */
export interface DataModelDesignerSchema extends BaseSchema {
  type: 'data-model-designer';
  /** Entities in the model */
  entities: DataModelEntity[];
  /** Relationships between entities */
  relationships: DataModelRelationship[];
  /** Canvas configuration */
  canvas?: DesignerCanvasConfig;
  /** Show relationship labels */
  showRelationshipLabels?: boolean;
  /** Auto-layout enabled */
  autoLayout?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Process Designer (BPMN 2.0)
// ============================================================================

/** BPMN node types */
export type BPMNNodeType =
  | 'start-event'
  | 'end-event'
  | 'task'
  | 'user-task'
  | 'service-task'
  | 'script-task'
  | 'send-task'
  | 'receive-task'
  | 'manual-task'
  | 'business-rule-task'
  | 'sub-process'
  | 'call-activity'
  | 'exclusive-gateway'
  | 'parallel-gateway'
  | 'inclusive-gateway'
  | 'event-based-gateway'
  | 'intermediate-catch-event'
  | 'intermediate-throw-event'
  | 'boundary-event'
  | 'timer-event'
  | 'message-event'
  | 'signal-event'
  | 'error-event'
  | 'compensation-event';

/** BPMN process node */
export interface BPMNNode {
  /** Node identifier */
  id: string;
  /** Node type */
  type: BPMNNodeType;
  /** Display label */
  label: string;
  /** Position on canvas */
  position: { x: number; y: number };
  /** Node properties */
  properties?: Record<string, unknown>;
  /** Assigned user/role (for user tasks) */
  assignee?: string;
  /** Due date expression */
  dueDate?: string;
  /** Script content (for script tasks) */
  script?: string;
  /** Service endpoint (for service tasks) */
  serviceEndpoint?: string;
  /** Description */
  description?: string;
}

/** BPMN sequence flow (edge) */
export interface BPMNEdge {
  /** Edge identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Condition expression (for conditional flows) */
  condition?: string;
  /** Edge label */
  label?: string;
  /** Whether this is the default flow */
  isDefault?: boolean;
}

/** BPMN lane */
export interface BPMNLane {
  /** Lane identifier */
  id: string;
  /** Lane label */
  label: string;
  /** Associated role or department */
  role?: string;
  /** Nodes in this lane */
  nodeIds: string[];
}

/** Process designer schema */
export interface ProcessDesignerSchema extends BaseSchema {
  type: 'process-designer';
  /** Process name */
  processName: string;
  /** Process version */
  version?: string;
  /** BPMN nodes */
  nodes: BPMNNode[];
  /** BPMN edges/flows */
  edges: BPMNEdge[];
  /** Swim lanes */
  lanes?: BPMNLane[];
  /** Canvas configuration */
  canvas?: DesignerCanvasConfig;
  /** Process variables */
  variables?: Array<{ name: string; type: string; defaultValue?: unknown }>;
  /** Show minimap */
  showMinimap?: boolean;
  /** Show toolbar */
  showToolbar?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Report Designer
// ============================================================================

/** Report designer section type */
export type ReportSectionType = 'header' | 'detail' | 'footer' | 'group-header' | 'group-footer' | 'page-header' | 'page-footer';

/** Report designer element */
export interface ReportDesignerElement {
  /** Element identifier */
  id: string;
  /** Element type */
  type: 'text' | 'field' | 'image' | 'chart' | 'table' | 'barcode' | 'line' | 'rectangle' | 'expression';
  /** Position within section */
  position: DesignerPosition;
  /** Element properties */
  properties: Record<string, unknown>;
  /** Data binding expression */
  dataBinding?: string;
  /** Formatting options */
  format?: {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    color?: string;
    backgroundColor?: string;
    alignment?: 'left' | 'center' | 'right';
    verticalAlignment?: 'top' | 'middle' | 'bottom';
    border?: string;
    padding?: string;
    numberFormat?: string;
    dateFormat?: string;
  };
}

/** Report designer section */
export interface ReportDesignerSection {
  /** Section type */
  type: ReportSectionType;
  /** Section height */
  height: number;
  /** Elements in this section */
  elements: ReportDesignerElement[];
  /** Group field (for group headers/footers) */
  groupField?: string;
  /** Whether section repeats */
  repeat?: boolean;
  /** Page break before */
  pageBreakBefore?: boolean;
}

/** Report designer schema */
export interface ReportDesignerSchema extends BaseSchema {
  type: 'report-designer';
  /** Report name */
  reportName: string;
  /** Data source object */
  objectName: string;
  /** Page size */
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid';
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
  /** Page margins */
  margins?: { top: number; right: number; bottom: number; left: number };
  /** Report sections */
  sections: ReportDesignerSection[];
  /** Report parameters */
  parameters?: Array<{ name: string; type: string; label: string; defaultValue?: unknown }>;
  /** Show designer toolbar */
  showToolbar?: boolean;
  /** Show property panel */
  showPropertyPanel?: boolean;
  /** Preview mode */
  previewMode?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Unified View Configuration
// ============================================================================

/** Column configuration for rich view columns */
export interface ViewColumnConfig {
  /** Field name */
  field: string;
  /** Display label */
  label?: string;
  /** Column width */
  width?: number | string;
  /** Whether column is visible */
  visible?: boolean;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Column order index */
  order?: number;
}

/** View type union */
export type UnifiedViewType = 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map' | 'chart';

/**
 * Unified data model for view configuration.
 *
 * Used by ViewConfigPanel (create/edit).
 * Columns may be simple field-name strings or rich ViewColumnConfig objects;
 * consumers should handle both.
 */
export interface UnifiedViewConfig {
  /** View identifier */
  id?: string;
  /** Display label */
  label?: string;
  /** View type */
  type?: UnifiedViewType;
  /** Column configuration — simple field names or rich ViewColumnConfig objects */
  columns?: Array<string | ViewColumnConfig>;
  /** Filter conditions in @objectstack/spec JSON-rules array format */
  filter?: any[];
  /** Sort configuration */
  sort?: Array<{ field: string; order?: string; direction?: string; id?: string }>;
  /** Description */
  description?: string;
  /** Enable search bar */
  showSearch?: boolean;
  /** Enable user filter controls */
  showFilters?: boolean;
  /** Enable user sort controls */
  showSort?: boolean;
  /** Allow data export */
  allowExport?: boolean;
  /** Show view description */
  showDescription?: boolean;
  /** Enable "add record via form" action */
  addRecordViaForm?: boolean;
  /** Export options */
  exportOptions?: any;

  // -- Type-specific options (nested per @objectstack/spec protocol) ----------

  /** Kanban-specific options */
  kanban?: {
    groupByField?: string;
    groupField?: string;
    titleField?: string;
    columns?: string[];
  };
  /** Calendar-specific options */
  calendar?: {
    startDateField?: string;
    endDateField?: string;
    titleField?: string;
    colorField?: string;
    allDayField?: string;
    defaultView?: string;
  };
  /** Map-specific options */
  map?: {
    locationField?: string;
    titleField?: string;
    latitudeField?: string;
    longitudeField?: string;
    zoom?: number;
    center?: { lat: number; lng: number };
  };
  /** Gallery-specific options */
  gallery?: {
    imageField?: string;
    titleField?: string;
  };
  /** Timeline-specific options */
  timeline?: {
    dateField?: string;
    titleField?: string;
    descriptionField?: string;
  };
  /** Gantt-specific options */
  gantt?: {
    startDateField?: string;
    endDateField?: string;
    titleField?: string;
    progressField?: string;
    dependenciesField?: string;
    colorField?: string;
  };
  /** Chart-specific options */
  chart?: {
    chartType?: string;
    xAxisField?: string;
    yAxisFields?: string[];
    aggregation?: string;
    series?: any[];
    config?: any;
    filter?: any;
  };

  /** Catch-all for additional properties */
  [key: string]: any;
}

// ============================================================================
// Dashboard Configuration
// ============================================================================

/** All supported color variants for dashboard widgets */
export const DASHBOARD_COLOR_VARIANTS = [
  'default', 'blue', 'teal', 'orange', 'purple', 'success', 'warning', 'danger',
] as const;

/** Color variant for dashboard widgets */
export type DashboardColorVariant = (typeof DASHBOARD_COLOR_VARIANTS)[number];

/** All supported widget visualization types */
export const DASHBOARD_WIDGET_TYPES = [
  'metric', 'bar', 'horizontal-bar', 'line', 'pie', 'donut', 'area', 'scatter', 'funnel', 'table', 'pivot', 'list', 'custom',
] as const;

/** Widget visualization type */
export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

/** Layout position for a single dashboard widget */
export interface DashboardWidgetConfig {
  /** Widget identifier */
  id: string;
  /** Widget title */
  title?: string;
  /** Widget description */
  description?: string;
  /** Visualization type */
  type?: DashboardWidgetType;
  /** Data source object name */
  object?: string;
  /** Filter conditions applied to widget data */
  filter?: any[];
  /** Category / x-axis field */
  categoryField?: string;
  /** Value / y-axis field */
  valueField?: string;
  /** Aggregation function (count, sum, avg, min, max) */
  aggregate?: string;
  /** Chart-specific configuration */
  chartConfig?: any;
  /** Color variant */
  colorVariant?: DashboardColorVariant;
  /** Grid layout position */
  layout?: { x: number; y: number; w: number; h: number };
  /** Clickable action URL */
  actionUrl?: string;
}

/**
 * Unified data model for dashboard configuration.
 *
 * Used by the DashboardConfigPanel for create/edit workflows.
 * Mirrors the pattern of UnifiedViewConfig for view configuration.
 */
export interface DashboardConfig {
  /** Dashboard identifier */
  id?: string;
  /** Display title */
  title?: string;
  /** Dashboard description */
  description?: string;
  /** Number of grid columns (default: 12) */
  columns?: number;
  /** Grid gap in pixels */
  gap?: number;
  /** Auto-refresh interval in seconds */
  refreshInterval?: number;
  /** Dashboard widgets */
  widgets?: DashboardWidgetConfig[];

  // -- Global filters --------------------------------------------------------

  /** Global filter conditions applied across all widgets */
  globalFilters?: any[];
  /** Date range filter configuration */
  dateRange?: {
    enabled?: boolean;
    field?: string;
    presets?: string[];
  };
  /** User-selectable filter fields */
  userFilters?: Array<{
    field: string;
    label?: string;
    type?: string;
  }>;

  // -- Appearance ------------------------------------------------------------

  /** Show dashboard header with title/description */
  showHeader?: boolean;
  /** Show global filter bar */
  showFilters?: boolean;
  /** Show date range picker */
  showDateRange?: boolean;
  /** Action buttons in dashboard header */
  headerActions?: Array<{
    label: string;
    action?: string;
    icon?: string;
    variant?: string;
  }>;

  // -- Accessibility ---------------------------------------------------------
  //
  // `aria?: { label?, description? }` was DECLARED here until objectui#5852.
  // It was never a contract: the spellings (`label`/`description`) match
  // neither `@objectstack/spec`'s `AriaProps` (`ariaLabel` / `ariaDescribedBy`
  // / `role`) nor anything a renderer maps, so no read point could have
  // consumed it even in principle. Measured on `origin/main` at the retirement:
  // zero `.aria` reads in `packages/plugin-designer/src`,
  // `packages/plugin-dashboard/src` and `apps/console/src` (the same grep
  // family finds the live `schema.aria` reads in `plugin-detail`'s
  // `record-quick-actions.tsx` and `plugin-list`'s `ListView.tsx`), and zero
  // occurrences of either name in the `objectstack` repo.
  //
  // `DashboardConfigPanel.tsx` — the panel this interface's own doc comment
  // says it serves — imports `ConfigPanelSchema` from `@object-ui/components`
  // and neither `DashboardConfig` nor `DashboardConfigSchema`, so the key
  // documented an integration that does not exist.
  //
  // Note the `[key: string]: any` catch-all below still types an authored
  // `aria` as `any`: this deletion removes the type-level SUGGESTION, not a
  // key that ever rendered (same shape as objectui#5830 on
  // `DashboardComponentSchema.aria`). The Zod twin does carry teeth — see the
  // `z.never()` tombstone in `zod/complex.zod.ts`. Pinned by
  // `__tests__/dashboard-config.test.ts`.

  /** Catch-all for additional properties */
  [key: string]: any;
}

// ============================================================================
// Object Manager (Enterprise Metadata Management)
// ============================================================================

/** Object definition for the Object Manager */
export interface ObjectDefinition {
  /** Unique object identifier */
  id: string;
  /** API name (snake_case) */
  name: string;
  /** Display label */
  label: string;
  /** Plural display label */
  pluralLabel?: string;
  /** Object description */
  description?: string;
  /** Icon name (Lucide icon) */
  icon?: string;
  /** Grouping/category */
  group?: string;
  /** Sort order within group */
  sortOrder?: number;
  /** Whether this is a system object (non-deletable) */
  isSystem?: boolean;
  /** Field count (read-only, for display) */
  fieldCount?: number;
  /** Relationships to other objects */
  relationships?: ObjectDefinitionRelationship[];
}

/** Relationship reference for Object Manager */
export interface ObjectDefinitionRelationship {
  /** Related object name */
  relatedObject: string;
  /** Relationship type */
  type: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  /** Relationship label */
  label?: string;
  /** Foreign key field */
  foreignKey?: string;
}

/** Object Manager component schema */
export interface ObjectManagerSchema extends BaseSchema {
  type: 'object-manager';
  /** List of object definitions */
  objects: ObjectDefinition[];
  /** Read-only mode */
  readOnly?: boolean;
  /** Show system objects */
  showSystemObjects?: boolean;
}

// ============================================================================
// Field Designer (Field Configuration Wizard)
// ============================================================================

/**
 * Canonical, ordered list of field types the Field Designer supports.
 *
 * Single runtime source for every surface that enumerates the designer's
 * vocabulary: `FieldDesigner` renders its palette in exactly this order (its
 * `FIELD_TYPE_META` is a `Record<DesignerFieldType, …>`, so adding a member
 * here without presentation is a compile error), and app-shell's
 * `object-fields-bridge` derives its editable-subset check from it instead of
 * restating the list (objectui#3017).
 */
export const DESIGNER_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'boolean',
  'date',
  'datetime',
  'time',
  'select',
  'email',
  'phone',
  'url',
  'password',
  'currency',
  'percent',
  'lookup',
  'formula',
  'autonumber',
  'file',
  'image',
  'markdown',
  'html',
  'color',
  'code',
  'location',
  'address',
  'rating',
  'slider',
] as const;

/** Supported field types in the Field Designer */
export type DesignerFieldType = (typeof DESIGNER_FIELD_TYPES)[number];

/** Select option for field designer */
export interface DesignerFieldOption {
  /** Option label */
  label: string;
  /** Option value */
  value: string;
  /** Option color (for badge display) */
  color?: string;
}

/** Validation rule for field designer */
export interface DesignerValidationRule {
  /** Rule type */
  type: 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  /** Rule value */
  value: string | number;
  /** Error message */
  message?: string;
}

/** Field definition for the Field Designer */
export interface DesignerFieldDefinition {
  /** Unique field identifier */
  id: string;
  /** API name (snake_case) */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: DesignerFieldType;
  /** Field group/section */
  group?: string;
  /** Sort order within group */
  sortOrder?: number;
  /** Field description / help text */
  description?: string;
  /** Whether field is required */
  required?: boolean;
  /** Whether field is unique */
  unique?: boolean;
  /** Whether field is read-only */
  readonly?: boolean;
  /** Whether field is hidden */
  hidden?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Placeholder text */
  placeholder?: string;
  /** Select options (for select type) */
  options?: DesignerFieldOption[];
  /** Validation rules */
  validationRules?: DesignerValidationRule[];
  /** Whether this is a system field */
  isSystem?: boolean;
  /** External ID flag */
  externalId?: boolean;
  /** Track field history */
  trackHistory?: boolean;
  /*
   * There is deliberately no `indexed` here (objectui#4644). The ObjectStack
   * spec has no field-level index flag: it built no index (objectstack#2377
   * removed it) and `FieldSchema.safeParse` now rejects the key by name, so
   * any designer that authored it produced a save-blocking 422. Declare the
   * index on the object instead — `indexes: [{ name, fields, unique }]`.
   */
  /** Lookup reference object (for lookup type) */
  referenceTo?: string;
  /*
   * There is deliberately no `formula` here (objectui#6043). The spec spells a
   * formula field's expression `expression` and it is CEL — `record.amount *
   * 0.1`, rooted at `record`. `FieldSchema.safeParse` rejects `formula` by
   * name, so authoring it produced a save-blocking 422.
   *
   * The key was NOT renamed to `expression`, and that is the whole finding of
   * the card rather than a shortcut. `FieldSchema` does not parse CEL at the
   * key level: measured on `@objectstack/spec` 17.2.0 it accepts
   * `expression: 'price * quantity'` AND `expression: '!!!not cel at all!!!'`
   * — only the empty string is refused. A rename therefore buys a green parse
   * for arbitrary garbage. Worse, the control's own placeholder was
   * `price * quantity`, whose BARE field refs `celAuthoring.ts` records as
   * silently evaluating to null at runtime under the `record` scope formulas
   * bind. Renaming alone converts a loud, immediate 422 into a silent wrong
   * answer, which is strictly worse than the bug.
   *
   * Formula expressions are authored where they can be CHECKED: metadata-admin's
   * `ObjectFieldInspector` edits `expression` through `CelPredicateField`,
   * which lints against the real `@objectstack/formula` engine and stamps
   * `returnType` from the inferred CEL type. The field TYPE `formula` remains a
   * valid spec `FieldType` and stays in the designer's palette — only the
   * unvalidatable expression textarea is gone.
   */
}

/** Field Designer component schema */
export interface FieldDesignerSchema extends BaseSchema {
  type: 'field-designer';
  /** Object name this field designer belongs to */
  objectName: string;
  /** List of field definitions */
  fields: DesignerFieldDefinition[];
  /** Read-only mode */
  readOnly?: boolean;
}

// ============================================================================
// Multi-User Collaborative Editing
// ============================================================================

/** Collaboration user presence */
export interface CollaborationPresence {
  /** User identifier */
  userId: string;
  /** User display name */
  userName: string;
  /** User avatar URL */
  avatar?: string;
  /** User cursor color */
  color: string;
  /** Current selection/cursor position */
  cursor?: {
    elementId?: string;
    position?: { x: number; y: number };
  };
  /** User status */
  status: 'active' | 'idle' | 'away';
  /** Last activity timestamp */
  lastActivity: string;
}

/** Collaboration operation for conflict resolution */
export interface CollaborationOperation {
  /** Operation ID */
  id: string;
  /** User who performed the operation */
  userId: string;
  /** Operation type */
  type: 'insert' | 'update' | 'delete' | 'move' | 'resize';
  /** Target element ID */
  elementId: string;
  /** Operation data */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: string;
  /** Operation version for OT */
  version: number;
}

/** Collaborative editing configuration */
export interface CollaborationConfig {
  /** Enable real-time collaboration */
  enabled: boolean;
  /** WebSocket server URL */
  serverUrl?: string;
  /** Room/document identifier */
  roomId?: string;
  /** Maximum concurrent users */
  maxUsers?: number;
  /** Show user cursors */
  showCursors?: boolean;
  /** Show user presence list */
  showPresence?: boolean;
  /** Conflict resolution strategy */
  conflictResolution?: 'last-write-wins' | 'operational-transform' | 'crdt';
  /** Auto-save interval in milliseconds */
  autoSaveInterval?: number;
  /** Version history enabled */
  versionHistory?: boolean;
}
