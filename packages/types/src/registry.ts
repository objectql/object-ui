/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  DivSchema,
  SpanSchema,
  TextSchema,
  ImageSchema,
  IconSchema,
  SeparatorSchema,
  ContainerSchema,
  FlexSchema,
  GridSchema,
  CardSchema,
  TabsSchema,
  ScrollAreaSchema,
  ResizableSchema,
  ColumnsSchema,
  LayoutTemplateSchema,
  PageSchema,
} from './layout';

import type {
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
  CalendarSchema as FormCalendarSchema,
  InputOTPSchema,
  FormSchema,
} from './form';

import type {
  AlertSchema,
  BadgeSchema,
  AvatarSchema,
  ListSchema,
  TableSchema,
  DataTableSchema,
  MarkdownSchema,
  TreeViewSchema,
  ChartSchema,
  TimelineSchema,
  HtmlSchema,
  StatisticSchema,
} from './data-display';

import type {
  LoadingSchema,
  ProgressSchema,
  SkeletonSchema,
  ToastSchema,
  ToasterSchema,
} from './feedback';

import type {
  AccordionSchema,
  CollapsibleSchema,
  DisclosureSchema,
} from './disclosure';

import type {
  DialogSchema,
  AlertDialogSchema,
  SheetSchema,
  DrawerSchema,
  PopoverSchema,
  TooltipSchema,
  HoverCardSchema,
  DropdownMenuSchema,
  ContextMenuSchema,
} from './overlay';

import type {
  HeaderBarSchema,
  SidebarSchema,
  BreadcrumbSchema,
  PaginationSchema,
} from './navigation';

import type {
  KanbanSchema,
  CalendarViewSchema,
  FilterBuilderSchema,
  CarouselSchema,
  ChatbotSchema,
} from './complex';

/**
 * Registry mapping component types to their schema definitions.
 * This interface is the Single Source of Truth for component type lookups.
 */
export interface SchemaRegistry {
  // Layout
  'div': DivSchema;
  'span': SpanSchema;
  'text': TextSchema;
  'image': ImageSchema;
  'icon': IconSchema;
  'separator': SeparatorSchema;
  'container': ContainerSchema;
  'flex': FlexSchema;
  'grid': GridSchema;
  'card': CardSchema;
  'tabs': TabsSchema;
  'scroll-area': ScrollAreaSchema;
  'resizable': ResizableSchema;
  'columns': ColumnsSchema;
  'layout-template': LayoutTemplateSchema;
  'page': PageSchema;

  // Form
  'button': ButtonSchema;
  'input': InputSchema;
  'textarea': TextareaSchema;
  'select': SelectSchema;
  'checkbox': CheckboxSchema;
  'radio-group': RadioGroupSchema;
  'switch': SwitchSchema;
  'toggle': ToggleSchema;
  'slider': SliderSchema;
  'file-upload': FileUploadSchema;
  'date-picker': DatePickerSchema;
  'calendar': FormCalendarSchema;
  'input-otp': InputOTPSchema;
  'form': FormSchema;

  // Data Display
  'alert': AlertSchema;
  'badge': BadgeSchema;
  'avatar': AvatarSchema;
  'list': ListSchema;
  'table': TableSchema;
  'data-table': DataTableSchema;
  'markdown': MarkdownSchema;
  'tree-view': TreeViewSchema;
  'chart': ChartSchema;
  'timeline': TimelineSchema;
  'html': HtmlSchema;
  'statistic': StatisticSchema;

  // Feedback
  'loading': LoadingSchema;
  'progress': ProgressSchema;
  'skeleton': SkeletonSchema;
  'toast': ToastSchema;
  'toaster': ToasterSchema;

  // Disclosure
  'accordion': AccordionSchema;
  'collapsible': CollapsibleSchema;
  'disclosure': DisclosureSchema;

  // Overlay
  'dialog': DialogSchema;
  'alert-dialog': AlertDialogSchema;
  'sheet': SheetSchema;
  'drawer': DrawerSchema;
  'popover': PopoverSchema;
  'tooltip': TooltipSchema;
  'hover-card': HoverCardSchema;
  'dropdown-menu': DropdownMenuSchema;
  'context-menu': ContextMenuSchema;

  // Navigation
  'header-bar': HeaderBarSchema;
  'sidebar': SidebarSchema;
  'breadcrumb': BreadcrumbSchema;
  'pagination': PaginationSchema;

  // Complex
  'kanban': KanbanSchema;
  'calendar-view': CalendarViewSchema;
  'filter-builder': FilterBuilderSchema;
  'carousel': CarouselSchema;
  'chatbot': ChatbotSchema;
}

/**
 * Union of all registered component types
 */
export type ComponentType = keyof SchemaRegistry;
