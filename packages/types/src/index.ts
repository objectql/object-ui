/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types
 * 
 * Pure TypeScript type definitions for Object UI - The Protocol Layer.
 * 
 * This package contains ZERO runtime dependencies and defines the complete
 * JSON schema protocol for the Object UI ecosystem.
 * 
 * ## Philosophy
 * 
 * Object UI follows a "Schema First" approach where:
 * 1. Types define the protocol (this package)
 * 2. Core implements the engine (@object-ui/core)
 * 3. React provides the framework bindings (@object-ui/react)
 * 4. Components provide the UI implementation (@object-ui/components)
 * 
 * ## Design Principles
 * 
 * - **Protocol Agnostic**: Works with any backend (REST, GraphQL, ObjectQL)
 * - **Framework Agnostic**: Types can be used with React, Vue, or vanilla JS
 * - **Zero Dependencies**: Pure TypeScript with no runtime dependencies
 * - **Tailwind Native**: Designed for Tailwind CSS styling via className
 * - **Type Safe**: Full TypeScript support with strict typing
 * 
 * ## Usage
 * 
 * ```typescript
 * import type { InputSchema, FormSchema, ButtonSchema } from '@object-ui/types';
 * 
 * const loginForm: FormSchema = {
 *   type: 'form',
 *   fields: [
 *     { name: 'email', type: 'input', inputType: 'email', required: true },
 *     { name: 'password', type: 'input', inputType: 'password', required: true }
 *   ]
 * };
 * ```
 * 
 * @packageDocumentation
 */

// ============================================================================
// Application - Global Configuration
// ============================================================================
export type {
  AppComponentSchema,
  AppAction,
  NavigationItem,
  NavigationItemType,
  NavigationArea,
  MenuItem as AppMenuItem,
  AppWizardStepId,
  AppWizardStep,
  BrandingConfig,
  ObjectSelection,
  AppWizardDraft,
  EditorMode,
} from './app.js';
export { menuItemToNavigationItem, isValidAppName, wizardDraftToAppSchema } from './app.js';

// Object-level semantic-role readers (ADR-0085), shared across surfaces.
export { detectStatusField } from './record-semantics.js';
export type { StatusFieldSource } from './record-semantics.js';

// Dashboard global-filter legacy alias (ADR-0089 retirement window, #4165) —
// `{ preset: <name> }` → the canonical bare preset name. Read-site helpers, so
// they live on the main entry rather than under `/zod` (they carry no zod).
export {
  liftLegacyGlobalFilterDefault,
  liftLegacyDashboardFilterDefaults,
} from './dashboard-filter-alias.js';

// `ui:icon` glyph-key conversion (objectui#5631) — stored `{ type:'icon',
// name:'check' }` -> `{ type:'icon', icon:'check' }`. A one-shot converter a
// deployer runs over stored metadata; ⛔ NOT a read-path fallback, which the
// ruling excluded by name. Zod-free, so it belongs on the main entry.
export { migrateIconNodeKeys } from './icon-key-migration.js';
export type {
  IconKeyMigrationResult,
  IconKeyMigrationWarning,
} from './icon-key-migration.js';

// ============================================================================
// Base Types - The Foundation
// ============================================================================
export type {
  BaseSchema,
  // objectui's KEYED i18n label — `{ key, defaultValue?, params? }`, a
  // reference INTO a translation bundle. Deliberately NOT the spec's
  // `I18nLabel` re-exported further down this file, which is the INLINE LOCALE
  // MAP; the two are structurally confusable (objectui#4167) and this name is
  // half of what stops them being mixed up (#4581).
  KeyedI18nLabel,
  SchemaNode,
  ComponentRendererProps,
  ComponentInput,
  // The arm vocabulary of `ComponentInput.type`, exported because that field
  // takes one arm OR an array of them (objectui#3832) and every declaration
  // site and reader needs the set by name rather than re-spelling it.
  ComponentInputControlType,
  ComponentMeta,
  ComponentConfig,
  HTMLAttributes,
  EventHandlers,
  StyleProps,
} from './base.js';

// ============================================================================
// Layout Components - Structure & Organization
// ============================================================================
export type {
  DivSchema,
  TextSpanSchema,
  TextSchema,
  ImageSchema,
  IconSchema,
  SeparatorSchema,
  ContainerSchema,
  FlexSchema,
  StackSchema,
  GridSchema,
  CardSchema,
  TabsSchema,
  TabItem,
  ScrollAreaSchema,
  ResizableSchema,
  ResizablePanel,
  AspectRatioSchema,
  LayoutSchema,
  PageNodeSchema,
  PageSlotMap,
  PageType,
  PageNodeRegion,
  PageRegionWidth,
  PageVariable,
} from './layout.js';

// ============================================================================
// Form Components - User Input & Interaction
// ============================================================================
export type {
  ButtonSchema,
  InputSchema,
  TextareaSchema,
  SelectSchema,
  SelectOption,
  CheckboxSchema,
  RadioGroupSchema,
  RadioOption,
  SwitchSchema,
  SliderSchema,
  FileUploadSchema,
  DatePickerSchema,
  CalendarSchema,
  FieldValidationRules,
  FieldCondition,
  DependsOnInput,
  FormField,
  FormFieldTab,
  FormFieldPane,
  ComboboxSchema,
  CommandSchema,
  InputOTPSchema,
  ToggleSchema,
  FormSchema,
  LabelSchema,
  FormComponentSchema,
} from './form.js';

