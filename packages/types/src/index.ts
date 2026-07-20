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
  AppSchema,
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
} from './app';
export { menuItemToNavigationItem, isValidAppName, wizardDraftToAppSchema } from './app';

// Object-level semantic-role readers (ADR-0085), shared across surfaces.
export { detectStatusField } from './record-semantics';
export type { StatusFieldSource } from './record-semantics';

// ============================================================================
// Base Types - The Foundation
// ============================================================================
export type {
  BaseSchema,
  SchemaNode,
  ComponentRendererProps,
  ComponentInput,
  ComponentMeta,
  ComponentConfig,
  HTMLAttributes,
  EventHandlers,
  StyleProps,
} from './base';

// ============================================================================
// Layout Components - Structure & Organization
// ============================================================================
export type {
  DivSchema,
  SpanSchema,
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
  PageSchema,
  PageSlotMap,
  PageType,
  PageRegion,
  PageRegionWidth,
  PageVariable,
} from './layout';

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
  ValidationRule,
  FieldCondition,
  FormField,
  ComboboxSchema,
  CommandSchema,
  InputOTPSchema,
  ToggleSchema,
  FormSchema,
  LabelSchema,
  FormComponentSchema,
} from './form';

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
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeNode,
  TreeViewSchema,
  ChartType,
  ChartSeries,
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
} from './data-display';

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
} from './feedback';

// ============================================================================
// Disclosure Components - Collapsible Content
// ============================================================================
export type {
  AccordionItem,
  ToggleGroupSchema,
  AccordionSchema,
  CollapsibleSchema,
  DisclosureSchema,
} from './disclosure';

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
} from './overlay';

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
} from './navigation';

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
  FilterOperator,
  FilterCondition,
  FilterGroup,
  FilterBuilderSchema,
  FilterField,
  CarouselItem,
  CarouselSchema,
  DashboardWidgetLayout,
  DashboardWidgetSchema,
  DashboardSchema,
  ChatMessage,
  ChatMessageSource,
  ChatToolInvocation,
  ChatbotSchema,
  FloatingChatbotConfig,
  ComplexSchema,
} from './complex';

// ============================================================================
// Data Management - Backend Integration
// ============================================================================
export type {
  QueryParams,
  QueryResult,
  DataSource,
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
  MutationEvent,
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
} from './data';

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
} from './crud';

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
  ObjectGanttSchema,
  ObjectCalendarSchema,
  ObjectKanbanSchema,
  KanbanConditionalFormattingRule,
  KanbanNativeConditionalFormattingRule,
  ObjectChartSchema,
  ListViewSchema,
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
} from './objectql';

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
} from './record-components';

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
  FileMetadata,
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
  ObjectPermission,
  SharingRule,
  ObjectSchemaMetadata,
  ObjectIndex,
  ObjectRelationship,
} from './field-types';

// System / audit / ownership field classification — runtime helper + name set,
// used by default list-column derivation to keep framework-injected fields
// (notably `owner_id`) out of the leading business columns.
export { SYSTEM_MANAGED_FIELD_NAMES, isSystemManagedField } from './system-fields';
export { MANAGED_BY_BUCKETS } from './managed-by';
export type { ManagedByBucket } from './managed-by';

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
  GroupByNode,
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
  QueryAST,
  QuerySchema,
  QuerySortConfig,
  JoinConfig,
  AggregationConfig,
  WindowConfig,
  // Filter Schema (Phase 3.4)
  AdvancedFilterSchema,
  AdvancedFilterCondition,
  AdvancedFilterOperator,
  DateRangeFilter,
  DateRangePreset,
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
  // ObjectStack Spec v2.0.1 Validation
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
  DriverInterface,
  ConnectionConfig,
  DriverQueryResult,
  BatchOperation,
  BatchResult,
  TransactionContext,
  CacheManager,
  ConnectionPool,
  // Datasource Schema (Phase 3.7)
  DatasourceSchema,
  DatasourceType,
  DatasourceMetric,
  DatasourceAlert,
  DatasourceManager,
  HealthCheckResult,
  DatasourceMetrics,
} from './data-protocol';

