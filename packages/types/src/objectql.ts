/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - ObjectQL Component Schemas
 * 
 * Type definitions for ObjectQL-specific components.
 * These schemas enable building ObjectQL-aware interfaces directly from object metadata.
 * 
 * Now aligned with @objectstack/spec view.zod schema for better interoperability.
 * 
 * @module objectql
 * @packageDocumentation
 */

import type { BaseSchema } from './base';
import type { BulkActionOperation } from '@objectstack/spec/ui';
import type { FormField } from './form';
// ListView type is now derived from the zod schema (issue #2231) — see ListViewSchema below.
import type { ListViewInferred } from './zod/objectql.zod.js';

// ============================================================================
// Spec-Canonical Types — imported from @objectstack/spec/ui
// Rule: "Never Redefine Types. ALWAYS import them."
// ============================================================================

/**
 * HTTP Method for API requests
 * Canonical definition from @objectstack/spec/ui.
 *
 * The spec renamed this export twice. `HttpMethod` used to name two DIFFERENT
 * types depending on the entry point — the 7-value enum on `./shared` / `./api`
 * (which adds `HEAD` / `OPTIONS`) and the 5-value UI subset on `./ui`. 17.0.0
 * split them as `HttpMethodType` (objectstack#4691); 17.0.0-rc.5 renamed that
 * again to `HttpMethodSubset` (objectstack#5832, PR objectstack#5976), because
 * `schemaNameFromExportKey` strips the `Schema` suffix and both enums published
 * as `shared/HttpMethod` — the later write won, so the emitted JSON Schema and
 * reference page described only the 5-value one.
 *
 * The 5-value RUNTIME domain is unchanged by either rename; we alias it back to
 * `HttpMethod` so `@object-ui/types`' public surface stays verbatim identical.
 * Do NOT re-point this at the spec's bare `HttpMethod`: that is the 7-value
 * enum, and `ApiDataSource` means the 5-value one. Widening it would let
 * `method: 'HEAD'` compile and then throw in `HttpRequestSchema.parse()`.
 */
export type { HttpMethodSubset as HttpMethod } from '@objectstack/spec/ui';

/**
 * HTTP Request Configuration for API Provider
 * Canonical definition from @objectstack/spec/ui.
 */
export type { HttpRequest } from '@objectstack/spec/ui';

/**
 * View Data Source Configuration
 * Canonical definition from @objectstack/spec/ui.
 *
 * Supports three modes:
 * 1. 'object': Standard Protocol - Auto-connects to ObjectStack Metadata and Data APIs
 * 2. 'api': Custom API - Explicitly provided API URLs
 * 3. 'value': Static Data - Hardcoded data array
 */
export type { ViewData } from '@objectstack/spec/ui';

/**
 * List Column Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { ListColumn } from '@objectstack/spec/ui';

/**
 * Selection Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { SelectionConfig } from '@objectstack/spec/ui';

/**
 * Pagination Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { PaginationConfig } from '@objectstack/spec/ui';

// Import spec types for local use in interfaces below
import type {
  ViewData,
  ListColumn,
  SelectionConfig,
  PaginationConfig,
  GroupingConfig,
  RowColorConfig,
  GalleryConfig,
  TimelineConfig,
  NavigationConfig,
  GanttConfig as SpecGanttConfig,
} from '@objectstack/spec/ui';

/**
 * Gallery configuration extended with legacy fields for backward compatibility.
 * Spec fields from GalleryConfigSchema take priority; legacy fields serve as fallbacks.
 */
export type ListViewGalleryConfig = GalleryConfig & {
  /** Legacy: image field (deprecated, use coverField) */
  imageField?: string;
  [key: string]: any;
};

/**
 * Timeline configuration extended with legacy fields for backward compatibility.
 * Spec fields from TimelineConfigSchema take priority; legacy fields serve as fallbacks.
 */
export type ListViewTimelineConfig = TimelineConfig & {
  /** Legacy: date field (deprecated, use startDateField) */
  dateField?: string;
  [key: string]: any;
};

/**
 * Kanban Configuration
 * Canonical definition from @objectstack/spec/ui (KanbanConfigSchema).
 *
 * A RE-EXPORT since objectui#4167, not a copy. The three keys the copy spelled
 * out (`groupByField` / `summarizeField` / `columns`) were the spec's three
 * exactly, and `KanbanConfigSchema` is `$strict`, so there was never a
 * divergence to preserve — only a second declaration under the spec's own name
 * for the next agent to read as canonical (objectstack#4115). The zod side has
 * derived from the spec all along (`zod/objectql.zod.ts`, which additionally
 * carries the `groupField` / `cardFields` legacy aliases); this alias is now
 * bound to the same source.
 */
export type { KanbanConfig } from '@objectstack/spec/ui';

/**
 * Calendar Configuration
 * Canonical definition from @objectstack/spec/ui (CalendarConfigSchema).
 *
 * A RE-EXPORT since objectui#4167, for the same reason as `KanbanConfig` above:
 * the copy's four keys were the spec's four, on a `$strict` schema.
 */
export type { CalendarConfig } from '@objectstack/spec/ui';

/**
 * Gantt Configuration — the spec's `GanttConfigSchema`, plus objectui's one
 * remaining display-only extension.
 *
 * DERIVED since objectui#4167, and the copy it replaces was carrying two false
 * claims of exactly the kind objectstack#4115 was filed about:
 *
 *  - it declared SIX keys and called itself "canonical", while rc.6's
 *    `GanttConfigSchema` declares seventeen. The eleven it never mentioned —
 *    `parentField`, `typeField`, `baselineStartField`, `baselineEndField`,
 *    `groupByField`, `resourceView`, `assigneeField`, `effortField`,
 *    `capacity`, `quickFilters`, `autoZoomToFilter` — are not hypothetical
 *    upstream additions: `plugin-gantt/src/ObjectGantt.tsx` reads every one of
 *    them, through a local `GanttConfigEx` intersection that re-declared them
 *    because this type did not;
 *  - the `tooltipFields` comment said "not part of the upstream
 *    GanttConfigSchema". It is, as of rc.6, so the key now arrives from the
 *    spec and the note is gone with it.
 *
 * `timeSegments` is the one key the spec genuinely does not model, and it stays
 * here declared as objectui's own. That is legal metadata rather than a second
 * dialect: `GanttConfigSchema` is `$loose` upstream (see the note at
 * `zod/objectql.zod.ts` — "the renderers grow config knobs"), so a key the spec
 * does not declare passes its parse instead of being rejected. The intersection
 * inherits that looseness, which is the spec's own decision for this vocabulary
 * and not a widening taken here.
 */
export type GanttConfig = SpecGanttConfig & {
  /**
   * Shift segmentation (班次/排班分段). ObjectUI display extension — not part of the
   * upstream GanttConfigSchema. When set, the day-mode timeline splits each
   * 排班日 (shift-day starting at `dayStart`, default '00:00') into the configured
   * time bands (白班 | 夜班…): a two-tier header (date over band), per-band tints,
   * and drag/resize snapping to band boundaries. No shift concept is hardcoded —
   * bands are pure config. Off by default. Example:
   * `{ dayStart: '08:00', bands: [
   *     { key: 'day', label: '白班', start: '08:00', end: '20:00' },
   *     { key: 'night', label: '夜班', start: '20:00', end: '08:00' } ] }`.
   */
  timeSegments?: {
    /** Clock time the shift-day begins, 'HH:mm' (24h). Defaults to '00:00'. */
    dayStart?: string;
    /** Ordered bands covering the 24h shift-day, beginning at `dayStart`. */
    bands: Array<{
      /** Stable id (e.g. 'day'/'night'); defaults to `band{index}`. */
      key?: string;
      /** Display label (白班 / 夜班). */
      label: string;
      /** Band start, 'HH:mm'. */
      start: string;
      /** Band end, 'HH:mm'; when `end <= start` the band crosses midnight. */
      end: string;
      /** Optional accent color (any CSS color) for the column tint. */
      color?: string;
    }>;
    /**
     * Draw the dashed calendar-midnight (日历午夜 0:00) cue inside cross-midnight
     * bands. Defaults to `true`; set `false` to hide it.
     */
    showMidnight?: boolean;
  };
};