// ============================================================================
// Data Display Components - Information Presentation
// ============================================================================
export type {
  AlertSchema,
  BadgeSchema,
  AvatarSchema,
  ListSchema,
  ListItem,
  TableColumn,
  StaticTableColumn,
  TableSortItem,
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeNode,
  TreeViewSchema,
  ChartType,
  ChartDataSeries,
  ChartSchema,
  PivotAggregation,
  PivotTableSchema,
  DrillDownConfig,
  TimelineEvent,
  TimelineSchema,
  KbdSchema,
  HtmlSchema,
  StatisticSchema,
  DataDisplaySchema,
} from './data-display.js';

// ============================================================================
// Feedback Components - Status & Progress Indication
// ============================================================================
export type {
  SpinnerSchema,
  LoadingSchema,
  ProgressSchema,
  SkeletonSchema,
  ToastSchema,
  EmptySchema,
  SonnerSchema,
  ToasterSchema,
  FeedbackSchema,
} from './feedback.js';

// ============================================================================
// Disclosure Components - Collapsible Content
// ============================================================================
export type {
  AccordionItem,
  ToggleGroupSchema,
  AccordionSchema,
  CollapsibleSchema,
  DisclosureSchema,
} from './disclosure.js';

// ============================================================================
// Overlay Components - Modals & Popovers
// ============================================================================
export type {
  OverlayPosition,
  OverlayAlignment,
  DialogSchema,
  AlertDialogSchema,
  SheetSchema,
  DrawerSchema,
  PopoverSchema,
  TooltipSchema,
  HoverCardSchema,
  MenuItem,
  MenubarSchema,
  DropdownMenuSchema,
  ContextMenuSchema,
  OverlaySchema,
} from './overlay.js';

// ============================================================================
// Navigation Components - Menus & Navigation
// ============================================================================
export type {
  NavLink,
  HeaderBarSchema,
  SidebarSchema,
  BreadcrumbItem,
  BreadcrumbSchema,
  ButtonGroupSchema,
  NavigationMenuSchema,
  NavigationSchema,
  PaginationSchema,
} from './navigation.js';

// ============================================================================
// Complex Components - Advanced/Composite Components
// ============================================================================
export type {
  KanbanColumn,
  KanbanCard,
  KanbanSchema,
  CalendarViewMode,
  CalendarEvent,
  CalendarViewSchema,
  FilterBuilderOperator,
  FilterBuilderCondition,
  FilterGroup,
  FilterBuilderSchema,
  FilterField,
  CarouselItem,
  CarouselSchema,
  DashboardWidgetLayout,
  DashboardWidgetSchema,
  DashboardComponentSchema,
  DashboardComponentWidgetType,
  DashboardWidgetTypeExtension,
  DashboardWidgetTypeName,
  ChatMessage,
  ChatMessageSource,
  ChatToolInvocation,
  ChatbotSchema,
  FloatingChatbotConfig,
  ComplexSchema,
} from './complex.js';

/**
 * The two CLOSED extension sets a dashboard widget's `type` may draw on beyond
 * the spec's own families (objectui#4600, maintainer ruling 2026-08-14).
 */
export {
  DASHBOARD_COMPONENT_WIDGET_TYPES,
  DASHBOARD_WIDGET_TYPE_EXTENSIONS,
} from './complex.js';

// ============================================================================
// Data Management - Backend Integration
// ============================================================================
export type {
  QueryParams,
  QueryResult,
  DataSource,
  DeleteViewResult,
  ViewHomeDeleteOutcome,
  GlobalSearchHit,
  GlobalSearchResult,
  BatchRef,
  BatchTransactionOperation,
  DataScope,
  DataContext,
  DataBinding,
  ValidationError,
  APIError,
  FileUploadResult,
  AggregateParams,
  AggregateResult,
  DataSourceMutationEvent,
  ExportJobStatus,
  ExportJobFormat,
  CreateExportJobRequest,
  CreateExportJobResult,
  ExportJobProgressInfo,
  ImportWriteMode,
  ImportFieldMappingEntry,
  ImportRequestOptions,
  ImportRowResult,
  ImportRecordsResult,
  ImportJobStatus,
  CreateImportJobResult,
  ImportJobProgressInfo,
  ImportJobResultsInfo,
  ImportJobSummaryInfo,
  ImportJobUndoResult,
  ListImportJobsOptions,
  ExportDownloadRequest,
} from './data.js';

// ============================================================================
// CRUD Components - Create, Read, Update, Delete Operations
// ============================================================================
export type {
  ActionSchema,
  CRUDOperation,
  CRUDFilter,
  CRUDToolbar,
  CRUDPagination,
  CRUDSchema,
  DetailSchema,
  CRUDDialogSchema,
  CRUDComponentSchema,
} from './crud.js';

// ============================================================================
// ObjectQL Components - ObjectQL-specific components
// ============================================================================
export type {
  // Schema types aligned with @objectstack/spec
  HttpMethod,
  HttpRequest,
  ViewData,
  ListColumn,
  SelectionConfig,
  PaginationConfig,
  KanbanConfig,
  CalendarConfig,
  GanttConfig,
  ListViewGalleryConfig,
  ListViewTimelineConfig,
  SortConfig,
  // ConditionalFormatting dual-format types
  ObjectUIConditionalFormattingRule,
  SpecConditionalFormattingRule,
  ConditionalFormattingRule,
  // Component schemas
  ObjectMapSchema,
  ObjectMapConfig,
  ObjectGanttSchema,
  ObjectCalendarSchema,
  ObjectKanbanSchema,
  KanbanConditionalFormattingRule,
  KanbanNativeConditionalFormattingRule,
  ObjectChartSchema,
  ListViewSchema,
  ListViewExportFormat,
  ListViewExportOptions,
  ObjectGridSchema,
  ObjectFormSchema,
  ObjectFormSection,
  SubmitBehavior,
  ObjectViewSchema,
  NamedListView,
  ViewNavigationConfig,
  ViewTabBarConfig,
  ObjectQLComponentSchema,
  BulkActionDef,
  BulkActionParam,
  BulkActionOperation,
} from './objectql.js';

