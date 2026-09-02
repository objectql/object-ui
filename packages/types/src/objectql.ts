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

import type { BaseSchema } from './base.js';
import type { DrillDownConfig } from './data-display.js';
import type { BulkActionOperation } from '@objectstack/spec/ui';
import type { FormField } from './form.js';
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
  // ── objectui's own extensions, lifted out of `plugin-gantt` (objectui#6051) ──
  //
  // The nine members below were declared ONLY in `plugin-gantt`'s package-private
  // `GanttConfigEx` intersection — the type `getGanttConfig` casts the `gantt`
  // block to. `ObjectGantt` honours every one of them on BOTH authoring faces
  // (the `gantt: { … }` block AND the flattened top-level spelling declared on
  // `ObjectGanttSchema`), and a type that lives inside the plugin can be
  // referenced by neither declaration — so the vocabulary is lifted here rather
  // than restated, and the two faces derive from ONE source that cannot fork.
  //
  // Like `timeSegments` above, each is legal metadata rather than a second
  // dialect: `GanttConfigSchema` is `$loose` upstream, so a key the spec does not
  // model passes its parse instead of being rejected.
  /**
   * Record field marking a node as view-only (truthy → locked). A locked
   * row's bar can't be dragged/resized, its progress can't be dragged, no
   * dependency can be drawn from it, and its inline-edit / context-menu
   * edit+delete are hidden — but clicking it (open drawer / jump) still works.
   * Independent of the global `readOnly`; use to freeze individual levels (e.g.
   * work orders) while siblings stay editable. Maps to `GanttTask.locked`.
   */
  lockField?: string;
  /**
   * Record field carrying the row's OBJECT API NAME. Mixed-object
   * trees (an `api` provider composing parent-object rows with child-object rows)
   * need the detail drawer and its full-page link to follow each row's REAL
   * object — otherwise a child row's `→` link builds a URL under the view's bound
   * object and 404s. Empty/missing value → falls back to the bound object.
   */
  objectField?: string;
  /**
   * How a summary bar's span is computed. `'children'` (default)
   * rolls the bar up from its children — min start / max end / duration-weighted
   * progress — and IGNORES the record's own dates. `'self'` renders the bar from
   * the record's OWN start/end/progress, falling back to rollup
   * only for records without dates (e.g. pure grouping levels). Use `'self'`
   * when the parent's schedule is authoritative — e.g. a shift plan whose
   * work-order children are locked history: under rollup, dragging the plan
   * persists its own dates but the bar snaps back to the children's extent on
   * refetch.
   */
  summaryExtent?: 'children' | 'self';
  /**
   * Auto-collapse tree nodes at/below this 0-indexed depth on first render.
   * Roots are depth 0. Every node at depth `>= defaultCollapsedDepth`
   * with children starts folded; the user can still expand them. Example: a
   * project→product→production-plan→work-order tree uses
   * `defaultCollapsedDepth: 2` so every production plan (and its work orders)
   * starts collapsed. Forwarded to `GanttView`.
   */
  defaultCollapsedDepth?: number;
  /**
   * Record field carrying a per-task alert stroke color: any CSS color or
   * semantic palette name (red/orange/…). When present the bar keeps its fill
   * but gets an outline + halo in that color — e.g. red for overdue, orange for
   * due-soon — typically a server-computed alert field. Empty/null → no stroke.
   * Maps to `GanttTask.borderColor`.
   */
  borderColorField?: string;
  /**
   * Whether the backing store persists dependency link TYPES (fs/ss/ff/sf).
   * Default true. Set false when dependencies are bare predecessor ids
   * (predecessor ids only) — the link menu hides the type switcher (a switch would be
   * silently reverted on refetch) and drag-created links are always FS.
   * Forwarded to `GanttView`.
   */
  dependencyTypes?: boolean;
  /**
   * Business time zone, IANA name like 'Asia/Shanghai'. Renders the
   * chart's calendar — shift bands, day columns, snapping, today line, date
   * labels — in this zone's wall time for every viewer, instead of the
   * browser's zone (which misplaces shift bands for viewers elsewhere). Persisted
   * data stays real instants. Forwarded to `GanttView`.
   */
  timeZone?: string;
  /**
   * Base name for exported PNG/PDF files, e.g. the view's display
   * label — the host's view schema often reaches this component stripped of
   * `label`, so views declare it here. Falls back to the object schema label,
   * then the object API name. A timestamp suffix is always appended.
   */
  exportFileName?: string;
  /**
   * Per-interaction switches: `move` / `resize` / `progress` / `link`,
   * each defaulting to true. Metadata-drivable so a view can e.g. allow bar
   * moves but pin durations (`{ resize: false }`) or keep the dependency UI
   * read-only (`{ link: false }`). They only narrow what `readOnly` / row locks
   * already allow. Forwarded to `GanttView`.
   */
  interactions?: {
    /** Bar / subtree dragging (move along the timeline). */
    move?: boolean;
    /** Edge resize grips (change duration). */
    resize?: boolean;
    /** The progress drag handle. */
    progress?: boolean;
    /** Dependency UI: drag-to-link dots AND the create/delete menu entries. */
    link?: boolean;
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
 * from the spec symbol, and the reason is no longer the pin. objectui now
 * installs `@objectstack/spec@17.2.0`, which DOES carry the object form — the
 * bare format array lifts to `{ formats: [...] }` at parse and `'pdf'` is gone
 * from the enum. What is missing is the SYMBOL: `ListViewExportOptionsSchema`
 * is internal to the spec bundle and not among the package's public exports, so
 * there is nothing to import. Only the enclosing `ListViewSchema` is exported,
 * and its `exportOptions` is the two-branch union (legacy-array lift ∪ object),
 * whose `z.infer` is a union — not this interface.
 *
 * So the mirror is restated but not unchecked: `export-options-spec-parity.test.ts`
 * reads the object branch out of the INSTALLED spec at test time and asserts
 * this key set, the format enum and the strictness against it. Prose claiming
 * alignment is what went false last time; that test is what makes the claim
 * falsifiable. When upstream exports the symbol, derive from it and delete the
 * restatement — the shape below is already the spec's, so nothing else moves.
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
   * Legacy title field — the caption/export-file-title fallback. `ObjectGrid.tsx`
   * reads it at exactly two sites, `viewLabel: schema.label || schema.title` and
   * `caption: schema.label || schema.title`, only when `label` is absent.
   *
   * Kept DECLARED — not retired — by objectui#6639's census-directed maintainer
   * ruling (2026-08-29, declare branch): authored `object-grid.title` nodes exist
   * (both confirmed hits are in `content/docs/api/schema-reference.md`'s
   * examples), so dropping the read would silently cost those nodes their
   * caption. Mirrored in `zod/objectql.zod.ts` and paired off the
   * `UnmirroredDeclared` ledger in `__tests__/zod-mirror-parity.test.ts` by the
   * same card — the #6424 family form.
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
   *
   * PROGRAMMATIC ONLY — not authoring surface. Deliberately absent from
   * `GRID_QUERY_INPUTS` (`@object-ui/plugin-grid`'s `index.tsx`), so the
   * manifest, the designer panel and the generated `sdui-intrinsics.d.ts` do
   * not offer it; maintainer ruling of 2026-08-19 on objectui#5234.
   *
   * The reason is the value, not the declaration: this is a FUNCTION VALUE and
   * a schema is a SERIALISABLE DOCUMENT. `(recordId, action) => void` cannot
   * survive a metadata round-trip whatever declares it, so no author writing
   * JSON or YAML — and no AI emitting a schema document — can express this
   * key. Writing it into a stored document does nothing at all.
   *
   * Programmatic callers should prefer `ObjectGridComponentProps`
   * (`@object-ui/plugin-grid`), where the nine sibling callbacks —
   * `onRowClick`, `onRowSelect`, `onCellChange`, `onRowSave`, `onBatchSave`,
   * `onEdit`, `onDelete`, `onBulkDelete`, `onAddRecord` — live and only live,
   * for exactly this reason.
   *
   * The declaration is kept rather than removed: with the key explicitly
   * published, removing it is a breaking public type change plus a deprecation
   * cycle, for zero measured harm. The exemption comment at the read site
   * (`plugin-grid/src/ObjectGrid.tsx`) carries the same statement, and both are
   * pinned by `plugin-grid/src/__tests__/gridNonAuthorKeys.test.tsx`.
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
   *
   * Wizard boundary (objectstack#13622 D2, ruled 2026-08-31): wizard steps do
   * not collapse — the wizard shows exactly the current step. On a
   * `formType: 'wizard'` form the renderer drops this key (ObjectForm's
   * wizard map rebuilds each step key by key and does not copy it), and
   * `@objectstack/spec` refuses an authored `true` on a wizard step at parse.
   * An authored `false` stays accepted everywhere: it declares exactly the
   * behavior a wizard delivers.
   * @default false
   */
  collapsible?: boolean;

  /**
   * Whether the section is initially collapsed
   *
   * Same wizard boundary as {@link collapsible}: dropped by the wizard route,
   * and `true` is refused on a wizard step at the spec door.
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
   * Conditional visibility for the SECTION HEADER, as an authored predicate.
   * Aligns with @objectstack/spec FormSection.visibleWhen (ADR-0089) — the same
   * canonical `@object-ui/core` engine and record scope every other
   * `visibleWhen` surface uses, so one authored predicate text means one thing
   * everywhere (#6010). A broken predicate fails OPEN (the header renders).
   *
   * Scope: this gates the WHOLE section (objectui#6236, maintainer ruling
   * 2026-08-27). The plugin-form layouts stamp the membership claim
   * (`FormField.fields`, the FormFieldTab shape) onto the `section-divider`
   * row they synthesize, and the renderer then hides heading and claimed
   * fields together on a FALSE predicate — matching the console renderer
   * (`apps/console/src/components/FormPage.tsx`), which drops the whole
   * section element. Hidden fields skip client-side validation (a user is
   * never blocked by an error pointing at a control they cannot see) and
   * their values still submit — visibility decides what is DRAWN and nothing
   * else (the console precedent, 2026-08-22 after #5594). Derived
   * `fieldGroups` sections carry no predicate slot, so their groups are
   * always drawn.
   *
   * Wizard boundary (objectstack#13622 D2, ruled 2026-08-31): wizard steps
   * carry NO predicate slot — steps are entered in array order behind the
   * step gate, never conditionally. On a `formType: 'wizard'` form the
   * renderer drops this key (and reports the drop via console.warn — see
   * `sectionPredicateUnsupportedWarning` in @object-ui/plugin-form), the
   * wizard's own step type (`WizardStepConfig`) rejects it at compile time
   * (objectui#6237's ruled split), and `@objectstack/spec` refuses it on a
   * wizard step at parse. Put the predicate on the fields inside the step —
   * field-level `visibleWhen` is evaluated on every layout. A step-level
   * predicate is a future contract of its own, tracked in objectui#6237.
   */
  visibleWhen?: string | { dialect?: string; source: string };

  // `className` / `gridClassName` are deliberately NOT declared here
  // (objectui#7200 — the declared-but-inert remainder of objectstack#13626,
  // maintainer ruling 2026-09-01: "retire the reads … Declaring the keys was
  // weighed and not adopted: it would formally invite free Tailwind strings
  // into authored metadata, the exact class the boundary exists to keep out").
  // This is the AUTHORED-metadata section type; `@objectstack/spec`'s
  // `FormSectionSchema` is a strictObject with neither key, and the renderer
  // reads neither off an authored section. An annotated literal carrying one
  // now fails at the authoring site instead of type-checking into a no-op.
  //
  // The per-layout config types in @object-ui/plugin-form
  // (`ModalFormSectionConfig`, `SplitFormSectionConfig`, TabbedForm's
  // `FormSectionConfig`, `WizardStepConfig`, `DrawerFormSectionConfig`) keep
  // their own members: those are read for programmatic React mounts, which the
  // authorable boundary does not govern. Pinned at the type level in
  // `__tests__/object-form-section-style-keys-undeclared.test.ts`; the
  // behavioural half (an authored string never reaches the DOM) stays in
  // plugin-form's `__tests__/sectionStyleKeysRetired-13626.test.tsx`.
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
   *
   * Wizard semantics (objectstack#13622, ruled 2026-08-31): on a
   * `formType: 'wizard'` form the sections ARE the steps — there is no
   * `steps` key — and array order is step order (no `order` key; reordering
   * the array reorders the wizard). A wizard with absent or empty `sections`
   * is refused by `@objectstack/spec` at parse for authored form views; this
   * renderer's own fallback for that shape (rendering as a plain simple
   * form) is only reachable by programmatic SDUI callers, which do not pass
   * the spec door.
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
   *
   * This is navigation freedom, NOT a validation exemption (objectstack#13622
   * D4, ruled 2026-08-31): the default (absent/`false`) is the step gate —
   * the next step opens only after the current step's form submits and
   * validates — and `true` merely lets the user enter any step. Either way
   * the final submit re-checks every step's declared field set and returns
   * the user to the first step with an outstanding required field.
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
   * a toast). Takes precedence over `successMessage`.
   *
   * The value is a RELATIVE path only — an absolute URL is refused even when it
   * is same-origin — and it supports `{id}`/`{recordId}` interpolation from the
   * saved record, URL-escaped when the destination is built. A refused
   * destination is reported on the success toast rather than silently dropped.
   *
   * @deprecated Write `submitBehavior` instead — it is the one ruled shape for
   * post-submit behaviour, it already takes precedence over this key, and it
   * carries the richer `{{record.field_name}}` interpolation. This key keeps
   * working for forms that already declare it (maintainer ruling, 2026-08-17,
   * objectui#5034).
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
 * The `ObjectGridSchema` keys a view's `table` slot may carry: every member
 * `ObjectGridSchema` declares, minus the identity keys the view itself fixes
 * (`type`, `objectName`). 59 keys.
 *
 * ⚠️ This is an explicit list, and NOT `Omit<ObjectGridSchema, 'type' | 'objectName'>`,
 * because `Omit` collapses here (objectui#6269). `Omit<T, K>` is
 * `Pick<T, Exclude<keyof T, K>>`, and `keyof T` on a type carrying a string
 * index signature is `string | number` — the literal member names are ABSORBED.
 * `ObjectGridSchema` inherits `BaseSchema`'s `[key: string]: any`
 * (objectui#5155), so the `Omit` rebuilt a type holding the index signature and
 * NONE of the 61 named members: measured through the checker,
 * `Omit<ObjectGridSchema, 'type' | 'objectName'>` declared 0 properties. The
 * slot accepted anything (`table: { colunms: 3 }` type-checked), offered no
 * editor completion, and the doc comment promised an inheritance it did not
 * deliver. `Pick` with LITERAL keys never computes `keyof T`, so it cannot
 * collapse the same way.
 *
 * 🔒 The duplicate-list hazard — a member added to `ObjectGridSchema` and not to
 * this list — is pinned by
 * `src/__tests__/object-view-slot-key-lists.test.ts`, which recomputes the
 * source schema's declared members through the TypeScript checker and requires
 * set equality with this list.
 *
 * 🗑️ When a #5155 phase removes `BaseSchema`'s root index signature, `Omit`
 * stops collapsing: this list, `ObjectFormSlotKey` below, and their pin all
 * become removable in favour of the original `Omit` form.
 */
type ObjectGridSlotKey =
  | 'aggregations'
  | 'ariaLabel'
  | 'batchActions'
  | 'bind'
  | 'body'
  | 'bulkActionDefs'
  | 'bulkActions'
  | 'bulkSpecActions'
  | 'children'
  | 'className'
  | 'columns'
  | 'conditionalFormatting'
  | 'data'
  | 'defaultFilters'
  | 'defaultSort'
  | 'description'
  | 'disabled'
  | 'disabledOn'
  | 'editable'
  | 'emptyState'
  | 'exportOptions'
  | 'fields'
  | 'filter'
  | 'frozenColumns'
  | 'grouping'
  | 'hidden'
  | 'hiddenOn'
  | 'id'
  | 'keyboardNavigation'
  | 'label'
  | 'name'
  | 'navigation'
  | 'onNavigate'
  | 'operations'
  | 'pageSize'
  | 'pagination'
  | 'placeholder'
  | 'reorderableColumns'
  | 'resizable'
  | 'resizableColumns'
  | 'rowActions'
  | 'rowColor'
  | 'rowHeight'
  | 'rowSpecActions'
  | 'searchableFields'
  | 'selectable'
  | 'selection'
  | 'showColumnTypeIcons'
  | 'showFilters'
  | 'showPagination'
  | 'showSearch'
  | 'singleClickEdit'
  | 'sort'
  | 'staticData'
  | 'style'
  | 'testId'
  | 'title'
  | 'visible'
  | 'visibleOn'
  | 'visibleWhen';

/**
 * The `ObjectFormSchema` keys a view's `form` slot may carry: every member
 * `ObjectFormSchema` declares, minus the identity keys the view itself fixes
 * (`type`, `objectName`, `mode`). 64 keys.
 *
 * Same mechanism, same pin, same removal condition as `ObjectGridSlotKey` above
 * — see its comment. Measured before the fix:
 * `Omit<ObjectFormSchema, 'type' | 'objectName' | 'mode'>` declared 0 of
 * `ObjectFormSchema`'s 67 members.
 */
type ObjectFormSlotKey =
  | 'allowSkip'
  | 'ariaLabel'
  | 'bind'
  | 'body'
  | 'buttons'
  | 'cancelText'
  | 'children'
  | 'className'
  | 'columns'
  | 'customFields'
  | 'data'
  | 'defaultTab'
  | 'defaults'
  | 'description'
  | 'disabled'
  | 'disabledOn'
  | 'drawerSide'
  | 'drawerWidth'
  | 'fields'
  | 'formType'
  | 'groups'
  | 'hidden'
  | 'hiddenOn'
  | 'id'
  | 'initialData'
  | 'initialValues'
  | 'label'
  | 'layout'
  | 'mobile'
  | 'modalCloseButton'
  | 'modalSize'
  | 'name'
  | 'navigateOnSuccess'
  | 'nextText'
  | 'onCancel'
  | 'onError'
  | 'onOpenChange'
  | 'onStepChange'
  | 'onSuccess'
  | 'open'
  | 'placeholder'
  | 'prevText'
  | 'readOnly'
  | 'recordId'
  | 'resetOnSuccess'
  | 'sections'
  | 'showCancel'
  | 'showReset'
  | 'showStepIndicator'
  | 'showSubmit'
  | 'splitDirection'
  | 'splitResizable'
  | 'splitSize'
  | 'style'
  | 'subforms'
  | 'submitBehavior'
  | 'submitHandler'
  | 'submitText'
  | 'successMessage'
  | 'tabPosition'
  | 'testId'
  | 'title'
  | 'visible'
  | 'visibleOn'
  | 'visibleWhen';

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
   * Table/Grid configuration.
   *
   * Every `ObjectGridSchema` member except the identity keys this view already
   * fixes (`type`, `objectName`) — see `ObjectGridSlotKey` for why the key list
   * is spelled out instead of `Omit`-ed (objectui#6269).
   */
  table?: Partial<Pick<ObjectGridSchema, ObjectGridSlotKey>>;
  
  /**
   * Form configuration.
   *
   * Every `ObjectFormSchema` member except the identity keys this view already
   * fixes (`type`, `objectName`, `mode`) — see `ObjectFormSlotKey` for why the
   * key list is spelled out instead of `Omit`-ed (objectui#6269).
   */
  form?: Partial<Pick<ObjectFormSchema, ObjectFormSlotKey>>;
  
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

/**
 * Object Map Configuration — the AUTHOR-FACING shape of an `object-map`'s
 * type-specific configuration, carried under `ObjectMapSchema.map`.
 *
 * ONE declaration, two consumers: this interface is what a TypeScript author
 * writes, and `ObjectMapConfigSchema` (`zod/objectql.zod.ts`) is what `ObjectMap`
 * validates the authored block against at runtime. They are kept as a pair
 * here, in `@object-ui/types`, precisely so the declared face and the runtime
 * validation cannot drift — before objectui#5018 the zod lived package-private
 * inside `plugin-map/src/ObjectMap.tsx` and the declared face did not exist at
 * all, so a misspelled `latitudeFieId` reached the renderer unchallenged by
 * either layer and painted an empty map.
 *
 * The FLAT top-level spelling of these same keys (`schema.latitudeField`, …)
 * is deliberately NOT declared here: it is the internal product of ObjectView /
 * ListView flattening `options.map` into the component schema, not an authoring
 * surface (maintainer ruling on objectui#5018, 2026-08-17). Authors write the
 * `map` block; when both are present, the block wins.
 */
export interface ObjectMapConfig {
  /** Field containing latitude value */
  latitudeField?: string;
  /** Field containing longitude value */
  longitudeField?: string;
  /** Field with a combined location (`"lat,lng"`, `[lat, lng]` or `{ lat, lng }`) */
  locationField?: string;
  /** Field to use for the marker title/label */
  titleField?: string;
  /** Field to use for the marker description */
  descriptionField?: string;
  /**
   * Zoom level (1-20). Declaring it opts the view OUT of fitting the camera to
   * its records — the declaration wins (objectui#4941).
   */
  zoom?: number;
  /**
   * Center coordinates `[lat, lng]` — latitude first, as documented and as the
   * `map` block has always been read. Declaring it opts the view OUT of fitting
   * the camera to its records.
   */
  center?: [number, number];
  /** MapLibre style URL/spec (overrides the public demo default) */
  style?: string;
}

/**
 * ObjectMap Component Schema
 *
 * Every key here has a read site in `plugin-map/src/ObjectMap.tsx`; nothing is
 * declared that the renderer does not consume (objectui#5018 — the card exists
 * because the reverse was true, and a declared-but-unread key re-creates the
 * same defect pointing the other way).
 */
export interface ObjectMapSchema extends BaseSchema {
  type: 'object-map';
  /** ObjectQL object name */
  objectName: string;
  /**
   * Data source configuration. Preferred over `staticData` / `objectName`
   * (`getDataConfig`).
   */
  data?: ViewData;
  /** Inline records, wrapped into a `{ provider: 'value' }` data config */
  staticData?: any[];
  /** Query filter, forwarded verbatim as `$filter` */
  filter?: any[];
  /** Sort configuration, forwarded as `$orderby` */
  sort?: string | SortConfig[];
  /**
   * Map configuration — the author face. See `ObjectMapConfig`.
   *
   * Named `ObjectMapConfig`, not `MapConfig`: `@objectstack/spec/automation`
   * already owns `MapConfig` / `MapConfigSchema` for an unrelated automation
   * concept, and `check:spec-symbols` (rightly) refuses a local declaration
   * under a spec export's name — a colliding name is read by the next agent as
   * the spec's own definition.
   */
  map?: ObjectMapConfig;
  /**
   * Group nearby markers into clusters. Clustering also engages automatically
   * past 100 markers; the `enableClustering` prop overrides this key.
   */
  enableClustering?: boolean;
  /**
   * Record navigation behaviour (drawer / dialog / page).
   * Aligned with @objectstack/spec ListView.navigation.
   */
  navigation?: ViewNavigationConfig;
  /**
   * Field containing location data (or lat/long pair).
   *
   * INTERNAL FORM. This is the flat spelling ObjectView / ListView produce when
   * they flatten `options.map`; it predates the `map` block and stays declared
   * only so that already-published authoring keeps type-checking. New authoring
   * belongs in `map.locationField`, which wins when both are present
   * (objectui#5018).
   */
  locationField?: string;
  /**
   * Field for marker title. INTERNAL FORM — see `locationField`; prefer
   * `map.titleField`.
   */
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
  /**
   * Field for task dependencies.
   *
   * @deprecated Legacy alias — author {@link ObjectGanttSchema.dependenciesField}
   * instead. The plural is the spec's spelling (`@objectstack/spec`
   * `GanttConfigSchema.dependenciesField`); this singular has NO spec
   * counterpart. It is pre-spec objectui vocabulary, and until objectui#6051 it
   * was the ONLY dependencies spelling this interface declared — so for the whole
   * time the alias existed the published type taught the non-spec key and hid the
   * canonical one. That is what this tag exists to correct: the two were declared
   * as equals, and a reader had no way to learn which one to write.
   *
   * Still accepted, deliberately. `getGanttConfig`'s flat branch reads
   * `dependenciesField || dependencyField`, so metadata already written against
   * this key renders unchanged and the canonical key wins wherever both carry a
   * value. Deprecating is NOT removing: dropping the alias would narrow the
   * accept set of a published surface, which is a separate enforce-or-remove
   * decision (objectui#6470) and not something this marker takes.
   */
  dependencyField?: string;
  /** Field for progress (0-100) */
  progressField?: string;
  /**
   * Initial timeline granularity, honoured by BOTH renderer branches (the
   * timeline and the resource-workload grid). DERIVED from the spec's
   * `GanttConfigSchema.viewMode` member so the member list cannot drift
   * (objectui#5074).
   *
   * Deliberately NO default: an omitted `viewMode` lets a persisted layout
   * (保存布局, `persistLayoutKey`) seed the granularity before the renderer's
   * `'day'` fallback. A default here would arrive downstream as an explicit
   * author choice and defeat that seeding.
   */
  viewMode?: SpecGanttConfig['viewMode'];
  /**
   * Skip weekends in duration / auto-schedule math (objectui#5903).
   *
   * When true (or when `holidays` is non-empty) `ObjectGantt` builds a
   * `WorkingCalendar` and `GanttView` measures durations, cascades and the
   * critical path in WORKING days — weekends are stepped over rather than
   * consumed. Read at `plugin-gantt/src/ObjectGantt.tsx` (`workingCalendar`).
   *
   * Declared here rather than derived: the spec's `GanttConfigSchema` models no
   * working-calendar member, so this is objectui's own display extension — the
   * same standing `timeSegments` has on {@link GanttConfig}.
   */
  skipWeekends?: boolean;
  /**
   * Non-working dates for the same working calendar as {@link skipWeekends} —
   * ISO `yyyy-mm-dd` (UTC) keys, e.g. `['2024-06-05']`. Non-empty enables the
   * working calendar on its own. Read at `ObjectGantt.tsx` (`workingCalendar`).
   */
  holidays?: string[];
  /**
   * Opt OUT of layout persistence. `false` disables it; any other value (and
   * omission) keeps it on, which is why this is not spelled as an enable flag.
   *
   * `GanttView` persists its column/zoom snapshot and `ObjectGantt` persists the
   * quick-filter chips under a sibling localStorage key, both derived from
   * `persistLayoutKey`. Read at `ObjectGantt.tsx` (`persistLayoutKey`).
   */
  persistLayout?: boolean;
  /**
   * Layout-persistence scope. Distinguishes two gantts bound to the SAME object
   * so they keep separate saved layouts; the storage key is
   * `objectName:viewName` and defaults to `objectName:default`. Read at
   * `ObjectGantt.tsx` (`persistLayoutKey`).
   */
  viewName?: string;
  /**
   * Record navigation behaviour when a bar is clicked (drawer / dialog / page).
   * Defaults to an inline right-side drawer; set `{ mode: 'page' }` to route to
   * the standalone detail page instead. Read at `ObjectGantt.tsx`
   * (`navConfig`).
   *
   * The spec owns the member list — `mode`, `view`, `preventNavigation`,
   * `openNewTab`, `size`, `width` — and its schema REFUSES anything else. In
   * particular there is no `basePath`: the package README shows one, and no read
   * site in this repo consumes it (filed separately). Do not restate the
   * vocabulary here; that is the drift this derivation exists to prevent.
   *
   * Same spec type as {@link ObjectGridSchema.navigation} and
   * {@link ObjectViewSchema.navigation} — aligned with `@objectstack/spec`
   * `ListView.navigation` rather than restated, so the vocabulary cannot fork.
   */
  navigation?: ViewNavigationConfig;
  /**
   * Extra vertical reference lines drawn like the Today marker (deadline,
   * sprint boundary, release…). Forwarded to `GanttView`'s `markers` prop and
   * read at `ObjectGantt.tsx`.
   *
   * `date` is declared as a STRING here, not `Date | string` like the runtime
   * `GanttMarker` this feeds: a schema is serialisable authored metadata and a
   * `Date` instance cannot survive JSON. The renderer keeps accepting both,
   * because a narrower authoring surface is assignable to the wider prop.
   */
  markers?: Array<{
    /** Marker position, ISO date or datetime string (e.g. `'2024-06-05'`). */
    date: string;
    /** Text drawn against the line. */
    label?: string;
    /** Line colour — any CSS colour. */
    color?: string;
  }>;
  /**
   * Start with the critical-path highlight enabled. The toolbar toggle stays
   * available either way — this only seeds its initial state. Read at
   * `ObjectGantt.tsx` (`criticalPathDefault`).
   */
  criticalPath?: boolean;
  /**
   * Render planned-vs-actual baseline bars when tasks carry baseline dates.
   * Defaults to ON — only an explicit `false` turns them off, which is why the
   * read site compares against `false` rather than coercing. Read at
   * `ObjectGantt.tsx`.
   */
  showBaselines?: boolean;
  /**
   * Read-only mode. Disables every write path — bar drag / resize / progress
   * handle, inline edit, delete, dependency-link drag, row reorder,
   * auto-schedule and the Undo/Redo buttons — and locks the record drawer.
   * Clicking a task and switching granularity still work. Read at
   * `ObjectGantt.tsx` (`readOnly`, and the drawer's `recLocked`).
   */
  readOnly?: boolean;
  /**
   * Auto-enter read-only mode on narrow viewports (< 640px) so touch users get
   * a scrollable thumbnail instead of error-prone drag editing. Defaults to ON;
   * only an explicit `false` turns it off. Independent of (and OR-combined
   * with) {@link readOnly}. Read at `ObjectGantt.tsx`.
   */
  mobileReadOnly?: boolean;

  // ── The flattened `GanttConfig` face (objectui#6051) ────────────────────────
  //
  // `getGanttConfig` (`plugin-gantt/src/ObjectGantt.tsx`) has two branches. The
  // `gantt` block wins whenever it is present (objectui#6469); this flat face is
  // read only when there is no block, and then only when `startDateField` AND
  // `endDateField` are both present at the TOP LEVEL. The keys of the flat branch
  // were declared by neither
  // this interface nor `ObjectGridSchema`: they were reachable only through
  // `BaseSchema`'s `[key: string]: any`, so `schema.colorField` type-checked as
  // `any` with no cast anywhere to grep for. That is why the census behind this
  // card is an AST enumeration and not a compile-and-observe — an index signature
  // swallows exactly the evidence a type annotation would have produced.
  //
  // Every member below is DERIVED from {@link GanttConfig}, the same type the
  // `gantt` block carries, so the flat spelling cannot drift from the block
  // spelling. All are optional, matching the renderer: the flat branch reads each
  // key bare and forwards `undefined` unchanged.
  //
  // ⚠️ WHICH face wins was NOT decided by objectui#6051, which declared these keys.
  // It was settled afterwards by objectui#6469, inheriting the maintainer ruling on
  // objectui#5018 (2026-08-17) that `plugin-map` shipped in PR #5156: the BLOCK
  // wins, taken whole, and the shadowed flat keys are named in a dev-mode warning
  // instead of being dropped silently. So a node carrying both spellings renders
  // the `gantt` block's values — the reverse of the pre-#6469 order.

  /**
   * Record field carrying the bar's FILL colour: any CSS colour or a semantic
   * palette name (red/orange/…), typically a server-computed status colour.
   * When it is unset — or when the record's value is empty — the bar falls back
   * to the record's own `status`/`state`/`priority`/`severity` value, so the
   * timeline tells the same colour story as list/kanban. With neither, bars
   * take the platform default blue.
   */
  colorField?: GanttConfig['colorField'];
  /** Per-task alert stroke colour field. See {@link GanttConfig.borderColorField}. */
  borderColorField?: GanttConfig['borderColorField'];
  /**
   * Record field holding this task's predecessors. The CANONICAL spelling — the
   * flat branch reads `dependenciesField || dependencyField`, so the singular
   * {@link ObjectGanttSchema.dependencyField} above stays accepted as the legacy
   * alias and this one wins. That alias is `@deprecated` (objectui#6470): still
   * read, no longer taught.
   */
  dependenciesField?: GanttConfig['dependenciesField'];
  /**
   * Record field holding this row's PARENT id — the single-parent pointer the
   * task tree is built from: indentation, expand/collapse and summary rollup
   * all follow it. An empty value, or one naming no loaded row, renders that
   * row as a root. Leave unset for a flat chart; `groupByField` is the
   * alternative, bucketing leaves under synthesized rows instead of a
   * record-declared hierarchy.
   */
  parentField?: GanttConfig['parentField'];
  /** Record field mapping onto a node kind (task/summary/milestone/group). */
  typeField?: GanttConfig['typeField'];
  /** Record field marking a row view-only. See {@link GanttConfig.lockField}. */
  lockField?: GanttConfig['lockField'];
  /** Record field carrying the row's own object API name (mixed-object trees). */
  objectField?: GanttConfig['objectField'];
  /** How a summary bar's span is computed. See {@link GanttConfig.summaryExtent}. */
  summaryExtent?: GanttConfig['summaryExtent'];
  /** Auto-collapse depth on first render. See {@link GanttConfig.defaultCollapsedDepth}. */
  defaultCollapsedDepth?: GanttConfig['defaultCollapsedDepth'];
  /**
   * Extra record fields listed as label/value rows in a bar's hover tooltip, in
   * the order given. Each entry is a field name (dot-paths allowed) or
   * `{ field, label }` to set the label explicitly; otherwise the label comes
   * from the object schema, falling back to a humanized field name, and the
   * value is formatted by field type the way a list cell would render it. A row
   * whose value is empty is DROPPED rather than dashed, so a mixed-object tree
   * can list the union of every level's fields here. Any surviving rows replace
   * the tooltip's default date · duration · progress line.
   */
  tooltipFields?: GanttConfig['tooltipFields'];
  /** Baseline (planned) start field → planned-vs-actual reference bars. */
  baselineStartField?: GanttConfig['baselineStartField'];
  /** Baseline (planned) end field → planned-vs-actual reference bars. */
  baselineEndField?: GanttConfig['baselineEndField'];
  /** Dynamic group-by field, replacing the parent hierarchy. */
  groupByField?: GanttConfig['groupByField'];
  /** Render the per-resource load histogram instead of the timeline grid. */
  resourceView?: GanttConfig['resourceView'];
  /** Record field the resource view buckets by. Required for {@link resourceView}. */
  assigneeField?: GanttConfig['assigneeField'];
  /** Record field carrying each task's load units (default 1). */
  effortField?: GanttConfig['effortField'];
  /** Per-resource capacity ceiling (default 1); loads above it flag overload. */
  capacity?: GanttConfig['capacity'];
  /**
   * Quick-filter dropdowns rendered above the chart — a row of multi-selects,
   * each narrowing the visible bars by one record field. A dimension's options
   * resolve from the object schema (a select's options, or the referenced
   * records for a lookup), so the dropdown offers that field's full domain
   * rather than only the values present in the loaded page; declare `options`
   * on the dimension to override that with a fixed list.
   */
  quickFilters?: GanttConfig['quickFilters'];
  /** Recompute the timeline range when filtering (default true). */
  autoZoomToFilter?: GanttConfig['autoZoomToFilter'];
  /** Shift segmentation for the day-mode timeline. See {@link GanttConfig.timeSegments}. */
  timeSegments?: GanttConfig['timeSegments'];
  /** Per-interaction switches. See {@link GanttConfig.interactions}. */
  interactions?: GanttConfig['interactions'];
  /** Base name for exported PNG/PDF files. See {@link GanttConfig.exportFileName}. */
  exportFileName?: GanttConfig['exportFileName'];
  /** Business time zone (IANA name) the calendar renders in. */
  timeZone?: GanttConfig['timeZone'];
  /** Whether the store persists dependency link TYPES (fs/ss/ff/sf). */
  dependencyTypes?: GanttConfig['dependencyTypes'];

  // ── The BLOCK face (the `ObjectGridSchema`-style shape, objectui#6475) ──────
  //
  // `getGanttConfig`'s FIRST branch (`plugin-gantt/src/ObjectGantt.tsx`) reads
  // this and wins whenever present (objectui#6469 ruled block-over-flat). It was
  // the 28th and last undeclared key of the objectui#6051 census — the one key
  // whose VALUES get stricter on declaration rather than merely gaining a name:
  // it had no mirror entry at all, so a block rode through `.passthrough()`
  // entirely unvalidated. Declaring it as {@link GanttConfig} means it is now
  // PARSED, and `GanttConfig` derives from the spec's `GanttConfigSchema`, which
  // REQUIRES `startDateField`, `endDateField` and `titleField`. Because
  // `ObjectGanttSchema` is a member of `AnyComponentSchema`, that reaches
  // `safeValidateSchema` and therefore the CLI's `validate` / `check` commands: a
  // block missing one of the three moves from "accepted, then warned about at
  // runtime" to "refused at authoring time".
  //
  // This is a `declared = enforced` restoration, not new requiredness: the
  // renderer already fed the block to `GanttConfigSchema.safeParse` and logged
  // `[ObjectGantt] Invalid gantt configuration` on failure — the trio was already
  // required for the block to actually work, just silently. Maintainer ruling,
  // objectui#6475 (2026-08-27), Option A: declare as-is, spec requiredness
  // enforces immediately, no warning window (excluded by the startup-stage
  // no-gradualism rule, objectstack#12668 — no named external-user evidence).
  gantt?: GanttConfig;

  // ── The query/data keys the fetch path reads (objectui#6051) ────────────────
  //
  // These are NOT gantt config: they are the read the component issues. They were
  // declared on `ObjectGridSchema`, which is what `ObjectGanttProps.schema` used
  // to be typed as — objectui#5903 retyped that prop to this interface, which is
  // correct and is why they now have to be declared HERE. `plugin-gantt`'s
  // registry mapping (`OBJECT_GANTT_DATA_SOURCE` in `index.tsx`) names `filter`
  // and `sort` as the two keys the element data-source binding maps onto.
  /** Inline records, wrapped into a `{ provider: 'value' }` config by `getDataConfig`. */
  staticData?: any[];
  /** Query filter (JSON Rules format), forwarded verbatim as `$filter`. */
  filter?: any[];
  /** Sort configuration, forwarded as `$orderby` via `convertSortToQueryParams`. */
  sort?: string | SortConfig[];
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
  /**
   * Default view mode — the renderer's rendered set. `'agenda'` was retired
   * (objectui#5784, following #5740): `CalendarView` renders no agenda view,
   * and the enforcement points read only these three values.
   */
  defaultView?: 'month' | 'week' | 'day';
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
 * Object Gallery Component Schema (objectui#6576)
 *
 * The node `plugin-list`'s `ObjectGallery` renders — registered as
 * `object-gallery` — and the anchor of the published `ObjectGalleryProps.schema`.
 * Minted by the 2026-08-31 ruling on objectui#6576 (option A): the prop type
 * used to declare this shape as a hand-rolled inline literal with no
 * `BaseSchema` in its ancestry, so every base member had to be hand-copied in
 * (`bind`, `className` were) and a real base key such as `visibleWhen` was a
 * compile error. Anchoring here WIDENS that published accept set to every
 * `BaseSchema` member and makes `type` required.
 *
 * Every key below has a read site in `plugin-list/src/ObjectGallery.tsx` (the
 * read census is pinned in `__tests__/widget-schema-anchors-6576.test.ts`);
 * `bind` and `className` are inherited, not restated.
 */
export interface ObjectGallerySchema extends BaseSchema {
  type: 'object-gallery';
  /** ObjectQL object name; omitted when the records arrive through `bind` or `data` */
  objectName?: string;
  /** Query filter, forwarded verbatim as `$filter` */
  filter?: unknown;
  /** Inline records — rendered ahead of a fetch when present */
  data?: Record<string, unknown>[];
  /** Gallery configuration — aligned with @objectstack/spec `GalleryConfig` */
  gallery?: GalleryConfig;
  /** Navigation config for item click behavior */
  navigation?: ViewNavigationConfig;
  /** Grouping configuration for sectioned display */
  grouping?: GroupingConfig;
  /** @deprecated Use `gallery.coverField` instead */
  imageField?: string;
  /** @deprecated Use `gallery.titleField` instead */
  titleField?: string;
}

/**
 * Object Data Table Component Schema (objectui#6576 / objectui#6914)
 *
 * The node `plugin-dashboard`'s `ObjectDataTable` renders — registered as
 * `object-data-table` — and the anchor of `ObjectDataTableProps.schema`. That
 * prop type used to be a hand-rolled inline literal carrying its own
 * `[key: string]: any`, which is how it drifted: the widget read `drillDown`
 * and `onRowClick` behind casts and declared neither (objectui#6914). Both are
 * declared here with the types measured where they were declared before
 * (`DrillDownConfig` on `ChartSchema` / `PivotTableSchema`, `onRowClick` on
 * `DataTableSchema`), and the literal's index signature is gone — a NARROWING
 * of a prop type the plugin index does not export.
 *
 * `bind` and `className` are inherited from `BaseSchema`, not restated. The
 * widget spreads this node into the `data-table` it renders (overwriting
 * `type`, `data`, `columns` and `onRowClick`), so `searchable` / `pagination`
 * reach `DataTableSchema` unchanged.
 */
export interface ObjectDataTableSchema extends BaseSchema {
  type: 'object-data-table';
  /** ObjectQL object name; omitted when the rows arrive through `bind` or `data` */
  objectName?: string;
  /** Data-provider binding, carried from the dashboard widget definition */
  dataProvider?: { provider: string; object?: string };
  /** Query filter, resolved through the filter scope and forwarded as `$filter` */
  filter?: any;
  /** Inline rows — rendered ahead of a fetch when non-empty */
  data?: any[];
  /** Column definitions (names or column objects), normalized by the widget */
  columns?: any[];
  /** Forwarded to the rendered `data-table` */
  searchable?: boolean;
  /** Forwarded to the rendered `data-table` */
  pagination?: boolean;
  /**
   * Drill-to-record: clicking a row opens that record in a detail drawer.
   * `DashboardRenderer` defaults object-backed table widgets to `{ enabled: true }`.
   */
  drillDown?: DrillDownConfig;
  /**
   * Row click handler — a RUNTIME SLOT a React host supplies through this
   * interface, never through authored JSON (objectui#6124; the zod mirror
   * refuses the key by name). When present it overrides drill-to-record.
   */
  onRowClick?: (row: any) => void;
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