/**
 * Sort Configuration
 */
export interface SortConfig {
  /** Field to sort by */
  field: string;
  /** Sort order */
  order: 'asc' | 'desc';
}

// ============================================================================
// QuickFilter Types — Dual-format support
// ============================================================================


// ============================================================================
// ConditionalFormatting Types — Dual-format support
// ============================================================================

/**
 * ObjectUI-native ConditionalFormatting rule.
 * Uses field/operator/value for declarative comparisons.
 */
export interface ObjectUIConditionalFormattingRule {
  /** Field name to evaluate */
  field: string;
  /** Comparison operator */
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in';
  /** Value to compare against */
  value: unknown;
  /** CSS-compatible background color */
  backgroundColor?: string;
  /** CSS-compatible text color */
  textColor?: string;
  /** CSS-compatible border color */
  borderColor?: string;
  /** Template expression override (e.g., '${data.amount > 1000}') */
  expression?: string;
}

/**
 * Spec-format ConditionalFormatting rule (from @objectstack/spec).
 * Uses a plain expression string with a style map.
 * Automatically evaluated at runtime via ExpressionEvaluator.
 */
export interface SpecConditionalFormattingRule {
  /** Plain condition expression (e.g., "status == 'overdue'") or template expression (e.g., "${data.amount > 1000}") */
  condition: string;
  /** Style map to apply when condition matches (e.g., { backgroundColor: '#fee2e2', color: '#991b1b' }) */
  style: Record<string, string>;
}

/**
 * Union type for ConditionalFormatting rules — accepts both ObjectUI and Spec formats.
 * Rules are evaluated in order; first matching rule wins.
 */
export type ConditionalFormattingRule = ObjectUIConditionalFormattingRule | SpecConditionalFormattingRule;

/**
 * Parameter declaration for a bulk action. Rendered as a single field in the
 * BulkActionDialog params step. Mirrors a minimal FormField shape so existing
 * field widgets (text/number/select/lookup/boolean/date) can render it.
 */
export interface BulkActionParam {
  /** Parameter name — passed to the runtime handler as params[name]. */
  name: string;
  /** Human-readable label (i18n-resolved upstream). */
  label?: string;
  /** Optional help text shown beneath the field. */
  help?: string;
  /**
   * Field widget type — one of the standard FieldWidget names.
   * Common values: 'text' | 'number' | 'select' | 'lookup' | 'boolean' | 'date' | 'datetime' | 'textarea'.
   */
  type: string;
  /** Whether the param is required to enable the Confirm button. */
  required?: boolean;
  /** Default value applied when the dialog opens. */
  default?: unknown;
  /**
   * Static options for select-style fields.
   *
   * The ENTRY is open for the same reason this interface is (see the catch-all
   * at the bottom): `bulkParamToField` spreads each entry into the field
   * metadata it hands the widget (`{ ...o, value: String(o.value) }`), so every
   * extra key survives, and the option widgets read `color` / `icon` /
   * `disabled` / `visibleWhen` beyond the declared pair (`SelectOptionMetadata`
   * in `./field-types` declares them; `@object-ui/fields` reads them). While
   * this entry was closed, the type was the ONLY layer rejecting a configuration
   * the renderer honours — `@objectstack/spec`'s `BulkActionParamSchema` makes
   * the same entry `.passthrough()` (objectstack#4001) — and an author (an AI
   * author especially) trusts the type absolutely (objectui#3309).
   *
   * Structurally identical to `@object-ui/core`'s `ActionParamOption`
   * (objectui#3559), deliberately restated inline rather than imported: this
   * package is the protocol layer and takes no workspace dependency.
   *
   * Naming the two keys this layer itself uses and passing the rest through is
   * NOT an invitation to author new option keys — the authoring gate is the
   * spec's `SelectOptionSchema`, and it is strict.
   */
  options?: Array<{
    label: string;
    value: string | number | boolean;
    /** Extra option config forwarded to the field widget as-is (see above). */
    [key: string]: unknown;
  }>;
  /** For lookup widgets — the related object name (e.g. 'user'). */
  object?: string;
  /**
   * For `select` / `lookup` widgets — allow picking multiple values. The param
   * value becomes a string array and is written to the patch as-is (matching a
   * multi-value backend field, e.g. a multi-user `executors`). Defaults to
   * single-select.
   */
  multiple?: boolean;
  /**
   * For `lookup` widgets — the related-object field used as the option label
   * (defaults to name/full_name/email/id in that order).
   */
  labelField?: string;
  /** Placeholder text. */
  placeholder?: string;
  /**
   * Catch-all for extra widget-specific configuration (min/max/step/format/...).
   * Forwarded to the underlying field renderer as-is.
   */
  [key: string]: unknown;
}

/**
 * Bulk action operation kind. Determines which `dataSource` method the executor
 * calls per batch. `custom` defers entirely to `onComplete` event handlers and
 * is intended for callouts (notify/export/...) that don't mutate records —
 * UNLESS the def carries {@link BulkActionDef.actionDef}, in which case the
 * executor dispatches that action through the action runner: once per record by
 * default, or once for the whole selection when the def opts into
 * {@link BulkActionDef.execution} `'aggregate'` (objectui#3139).
 *
 * Spec-owned since 17.0.0-rc.2 (`@objectstack/spec/ui` exports the identical
 * `'update' | 'delete' | 'custom'` union); re-exported so consumers keep this
 * import path. (Imported at the top of this module — BulkActionDef below
 * references it.)
 */
export type { BulkActionOperation };

/**
 * Rich, schema-driven definition of a bulk action.
 *
 * The grid renders one button per def in the BulkActionBar. Clicking it opens
 * the BulkActionDialog: params form → confirm → progress → result. The executor
 * batches selected records via `dataSource.bulk(resource, op, items)` — or, for
 * a def derived from an object action ({@link BulkActionDef.actionDef}),
 * dispatches that action once per record through the action runner.
 *
 * Two sources feed the bar (folded by `resolveBulkActions` in plugin-grid):
 * defs authored inline in the view JSON, and the view's `bulkActions: string[]`
 * names — each resolved against `objectDef.actions` and promoted to that def
 * when it matches one. Naming the action in the view is the only way to declare
 * a bulk action: spec 17 retired `action.bulkEnabled` as a tombstone and
 * prescribes exactly this. Names that match nothing still render as by-name
 * buttons, since a consumer may have registered a runner handler under one.
 */