// ============================================================================
// Record Components - Spec-aligned record:* page component props
// ============================================================================
export type {
  RecordComponentAriaProps,
  RecordDetailsComponentProps,
  RecordHighlightsComponentProps,
  RecordRelatedListComponentProps,
  RecordActivityComponentProps,
  RecordChatterComponentProps,
  RecordPathComponentProps,
} from './record-components.js';

// ============================================================================
// Field Types - ObjectQL Field Type System
// ============================================================================
export type {
  BaseFieldMetadata,
  VisibilityCondition,
  ValidationFunction as FieldValidationFunction,
  TextFieldMetadata,
  TextareaFieldMetadata,
  MarkdownFieldMetadata,
  HtmlFieldMetadata,
  NumberFieldMetadata,
  CurrencyFieldMetadata,
  PercentFieldMetadata,
  BooleanFieldMetadata,
  DateFieldMetadata,
  DateTimeFieldMetadata,
  TimeFieldMetadata,
  SelectFieldMetadata,
  SelectOptionMetadata,
  EmailFieldMetadata,
  PhoneFieldMetadata,
  UrlFieldMetadata,
  PasswordFieldMetadata,
  FileFieldMetadata,
  UploadedFileMetadata,
  ImageFieldMetadata,
  LocationFieldMetadata,
  LookupFieldMetadata,
  LookupColumnDef,
  LookupFilterDef,
  FormulaFieldMetadata,
  SummaryFieldMetadata,
  AutoNumberFieldMetadata,
  UserFieldMetadata,
  ObjectFieldMetadata,
  VectorFieldMetadata,
  GridFieldMetadata,
  GridColumnDefinition,
  ColorFieldMetadata,
  CodeFieldMetadata,
  AvatarFieldMetadata,
  SignatureFieldMetadata,
  QRCodeFieldMetadata,
  AddressFieldMetadata,
  GeolocationFieldMetadata,
  SliderFieldMetadata,
  RatingFieldMetadata,
  MasterDetailFieldMetadata,
  FieldMetadata,
  ObjectTrigger,
  ObjectSchemaMetadata,
  ObjectSchemaClientExtensions,
  ObjectIndex,
  ObjectRelationship,
} from './field-types.js';

// System / audit / ownership field classification — runtime helper + name set,
// used by default list-column derivation to keep framework-injected fields
// (notably `owner_id`) out of the leading business columns.
export {
  SYSTEM_MANAGED_FIELD_NAMES,
  AUDIT_FIELD_BY_ROLE,
  AUDIT_FIELD_NAMES,
  isSystemManagedField,
} from './system-fields.js';
export type { AuditFieldName } from './system-fields.js';
export { MANAGED_BY_BUCKETS } from './managed-by.js';
export type { ManagedByBucket } from './managed-by.js';

// ============================================================================
// Phase 3: Data Protocol Advanced Types
// ============================================================================
export type {
  // Query AST (Phase 3.3)
  QueryASTNodeType,
  QueryASTNode,
  SelectNode,
  FromNode,
  WhereNode,
  JoinNode,
  JoinStrategy,
  GroupByClauseNode,
  OrderByNode,
  LimitNode,
  OffsetNode,
  SubqueryNode,
  AggregateNode,
  WindowNode,
  WindowFunction,
  WindowFrame,
  WindowFrameUnit,
  WindowFrameBoundary,
  FieldNode,
  LiteralNode,
  OperatorNode,
  FunctionNode,
  ComparisonOperator,
  LogicalOperator,
  SqlQueryAST,
  DriverQueryConfig,
  QuerySortConfig,
  JoinConfig,
  AggregationConfig,
  WindowConfig,
  // Filter Schema (Phase 3.4)
  AdvancedFilterSchema,
  AdvancedFilterCondition,
  AdvancedFilterOperator,
  DateRangeFilter,
  // Renamed from `DateRangePreset` in objectui#4167 — the spec owns that name
  // for the narrower dashboard filter-bar vocabulary (objectstack#4115).
  FilterBuilderDateRangePreset,
  FilterBuilderConfig,
  FilterFieldConfig,
  // Validation Schema (Phase 3.5)
  AdvancedValidationSchema,
  AdvancedValidationRule,
  ValidationRuleType,
  ValidationFunction,
  AsyncValidationFunction,
  ValidationContext,
  AdvancedValidationResult,
  AdvancedValidationError,
  // Object-level validation rules. The five spec-named variants are derived from
  // `@objectstack/spec/data`; the other three are @deprecated objectui-local
  // variants the spec's union rejects. See data-protocol.ts.
  BaseValidation,
  ScriptValidation,
  UniquenessValidation,
  StateMachineValidation,
  CrossFieldValidation,
  AsyncValidation,
  ConditionalValidation,
  FormatValidation,
  RangeValidation,
  ObjectValidationRule,
  // Driver Interface (Phase 3.6)
  SqlDriverInterface,
  ConnectionConfig,
  DriverQueryResult,
  BatchOperation,
  BatchResult,
  TransactionContext,
  CacheManager,
  ConnectionPool,
  // Datasource Schema (Phase 3.7)
  DatasourceRegistration,
  DatasourceType,
  DatasourceMetric,
  DatasourceAlert,
  DatasourceManager,
  HealthCheckResult,
  DatasourceMetrics,
} from './data-protocol.js';

