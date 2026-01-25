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
} from './base.zod';

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
} from './layout.zod';

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
} from './form.zod';

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
} from './data-display.zod';

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
} from './feedback.zod';

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
} from './disclosure.zod';

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
} from './overlay.zod';

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
} from './navigation.zod';

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
  ComplexSchema,
} from './complex.zod';

// ============================================================================
// Union Types - All Component Schemas
// ============================================================================

import { z } from 'zod';
import { LayoutSchema } from './layout.zod';
import { FormComponentSchema } from './form.zod';
import { DataDisplaySchema } from './data-display.zod';
import { FeedbackSchema } from './feedback.zod';
import { DisclosureSchema } from './disclosure.zod';
import { OverlaySchema } from './overlay.zod';
import { NavigationSchema } from './navigation.zod';
import { ComplexSchema } from './complex.zod';

/**
 * Union of all component schemas.
 * Use this for generic component rendering where the type is determined at runtime.
 */
export const AnyComponentSchema = z.union([
  LayoutSchema,
  FormComponentSchema,
  DataDisplaySchema,
  FeedbackSchema,
  DisclosureSchema,
  OverlaySchema,
  NavigationSchema,
  ComplexSchema,
]);

/**
 * Version information
 */
export const SCHEMA_VERSION = '1.0.0';