// ============================================================================
// Permission & RBAC Types (Q2 2026)
// ============================================================================
export type {
  PermissionAction,
  PermissionEffect,
  RoleDefinition,
  ObjectLevelPermission,
  FieldLevelPermission,
  RowLevelPermission,
  PermissionCondition,
  ObjectPermissionConfig,
  SharingRuleConfig,
  PermissionCheckResult,
  PermissionContext,
  PermissionGuardConfig,
} from './permissions';

// ============================================================================
// Mobile Optimization Types (Q2 2026)
// ============================================================================
export type {
  BreakpointName,
  ResponsiveValue,
  ResponsiveConfig,
  MobileOverrides,
  PWAConfig,
  PWAIcon,
  CacheStrategy,
  OfflineConfig,
  OfflineRoute,
  GestureType,
  GestureConfig,
  GestureContext,
  MobileComponentConfig,
} from './mobile';

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
} from './designer';

export {
  DASHBOARD_COLOR_VARIANTS,
  DASHBOARD_WIDGET_TYPES,
} from './designer';

// ============================================================================
// API and Events - API Integration and Event Handling
// ============================================================================
export type {
  HTTPMethod,
  APIRequest,
  APIConfig,
  EventHandler,
  EventableSchema,
  DataFetchConfig,
  DataFetchableSchema,
  ExpressionContext,
  ExpressionSchema,
  APISchema,
} from './api-types';

// ============================================================================
// Union Types - Discriminated Unions for All Schemas
// ============================================================================

import type { BaseSchema, SchemaNode } from './base';
import type { LayoutSchema, PageSchema } from './layout';
import type { FormComponentSchema } from './form';
import type { DataDisplaySchema } from './data-display';
import type { FeedbackSchema } from './feedback';
import type { DisclosureSchema } from './disclosure';
import type { OverlaySchema } from './overlay';
import type { NavigationSchema } from './navigation';
import type { ComplexSchema, DashboardSchema } from './complex';
import type { CRUDComponentSchema } from './crud';
import type { ObjectQLComponentSchema, ListViewSchema } from './objectql';
import type { AppSchema } from './app';

// ============================================================================
// Phase 2 Schemas - New Additions
// ============================================================================
export type {
  // Theme System (aligned with @objectstack/spec)
  Theme,
  ThemeSchema,
  ThemeMode,
  ColorPalette,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
  Breakpoints,
  Animation,
  ZIndex,
  ThemeLogo,
  ThemeSwitcherSchema,
  ThemePreviewSchema,
  // Legacy aliases
  ThemeDefinition,
  SpacingScale,
} from './theme';

export type {
  // Report Presentation Layer (ObjectUI-specific UX enhancements:
  // sections, schedule, export presets, conditional formatting, etc.).
  // For the protocol-level Report definition, use `Spec*` exports below.
  ReportSchema,
  ReportType,
  ReportExportFormat,
  ReportScheduleFrequency,
  ReportAggregationType,
  ReportField,
  ReportFilter,
  ReportGroupBy,
  ReportSection,
  ReportSchedule,
  ReportExportConfig,
  ReportBuilderSchema,
  ReportViewerSchema,
} from './reports';

// ---------------------------------------------------------------------------
// Spec Report Bridge
//
// Authoritative report protocol from @objectstack/spec, re-exported under
// `Spec*` names so they coexist with the legacy presentation `ReportSchema`.
// See `./spec-report.ts` for the layering rationale.
// ---------------------------------------------------------------------------
export type {
  SpecReportInput,
  SpecReportColumn,
  SpecReportColumnInput,
  SpecReportGrouping,
  SpecReportGroupingInput,
  SpecReportChart,
  SpecReportChartInput,
  SpecReportTypeName,
  SpecReportAggregate,
  SpecReportDateGranularity,
  QLAggregationFunction,
  LegacyReportPresentationLike,
  JoinedReportBlock,
  JoinedSpecReport,
} from './spec-report';

export {
  SpecReportSchema,
  SpecReportColumnSchema,
  SpecReportGroupingSchema,
  SpecReportChartSchema,
  SpecReportTypeEnum,
  SpecReport,
  mapAggregateToQL,
  specReportToPresentation,
  isSpecReport,
  isJoinedSpecReport,
} from './spec-report';

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
} from './ai';

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
} from './blocks';

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
} from './views';

export type {
  // Enhanced Action System (Phase 2)
  ActionExecutionMode,
  ActionCallback,
  ActionCondition,
} from './crud';

/**
 * Union of all component schemas.
 * Use this for generic component rendering where the type is determined at runtime.
 */