// ============================================================================
// Permission & RBAC Types (Q2 2026)
// ============================================================================
export type {
  PermissionAction,
  PermissionEffect,
  RoleDefinition,
  FieldLevelPermission,
  RowLevelPermission,
  PermissionCondition,
  ObjectPermissionConfig,
  SharingRuleConfig,
  PermissionCheckResult,
  PermissionContext,
  PermissionGuardConfig,
} from './permissions.js';

// ============================================================================
// Mobile Optimization Types (Q2 2026)
// ============================================================================
export type {
  BreakpointName,
  ResponsiveValue,
  MobileResponsiveConfig,
  PWAConfig,
  PWAIcon,
  FetchCacheStrategy,
  PWAOfflineConfig,
  OfflineRoute,
  // `GestureType` / `GestureConfig` reclaimed their natural names in
  // objectui#3363 once `@objectstack/spec` deleted `ui/touch`
  // (objectstack#4988). `PWAOfflineConfig` above deliberately did NOT — see
  // its note in `./mobile`; `@object-ui/react`'s `useOffline` owns that name.
  GestureType,
  GestureConfig,
  GestureContext,
  MobileComponentConfig,
  // The retired `@objectstack/spec/ui` touch vocabulary, now owned here —
  // see the "Spec Touch Vocabulary" note in `./mobile` (objectstack#4988).
  // `SPEC_GESTURE_TYPES` is its runtime witness and is exported as a VALUE
  // below, outside this `export type` block.
  SpecGestureType,
  SpecSwipeDirection,
  SpecGestureConfig,
  SwipeGestureConfig,
  PinchGestureConfig,
  LongPressGestureConfig,
  TouchTargetConfig,
  TouchInteraction,
} from './mobile.js';

// Runtime witness for the retired touch vocabulary — a VALUE, so it must not
// sit inside the `export type` block above (#2561: inside one it is
// value-erased and resolves to `undefined` at runtime).
export { SPEC_GESTURE_TYPES } from './mobile.js';

// ============================================================================
// Visual Designer Types (Q2 2026)
// ============================================================================
export type {
  DesignerPosition,
  DesignerCanvasConfig,
  DesignerComponent,
  PageDesignerSchema,
  DesignerPaletteCategory,
  DesignerPaletteItem,
  DataModelEntity,
  DataModelField,
  DataModelRelationship,
  DataModelDesignerSchema,
  BPMNNodeType,
  BPMNNode,
  BPMNEdge,
  BPMNLane,
  ProcessDesignerSchema,
  ReportSectionType,
  ReportDesignerElement,
  ReportDesignerSection,
  ReportDesignerSchema,
  CollaborationPresence,
  CollaborationOperation,
  CollaborationConfig,
  ViewColumnConfig,
  UnifiedViewType,
  UnifiedViewConfig,
  DashboardColorVariant,
  DashboardWidgetType,
  DashboardWidgetConfig,
  DashboardConfig,
  ObjectDefinition,
  ObjectDefinitionRelationship,
  ObjectManagerSchema,
  DesignerFieldType,
  DesignerFieldOption,
  DesignerValidationRule,
  DesignerFieldDefinition,
  FieldDesignerSchema,
} from './designer.js';

export {
  DASHBOARD_COLOR_VARIANTS,
  DASHBOARD_WIDGET_TYPES,
  DESIGNER_FIELD_TYPES,
} from './designer.js';

// ============================================================================
// API and Events - API Integration and Event Handling
// ============================================================================
export type {
  HTTPMethod,
  APIRequest,
  APIConfig,
  UIEventHandler,
  EventableSchema,
  DataFetchConfig,
  DataFetchableSchema,
  ExpressionContext,
  ExpressionNodeSchema,
  APISchema,
} from './api-types.js';

// ============================================================================
// Union Types - Discriminated Unions for All Schemas
// ============================================================================

import type { BaseSchema, SchemaNode } from './base.js';
import type { LayoutSchema, PageNodeSchema } from './layout.js';
import type { FormComponentSchema } from './form.js';
import type { DataDisplaySchema } from './data-display.js';
import type { FeedbackSchema } from './feedback.js';
import type { DisclosureSchema } from './disclosure.js';
import type { OverlaySchema } from './overlay.js';
import type { NavigationSchema } from './navigation.js';
import type { ComplexSchema, DashboardComponentSchema } from './complex.js';
import type { CRUDComponentSchema } from './crud.js';
import type { ObjectQLComponentSchema, ListViewSchema } from './objectql.js';
import type { AppComponentSchema } from './app.js';

