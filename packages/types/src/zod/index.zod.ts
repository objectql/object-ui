/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Zod Validation Schemas
 * 
 * Complete Zod validation schemas for all ObjectUI components.
 * Following @objectstack/spec UI specification format.
 * 
 * ## Usage
 * 
 * ```typescript
 * import { ButtonSchema, InputSchema, FormSchema } from '@object-ui/types/zod';
 * 
 * // Validate a schema
 * const result = ButtonSchema.safeParse({
 *   type: 'button',
 *   label: 'Click Me',
 *   variant: 'primary',
 * });
 * 
 * if (result.success) {
 *   console.log('Valid schema:', result.data);
 * } else {
 *   console.error('Validation errors:', result.error);
 * }
 * ```
 * 
 * @packageDocumentation
 */

// ============================================================================
// Application - Global Configuration
// ============================================================================
export {
  AppSchema,
  AppActionSchema,
  MenuItemSchema as AppMenuItemSchema,
} from './app.zod.js';

// ============================================================================
// Base Schema - Foundation
// ============================================================================
export {
  BaseSchema,
  SchemaNodeSchema,
  ComponentInputSchema,
  ComponentMetaSchema,
  ComponentConfigSchema,
  HTMLAttributesSchema,
  EventHandlersSchema,
  StylePropsSchema,
} from './base.zod.js';

// ============================================================================
// Layout Components - Structure & Organization
// ============================================================================
export {
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
  TabItemSchema,
  TabsSchema,
  ScrollAreaSchema,
  ResizablePanelSchema,
  ResizableSchema,
  AspectRatioSchema,
  PageSchema,
  LayoutSchema,
} from './layout.zod.js';

// ============================================================================
// Form Components - User Input & Interaction
// ============================================================================
export {
  SelectOptionSchema,
  RadioOptionSchema,
  ComboboxOptionSchema,
  CommandItemSchema,
  CommandGroupSchema,
  ValidationRuleSchema,
  FieldConditionSchema,
  ButtonSchema,
  InputSchema,
  TextareaSchema,
  SelectSchema,
  CheckboxSchema,
  RadioGroupSchema,
  SwitchSchema,
  ToggleSchema,
  SliderSchema,
  FileUploadSchema,
  DatePickerSchema,
  CalendarSchema,
  InputOTPSchema,
  ComboboxSchema,
  LabelSchema,
  CommandSchema,
  FormFieldSchema,
  FormSchema,
  FormComponentSchema,
} from './form.zod.js';

// ============================================================================
// Data Display Components - Information Presentation
// ============================================================================
export {
  AlertSchema,
  StatisticSchema,
  BadgeSchema,
  AvatarSchema,
  ListItemSchema,
  ListSchema,
  TableColumnSchema,
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeNodeSchema,
  TreeViewSchema,
  ChartTypeSchema,
  ChartSeriesSchema,
  ChartSchema,
  TimelineEventSchema,
  TimelineSchema,
  KbdSchema,
  HtmlSchema,
  DataDisplaySchema,
} from './data-display.zod.js';

// ============================================================================
// Feedback Components - Status & Progress Indication
// ============================================================================
export {
  LoadingSchema,
  ProgressSchema,
  SkeletonSchema,
  ToastSchema,
  ToasterSchema,
  SpinnerSchema,
  EmptySchema,
  SonnerSchema,
  FeedbackSchema,
} from './feedback.zod.js';

// ============================================================================
// Disclosure Components - Collapsible Content
// ============================================================================
export {
  AccordionItemSchema,
  AccordionSchema,
  CollapsibleSchema,
  ToggleGroupItemSchema,
  ToggleGroupSchema,
  DisclosureSchema,
} from './disclosure.zod.js';

// ============================================================================
// Overlay Components - Modals & Popovers
// ============================================================================
export {
  DialogSchema,
  AlertDialogSchema,
  SheetSchema,
  DrawerSchema,
  PopoverSchema,
  TooltipSchema,
  HoverCardSchema,
  MenuItemSchema,
  DropdownMenuSchema,
  ContextMenuSchema,
  MenubarMenuSchema,
  MenubarSchema,
  OverlaySchema,
} from './overlay.zod.js';

// ============================================================================
// Navigation Components - Menus & Navigation
// ============================================================================
export {
  NavLinkSchema,
  HeaderBarSchema,
  SidebarSchema,
  PaginationSchema,
  NavigationMenuItemSchema,
  NavigationMenuSchema,
  ButtonGroupButtonSchema,
  ButtonGroupSchema,
  NavigationSchema,
} from './navigation.zod.js';

// ============================================================================
// Complex Components - Advanced/Composite Components
// ============================================================================
export {
  KanbanCardSchema,
  KanbanColumnSchema,
  KanbanSchema,
  CalendarViewModeSchema,
  CalendarEventSchema,
  CalendarViewSchema,
  FilterOperatorSchema,
  FilterConditionSchema,
  FilterGroupSchema,
  FilterFieldSchema,
  FilterBuilderSchema,
  CarouselItemSchema,
  CarouselSchema,
  ChatMessageSchema,
  ChatbotSchema,
  DashboardWidgetLayoutSchema,
  DashboardWidgetSchema,
  DashboardSchema,
  ComplexSchema,
} from './complex.zod.js';