export interface BulkActionDef {
  /** Stable identifier — also used as the action key in audit logs. */
  name: string;
  /** Human-readable label shown on the button + dialog header. */
  label?: string;
  /** Lucide icon name (e.g. 'user-check', 'trash-2'); falls back to a generic icon. */
  icon?: string;
  /** Visual treatment of the action button. */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  /** Operation kind — drives how the executor mutates records. */
  operation: BulkActionOperation;
  /**
   * For `operation: 'update'`, a static patch applied to every selected record
   * (merged AFTER user-supplied params). Allows declaring fixed-value mass
   * updates without exposing them in the params form.
   */
  patch?: Record<string, unknown>;
  /**
   * Parameters collected from the user before execution. Empty/undefined →
   * dialog skips the params step and jumps straight to confirm.
   */
  params?: BulkActionParam[];
  /** Confirmation text shown above the affected-record summary. */
  confirmText?: string;
  /** Custom Confirm button label (default: "Run"). */
  confirmLabel?: string;
  /**
   * Permission / feature gate predicate — hides the button when it evaluates
   * falsy. Accepts the spec's `ExpressionInput` shape (a bare CEL string, or
   * the `{ dialect, source }` envelope `objectstack build` emits) so a def
   * derived from an object action can forward `action.visible` untouched.
   */
  visible?: string | { dialect?: string; source: string };
  /**
   * Capability gate — the UI half of ADR-0066 D4's `requiredPermissions`
   * contract, carried here so the selection bar reaches the SAME verdict as the
   * other three action surfaces (list toolbar / record header / row kebab).
   *
   * Semantics are `ActionSchema.requiredPermissions` verbatim: an empty or
   * absent declaration always passes, several entries are AND-ed, and a host
   * that never published the caller's capabilities fails OPEN (the server is
   * the authority). Populated by `resolveBulkActions` when a def is promoted
   * from an object action, and honoured by `BulkActionBar` via
   * `useCapabilityGate` — without it, an action hidden in the row kebab
   * reappeared in the bulk bar the moment a row was selected (objectui#3492).
   */
  requiredPermissions?: string[];
  /** Max records the action will operate on; selection above this is blocked. */
  maxRecords?: number;
  /** Batch size for the executor loop (default: 200). */
  batchSize?: number;
  /**
   * How a `custom` def with {@link BulkActionDef.actionDef} dispatches over the
   * selection (objectui#3139).
   *
   * - `'perRecord'` (default, and the only pre-17.1 semantics): one runner
   *   dispatch per selected record, with the row attached as `_rowRecord`.
   * - `'aggregate'`: ONE dispatch for the entire selection. The executor
   *   injects `params._selectedIds: string[]` (every selected record id) and
   *   publishes the full records as `context.selectedRecords`, so the server
   *   can produce a single aggregate artifact (zip of QR codes, merged PDF,
   *   batch print job…). Result semantics are all-or-nothing: the one call
   *   covers the whole selection, so per-row retry is unavailable — a total
   *   failure keeps the selection for a whole-run re-run.
   *
   * Ignored for `operation: 'update' | 'delete'` (their bulk fast-path already
   * aggregates per batch) and for a `custom` def without `actionDef` (nothing
   * to dispatch). In aggregate mode `batchSize` does not apply — the whole
   * selection is one call; `maxRecords` still gates it.
   */
  execution?: 'perRecord' | 'aggregate';
  /**
   * Source object `ActionDef` when this entry was PROMOTED from a
   * `bulkActions: ['<name>']` entry resolved against `objectDef.actions`
   * (objectui#3002) — or attached by `resolveBulkActions` when an authored def
   * with `execution: 'aggregate'` names a declared object action (#3139).
   *
   * Presence of this key changes what `operation: 'custom'` means: instead of
   * a per-row no-op, the executor dispatches THIS action through the action
   * runner once per selected record, with the row attached as `_rowRecord` so
   * `recordIdParam` injection works exactly as it does for a `list_item` row
   * action — or once for the whole selection under `execution: 'aggregate'`.
   * Params and confirmation are collected once by the BulkActionDialog
   * and handed to the runner as values, so it never re-prompts per record.
   */
  actionDef?: Record<string, unknown>;
}

/**
 * Export formats a list view may offer (objectui#4535).
 *
 * `'pdf'` is NOT here: PDF export was declined platform-side
 * (objectstack#1301 NOT_PLANNED) and the value left the spec's format enum in
 * `@objectstack/spec` 17.0.0 (objectstack#8010), where declaring it is now a
 * parse-time refusal carrying a migration prescription. It was never
 * renderable on this side either — no ObjectUI export path has ever produced a
 * PDF, so a declared `'pdf'` only ever reached the user as a console line.
 * `'xlsx'` is delivered by the server stream alone; the client fallback path
 * produces `'csv'` and `'json'`.
 */
export type ListViewExportFormat = 'csv' | 'xlsx' | 'json';

/**
 * Export options for a list view — the object form of `exportOptions`.
 *
 * **This key set is the spec's, and it is exactly what `ObjectGrid` reads.**
 * It mirrors `ListViewExportOptionsSchema` in `@objectstack/spec` 17.0.0
 * (`packages/spec/src/ui/view.zod.ts`, added by objectstack#8010 /
 * objectstack#8324): `formats`, `maxRecords`, `includeHeaders`,
 * `fileNamePrefix`, `streaming`. Upstream derived those five keys FROM this
 * renderer's reads, so the two are one contract read from either end:
 *
 * - a sixth key declared here is capability surface with no reader — the
 *   compile-time key-set assertion in `objectql.exportOptions.test.ts` reds;
 * - a sixth key READ by `ObjectGrid` without being declared here recreates the
 *   undeclared-but-read defect objectstack#8010 closed — the source scan in
 *   `plugin-grid`'s `ObjectGrid.exportOptionsKeys.test.ts` reds.
 *
 * NOTE (objectui#4535): this restates the five keys rather than deriving them
 * from the spec symbol, because objectui still pins
 * `@objectstack/spec@17.0.0-rc.6`, whose `ListView.exportOptions` is the LEGACY
 * bare format array (`('csv' | 'xlsx' | 'json' | 'pdf')[]`) — the object form is
 * not importable from the pin yet. Deriving this type from the published spec
 * symbol becomes possible when the pin bumps; the shape below IS the new spec
 * shape, so nothing here changes when it does.
 */
export interface ListViewExportOptions {
  /**
   * Formats offered in the export menu (default: `['csv', 'json']`).
   * XLSX is delivered by the server stream only.
   */
  formats?: ListViewExportFormat[];
  /** Maximum number of records to export; 0 or absent = unlimited. */
  maxRecords?: number;
  /** Include column headers in the exported file (default true). */
  includeHeaders?: boolean;
  /**
   * Download file name prefix — replaces the object label and suppresses the
   * view label in the generated file name.
   */
  fileNamePrefix?: string;
  /**
   * Set false to force the client-side export path (csv/json only) instead of
   * the server stream.
   */
  streaming?: boolean;
}

/**
 * ObjectGrid Schema
 * A specialized grid component that automatically fetches and displays data from ObjectQL objects.
 * Implements the grid view type from @objectstack/spec view.zod ListView schema.
 * 
 * Features:
 * - Traditional table/grid with CRUD operations
 * - Search, filters, pagination
 * - Column resizing, sorting
 * - Row selection
 * - Inline editing support
 */
export interface ObjectGridSchema extends BaseSchema {
  type: 'object-grid';
  
  /**
   * Internal name for the view
   */
  name?: string;
  
  /**
   * Display label override
   */
  label?: string;
  
  /**
   * ObjectQL object name (e.g., 'users', 'accounts', 'contacts')
   * Used when data provider is 'object' or not specified
   */
  objectName: string;
  
  /**
   * Data Source Configuration
   * Aligned with @objectstack/spec ViewDataSchema
   * If not provided, defaults to { provider: 'object', object: objectName }
   */
  data?: ViewData;
  
  /**
   * Columns Configuration
   * Can be either:
   * - Array of field names (simple): ['name', 'email', 'status']
   * - Array of ListColumn objects (enhanced): [{ field: 'name', label: 'Full Name', width: 200 }]
   */
  columns?: string[] | ListColumn[];
  
  /**
   * Filter criteria (JSON Rules format)
   * Array-based filter configuration
   */
  filter?: any[];
  
  /**
   * Sort Configuration
   * Can be either:
   * - Legacy string format: "name desc"
   * - Array of sort configs: [{ field: 'name', order: 'desc' }]
   */
  sort?: string | SortConfig[];
  
  /**
   * Fields enabled for search
   * Defines which fields are searchable when using the search box
   */
  searchableFields?: string[];
  
  /**
   * Enable column resizing
   * Allows users to drag column borders to resize
   */
  resizable?: boolean;

  /**
   * Enable column reordering
   * Allows users to drag columns to reorder
   */
  reorderableColumns?: boolean;

  /**
   * Show column type icons (T / Tag / Calendar / Hash) in column headers.
   * Off by default — type is usually obvious from cell content; the icons
   * add visual noise that competes with column labels.
   * @default false
   */
  showColumnTypeIcons?: boolean;
  