// ============================================================================
// Phase 2 Schemas - New Additions
// ============================================================================
export type {
  // Theme System — the document vocabulary is owned HERE since objectui#5716
  // (maintainer ruling 2026-08-23, option A — localize): the spec retired its
  // theme module (objectstack#10485) while objectui RETAINED the theme system,
  // so the types moved into `./theme` with the last-published 17.1.0 shapes as
  // the blueprint. `Typography` / `BorderRadius` / `Shadow` /
  // `ThemeDefinition` were DELETED under the same ruling's zero-reader rider
  // (the first three live on as inline members of `Theme`).
  Theme,
  // `ThemeComponentSchema` RETIRED in objectui#5489 — the `type: 'theme'`
  // component kind no renderer implemented. See `./theme` for the tombstone.
  ThemeMode,
  ColorPalette,
  // `Animation` / `ZIndex` retired with `theme.animation` / `theme.zIndex` in
  // @objectstack/spec 17.0.0-rc.3 (objectstack#5021) — see `./theme`.
  // `ThemeSwitcherSchema` / `ThemePreviewSchema` RETIRED in objectui#5647 —
  // the `type: 'theme-switcher'` / `'theme-preview'` component kinds no
  // renderer implemented; same shape, same inherited ruling as
  // `ThemeComponentSchema` above. See `./theme` for the tombstone.
} from './theme.js';

// Runtime witness for the theme mode vocabulary — a VALUE, so it must not sit
// inside the `export type` block above (#2561: inside one it is value-erased
// and resolves to `undefined` at runtime). Same pattern as
// `SPEC_GESTURE_TYPES` below.
export { THEME_MODES } from './theme.js';

export type {
  // Report Presentation Layer (ObjectUI-specific UX enhancements:
  // sections, schedule, export presets, conditional formatting, etc.).
  // For the protocol-level Report definition, use `Spec*` exports below.
  ReportComponentSchema,
  ReportType,
  ReportExportFormat,
  ReportScheduleFrequency,
  ReportAggregationType,
  ReportField,
  ReportFilter,
  ReportGroupBy,
  ReportSection,
  ReportScheduleConfig,
  ReportExportConfig,
  ReportBuilderSchema,
  ReportViewerSchema,
} from './reports.js';

// ---------------------------------------------------------------------------
// Spec Report Bridge
//
// Authoritative report protocol from @objectstack/spec, re-exported under
// `Spec*` names so they coexist with the legacy presentation `ReportComponentSchema`.
// See `./spec-report.ts` for the layering rationale.
// ---------------------------------------------------------------------------
export type {
  SpecReportInput,
  SpecReportChart,
  SpecReportChartInput,
  SpecReportTypeName,
  SpecReportAggregate,
  SpecReportDateGranularity,
  QLAggregationFunction,
  LegacyReportPresentationLike,
  JoinedReportBlock,
  JoinedSpecReport,
} from './spec-report.js';

export {
  SpecReportSchema,
  SpecReportChartSchema,
  SpecReportTypeEnum,
  SpecReport,
  mapAggregateToQL,
  specReportToPresentation,
  isSpecReport,
  isJoinedSpecReport,
} from './spec-report.js';

// Workflow / Flow Designer schemas removed in 9.0 — they backed the retired
// `@object-ui/plugin-workflow` designers, whose BPMN-style node vocabulary the
// ObjectStack automation engine does not execute (ADR-0020, ADR-0031). The
// supported flow designer is the Studio's metadata-admin FlowCanvas in
// `@object-ui/app-shell`, which models nodes/edges locally against the
// `@objectstack/spec` flow schema.

export type {
  // AI System
  AIProvider,
  AIModelType,
  AIConfig,
  AIFieldSuggestion,
  AIFormAssistSchema,
  AIRecommendationItem,
  AIRecommendationsSchema,
  NLQueryResult,
  NLQuerySchema,
  AIInsightsSchema,
} from './ai.js';

export type {
  // Block System
  BlockSchema,
  BlockMetadata,
  BlockVariable,
  BlockSlot,
  BlockLibraryItem,
  BlockLibrarySchema,
  BlockEditorSchema,
  BlockInstanceSchema,
  ComponentSchema,
} from './blocks.js';

export type {
  // View System Enhancements
  ViewType,
  DetailViewSchema,
  DetailViewField,
  DetailViewSection,
  DetailViewTab,
  SectionGroup,
  HighlightField,
  ViewSwitcherSchema,
  FilterUISchema,
  SortUISchema,
  ViewComponentSchema,
  CommentEntry,
  MentionNotification,
  CommentSearchResult,
  ActivityEntry,
  // Feed / Chatter Protocol Types
  FeedItemType,
  FeedItem,
  FieldChangeEntry,
  Mention,
  Reaction,
  RecordSubscription,
} from './views.js';

export type {
  // Enhanced Action System (Phase 2)
  ActionExecutionMode,
  ActionCallback,
} from './crud.js';

/**
 * Union of all component schemas.
 * Use this for generic component rendering where the type is determined at runtime.
 */
export type AnySchema =
  | AppComponentSchema 
  | BaseSchema
  | LayoutSchema
  | PageNodeSchema
  | FormComponentSchema
  | DataDisplaySchema
  | FeedbackSchema
  | DisclosureSchema
  | OverlaySchema
  | NavigationSchema
  | ComplexSchema
  | DashboardComponentSchema
  | CRUDComponentSchema
  | ObjectQLComponentSchema
  | ListViewSchema;

/**
 * Utility type to extract the schema type from a type string.
 * Useful for type narrowing in renderers.
 * 
 * @example
 * ```typescript
 * function renderComponent<T extends string>(schema: SchemaByType<T>) {
 *   // schema is now typed based on the type string
 * }
 * ```
 */
export type SchemaByType<T extends string> = Extract<AnySchema, { type: T }>;