// ============================================================================
// ObjectQL Components - Smart Data Components
// ============================================================================
export {
  HttpMethodSchema,
  HttpRequestSchema,
  ViewDataSchema,
  ListColumnSchema,
  SelectionConfigSchema,
  PaginationConfigSchema,
  SortConfigSchema,
  ObjectGridSchema,
  ObjectFormSchema,
  ObjectViewSchema,
  ObjectMapSchema,
  ObjectGanttSchema,
  ObjectCalendarSchema,
  ObjectKanbanSchema,
  ObjectChartSchema,
  ListViewSchema,
  ObjectQLComponentSchema,
} from './objectql.zod.js';

// ============================================================================
// CRUD Components - Create, Read, Update, Delete Operations
// ============================================================================
export {
  ActionExecutionModeSchema,
  ActionCallbackSchema,
  ActionConditionSchema,
  ActionSchema,
  CRUDOperationSchema,
  CRUDFilterSchema,
  CRUDToolbarSchema,
  CRUDPaginationSchema,
  CRUDSchema,
  DetailSchema,
  CRUDDialogSchema,
  CRUDComponentSchema,
} from './crud.zod.js';

// ============================================================================
// Phase 2 Schemas - Theme, Reports, Blocks, and Views
// ============================================================================
export {
  ColorPaletteSchema,
  TypographySchema,
  SpacingScaleSchema,
  BorderRadiusSchema,
  ThemeModeSchema,
  ThemeDefinitionSchema,
  ThemeSchema,
  ThemeSwitcherSchema,
  ThemePreviewSchema,
  ThemeComponentSchema,
} from './theme.zod.js';

export {
  ReportExportFormatSchema,
  ReportScheduleFrequencySchema,
  ReportAggregationTypeSchema,
  ReportFieldSchema,
  ReportFilterSchema,
  ReportGroupBySchema,
  ReportSectionSchema,
  ReportScheduleSchema,
  ReportExportConfigSchema,
  ReportSchema,
  ReportBuilderSchema,
  ReportViewerSchema,
  ReportComponentSchema,
} from './reports.zod.js';

export {
  BlockVariableSchema,
  BlockSlotSchema,
  BlockMetadataSchema,
  BlockSchema,
  BlockLibraryItemSchema,
  BlockLibrarySchema,
  BlockEditorSchema,
  BlockInstanceSchema,
  ComponentSchema,
  BlockComponentSchema,
} from './blocks.zod.js';

export {
  ViewTypeSchema,
  DetailViewFieldSchema,
  DetailViewSectionSchema,
  DetailViewTabSchema,
  DetailViewSchema,
  ViewSwitcherSchema,
  FilterUISchema,
  SortUISchema,
  ViewComponentSchema,
} from './views.zod.js';

// ============================================================================
// Functional Design Schemas - FUNCTIONAL_DESIGN.md Component Specifications
// ============================================================================
export {
  // Foundation Components
  TextSchema as FDTextSchema,
  EnhancedButtonSchema,
  IconSchema as FDIconSchema,
  ImageSchema as FDImageSchema,
  SeparatorSchema as FDSeparatorSchema,
  
  // Layout Components
  ContainerSchema as FDContainerSchema,
  FlexSchema as FDFlexSchema,
  GridSchema as FDGridSchema,
  CardSchema as FDCardSchema,
  TabItemSchema as FDTabItemSchema,
  TabsSchema as FDTabsSchema,
  
  // Form Components
  ValidationRuleSchema as FDValidationRuleSchema,
  EnhancedInputSchema,
  TextareaSchema as FDTextareaSchema,
  SelectOptionSchema as FDSelectOptionSchema,
  EnhancedSelectSchema,
  CheckboxSchema as FDCheckboxSchema,
  RadioOptionSchema as FDRadioOptionSchema,
  RadioGroupSchema as FDRadioGroupSchema,
  SwitchSchema as FDSwitchSchema,
  SliderSchema as FDSliderSchema,
  DatePickerSchema as FDDatePickerSchema,
  FileMetadataSchema,
  FileUploadSchema as FDFileUploadSchema,
  FormFieldSchema as FDFormFieldSchema,
  FormSchema as FDFormSchema,
  
  // Data Display Components
  TableColumnSchema as FDTableColumnSchema,
  TablePaginationSchema,
  TableSchema as FDTableSchema,
  ListSchema as FDListSchema,
  BadgeSchema as FDBadgeSchema,
  AvatarSchema as FDAvatarSchema,
  StatisticSchema as FDStatisticSchema,
  AlertSchema as FDAlertSchema,
  TimelineEventSchema as FDTimelineEventSchema,
  TimelineSchema as FDTimelineSchema,
  
  // Feedback Components
  ToastSchema as FDToastSchema,
  ProgressSchema as FDProgressSchema,
  SpinnerSchema as FDSpinnerSchema,
  SkeletonSchema as FDSkeletonSchema,
  EmptySchema as FDEmptySchema,
  
  // Disclosure Components
  AccordionItemSchema as FDAccordionItemSchema,
  AccordionSchema as FDAccordionSchema,
  CollapsibleSchema as FDCollapsibleSchema,
  ToggleItemSchema,
  ToggleGroupSchema as FDToggleGroupSchema,
  
  // Overlay Components
  DialogSchema as FDDialogSchema,
  SheetSchema as FDSheetSchema,
  PopoverSchema as FDPopoverSchema,
  TooltipSchema as FDTooltipSchema,
  MenuItemSchema as FDMenuItemSchema,
  DropdownMenuSchema as FDDropdownMenuSchema,
  
  // Navigation Components
  BreadcrumbItemSchema as FDBreadcrumbItemSchema,
  BreadcrumbSchema,
  PaginationSchema as FDPaginationSchema,
  NavLinkSchema as FDNavLinkSchema,
  SidebarSchema as FDSidebarSchema,
  HeaderBarSchema as FDHeaderBarSchema,
  
  // Complex Components
  DashboardWidgetLayoutSchema as FDDashboardWidgetLayoutSchema,
  DashboardWidgetSchema as FDDashboardWidgetSchema,
  DashboardSchema as FDDashboardSchema,
  KanbanCardSchema as FDKanbanCardSchema,
  KanbanColumnSchema as FDKanbanColumnSchema,
  KanbanSchema as FDKanbanSchema,
  CalendarEventSchema as FDCalendarEventSchema,
  CalendarViewSchema as FDCalendarViewSchema,
  ChatMessageSchema as FDChatMessageSchema,
  ChatbotSchema as FDChatbotSchema,
  
  // Business Components
  ListColumnSchema as FDListColumnSchema,
  AdvancedFilterConditionSchema,
  QuerySortConfigSchema,
  ObjectGridSchema as FDObjectGridSchema,
  ObjectFormSchema as FDObjectFormSchema,
  ListViewSchema as FDListViewSchema,
  
  // Complete schema union
  FunctionalDesignComponentSchema,
  CompleteFunctionalDesignSchema,
  type FunctionalDesignComponent,
  type CompleteFunctionalDesignComponent,
} from './functional-design.zod.js';