  /**
   * Row Selection Configuration
   * Aligned with @objectstack/spec SelectionConfigSchema
   */
  selection?: SelectionConfig;
  
  /**
   * Pagination Configuration
   * Aligned with @objectstack/spec PaginationConfigSchema
   */
  pagination?: PaginationConfig;
  
  /**
   * Custom CSS class
   */
  className?: string;
  
  // ===== LEGACY FIELDS (for backward compatibility) =====
  // These fields are deprecated but maintained for backward compatibility
  // They will be mapped to the new structure internally
  
  /**
   * @deprecated Use columns instead
   * Legacy field names to display
   */
  fields?: string[];
  
  /**
   * @deprecated Use data with provider: 'value' instead
   * Legacy inline data support
   */
  staticData?: any[];
  
  /**
   * @deprecated Use selection.type instead
   * Legacy selection mode
   */
  selectable?: boolean | 'single' | 'multiple';
  
  /**
   * @deprecated Use pagination.pageSize instead
   * Legacy page size
   */
  pageSize?: number;
  
  /**
   * @deprecated Use searchableFields instead
   * Legacy search toggle
   */
  showSearch?: boolean;
  
  /**
   * @deprecated Use filter property instead
   * Legacy filters toggle
   */
  showFilters?: boolean;
  
  /**
   * @deprecated Use pagination config instead
   * Legacy pagination toggle
   */
  showPagination?: boolean;
  
  /**
   * @deprecated Use sort instead
   * Legacy sort configuration
   */
  defaultSort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  
  /**
   * @deprecated Use filter instead
   * Legacy default filters
   */
  defaultFilters?: Record<string, any>;
  
  /**
   * @deprecated Moved to top-level resizable
   * Legacy resizable columns flag
   */
  resizableColumns?: boolean;
  
  /**
   * @deprecated Use label instead
   * Legacy title field
   */
  title?: string;

  /**
   * @deprecated No direct replacement (consider using label with additional context)
   * Legacy description field
   */
  description?: string;
  
  /**
   * Enable/disable built-in operations
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   */
  operations?: {
    /**
     * Enable create operation
     * @default true
     */
    create?: boolean;
    
    /**
     * Enable read/view operation
     * @default true
     */
    read?: boolean;
    
    /**
     * Enable update operation
     * @default true
     */
    update?: boolean;
    
    /**
     * Enable delete operation
     * @default true
     */
    delete?: boolean;
    
    /**
     * Enable export operation
     * @default false
     */
    export?: boolean;
    
    /**
     * Enable import operation
     * @default false
     */
    import?: boolean;
  };
  
  /**
   * Custom row actions
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   */
  rowActions?: string[];
  
  /**
   * Custom batch actions
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec.
   * Legacy alias of `bulkActions` — prefer `bulkActions`. When both are
   * set, `batchActions` wins (preserved for backward compatibility).
   */
  batchActions?: string[];

  /**
   * Bulk action identifiers (action names from ActionSchema).
   * Aligned with @objectstack/spec ListViewSchema.bulkActions — the
   * canonical key; `batchActions` is the legacy ObjectUI alias.
   */
  bulkActions?: string[];
  
  /**
   * Enable inline cell editing (Grid mode)
   * When true, cells become editable on double-click or Enter key
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   * @default false
   */
  editable?: boolean;

  /**
   * Enable single-click editing mode
   * When true with editable, clicking a cell enters edit mode (instead of double-click)
   * @default false
   */
  singleClickEdit?: boolean;
  
  /**
   * Grouping Configuration (Airtable-style)
   * Groups rows by specified fields with collapsible sections.
   * Aligned with @objectstack/spec GroupingConfigSchema.
   */
  grouping?: GroupingConfig;

  /**
   * Per-group aggregations to display in group headers (e.g. SUM(amount) per region).
   * ObjectUI-specific (not in @objectstack/spec for ObjectGrid; sourced from the
   * Report protocol when ObjectGrid is rendered as a Summary report body).
   * @example [{ field: 'amount', type: 'sum' }, { field: 'id', type: 'count_distinct' }]
   */
  aggregations?: Array<{
    field: string;
    type: 'sum' | 'count' | 'avg' | 'min' | 'max' | 'count_distinct';
  }>;

  /**
   * Row Color Configuration (Airtable-style)
   * Colors rows based on field values.
   * Aligned with @objectstack/spec RowColorConfigSchema.
   */
  rowColor?: RowColorConfig;

  /**
   * Enable keyboard navigation (Grid mode)
   * Arrow keys, Tab, Enter for cell navigation
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   * @default true when editable is true
   */
  keyboardNavigation?: boolean;
  
  /**
   * Number of columns to freeze (left-pin)
   * Useful for keeping certain columns visible while scrolling
   * NOTE: This is ObjectUI-specific and not part of @objectstack/spec
   * @default 0
   */
  frozenColumns?: number;

  /**
   * Row height preset for the grid.
   * Controls the density of grid rows.
   * Aligned with @objectstack/spec RowHeight enum.
   * @default 'compact'
   */
  rowHeight?: 'compact' | 'short' | 'medium' | 'tall' | 'extra_tall';

  /**
   * Export options configuration for exporting grid data.
   * See {@link ListViewExportOptions} — the key set is the spec's, and the one
   * that `ObjectGrid` reads.
   */
  exportOptions?: ListViewExportOptions;

  /**
   * Navigation configuration for row click behavior.
   * Controls how record detail is displayed when a row is clicked.
   * Aligned with @objectstack/spec ListView.navigation.
   */
  navigation?: ViewNavigationConfig;

  /**
   * Callback for page-level navigation (used by 'page' mode).
   * Called with recordId and action ('view' | 'edit').
   */
  onNavigate?: (recordId: string | number, action?: string) => void;

  /**
   * Conditional formatting rules for row/cell styling.
   * Aligned with @objectstack/spec ListViewSchema.conditionalFormatting.
   * Supports both ObjectUI field/operator/value rules and Spec expression-based { condition, style } rules.
   */
  conditionalFormatting?: ConditionalFormattingRule[];

  /**
   * Row action identifiers (action names from ActionSchema).
   * Aligned with @objectstack/spec ListViewSchema.rowActions.
   */
  rowSpecActions?: string[];

  /**
   * Bulk action identifiers (action names from ActionSchema).
   * Aligned with @objectstack/spec ListViewSchema.bulkActions.
   */
  bulkSpecActions?: string[];

  /**
   * Rich bulk action definitions. When provided, takes precedence over
   * `bulkActions` / `bulkSpecActions` (string-id lists) by opening a
   * BulkActionDialog that collects params, confirms, and executes via
   * dataSource.bulk(...) with progress + result reporting.
   */
  bulkActionDefs?: BulkActionDef[];

  /**
   * Empty state configuration shown when no data is available.
   * Aligned with @objectstack/spec ListViewSchema.emptyState.
   */
  emptyState?: {
    /** Title text for the empty state */
    title?: string;
    /** Message/description for the empty state */
    message?: string;
    /** Icon name (Lucide icon identifier) */
    icon?: string;
  };
}

/**
 * Form Section Configuration
 * Aligns with @objectstack/spec FormSection
 */
export interface ObjectFormSection {
  /**
   * Section identifier
   */
  name?: string;
  
  /**
   * Section label
   */
  label?: string;
  
  /**
   * Section description
   */
  description?: string;
  
  /**
   * Whether the section can be collapsed
   * @default false
   */
  collapsible?: boolean;
  
  /**
   * Whether the section is initially collapsed
   * @default false
   */
  collapsed?: boolean;
  
  /**
   * Number of columns for field layout
   * @default 1
   */
  columns?: 1 | 2 | 3 | 4;

  /**
   * Which panel of a split form this section renders in. Aligns with
   * @objectstack/spec FormSection.pane (split forms only — the spec rejects the
   * key on other form types at parse). Explicit per-section placement, so
   * reordering sections never silently moves them across the divider.
   * Omitted → the legacy positional rule: first section 'primary', every
   * other section 'secondary'.
   */
  pane?: 'primary' | 'secondary';