/**
 * Utility type to make all properties optional except the type.
 * Useful for partial schema definitions in editors.
 */
export type PartialSchema<T extends BaseSchema> = {
  type: T['type'];
} & Partial<Omit<T, 'type'>>;

/**
 * Schema with required children (for container components).
 */
export type ContainerSchemaWithChildren = BaseSchema & {
  children: SchemaNode | SchemaNode[];
};

/**
 * Version information
 */
export const VERSION = '0.1.0';

/**
 * Schema version for compatibility checking
 */
export const SCHEMA_VERSION = '1.0.0';

// ============================================================================
// Schema Registry - The Type Map
// ============================================================================
export type {
  SchemaRegistry,
  ComponentType,
} from './registry.js';

// ============================================================================
// Plugin Scope Isolation - Section 3.3
// ============================================================================
export type {
  PluginScope,
  PluginScopeConfig,
  AppPluginContext,
  AppMetadataPlugin,
  ComponentMeta as PluginComponentMeta,
  /**
   * @deprecated Use `ComponentInput` instead. Since objectui#4972 converged the
   * plugin-scoped declaration onto `base.ts`, this alias names the SAME type
   * under a second name — it carries no information `ComponentInput` does not.
   * Retiring it is objectui#5674 (maintainer ruling, 2026-08-22: deprecate for a
   * release, then remove). This deprecation window exists for consumers outside
   * this repository, which cannot be measured from here; in-repo the name has
   * zero importers. Removal ships as a `minor` under this repo's version policy
   * (objectui's own breaking changes never declare `major`).
   */
  ComponentInput as PluginComponentInput,
  PluginEventHandler,
} from './plugin-scope.js';

// ============================================================================
// UI Actions - Enhanced Action Schema (ObjectStack Spec v2.0.1)
// ============================================================================
/**
 * Enhanced action schema with location-based placement, parameter collection,
 * conditional visibility, and rich feedback mechanisms.
 */
export type {
  ActionLocation,
  ActionComponent,
  ActionType,
  ObjectUiLocalActionType,
  RunnableActionType,
  ActionParamFieldType,
  ObjectUiLocalParamFieldType,
  ResolvableParamFieldType,
  ActionParam,
  ActionSchema as UIActionSchema,
  ActionGroup,
  ActionContext,
  ActionResult,
  ActionExecutor,
  BatchOperationConfig,
  BatchOperationSummary,
  TransactionIsolationLevel,
  TransactionConfig,
  TransactionResult,
  UndoRedoEntry,
  UndoRedoConfig,
  UndoRedoState,
} from './ui-action.js';

export {
  ACTION_LOCATIONS,
  ActionLocationSchema,
  OBJECTUI_LOCAL_ACTION_TYPES,
  OBJECTUI_LOCAL_PARAM_FIELD_TYPES,
  ACTION_PARAM_FIELD_TYPES,
  actionRendersAt,
} from './ui-action.js';

// ============================================================================
// ObjectStack Protocol Namespaces - Protocol Re-exports
// ============================================================================
/**
 * Re-export ObjectStack Protocol namespaces for convenience.
 * 
 * This allows consumers to access the full ObjectStack protocol through
 * @object-ui/types without needing to install @objectstack/spec separately.
 * 
 * @example
 * ```typescript
 * import { Data, UI, System, AI, API, Kernel } from '@object-ui/types';
 * 
 * const field: Data.Field = { name: 'task_name', type: 'text' };
 * const view: UI.ListView = { name: 'all', label: 'All Records', ... };
 * ```
 */
export type * as Data from '@objectstack/spec/data';
// Deliberate public namespace export of the spec vocabulary — via the local
// shim module since objectui#5716, so the `UI.Theme`-family members are
// re-pointed at their owner (`./theme.ts`) and survive the spec's theme
// retirement instead of narrowing silently on the pin refresh. See the shim's
// header for the full reasoning. The #4171 caveat still applies:
// `UI.FormField` erases to `any` until the spec types its unions.
export type * as UI from './spec-ui-namespace.js';
export type * as System from '@objectstack/spec/system';
export type * as AI from '@objectstack/spec/ai';
export type * as API from '@objectstack/spec/api';
export type * as Cloud from '@objectstack/spec/cloud';
export type * as Automation from '@objectstack/spec/automation';
export type * as Shared from '@objectstack/spec/shared';
export type * as QA from '@objectstack/spec/qa';
export type * as Kernel from '@objectstack/spec/kernel';
export type * as Contracts from '@objectstack/spec/contracts';
export type * as Integration from '@objectstack/spec/integration';
export type * as Studio from '@objectstack/spec/studio';
export type * as Identity from '@objectstack/spec/identity';
export type * as Security from '@objectstack/spec/security';

// ============================================================================
// ObjectStack Protocol Utilities - defineStack
// ============================================================================
/**
 * Re-export ObjectStack Protocol utility functions and top-level types.
 *
 * @example
 * ```typescript
 * import { defineStack } from '@object-ui/types';
 *
 * export default defineStack({
 *   manifest: { id: 'com.example.app', version: '1.0.0', type: 'app', name: 'My App' },
 *   objects: [],
 *   apps: [],
 * });
 * ```
 */
export {
  defineStack,
  ObjectStackSchema,
  ObjectStackDefinitionSchema,
} from '@objectstack/spec';

export type {
  PluginContext,
  ObjectStack,
  ObjectStackDefinition,
} from '@objectstack/spec';

