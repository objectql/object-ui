/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BaseSchema } from './base.js';

import type {
  DivSchema,
  BoxSchema,
  TextSpanSchema,
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
  PageNodeSchema,
} from './layout.js';

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
  CodeEditorSchema,
} from './form.js';

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
  BarChartSchema,
} from './data-display.js';

import type {
  LoadingSchema,
  ProgressSchema,
  SkeletonSchema,
  ToastSchema,
  ToasterSchema,
} from './feedback.js';

import type {
  AccordionSchema,
  CollapsibleSchema,
  DisclosureSchema,
} from './disclosure.js';

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
} from './overlay.js';

import type {
  HeaderBarSchema,
  SidebarSchema,
  BreadcrumbSchema,
  PaginationSchema,
} from './navigation.js';

import type {
  CalendarViewSchema,
  FilterBuilderSchema,
  CarouselSchema,
  ChatbotSchema,
} from './complex.js';

/**
 * Registry mapping component types to their schema definitions.
 * This interface is the Single Source of Truth for component type lookups.
 */
export interface SchemaRegistry {
  // Layout
  'div': DivSchema;
  'box': BoxSchema;
  'span': TextSpanSchema;
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
  'page': PageNodeSchema;

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
  'code-editor': CodeEditorSchema;

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
  'bar-chart': BarChartSchema;

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
  // ⚠️ `'kanban'` is the one key whose value this layer cannot state
  // precisely, so it deliberately states LESS rather than stating it wrongly
  // (objectui#7645).
  //
  // The renderer registered for this key is `ObjectKanbanRenderer` in
  // `@object-ui/plugin-kanban` (`ComponentRegistry.register('kanban', …)`,
  // `plugin-kanban/src/index.tsx`), and it consumes THAT package's
  // `KanbanSchema`. `@object-ui/types` cannot name that type, measured two
  // ways: importing it is a phantom dependency this package does not declare
  // (`check:phantom-deps` rejects it by file and pair), and declaring the
  // dependency would close the cycle `@object-ui/types` →
  // `@object-ui/plugin-kanban` → `@object-ui/types` — this is the
  // zero-workspace-dependency bottom layer. objectui#6172's ruling (option A)
  // kept the plugin's bare names rather than relocating that dialect down
  // here, so the gap is permanent by decision, not by oversight.
  //
  // What this entry asserts is therefore only what this layer can PROVE, and
  // what BOTH dialects satisfy: a schema node tagged `'kanban'`. It no longer
  // names `DeclarativeKanbanSchema` — that is the AUTHORING/validation face
  // (the `'kanban'` arm of `ComplexSchema` → `AnyComponentSchema` →
  // `safeValidateSchema`, still exported from `./complex.js` and unchanged),
  // not the type the registered renderer honours. Naming it here made a map
  // that advertises itself as the Single Source of Truth describe a different
  // component than the key names.
  //
  // ⛔ Do not "restore" a precise type here without moving the renderer's
  // dialect into a layer this package may depend on. Two compile-time pins
  // hold the shape: `src/__tests__/schema-registry-kanban-honesty-7645.test.ts`
  // (the key survives in `keyof`; the value no longer claims the declarative
  // face) and the same file name under `plugin-kanban/src/__tests__/` (the
  // renderer's own `KanbanSchema` satisfies what this entry asserts).
  'kanban': BaseSchema & { type: 'kanban' };
  'calendar-view': CalendarViewSchema;
  'filter-builder': FilterBuilderSchema;
  'carousel': CarouselSchema;
  'chatbot': ChatbotSchema;
}

/**
 * Union of all registered component types
 */
export type ComponentType = keyof SchemaRegistry;