  /**
   * Field names or inline field configurations for this section
   */
  fields: (string | FormField)[];

  /**
   * Custom CSS class for the section's wrapper (Card, when the form variant
   * renders sections as cards; the divider header, for the flat/simple path).
   */
  className?: string;

  /**
   * Custom CSS class for the section's field grid. Only used by form variants
   * that render sections as Card chrome (Modal/Split/Tabbed/Wizard).
   */
  gridClassName?: string;
}

/**
 * ObjectForm Schema
 * A smart form component that generates forms from ObjectQL object schemas.
 * It automatically creates form fields based on object metadata.
 * 
 * Supports multiple form variants aligned with @objectstack/spec FormView:
 * - `simple`  – Flat field list (default)
 * - `tabbed`  – Fields organized in tabs
 * - `wizard`  – Multi-step form with navigation
 * - `split`   – Side-by-side panels (reserved)
 * - `drawer`  – Slide-out form panel (reserved)
 * - `modal`   – Dialog-based form (reserved)
 */

/**
 * Declarative post-submit behavior — aligned with `@objectstack/spec`'s
 * `FormView.submitBehavior`. Lets metadata-only forms (which can't pass an
 * `onSuccess` function) declare what happens after a successful create/update.
 */
export type SubmitBehavior =
  | { kind: 'thank-you'; title?: string; message?: string }
  | { kind: 'redirect'; url: string; delayMs?: number }
  | { kind: 'continue' }
  | { kind: 'next-record' };

/**
 * Key taxonomy (#2545 — spec `FormViewSchema` alignment):
 *
 * - **[spec-aligned]** — same name & semantics as `@objectstack/spec`
 *   `FormViewSchema` (`title`, `description`, `layout`, `columns`, `sections`,
 *   `defaultTab`, `tabPosition`, `allowSkip`, `showStepIndicator`,
 *   `splitDirection`/`splitSize`/`splitResizable`, `drawerSide`/`drawerWidth`,
 *   `modalSize`, `subforms`, `submitBehavior`; `formType` ↔ spec `type`).
 * - **[ObjectUI extension]** — serializable renderer extras with no spec
 *   backing yet (button visibility/labels, `className`, `initialValues`,
 *   `fields`/`customFields`, …). Candidates for upstreaming are tracked in
 *   #2545; until then they are sanctioned, documented extensions.
 * - **[runtime-only]** — non-serializable runtime concerns that never belong
 *   in view metadata (`mode`, `recordId`, `open`, callbacks, …).
 */
export interface ObjectFormSchema extends BaseSchema {
  type: 'object-form';
  
  /**
   * Form variant type.
   * Aligns with @objectstack/spec FormView.type
   * 
   * - `simple`  – Standard flat form (default)
   * - `tabbed`  – Sections as tabs
   * - `wizard`  – Multi-step wizard with progress indicator
   * - `split`   – Side-by-side panel layout (reserved)
   * - `drawer`  – Slide-out form (reserved)
   * - `modal`   – Dialog form (reserved)
   *
   * @default 'simple'
   */
  formType?: 'simple' | 'tabbed' | 'wizard' | 'split' | 'drawer' | 'modal';
  
  /**
   * ObjectQL object name (e.g., 'users', 'accounts', 'contacts')
   */
  objectName: string;
  
  /**
   * Form mode
   */
  mode: 'create' | 'edit' | 'view';
  
  /**
   * Record ID (required for edit/view modes)
   */
  recordId?: string | number;
  
  /**
   * Optional title for the form
   */
  title?: string;
  
  /**
   * Optional description
   */
  description?: string;
  
  /**
   * Field names to include in the form
   * If not specified, uses all editable fields from object schema
   */
  fields?: string[];
  
  /**
   * Custom field configurations
   * Overrides auto-generated fields for specific fields.
   * When used with inline field definitions (without dataSource), this becomes the primary field source.
   */
  customFields?: FormField[];
  
  /**
   * Inline initial data for demo/static forms
   * When provided along with customFields (or inline field definitions), the form can work without a data source.
   * Useful for documentation examples and prototyping.
   */
  initialData?: Record<string, any>;
  
  /**
   * Form sections for organized layout.
   * Used by tabbed/wizard/simple forms to group fields.
   * Aligns with @objectstack/spec FormView.sections
   */
  sections?: ObjectFormSection[];
  
  /**
   * Field groups for organized layout.
   *
   * @deprecated Legacy alias of {@link sections} — `@objectstack/spec`
   * FormViewSchema defines `groups` as "Legacy support → alias to sections",
   * and the form renderer only consumes `sections`. Consumers (spec-bridge,
   * ObjectForm) normalize `groups` into `sections` when `sections` is absent;
   * new metadata should declare `sections` directly. Note the legacy shape
   * differs from {@link ObjectFormSection}: `title`→`label`,
   * `defaultCollapsed`→`collapsed`.
   */
  groups?: Array<{
    title?: string;
    description?: string;
    fields: string[];
    collapsible?: boolean;
    defaultCollapsed?: boolean;
  }>;
  
  /**
   * Form layout.
   *
   * Supported layouts:
   * - `vertical`   – label above field (default)
   * - `horizontal` – label and field in a row
   * - `inline`     – compact inline layout, typically used in toolbars
   * - `grid`       – **experimental** grid layout
   *
   * @default 'vertical'
   */
  layout?: 'vertical' | 'horizontal' | 'inline' | 'grid';
  
  /**
   * Grid columns (for grid layout).
   * @default 2
   */
  columns?: number;
  
  /**
   * Default active tab (section name). Only used when formType is 'tabbed'.
   */
  defaultTab?: string;
  
  /**
   * Tab position. Only used when formType is 'tabbed'.
   * @default 'top'
   */
  tabPosition?: 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * Allow skipping steps. Only used when formType is 'wizard'.
   * @default false
   */
  allowSkip?: boolean;
  
  /**
   * Show step indicator. Only used when formType is 'wizard'.
   * @default true
   */
  showStepIndicator?: boolean;
  
  /**
   * Text for Next button. Only used when formType is 'wizard'.
   * @default 'Next'
   */
  nextText?: string;
  
  /**
   * Text for Previous button. Only used when formType is 'wizard'.
   * @default 'Back'
   */
  prevText?: string;
  
  /**
   * Called when wizard step changes. Only used when formType is 'wizard'.
   */
  onStepChange?: (step: number) => void;
  
  /**
   * Show submit button
   * @default true
   */
  showSubmit?: boolean;
  
  /**
   * Submit button text
   */
  submitText?: string;

  /**
   * Declarative success toast text shown after a successful create/update when
   * no `onSuccess` function handler is supplied (metadata-only pages cannot
   * pass a function). Falls back to 'Created' / 'Saved'.
   */
  successMessage?: string;

  /**
   * Navigate here after a successful create/update (declarative; falls back to
   * a toast). Supports `{id}`/`{recordId}` interpolation from the saved record;
   * same-origin-guarded. Takes precedence over `successMessage`.
   */
  navigateOnSuccess?: string;

  /**
   * Reset the form after a successful create so the user can enter another.
   * Ignored when `navigateOnSuccess` or `submitBehavior` is set.
   */
  resetOnSuccess?: boolean;

  /**
   * Declarative post-submit behavior aligned with `@objectstack/spec`'s
   * `FormView.submitBehavior`. When present, takes precedence over
   * `successMessage` / `navigateOnSuccess` / `resetOnSuccess`.
   */
  submitBehavior?: SubmitBehavior;

  /**
   * Show cancel button
   * @default true
   */
  showCancel?: boolean;
  
  /**
   * Cancel button text
   */
  cancelText?: string;
  
  /**
   * Show reset button
   * @default false
   */
  showReset?: boolean;
  
  /**
   * Initial values (for create mode)
   *
   * @deprecated Prefer the spec-aligned {@link defaults}. Kept as back-compat:
   * ObjectForm folds `defaults` into this at render, and an explicitly-set
   * `initialValues` still wins.
   */
  initialValues?: Record<string, any>;