// ----------------------------------------------------------------------------
// NOTE (#2561): the `@objectstack/spec/ui` blocks below re-export the inferred
// *types* only. The companion zod validators (`…Schema`) are deliberately NOT
// re-exported: inside `export type { … }` they were value-erased, so importing
// one as a value from `@object-ui/types` silently yielded `undefined` at
// runtime. Consumers that need the runtime validators must import them from
// `@objectstack/spec/ui` directly. Guardrail:
// `src/__tests__/spec-ui-schema-reexports.test.ts`.
// ----------------------------------------------------------------------------

// ============================================================================
// v2.0.7 Spec UI Types — Drag and Drop / Focus & Keyboard / Animation & Motion
// ============================================================================
// RETIRED in @objectstack/spec 17.0.0-rc.3 (objectstack#4988, PR objectstack#5321):
// the five `ui/` interaction-config modules (touch / dnd / keyboard / animation /
// offline) were deleted whole — 32 defs, 64 exports. None of these blocks had an
// authoring door: no metadata document could ever carry one, so a stack that
// parsed before the retirement parses byte-for-byte the same after it, and the
// re-exports below were type-only surface with no runtime half to lose.
//
// The `DndConfig` / `KeyboardShortcut` names still live in this repo as LOCAL
// declarations in `@object-ui/core`'s `DndProtocol.ts` / `KeyboardProtocol.ts`.
// Those never imported the spec — the collision is a naming coincidence, not a
// coupling, and they are deliberately untouched (objectui#3363).

// ============================================================================
// v2.0.7 Spec UI Types — Notifications
// ============================================================================
/**
 * The PRESENTATION vocabulary only. `@objectstack/spec/ui` dropped the two
 * composite notification types in 17.0.0 (objectstack#4610): `Notification`
 * (a toast/banner instance shape) and `NotificationConfig` (a toaster global
 * config). Neither has a successor anywhere in the spec.
 *
 * Do NOT re-point `Notification` at `@objectstack/spec/api`. That name now has
 * exactly one owner, and it is a DIFFERENT contract — the REST inbox row
 * (`id` / `type` / `title` / `body` / `read` / `data` / `actionUrl` /
 * `createdAt`), with none of `severity` / `duration` / `dismissible` /
 * `actions` / `position`. Same name, different shape: aliasing it here would
 * re-create the very dual-source trap #4610 closed.
 *
 * The live objectui equivalent of the removed config is
 * `NotificationSystemConfig` in `@object-ui/react`'s `NotificationContext`,
 * which is declared locally and is what every surface actually reads.
 *
 * `NotificationAction` left the same way in 17.0.0-rc.3 (objectstack#5015, PR
 * objectstack#5300): no notification action was ever parsed from metadata, so
 * nothing regressed at runtime. The three PRESENTATION enums below survive and
 * are the toaster vocabulary this repo actually reads.
 */
