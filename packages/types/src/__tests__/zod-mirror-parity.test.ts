// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Every hand-written zod mirror in `../zod/` accepts everything its TypeScript
 * declaration declares (objectui#5684).
 *
 * ## The class
 *
 * A mirror restates a TS declaration by hand. When the declaration widens and the
 * mirror does not follow, the result is `declared !== enforced` on a PUBLISHED
 * surface (`@object-ui/types/zod`): the validator refuses a spelling the published
 * types invite and the renderer implements. Two instances were found
 * independently before anything looked for them —
 *
 *   - objectui#4605 (fixed in #5680): `BaseSchema`'s mirror had drifted narrow on
 *     FIVE keys, three of which the card naming it did not know about.
 *   - objectui#5186: `FieldValidationRules`' mirror refused the object dialect the
 *     TS contract declares and admitted a flat one no read point consumed.
 *
 * Both are regression evidence here, not open questions.
 *
 * ## The construction, and why it is derived
 *
 * #5680 established the shape and this file generalises it unchanged: read the
 * mirror's OWN `.shape` and compare each key against the declaration, so the next
 * widening that forgets a mirror turns red WITH NO KEY LIST TO MAINTAIN. A
 * hand-written key list is the same artefact the drift keeps producing.
 *
 * It reads `.shape` and not `keyof z.input<typeof Mirror>` because that spelling is
 * vacuous — `.passthrough()` collapses the inferred key union to bare `string`.
 * `assertionNoVacuousEntry` below pins that for all 163 entries at once.
 *
 * ## What is registered
 *
 * `MIRRORS` pairs a mirror with the declaration it restates. The PAIRING is the
 * only hand-maintained part; the key census under it stays derived. Pairing by
 * name alone is not safe — the const named `FieldConstraintsSchema` mirrors
 * `FieldValidationRules`, NOT the like-named legacy `FieldConstraints` in
 * `../field-types.ts` (the flat dialect #5186 removed), and a name-derived pairing
 * reports five drifted keys that do not exist.
 *
 * `EXCLUSIONS` carries every other exported const in `../zod/` WITH ITS REASON, and
 * the runtime census at the bottom asserts the two together account for every one
 * of them. That is what keeps the population honest: a new mirror added to the
 * directory fails this file until someone registers or excludes it, so an
 * incomplete population reads as a declared decision instead of an oversight.
 *
 * ## KNOWN_DRIFT is a ratchet, not a waiver
 *
 * 17 of the 163 pairs carry drift TODAY (measured, not assumed). Each is
 * pinned to its EXACT drifted key set, so the entry fails when new drift appears on
 * that mirror AND when the recorded drift is fixed — a stale entry cannot rot
 * quietly. Correcting them is not one change: the pairs below split into strict
 * widenings, DISJOINT vocabularies where one side is dead, and at least one
 * DELIBERATE divergence that must stay expressible (`PageNodeSchema.pageType`).
 * Each carries its measurement and its reason inline.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { z } from 'zod';

import { AppActionSchema, AppComponentSchema, NavigationAreaSchema } from '../zod/app.zod.js';
import { BaseSchema, ComponentConfigSchema, ComponentInputSchema, ComponentMetaSchema, KeyedI18nLabelSchema } from '../zod/base.zod.js';
import { BlockEditorSchema, BlockInstanceSchema, BlockLibraryItemSchema, BlockLibrarySchema, BlockMetadataSchema, BlockSchema, BlockSlotSchema, BlockVariableSchema, ComponentSchema } from '../zod/blocks.zod.js';
import { CalendarEventSchema, CalendarViewSchema, CarouselItemSchema, CarouselSchema, ChatbotSchema, ChatMessageSchema, ChatMessageSourceSchema, ChatToolInvocationSchema, DashboardComponentSchema, DashboardConfigSchema, DashboardWidgetConfigSchema, DashboardWidgetLayoutSchema, DashboardWidgetSchema, FilterBuilderSchema, FilterFieldSchema, KanbanCardSchema, KanbanColumnSchema, KanbanSchema } from '../zod/complex.zod.js';
import { ActionCallbackSchema, CRUDDialogSchema, CRUDFilterSchema, CRUDOperationSchema, CRUDPaginationSchema, CRUDSchema, CRUDToolbarSchema, DetailSchema } from '../zod/crud.zod.js';
import { AlertSchema, AvatarSchema, BadgeSchema, ChartDataSeriesSchema, ChartSchema, DataTableSchema, HtmlSchema, KbdSchema, ListItemSchema, ListSchema, MarkdownSchema, StaticTableColumnSchema, StatisticSchema, TableColumnSchema, TableSchema, TimelineEventSchema, TimelineSchema, TreeViewSchema } from '../zod/data-display.zod.js';
import { AccordionItemSchema, AccordionSchema, CollapsibleSchema, ToggleGroupItemSchema, ToggleGroupSchema } from '../zod/disclosure.zod.js';
import { EmptySchema, LoadingSchema, ProgressSchema, SkeletonSchema, SonnerSchema, SpinnerSchema, ToasterSchema, ToastSchema } from '../zod/feedback.zod.js';
import { ButtonSchema, CalendarSchema, CheckboxSchema, ComboboxOptionSchema, ComboboxSchema, CommandGroupSchema, CommandItemSchema, CommandSchema, DatePickerSchema, FieldConditionSchema, FieldConstraintsSchema, FileUploadSchema, FormFieldSchema, FormSchema, InputOTPSchema, InputSchema, LabelSchema, RadioGroupSchema, RadioOptionSchema, SelectOptionSchema, SelectSchema, SliderSchema, SwitchSchema, TextareaSchema, ToggleSchema } from '../zod/form.zod.js';
import { AspectRatioSchema, CardSchema, ContainerSchema, DivSchema, FlexSchema, GridSchema, IconSchema, ImageSchema, PageNodeRegionSchema, PageNodeSchema, ResizablePanelSchema, ResizableSchema, ScrollAreaSchema, SeparatorSchema, StackSchema, TabItemSchema, TabsSchema, TextSchema, TextSpanSchema } from '../zod/layout.zod.js';
import { BreadcrumbItemSchema, BreadcrumbSchema, ButtonGroupButtonSchema, ButtonGroupSchema, HeaderBarSchema, NavigationMenuSchema, PaginationSchema, SidebarSchema } from '../zod/navigation.zod.js';
import { ObjectCalendarSchema, ObjectChartSchema, ObjectFormSchema, ObjectGanttSchema, ObjectGridSchema, ObjectKanbanSchema, ObjectMapConfigSchema, ObjectMapSchema, ObjectTreeSchema, ObjectViewSchema, SortConfigSchema } from '../zod/objectql.zod.js';
import { AlertDialogSchema, ContextMenuSchema, DialogSchema, DrawerSchema, DropdownMenuSchema, HoverCardSchema, MenubarMenuSchema, MenubarSchema, PopoverSchema, SheetSchema, TooltipSchema } from '../zod/overlay.zod.js';
import { ReportBuilderSchema, ReportComponentSchema, ReportExportConfigSchema, ReportFieldSchema, ReportFilterSchema, ReportGroupBySchema, ReportSectionSchema, ReportViewerSchema } from '../zod/reports.zod.js';
import { DetailViewFieldSchema, DetailViewSchema, DetailViewSectionSchema, DetailViewTabSchema, FilterUISchema, SortUISchema, ViewSwitcherSchema } from '../zod/views.zod.js';

import type { AppAction as Ts_AppAction, AppComponentSchema as Ts_AppComponentSchema, NavigationArea as Ts_NavigationArea } from '../app';
import type { BaseSchema as Ts_BaseSchema, ComponentConfig as Ts_ComponentConfig, ComponentInput as Ts_ComponentInput, ComponentMeta as Ts_ComponentMeta, KeyedI18nLabel as Ts_KeyedI18nLabel } from '../base';
import type { BlockEditorSchema as Ts_BlockEditorSchema, BlockInstanceSchema as Ts_BlockInstanceSchema, BlockLibraryItem as Ts_BlockLibraryItem, BlockLibrarySchema as Ts_BlockLibrarySchema, BlockMetadata as Ts_BlockMetadata, BlockSchema as Ts_BlockSchema, BlockSlot as Ts_BlockSlot, BlockVariable as Ts_BlockVariable, ComponentSchema as Ts_ComponentSchema } from '../blocks';
import type { CalendarEvent as Ts_CalendarEvent, CalendarViewSchema as Ts_CalendarViewSchema, CarouselItem as Ts_CarouselItem, CarouselSchema as Ts_CarouselSchema, ChatbotSchema as Ts_ChatbotSchema, ChatMessage as Ts_ChatMessage, ChatMessageSource as Ts_ChatMessageSource, ChatToolInvocation as Ts_ChatToolInvocation, DashboardComponentSchema as Ts_DashboardComponentSchema, DashboardWidgetLayout as Ts_DashboardWidgetLayout, DashboardWidgetSchema as Ts_DashboardWidgetSchema, FilterBuilderSchema as Ts_FilterBuilderSchema, FilterField as Ts_FilterField, KanbanCard as Ts_KanbanCard, KanbanColumn as Ts_KanbanColumn, KanbanSchema as Ts_KanbanSchema } from '../complex';
import type { DashboardConfig as Ts_DashboardConfig, DashboardWidgetConfig as Ts_DashboardWidgetConfig } from '../designer';
import type { ActionCallback as Ts_ActionCallback, CRUDDialogSchema as Ts_CRUDDialogSchema, CRUDFilter as Ts_CRUDFilter, CRUDOperation as Ts_CRUDOperation, CRUDPagination as Ts_CRUDPagination, CRUDSchema as Ts_CRUDSchema, CRUDToolbar as Ts_CRUDToolbar, DetailSchema as Ts_DetailSchema } from '../crud';
import type { AlertSchema as Ts_AlertSchema, AvatarSchema as Ts_AvatarSchema, BadgeSchema as Ts_BadgeSchema, ChartDataSeries as Ts_ChartDataSeries, ChartSchema as Ts_ChartSchema, DataTableSchema as Ts_DataTableSchema, HtmlSchema as Ts_HtmlSchema, KbdSchema as Ts_KbdSchema, ListItem as Ts_ListItem, ListSchema as Ts_ListSchema, MarkdownSchema as Ts_MarkdownSchema, StaticTableColumn as Ts_StaticTableColumn, StatisticSchema as Ts_StatisticSchema, TableColumn as Ts_TableColumn, TableSchema as Ts_TableSchema, TimelineEvent as Ts_TimelineEvent, TimelineSchema as Ts_TimelineSchema, TreeViewSchema as Ts_TreeViewSchema, BreadcrumbItem as Ts_BreadcrumbItem, BreadcrumbSchema as Ts_BreadcrumbSchema } from '../data-display';
import type { AccordionItem as Ts_AccordionItem, AccordionSchema as Ts_AccordionSchema, CollapsibleSchema as Ts_CollapsibleSchema, ToggleGroupItem as Ts_ToggleGroupItem, ToggleGroupSchema as Ts_ToggleGroupSchema } from '../disclosure';
import type { EmptySchema as Ts_EmptySchema, LoadingSchema as Ts_LoadingSchema, ProgressSchema as Ts_ProgressSchema, SkeletonSchema as Ts_SkeletonSchema, SonnerSchema as Ts_SonnerSchema, SpinnerSchema as Ts_SpinnerSchema, ToasterSchema as Ts_ToasterSchema, ToastSchema as Ts_ToastSchema } from '../feedback';
import type { ButtonSchema as Ts_ButtonSchema, CalendarSchema as Ts_CalendarSchema, CheckboxSchema as Ts_CheckboxSchema, ComboboxOption as Ts_ComboboxOption, ComboboxSchema as Ts_ComboboxSchema, CommandGroup as Ts_CommandGroup, CommandItem as Ts_CommandItem, CommandSchema as Ts_CommandSchema, DatePickerSchema as Ts_DatePickerSchema, FieldCondition as Ts_FieldCondition, FieldValidationRules as Ts_FieldValidationRules, FileUploadSchema as Ts_FileUploadSchema, FormField as Ts_FormField, FormSchema as Ts_FormSchema, InputOTPSchema as Ts_InputOTPSchema, InputSchema as Ts_InputSchema, LabelSchema as Ts_LabelSchema, RadioGroupSchema as Ts_RadioGroupSchema, RadioOption as Ts_RadioOption, SelectOption as Ts_SelectOption, SelectSchema as Ts_SelectSchema, SliderSchema as Ts_SliderSchema, SwitchSchema as Ts_SwitchSchema, TextareaSchema as Ts_TextareaSchema, ToggleSchema as Ts_ToggleSchema } from '../form';
import type { AspectRatioSchema as Ts_AspectRatioSchema, CardSchema as Ts_CardSchema, ContainerSchema as Ts_ContainerSchema, DivSchema as Ts_DivSchema, FlexSchema as Ts_FlexSchema, GridSchema as Ts_GridSchema, IconSchema as Ts_IconSchema, ImageSchema as Ts_ImageSchema, PageNodeRegion as Ts_PageNodeRegion, PageNodeSchema as Ts_PageNodeSchema, ResizablePanel as Ts_ResizablePanel, ResizableSchema as Ts_ResizableSchema, ScrollAreaSchema as Ts_ScrollAreaSchema, SeparatorSchema as Ts_SeparatorSchema, StackSchema as Ts_StackSchema, TabItem as Ts_TabItem, TabsSchema as Ts_TabsSchema, TextSchema as Ts_TextSchema, TextSpanSchema as Ts_TextSpanSchema } from '../layout';
import type { ButtonGroupButton as Ts_ButtonGroupButton, ButtonGroupSchema as Ts_ButtonGroupSchema, HeaderBarSchema as Ts_HeaderBarSchema, NavigationMenuSchema as Ts_NavigationMenuSchema, PaginationSchema as Ts_PaginationSchema, SidebarSchema as Ts_SidebarSchema } from '../navigation';
import type { ObjectCalendarSchema as Ts_ObjectCalendarSchema, ObjectChartSchema as Ts_ObjectChartSchema, ObjectFormSchema as Ts_ObjectFormSchema, ObjectGanttSchema as Ts_ObjectGanttSchema, ObjectGridSchema as Ts_ObjectGridSchema, ObjectKanbanSchema as Ts_ObjectKanbanSchema, ObjectMapConfig as Ts_ObjectMapConfig, ObjectMapSchema as Ts_ObjectMapSchema, ObjectTreeSchema as Ts_ObjectTreeSchema, ObjectViewSchema as Ts_ObjectViewSchema, SortConfig as Ts_SortConfig } from '../objectql';
import type { AlertDialogSchema as Ts_AlertDialogSchema, ContextMenuSchema as Ts_ContextMenuSchema, DialogSchema as Ts_DialogSchema, DrawerSchema as Ts_DrawerSchema, DropdownMenuSchema as Ts_DropdownMenuSchema, HoverCardSchema as Ts_HoverCardSchema, MenubarMenu as Ts_MenubarMenu, MenubarSchema as Ts_MenubarSchema, PopoverSchema as Ts_PopoverSchema, SheetSchema as Ts_SheetSchema, TooltipSchema as Ts_TooltipSchema } from '../overlay';
import type { ReportBuilderSchema as Ts_ReportBuilderSchema, ReportComponentSchema as Ts_ReportComponentSchema, ReportExportConfig as Ts_ReportExportConfig, ReportField as Ts_ReportField, ReportFilter as Ts_ReportFilter, ReportGroupBy as Ts_ReportGroupBy, ReportSection as Ts_ReportSection, ReportViewerSchema as Ts_ReportViewerSchema } from '../reports';
import type { DetailViewField as Ts_DetailViewField, DetailViewSchema as Ts_DetailViewSchema, DetailViewSection as Ts_DetailViewSection, DetailViewTab as Ts_DetailViewTab, FilterUISchema as Ts_FilterUISchema, SortUISchema as Ts_SortUISchema, ViewSwitcherSchema as Ts_ViewSwitcherSchema } from '../views';

/* ── Type-level helpers (objectui#5680) ─────────────────────────────────────── */

/** Invariant equality — `extends` both ways would accept a narrowing. */
export type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
export type Expect< T extends true > = T;

/** The mirror's own shape, or `never` if it exposes none. */
type ShapeOf< M > = M extends { shape: infer S } ? S : never;
/** What a shape entry ACCEPTS (input side, so `.optional()` shows). */
type InputOf< T > = T extends z.ZodType ? z.input< T > : never;

/** The mirror's DECLARED keys, read from its own shape. */
export type MirroredKeys< M > = Extract< keyof ShapeOf< M >, string >;

/**
 * Every key whose DECLARED type the mirror would refuse.
 *
 * The tuple wrappers keep the check non-distributive: a declared type is often a
 * union, and a bare `extends` would ask the question limb-by-limb and pass as long
 * as ONE limb fit.
 *
 * Only keys present on BOTH sides are compared. A key the mirror does not declare
 * is not narrow — `BaseSchema` is `.passthrough()`, so an undeclared key rides
 * through. The opposite direction (mirror declares what the TS side does not) is a
 * different class and is not what this file measures.
 */
export type NarrowerThanDeclared< M, D > = {
  [K in MirroredKeys< M > & keyof D]: [D[K]] extends [InputOf< ShapeOf< M >[K] >] ? never : K;
}[MirroredKeys< M > & keyof D];

/* ── The registry ───────────────────────────────────────────────────────────── */

/** Mirror VALUES, keyed `<file>#<export>`. Runtime, so the census below can read the keys. */
const MIRRORS = {
  'app.zod.ts#AppActionSchema': AppActionSchema,
  'app.zod.ts#AppComponentSchema': AppComponentSchema,
  'app.zod.ts#NavigationAreaSchema': NavigationAreaSchema,
  'base.zod.ts#BaseSchema': BaseSchema,
  'base.zod.ts#ComponentConfigSchema': ComponentConfigSchema,
  'base.zod.ts#ComponentInputSchema': ComponentInputSchema,
  'base.zod.ts#ComponentMetaSchema': ComponentMetaSchema,
  'base.zod.ts#KeyedI18nLabelSchema': KeyedI18nLabelSchema,
  'blocks.zod.ts#BlockEditorSchema': BlockEditorSchema,
  'blocks.zod.ts#BlockInstanceSchema': BlockInstanceSchema,
  'blocks.zod.ts#BlockLibraryItemSchema': BlockLibraryItemSchema,
  'blocks.zod.ts#BlockLibrarySchema': BlockLibrarySchema,
  'blocks.zod.ts#BlockMetadataSchema': BlockMetadataSchema,
  'blocks.zod.ts#BlockSchema': BlockSchema,
  'blocks.zod.ts#BlockSlotSchema': BlockSlotSchema,
  'blocks.zod.ts#BlockVariableSchema': BlockVariableSchema,
  'blocks.zod.ts#ComponentSchema': ComponentSchema,
  'complex.zod.ts#CalendarEventSchema': CalendarEventSchema,
  'complex.zod.ts#CalendarViewSchema': CalendarViewSchema,
  'complex.zod.ts#CarouselItemSchema': CarouselItemSchema,
  'complex.zod.ts#CarouselSchema': CarouselSchema,
  'complex.zod.ts#ChatbotSchema': ChatbotSchema,
  'complex.zod.ts#ChatMessageSchema': ChatMessageSchema,
  'complex.zod.ts#ChatMessageSourceSchema': ChatMessageSourceSchema,
  'complex.zod.ts#ChatToolInvocationSchema': ChatToolInvocationSchema,
  'complex.zod.ts#DashboardComponentSchema': DashboardComponentSchema,
  'complex.zod.ts#DashboardConfigSchema': DashboardConfigSchema,
  'complex.zod.ts#DashboardWidgetConfigSchema': DashboardWidgetConfigSchema,
  'complex.zod.ts#DashboardWidgetLayoutSchema': DashboardWidgetLayoutSchema,
  'complex.zod.ts#DashboardWidgetSchema': DashboardWidgetSchema,
  'complex.zod.ts#FilterBuilderSchema': FilterBuilderSchema,
  'complex.zod.ts#FilterFieldSchema': FilterFieldSchema,
  'complex.zod.ts#KanbanCardSchema': KanbanCardSchema,
  'complex.zod.ts#KanbanColumnSchema': KanbanColumnSchema,
  'complex.zod.ts#KanbanSchema': KanbanSchema,
  'crud.zod.ts#ActionCallbackSchema': ActionCallbackSchema,
  'crud.zod.ts#CRUDDialogSchema': CRUDDialogSchema,
  'crud.zod.ts#CRUDFilterSchema': CRUDFilterSchema,
  'crud.zod.ts#CRUDOperationSchema': CRUDOperationSchema,
  'crud.zod.ts#CRUDPaginationSchema': CRUDPaginationSchema,
  'crud.zod.ts#CRUDSchema': CRUDSchema,
  'crud.zod.ts#CRUDToolbarSchema': CRUDToolbarSchema,
  'crud.zod.ts#DetailSchema': DetailSchema,
  'data-display.zod.ts#AlertSchema': AlertSchema,
  'data-display.zod.ts#AvatarSchema': AvatarSchema,
  'data-display.zod.ts#BadgeSchema': BadgeSchema,
  'data-display.zod.ts#ChartDataSeriesSchema': ChartDataSeriesSchema,
  'data-display.zod.ts#ChartSchema': ChartSchema,
  'data-display.zod.ts#DataTableSchema': DataTableSchema,
  'data-display.zod.ts#HtmlSchema': HtmlSchema,
  'data-display.zod.ts#KbdSchema': KbdSchema,
  'data-display.zod.ts#ListItemSchema': ListItemSchema,
  'data-display.zod.ts#ListSchema': ListSchema,
  'data-display.zod.ts#MarkdownSchema': MarkdownSchema,
  'data-display.zod.ts#StaticTableColumnSchema': StaticTableColumnSchema,
  'data-display.zod.ts#StatisticSchema': StatisticSchema,
  'data-display.zod.ts#TableColumnSchema': TableColumnSchema,
  'data-display.zod.ts#TableSchema': TableSchema,
  'data-display.zod.ts#TimelineEventSchema': TimelineEventSchema,
  'data-display.zod.ts#TimelineSchema': TimelineSchema,
  'data-display.zod.ts#TreeViewSchema': TreeViewSchema,
  'disclosure.zod.ts#AccordionItemSchema': AccordionItemSchema,
  'disclosure.zod.ts#AccordionSchema': AccordionSchema,
  'disclosure.zod.ts#CollapsibleSchema': CollapsibleSchema,
  'disclosure.zod.ts#ToggleGroupItemSchema': ToggleGroupItemSchema,
  'disclosure.zod.ts#ToggleGroupSchema': ToggleGroupSchema,
  'feedback.zod.ts#EmptySchema': EmptySchema,
  'feedback.zod.ts#LoadingSchema': LoadingSchema,
  'feedback.zod.ts#ProgressSchema': ProgressSchema,
  'feedback.zod.ts#SkeletonSchema': SkeletonSchema,
  'feedback.zod.ts#SonnerSchema': SonnerSchema,
  'feedback.zod.ts#SpinnerSchema': SpinnerSchema,
  'feedback.zod.ts#ToasterSchema': ToasterSchema,
  'feedback.zod.ts#ToastSchema': ToastSchema,
  'form.zod.ts#ButtonSchema': ButtonSchema,
  'form.zod.ts#CalendarSchema': CalendarSchema,
  'form.zod.ts#CheckboxSchema': CheckboxSchema,
  'form.zod.ts#ComboboxOptionSchema': ComboboxOptionSchema,
  'form.zod.ts#ComboboxSchema': ComboboxSchema,
  'form.zod.ts#CommandGroupSchema': CommandGroupSchema,
  'form.zod.ts#CommandItemSchema': CommandItemSchema,
  'form.zod.ts#CommandSchema': CommandSchema,
  'form.zod.ts#DatePickerSchema': DatePickerSchema,
  'form.zod.ts#FieldConditionSchema': FieldConditionSchema,
  'form.zod.ts#FieldConstraintsSchema': FieldConstraintsSchema,
  'form.zod.ts#FileUploadSchema': FileUploadSchema,
  'form.zod.ts#FormFieldSchema': FormFieldSchema,
  'form.zod.ts#FormSchema': FormSchema,
  'form.zod.ts#InputOTPSchema': InputOTPSchema,
  'form.zod.ts#InputSchema': InputSchema,
  'form.zod.ts#LabelSchema': LabelSchema,
  'form.zod.ts#RadioGroupSchema': RadioGroupSchema,
  'form.zod.ts#RadioOptionSchema': RadioOptionSchema,
  'form.zod.ts#SelectOptionSchema': SelectOptionSchema,
  'form.zod.ts#SelectSchema': SelectSchema,
  'form.zod.ts#SliderSchema': SliderSchema,
  'form.zod.ts#SwitchSchema': SwitchSchema,
  'form.zod.ts#TextareaSchema': TextareaSchema,
  'form.zod.ts#ToggleSchema': ToggleSchema,
  'layout.zod.ts#AspectRatioSchema': AspectRatioSchema,
  'layout.zod.ts#CardSchema': CardSchema,
  'layout.zod.ts#ContainerSchema': ContainerSchema,
  'layout.zod.ts#DivSchema': DivSchema,
  'layout.zod.ts#FlexSchema': FlexSchema,
  'layout.zod.ts#GridSchema': GridSchema,
  'layout.zod.ts#IconSchema': IconSchema,
  'layout.zod.ts#ImageSchema': ImageSchema,
  'layout.zod.ts#PageNodeRegionSchema': PageNodeRegionSchema,
  'layout.zod.ts#PageNodeSchema': PageNodeSchema,
  'layout.zod.ts#ResizablePanelSchema': ResizablePanelSchema,
  'layout.zod.ts#ResizableSchema': ResizableSchema,
  'layout.zod.ts#ScrollAreaSchema': ScrollAreaSchema,
  'layout.zod.ts#SeparatorSchema': SeparatorSchema,
  'layout.zod.ts#StackSchema': StackSchema,
  'layout.zod.ts#TabItemSchema': TabItemSchema,
  'layout.zod.ts#TabsSchema': TabsSchema,
  'layout.zod.ts#TextSchema': TextSchema,
  'layout.zod.ts#TextSpanSchema': TextSpanSchema,
  'navigation.zod.ts#BreadcrumbItemSchema': BreadcrumbItemSchema,
  'navigation.zod.ts#BreadcrumbSchema': BreadcrumbSchema,
  'navigation.zod.ts#ButtonGroupButtonSchema': ButtonGroupButtonSchema,
  'navigation.zod.ts#ButtonGroupSchema': ButtonGroupSchema,
  'navigation.zod.ts#HeaderBarSchema': HeaderBarSchema,
  'navigation.zod.ts#NavigationMenuSchema': NavigationMenuSchema,
  'navigation.zod.ts#PaginationSchema': PaginationSchema,
  'navigation.zod.ts#SidebarSchema': SidebarSchema,
  'objectql.zod.ts#ObjectCalendarSchema': ObjectCalendarSchema,
  'objectql.zod.ts#ObjectChartSchema': ObjectChartSchema,
  'objectql.zod.ts#ObjectFormSchema': ObjectFormSchema,
  'objectql.zod.ts#ObjectGanttSchema': ObjectGanttSchema,
  'objectql.zod.ts#ObjectGridSchema': ObjectGridSchema,
  'objectql.zod.ts#ObjectKanbanSchema': ObjectKanbanSchema,
  'objectql.zod.ts#ObjectMapConfigSchema': ObjectMapConfigSchema,
  'objectql.zod.ts#ObjectMapSchema': ObjectMapSchema,
  'objectql.zod.ts#ObjectTreeSchema': ObjectTreeSchema,
  'objectql.zod.ts#ObjectViewSchema': ObjectViewSchema,
  'objectql.zod.ts#SortConfigSchema': SortConfigSchema,
  'overlay.zod.ts#AlertDialogSchema': AlertDialogSchema,
  'overlay.zod.ts#ContextMenuSchema': ContextMenuSchema,
  'overlay.zod.ts#DialogSchema': DialogSchema,
  'overlay.zod.ts#DrawerSchema': DrawerSchema,
  'overlay.zod.ts#DropdownMenuSchema': DropdownMenuSchema,
  'overlay.zod.ts#HoverCardSchema': HoverCardSchema,
  'overlay.zod.ts#MenubarMenuSchema': MenubarMenuSchema,
  'overlay.zod.ts#MenubarSchema': MenubarSchema,
  'overlay.zod.ts#PopoverSchema': PopoverSchema,
  'overlay.zod.ts#SheetSchema': SheetSchema,
  'overlay.zod.ts#TooltipSchema': TooltipSchema,
  'reports.zod.ts#ReportBuilderSchema': ReportBuilderSchema,
  'reports.zod.ts#ReportComponentSchema': ReportComponentSchema,
  'reports.zod.ts#ReportExportConfigSchema': ReportExportConfigSchema,
  'reports.zod.ts#ReportFieldSchema': ReportFieldSchema,
  'reports.zod.ts#ReportFilterSchema': ReportFilterSchema,
  'reports.zod.ts#ReportGroupBySchema': ReportGroupBySchema,
  'reports.zod.ts#ReportSectionSchema': ReportSectionSchema,
  'reports.zod.ts#ReportViewerSchema': ReportViewerSchema,
  'views.zod.ts#DetailViewFieldSchema': DetailViewFieldSchema,
  'views.zod.ts#DetailViewSchema': DetailViewSchema,
  'views.zod.ts#DetailViewSectionSchema': DetailViewSectionSchema,
  'views.zod.ts#DetailViewTabSchema': DetailViewTabSchema,
  'views.zod.ts#FilterUISchema': FilterUISchema,
  'views.zod.ts#SortUISchema': SortUISchema,
  'views.zod.ts#ViewSwitcherSchema': ViewSwitcherSchema,
} as const;

/** The declaration each mirror restates. Same keys as `MIRRORS` — pinned below. */
interface Declared {
  'app.zod.ts#AppActionSchema': Ts_AppAction;
  'app.zod.ts#AppComponentSchema': Ts_AppComponentSchema;
  'app.zod.ts#NavigationAreaSchema': Ts_NavigationArea;
  'base.zod.ts#BaseSchema': Ts_BaseSchema;
  'base.zod.ts#ComponentConfigSchema': Ts_ComponentConfig;
  'base.zod.ts#ComponentInputSchema': Ts_ComponentInput;
  'base.zod.ts#ComponentMetaSchema': Ts_ComponentMeta;
  'base.zod.ts#KeyedI18nLabelSchema': Ts_KeyedI18nLabel;
  'blocks.zod.ts#BlockEditorSchema': Ts_BlockEditorSchema;
  'blocks.zod.ts#BlockInstanceSchema': Ts_BlockInstanceSchema;
  'blocks.zod.ts#BlockLibraryItemSchema': Ts_BlockLibraryItem;
  'blocks.zod.ts#BlockLibrarySchema': Ts_BlockLibrarySchema;
  'blocks.zod.ts#BlockMetadataSchema': Ts_BlockMetadata;
  'blocks.zod.ts#BlockSchema': Ts_BlockSchema;
  'blocks.zod.ts#BlockSlotSchema': Ts_BlockSlot;
  'blocks.zod.ts#BlockVariableSchema': Ts_BlockVariable;
  'blocks.zod.ts#ComponentSchema': Ts_ComponentSchema;
  'complex.zod.ts#CalendarEventSchema': Ts_CalendarEvent;
  'complex.zod.ts#CalendarViewSchema': Ts_CalendarViewSchema;
  'complex.zod.ts#CarouselItemSchema': Ts_CarouselItem;
  'complex.zod.ts#CarouselSchema': Ts_CarouselSchema;
  'complex.zod.ts#ChatbotSchema': Ts_ChatbotSchema;
  'complex.zod.ts#ChatMessageSchema': Ts_ChatMessage;
  'complex.zod.ts#ChatMessageSourceSchema': Ts_ChatMessageSource;
  'complex.zod.ts#ChatToolInvocationSchema': Ts_ChatToolInvocation;
  'complex.zod.ts#DashboardComponentSchema': Ts_DashboardComponentSchema;
  'complex.zod.ts#DashboardConfigSchema': Ts_DashboardConfig;
  'complex.zod.ts#DashboardWidgetConfigSchema': Ts_DashboardWidgetConfig;
  'complex.zod.ts#DashboardWidgetLayoutSchema': Ts_DashboardWidgetLayout;
  'complex.zod.ts#DashboardWidgetSchema': Ts_DashboardWidgetSchema;
  'complex.zod.ts#FilterBuilderSchema': Ts_FilterBuilderSchema;
  'complex.zod.ts#FilterFieldSchema': Ts_FilterField;
  'complex.zod.ts#KanbanCardSchema': Ts_KanbanCard;
  'complex.zod.ts#KanbanColumnSchema': Ts_KanbanColumn;
  'complex.zod.ts#KanbanSchema': Ts_KanbanSchema;
  'crud.zod.ts#ActionCallbackSchema': Ts_ActionCallback;
  'crud.zod.ts#CRUDDialogSchema': Ts_CRUDDialogSchema;
  'crud.zod.ts#CRUDFilterSchema': Ts_CRUDFilter;
  'crud.zod.ts#CRUDOperationSchema': Ts_CRUDOperation;
  'crud.zod.ts#CRUDPaginationSchema': Ts_CRUDPagination;
  'crud.zod.ts#CRUDSchema': Ts_CRUDSchema;
  'crud.zod.ts#CRUDToolbarSchema': Ts_CRUDToolbar;
  'crud.zod.ts#DetailSchema': Ts_DetailSchema;
  'data-display.zod.ts#AlertSchema': Ts_AlertSchema;
  'data-display.zod.ts#AvatarSchema': Ts_AvatarSchema;
  'data-display.zod.ts#BadgeSchema': Ts_BadgeSchema;
  'data-display.zod.ts#ChartDataSeriesSchema': Ts_ChartDataSeries;
  'data-display.zod.ts#ChartSchema': Ts_ChartSchema;
  'data-display.zod.ts#DataTableSchema': Ts_DataTableSchema;
  'data-display.zod.ts#HtmlSchema': Ts_HtmlSchema;
  'data-display.zod.ts#KbdSchema': Ts_KbdSchema;
  'data-display.zod.ts#ListItemSchema': Ts_ListItem;
  'data-display.zod.ts#ListSchema': Ts_ListSchema;
  'data-display.zod.ts#MarkdownSchema': Ts_MarkdownSchema;
  'data-display.zod.ts#StaticTableColumnSchema': Ts_StaticTableColumn;
  'data-display.zod.ts#StatisticSchema': Ts_StatisticSchema;
  'data-display.zod.ts#TableColumnSchema': Ts_TableColumn;
  'data-display.zod.ts#TableSchema': Ts_TableSchema;
  'data-display.zod.ts#TimelineEventSchema': Ts_TimelineEvent;
  'data-display.zod.ts#TimelineSchema': Ts_TimelineSchema;
  'data-display.zod.ts#TreeViewSchema': Ts_TreeViewSchema;
  'disclosure.zod.ts#AccordionItemSchema': Ts_AccordionItem;
  'disclosure.zod.ts#AccordionSchema': Ts_AccordionSchema;
  'disclosure.zod.ts#CollapsibleSchema': Ts_CollapsibleSchema;
  'disclosure.zod.ts#ToggleGroupItemSchema': Ts_ToggleGroupItem;
  'disclosure.zod.ts#ToggleGroupSchema': Ts_ToggleGroupSchema;
  'feedback.zod.ts#EmptySchema': Ts_EmptySchema;
  'feedback.zod.ts#LoadingSchema': Ts_LoadingSchema;
  'feedback.zod.ts#ProgressSchema': Ts_ProgressSchema;
  'feedback.zod.ts#SkeletonSchema': Ts_SkeletonSchema;
  'feedback.zod.ts#SonnerSchema': Ts_SonnerSchema;
  'feedback.zod.ts#SpinnerSchema': Ts_SpinnerSchema;
  'feedback.zod.ts#ToasterSchema': Ts_ToasterSchema;
  'feedback.zod.ts#ToastSchema': Ts_ToastSchema;
  'form.zod.ts#ButtonSchema': Ts_ButtonSchema;
  'form.zod.ts#CalendarSchema': Ts_CalendarSchema;
  'form.zod.ts#CheckboxSchema': Ts_CheckboxSchema;
  'form.zod.ts#ComboboxOptionSchema': Ts_ComboboxOption;
  'form.zod.ts#ComboboxSchema': Ts_ComboboxSchema;
  'form.zod.ts#CommandGroupSchema': Ts_CommandGroup;
  'form.zod.ts#CommandItemSchema': Ts_CommandItem;
  'form.zod.ts#CommandSchema': Ts_CommandSchema;
  'form.zod.ts#DatePickerSchema': Ts_DatePickerSchema;
  'form.zod.ts#FieldConditionSchema': Ts_FieldCondition;
  'form.zod.ts#FieldConstraintsSchema': Ts_FieldValidationRules;
  'form.zod.ts#FileUploadSchema': Ts_FileUploadSchema;
  'form.zod.ts#FormFieldSchema': Ts_FormField;
  'form.zod.ts#FormSchema': Ts_FormSchema;
  'form.zod.ts#InputOTPSchema': Ts_InputOTPSchema;
  'form.zod.ts#InputSchema': Ts_InputSchema;
  'form.zod.ts#LabelSchema': Ts_LabelSchema;
  'form.zod.ts#RadioGroupSchema': Ts_RadioGroupSchema;
  'form.zod.ts#RadioOptionSchema': Ts_RadioOption;
  'form.zod.ts#SelectOptionSchema': Ts_SelectOption;
  'form.zod.ts#SelectSchema': Ts_SelectSchema;
  'form.zod.ts#SliderSchema': Ts_SliderSchema;
  'form.zod.ts#SwitchSchema': Ts_SwitchSchema;
  'form.zod.ts#TextareaSchema': Ts_TextareaSchema;
  'form.zod.ts#ToggleSchema': Ts_ToggleSchema;
  'layout.zod.ts#AspectRatioSchema': Ts_AspectRatioSchema;
  'layout.zod.ts#CardSchema': Ts_CardSchema;
  'layout.zod.ts#ContainerSchema': Ts_ContainerSchema;
  'layout.zod.ts#DivSchema': Ts_DivSchema;
  'layout.zod.ts#FlexSchema': Ts_FlexSchema;
  'layout.zod.ts#GridSchema': Ts_GridSchema;
  'layout.zod.ts#IconSchema': Ts_IconSchema;
  'layout.zod.ts#ImageSchema': Ts_ImageSchema;
  'layout.zod.ts#PageNodeRegionSchema': Ts_PageNodeRegion;
  'layout.zod.ts#PageNodeSchema': Ts_PageNodeSchema;
  'layout.zod.ts#ResizablePanelSchema': Ts_ResizablePanel;
  'layout.zod.ts#ResizableSchema': Ts_ResizableSchema;
  'layout.zod.ts#ScrollAreaSchema': Ts_ScrollAreaSchema;
  'layout.zod.ts#SeparatorSchema': Ts_SeparatorSchema;
  'layout.zod.ts#StackSchema': Ts_StackSchema;
  'layout.zod.ts#TabItemSchema': Ts_TabItem;
  'layout.zod.ts#TabsSchema': Ts_TabsSchema;
  'layout.zod.ts#TextSchema': Ts_TextSchema;
  'layout.zod.ts#TextSpanSchema': Ts_TextSpanSchema;
  'navigation.zod.ts#BreadcrumbItemSchema': Ts_BreadcrumbItem;
  'navigation.zod.ts#BreadcrumbSchema': Ts_BreadcrumbSchema;
  'navigation.zod.ts#ButtonGroupButtonSchema': Ts_ButtonGroupButton;
  'navigation.zod.ts#ButtonGroupSchema': Ts_ButtonGroupSchema;
  'navigation.zod.ts#HeaderBarSchema': Ts_HeaderBarSchema;
  'navigation.zod.ts#NavigationMenuSchema': Ts_NavigationMenuSchema;
  'navigation.zod.ts#PaginationSchema': Ts_PaginationSchema;
  'navigation.zod.ts#SidebarSchema': Ts_SidebarSchema;
  'objectql.zod.ts#ObjectCalendarSchema': Ts_ObjectCalendarSchema;
  'objectql.zod.ts#ObjectChartSchema': Ts_ObjectChartSchema;
  'objectql.zod.ts#ObjectFormSchema': Ts_ObjectFormSchema;
  'objectql.zod.ts#ObjectGanttSchema': Ts_ObjectGanttSchema;
  'objectql.zod.ts#ObjectGridSchema': Ts_ObjectGridSchema;
  'objectql.zod.ts#ObjectKanbanSchema': Ts_ObjectKanbanSchema;
  'objectql.zod.ts#ObjectMapConfigSchema': Ts_ObjectMapConfig;
  'objectql.zod.ts#ObjectMapSchema': Ts_ObjectMapSchema;
  'objectql.zod.ts#ObjectTreeSchema': Ts_ObjectTreeSchema;
  'objectql.zod.ts#ObjectViewSchema': Ts_ObjectViewSchema;
  'objectql.zod.ts#SortConfigSchema': Ts_SortConfig;
  'overlay.zod.ts#AlertDialogSchema': Ts_AlertDialogSchema;
  'overlay.zod.ts#ContextMenuSchema': Ts_ContextMenuSchema;
  'overlay.zod.ts#DialogSchema': Ts_DialogSchema;
  'overlay.zod.ts#DrawerSchema': Ts_DrawerSchema;
  'overlay.zod.ts#DropdownMenuSchema': Ts_DropdownMenuSchema;
  'overlay.zod.ts#HoverCardSchema': Ts_HoverCardSchema;
  'overlay.zod.ts#MenubarMenuSchema': Ts_MenubarMenu;
  'overlay.zod.ts#MenubarSchema': Ts_MenubarSchema;
  'overlay.zod.ts#PopoverSchema': Ts_PopoverSchema;
  'overlay.zod.ts#SheetSchema': Ts_SheetSchema;
  'overlay.zod.ts#TooltipSchema': Ts_TooltipSchema;
  'reports.zod.ts#ReportBuilderSchema': Ts_ReportBuilderSchema;
  'reports.zod.ts#ReportComponentSchema': Ts_ReportComponentSchema;
  'reports.zod.ts#ReportExportConfigSchema': Ts_ReportExportConfig;
  'reports.zod.ts#ReportFieldSchema': Ts_ReportField;
  'reports.zod.ts#ReportFilterSchema': Ts_ReportFilter;
  'reports.zod.ts#ReportGroupBySchema': Ts_ReportGroupBy;
  'reports.zod.ts#ReportSectionSchema': Ts_ReportSection;
  'reports.zod.ts#ReportViewerSchema': Ts_ReportViewerSchema;
  'views.zod.ts#DetailViewFieldSchema': Ts_DetailViewField;
  'views.zod.ts#DetailViewSchema': Ts_DetailViewSchema;
  'views.zod.ts#DetailViewSectionSchema': Ts_DetailViewSection;
  'views.zod.ts#DetailViewTabSchema': Ts_DetailViewTab;
  'views.zod.ts#FilterUISchema': Ts_FilterUISchema;
  'views.zod.ts#SortUISchema': Ts_SortUISchema;
  'views.zod.ts#ViewSwitcherSchema': Ts_ViewSwitcherSchema;
}

type MirrorKey = keyof typeof MIRRORS;

/** The two halves of the registry must describe the same population. */
export type assertionRegistryHalvesAgree = Expect< Equal< MirrorKey, keyof Declared > >;

/** The drift on one registered pair. */
type DriftOf< K extends MirrorKey > = NarrowerThanDeclared< (typeof MIRRORS)[K], Declared[K] >;

/* ── The measured drift ledger ──────────────────────────────────────────────── */

/**
 * Exact drifted key set per pair, measured against `origin/main`. Pinned exactly:
 * new drift on a listed mirror fails, and so does a listed key that has been fixed.
 */
interface KnownDrift {
  /** TS declares `SchemaNode | SchemaNode[]` (a rendered slot); the mirror declares `Record<string, unknown>` ("additional API body params"). Two different meanings of one key — a naming collision to rule on, not a widening. */
  'complex.zod.ts#ChatbotSchema': 'body';
  /**
   * spec-derived shape (`SpecDashboardFields`) measured against a hand-written
   * local declaration. Needs the spec-unification triage of #2231 rather than a
   * local widening.
   *
   * `aria` was a FOURTH drifted key here until objectui#5855 retired
   * `DashboardComponentSchema.aria` from the declaration as spec-tombstoned and
   * renderer-dead. Dropping it from the declaration dropped it from the
   * comparison, and this entry going stale is precisely what surfaced that.
   */
  'complex.zod.ts#DashboardComponentSchema': 'header' | 'widgets' | 'globalFilters';
  /** TS declares `unknown`; the mirror declares a structured options object. The mirror is the STRICTER side here — narrowing the check would be wrong, widening the TS declaration is the ADR-0049 question. */
  'complex.zod.ts#DashboardWidgetSchema': 'options';
  /** inherited from `FilterFieldSchema.operators` below — the element type is the drifted one. */
  'complex.zod.ts#FilterBuilderSchema': 'fields';
  /** DISJOINT vocabularies: TS declares `is_empty`/`is_not_empty`, the mirror declares `is_null`/`is_not_null`. One of the two is dead; which one is a ruling. */
  'complex.zod.ts#FilterFieldSchema': 'operators';
  /** TS declares an index signature whose value type includes `undefined`; the mirror`s `z.record` value type does not. The mirror refuses `{ create: undefined }` only. */
  'crud.zod.ts#CRUDSchema': 'operations';
  /** `selectable`: TS `boolean | 'single' | 'multiple'` vs mirror `boolean` (strict widening). `rowActions`: TS `boolean` vs mirror `any[]` — DISJOINT, a ruling. */
  'data-display.zod.ts#DataTableSchema': 'selectable' | 'rowActions';
  /** DISJOINT: TS `Date | Date[]`, mirror `string | Date`. The mirror refuses `Date[]`; the TS side refuses the ISO string the mirror accepts. */
  'form.zod.ts#CalendarSchema': 'defaultValue' | 'value';
  /** OPTIONALITY: TS declares `options?`, the mirror REQUIRES it. Whether authoring a combobox without options is legal is a ruling. */
  'form.zod.ts#ComboboxSchema': 'options';
  /** OPTIONALITY: TS declares `groups?`, the mirror REQUIRES it. */
  'form.zod.ts#CommandSchema': 'groups';
  /** DISJOINT on `mode`: TS `disabled|read|edit`, mirror `create|edit|view`. `validationMode` is a strict widening (`onTouched`, `all` missing from the mirror). `fields` is inherited element drift. */
  'form.zod.ts#FormSchema': 'fields' | 'mode' | 'validationMode';
  /** strict widening: TS `string | number | boolean`, mirror `string | number` — the mirror refuses a boolean option value. */
  'form.zod.ts#SelectSchema': 'defaultValue' | 'value';
  /** `pageType` is a DELIBERATE divergence, documented at `PageVisualizationAlias` (`../layout.ts`): the TS side retains five visualization names as a sanctioned local extension while the mirror takes the spec's vocabulary by reference, which repudiates them. Widening the mirror would re-add spellings the spec rejects. */
  'layout.zod.ts#PageNodeSchema': 'slots' | 'pageType';
  /** strict widening: the mirror is missing `link`/`secondary`/`destructive`/`ghost` on `variant` and `icon` on `size`. */
  'navigation.zod.ts#ButtonGroupSchema': 'variant' | 'size';
  /** DISJOINT: TS declares `floating`, the mirror declares `transparent`. One of the two renders nothing. */
  'navigation.zod.ts#HeaderBarSchema': 'variant';
  /** strict widening: the mirror is missing `column`, `horizontal-bar` and `donut`. */
  'objectql.zod.ts#ObjectChartSchema': 'chartType';
  /** strict widening: `ViewType` (`../views.ts`) carries `chart`, which the mirror`s inline vocabulary omits. `views` is the same omission inside the element type. */
  'views.zod.ts#ViewSwitcherSchema': 'defaultView' | 'views' | 'activeView';
}

/* ── The invariant ──────────────────────────────────────────────────────────── */

/**
 * Every pair's drift equals what the ledger records for it — `never` for the
 * 146 pairs with no entry.
 */
export type LedgerMismatch = {
  [K in MirrorKey]: Equal< DriftOf< K >, K extends keyof KnownDrift ? KnownDrift[K] : never > extends true
    ? never
    : K;
}[MirrorKey];

/**
 * Fails when any pair's drift differs from its ledger entry, IN EITHER DIRECTION.
 *
 * Written as an assignment to `never` rather than `Expect< Equal< …, never > >`
 * so the compiler prints the OFFENDING PAIR in the failure — `Type
 * '"complex.zod.ts#DashboardComponentSchema"' is not assignable to type 'never'`.
 * The `Expect<…>` spelling has identical teeth but reports only `Type 'false'
 * does not satisfy the constraint 'true'`, which names neither the pair nor the
 * key and sent one CI failure to the compiler API to diagnose.
 *
 * When it fires, fix it by MEASURING, never by editing the assertion:
 *   1. the message names the pair;
 *   2. re-measure that pair's drift (resolve `DriftOf< '<pair>' >`);
 *   3. correct its `KnownDrift` entry to the measured set — or delete the entry
 *      if the drift is gone, which is the whole point of the ratchet.
 *
 * If the named pair is in `SPEC_DERIVED_PAIRS` below, one side of its comparison
 * comes from `@objectstack/spec`, so a spec bump is a candidate cause and the
 * lockfile is the thing to check first. (It was NOT the cause of the firing
 * described below: the lockfile pinned one spec version across every commit
 * involved and the merge did not touch it.)
 *
 * Its first real firing was direction (3): objectui#5855 retired
 * `DashboardComponentSchema.aria` on `main` while this branch was open, so a key
 * this ledger recorded as drifted had been corrected elsewhere and the entry went
 * stale. CI sees the PR's MERGE with `main`, not the branch head, so a ledger can
 * go stale under a branch without anything on the branch changing.
 */
export const assertionDriftMatchesLedger: never = 0 as unknown as LedgerMismatch;

/**
 * Non-vacuity for all 163 entries at once.
 *
 * `NarrowerThanDeclared` is `never` — green — for an entry whose mirror exposes no
 * `.shape`, and also for one whose key union has degenerated to bare `string` (the
 * `.passthrough()` failure mode #5680 measured: every literal is `Exclude`d by
 * `string`, so a guard written over it stays green while keys are demonstrably
 * narrow). Both are pinned out here rather than per entry.
 */
type VacuousEntry = {
  [K in MirrorKey]: [MirroredKeys< (typeof MIRRORS)[K] >] extends [never]
    ? K
    : string extends MirroredKeys< (typeof MIRRORS)[K] > ? K : never;
}[MirrorKey];

export type assertionNoVacuousEntry = Expect< Equal< VacuousEntry, never > >;

/**
 * A pairing whose two sides share NO key compares nothing and is green forever —
 * the shape a wrong pairing takes. (It is not a complete defence against a wrong
 * pairing, only against the vacuous one; the pairings themselves are reviewed.)
 */
export type NonOverlappingPair = {
  [K in MirrorKey]: [MirroredKeys< (typeof MIRRORS)[K] > & keyof Declared[K]] extends [never] ? K : never;
}[MirrorKey];

export type assertionEveryPairOverlaps = Expect< Equal< NonOverlappingPair, never > >;

/**
 * The six keys objectui#4605 was filed and re-measured against, pinned as really
 * reachable through `BaseSchema`'s own `.shape`.
 *
 * `assertionNoVacuousEntry` above catches shape degeneration for EVERY entry;
 * this is the one entry where the degenerate shape was actually observed — #5680
 * measured `.passthrough()` collapsing `keyof z.input<typeof Mirror>` to bare
 * `string`, with a pin written over it resolving `never` while five keys were
 * demonstrably narrow. So that card's explicit key pin is kept here by name
 * rather than folded into the generic check.
 */
export type assertionBaseSchemaKeysResolve = Expect<
  Equal<
    Exclude<
      'type' | 'label' | 'description' | 'visible' | 'disabled' | 'ariaLabel',
      MirroredKeys< (typeof MIRRORS)['base.zod.ts#BaseSchema'] >
    >,
    never
  >
>;

/* ── Exclusions ─────────────────────────────────────────────────────────────── */

/**
 * Every exported const in `../zod/` that is NOT a registered pair, with the reason.
 * An entry here is a declared decision; the census below refuses a const that is
 * in neither map.
 */
const EXCLUSIONS: Readonly<Record<string, string>> = {
  // A NAME COLLISION, not a mirror. The like-named `StyleProps` in `../base.ts` is a
  // Tailwind-scale vocabulary (`padding`, `margin`, `gap`, `backgroundColor`, …) and
  // shares ZERO keys with this `{ className, style }` object. A name-derived pairing
  // put them together; `assertionEveryPairOverlaps` rejected it.
  'base.zod.ts#StylePropsSchema':
    'no TS declaration in this package restates it — `StyleProps` (../base.ts) is an unrelated Tailwind style vocabulary that shares no key with it',
  'app.zod.ts#NavigationItemTypeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'app.zod.ts#NavigationItemSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'app.zod.ts#MenuItemSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'app.zod.ts#AppContextSelectorSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'base.zod.ts#SchemaNodeSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'base.zod.ts#ComponentInputControlTypeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'base.zod.ts#HTMLAttributesSchema':
    "an index signature, not a declared key set — there are no keys to compare",
  'base.zod.ts#EventHandlersSchema':
    "an index signature, not a declared key set — there are no keys to compare",
  'blocks.zod.ts#BlockComponentSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'complex.zod.ts#CalendarViewModeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'complex.zod.ts#FilterOperatorSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'complex.zod.ts#FilterBuilderConditionSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'complex.zod.ts#FilterGroupSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'complex.zod.ts#GlobalFilterSchema':
    "no TS declaration in this package restates it — there is no second definition to drift from",
  'complex.zod.ts#ComplexSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'crud.zod.ts#ActionExecutionModeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'crud.zod.ts#ActionConditionSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'crud.zod.ts#ActionSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'crud.zod.ts#CRUDComponentSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'data-display.zod.ts#TreeNodeSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'data-display.zod.ts#ChartTypeSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'data-display.zod.ts#DataDisplaySchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'disclosure.zod.ts#DisclosureSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'feedback.zod.ts#FeedbackSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'form.zod.ts#FormComponentSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'layout.zod.ts#PageRegionWidthSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'layout.zod.ts#PageVariableSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'layout.zod.ts#PageTypeSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'layout.zod.ts#LayoutSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'navigation.zod.ts#NavLinkSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'navigation.zod.ts#NavigationMenuItemSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'navigation.zod.ts#NavigationSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'objectql.zod.ts#HttpMethodSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'objectql.zod.ts#HttpRequestSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'objectql.zod.ts#ViewDataSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'objectql.zod.ts#ListColumnSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'objectql.zod.ts#SelectionConfigSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'objectql.zod.ts#PaginationConfigSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'objectql.zod.ts#UserActionsSchema':
    "spec-owned BY REFERENCE — the local `.extend(…)` adds renderer props that no TS declaration in this package restates",
  'objectql.zod.ts#ListViewSchema':
    "the DECLARATION is derived FROM this mirror — `ListViewSchema = ListViewInferred & ListViewRuntimeProps`, and `ListViewInferred = z.input<typeof ListViewSchema>` (`../objectql.ts`). Asserting parity here would be true no matter what either side said: a phantom assertion, not a check.",
  'objectql.zod.ts#ObjectQLComponentSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'overlay.zod.ts#MenuItemSchema':
    "recursive; declared `z.ZodType<any>`, which exposes no `.shape` to read — and accepts `any`, so it cannot be narrower than any declaration",
  'overlay.zod.ts#OverlaySchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'reports.zod.ts#ReportExportFormatSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'reports.zod.ts#ReportScheduleFrequencySchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'reports.zod.ts#ReportAggregationTypeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'reports.zod.ts#ReportScheduleSchema':
    "no TS declaration in this package restates it — there is no second definition to drift from",
  'reports.zod.ts#ReportUnionSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'views.zod.ts#ViewTypeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'views.zod.ts#ViewComponentSchema':
    "a union OVER the mirrors, not an object of its own — its members are checked individually above",
  'index.zod.ts#AnyComponentSchema':
    "the barrel union OVER the mirrors, not an object of its own — its members are checked individually above",
  'index.zod.ts#SCHEMA_VERSION':
    "a version string, not a schema",
};

/* ── Which pairs depend on @objectstack/spec ────────────────────────────────── */

/**
 * Registered mirrors built FROM a spec schema (`Spec…` appears in the definition),
 * so one side of their comparison moves when `@objectstack/spec` moves.
 *
 * This is a real property of the ledger and it is written down rather than left to
 * be rediscovered: for these pairs a spec bump can change the measured drift set
 * with nothing in this repo changing, and `assertionDriftMatchesLedger` will fire.
 * That is correct behaviour — a vocabulary the spec widened or withdrew is exactly
 * what wants triage — but the failure should not read as a mystery. Three of the
 * ledgered pairs are in here: `DashboardComponentSchema`, `DashboardWidgetSchema`
 * and `PageNodeSchema`.
 *
 * Kept honest by the test below, which re-derives this set from the mirror sources
 * instead of trusting the list.
 */
const SPEC_DERIVED_PAIRS: readonly string[] = [
  'app.zod.ts#AppComponentSchema',
  'app.zod.ts#NavigationAreaSchema',
  'base.zod.ts#BaseSchema',
  'complex.zod.ts#DashboardComponentSchema',
  'complex.zod.ts#DashboardWidgetSchema',
  'form.zod.ts#SelectOptionSchema',
  'layout.zod.ts#PageNodeSchema',
  'objectql.zod.ts#ObjectGanttSchema',
  'objectql.zod.ts#ObjectMapSchema',
  'objectql.zod.ts#ObjectViewSchema',
];

/* ── Runtime: the population is closed ──────────────────────────────────────── */

const ZOD_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'zod');

/** Every `export const` in the mirror directory, keyed the same way as the maps. */
function exportedConsts(): string[] {
  const out: string[] = [];
  for (const file of readdirSync(ZOD_DIR).sort()) {
    if (!file.endsWith('.zod.ts')) continue;
    const src = readFileSync(join(ZOD_DIR, file), 'utf8');
    for (const m of src.matchAll(/^export const ([A-Za-z0-9_]+)/gm)) out.push(`${file}#${m[1]}`);
  }
  return out;
}

describe('zod mirror parity — the population is closed', () => {
  it('every exported const in ../zod/ is either a registered pair or an excluded one', () => {
    const registered = new Set(Object.keys(MIRRORS));
    const unaccounted = exportedConsts().filter((k) => !registered.has(k) && !(k in EXCLUSIONS));
    expect(unaccounted, `
New zod export(s) in packages/types/src/zod/ that this guard does not cover.
Add each to MIRRORS with the TS declaration it restates, or to EXCLUSIONS with the
reason it has nothing to drift from. Do not leave it out — an unlisted mirror is
exactly how objectui#4605 and #5186 stayed latent.`).toEqual([]);
  });

  it('no map entry names a const that no longer exists', () => {
    const onDisk = new Set(exportedConsts());
    const stale = [...Object.keys(MIRRORS), ...Object.keys(EXCLUSIONS)].filter((k) => !onDisk.has(k));
    expect(stale, 'stale entries — the const was renamed or removed').toEqual([]);
  });

  it('the census can actually see the directory (non-vacuity)', () => {
    // A broken reader returns [] and every assertion above passes while checking
    // nothing. Pin that it finds the directory and the mirror this guard grew from.
    const found = exportedConsts();
    expect(found.length).toBeGreaterThan(200);
    expect(found).toContain('base.zod.ts#BaseSchema');
  });

  it('SPEC_DERIVED_PAIRS matches what the mirror sources actually do', () => {
    // Re-derived, not trusted: a mirror that starts referencing a `Spec…` schema
    // joins the spec-sensitive set whether or not anyone updates the list.
    const derived: string[] = [];
    for (const key of Object.keys(MIRRORS)) {
      const [file, name] = key.split('#');
      const src = readFileSync(join(ZOD_DIR, file), 'utf8');
      const at = src.search(new RegExp(`^export const ${name}\\b`, 'm'));
      if (at < 0) continue;
      const rest = src.slice(at);
      const next = rest.slice(10).search(/\n(?=export (const|type|function))/);
      const body = next < 0 ? rest : rest.slice(0, next + 10);
      if (/\bSpec[A-Z]\w*/.test(body)) derived.push(key);
    }
    expect(derived.sort(), 'a mirror gained or lost a spec dependency — update SPEC_DERIVED_PAIRS')
      .toEqual([...SPEC_DERIVED_PAIRS].sort());
  });

  it('every exclusion carries a reason', () => {
    const empty = Object.entries(EXCLUSIONS).filter(([, why]) => why.trim().length < 20);
    expect(empty.map(([k]) => k), 'an exclusion without a reason is an oversight').toEqual([]);
  });
});