  /**
   * Structured, spec-aligned form action-button config — the authoring surface
   * for submit/cancel/reset visibility + labels, mirroring `@objectstack/spec`
   * `FormViewSchema.buttons` (framework#1894 / #2998). ObjectForm normalizes
   * this down onto the flat `showSubmit`/`submitText`/`showCancel`/`cancelText`/
   * `showReset` props at render, so prefer this over those flat keys (which
   * remain only as deprecated back-compat). An explicitly-set flat key wins.
   */
  buttons?: {
    submit?: { show?: boolean; label?: string };
    cancel?: { show?: boolean; label?: string };
    reset?: { show?: boolean; label?: string };
  };

  /**
   * Create-mode initial field values, keyed by field machine name — the
   * spec-aligned alias of the deprecated flat {@link initialValues}, mirroring
   * `@objectstack/spec` `FormViewSchema.defaults` (framework#1894 / #2998).
   * ObjectForm folds this into `initialValues` at render.
   */
  defaults?: Record<string, any>;

  /**
   * Callback on successful submission
   */
  onSuccess?: (data: any) => void | Promise<void>;

  /**
   * Override persistence. When supplied, the form validates and hands the
   * collected values to this handler INSTEAD of calling dataSource.create /
   * dataSource.update — the host owns the write (e.g. MasterDetailForm batching
   * the parent + child line items into one atomic server transaction). The
   * returned record is passed on to `onSuccess`.
   */
  submitHandler?: (values: Record<string, any>) => any | Promise<any>;

  /**
   * Inline child collections (master-detail). When present, the form renders as
   * a master-detail form: the object's own fields on top, then an editable grid
   * per child collection, persisted together in one atomic transaction. Each
   * entry needs only `childObject` — the relationship FK and grid columns are
   * derived from the child object's metadata (override with
   * `relationshipField` / `columns`). This lets a regular form view declare
   * master-detail without a bespoke page.
   */
  subforms?: Array<{
    childObject: string;
    relationshipField?: string;
    columns?: any[];
    amountField?: string;
    totalField?: string;
    title?: string;
    addLabel?: string;
    minRows?: number;
    maxRows?: number;
  }>;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
  
  /**
   * Callback on cancel
   */
  onCancel?: () => void;
  
  /**
   * Read-only mode
   * @default false
   */
  readOnly?: boolean;
  
  /**
   * Custom CSS class
   */
  className?: string;

  // ─── Split Form Props ──────────────────────────────────
  
  /**
   * Split panel direction. Only used when formType is 'split'.
   * @default 'horizontal'
   */
  splitDirection?: 'horizontal' | 'vertical';
  
  /**
   * Size of the left/top panel in the split layout (percentage 1-99).
   * Only used when formType is 'split'.
   * @default 50
   */
  splitSize?: number;
  
  /**
   * Whether the split panels can be resized. Only used when formType is 'split'.
   * @default true
   */
  splitResizable?: boolean;

  // ─── Drawer Form Props ─────────────────────────────────
  
  /**
   * Whether the drawer is open. Only used when formType is 'drawer'.
   * @default true
   */
  open?: boolean;
  
  /**
   * Callback when open state changes. Only used when formType is 'drawer'.
   */
  onOpenChange?: (open: boolean) => void;
  
  /**
   * Drawer slide-in side. Only used when formType is 'drawer'.
   * @default 'right'
   */
  drawerSide?: 'top' | 'bottom' | 'left' | 'right';
  
  /**
   * Drawer width (CSS value). Only used when formType is 'drawer'.
   * @default '50%'
   */
  drawerWidth?: string;

  // ─── Modal Form Props ──────────────────────────────────
  
  /**
   * Modal dialog size. Only used when formType is 'modal'.
   * @default 'default'
   */
  modalSize?: 'sm' | 'default' | 'lg' | 'xl' | 'full';
  
  /**
   * Whether to show a close button in the modal header. Only used when formType is 'modal'.
   * @default true
   */
  modalCloseButton?: boolean;

  // ─── Mobile UX (round 3) ────────────────────────────────

  /**
   * Mobile-specific form behavior. All options are opt-in; on desktop the
   * form renders unchanged. `auto` values activate only when the viewport
   * matches `(max-width: 767px)`.
   *
   * @example
   * ```ts
   * mobile: {
   *   stickyActions: true,        // pin Submit/Cancel to the bottom of the viewport
   *   stepper: 'auto',            // long forms render one field at a time on phones
   *   stepperMinFields: 8,        // … but only past this many fields
   *   fullscreenLongText: true,   // textarea/rich-text get an "expand" button
   * }
   * ```
   */
  mobile?: {
    /** Render Submit/Cancel as a sticky bottom action bar on mobile. */
    stickyActions?: boolean;
    /**
     * One-field-at-a-time stepper on small screens.
     * - `false` (default): never use the stepper.
     * - `true`: always use it on mobile.
     * - `'auto'`: only when the form has > `stepperMinFields` fields.
     */
    stepper?: boolean | 'auto';
    /** Threshold for `stepper: 'auto'`. @default 8 */
    stepperMinFields?: number;
    /** How many fields to show per step when stepper is active. @default 1 */
    stepperFieldsPerStep?: number;
    /** Show a fullscreen-edit affordance for textarea / rich-text fields. */
    fullscreenLongText?: boolean;
  };
}

/**
 * ObjectView Schema
 * A complete object management interface combining ObjectGrid and ObjectForm.
 * Provides list view with search, filters, and integrated create/edit dialogs.
 */
export interface ObjectViewSchema extends BaseSchema {
  type: 'object-view';
  
  /**
   * ObjectQL object name (e.g., 'users', 'accounts', 'contacts')
   */
  objectName: string;
  
  /**
   * Optional title for the view
   */
  title?: string;
  
  /**
   * Optional description
   */
  description?: string;
  
  /**
   * Layout mode for create/edit operations
   * - drawer: Side drawer (default, recommended for forms)
   * - modal: Center modal dialog
   * - page: Navigate to separate page (requires onNavigate handler)
   * @default 'drawer'
   */
  layout?: 'drawer' | 'modal' | 'page';
  
  /**
   * Default list view type
   * @default 'grid'
   */
  defaultViewType?: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';
  
  /**
   * Named list views (e.g., "All Records", "My Records", "Active").
   * Aligned with @objectstack/spec View.listViews.
   */
  listViews?: Record<string, NamedListView>;
  
  /**
   * Default named list view to display
   */
  defaultListView?: string;
  
  /**
   * Navigation config for row/item click behavior.
   * Aligned with @objectstack/spec ListView.navigation.
   */
  navigation?: ViewNavigationConfig;
  
  /**
   * Table/Grid configuration
   * Inherits from ObjectGridSchema
   */
  table?: Partial<Omit<ObjectGridSchema, 'type' | 'objectName'>>;
  
  /**
   * Form configuration
   * Inherits from ObjectFormSchema
   */
  form?: Partial<Omit<ObjectFormSchema, 'type' | 'objectName' | 'mode'>>;
  
  /**
   * Fields that support text search
   */
  searchableFields?: string[];
  
  /**
   * Fields available for the filter UI
   */
  filterableFields?: string[];
  
  /**
   * Show search box
   * @default true
   */
  showSearch?: boolean;
  
  /**
   * Show filters
   * @default true
   */
  showFilters?: boolean;
  
  /**
   * Show sort controls
   * @default true
   */
  showSort?: boolean;
  
  /**
   * Show create button
   * @default true
   */
  showCreate?: boolean;
  
  /**
   * Show refresh button
   * @default true
   */
  showRefresh?: boolean;
  
  /**
   * Show view switcher (for multi-view)
   * When false (default), view type is fixed at creation in ViewConfigPanel
   * @default false
   */
  showViewSwitcher?: boolean;
  
