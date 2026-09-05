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
  AppComponentSchema,
  AppActionSchema,
  NavigationItemSchema,
  NavigationItemTypeSchema,
  NavigationAreaSchema,
  MenuItemSchema as AppMenuItemSchema,
} from './app.zod.js';

// ============================================================================
// Base Schema - Foundation
// ============================================================================
export {
  BaseSchema,
  SchemaNodeSchema,
  ComponentInputControlTypeSchema,
  ComponentInputSchema,
  ComponentMetaSchema,
  ComponentConfigSchema,
  HTMLAttributesSchema,
  EventHandlersSchema,
  ClassNameStylePropsSchema,
} from './base.zod.js';

// ============================================================================
// Expression wire shape - shared by the predicate keys (objectui#7530)
// ============================================================================
export { ExpressionWireSchema } from './expression.zod.js';

// ============================================================================
// Layout Components - Structure & Organization
// ============================================================================
export {
  DivSchema,
  BoxSchema,
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
  TabItemSchema,
  TabsSchema,
  ScrollAreaSchema,
  ResizablePanelSchema,
  ResizableSchema,
  AspectRatioSchema,
  PageRegionWidthSchema,
  PageNodeRegionSchema,
  PageVariableSchema,
  PageTypeSchema,
  PageNodeSchema,
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
  FieldConstraintsSchema,
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
  CodeEditorSchema,
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
  StaticTableColumnSchema,
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeNodeSchema,
  TreeViewSchema,
  ChartTypeSchema,
  ChartDataSeriesSchema,
  DrillDownConfigSchema,
  ChartSchema,
  TimelineEventSchema,
  TimelineSchema,
  KbdSchema,
  HtmlSchema,
  BarChartSchema,
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
  CardTemplateSchema,
  ColumnWidthConfigSchema,
  KanbanSchema,
  CalendarViewModeSchema,
  CalendarEventSchema,
  CalendarViewSchema,
  FilterOperatorSchema,
  FilterBuilderConditionSchema,
  FilterGroupSchema,
  FilterFieldSchema,
  FilterBuilderSchema,
  CarouselItemSchema,
  CarouselSchema,
  ChatToolInvocationSchema,
  ChatMessageSourceSchema,
  ChatMessageSchema,
  ChatbotSchema,
  ChatbotEnhancedSchema,
  ChatbotFloatingSchema,
  DashboardWidgetLayoutSchema,
  DashboardWidgetTypeSchema,
  DashboardWidgetSchema,
  DashboardComponentSchema,
  DashboardWidgetConfigSchema,
  DashboardConfigSchema,
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
  ObjectMapConfigSchema,
  ObjectGanttSchema,
  ObjectCalendarSchema,
  ObjectKanbanSchema,
  ObjectChartSchema,
  ObjectGallerySchema,
  ObjectDataTableSchema,
  ListViewSchema,
  ObjectQLComponentSchema,
} from './objectql.zod.js';

// ============================================================================
// CRUD Components - Create, Read, Update, Delete Operations
// ============================================================================
export {
  ActionExecutionModeSchema,
  ActionCallbackSchema,
  ActionSchema,
  DetailSchema,
  CRUDDialogSchema,
  CRUDComponentSchema,
} from './crud.zod.js';

// ============================================================================
// Phase 2 Schemas - Theme, Reports, Blocks, and Views
// ============================================================================
// `./theme.zod` exports NOTHING any more — the module is kept only as the
// tombstone for the retired theme component-kind surface:
// - `ColorPaletteSchema` / `TypographySchema` / `BorderRadiusSchema` /
//   `ShadowSchema` / `ThemeModeSchema` / `ThemeDefinitionSchema` RETIRED with
//   the spec's whole `ui/theme.zod.ts` module (objectstack#10485, PR
//   objectstack#10695; removal ruled on objectstack#10856, executed as
//   objectui#5710).
// - `ThemeComponentSchema` RETIRED in objectui#5489.
// - `ThemeSwitcherSchema` / `ThemePreviewSchema` / `ThemeUnionSchema` RETIRED
//   in objectui#5647, by inheritance of the same 2026-08-21 ruling (option B)
//   on identical evidence — `AnyComponentSchema` below no longer carries a
//   theme member.

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
  ReportComponentSchema,
  ReportBuilderSchema,
  ReportViewerSchema,
  ReportUnionSchema,
} from './reports.zod.js';

// `./blocks.zod` exports NOTHING any more — the module is kept only as the
// tombstone for the retired block schema family. `BlockVariableSchema`,
// `BlockSlotSchema`, `BlockMetadataSchema`, `BlockSchema`,
// `BlockLibraryItemSchema`, `BlockLibrarySchema`, `BlockEditorSchema`,
// `BlockInstanceSchema`, `ComponentSchema` and the `BlockComponentSchema`
// union over them RETIRED in objectui#4895 (ADR-0049 enforce-or-remove,
// maintainer ruling 2026-09-02, option C1). `AnyComponentSchema` below no
// longer carries a block arm, so `{ type: 'block' | 'block-library' |
// 'block-editor' | 'block-instance' | 'component' }` is now refused rather
// than green-lit for a node no page can render.

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
// Union Types - All Component Schemas
// ============================================================================

import { z } from 'zod';
import { AppComponentSchema } from './app.zod.js';
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
import { ReportUnionSchema } from './reports.zod.js';
import { ViewComponentSchema } from './views.zod.js';

/**
 * Union of all component schemas.
 * Use this for generic component rendering where the type is determined at runtime.
 */
export const AnyComponentSchema = z.union([
  AppComponentSchema,
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
  ReportUnionSchema,
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
