/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
  ChatbotEnhancedSchema,
  ChatbotFloatingSchema,
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

  // ⛔ `'kanban'` RETIRED (objectui#8802, maintainer ruling 2026-09-09). The
  // bare node type key published two faces with opposite verdicts — the plugin's
  // registry `inputs` accepted `titleField`, the Zod arm refused it by name — and
  // the maintainer dissolved the divergence by retiring the key rather than
  // patching either face. `KanbanSchema` retired with it (`complex.ts`).
  //
  // ⇒ `ComponentType` (`keyof SchemaRegistry`) no longer offers `'kanban'`, which
  // is the compile-time half of the refusal; the Zod half is
  // `RetiredKanbanNodeSchema` in `zod/complex.zod.ts`, which names `object-kanban`
  // as the remedy. The surviving spelling `'object-kanban'` is declared by
  // `ObjectKanbanSchema` (`objectql.ts`) and reached through
  // `ObjectQLComponentSchema`, and the STORED `NamedListView.type` value of the
  // same spelling is a different layer and untouched.
  //
  // ⚠️ Measured, and reported rather than fixed here: this map has NEVER had an
  // `'object-kanban'` entry, so with `'kanban'` gone the kanban family has no
  // entry in it at all. That is the objectui#7665 sweep's territory (this map's
  // coverage), not this retirement's — adding one would be a widening of
  // `ComponentType`, which is a ruling.
  'calendar-view': CalendarViewSchema;
  'filter-builder': FilterBuilderSchema;
  'carousel': CarouselSchema;
  'chatbot': ChatbotSchema;
  // `'chatbot-enhanced'` and `'chatbot-floating'` are the other two keys
  // `packages/plugin-chatbot/src/renderer.tsx` registers (`:241`, `:379`).
  // They were absent from this map until objectui#7704, so `ComponentType`
  // — the published `keyof SchemaRegistry` union — told a consumer
  // discriminating on it that two registered keys do not exist, and
  // `packages/cli/src/utils/known-schema-types.ts` had to keep its own
  // parallel list (`:83-84`) to know they do.
  //
  // Why they can be added now, and could not before: this map's value has to
  // be the type the registered renderer honours, and until objectui#7655
  // there was no honest one to point at. `ChatbotSchema` pins `type` to
  // `'chatbot'`, and the two registrations' real key sets lived in anonymous
  // `ChatbotSchema & { ... }` intersections local to the renderer file,
  // referenceable by nothing outside it. objectui#7655 gave each registration
  // one named authoring face, declared HERE — so both entries are honest (each
  // value pins `type` to its own key) AND reachable (this is a
  // zero-workspace-dependency layer; both faces are its own declarations, not
  // a plugin's). That is what separated this from the `kanban` case
  // objectui#7645 measured, where the honoured type lived in
  // `@object-ui/plugin-kanban` and naming it from here would have been a
  // phantom dependency and a cycle — resolved the other way, by moving the
  // dialect down here (objectui#7664, the `'kanban'` note above).
  //
  // The two registrations already take these exact types as their `schema`
  // parameter (`renderer.tsx:256`, `:394`), so the map's value and the
  // renderer's prop type are one declaration, the same property the `'kanban'`
  // arm above has.
  //
  // Pinned in `src/__tests__/schema-registry-chatbot-keys-7704.test.ts`: the
  // keys survive in `keyof`, each value IS the face its renderer honours, and
  // each value's `type` literal IS its own key. Scope note — objectui#7704 is
  // these two keys, whose faces now exist; it is NOT a sweep of the map's
  // other entries, which objectui#7665 holds.
  'chatbot-enhanced': ChatbotEnhancedSchema;
  'chatbot-floating': ChatbotFloatingSchema;
}

/**
 * Union of all registered component types
 */
export type ComponentType = keyof SchemaRegistry;