  /**
   * Enable/disable built-in operations
   */
  operations?: {
    create?: boolean;
    read?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  
  /**
   * Callback when navigating to detail page (page layout mode)
   */
  onNavigate?: (recordId: string | number, mode: 'view' | 'edit') => void;
  
  /**
   * Custom CSS class
   */
  className?: string;

  /**
   * View tab bar UX configuration (inline add, context menu, overflow, indicators).
   */
  viewTabBar?: ViewTabBarConfig;

  /**
   * Show "+" button in ViewSwitcher to create a new view.
   * Typically gated on admin permission.
   */
  allowCreateView?: boolean;

  /**
   * Per-view action icons shown in ViewSwitcher (e.g., share, settings, duplicate, delete).
   */
  viewActions?: Array<{
    type: 'share' | 'settings' | 'duplicate' | 'delete';
    icon?: string;
  }>;
}

/**
 * View Tab Bar Configuration
 * Controls the UX of the view tab bar (inline add, context menu, overflow, indicators).
 */
export interface ViewTabBarConfig {
  /** Show inline "+" button to create new views @default true */
  showAddButton?: boolean;
  /** Allow inline renaming by double-clicking tab @default true */
  inlineRename?: boolean;
  /** Show context menu on right-click @default true */
  contextMenu?: boolean;
  /** Allow drag-reorder of view tabs @default false */
  reorderable?: boolean;
  /** Max visible tabs before overflow → "More" dropdown @default 6 */
  maxVisibleTabs?: number;
  /** Show filter/sort indicator badges on tabs @default true */
  showIndicators?: boolean;
  /** Show "Save as View" when filters differ from saved @default true */
  showSaveAsView?: boolean;
  /** Show pinned views section @default true */
  showPinnedSection?: boolean;
  /** Group tabs by personal/shared @default false */
  showVisibilityGroups?: boolean;
}

/**
 * Named List View Definition
 * Used in ObjectViewSchema.listViews for named views (e.g., "All", "My Records").
 */
export interface NamedListView {
  /** View display label */
  label: string;
  
  /** View type (grid, kanban, etc.) */
  type?: 'grid' | 'kanban' | 'gallery' | 'calendar' | 'timeline' | 'gantt' | 'map';
  
  /** Columns/fields to display */
  columns?: string[];
  
  /** Filter conditions */
  filter?: any[];
  
  /** Sort configuration */
  sort?: Array<{ field: string; order: 'asc' | 'desc' }>;
  
  /** Type-specific options (kanban groupField, calendar startDateField, etc.) */
  options?: Record<string, any>;

  /** Show search box in toolbar @default true */
  showSearch?: boolean;

  /** Show sort controls in toolbar @default true */
  showSort?: boolean;

  /** Show filter controls in toolbar @default true */
  showFilters?: boolean;

  /** Show hide-fields button in toolbar @default false */
  showHideFields?: boolean;

  /** Show group button in toolbar @default true */
  showGroup?: boolean;

  /** Show color button in toolbar @default false */
  showColor?: boolean;

  /** Show density/row-height button in toolbar @default false */
  showDensity?: boolean;

  /**
   * Collapse the appearance/grouping cluster (Group + Color + Density + Hide Fields)
   * into a single "View settings" popover button. Reduces toolbar clutter on
   * data-heavy lists. Filter / Sort / Export remain top-level chips.
   * @default false
   */
  compactToolbar?: boolean;

  /** Allow data export @default undefined */
  allowExport?: boolean;

  /** Color field for row/card coloring */
  color?: string;

  /** Enable inline editing @default false */
  inlineEdit?: boolean;

  /** Wrap column headers in grid view @default false */
  wrapHeaders?: boolean;

  /** Navigate to record detail view when row is clicked @default true */
  clickIntoRecordDetails?: boolean;

  /** Add records via a form dialog @default false */
  addRecordViaForm?: boolean;

  /** Enable inline add/delete of records @default false */
  addDeleteRecordsInline?: boolean;

  /** Collapse all grouped sections by default @default false */
  collapseAllByDefault?: boolean;

  /** Field name for custom text color */
  fieldTextColor?: string;

  /** Prefix field displayed before the main title */
  prefixField?: string;

  /** View description */
  description?: string;

  /** Show field descriptions below headers @default false */
  showDescription?: boolean;

  /** Navigation configuration for row click behavior */
  navigation?: ViewNavigationConfig;

  /** Row selection mode */
  selection?: SelectionConfig;

  /** Pagination configuration */
  pagination?: PaginationConfig;

  /** Fields that support text search */
  searchableFields?: string[];

  /** Fields available for filter UI */
  filterableFields?: string[];

  /** Allow column resizing @default false */
  resizable?: boolean;

  /** Density mode for controlling row/item spacing */
  densityMode?: 'compact' | 'comfortable' | 'spacious';

  /**
   * Row height for list/grid view rows.
   * Aligned with @objectstack/spec RowHeight enum.
   */
  rowHeight?: 'compact' | 'short' | 'medium' | 'tall' | 'extra_tall';

  /** Fields to hide from the current view */
  hiddenFields?: string[];

  /**
   * Export options configuration — the same object form the grid reads, so a
   * saved view and a directly-authored grid cannot declare different export
   * surfaces (objectui#4535). See {@link ListViewExportOptions}.
   */
  exportOptions?: ListViewExportOptions;

  /** Row action identifiers */
  rowActions?: string[];

  /** Bulk action identifiers */
  bulkActions?: string[];

  /** Rich bulk action definitions — see BulkActionDef. */
  bulkActionDefs?: BulkActionDef[];

  /** View sharing configuration */
  sharing?: {
    visibility?: 'private' | 'team' | 'organization' | 'public';
    enabled?: boolean;
  };

  /** Add record configuration */
  addRecord?: {
    enabled?: boolean;
    position?: string;
    mode?: string;
    formView?: string;
  };

  /** Conditional formatting rules.
   * Supports both ObjectUI field/operator/value rules and Spec expression-based { condition, style } rules. */
  conditionalFormatting?: ConditionalFormattingRule[];

  /**
   * User Filters Configuration (Airtable Interfaces-style).
   * Reuses the ListViewSchema.userFilters type to keep both definitions in parity.
   *
   * Supports three display modes configured by `element`:
   * - 'dropdown': Each field renders as a dropdown selector badge
   * - 'tabs': Named filter presets rendered as a tab bar
   */
  userFilters?: ListViewSchema['userFilters'];

  /** Show total record count @default false */
  showRecordCount?: boolean;

  /** Allow printing the view @default false */
  allowPrinting?: boolean;

  /** Empty state configuration */
  emptyState?: {
    title?: string;
    message?: string;
    icon?: string;
  };