export type AnySchema =
  | AppSchema 
  | BaseSchema
  | LayoutSchema
  | PageSchema
  | FormComponentSchema
  | DataDisplaySchema
  | FeedbackSchema
  | DisclosureSchema
  | OverlaySchema
  | NavigationSchema
  | ComplexSchema
  | DashboardSchema
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
} from './registry';

// ============================================================================
// Plugin Scope Isolation - Section 3.3
// ============================================================================
export type {
  PluginScope,
  PluginScopeConfig,
  AppPluginContext,
  AppMetadataPlugin,
  ComponentMeta as PluginComponentMeta,
  ComponentInput as PluginComponentInput,
  PluginEventHandler,
} from './plugin-scope';

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
  ActionParam,
  ActionSchema as UIActionSchema,
  ActionGroup,
  ActionContext,
  ActionResult,
  ActionExecutor,
  BatchOperationConfig,
  BatchOperationResult,
  TransactionIsolationLevel,
  TransactionConfig,
  TransactionResult,
  UndoRedoEntry,
  UndoRedoConfig,
  UndoRedoState,
} from './ui-action';

export { ACTION_LOCATIONS, ActionLocationSchema } from './ui-action';

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
export type * as UI from '@objectstack/spec/ui';
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
  ObjectStackCapabilitiesSchema,
  ObjectOSCapabilitiesSchema,
  ObjectQLCapabilitiesSchema,
  ObjectUICapabilitiesSchema,
} from '@objectstack/spec';

export type {
  PluginContext,
  ObjectStack,
  ObjectStackDefinition,
  ObjectStackCapabilities,
  ObjectOSCapabilities,
  ObjectQLCapabilities,
  ObjectUICapabilities,
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
// v2.0.7 Spec UI Types — Drag and Drop
// ============================================================================
export type {
  DndConfig,
  DragItem,
  DropZone,
  DragConstraint,
  DragHandle,
  DropEffect,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Focus & Keyboard Navigation
// ============================================================================
export type {
  FocusManagement,
  FocusTrapConfig,
  KeyboardNavigationConfig,
  KeyboardShortcut,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Animation & Motion
// ============================================================================
export type {
  ComponentAnimation,
  AnimationTrigger,
  MotionConfig,
  TransitionConfig,
  TransitionPreset,
  EasingFunction,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Notifications
// ============================================================================
export type {
  Notification,
  NotificationConfig,
  NotificationAction,
  NotificationPosition,
  NotificationSeverity,
  NotificationType,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Gestures & Touch
// ============================================================================
export type {
  GestureConfig as SpecGestureConfig,
  GestureType as SpecGestureType,
  SwipeGestureConfig,
  SwipeDirection,
  PinchGestureConfig,
  LongPressGestureConfig,
  TouchInteraction,
  TouchTargetConfig,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Offline & Sync
// ============================================================================
export type {
  OfflineConfig as SpecOfflineConfig,
  OfflineCacheConfig,
  OfflineStrategy,
  SyncConfig,
  ConflictResolution,
  PersistStorage,
  EvictionPolicy,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — View Enhancements
// ============================================================================
export type {
  ColumnSummary,
  GalleryConfig,
  GroupingConfig,
  RowColorConfig,
  RowHeight,
  DensityMode,
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
export type {
  SharingConfig,
  EmbedConfig,
} from '@objectstack/spec/ui';

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
export type {
  FormView as SpecFormView,
  FormSection as SpecFormSection,
  FormField as SpecFormField,
} from '@objectstack/spec/ui';

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
export type {
  PerformanceConfig,
  PageTransition,
  PageComponentType,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — Accessibility
// ============================================================================
export type {
  AriaProps,
  WcagContrastLevel,
} from '@objectstack/spec/ui';

// ============================================================================
// v2.0.7 Spec UI Types — I18n
// ============================================================================
export type {
  I18nLabel,
  I18nObject,
  LocaleConfig,
  PluralRule,
  DateFormat,
  NumberFormat,
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
  WidgetManifest,
  WidgetSource,
  WidgetSourceModule,
  WidgetSourceInline,
  WidgetSourceRegistry,
  WidgetInput,
  WidgetCapabilities,
  ResolvedWidget,
  WidgetRegistryEvent,
  WidgetRegistryListener,
} from './widget';