// ============================================================================
// Union Types - All Component Schemas
// ============================================================================

import { z } from 'zod';
import { AppSchema } from './app.zod.js';
import { LayoutSchema } from './layout.zod.js';
import { FormComponentSchema } from './form.zod.js';
import { DataDisplaySchema } from './data-display.zod.js';
import { FeedbackSchema } from './feedback.zod.js';
import { DisclosureSchema } from './disclosure.zod.js';
import { OverlaySchema } from './overlay.zod.js';
import { NavigationSchema } from './navigation.zod.js';
import { ComplexSchema } from './complex.zod.js';
import { ObjectQLComponentSchema } from './objectql.zod.js';
import { CRUDComponentSchema } from './crud.zod.js';
import { ThemeComponentSchema } from './theme.zod.js';
import { ReportComponentSchema } from './reports.zod.js';
import { BlockComponentSchema } from './blocks.zod.js';
import { ViewComponentSchema } from './views.zod.js';

/**
 * Union of all component schemas.
 * Use this for generic component rendering where the type is determined at runtime.
 */
export const AnyComponentSchema = z.union([
  AppSchema,
  LayoutSchema,
  FormComponentSchema,
  DataDisplaySchema,
  FeedbackSchema,
  DisclosureSchema,
  OverlaySchema,
  NavigationSchema,
  ComplexSchema,
  ObjectQLComponentSchema,
  CRUDComponentSchema,
  ThemeComponentSchema,
  ReportComponentSchema,
  BlockComponentSchema,
  ViewComponentSchema,
]);

/**
 * Validate a schema against the AnyComponentSchema
 * 
 * @param schema - The schema to validate
 * @returns The validated and typed schema
 * @throws ZodError if validation fails
 * 
 * @example
 * ```typescript
 * import { validateSchema } from '@object-ui/types/zod';
 * 
 * try {
 *   const validSchema = validateSchema({
 *     type: 'button',
 *     label: 'Click Me',
 *   });
 *   console.log('Valid schema:', validSchema);
 * } catch (error) {
 *   console.error('Validation failed:', error);
 * }
 * ```
 */
export function validateSchema(schema: unknown) {
  return AnyComponentSchema.parse(schema);
}

/**
 * Safely validate a schema without throwing errors
 * 
 * @param schema - The schema to validate
 * @returns Object with success boolean and either data or error
 * 
 * @example
 * ```typescript
 * import { safeValidateSchema } from '@object-ui/types/zod';
 * 
 * const result = safeValidateSchema({
 *   type: 'button',
 *   label: 'Click Me',
 * });
 * 
 * if (result.success) {
 *   console.log('Valid schema:', result.data);
 * } else {
 *   console.error('Validation errors:', result.error);
 * }
 * ```
 */
export function safeValidateSchema(schema: unknown) {
  return AnyComponentSchema.safeParse(schema);
}

/**
 * Version information
 */
export const SCHEMA_VERSION = '1.0.0';