export type {
  NotificationPosition,
  NotificationSeverity,
  NotificationType,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Gestures & Touch / Offline & Sync
// ============================================================================
// RETIRED with the same objectstack#4988 / PR objectstack#5321 deletion as the
// interaction blocks above. `@object-ui/react`'s `useOffline` is the real owner
// of the offline semantics and now declares its own types locally, which is the
// remediation the spec's own retirement ledger prescribes for a client that
// consumed these as types: "it is your client's policy, not the platform's".
//
// Note `@objectstack/spec/integration`'s `ConnectorConflictResolution` and
// `@objectstack/spec/api`'s `ConflictResolutionStrategy` are DIFFERENT concepts
// and are untouched — do not re-point the deleted `ConflictResolution` at them.

// ============================================================================
// v2.0.7 Spec UI Types — View Enhancements
// ============================================================================
export type {
  ColumnSummary,
  GalleryConfig,
  GroupingConfig,
  RowColorConfig,
  RowHeight,
  TimelineConfig,
  NavigationConfig,
  ViewSharing,
} from '@objectstack/spec/ui';

// ============================================================================
// v3.0.8 Spec UI Types — Dashboard (P1.3)
// ============================================================================
export type {
  Dashboard as SpecDashboard,
  DashboardWidget as SpecDashboardWidget,
  DashboardHeader as SpecDashboardHeader,
  DashboardHeaderAction as SpecDashboardHeaderAction,
  GlobalFilter as SpecGlobalFilter,
  GlobalFilterOptionsFrom,
  // WidgetMeasure / WidgetMeasureSchema removed in @objectstack/spec 9.0
  // (ADR-0021 single-form cutover) — dashboard widgets are dataset-bound now.
  WidgetColorVariant,
} from '@objectstack/spec/ui';

// ============================================================================
// v3.0.8 Spec UI Types — Sharing & Embedding (P2.3)
// ============================================================================
// `EmbedConfig` RETIRED in 17.0.0-rc.3 (objectstack#5015, PR objectstack#5300):
// no iframe route ever read an embed config, so nothing ran to regress.
// `SharingConfig` is the SURVIVOR and stays — public form sharing is unaffected,
// `FormView.sharing` still gates the anonymous endpoints on `allowAnonymous` +
// `publicLink`.
export type { SharingConfig } from '@objectstack/spec/ui';

// ============================================================================
// v3.0.8 Spec UI Types — View Configuration (P2.4)
// ============================================================================
export type {
  AddRecordConfig,
  AppearanceConfig,
  UserActionsConfig,
  ViewTab,
} from '@objectstack/spec/ui';

// ============================================================================
// v3.0.10 Spec UI Types — View Filter Rules
// ============================================================================
export type {
  ViewFilterRule,
} from '@objectstack/spec/ui';

// ============================================================================
// v3.0.8 Spec UI Types — Form View (P1.2)
// ============================================================================
// Deliberate public aliases (the `Spec` prefix IS the disambiguation the
// #3090 tripwire exists to force). #4171 caveat: SpecFormField is `any` today.
/* eslint-disable no-restricted-imports -- reported at the specifier line, out of -next-line reach */
export type {
  FormView as SpecFormView,
  FormSection as SpecFormSection,
  FormField as SpecFormField,
} from '@objectstack/spec/ui';
/* eslint-enable no-restricted-imports */

// ============================================================================
// v3.0.8 Spec UI Types — ListView (P1.1)
// ============================================================================
export type {
  ListView as SpecListView,
  ListColumn as SpecListColumn,
} from '@objectstack/spec/ui';

// ============================================================================
// v3.0.8 Spec UI Types — Record Components (P1.5)
// ============================================================================
export type {
  RecordDetailsProps as SpecRecordDetailsProps,
  RecordHighlightsProps as SpecRecordHighlightsProps,
  RecordRelatedListProps as SpecRecordRelatedListProps,
  RecordActivityProps as SpecRecordActivityProps,
  RecordChatterProps as SpecRecordChatterProps,
  RecordPathProps as SpecRecordPathProps,
} from '@objectstack/spec/ui';

// ============================================================================
// v3.0.8 Spec UI Types — Page (P1.4)
// ============================================================================
export type {
  Page as SpecPage,
  PageComponent as SpecPageComponent,
  PageRegion as SpecPageRegion,
  PageType as SpecPageType,
  PageVariable as SpecPageVariable,
  // BlankPageLayout{,Schema,Item,ItemSchema} dropped — `blank` page type has no
  // renderer; removed from @objectstack/spec PageTypeSchema (framework#2265).
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Performance & Page Transitions
// ============================================================================
// `PerformanceConfig` was RETIRED here with `dashboard.performance` in spec
// 17.0.0 (framework#3896 audit close-out): no renderer or runtime ever read the
// key, and its value schema had no other consumer, so it went with it. Nothing
// in this repo bound to the spec type — `@object-ui/react`'s `usePerformance`
// declares its own `PerformanceConfig` interface and is untouched.
//
// `PageTransition` went the same way one rc later, as part of the `ui/animation`
// module deletion (objectstack#4988, PR objectstack#5321).
export type { PageComponentType } from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Accessibility
// ============================================================================
export type {
  AriaProps,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — I18n
// ============================================================================
// `I18nObject`, `LocaleConfig`, `PluralRule`, `DateFormat` and `NumberFormat`
// (and their `…Schema` values) were retired from `@objectstack/spec/ui` in
// 17.0.0-rc.6. Nothing in this repo imported them from here — the only names
// that looked like consumers are `Intl.NumberFormat` call sites and
// `@object-ui/i18n`'s own locally declared formatter vocabulary in
// `utils/spec-formatters.ts`, which never bound the spec symbols. So these five
// were dead re-exports and are dropped rather than re-declared locally.
// `I18nLabel` SURVIVES rc.6 and stays bound by reference: it is the authoring
// label union (`string | Record<string, string>`) that `ActionParam.label` and
// friends are typed against, and rc.6 additionally publishes the inline-map
// half as `InlineLocaleMap` plus the shared `resolveI18nLabel` resolver.
export type {
  I18nLabel,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Responsive Design
// ============================================================================
export type {
  ResponsiveConfig as SpecResponsiveConfig,
  BreakpointName as SpecBreakpointName,
  // BreakpointColumnMapSchema / BreakpointOrderMapSchema dropped without a
  // replacement: they are zod values (value-erased here, #2561) and the spec
  // exports no companion inferred type for them.
} from '@objectstack/spec/ui';

// ============================================================================
// Widget System - Runtime Widget Registration (Section 1.6)
// ============================================================================
/**
 * Widget manifest and registry types for runtime widget registration,
 * plugin auto-discovery, and custom widget registry.
 */
export type {
  RuntimeWidgetManifest,
  RuntimeWidgetSource,
  WidgetSourceModule,
  WidgetSourceInline,
  WidgetSourceRegistry,
  WidgetInput,
  WidgetCapabilities,
  ResolvedWidget,
  WidgetRegistryEvent,
  WidgetRegistryListener,
} from './widget.js';

export { errorCodeIs, errorCodeIsAnyOf } from './error-code.js';

// Transient-HTTP-retry primitives, shared by the two `/auth/me/*` providers
// (permissions is fail-closed and blocks across the waits, localization is
// cosmetic and never blocks) so "what counts as transient" has ONE definition.
export {
    MAX_RETRY_DELAY_MS,
    TRANSIENT_STATUS,
    HttpFetchError,
    isTransientFailure,
    parseRetryAfterMs,
    backoffMs,
    sleep,
    retryAfterFrom,
} from './http-retry.js';

// In-flight sharing for identical GETs (objectui#5544). Same argument for the
// same home: the callers that overlap — the pre-React branding script, app-shell's
// runtime config, the language seed and the localization provider — have no
// package in common lower than this one. Shares the PROMISE only; the entry is
// gone the moment the request settles, so nothing here is a cache.
export {
    INFLIGHT_GET_REGISTRY_KEY,
    inflightGetKey,
    sharedGetJson,
    resetInflightGetsForTesting,
} from './http-inflight.js';