  /** ARIA attributes for accessibility */
  aria?: {
    label?: string;
    describedBy?: string;
    live?: 'polite' | 'assertive' | 'off';
  };
}

/**
 * Navigation configuration for row/item click behavior — the spec's
 * `NavigationConfig`, under this package's older local name.
 *
 * This used to be a hand-written interface mirroring the spec's six keys, and
 * it had drifted on exactly one of them: it required `mode`, under a doc
 * comment that itself said `@default 'page'` (objectui#4588). The spec declares
 * `mode: NavigationModeSchema.default('page')`
 * (`@objectstack/spec` `ui/view.zod.ts` `NavigationConfigSchema`), and a
 * `.default()` lands on the AUTHORING side as `| undefined` — which is why the
 * spec publishes its own type as `z.input< typeof NavigationConfigSchema >`.
 * So `navigation: { view: 'summary_view' }` is legal authored metadata that
 * lets the mode default, and the hand copy refused it.
 *
 * `index.ts` already re-exports that same spec type under its own name
 * (`NavigationConfig`), so this package published two disagreeing spellings of
 * one spec object. They are one type now. Per this file's rule above —
 * "Never Redefine Types. ALWAYS import them." — the per-key documentation lives
 * with the schema in the spec rather than being restated here, so there is no
 * third place to keep the `'page'` default in sync.
 *
 * objectui#4550 / PR objectui#4586 made the same collapse for
 * `@object-ui/react`'s `NavigationConfig`.
 */
export type ViewNavigationConfig = NavigationConfig;

/**
 * ListView component node — DERIVED from the zod `ListViewSchema` (issue #2231), which
 * itself derives from `@objectstack/spec/ui` `ListViewSchema`. Spec-owned fields are
 * imported by the schema rather than re-typed here, so this type can no longer drift from
 * the protocol. The former hand-written interface (~470 lines mirroring the spec by hand)
 * is replaced by this alias. Non-serializable runtime-only props (callbacks, refresh
 * trigger) are intersected in via {@link ListViewRuntimeProps} — they cannot live in the
 * zod/JSON-schema.
 *
 * Legacy objectui vocabulary (`viewType`/`fields`/`filters`/`show*`/`densityMode`/…) and
 * the broader-than-spec configs (`userFilters`/`sharing`/`aria`/`conditionalFormatting`/
 * `exportOptions`/`kanban`/`calendar`/`gantt`/`gallery`/`timeline`) remain as sanctioned
 * local `.extend()`s on the schema; migration to the spec-canonical keys is deferred (#2231).
 */
export type ListViewSchema = ListViewInferred & ListViewRuntimeProps;

/**
 * Non-serializable runtime-only props for the ListView component. These never belong in
 * the zod schema — functions and imperative refresh triggers are not serialisable view
 * metadata — so they are kept separate and intersected into {@link ListViewSchema}.
 */
export interface ListViewRuntimeProps {
  /**
   * Callback for page-level navigation (used by 'page' navigation mode).
   * Called with recordId and action ('view' | 'edit').
   */
  onNavigate?: (recordId: string | number, action?: string) => void;

  /**
   * Callback fired when the user toggles row density/height via the toolbar. Lets the host
   * persist the choice (e.g. dataSource.updateViewConfig). Without it the toggle is local-only.
   */
  onDensityChange?: (mode: 'compact' | 'comfortable' | 'spacious') => void;

  /**
   * External refresh trigger. Increment this value to force the ListView to re-fetch data.
   * Used by parent components (e.g. ObjectView) to signal that a mutation occurred.
   */
  refreshTrigger?: number;
}

export interface ObjectMapSchema extends BaseSchema {
  type: 'object-map';
  /** ObjectQL object name */
  objectName: string;
  /** Field containing location data (or lat/long pair) */
  locationField?: string;
  /** Field for marker title */
  titleField?: string;
  /**
   * MapLibre style URL/spec. Overrides the default demo style
   * (`https://demotiles.maplibre.org/style.json`), which is a public demo
   * server unsuited for production use. Named `mapStyle` (not `style`) to
   * avoid colliding with `BaseSchema.style` (inline CSS properties).
   */
  mapStyle?: string;
}

/**
 * Object Tree (tree-grid) Component Schema
 *
 * Renders a self-referencing object as an indented, expand/collapse tree-grid.
 * Flat records are nested via a single-parent pointer field (`parentField`).
 */
export interface ObjectTreeSchema extends BaseSchema {
  type: 'object-tree';
  /** ObjectQL object name */
  objectName: string;
  /**
   * Field holding the parent record reference (single-parent pointer).
   * When omitted, the renderer auto-detects the object's `tree`/self-reference field.
   */
  parentField?: string;
  /** Field rendered (indented) in the tree's first column. Defaults to `name`. */
  labelField?: string;
  /** Additional fields rendered as flat columns alongside the label. */
  fields?: string[];
  /**
   * Default expansion depth (0 = roots only). When omitted, all nodes expand.
   */
  defaultExpandedDepth?: number;
}

/**
 * Object Gantt Component Schema
 */
export interface ObjectGanttSchema extends BaseSchema {
  type: 'object-gantt';
  /** ObjectQL object name */
  objectName: string;
  /** Field for task start date */
  startDateField?: string;
  /** Field for task end date */
  endDateField?: string;
  /** Field for task title/name */
  titleField?: string;
  /** Field for task dependencies */
  dependencyField?: string;
  /** Field for progress (0-100) */
  progressField?: string;
}

/**
 * Object Calendar Component Schema
 */
export interface ObjectCalendarSchema extends BaseSchema {
  type: 'object-calendar';
  /** ObjectQL object name */
  objectName: string;
  /** Field for event start */
  startDateField?: string;
  /** Field for event end */
  endDateField?: string;
  /** Field for event title */
  titleField?: string;
  /** Default view mode */
  defaultView?: 'month' | 'week' | 'day' | 'agenda';
}

/**
 * Object Kanban Component Schema
 */
export interface ObjectKanbanSchema extends BaseSchema {
  type: 'object-kanban';
  /** ObjectQL object name */
  objectName: string;
  /** Field to group columns by (e.g. status) */
  groupField: string;
  /** Field for card title */
  titleField?: string;
  /** Fields to display on card */
  cardFields?: string[];

  /**
   * Enable Quick Add button at the bottom of each column.
   * When true, a "+" button appears allowing inline card creation.
   * @default false
   */
  quickAdd?: boolean;

  /**
   * Field name to use as cover image on cards.
   * The field value should be a URL string or file object with a `url` property.
   */
  coverImageField?: string;

  /**
   * Allow columns to be collapsed/expanded.
   * Collapsed columns show only the title and card count.
   * @default false
   */
  allowCollapse?: boolean;

  /**
   * Conditional formatting rules for card coloring.
   * Cards are colored based on field values matching conditions.
   */
  conditionalFormatting?: KanbanConditionalFormattingRule[];
}

/**
 * Native (field/operator/value) conditional formatting rule for Kanban cards.
 */
export interface KanbanNativeConditionalFormattingRule {
  /** Field name to check */
  field: string;
  /** Operator for comparison */
  operator: 'equals' | 'not_equals' | 'contains' | 'in';
  /** Value to compare against */
  value: string | string[];
  /** Background color to apply (Tailwind class or CSS color) */
  backgroundColor?: string;
  /** Border color to apply (Tailwind class or CSS color) */
  borderColor?: string;
}

/**
 * Conditional formatting rule for Kanban cards.
 *
 * Since #1584, kanban card styling runs on the shared CEL evaluator, so a rule
 * accepts BOTH the native `{ field, operator, value }` shape and the spec
 * `{ condition, style }` shape (a CEL predicate + style map) — the same
 * `record.*` predicates authors use on list/grid rows.
 */
export type KanbanConditionalFormattingRule =
  | KanbanNativeConditionalFormattingRule
  | SpecConditionalFormattingRule;

/**
 * Object Chart Component Schema
 */
export interface ObjectChartSchema extends BaseSchema {
  type: 'object-chart';
  /** ObjectQL object name (legacy inline path; optional under ADR-0021 dataset binding) */
  objectName?: string;
  /** Chart type. Includes donut / horizontal-bar / column — all rendered by
   *  AdvancedChartImpl (previously only reachable by passing an untyped string). */
  chartType: 'bar' | 'column' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter';
  /** Field for X axis (categories) — legacy inline path */
  xAxisField?: string;
  /** Fields for Y axis (values) — legacy */
  yAxisFields?: string[];
  /** Aggregation function — legacy */
  aggregation?: 'cardinality' | 'sum' | 'avg' | 'min' | 'max';
  /** Semantic-layer dataset name (ADR-0021, #1890) */
  dataset?: string;
  /** Dataset dimension names */
  dimensions?: string[];
  /** Dataset measure names */
  values?: string[];
}

/**
 * Union type of all ObjectQL component schemas
 */
export type ObjectQLComponentSchema =
  | ObjectGridSchema
  | ObjectFormSchema
  | ObjectViewSchema
  | ObjectMapSchema
  | ObjectTreeSchema
  | ObjectGanttSchema
  | ObjectCalendarSchema
  | ObjectKanbanSchema
  | ObjectChartSchema
  | ListViewSchema;
