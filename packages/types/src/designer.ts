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

import type { BaseSchema } from './base';

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
// View Designer (List View Layout Editor)
// ============================================================================

/** Column configuration for the view designer */
export interface ViewDesignerColumn {
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

/** View designer schema */
export interface ViewDesignerSchema extends BaseSchema {
  type: 'view-designer';
  /** Object name this view is for */
  objectName: string;
  /** View identifier (for editing existing views) */
  viewId?: string;
  /** View display label */
  viewLabel?: string;
  /** View type */
  viewType?: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';
  /** Columns / fields to display */
  columns?: ViewDesignerColumn[];
  /** Filter conditions */
  filters?: Array<{ field: string; operator: string; value: any }>;
  /** Sort configuration */
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  /** Available fields from the object schema */
  availableFields?: Array<{ name: string; label: string; type: string }>;
  /** Type-specific options */
  options?: Record<string, any>;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when view config changes */
  onChange?: string;
  /** Callback when view is saved */
  onSave?: string;
  /** Callback when cancelled */
  onCancel?: string;
}

// ============================================================================
// Unified View Configuration
// ============================================================================

/** View type union */
export type UnifiedViewType = 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map' | 'chart';

/**
 * Unified data model for view configuration.
 *
 * Used by both ViewConfigPanel (create/edit) and ViewDesigner (advanced editor).
 * Columns may be simple field-name strings or rich ViewDesignerColumn objects;
 * consumers should handle both.
 */
export interface UnifiedViewConfig {
  /** View identifier */
  id?: string;
  /** Display label */
  label?: string;
  /** View type */
  type?: UnifiedViewType;
  /** Column configuration — simple field names or rich ViewDesignerColumn objects */
  columns?: Array<string | ViewDesignerColumn>;
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
    subtitleField?: string;
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
  'metric', 'bar', 'line', 'pie', 'donut', 'area', 'scatter', 'table', 'list', 'custom',
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

  /** ARIA properties */
  aria?: {
    label?: string;
    description?: string;
  };

  /** Catch-all for additional properties */
  [key: string]: any;
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
