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
 * `assertionNoVacuousEntry` below pins that for all 157 entries at once.
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
 * ## The population, and where each number came from (objectui#6141)
 *
 * ⚠️ Every count in this header is READ, not inherited. The three that used to
 * stand here — "163 pairs" twice and "13 entries" once — were stale, and they were
 * the numbers other cards quoted as the size of the drift problem (objectui#5927's
 * framing, and objectui#6058's own dispatch, both inherited "163"). On a file whose
 * entire subject is measurement that is worth stating explicitly:
 *
 *   - **157 pairs** — `Object.keys(MIRRORS).length`, which `assertionRegistryHalvesAgree`
 *     already pins equal to `keyof Declared`. 155 until objectui#7655 registered the
 *     `ChatbotEnhancedSchema` and `ChatbotFloatingSchema` twins; 154 until objectui#7352
 *     registered `data-display.zod.ts#DrillDownConfigSchema` — a nested config mirror
 *     paired with the local `DrillDownConfig`, the `ObjectMapConfigSchema` precedent —
 *     which carries no ledger entry. ⚠️ **This line rotted twice and was re-derived at
 *     objectui#7352 contract review** (objectui#7655's contract review measured the same
 *     rot independently: three instruments read 154 where the prose said 160). Its
 *     history, measured by running the same walk over this file at each revision
 *     rather than by reading the prose: `4ca30d044` wrote "160" when `MIRRORS` held
 *     **163**; `d88e20f55` (objectui#7432) took the registry to **154** without touching
 *     the sentence; objectui#7352 then added its 1 to the stale baseline and wrote 161.
 *     Two independent derivations agree on 157 today — a TypeScript AST walk counting
 *     `PropertyAssignment` nodes in the `MIRRORS` initializer, and a line-oriented parse
 *     of the same block — and they agree on the historical figures above. ⛔ Do not add
 *     a delta to this number; count the registry. Nothing asserts it against a written
 *     one, so this line is prose and can rot; the pin that cannot is the one
 *     comparing the two halves to each other.
 *   - **42 entries** in `KnownDrift`, **63 keys** across them — 40 / 57 until
 *     objectui#7655 SEEDED the `ChatbotEnhancedSchema` and `ChatbotFloatingSchema` pairs
 *     with three runtime-slot refusals each (pairs born ledgered in the #6124 shape,
 *     not growth on an existing entry); 40 / 56 until
 *     objectui#7104 declared `AlertDialogSchema.onAction`, the action button's
 *     `onClick` the renderer had been reading UNDECLARED, as a RUNTIME SLOT on an
 *     already-ledgered pair (growth on an existing entry, both faces measured);
 *     39 / 55 until
 *     objectui#7455 SEEDED `app.zod.ts#AppComponentSchema` with its one
 *     spec-derived key `hidden` (a pair born ledgered, not growth on an existing
 *     entry: both faces read `boolean` until the base was widened, and only the
 *     DECLARED face moved — see that entry). It stood at 39 / 55 rather than
 *     39 / 56 because objectui#6940
 *     REPAIRED `DataTableSchema.rowActions` (the entry kept its other four keys, so
 *     the entry count did not move). It was 12 / 17 until
 *     objectui#6124 added the RUNTIME-SLOT class (28 pairs touched, 35 keys) — see
 *     the class note inside the ledger, above `ButtonSchema` — 36 / 52 until
 *     objectui#6576 minted `ObjectDataTableSchema` with one such arm (`onRowClick`),
 *     and 37 / 53 until objectui#7344 swept the string / `z.any()` handler mirrors:
 *     `DetailSchema` and `DetailViewSchema` entered (one `onBack` each) and
 *     `CalendarViewSchema` grew by `onEventClick`.
 *   - **14 entries** in `UnmirroredDeclared`, **96 keys** across them — 13 / 94 until
 *     objectui#7655 SEEDED a `ChatbotFloatingSchema` entry with `displayMode` and
 *     `floatingConfig`, the two keys that face declares alongside `ChatbotSchema`
 *     (whose own entry keeps all three of its keys — a pair born ledgered, not a
 *     move); 15 / 96 until objectui#7352 MIRRORED both `drillDown` rows at once
 *     (`ChartSchema` and `ObjectDataTableSchema`, each the entry's whole content, so
 *     both entries went): the ledger's second and third shrink by REPAIR, on the route
 *     objectui#6639 opened. It read 17 / 98
 *     between objectui#6576, which SEEDED the new `ObjectDataTableSchema` pair with its
 *     one measured key `drillDown` (a pair born ledgered, not growth on an existing
 *     one), and objectui#7129, which RETIRED `DetailViewSectionSchema.hideEmpty` —
 *     the ledger's first shrink by removing the DECLARATION rather than by mirroring
 *     it, and the entry's whole content, so the entry went too. objectui#7623 took
 *     that route a second time for `DashboardComponentSchema.title` (16 / 97 →
 *     15 / 96), again the entry's whole content — and the first time it reached the
 *     SPEC-DERIVED half. ⚠️ It was
 *     **121** when objectui#6058 seeded it; objectui#6152 moved 23 callback-shaped
 *     keys to the ledger below by RECLASSIFICATION, not by fixing them, and
 *     objectui#6639 MIRRORED `ObjectGridSchema.title` — one key actually repaired.
 *     Anything citing "121" as the mirroring debt is citing a number that changed
 *     meaning — the comparable figure is 95 + 1 mirrored + 2 retired + 23
 *     reclassified. The full statement is on that ledger.
 *   - **7 entries** in `RuntimeOnlyDeclared`, **24 keys** across them. Six of the
 *     seven are a subset of the 14 pairs above; `TreeViewSchema` is NOT — it is
 *     the first pair whose ONLY ledger entry is a runtime-only one
 *     (objectui#6150 declared `onNodeClick` on an otherwise clean pair), which is why
 *     the union of the two unmirrored ledgers is **15** pairs and not 14.
 *   - **142 pairs with no entry in either** unmirrored ledger — 157 − 15, measured,
 *     not stepped. ⚠️ This line used to carry a running chain of deltas (141 → 142 →
 *     143 → 144 → 147, one per card). Every one of those was computed against the
 *     stale pair count above, so they were arithmetic on a wrong base and are NOT
 *     re-derivable from this file; objectui#7352 contract review replaced the chain with
 *     the measurement (objectui#7655 re-measured: 142 = 157 − 15). ⛔ Do not restart
 *     the chain — subtract the union from the registry count, both read from the file.
 *   - 157 − 42 = **115**, the "pairs with no entry" `LedgerMismatch` speaks of.
 *
 * ## Two ratchets, because the forward comparison has two halves
 *
 * The forward comparison runs over the UNION of the mirror's keys and the
 * declaration's, and a declared key can fail it in two structurally different ways:
 * the mirror declares the key and REFUSES its declared type (`NarrowerThanDeclared`
 * → `KnownDrift`), or the mirror has never heard of the key at all
 * (`UnmirroredDeclaredKeys` → `UnmirroredDeclared`). The second half was invisible
 * until objectui#6058 — an unmirrored key did not compare unequal, it left the
 * comparison entirely — so it is ledgered separately, seeded at its own measured
 * debt, and `KnownDrift` keeps its meaning and its citable history untouched.
 *
 * The second half is itself recorded in TWO ledgers, because its keys do not share
 * a remedy (objectui#6152). `UnmirroredDeclared` holds the keys where MIRRORING is
 * the fix; `RuntimeOnlyDeclared` holds callback-shaped keys that are runtime slots
 * and must never be mirrored at all. Both are reconciled against ONE measurement,
 * through the union at `RecordedUnmirrored`, so a key cannot fall between them.
 *
 * ## And a THIRD direction, which is a different comparison (objectui#7069)
 *
 * Both halves above are the FORWARD comparison: they ask whether everything the
 * declaration admits survives the mirror. Neither can see the reverse inequality —
 * a mirrored, data-shaped key whose mirror ACCEPTS a spelling the declaration
 * refuses. `NarrowerThanDeclared` finds the declared type fits, so the key is
 * silent; `UnmirroredDeclaredKeys` finds the key present in `.shape`, so it never
 * enters. The blindness is structural, not an omission, and it is pinned as such at
 * `assertionNarrowerOperatorIsBlindToAWidening` and
 * `assertionUnmirroredOperatorIsBlindToAWidening` rather than argued here.
 *
 * It is the direction that faces the AUTHOR: the mirror is what validates written
 * metadata, so a wider key returns a green `safeParse` on a spelling `tsc` refuses.
 * `WiderThanDeclaredKeys` → `WiderThanDeclared` is the third ledger, reconciled by
 * `assertionWiderMatchesLedger` and seeded at its own measured debt.
 *
 * ⚠️ Its measurement has a stated hole, and the hole is where the producer that
 * motivated the card lives: a slot spelled through `SchemaNodeSchema` reads
 * `unknown` on the input face, because that const is annotated `z.ZodType< any >`
 * to break its own recursion. `Unconstrained` excludes that face and says why; the
 * runtime leg at the bottom of this file bounds the excluded region by pinning that
 * every lazy node under the registry is that one const.
 *
 * ## KNOWN_DRIFT is a ratchet, not a waiver
 *
 * 42 of the 157 pairs carry TYPE drift TODAY (measured, not assumed). Each is
 * pinned to its EXACT drifted key set, so the entry fails when new drift appears on
 * that mirror AND when the recorded drift is fixed — a stale entry cannot rot
 * quietly. Correcting them is not one change: the pairs below split into DISJOINT
 * vocabularies where one side is dead, required-vs-optional mismatches, structural
 * pairs that ride @objectstack/spec unification (objectui#2231), and one DELIBERATE
 * divergence that must stay expressible (`PageNodeSchema.pageType`). Each carries
 * its measurement and its reason inline.
 *
 * It was 17 until objectui#5927 landed the seven STRICT WIDENINGS (group A of that
 * card's grouping) — the class where the TS side is simply a superset and the
 * renderer was measured to implement the missing spellings. Four entries left the
 * ledger outright (`SelectSchema`, `ButtonGroupSchema`, `ObjectChartSchema`,
 * `ViewSwitcherSchema`) and two shrank to the keys that are NOT widenings
 * (`DataTableSchema` kept `rowActions`, `FormSchema` kept `fields`/`mode`). The
 * remaining classes are rulings, not edits, and are deliberately still here.
 *
 * Then 12 became 36 with objectui#6124, which is the opposite movement from #5927's
 * and must not be read as regression: 24 pairs ENTERED (and 4 grew) because the
 * ruling put a NAMED REFUSAL on the mirror side of 35 runtime-slot handler keys while
 * their TypeScript twins stay callable. That drift is the ruling's intended shape,
 * ledgered so the ratchet holds it exactly — a pair leaving this class means either
 * the mirror accepts a function again or a renderer lost its callback.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import type { z } from 'zod';

import { AppActionSchema, AppComponentSchema, NavigationAreaSchema } from '../zod/app.zod.js';
import { BaseSchema, ComponentConfigSchema, ComponentInputSchema, ComponentMetaSchema, KeyedI18nLabelSchema, SchemaNodeSchema } from '../zod/base.zod.js';
import { CalendarEventSchema, CalendarViewSchema, CarouselItemSchema, CarouselSchema, ChatbotSchema, ChatbotEnhancedSchema, ChatbotFloatingSchema, ChatMessageSchema, ChatMessageSourceSchema, ChatToolInvocationSchema, DashboardComponentSchema, DashboardConfigSchema, DashboardWidgetConfigSchema, DashboardWidgetLayoutSchema, DashboardWidgetSchema, FilterBuilderSchema, FilterFieldSchema, DeclarativeKanbanCardSchema, DeclarativeKanbanColumnSchema, DeclarativeKanbanSchema } from '../zod/complex.zod.js';
import { ActionCallbackSchema, CRUDDialogSchema, DetailSchema } from '../zod/crud.zod.js';
import { AlertSchema, AvatarSchema, BadgeSchema, BarChartSchema, ChartDataSeriesSchema, ChartSchema, DataTableSchema, DrillDownConfigSchema, HtmlSchema, KbdSchema, ListItemSchema, ListSchema, MarkdownSchema, StaticTableColumnSchema, StatisticSchema, TableColumnSchema, TableSchema, TimelineEventSchema, TimelineSchema, TreeViewSchema } from '../zod/data-display.zod.js';
import { AccordionItemSchema, AccordionSchema, CollapsibleSchema, ToggleGroupItemSchema, ToggleGroupSchema } from '../zod/disclosure.zod.js';
import { EmptySchema, LoadingSchema, ProgressSchema, SkeletonSchema, SonnerSchema, SpinnerSchema, ToasterSchema, ToastSchema } from '../zod/feedback.zod.js';
import { ButtonSchema, CalendarSchema, CheckboxSchema, CodeEditorSchema, ComboboxOptionSchema, ComboboxSchema, CommandGroupSchema, CommandItemSchema, CommandSchema, DatePickerSchema, FieldConditionSchema, FieldConstraintsSchema, FileUploadSchema, FormFieldSchema, FormSchema, InputOTPSchema, InputSchema, LabelSchema, RadioGroupSchema, RadioOptionSchema, SelectOptionSchema, SelectSchema, SliderSchema, SwitchSchema, TextareaSchema, ToggleSchema } from '../zod/form.zod.js';
import { AspectRatioSchema, BoxSchema, CardSchema, ContainerSchema, DivSchema, FlexSchema, GridSchema, IconSchema, ImageSchema, PageNodeRegionSchema, PageNodeSchema, ResizablePanelSchema, ResizableSchema, ScrollAreaSchema, SeparatorSchema, StackSchema, TabItemSchema, TabsSchema, TextSchema, TextSpanSchema } from '../zod/layout.zod.js';
import { BreadcrumbItemSchema, BreadcrumbSchema, ButtonGroupButtonSchema, ButtonGroupSchema, HeaderBarSchema, NavigationMenuSchema, PaginationSchema, SidebarSchema } from '../zod/navigation.zod.js';
import { ObjectCalendarSchema, ObjectChartSchema, ObjectDataTableSchema, ObjectFormSchema, ObjectGallerySchema, ObjectGanttSchema, ObjectGridSchema, ObjectKanbanSchema, ObjectMapConfigSchema, ObjectMapSchema, ObjectTreeSchema, ObjectViewSchema, SortConfigSchema } from '../zod/objectql.zod.js';
import { AlertDialogSchema, ContextMenuSchema, DialogSchema, DrawerSchema, DropdownMenuSchema, HoverCardSchema, MenubarMenuSchema, MenubarSchema, PopoverSchema, SheetSchema, TooltipSchema } from '../zod/overlay.zod.js';
import { ReportBuilderSchema, ReportComponentSchema, ReportExportConfigSchema, ReportFieldSchema, ReportFilterSchema, ReportGroupBySchema, ReportSectionSchema, ReportViewerSchema } from '../zod/reports.zod.js';
import { DetailViewFieldSchema, DetailViewSchema, DetailViewSectionSchema, DetailViewTabSchema, FilterUISchema, SortUISchema, ViewSwitcherSchema } from '../zod/views.zod.js';

import type { AppAction as Ts_AppAction, AppComponentSchema as Ts_AppComponentSchema, NavigationArea as Ts_NavigationArea } from '../app';
import type { BaseSchema as Ts_BaseSchema, ComponentConfig as Ts_ComponentConfig, ComponentInput as Ts_ComponentInput, ComponentMeta as Ts_ComponentMeta, KeyedI18nLabel as Ts_KeyedI18nLabel } from '../base';
import type { CalendarEvent as Ts_CalendarEvent, CalendarViewSchema as Ts_CalendarViewSchema, CarouselItem as Ts_CarouselItem, CarouselSchema as Ts_CarouselSchema, ChatbotSchema as Ts_ChatbotSchema, ChatbotEnhancedSchema as Ts_ChatbotEnhancedSchema, ChatbotFloatingSchema as Ts_ChatbotFloatingSchema, ChatMessage as Ts_ChatMessage, ChatMessageSource as Ts_ChatMessageSource, ChatToolInvocation as Ts_ChatToolInvocation, DashboardComponentSchema as Ts_DashboardComponentSchema, DashboardWidgetLayout as Ts_DashboardWidgetLayout, DashboardWidgetSchema as Ts_DashboardWidgetSchema, FilterBuilderSchema as Ts_FilterBuilderSchema, FilterField as Ts_FilterField, DeclarativeKanbanCard as Ts_KanbanCard, DeclarativeKanbanColumn as Ts_KanbanColumn, DeclarativeKanbanSchema as Ts_KanbanSchema } from '../complex';
import type { DashboardConfig as Ts_DashboardConfig, DashboardWidgetConfig as Ts_DashboardWidgetConfig } from '../designer';
import type { ActionCallback as Ts_ActionCallback, CRUDDialogSchema as Ts_CRUDDialogSchema, DetailSchema as Ts_DetailSchema } from '../crud';
import type { AlertSchema as Ts_AlertSchema, AvatarSchema as Ts_AvatarSchema, BadgeSchema as Ts_BadgeSchema, BarChartSchema as Ts_BarChartSchema, ChartDataSeries as Ts_ChartDataSeries, ChartSchema as Ts_ChartSchema, DataTableSchema as Ts_DataTableSchema, DrillDownConfig as Ts_DrillDownConfig, HtmlSchema as Ts_HtmlSchema, KbdSchema as Ts_KbdSchema, ListItem as Ts_ListItem, ListSchema as Ts_ListSchema, MarkdownSchema as Ts_MarkdownSchema, StaticTableColumn as Ts_StaticTableColumn, StatisticSchema as Ts_StatisticSchema, TableColumn as Ts_TableColumn, TableSchema as Ts_TableSchema, TimelineEvent as Ts_TimelineEvent, TimelineSchema as Ts_TimelineSchema, TreeViewSchema as Ts_TreeViewSchema, BreadcrumbItem as Ts_BreadcrumbItem, BreadcrumbSchema as Ts_BreadcrumbSchema } from '../data-display';
import type { AccordionItem as Ts_AccordionItem, AccordionSchema as Ts_AccordionSchema, CollapsibleSchema as Ts_CollapsibleSchema, ToggleGroupItem as Ts_ToggleGroupItem, ToggleGroupSchema as Ts_ToggleGroupSchema } from '../disclosure';
import type { EmptySchema as Ts_EmptySchema, LoadingSchema as Ts_LoadingSchema, ProgressSchema as Ts_ProgressSchema, SkeletonSchema as Ts_SkeletonSchema, SonnerSchema as Ts_SonnerSchema, SpinnerSchema as Ts_SpinnerSchema, ToasterSchema as Ts_ToasterSchema, ToastSchema as Ts_ToastSchema } from '../feedback';
import type { ButtonSchema as Ts_ButtonSchema, CalendarSchema as Ts_CalendarSchema, CheckboxSchema as Ts_CheckboxSchema, CodeEditorSchema as Ts_CodeEditorSchema, ComboboxOption as Ts_ComboboxOption, ComboboxSchema as Ts_ComboboxSchema, CommandGroup as Ts_CommandGroup, CommandItem as Ts_CommandItem, CommandSchema as Ts_CommandSchema, DatePickerSchema as Ts_DatePickerSchema, FieldCondition as Ts_FieldCondition, FieldValidationRules as Ts_FieldValidationRules, FileUploadSchema as Ts_FileUploadSchema, FormField as Ts_FormField, FormSchema as Ts_FormSchema, InputOTPSchema as Ts_InputOTPSchema, InputSchema as Ts_InputSchema, LabelSchema as Ts_LabelSchema, RadioGroupSchema as Ts_RadioGroupSchema, RadioOption as Ts_RadioOption, SelectOption as Ts_SelectOption, SelectSchema as Ts_SelectSchema, SliderSchema as Ts_SliderSchema, SwitchSchema as Ts_SwitchSchema, TextareaSchema as Ts_TextareaSchema, ToggleSchema as Ts_ToggleSchema } from '../form';
import type { AspectRatioSchema as Ts_AspectRatioSchema, BoxSchema as Ts_BoxSchema, CardSchema as Ts_CardSchema, ContainerSchema as Ts_ContainerSchema, DivSchema as Ts_DivSchema, FlexSchema as Ts_FlexSchema, GridSchema as Ts_GridSchema, IconSchema as Ts_IconSchema, ImageSchema as Ts_ImageSchema, PageNodeRegion as Ts_PageNodeRegion, PageNodeSchema as Ts_PageNodeSchema, ResizablePanel as Ts_ResizablePanel, ResizableSchema as Ts_ResizableSchema, ScrollAreaSchema as Ts_ScrollAreaSchema, SeparatorSchema as Ts_SeparatorSchema, StackSchema as Ts_StackSchema, TabItem as Ts_TabItem, TabsSchema as Ts_TabsSchema, TextSchema as Ts_TextSchema, TextSpanSchema as Ts_TextSpanSchema } from '../layout';
import type { ButtonGroupButton as Ts_ButtonGroupButton, ButtonGroupSchema as Ts_ButtonGroupSchema, HeaderBarSchema as Ts_HeaderBarSchema, NavigationMenuSchema as Ts_NavigationMenuSchema, PaginationSchema as Ts_PaginationSchema, SidebarSchema as Ts_SidebarSchema } from '../navigation';
import type { ObjectCalendarSchema as Ts_ObjectCalendarSchema, ObjectChartSchema as Ts_ObjectChartSchema, ObjectDataTableSchema as Ts_ObjectDataTableSchema, ObjectFormSchema as Ts_ObjectFormSchema, ObjectGallerySchema as Ts_ObjectGallerySchema, ObjectGanttSchema as Ts_ObjectGanttSchema, ObjectGridSchema as Ts_ObjectGridSchema, ObjectKanbanSchema as Ts_ObjectKanbanSchema, ObjectMapConfig as Ts_ObjectMapConfig, ObjectMapSchema as Ts_ObjectMapSchema, ObjectTreeSchema as Ts_ObjectTreeSchema, ObjectViewSchema as Ts_ObjectViewSchema, SortConfig as Ts_SortConfig } from '../objectql';
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
 * through. The opposite INEQUALITY — the mirror accepting what the declaration
 * refuses — is a different class and is not what THIS type measures;
 * `WiderThanDeclaredKeys` below measures it, and
 * `assertionNarrowerOperatorIsBlindToAWidening` pins that this one cannot.
 */
export type NarrowerThanDeclared< M, D > = {
  [K in MirroredKeys< M > & keyof D]: [D[K]] extends [InputOf< ShapeOf< M >[K] >] ? never : K;
}[MirroredKeys< M > & keyof D];

/**
 * A declaration's OWN declared members, with any index signature stripped.
 *
 * `keyof D` is unusable on this population: most component declarations extend
 * `BaseSchema`, which carries `[key: string]: any` (objectui#5155), and a string
 * index signature ABSORBS every literal name — `keyof ObjectGanttSchema` resolves
 * to bare `string`. Measured, not assumed:
 *
 *     declare const bare: keyof ObjectGanttSchema;
 *     const _: never = bare;
 *     // -> Type 'keyof ObjectGanttSchema' is not assignable to type 'never'.
 *     //      Type 'string' is not assignable to type 'never'.
 *
 * A homomorphic mapped type is the escape: TypeScript maps declared members and
 * index signatures SEPARATELY, so remapping the index-signature keys to `never`
 * leaves the literal members — INCLUDING the ones inherited from `BaseSchema`.
 * Same probe against this alias resolves the 36 literal names of
 * `ObjectGanttSchema` and the 21 of `BaseSchema` (20 until objectui#6357 added `bind`).
 *
 * ⚠️ This lifts the ceiling on what the GUARD can READ, not on what a mirror can
 * REJECT. #5155's ceiling stands: `BaseSchema` is `.passthrough()`, so declaring a
 * key still does not buy rejection of a misspelling. The two are different
 * questions and only the first one is this file's.
 */
type WithoutIndexSignature< D > = {
  [K in keyof D as string extends K ? never : number extends K ? never : K]: D[K];
};

/** The declaration's DECLARED keys, read without `keyof` on the resolved key set. */
export type DeclaredKeys< D > = Extract< keyof WithoutIndexSignature< D >, string >;

/**
 * Declared on the TS side and ABSENT from the mirror's `.shape` entirely.
 *
 * This is the half `NarrowerThanDeclared` above cannot see, and the reason is
 * structural rather than a threshold: that type maps over the INTERSECTION
 * `MirroredKeys< M > & keyof D`, so a declared key the mirror never mentions is
 * not compared and found equal — it LEAVES THE COMPARISON. objectui#6058 measured
 * the blind spot with a two-instruments ablation: ten keys declared on
 * `ObjectGanttSchema` and stripped from its mirror left both halves of this guard
 * green (runtime 5 passed EXIT=0, compile-time EXIT=0) while
 * `gantt-declared-keys.test.ts` over the same tree read 2 failed | 7 passed EXIT=1.
 *
 * It is a real defect in the pair, not noise from the instrument: the published
 * TypeScript invites an author to write the key and the published validator has
 * never heard of it. Under `.passthrough()` the value rides through UNVALIDATED
 * (`readOnly: 'yes'` parses green); under a mirror that is not passthrough it is
 * refused outright. Either way `declared !== enforced`.
 */
export type UnmirroredDeclaredKeys< M, D > = Exclude< DeclaredKeys< D >, MirroredKeys< M > >;

/** `any`, told apart from `unknown` — `[unknown] extends [T]` accepts both. */
export type IsAny< T > = 0 extends 1 & T ? true : false;

/**
 * A mirror slot whose static INPUT face carries no information: `unknown`, `any`,
 * or a list of either.
 *
 * This is the hole in `WiderThanDeclaredKeys` below, and the hole is one const
 * wide. `base.zod.ts#SchemaNodeSchema` is annotated `z.ZodType< any >` to break the
 * recursion inside its own `z.lazy`, and zod 4 defaults such a schema's INPUT
 * parameter to `unknown`. Every slot spelled through it therefore reads `unknown`
 * (or `unknown[]`) on the input face — wider than every declaration BY DEFINITION,
 * and silent about what the mirror accepts at RUNTIME, where the lazy union does
 * validate. Comparing there would report the annotation and not the accept-set, so
 * those keys are not measured. ⚠️ That is not a small carve-out: it is exactly
 * where the producer objectui#7069 called systematic lives — the
 * `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])` spelling — so the
 * producer that motivated this direction is the one the type level cannot judge.
 * The runtime leg at the bottom of this file is what bounds the region instead.
 *
 * ⚠️ It is deliberately NOT recursive, and that is a measurement rather than a
 * preference. A version descending into object properties and array elements was
 * written and withdrawn: on the pairs with the most structure it drove the whole
 * `WiderOf< K >` instantiation to `any`, and `any` is assignable to `never`, so the
 * invariant below went SILENTLY GREEN on precisely those pairs — a guard that
 * cannot fail, wearing the shape of a stricter one.
 * `assertionNoVacuousWiderMeasurement` exists because of that attempt and pins the
 * failure mode, so the next deeper predicate cannot land unnoticed.
 *
 * What the shallow form costs: an `unknown` NESTED one level further down — a
 * schema node inside an array element's property — is not excluded, so those
 * entries record the annotation rather than an accept-set gap. They are seeded and
 * labelled, under the ledger's SCHEMA-NODE class note.
 */
export type Unconstrained< T > =
  [unknown] extends [T] ? true
  : true extends (NonNullable< T > extends readonly (infer E)[] ? ([unknown] extends [E] ? true : false) : false)
    ? true
  : false;

/**
 * The premise the exclusion rests on, asserted rather than described: the
 * annotation really does erase `SchemaNodeSchema`'s input face. If it is ever
 * spelled so that the face carries information, this fails and the exclusion — and
 * the ledger's SCHEMA-NODE class with it — has to be re-derived.
 */
export type assertionSchemaNodeFaceIsUnconstrained =
  Expect< Equal< Unconstrained< z.input< typeof SchemaNodeSchema > >, true > >;

/**
 * Every key whose mirror ACCEPTS a spelling the declaration REFUSES.
 *
 * The reverse inequality of `NarrowerThanDeclared`, and the direction objectui#7069
 * filed as invisible BY CONSTRUCTION to every ledger that stood before it.
 * `NarrowerThanDeclared` asks whether the DECLARED type fits through the mirror;
 * this asks whether what the MIRROR accepts fits inside the declaration. The two
 * are independent — a pair can fail both (disjoint vocabularies), either, or
 * neither — which is why the reverse inequality never entered the forward
 * comparison, and `UnmirroredDeclaredKeys` cannot see it either because a wider key
 * IS mirrored and so never leaves the comparison. Both blindnesses are PINNED as
 * synthetic recognition cases below rather than asserted in prose.
 *
 * Why this direction is not cosmetic symmetry: the mirror is the AUTHORING
 * boundary. A wider key hands an author a green `safeParse` on a spelling `tsc`
 * refuses, so the two published faces disagree about the accept-set and the runtime
 * reader receives input the published types say cannot exist.
 *
 * `DeclaredKeys` and not `keyof D` supplies the declared half, for the reason
 * `WithoutIndexSignature` gives: most declarations carry `BaseSchema`'s string
 * index signature, which resolves `D[K]` to `any` for a key the declaration does
 * not really state — and `any` absorbs the comparison in this direction exactly as
 * silently as in the other one.
 */
export type WiderThanDeclaredKeys< M, D > = {
  [K in MirroredKeys< M > & DeclaredKeys< D >]:
    Unconstrained< InputOf< ShapeOf< M >[K] > > extends true
      ? never
      : [InputOf< ShapeOf< M >[K] >] extends [D[K]] ? never : K;
}[MirroredKeys< M > & DeclaredKeys< D >];

/**
 * Reconcile ONE pair's measured key set against what a ledger records for it:
 * `never` when they agree, the pair key otherwise.
 *
 * Factored out and driven by synthetic pairs below rather than written inline, for
 * the reason objectui#6133 gives for exporting its `reconcileGuards`: **a run over
 * TODAY's tree can only ever show that today's tree is green.** A baseline that has
 * never been shown to FAIL is indistinguishable from no baseline, and no amount of
 * green CI tells the two apart. Recognition is pinned at
 * `assertionRatchet…` below, in every direction a ledger can be wrong.
 */
export type ReconcileAgainstLedger< K, Measured, Recorded > =
  Equal< Measured, Recorded > extends true ? never : K;

/* ── Recognition: the ratchet is shown to FAIL, in both directions ──────────── */

/** A pair whose measured set matches its ledger entry stays silent. */
export type assertionRatchetAcceptsAgreement =
  Expect< Equal< ReconcileAgainstLedger< 'p', 'a', 'a' >, never > >;

/**
 * …and so does a clean pair with no entry — 115 of the 157 on the `KnownDrift` half,
 * 142 on the unmirrored half (both measured, not stepped).
 */
export type assertionRatchetAcceptsCleanPair =
  Expect< Equal< ReconcileAgainstLedger< 'p', never, never >, never > >;

/**
 * ⬆ GROWTH on a CLEAN pair — the property the whole seeding argument rests on. A
 * NEW declared-but-unmirrored key on a pair the ledger does not mention reddens it
 * immediately. This is why a seeded baseline is a FLOOR and not a waiver.
 */
export type assertionRatchetRejectsFreshDrift =
  Expect< Equal< ReconcileAgainstLedger< 'p', 'a', never >, 'p' > >;

/**
 * ⬆ GROWTH on a LEDGERED pair — an entry cannot absorb a second key, so drift
 * cannot be smuggled into a pair that already owes some. Read the other way round,
 * this is also the pin that a fact DELETED from the seed is not silently
 * re-acceptable: deleting `'a'` from a recorded `'a' | 'b'` leaves exactly this
 * shape, and it fails.
 */
export type assertionRatchetRejectsGrowth =
  Expect< Equal< ReconcileAgainstLedger< 'p', 'a' | 'b', 'a' >, 'p' > >;

/**
 * ⬇ SHRINK — a recorded key that has since been MIRRORED fails as STALE and names
 * its own pair. Without this the ledger rots into an allowlist nobody re-reads, and
 * the shrink-only promise becomes prose.
 */
export type assertionRatchetRejectsStaleKey =
  Expect< Equal< ReconcileAgainstLedger< 'p', 'a', 'a' | 'b' >, 'p' > >;

/** ⬇ SHRINK to nothing — a fully fixed pair fails until its entry is DELETED. */
export type assertionRatchetRejectsStaleEntry =
  Expect< Equal< ReconcileAgainstLedger< 'p', never, 'a' >, 'p' > >;

/* ── Recognition: the SPLIT unmirrored ledger, both directions (objectui#6152) ── */

/**
 * The unmirrored half reconciles one measurement against the UNION of two ledgers.
 * The pins above cover the shape `Recorded = one ledger`; these cover the shape it
 * actually has. `'onX'` stands for a callback-shaped key recorded in
 * `RuntimeOnlyDeclared`, `'a'` for an ordinary omission in `UnmirroredDeclared`.
 */
export type ReconcileAgainstSplitLedger< K, Measured, Ordinary, RuntimeOnly > =
  ReconcileAgainstLedger< K, Measured, Ordinary | RuntimeOnly >;

/** The two halves TOGETHER account for the measured set — silent. */
export type assertionSplitLedgerAcceptsBothHalves =
  Expect< Equal< ReconcileAgainstSplitLedger< 'p', 'a' | 'onX', 'a', 'onX' >, never > >;

/**
 * ⬆ GROWTH — a NEW callback-shaped declared-but-unmirrored key is NOT absorbed by
 * the runtime-only half. It reddens until someone files it, which is the property
 * that makes the new category a ratchet rather than a waiver: objectui#6152's
 * reclassification bought `UnmirroredDeclared` a smaller number, not a hole.
 */
export type assertionSplitLedgerRejectsFreshCallback =
  Expect< Equal< ReconcileAgainstSplitLedger< 'p', 'a' | 'onX' | 'onY', 'a', 'onX' >, 'p' > >;

/**
 * ⬇ SHRINK — a runtime-only key that has since LEFT the measurement (mirrored, or
 * the declaration removed) fails as STALE and names its own pair. Same shrink
 * discipline `UnmirroredDeclared` carries; a reclassified fact does not stop being
 * watched.
 */
export type assertionSplitLedgerRejectsStaleRuntimeOnly =
  Expect< Equal< ReconcileAgainstSplitLedger< 'p', 'a', 'a', 'onX' >, 'p' > >;

/**
 * ⚠️ The LIMIT of this reconciliation, pinned rather than left to be discovered:
 * it is BLIND to which half a key sits in. Moving a key between the ledgers changes
 * nothing here — so the union alone cannot keep the classification honest, and
 * without the shape pins below the new category would be a bucket anything could be
 * moved into. `assertionNoCallbackShapedKeyInUnmirroredDeclared` and
 * `assertionRuntimeOnlyIsCallbackShapedOnly` are what actually hold the split.
 */
export type assertionSplitLedgerIsBlindToWhichHalf =
  Expect< Equal< ReconcileAgainstSplitLedger< 'p', 'onX', never, 'onX' >, never > >;

/* ── Recognition: the WIDER direction fires, and the other two stay blind ───── */

/**
 * A synthetic pair whose mirror accepts `string` where the declaration states two
 * literals, and whose other key agrees on both faces.
 *
 * The three assertions under it are the whole argument of objectui#7069 reduced to
 * one pair: the new operator REPORTS the widening, and both operators that stood
 * before it are silent on the same pair — not because the drift is small, but
 * because neither comparison is capable of expressing it.
 */
type SyntheticWiderMirror = { shape: { size: z.ZodString; count: z.ZodNumber } };
interface SyntheticNarrowerDeclaration { size: 'sm' | 'lg'; count: number }

/** The widening is reported: the measurement can fire at all. */
export type assertionWiderOperatorReportsAWidening =
  Expect< Equal< WiderThanDeclaredKeys< SyntheticWiderMirror, SyntheticNarrowerDeclaration >, 'size' > >;

/** The forward operator is blind to it — the declared type still fits through the mirror. */
export type assertionNarrowerOperatorIsBlindToAWidening =
  Expect< Equal< NarrowerThanDeclared< SyntheticWiderMirror, SyntheticNarrowerDeclaration >, never > >;

/** So is the unmirrored half — a wider key IS mirrored, so it never leaves the comparison. */
export type assertionUnmirroredOperatorIsBlindToAWidening =
  Expect< Equal< UnmirroredDeclaredKeys< SyntheticWiderMirror, SyntheticNarrowerDeclaration >, never > >;

/**
 * The unconstrained face is EXCLUDED — at the top level and one array deep — while
 * a concrete widening on the SAME pair is still reported.
 *
 * Both halves matter. Without the first, every schema-node slot reports the
 * `z.ZodType< any >` annotation as a finding; without the second, the exclusion is
 * a waiver that silences the pair.
 */
type SyntheticUnconstrainedMirror = {
  shape: { node: z.ZodUnknown; nodes: z.ZodArray< z.ZodUnknown >; size: z.ZodString };
};
interface SyntheticNodeDeclaration { node: { type: string }; nodes: { type: string }[]; size: 'sm' | 'lg' }

export type assertionUnconstrainedFaceIsExcludedButNotAWaiver =
  Expect< Equal< WiderThanDeclaredKeys< SyntheticUnconstrainedMirror, SyntheticNodeDeclaration >, 'size' > >;

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
  'complex.zod.ts#CalendarEventSchema': CalendarEventSchema,
  'complex.zod.ts#CalendarViewSchema': CalendarViewSchema,
  'complex.zod.ts#CarouselItemSchema': CarouselItemSchema,
  'complex.zod.ts#CarouselSchema': CarouselSchema,
  'complex.zod.ts#ChatbotSchema': ChatbotSchema,
  'complex.zod.ts#ChatbotEnhancedSchema': ChatbotEnhancedSchema,
  'complex.zod.ts#ChatbotFloatingSchema': ChatbotFloatingSchema,
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
  'complex.zod.ts#DeclarativeKanbanCardSchema': DeclarativeKanbanCardSchema,
  'complex.zod.ts#DeclarativeKanbanColumnSchema': DeclarativeKanbanColumnSchema,
  'complex.zod.ts#DeclarativeKanbanSchema': DeclarativeKanbanSchema,
  'crud.zod.ts#ActionCallbackSchema': ActionCallbackSchema,
  'crud.zod.ts#CRUDDialogSchema': CRUDDialogSchema,
  'crud.zod.ts#DetailSchema': DetailSchema,
  'data-display.zod.ts#AlertSchema': AlertSchema,
  'data-display.zod.ts#AvatarSchema': AvatarSchema,
  'data-display.zod.ts#BadgeSchema': BadgeSchema,
  'data-display.zod.ts#ChartDataSeriesSchema': ChartDataSeriesSchema,
  'data-display.zod.ts#ChartSchema': ChartSchema,
  'data-display.zod.ts#DataTableSchema': DataTableSchema,
  'data-display.zod.ts#DrillDownConfigSchema': DrillDownConfigSchema,
  'data-display.zod.ts#HtmlSchema': HtmlSchema,
  'data-display.zod.ts#KbdSchema': KbdSchema,
  'data-display.zod.ts#BarChartSchema': BarChartSchema,
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
  'form.zod.ts#CodeEditorSchema': CodeEditorSchema,
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
  'layout.zod.ts#BoxSchema': BoxSchema,
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
  'objectql.zod.ts#ObjectDataTableSchema': ObjectDataTableSchema,
  'objectql.zod.ts#ObjectFormSchema': ObjectFormSchema,
  'objectql.zod.ts#ObjectGallerySchema': ObjectGallerySchema,
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
  'complex.zod.ts#CalendarEventSchema': Ts_CalendarEvent;
  'complex.zod.ts#CalendarViewSchema': Ts_CalendarViewSchema;
  'complex.zod.ts#CarouselItemSchema': Ts_CarouselItem;
  'complex.zod.ts#CarouselSchema': Ts_CarouselSchema;
  'complex.zod.ts#ChatbotSchema': Ts_ChatbotSchema;
  'complex.zod.ts#ChatbotEnhancedSchema': Ts_ChatbotEnhancedSchema;
  'complex.zod.ts#ChatbotFloatingSchema': Ts_ChatbotFloatingSchema;
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
  'complex.zod.ts#DeclarativeKanbanCardSchema': Ts_KanbanCard;
  'complex.zod.ts#DeclarativeKanbanColumnSchema': Ts_KanbanColumn;
  'complex.zod.ts#DeclarativeKanbanSchema': Ts_KanbanSchema;
  'crud.zod.ts#ActionCallbackSchema': Ts_ActionCallback;
  'crud.zod.ts#CRUDDialogSchema': Ts_CRUDDialogSchema;
  'crud.zod.ts#DetailSchema': Ts_DetailSchema;
  'data-display.zod.ts#AlertSchema': Ts_AlertSchema;
  'data-display.zod.ts#AvatarSchema': Ts_AvatarSchema;
  'data-display.zod.ts#BadgeSchema': Ts_BadgeSchema;
  'data-display.zod.ts#ChartDataSeriesSchema': Ts_ChartDataSeries;
  'data-display.zod.ts#ChartSchema': Ts_ChartSchema;
  'data-display.zod.ts#DataTableSchema': Ts_DataTableSchema;
  'data-display.zod.ts#DrillDownConfigSchema': Ts_DrillDownConfig;
  'data-display.zod.ts#HtmlSchema': Ts_HtmlSchema;
  'data-display.zod.ts#KbdSchema': Ts_KbdSchema;
  'data-display.zod.ts#BarChartSchema': Ts_BarChartSchema;
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
  'form.zod.ts#CodeEditorSchema': Ts_CodeEditorSchema;
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
  'layout.zod.ts#BoxSchema': Ts_BoxSchema;
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
  'objectql.zod.ts#ObjectDataTableSchema': Ts_ObjectDataTableSchema;
  'objectql.zod.ts#ObjectFormSchema': Ts_ObjectFormSchema;
  'objectql.zod.ts#ObjectGallerySchema': Ts_ObjectGallerySchema;
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

export type MirrorKey = keyof typeof MIRRORS;

/** The two halves of the registry must describe the same population. */
export type assertionRegistryHalvesAgree = Expect< Equal< MirrorKey, keyof Declared > >;

/** The TYPE drift on one registered pair: mirrored, but the mirror refuses the declared type. */
export type DriftOf< K extends MirrorKey > = NarrowerThanDeclared< (typeof MIRRORS)[K], Declared[K] >;

/** The other half: declared on the TS side, absent from the mirror's `.shape` entirely. */
export type UnmirroredOf< K extends MirrorKey > = UnmirroredDeclaredKeys< (typeof MIRRORS)[K], Declared[K] >;

/** The third direction: mirrored, and the mirror ACCEPTS more than the declaration admits. */
export type WiderOf< K extends MirrorKey > = WiderThanDeclaredKeys< (typeof MIRRORS)[K], Declared[K] >;

/** What one registered pair's mirror ACCEPTS for one key — the static INPUT face. */
export type MirrorInputOf< K extends MirrorKey, P extends MirroredKeys< (typeof MIRRORS)[K] > > =
  InputOf< ShapeOf< (typeof MIRRORS)[K] >[P] >;

/** What the DECLARATION admits for the same key, for the side-by-side comparison. */
export type DeclaredTypeOf< K extends MirrorKey, P extends keyof Declared[K] > = Declared[K][P];

/* ── The measured drift ledger ──────────────────────────────────────────────── */

/**
 * Exact drifted key set per pair, measured against `origin/main`. Pinned exactly:
 * new drift on a listed mirror fails, and so does a listed key that has been fixed.
 */
interface KnownDrift {
  /**
   * SPEC-DERIVED, not a mirroring debt, and NOT closable by editing this entry.
   *
   * Measured on `@objectstack/spec@17.2.0` by resolving `AppSchema.shape`: the
   * spec's `AppSchema` declares `hidden` (`z.boolean().optional()` -- accepts a
   * boolean, refuses a string) and declares NEITHER `visible` NOR `disabled`.
   * `AppComponentSchema` is `BaseSchema.extend(SpecAppFields.shape).extend(...)`
   * and `SpecAppFields` excludes six keys -- `name`, `label`, `description`,
   * `navigation`, `areas`, `contextSelectors` -- with `hidden` not among them,
   * so on the MIRROR face the spec's boolean lands after the base's and
   * overrides it. On the DECLARED face `interface AppComponentSchema extends
   * BaseSchema` does not restate the key at all, so it inherits the base.
   *
   * That is why widening `BaseSchema.hidden` to `boolean | string`
   * (objectui#7455, ruled 2026-09-03) moved only the TS side of THIS pair and
   * seeded this entry, while the same widening on `visible` (objectui#4581) and
   * `disabled` (objectui#4580 ruling Q3-A) moved both sides and seeded nothing.
   * The asymmetry is the spec's, one layer under the one #7455 removed.
   *
   * The two keys collide in NAME and differ in MEANING -- the spec's is an
   * app-catalogue flag (does the app show in the switcher), the base's is the
   * renderer's hide predicate -- so this is a contract ruling, not a repair.
   * objectui#7542 carries it, with the directions measured and none chosen.
   * The one direction that reads easy and is probably wrong: dropping `hidden`
   * from `SpecAppFields` would make a spec-DERIVED schema accept, by local
   * divergence, a value the spec refuses.
   */
  'app.zod.ts#AppComponentSchema': 'hidden';
  /**
   * RUNTIME SLOT (objectui#6124): `calendar-view`'s `pickHostCallbacks` reads
   * `onViewChange` off the spread props (function values only) and hands it to
   * `CalendarView`. `onEventClick` joined with objectui#7344 — the same channel;
   * its mirror was a multi-line `z.function()` that PR #7339's census missed.
   */
  'complex.zod.ts#CalendarViewSchema': 'onEventClick' | 'onViewChange';
  /**
   * `body` — TS declares `SchemaNode | SchemaNode[]` (a rendered slot); the mirror
   * declares `Record<string, unknown>` ("additional API body params"). Two different
   * meanings of one key — a naming collision to rule on, not a widening.
   *
   * `onError` / `onSend` — RUNTIME SLOT (objectui#6124): `plugin-chatbot` forwards both off
   * `schema.*` into `useObjectChat`, so the TS side keeps the callables; the mirror
   * refuses them by name (`handlerKeyRefusal`). See the class note above `ButtonSchema`.
   */
  'complex.zod.ts#ChatbotSchema': 'body' | 'onError' | 'onSend';
  /**
   * RUNTIME SLOT (objectui#6124) — pairs born ledgered by objectui#7655, which gave
   * the `chatbot-enhanced` and `chatbot-floating` registrations their own faces.
   * Each face keeps the callables its registration forwards off `schema.*` —
   * `onError` and `onSend` into `useObjectChat`, `onClear` from `handleClear` —
   * and the mirror refuses all three by name (`handlerKeyRefusal`). No `body`
   * here: these twins mirror the key the renderer reads, `requestBody`, and
   * inherit `body` as the children slot, so `ChatbotSchema`'s naming collision
   * was deliberately not copied across.
   */
  'complex.zod.ts#ChatbotEnhancedSchema': 'onClear' | 'onError' | 'onSend';
  /** The same three slots on the same channel — see `ChatbotEnhancedSchema` above. */
  'complex.zod.ts#ChatbotFloatingSchema': 'onClear' | 'onError' | 'onSend';
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
  /**
   * `fields` — inherited from `FilterFieldSchema.operators` below; the element type is
   * the drifted one. `onChange` — RUNTIME SLOT (objectui#6124): the `filter-builder` renderer
   * calls it as `props.onChange` after `SchemaRenderer`'s spread.
   */
  'complex.zod.ts#FilterBuilderSchema': 'fields' | 'onChange';
  /** DISJOINT vocabularies: TS declares `is_empty`/`is_not_empty`, the mirror declares `is_null`/`is_not_null`. One of the two is dead; which one is a ruling. */
  'complex.zod.ts#FilterFieldSchema': 'operators';
  /** RUNTIME SLOT (objectui#6124) ×2: `plugin-kanban` forwards `onCardMove` / `onCardClick` off `schema.*` into the board. (`onColumnAdd` / `onCardAdd` are NOT here: nothing reads them, so both faces retire them — `?: never` meets the refusal arm and the pair does not drift on those keys.) */
  'complex.zod.ts#DeclarativeKanbanSchema': 'onCardMove' | 'onCardClick';
  /**
   * RUNTIME SLOT (objectui#7344): `register('detail', DetailView)` — `DetailView`'s
   * `handleBack` calls `onBack()` when set. The mirror was `z.any()` (wider than
   * the declared callable, objectui#7069's direction); it now refuses by name.
   */
  'crud.zod.ts#DetailSchema': 'onBack';
  /**
   * `rowActions` was the FIFTH key here until objectui#6940 settled the ruling
   * this entry was explicitly waiting on. It read: DISJOINT — TS declares
   * `rowActions?: boolean` (show the column or not), the mirror declared
   * `any[]` (the actions themselves); one of the two is dead, which is a
   * ruling. The maintainer ruled the TS side live (2026-09-02, director seat
   * summon #8, option A): the renderer only truthiness-tests the key, so the
   * `any[]` face was the dead one, and the mirror became
   * `z.boolean().optional()`. The pair is now IN PARITY on that key, so it left
   * this entry — this ledger fails on a repair exactly as it fails on new
   * drift, which is why correcting this line was part of that change and not
   * optional. (`selectable` was likewise a drifted key here until objectui#5927
   * widened the mirror to `boolean | 'single' | 'multiple'` —
   * `resolveSelectionMode` in `renderers/complex/data-table.tsx` implements
   * `'single'` as a real mode.)
   *
   * The four callbacks — RUNTIME SLOT (objectui#6124) ×4: `renderers/complex/data-table.tsx`
   * CALLS every one of them off `schema.*` (`schema.onRowEdit?.(r)`,
   * `schema.onSelectionChange(selectedData)`, …), so the TS side keeps them callable
   * and the mirror refuses them by name.
   */
  'data-display.zod.ts#DataTableSchema': 'onRowEdit' | 'onRowDelete' | 'onSelectionChange' | 'onColumnsReorder';
  /** RUNTIME SLOT (objectui#6124): the `accordion` renderer spreads leftover props onto the Radix `Accordion` root, where `onValueChange` is a real prop. */
  'disclosure.zod.ts#AccordionSchema': 'onValueChange';
  /** RUNTIME SLOT (objectui#6124): the `collapsible` renderer spreads leftover props onto the Radix `Collapsible` root. */
  'disclosure.zod.ts#CollapsibleSchema': 'onOpenChange';
  /** RUNTIME SLOT (objectui#6124): the `toggle-group` renderer spreads `toggleGroupProps` onto the Radix `ToggleGroup` root. */
  'disclosure.zod.ts#ToggleGroupSchema': 'onValueChange';
  /**
   * ## The objectui#6124 class — a RUNTIME SLOT on the TS face, a NAMED REFUSAL on the mirror
   *
   * Maintainer ruling 2026-08-30 (batch #8, Q2 → A with C): the 58 `on*` keys the
   * mirrors declared as `z.function()` — a type NO JSON document can satisfy — keep
   * their declaration and REFUSE BY NAME (`handlerKeyRefusal()` in
   * `../zod/tombstone.zod.ts`, the #5099 `z.custom` + guidance shape), because under
   * `BaseSchema.passthrough()` deleting a key is a SILENT accept that keeps the value
   * and forwards it to the DOM. The mirror's `z.input` for such a key is therefore
   * `undefined` — a JSON author cannot write it — while the TypeScript twin of a key
   * whose function value REACHES a renderer stays callable, because that is the
   * programmatic channel (`SchemaRenderer` spreads every non-metadata schema key as a
   * React prop; renderers read `schema.onX`, call `props.onX`, or spread leftovers onto
   * a Radix root / DOM listener slot). Two faces of one key, both true, measured per
   * key — a DELIBERATE divergence like `PageNodeSchema.pageType`, not debt to widen
   * away. ⛔ Do not "fix" one of these by making the mirror accept a function again
   * (that re-opens the JSON lie) or by deleting the TS member (that breaks the shipped
   * renderer that reads it).
   *
   * The 22 keys NOTHING reads are not in this ledger at all: their TS twin is a
   * `?: never` tombstone, so `undefined` meets `undefined` and the pair does not drift
   * on them. Every one of the 58 is pinned member-by-member, both faces, in
   * `handler-keys-json-refusal-6124.test.ts`; this ledger records the 35 that drift.
   *
   * `ButtonSchema.onClick` — RUNTIME SLOT (objectui#6124): `toFormControlDomProps` forwards it
   * to the DOM `<button>` (`onClick` is on `SDUI_DOM_PASS_THROUGH_KEYS`).
   */
  'form.zod.ts#ButtonSchema': 'onClick';
  /** DISJOINT: TS `Date | Date[]`, mirror `string | Date`. The mirror refuses `Date[]`; the TS side refuses the ISO string the mirror accepts. (`onChange` is NOT here: the `calendar` renderer spreads it onto `DayPicker`, whose callback is `onSelect`, so nothing reads it — both faces retire it.) */
  'form.zod.ts#CalendarSchema': 'defaultValue' | 'value';
  /** RUNTIME SLOT (objectui#6124): the `checkbox` renderer calls `props.onChange(checked)` after `SchemaRenderer`'s spread. */
  'form.zod.ts#CheckboxSchema': 'onChange';
  /** RUNTIME SLOT (objectui#6124): `plugin-editor` reads `onChange ?? schema.onChange`. */
  'form.zod.ts#CodeEditorSchema': 'onChange';
  /** OPTIONALITY: TS declares `options?`, the mirror REQUIRES it. Whether authoring a combobox without options is legal is a ruling. */
  'form.zod.ts#ComboboxSchema': 'options';
  /** OPTIONALITY: TS declares `groups?`, the mirror REQUIRES it. (`onChange` is NOT here: the `command` renderer spreads it onto cmdk's root `div`, where React fires it with a SyntheticEvent — a different contract from the declared `(value: string) => void`, so both faces retire it.) */
  'form.zod.ts#CommandSchema': 'groups';
  /** RUNTIME SLOT (objectui#6124): the `date-picker` renderer calls `props.onChange(date)` after `SchemaRenderer`'s spread. */
  'form.zod.ts#DatePickerSchema': 'onChange';
  /** RUNTIME SLOT (objectui#6124): the `file-upload` renderer calls `props.onChange(files)` after `SchemaRenderer`'s spread. */
  'form.zod.ts#FileUploadSchema': 'onChange';
  /**
   * `mode` — DISJOINT: TS `disabled|read|edit`, mirror `create|edit|view`. `fields` is
   * inherited element drift. (`validationMode` was a third drifted key until
   * objectui#5927 widened it to react-hook-form's full `mode` vocabulary —
   * `useForm({ mode })` in `renderers/form/form.tsx` forwards it verbatim and RHF
   * implements `onTouched`/`all` as real branches.)
   *
   * `onSubmit` / `onChange` / `onCancel` — RUNTIME SLOT (objectui#6124) ×3: `renderers/form/form.tsx`
   * destructures all three off `schema` and calls them (`await onSubmitProp(formData)`,
   * the objectui#4259 `onChangeProp` subscription, `onCancelProp()`).
   */
  'form.zod.ts#FormSchema': 'fields' | 'mode' | 'onSubmit' | 'onChange' | 'onCancel';
  /** RUNTIME SLOT (objectui#6124): the `input-otp` renderer calls `props.onChange(val)` after `SchemaRenderer`'s spread. (`onComplete` is NOT here: the `toFormControlDomProps` whitelist drops it — both faces retire it.) */
  'form.zod.ts#InputOTPSchema': 'onChange';
  /** RUNTIME SLOT (objectui#6124): the `input` renderer calls `props.onChange(e.target.value)` after `SchemaRenderer`'s spread. */
  'form.zod.ts#InputSchema': 'onChange';
  /** RUNTIME SLOT (objectui#6124): the `select` renderer calls `props.onChange(matchOptionValue(…))` after `SchemaRenderer`'s spread. (This pair LEFT the ledger with objectui#5927's widenings and re-enters on a different key for a different reason.) */
  'form.zod.ts#SelectSchema': 'onChange';
  /** RUNTIME SLOT (objectui#6124): the `textarea` renderer calls `props.onChange(e.target.value)` after `SchemaRenderer`'s spread. */
  'form.zod.ts#TextareaSchema': 'onChange';
  /** RUNTIME SLOT (objectui#6124): the `card` renderer spreads `cardProps` onto the `<Card>` element (a DOM `onClick`) and reads it for `isClickable`. */
  'layout.zod.ts#CardSchema': 'onClick';
  /** `pageType` is a DELIBERATE divergence, documented at `PageVisualizationAlias` (`../layout.ts`): the TS side retains five visualization names as a sanctioned local extension while the mirror takes the spec's vocabulary by reference, which repudiates them. Widening the mirror would re-add spellings the spec rejects. */
  'layout.zod.ts#PageNodeSchema': 'slots' | 'pageType';
  /** RUNTIME SLOT (objectui#6124): the `tabs` renderer spreads `tabsProps` onto the Radix `Tabs` root AFTER its own `onValueChange`, so the authored function wins. */
  'layout.zod.ts#TabsSchema': 'onValueChange';
  /** DISJOINT: TS declares `floating`, the mirror declares `transparent`. One of the two renders nothing. */
  'navigation.zod.ts#HeaderBarSchema': 'variant';
  /** RUNTIME SLOT (objectui#6124): the `pagination` renderer calls `props.onPageChange(page)` after `SchemaRenderer`'s spread. */
  'navigation.zod.ts#PaginationSchema': 'onPageChange';
  /**
   * RUNTIME SLOT (objectui#6124 shape, minted by objectui#6576 / #6914): the pair
   * was born with this entry. `ObjectDataTable.tsx` forwards `schema.onRowClick`
   * into the `data-table` it renders (it used to read it through an
   * `(schema as any)` cast — #6914's drift), so the TS side keeps the callable
   * and the mirror refuses it by name. The FIRST handler arm on an `objectql`
   * mirror: the POLICY-group entries in `RuntimeOnlyDeclared` below record the
   * pre-#6124 state of that file, not a rule for new mirrors.
   */
  'objectql.zod.ts#ObjectDataTableSchema': 'onRowClick';
  /**
   * RUNTIME SLOT (objectui#6124): the `alert-dialog` renderer spreads leftover props
   * onto the Radix `AlertDialog` root (`onOpenChange`). `onAction` joined with
   * objectui#7104, which DECLARED a key the renderer had been reading undeclared:
   * it is the action button's `onClick`, so the TS face keeps the callable and the
   * mirror refuses it by name. (`onConfirm` / `onCancel` are NOT here: the footer is
   * wired to `schema.onAction` and `AlertDialogCancel`, so nothing reads them — both
   * faces retire them.)
   */
  'overlay.zod.ts#AlertDialogSchema': 'onOpenChange' | 'onAction';
  /** RUNTIME SLOT (objectui#6124): the `dialog` renderer spreads leftover props onto the Radix `Dialog` root. */
  'overlay.zod.ts#DialogSchema': 'onOpenChange';
  /** RUNTIME SLOT (objectui#6124): the `drawer` renderer spreads leftover props onto the vaul `Drawer` root. */
  'overlay.zod.ts#DrawerSchema': 'onOpenChange';
  /** RUNTIME SLOT (objectui#6124): the `dropdown-menu` renderer spreads leftover props onto the Radix `DropdownMenu` root. (`MenuItemSchema.onClick`, the 36th runtime slot, is not a pair here — that mirror is a lazy union and sits in `EXCLUSIONS`.) */
  'overlay.zod.ts#DropdownMenuSchema': 'onOpenChange';
  /** RUNTIME SLOT (objectui#6124): the `hover-card` renderer spreads leftover props onto the Radix `HoverCard` root. */
  'overlay.zod.ts#HoverCardSchema': 'onOpenChange';
  /** RUNTIME SLOT (objectui#6124): the `popover` renderer spreads leftover props onto the Radix `Popover` root. */
  'overlay.zod.ts#PopoverSchema': 'onOpenChange';
  /** RUNTIME SLOT (objectui#6124): the `sheet` renderer spreads leftover props onto the Radix `Sheet` (Dialog) root. */
  'overlay.zod.ts#SheetSchema': 'onOpenChange';
  /**
   * RUNTIME SLOT (objectui#7344): `detail-view` spreads the node's keys onto
   * `DetailView`, whose `handleBack` calls `onBack()`. The TS twin declared the
   * handler-expression STRING (objectui#6182: not an authoring form) and now
   * declares the callable the renderer invokes; the mirror refuses by name.
   */
  'views.zod.ts#DetailViewSchema': 'onBack';
}

/* ── The measured unmirrored-declared ledger (objectui#6058) ────────────────── */

/**
 * Exact DECLARED-BUT-UNMIRRORED key set per pair: keys the published TypeScript
 * invites an author to write and the published validator has never heard of.
 *
 * ## ⚠️ READ THIS BEFORE QUOTING THE NUMBER — 121 became 98 by RECLASSIFICATION,
 * ## then 97 by the first REPAIR, then 96 by RETIREMENT, then 94 by REPAIR again
 *
 * objectui#6058 seeded this ledger at **121 keys**. It records **94**, and the
 * movements are different facts. objectui#6152 measured the 23 callback-shaped
 * (`on*`) keys and ruled that mirroring is the wrong remedy for every one of them;
 * they moved, intact and still pinned, to `RuntimeOnlyDeclared` below — ⛔ nothing
 * was mirrored, no declaration was removed, nothing was waived by that move. Then
 * objectui#6639 MIRRORED `ObjectGridSchema.title` (census-directed maintainer
 * ruling 2026-08-29, declare branch) — one defect actually repaired, the ledger's
 * first shrink by repair. Then objectui#7129 and objectui#7623 each RETIRED a key by
 * deleting the DECLARATION (`DetailViewSectionSchema.hideEmpty`;
 * `DashboardComponentSchema.title`) — shrinks by removal, which is neither a repair
 * of the mirror nor a waiver: the key stops being offered to authors at all. Then
 * objectui#7352 MIRRORED the two `drillDown` keys (`ChartSchema`,
 * `ObjectDataTableSchema`) by minting the `DrillDownConfigSchema` both entries named
 * as their remedy — the second and third repairs, and the first to close two entries
 * in one change.
 *
 * So: **94 is the mirroring debt; 94 − 1 seeded + 3 mirrored + 2 retired + 23
 * reclassified is what "121" used to mean** (the seed is objectui#6576's
 * `ObjectDataTableSchema.drillDown`, which was never part of the 121 — and which
 * objectui#7352 has since repaired). A card that
 * cites 121 as the size of the mirroring problem, or 98/97/96/94 as a shrink from it,
 * is wrong in both directions. objectui#6141 is the
 * standing example of what a silently moved count costs — it is why this paragraph
 * is in the ledger rather than in a commit message.
 *
 * ## ⛔ SHRINK-ONLY, and why a seed is a FLOOR rather than a waiver
 *
 * The obvious misreading is that seeding a ledger at 121 facts waives 121 defects.
 * It is the opposite, and the reason is that **before this ledger the guard saw
 * ZERO of them**. `NarrowerThanDeclared` maps over the INTERSECTION
 * `MirroredKeys< M > & keyof D`, so a declared key the mirror never mentions did
 * not compare unequal — it LEFT THE COMPARISON. Nothing that was previously caught
 * is being let through, because there was no such thing. Seeding takes the count of
 * VISIBLE, RATCHETED facts from 0 to 121 and installs a floor: the problem cannot
 * grow while they are worked off, and a new declared-but-unmirrored key on any of
 * the 157 pairs reddens immediately (`assertionRatchetRejectsFreshDrift`) —
 * including a callback-shaped one, which reddens until it is filed in
 * `RuntimeOnlyDeclared` (`assertionSplitLedgerRejectsFreshCallback`).
 *
 * Same instrument and same discipline as objectui#6133's `KNOWN_HAND_TYPED_GUARDS`,
 * which is the landed precedent for this shape in this repo: seed at the measured
 * debt, fail on growth, fail on staleness, never offer a route that raises a line.
 *
 * ## What each entry is, and where the remedy lives
 *
 * ⚠️ The remedy is NOT uniformly "mirror the key" — objectui#6058's ruling is
 * explicit that forcing the 121 per-key decisions now would be wrong. Two splits
 * are recorded here so whoever works them off does not re-derive them:
 *
 *   - **SPEC-DERIVED (2 entries, 12 keys)** — `DashboardWidgetSchema`,
 *     `ObjectViewSchema`. It was 3 / 13 until objectui#7623 RETIRED
 *     `DashboardComponentSchema.title` by deleting the DECLARATION — the
 *     objectui#7129 route, reaching this half for the first time. That key was never
 *     going to be answered by #2231 unification: the spec's strict `DashboardSchema`
 *     refuses a root `title` outright, and objectui#7509 had already retired every
 *     read of it, so the local declaration was offering a member the spec models
 *     nowhere and no renderer consumed. ⚠️ objectui#6705 invalidated the
 *     evidence for ONE of the two that remain: `ObjectViewSchema` is no longer in
 *     `SPEC_DERIVED_PAIRS` below, because it never referenced a spec schema — it is
 *     `BaseSchema.extend({…})` of local literals, and the pre-#6705 text scanner
 *     charged it a neighbouring private const's `Spec…` token. That misclassification
 *     is left STANDING as #6705 found it — neither the entry's classification nor its
 *     key count moved for it: re-routing those keys from #2231's
 *     unification question to a local mirror edit is a remedy decision on the
 *     `UnmirroredDeclared` ledger, which #6705 was fenced out of. Whoever works
 *     this split off must re-derive `ObjectViewSchema`'s side first.
 *     For `DashboardWidgetSchema` the reading is unchanged:
 *     its mirror takes its shape BY REFERENCE from `@objectstack/spec`. An
 *     unmirrored declared key there means the LOCAL declaration carries members the
 *     spec schema does not model, which is objectui#2231's unification question and
 *     NOT a local mirror edit. They are marked, not exempted: exempting them in the
 *     instrument would re-blind exactly the pairs objectui#5927 leaned on hardest.
 *   - **LOCAL (12 entries, 84 keys)** — plain omissions from a hand-written mirror.
 *     It was 13 / 84 until objectui#7129 RETIRED `DetailViewSectionSchema.hideEmpty`,
 *     a shrink by removing the DECLARATION rather than by mirroring it, 12 / 83
 *     until objectui#7352 MIRRORED `ChartSchema.drillDown` — its whole entry — and
 *     11 / 82 until objectui#7655 SEEDED a `ChatbotFloatingSchema` entry with the two
 *     keys that face declares alongside `ChatbotSchema` — an entry and two keys
 *     gained; `ChatbotSchema`'s own entry did not move.
 *
 * ⚠️ Both counts moved with the reclassification: the spec-derived side lost
 * `ObjectViewSchema.onNavigate` (14 → 13) and the local side lost the other 22
 * (107 → 85; 84 since objectui#6639 mirrored `ObjectGridSchema.title`, 83 since
 * objectui#7129 retired one). The pair COUNTS did not move under the
 * reclassification — every affected pair kept keys here — so the split read 16
 * entries / 97 keys after it. Three later changes moved the entry count itself:
 * objectui#6576 SEEDED `ObjectDataTableSchema` (a 17th entry, in neither half
 * above), objectui#7129 RETIRED an entry from the LOCAL half, objectui#7623
 * RETIRED one from the SPEC-DERIVED half (13 → 12 keys there), objectui#7352
 * MIRRORED two — the LOCAL `ChartSchema` entry and the seeded `ObjectDataTableSchema`
 * one — and objectui#7655 SEEDED the LOCAL `ChatbotFloatingSchema` entry, born with
 * two keys. The ledger now totals **14 entries / 96 keys** — 2 / 12 spec-derived,
 * 12 / 84 local; the seeded pair is no longer among them.
 *
 * ## How this was measured, and the trap that makes the number hard to get
 *
 * ⚠️ **Do not read the offending set off the compile error.** objectui#6058 lost a
 * pass to this. The behaviour is not "TypeScript truncates", it is that the two
 * spellings of the same assertion print DIFFERENTLY, and the worse one gives no
 * sign that it is incomplete. Both measured:
 *
 *   - through a NAMED alias — the spelling `assertionDriftMatchesLedger` uses via
 *     `LedgerMismatch` — TS prints the ALIAS NAME and elaborates with exactly ONE
 *     member: `Type 'LedgerMismatch' is not assignable to type 'never'. Type
 *     '"complex.zod.ts#ChatbotSchema"' is not assignable to type 'never'.` There is
 *     no ellipsis, so 23 offending pairs read as one. `--noErrorTruncation` does NOT
 *     expand it, and neither a distributive conditional nor a template-literal
 *     wrapper forces expansion — both re-associate to the alias.
 *   - written INLINE, as `assertionUnmirroredMatchesLedger` below is, TS resolves the
 *     union and prints it WITH a truncation marker: ten neutralised entries printed
 *     five names, `... 4 more ...`, and the last. Honest about being partial.
 *
 * That is the whole reason the new assertion is spelled inline. It is still only a
 * pointer: the authoritative read is the compiler API — build a Program over
 * `tsconfig.test.json`, declare one binding per pair, and walk each type's union
 * members reading `isStringLiteral().value`, bypassing type printing entirely. Its
 * non-vacuity control on the seeding run: it read all 158 pairs and returned an
 * EMPTY set for 142 of them, so it is discriminating rather than uniformly silent.
 */
interface UnmirroredDeclared {
  /**
   * LOCAL. `body` sits in `KnownDrift` above for an unrelated reason (a naming
   * collision on a key both sides declare); these three the mirror has simply never
   * heard of.
   */
  'complex.zod.ts#ChatbotSchema': 'displayMode' | 'floatingConfig' | 'requestBody';
  /**
   * LOCAL — a pair born ledgered (objectui#7655) with the two keys the floating
   * face declares alongside `ChatbotSchema`, in the same state the entry above
   * records them. `floatingConfig` has no `FloatingChatbotConfig` mirror at all —
   * minting one is objectui#6152's axis, and the `triggerIcon` tombstone's tripwire
   * (objectui#7654, `floating-chatbot-trigger-icon-retired.test.ts`) watches for
   * it. `displayMode` is RULED RETIRED (objectui#7654, maintainer ruling B,
   * 2026-09-05) and the retirement executes in that card's own PR: the TypeScript
   * half is the `?: never` tombstone, and the mirror half (`retirementTombstone()`)
   * is owed when objectui#6152 mints the arm — until then the key stays unmirrored
   * here and on `ChatbotSchema` alike, and what that PR does to these two entries
   * is its own to record. ⛔ Not a waiver: every OTHER key this pair declares is
   * mirrored, and a third key here reddens the pair like growth on any other entry.
   */
  'complex.zod.ts#ChatbotFloatingSchema': 'displayMode' | 'floatingConfig';
  // `complex.zod.ts#DashboardComponentSchema` recorded `title` here (SPEC-DERIVED)
  // until objectui#7623 RETIRED the declaration — the objectui#7129 route, not a
  // mirror edit: the spec's strict `DashboardSchema` refuses a root `title` outright,
  // and objectui#7509 had already retired every read of it. The pair keeps its
  // `KnownDrift` entry above (three TYPE-drifted keys) and records nothing here.
  /**
   * SPEC-DERIVED → objectui#2231. The mirror takes its shape by reference from
   * `@objectstack/spec`, so these are members the LOCAL declaration carries and the
   * spec schema does not model. Its one TYPE-drifted key is in `KnownDrift` above and
   * routes the same way.
   */
  'complex.zod.ts#DashboardWidgetSchema': 'pagination' | 'searchable';
  // `data-display.zod.ts#ChartSchema` recorded `drillDown` here (LOCAL) from
  // objectui#6058's seeding until objectui#7352 MIRRORED it: `DrillDownConfigSchema`
  // (`data-display.zod.ts`, a registered pair of its own above) now restates
  // `DrillDownConfig` key for key, and `ChartSchema.drillDown` references it. A shrink
  // by REPAIR — the objectui#6639 route, the ledger's second and third use of it (this
  // entry and `ObjectDataTableSchema`'s below went in the same change) — not a
  // reclassification and not a retirement: the key is still declared, still authorable,
  // and is now enforced. The pair holds no entry in either unmirrored ledger.
  /**
   * LOCAL, and still the largest single entry at 17. It was 29: the twelve `on*` keys
   * are in `RuntimeOnlyDeclared` below (objectui#6152). `rowActions` is in
   * `KnownDrift` above — the mirror does declare that one, disjointly.
   */
  'data-display.zod.ts#DataTableSchema':
    | 'disableInnerScroll' | 'editable' | 'manualPagination' | 'manualSearch' | 'manualSorting'
    | 'page' | 'rowActionDefs' | 'rowClassName'
    | 'rowCount' | 'rowStyle' | 'search' | 'selectionResetKey' | 'selectionStyle'
    | 'showAddRow' | 'showSelectionCount' | 'singleClickEdit' | 'sort';
  /** LOCAL. */
  'form.zod.ts#FormFieldSchema': 'field';
  /**
   * LOCAL. `fields`/`mode` are in `KnownDrift` above (both mirrored, both drifted in
   * TYPE); these eight the mirror does not declare at all. It was nine —
   * `onDirtyChange` is in `RuntimeOnlyDeclared` below (objectui#6152).
   */
  'form.zod.ts#FormSchema':
    | 'defaultFieldTab' | 'fieldContainerClass' | 'fieldPanes' | 'fieldPanesOrientation'
    | 'fieldPanesResizable' | 'fieldTabs' | 'fieldTabsPosition' | 'mobileStickyActions';
  /**
   * LOCAL. Verified by hand against both sources while measuring: declared once in
   * `../form.ts`, zero occurrences in the mirror.
   */
  'form.zod.ts#InputSchema': 'wrapperClass';
  /** LOCAL. */
  'form.zod.ts#LabelSchema': 'content';
  /** LOCAL. */
  'navigation.zod.ts#PaginationSchema': 'currentPage';
  // `objectql.zod.ts#ObjectDataTableSchema` recorded `drillDown` here (LOCAL) as a
  // SEED — the pair was minted by objectui#6576 with its measured debt written down,
  // and the entry named its own remedy: "a paired `DrillDownConfigSchema` mirror,
  // which shrinks THIS entry and `ChartSchema`'s". objectui#7352 was that ruling and
  // did exactly that, so both rows are gone together. The pair keeps its `KnownDrift`
  // entry above (`onRowClick`, a runtime slot the mirror refuses by name) and records
  // nothing here.
  /**
   * LOCAL, and still the second-largest at 21. It was 26: the five `on*` keys are in
   * `RuntimeOnlyDeclared` below (objectui#6152). ⚠️ `submitHandler` is NOT among them
   * — the reclassification took the measured `/^on[A-Z]/` set and nothing else, so a
   * handler-shaped key with another name stays here until someone measures it.
   */
  'objectql.zod.ts#ObjectFormSchema':
    | 'allowSkip' | 'buttons' | 'defaultTab' | 'defaults' | 'drawerSide' | 'drawerWidth'
    | 'formType' | 'mobile' | 'modalCloseButton' | 'modalSize' | 'nextText' | 'open' | 'prevText'
    | 'sections' | 'showStepIndicator' | 'splitDirection' | 'splitResizable' | 'splitSize'
    | 'subforms' | 'submitHandler' | 'tabPosition';
  /**
   * LOCAL. It was 17: `onNavigate` is in `RuntimeOnlyDeclared` below (objectui#6152),
   * and `title` was MIRRORED by objectui#6639 (census-directed ruling 2026-08-29,
   * declare branch) — the ledger's first shrink by REPAIR rather than
   * reclassification.
   */
  'objectql.zod.ts#ObjectGridSchema':
    | 'aggregations' | 'bulkActionDefs' | 'bulkSpecActions' | 'conditionalFormatting'
    | 'emptyState' | 'exportOptions' | 'grouping' | 'navigation' | 'operations'
    | 'reorderableColumns' | 'resizableColumns' | 'rowColor' | 'rowHeight' | 'rowSpecActions'
    | 'singleClickEdit';
  /**
   * SPEC-DERIVED → objectui#2231. ⭐ This pair had NO entry in EITHER ledger before
   * objectui#6058 — eleven declared keys the published validator has never heard of,
   * and the guard reported the pair clean. It is the clearest single instance of the
   * blind spot this ledger exists to make visible. It was eleven: `onNavigate` is in
   * `RuntimeOnlyDeclared` below (objectui#6152), which does NOT change the routing of
   * the other ten — they are still spec-derived and still go to objectui#2231.
   */
  'objectql.zod.ts#ObjectViewSchema':
    | 'allowCreateView' | 'defaultListView' | 'defaultViewType' | 'filterableFields'
    | 'listViews' | 'navigation' | 'searchableFields' | 'showViewSwitcher'
    | 'viewActions' | 'viewTabBar';
  /** LOCAL. */
  'reports.zod.ts#ReportComponentSchema': 'chartConfig' | 'conditionalFormatting' | 'reportType';
  /**
   * LOCAL. It was 14: the three `on*` keys are in `RuntimeOnlyDeclared` below
   * (objectui#6152), where the 2026-07 audit had already ruled them.
   */
  'views.zod.ts#DetailViewSchema':
    | 'activities' | 'autoDiscoverRelated' | 'autoTabs' | 'comments' | 'defaultTab'
    | 'highlightFields' | 'history'
    | 'primaryField' | 'recordNavigation' | 'sectionGroups' | 'summaryFields';
}

/* ── The runtime-only / non-authorable ledger (objectui#6152) ─────────────── */

/**
 * Callback-shaped declared keys that are RUNTIME SLOTS rather than authorable
 * metadata: kept on the declaration, deliberately never mirrored, separately pinned.
 *
 * ## ⚠️ THIS IS WHERE 23 KEYS WENT — a RECLASSIFICATION, not a fix
 *
 * `UnmirroredDeclared` above was seeded at **121 keys** by objectui#6058. It records
 * **94** today: these 23 moved here whole, and three keys were later MIRRORED
 * (`ObjectGridSchema.title` by objectui#6639; `ChartSchema.drillDown` and
 * `ObjectDataTableSchema.drillDown` by objectui#7352) while two were RETIRED by
 * deleting the declaration (objectui#7129, objectui#7623) — the move recorded HERE
 * repaired nothing. ⛔ Nothing was
 * mirrored by it, no declaration was removed, no defect was repaired and nothing was
 * waived: the same 23 facts are still measured, still declared-but-unmirrored, still
 * reconciled against the same measurement — under a different remedy.
 *
 * **94 is the mirroring debt; 94 − 1 seeded + 3 mirrored + 2 retired + 23
 * reclassified is what "121" used to mean.** Cite it that way. objectui#6141 is the
 * standing example of what a silently moved count costs — and the pair count in the
 * file header is the second, re-derived at objectui#7352 contract review.
 *
 * ## Why mirroring is the wrong remedy for these (the objectui#6152 ruling)
 *
 * Measured on the SHIPPED `dist/*.d.ts`, all 23 are already function-only —
 * `((row: any) => void) | undefined` and the like, with no string alternative:
 *
 *   - ⛔ **Mirroring them enforces nothing.** The only available spelling is
 *     `z.function()`, which **no serialized authored document can satisfy**. It would
 *     move 23 rows off a ledger while adding validator surface no authored payload
 *     can ever populate — converting VISIBLE debt into INVISIBLE non-enforcement,
 *     which is the "declared ≠ enforced" shape this whole file exists to close.
 *   - ⛔ **Narrowing the declaration is not available.** objectui#4453's precedent
 *     narrowed a key that accepted `string | function` to `typeof === 'function'`;
 *     there is no string branch left here to remove.
 *   - ⛔ **Removing the declaration would break shipped renderers.** 21 of the 23 are
 *     read off `schema.*` in renderer source. ⭐ Measured by AST, because a plain
 *     `schema.onX` grep UNDERCOUNTS — `renderers/complex/data-table.tsx` DESTRUCTURES
 *     four of them (`const { onPageChange, … } = schema`) and a grep reads those as
 *     unread. The values reach the renderer by a third channel that is neither
 *     authored metadata nor a React prop: a sibling component SYNTHESISING a
 *     schema-shaped object in code and rendering it through `SchemaRenderer`
 *     (`ObjectGrid.tsx:2937` builds `const dataTableSchema: any`, rendered at
 *     `:3735`; `ListView`, `ObjectView`, `RelatedList`, `ObjectKanban`,
 *     `ObjectCalendar`, `ObjectGantt` and `ObjectGallery` all do the same).
 *
 * Authored anywhere: **zero of 23**, positive-controlled — a planted `"onRowClick"`
 * value in a schema-catalog fixture made the same search return exactly that line.
 *
 * ## ⚠️ The 16/7 split — these 23 did NOT all arrive the same way
 *
 * Read as "the mirrors omit callbacks by policy" this ledger would be wrong about two
 * thirds of itself. Measured across `../zod/`: **73 `on*` keys are ALREADY mirrored**
 * (56 `z.function()`, 11 `z.string()`, 3 `z.any()`, 3 named schemas).
 *
 *   - **16 were OVERSIGHTS.** `DataTableSchema`'s own mirror already declares four
 *     callbacks (`onRowEdit`, `onRowDelete`, `onSelectionChange`, `onColumnsReorder`),
 *     `FormSchema`'s three (`onSubmit`, `onChange`, `onCancel`), `DetailViewSchema`'s
 *     one (`onBack` — and in the OTHER dialect, `z.string()`). The omitted keys sit in
 *     the same object literals as the included ones.
 *   - **7 are POLICY.** `objectql.zod.ts` carries zero `on*` and zero `z.function()`
 *     in the entire file, and says so in passing at `:164`, where `successMessage` is
 *     described as what applies "when no `onSuccess` handler is given" — the mirror
 *     naming the authored alternative to a runtime callback it deliberately does not
 *     model. Those seven are `ObjectFormSchema`'s 5, `ObjectGridSchema`'s 1 and
 *     `ObjectViewSchema`'s 1.
 *
 * Reclassifying all 23 is still right — the remedy is the same for both groups — but
 * they are not the same fact, and a later reader must not infer uniform intent from
 * uniform treatment.
 *
 * ## Standing prior art, reached independently for 3 of the 23
 *
 * `docs/audits/2026-07-objectview-detailview-schema.md` ruled this before either
 * ledger existed. At `:148`, on `onNavigate`: "A function. Non-serializable; cannot
 * live in a JSON protocol." — filed under **Keep local**. At `:237-241`: `onNavigate`,
 * `onTabChange` and `onAddComment` are "live state and callbacks, not metadata", they
 * "must never enter a serializable protocol", and "their existence on a schema is
 * itself the smell: they are why this 'schema' cannot be validated, persisted, or
 * authored — it is a props bag wearing a schema's clothes". objectui#4650 is the same
 * split expressed in types: `ObjectFormPropsSchema` is "serialisable authoring keys
 * only", `ObjectFormComponentProps` is the renderer's props, "none of which can exist
 * in authored metadata".
 *
 * ⭐ And one piece of evidence that the declaration was ALREADY not trusted:
 * `DetailView.tsx:1402` reads `onTabChange` through an `(schema as any)` cast — at its
 * ONLY read site, for a key that IS declared on the type.
 *
 * ## ⛔ What this category is NOT
 *
 * Not a waiver, not a bucket. Three pins hold it to its meaning, and none of them is
 * prose: `assertionUnmirroredMatchesLedger` reconciles ONE measurement against the
 * UNION of both ledgers (`RecordedUnmirrored`), so a NEW callback-shaped unmirrored
 * key reddens until it is filed here and a recorded one that leaves the measurement
 * fails as STALE naming its own pair — both directions pinned on synthetic pairs at
 * `assertionSplitLedgerRejectsFreshCallback` and `…RejectsStaleRuntimeOnly`;
 * `assertionRuntimeOnlyIsCallbackShapedOnly` refuses a non-callback key here; and
 * `assertionNoCallbackShapedKeyInUnmirroredDeclared` refuses a callback key over
 * there. The move is one-way and shape-checked.
 *
 * ⚠️ The end state is objectui#4650's two-layer split — an authored-metadata type and
 * a renderer-props type per pair, mirroring only the authored half. This ledger is its
 * first honest step: it RECORDS what these keys are without pretending they are fixed.
 * If objectui#6152's escalated second question is ever answered "an authored handler
 * EXPRESSION is a supported dialect" (the 11 `z.string()` mirrors), an `on*` key can
 * become genuinely authorable — that is a RULING, and it moves the key back with the
 * shape pin relaxed deliberately, never by quietly refiling it.
 */
interface RuntimeOnlyDeclared {
  /**
   * 12 of `DataTableSchema`'s former 29. OVERSIGHT group — this mirror already
   * declares four callbacks. ⚠️ `onColumnReorder` is still read NOWHERE, and
   * deliberately so. objectui#6175 repaired the persistence half this entry used to
   * describe: `onColumnResize` is now invoked by `data-table.tsx` (at the end of a
   * resize drag), and ObjectGrid now emits the MIRRORED near-duplicate
   * `onColumnsReorder` — the spelling the renderer already invoked — instead of the
   * singular `onColumnReorder` it used to write and nothing read. So column-state
   * persistence DOES fire now, and `onColumnReorder` is left declared, mirrored by
   * nothing, and wired to nothing.
   *
   * That residue is the open question, not an oversight: one event, two declared
   * spellings, different signatures. objectui#6175 wired persistence WITHOUT
   * retiring anything, because retiring either spelling is a declared-surface change
   * and that ruling is still OPEN. Nothing about this entry's membership changed.
   */
  'data-display.zod.ts#DataTableSchema':
    | 'onAddRecord' | 'onBatchSave' | 'onCellChange' | 'onColumnReorder' | 'onColumnResize'
    | 'onPageChange' | 'onPageSizeChange' | 'onRowActionDef' | 'onRowClick' | 'onRowSave'
    | 'onSearchChange' | 'onSortChange';
  /**
   * 1 of `FormSchema`'s former 9. OVERSIGHT group — `onSubmit`, `onChange` and
   * `onCancel` are mirrored beside it. Read at `renderers/form/form.tsx:997`, by
   * destructuring, which is why the AST census and not a grep found it.
   */
  'form.zod.ts#FormSchema': 'onDirtyChange';
  /**
   * 5 of `ObjectFormSchema`'s former 26. POLICY group — `objectql.zod.ts` mirrors no
   * callback at all. All five are read in `plugin-form/src/ObjectForm.tsx`.
   */
  'objectql.zod.ts#ObjectFormSchema':
    | 'onCancel' | 'onError' | 'onOpenChange' | 'onStepChange' | 'onSuccess';
  /** 1 of `ObjectGridSchema`'s former 17. POLICY group. Read at `ObjectGrid.tsx:1334`. */
  'objectql.zod.ts#ObjectGridSchema': 'onNavigate';
  /**
   * 1 of `ObjectViewSchema`'s former 11 — the one key that sits in both stories. This
   * pair is ALSO spec-derived, so its other ten keys stay in `UnmirroredDeclared` and
   * stay routed to objectui#2231; reclassifying its callback does not re-route the
   * pair. POLICY group.
   */
  'objectql.zod.ts#ObjectViewSchema': 'onNavigate';
  /**
   * `TreeViewSchema`'s ONLY entry in either ledger — the pair was clean before
   * objectui#6150 and this key is the whole of its debt.
   *
   * OVERSIGHT group by mirror shape (`onSelectChange` and `onExpandChange` are
   * mirrored beside it as `z.function()`), but it arrives here as a DECLARATION,
   * not a discovery: objectui#6150's census measured `schema.onNodeClick` INVOKED
   * at `renderers/data-display/tree-view.tsx:98,99` against a type that declared
   * nothing, and the card declared it. A function cannot appear in an authored
   * JSON document, so the key is a runtime slot and objectui#6152's ruling routes
   * it here rather than to a mirror — the step-3 exception in the header above,
   * used exactly as written.
   *
   * ⚠️ This is the first pair to sit in `RuntimeOnlyDeclared` without also sitting
   * in `UnmirroredDeclared`; the two counts in the file header record that.
   */
  'data-display.zod.ts#TreeViewSchema': 'onNodeClick';
  /**
   * 3 of `DetailViewSchema`'s former 14 — the exact three the 2026-07 audit named. By
   * mirror SHAPE this is the oversight group (`onBack` is mirrored, as `z.string()`),
   * but this is also the pair where "a props bag wearing a schema's clothes" was
   * written, and `onTabChange` is the key read through an `(schema as any)` cast.
   */
  'views.zod.ts#DetailViewSchema': 'onAddComment' | 'onNavigate' | 'onTabChange';
}

/**
 * Every entry in EITHER unmirrored ledger names a REGISTERED pair.
 *
 * A misspelled pair key would otherwise be ignored by the `[K in MirrorKey]` map
 * below and the real pair would read as having no entry — still red, but pointing at
 * the wrong thing. This names it directly.
 */
export type assertionUnmirroredLedgerKeysAreRegistered =
  Expect< Equal< Exclude< keyof UnmirroredDeclared | keyof RuntimeOnlyDeclared, MirrorKey >, never > >;

/* ── Classification: what keeps the split from being a bucket ───────────────── */

/**
 * `on` followed by an uppercase letter.
 *
 * Spelled as the 26 letters rather than `` `on${string}` `` so the TYPE and the
 * `/^on[A-Z]/` census that MEASURED the 23 cannot drift apart: the loose spelling
 * also matches `only`, `once` and `onboarding`, and would quietly refuse an ordinary
 * declared key from `UnmirroredDeclared` on a name collision.
 */
type CallbackShapedKey = `on${
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'}${string}`;

/**
 * A callback-shaped key recorded as an ORDINARY mirroring debt.
 *
 * Refused: objectui#6152 ruled that mirroring is never the remedy for one, so filing
 * it here would record a remedy the ruling rejects. This is also the pin that shows
 * the 23 actually LEFT `UnmirroredDeclared` — it would be red if any had stayed.
 */
export type CallbackShapedInUnmirrored = {
  [K in keyof UnmirroredDeclared]: Extract< UnmirroredDeclared[K], CallbackShapedKey >;
}[keyof UnmirroredDeclared];

export type assertionNoCallbackShapedKeyInUnmirroredDeclared =
  Expect< Equal< CallbackShapedInUnmirrored, never > >;

/**
 * A NON-callback key recorded as runtime-only.
 *
 * Refused, and this is the load-bearing half: without it the new category is a place
 * to move any inconvenient key to, and the reclassification becomes the waiver it is
 * not. `RuntimeOnlyDeclared` can only ever hold what its header claims it holds.
 */
export type NonCallbackInRuntimeOnly = {
  [K in keyof RuntimeOnlyDeclared]: Exclude< RuntimeOnlyDeclared[K], CallbackShapedKey >;
}[keyof RuntimeOnlyDeclared];

export type assertionRuntimeOnlyIsCallbackShapedOnly =
  Expect< Equal< NonCallbackInRuntimeOnly, never > >;

/**
 * The two ledgers are DISJOINT per pair.
 *
 * The union reconciliation below cannot see a double-filing — `'a' | 'a'` is `'a'` —
 * so a key recorded in both halves would reconcile green while making "97 + 23" the
 * wrong arithmetic and leaving two contradictory remedies on record. Named here
 * instead of assumed.
 */
export type DoubleFiledKey = {
  [K in keyof RuntimeOnlyDeclared]: K extends keyof UnmirroredDeclared
    ? Extract< RuntimeOnlyDeclared[K], UnmirroredDeclared[K] >
    : never;
}[keyof RuntimeOnlyDeclared];

export type assertionLedgerHalvesAreDisjoint = Expect< Equal< DoubleFiledKey, never > >;

/* ── The measured mirror-WIDER-than-declared ledger (objectui#7069) ─────────── */

/**
 * Exact WIDER key set per pair, measured against `origin/main`: keys whose mirror
 * admits a spelling the declaration refuses. Pinned exactly, like the ledgers
 * above — a new widening on a listed mirror fails, and so does a listed one that
 * has been repaired.
 *
 * ## Two classes, and only one of them is an accept-set gap
 *
 * **CONCRETE** — both faces are concrete, so the comparison means what it says: an
 * author can write the spelling, `safeParse` returns green, and `tsc` refuses it.
 * `FormSchema.layout` and `SliderSchema.defaultValue` are the plainest instances,
 * and the second is the shape objectui#7069 was filed about, still alive on a pair
 * nobody had looked at.
 *
 * **SCHEMA-NODE** — the mirror's face carries `unknown` NESTED inside an array
 * element or a property, from `SchemaNodeSchema`'s `z.ZodType< any >` annotation
 * (see `Unconstrained`, which excludes that face at the top level and one array
 * deep but not deeper). These entries record the ANNOTATION, not an accept-set
 * gap: at runtime the lazy union does validate. ⛔ They are not defects to repair
 * one by one, and repairing one would not move this ledger — only re-annotating
 * `SchemaNodeSchema` would. They are seeded so the ratchet still covers those
 * pairs: a CONCRETE widening appearing on one of them changes its key set and
 * reddens the invariant.
 *
 * The runtime leg at the bottom of this file is what keeps the second class from
 * silently spreading: it pins that every lazy node under the registered mirrors is
 * that one const, so a second annotated recursive mirror cannot enlarge the region
 * unnoticed.
 *
 * ## Seeded, and why that is a floor and not a waiver
 *
 * Seeded at the debt this direction was already carrying, the shape every ledger in
 * this file landed with (objectui#6058 for the unmirrored direction, objectui#6124
 * for the runtime-slot class). ⛔ No mirror and no declaration was moved to make it
 * green: every entry here is a disposition still to be made, and each is its own
 * card. `assertionRatchetRejectsFreshDrift` above is what makes the floor hold —
 * a widening on a pair this ledger does not name reddens immediately.
 *
 * ## Overlap with `KnownDrift` is expected, not a double-filing
 *
 * A pair can be narrower on one key and wider on another, and a single key can be
 * DISJOINT — each face refusing something the other admits — in which case it is
 * recorded in both ledgers, measured from both sides. That is not the double-filing
 * `assertionLedgerHalvesAreDisjoint` refuses: that one is about the two UNMIRRORED
 * ledgers, which record one measurement between them. This ledger records a
 * SECOND, independent measurement.
 *
 * ## When it fires
 *
 *   1. the message names the pair;
 *   2. resolve `WiderOf< 'THE PAIR' >`, and for each key in the difference resolve
 *      `MirrorInputOf< 'THE PAIR', 'THE KEY' >` beside
 *      `DeclaredTypeOf< 'THE PAIR', 'THE KEY' >` — the two faces side by side are
 *      the whole diagnosis;
 *   3. a key APPEARED — the mirror now accepts a spelling the declaration refuses.
 *      ⛔ Widening the declaration to match is not the default remedy: the mirror is
 *      the authoring boundary, so the contract-first move is to NARROW THE MIRROR
 *      unless the declaration is the face that is wrong;
 *   4. a key DISAPPEARED — the faces agree again; correct or delete the entry.
 */
interface WiderThanDeclared {
  /**
   * CONCRETE `label` + SCHEMA-NODE `areas` / `actions`.

   * `label` is the INLINE-LOCALE class: `BaseSchema`'s mirror spells the key
   * `I18nLabelSchema` — a plain string OR an inline locale map — while this
   * declaration restates `label?: string` and so refuses the map its own mirror
   * accepts. The narrowing lives on the DECLARED side, which is why the forward
   * comparison reads the pair as clean.
   */
  'app.zod.ts#AppComponentSchema': 'label' | 'areas' | 'actions';
  /** SCHEMA-NODE: the element's `content` is a schema-node slot. */
  'complex.zod.ts#CarouselSchema': 'items';
  /**
   * CONCRETE, and DISJOINT rather than strictly wider — the pair also carries a
   * `KnownDrift` entry for the same key, one of the measured cases where each face
   * refuses something the other admits. The mirror restates `body` as an arbitrary
   * record; the declaration inherits the base's schema-node-or-list.
   */
  'complex.zod.ts#ChatbotSchema': 'body';
  /**
   * MIXED. `header` and `globalFilters` carry the inline-locale widening one level
   * down (a nested `label`), `dateRange.defaultRange` is a bare string on the
   * mirror against a closed literal set on the declaration, and `widgets` is
   * SCHEMA-NODE. Three of the four also carry a `KnownDrift` entry.
   */
  'complex.zod.ts#DashboardComponentSchema': 'header' | 'widgets' | 'globalFilters' | 'dateRange';
  /** CONCRETE: the element shape differs from the named declaration in both directions; also in `KnownDrift`. */
  'complex.zod.ts#FilterBuilderSchema': 'fields';
  /** CONCRETE: the mirror's operator enum and the declared operator union are not the same set; also in `KnownDrift`. */
  'complex.zod.ts#FilterFieldSchema': 'operators';
  /** SCHEMA-NODE. */
  'complex.zod.ts#DeclarativeKanbanColumnSchema': 'cards';
  /** SCHEMA-NODE. */
  'complex.zod.ts#DeclarativeKanbanSchema': 'columns';
  /** SCHEMA-NODE. */
  'crud.zod.ts#DetailSchema': 'groups' | 'tabs';
  /**
   * CONCRETE. `columns` compares an inline element shape against the named
   * `TableColumn`; `renderCellEditor` is the FUNCTION-SLOT class — zod 4 gives
   * `z.function()` an opaque input brand that no concrete signature equals, so the
   * mirror accepts any callable where the declaration states one signature.
   */
  'data-display.zod.ts#DataTableSchema': 'columns' | 'renderCellEditor';
  /** SCHEMA-NODE. */
  'data-display.zod.ts#ListSchema': 'items';
  /**
   * FUNCTION-SLOT. ⚠️ Not the key objectui#5853 closed: that card was `type`,
   * the interface's literal set against a bare `z.string()` on the mirror, and it
   * is absent here because the repair landed. `cell` is the same pair, a different
   * key and a different class.
   */
  'data-display.zod.ts#TableColumnSchema': 'cell';
  /** SCHEMA-NODE. */
  'data-display.zod.ts#TimelineSchema': 'events';
  /** SCHEMA-NODE. */
  'disclosure.zod.ts#AccordionSchema': 'items';
  /** CONCRETE and DISJOINT — the mirror admits a string, the declaration a list of dates; also in `KnownDrift`. */
  'form.zod.ts#CalendarSchema': 'defaultValue' | 'value';
  /** FUNCTION-SLOT. */
  'form.zod.ts#FieldConditionSchema': 'custom';
  /** FUNCTION-SLOT. */
  'form.zod.ts#FieldConstraintsSchema': 'validate';
  /** CONCRETE: `validation` compares an inline shape against the named declaration; `condition` carries a FUNCTION-SLOT one level down. */
  'form.zod.ts#FormFieldSchema': 'validation' | 'condition';
  /**
   * CONCRETE. `layout` is the clearest single instance in this ledger: the mirror
   * is `z.enum(['vertical', 'horizontal', 'grid'])` and the declaration states the
   * first two, so the third spelling parses green and `tsc` refuses it. `fields`
   * and `mode` are the disjoint pair objectui#5927 left in `KnownDrift` — measured
   * here from the other side.
   */
  'form.zod.ts#FormSchema': 'layout' | 'fields' | 'mode';
  /**
   * CONCRETE, and the class objectui#7069 was filed for, ALIVE: the mirror is
   * `z.union([z.number(), z.array(z.number())])` and the declaration states the
   * list alone, so a single number parses green and `tsc` refuses it. That is the
   * `DataTableSchema.toolbar` shape the card measured, one accepted arm wider than
   * its declaration — the instance died with PR #7066, and here is the class it
   * said would outlive it, on a pair nothing had looked at.
   */
  'form.zod.ts#SliderSchema': 'defaultValue' | 'value';
  /**
   * CONCRETE: the mirror's arm is `z.boolean()` while the declaration admits the
   * false literal alone, so `true` parses green and `tsc` refuses it.
   */
  'layout.zod.ts#ContainerSchema': 'maxWidth';
  /** MIXED: `aria` carries the inline-locale widening one level down; `regions` and `slots` are SCHEMA-NODE. */
  'layout.zod.ts#PageNodeSchema': 'aria' | 'regions' | 'slots';
  /** SCHEMA-NODE. */
  'layout.zod.ts#ResizableSchema': 'panels';
  /** SCHEMA-NODE. */
  'layout.zod.ts#TabsSchema': 'items';
  /** CONCRETE and DISJOINT — one variant spelling on each side the other refuses; also in `KnownDrift`. */
  'navigation.zod.ts#HeaderBarSchema': 'variant';
  /** CONCRETE, INLINE-LOCALE: both keys are `I18nLabelSchema` on the mirror and restated as plain strings on this declaration. */
  'objectql.zod.ts#ObjectGridSchema': 'label' | 'description';
  /** SCHEMA-NODE. */
  'objectql.zod.ts#ObjectViewSchema': 'form' | 'table';
  /** SCHEMA-NODE. */
  'overlay.zod.ts#MenubarSchema': 'menus';
  /** SCHEMA-NODE. */
  'reports.zod.ts#ReportBuilderSchema': 'report';
  /** SCHEMA-NODE. */
  'reports.zod.ts#ReportComponentSchema': 'sections';
  /** SCHEMA-NODE. */
  'reports.zod.ts#ReportSectionSchema': 'chart';
  /** SCHEMA-NODE. */
  'reports.zod.ts#ReportViewerSchema': 'report';
  /** CONCRETE: an inline option shape against the named `SelectOptionMetadata`. */
  'views.zod.ts#DetailViewFieldSchema': 'options';
  /** SCHEMA-NODE. */
  'views.zod.ts#DetailViewSchema': 'fields' | 'tabs' | 'sections';
  /** SCHEMA-NODE. */
  'views.zod.ts#DetailViewSectionSchema': 'fields';
  /** SCHEMA-NODE. */
  'views.zod.ts#ViewSwitcherSchema': 'views';
}

/**
 * Every entry in this ledger names a REGISTERED pair — the same guard
 * `assertionUnmirroredLedgerKeysAreRegistered` puts on the two unmirrored ledgers,
 * and for the same reason: a misspelled pair key is ignored by the map below while
 * the real pair reads as having no entry, so the failure points at the wrong thing.
 */
export type assertionWiderLedgerKeysAreRegistered =
  Expect< Equal< Exclude< keyof WiderThanDeclared, MirrorKey >, never > >;

/* ── The invariant ──────────────────────────────────────────────────────────── */

/**
 * Every pair's TYPE drift equals what `KnownDrift` records for it — `never` for the
 * 115 pairs with no entry (157 − 42).
 *
 * Routed through `ReconcileAgainstLedger` rather than spelling the conditional
 * inline. That is a semantics-preserving refactor and nothing else — the type is
 * literally `Equal< Measured, Recorded > extends true ? never : K`, exactly what
 * stood here — and it buys one thing: the recognition pins at `assertionRatchet…`
 * now cover THIS assertion's reconciliation as well as the new one's.
 */
export type LedgerMismatch = {
  [K in MirrorKey]: ReconcileAgainstLedger<
    K,
    DriftOf< K >,
    K extends keyof KnownDrift ? KnownDrift[K] : never
  >;
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
 * The SECOND half of the forward comparison: every pair's declared-but-unmirrored
 * key set equals what the two ledgers TOGETHER record for it — `never` for the 142
 * pairs with no entry in either (157 − 15). Six of `RuntimeOnlyDeclared`'s seven
 * pairs are a measured subset of `UnmirroredDeclared`'s 14, so objectui#6152's
 * reclassification left the clean population unchanged; objectui#6150 then added
 * `TreeViewSchema`, whose only entry is runtime-only, which is why the union is one
 * pair larger than `UnmirroredDeclared` itself. (objectui#6576 took the union to 18;
 * objectui#7129 brought it back to 17 by retiring `DetailViewSectionSchema`'s only
 * ledgered key, objectui#7623 to 16 by retiring `DashboardComponentSchema`'s,
 * objectui#7352 to 14 by MIRRORING both `drillDown` entries — each leaving its
 * pair with no entry in either half — and objectui#7655 to 15 by registering
 * `ChatbotFloatingSchema` born ledgered. ⚠️ Two of those pairs still carry a
 * `KnownDrift` entry: "no entry in either" is about the two UNMIRRORED ledgers.)
 *
 * ⚠️ **The discriminating signal is the PER-PAIR set, not this file's exit code.**
 * The exit code is a whole-file verdict, so it moves only while the rest of the
 * file is green — and objectui#6058 measured the state where it does not move at
 * all. On the un-seeded tree the comparison was already red on 23 pairs, so
 * `tsc -p tsconfig.test.json` returned 2 BEFORE and AFTER the card's ablation while
 * the ablated pair went from clean to ten drifted keys. Seeding this ledger is what
 * restored the exit code as a usable signal, and it stays usable only while it is
 * green at rest. To read a change of state, resolve
 * `UnmirroredOf< '<the named pair>' >` on each side and compare the SETS.
 *
 * ⚠️ And it is a COMPILE-TIME assertion. The `describe` block at the bottom of this
 * file is a population census — it checks that the registry is closed and that
 * `SPEC_DERIVED_PAIRS` re-derives, and it never compares keys at all. Its
 * `Tests 12 passed (12)` line does not move when this half reddens, correctly, and
 * it did not move under the ablation either. (It read `5 passed (5)` until
 * objectui#6705 added the seven-fixture suite pinning the re-check's scanner.) Reading the runtime half for evidence
 * about drift measures the wrong instrument and concludes the guard does nothing.
 *
 * When it fires, fix it by MEASURING (the compiler-API recipe and the
 * error-printing trap are in the ledger's header above):
 *   1. the message names a pair, possibly with `... N more ...` after it;
 *   2. resolve `UnmirroredOf< '<pair>' >`;
 *   3. a key APPEARED — that is a new defect on a published surface; mirror it, or
 *      narrow the declaration. ⛔ Adding it to `UnmirroredDeclared` is not a supported
 *      route: that ledger is SHRINK-ONLY. The ONE exception is a callback-shaped key,
 *      which objectui#6152 ruled can never be mirrored: it is recorded in
 *      `RuntimeOnlyDeclared` instead, and `assertionRuntimeOnlyIsCallbackShapedOnly`
 *      is what stops that exception from widening into a waiver;
 *   4. a key DISAPPEARED — good news, and the entry must be corrected or deleted, in
 *      whichever of the two ledgers holds it. That is the ratchet doing its job.
 */
/**
 * What the TWO unmirrored ledgers together record for one pair (objectui#6152).
 *
 * One measurement, one reconciliation, two ledgers on the recorded side. Splitting
 * the RECORD by remedy while keeping the MEASUREMENT whole is what makes the
 * reclassification a bookkeeping change and not a hole: a declared-but-unmirrored key
 * must appear in one of the two halves or the pair reddens.
 */
export type RecordedUnmirrored< K extends MirrorKey > =
  | (K extends keyof UnmirroredDeclared ? UnmirroredDeclared[K] : never)
  | (K extends keyof RuntimeOnlyDeclared ? RuntimeOnlyDeclared[K] : never);

export const assertionUnmirroredMatchesLedger: never = 0 as unknown as {
  [K in MirrorKey]: ReconcileAgainstLedger< K, UnmirroredOf< K >, RecordedUnmirrored< K > >;
}[MirrorKey];

/**
 * The THIRD direction: every pair's WIDER key set equals what `WiderThanDeclared`
 * records for it — `never` for the pairs with no entry.
 *
 * Routed through `ReconcileAgainstLedger` like the two above, so the recognition
 * pins at `assertionRatchet…` cover this reconciliation too, and written as an
 * assignment to `never` for the same reason the other two are: the compiler then
 * prints the OFFENDING PAIR instead of `Type 'false' does not satisfy the
 * constraint 'true'`.
 *
 * ⚠️ Like `assertionUnmirroredMatchesLedger`, this is a COMPILE-TIME assertion. The
 * `describe` blocks at the bottom are a population census and a runtime scan; their
 * passing test counts do not move when this reddens. `pnpm --filter
 * @object-ui/types type-check` is the gate that reads it.
 */
export type WiderLedgerMismatch = {
  [K in MirrorKey]: ReconcileAgainstLedger<
    K,
    WiderOf< K >,
    K extends keyof WiderThanDeclared ? WiderThanDeclared[K] : never
  >;
}[MirrorKey];

export const assertionWiderMatchesLedger: never = 0 as unknown as WiderLedgerMismatch;

/**
 * No pair's WIDER measurement has degenerated to `any`.
 *
 * This is not a hypothetical. `any` is assignable to `never`, so a pair whose
 * measurement collapses to `any` reconciles SILENTLY GREEN against any ledger entry
 * at all — the assignment above cannot report it, and neither can the ledger. It
 * was observed while this direction was being built: a recursive spelling of
 * `Unconstrained` that descended into object properties drove exactly the deepest
 * pairs to `any`, and the invariant stayed green while measuring nothing on them.
 * `assertionNoVacuousEntry` guards the shape side of vacuity; this guards the
 * measurement side, which the same file did not previously need.
 */
export type VacuousWiderMeasurement = {
  [K in MirrorKey]: IsAny< WiderOf< K > > extends true ? K : never;
}[MirrorKey];

export type assertionNoVacuousWiderMeasurement = Expect< Equal< VacuousWiderMeasurement, never > >;

/**
 * Non-vacuity for all 157 entries at once.
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
  // Renamed from `StylePropsSchema` by objectui#5928. Under the old name the
  // like-named `StyleProps` (../base.ts) — the Tailwind-scale vocabulary, sharing
  // ZERO keys with this `{ className, style }` object — read as its declaration, and
  // a name-derived pairing duly compared two unrelated key sets. Named for its own
  // two keys, it has no like-named declaration left to be paired with.
  'base.zod.ts#ClassNameStylePropsSchema':
    'no TS declaration in this package restates it — the `{ className, style }` passthrough attributes are declared inline on each schema, never as one shared interface',
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
  'complex.zod.ts#CalendarViewModeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it",
  'complex.zod.ts#DashboardWidgetTypeSchema':
    "a bare vocabulary with no `.shape`; it is checked where a mirrored KEY declares it — `DashboardWidgetSchema.type` (objectui#4600), whose TS twin `DashboardWidgetTypeName` is a union, not a key set",
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
  // `base.zod.ts#BaseSchema` and `objectql.zod.ts#ObjectViewSchema` used to stand
  // here and were removed by objectui#6705 — NOT because either mirror changed,
  // but because the re-check below stopped mis-reading them. Neither references a
  // spec schema; each was held here by one of the two defects that card names:
  //   - `BaseSchema` — its file's ONLY `Spec…` token is in a COMMENT
  //     (`base.zod.ts`, "rather than calling `SpecSchema.omit(…)`"). Prose.
  //   - `ObjectViewSchema` — `BaseSchema.extend({…})` with every member a local
  //     literal. Its declaration ends ~50 lines above the next `export const`, and
  //     the old text window ran on to that boundary, swallowing the private
  //     `KanbanConfig = SpecKanbanConfigSchema…` block that belongs to no export.
  // ⚠️ The `ObjectViewSchema` removal has a consequence this card did NOT settle:
  // the objectui#6058 split in this file's header routes its unmirrored declared
  // keys as SPEC-DERIVED — a routing that rests on the false positive. That
  // classification is deliberately left as it stands here; see the note there.
  'complex.zod.ts#DashboardComponentSchema',
  'complex.zod.ts#DashboardWidgetSchema',
  'form.zod.ts#SelectOptionSchema',
  'layout.zod.ts#PageNodeSchema',
  'objectql.zod.ts#ObjectGallerySchema',
  'objectql.zod.ts#ObjectGanttSchema',
  'objectql.zod.ts#ObjectMapSchema',
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

/* ── Which exports reference a spec symbol (AST, not raw text) ───────────────── */

/**
 * The exported consts in ONE mirror source whose definition references a `Spec…`
 * symbol — the input to `SPEC_DERIVED_PAIRS`' re-check below.
 *
 * ## Why this parses instead of scanning text (objectui#6705)
 *
 * This used to slice the source between `export const` boundaries and test the
 * slice against a `\bSpec[A-Z]` word pattern. Raw text cannot tell a reference from a mention,
 * and the boundary is not the declaration's end, so the rule had two independent
 * defects that both fired on ONE docstring:
 *
 *   - **A comment counted as a reference.** A docstring naming `SpecGanttConfigSchema`
 *     in PROSE made this test red with nothing about the emitted types, the runtime
 *     or the mirror's actual spec dependency having moved.
 *   - **The window charged text to the wrong declaration.** The docstring sat above
 *     the PRIVATE `GanttConfigExtensionFields` const, which lives textually between
 *     the `ObjectTreeSchema` and `ObjectGanttSchema` exports — so the slice starting
 *     at `ObjectTreeSchema` ran on past its own end and the failure named
 *     `ObjectTreeSchema`, a mirror that references no spec schema at all. The person
 *     who edits a docstring gets a red naming an innocent neighbour several
 *     declarations away.
 *
 * The workaround that shipped (PR #6704) was a docstring reworded to dodge the
 * literal token plus a comment asking the next editor to remember — a convention
 * held by discipline, which is what a gate is supposed to replace.
 *
 * ## What it does instead
 *
 * `Spec…` identifiers are collected from the AST, so a mention inside a comment or
 * a string literal is not a reference — those are not `Identifier` nodes and never
 * reach the test. There is no comment-stripping regex to get wrong on a string that
 * contains `*` `/` sequences, because nothing strips anything.
 *
 * Attribution is by DECLARATION, not by text window: each top-level declaration
 * owns exactly its own initializer. A private const between two exports is charged
 * to neither — except through the one link that is a real dependency, which this
 * follows: a mirror that spreads a private const built from a spec schema IS spec
 * derived, so file-local references are resolved to a fixed point before the
 * exported names are read off. `ObjectGanttSchema`'s dependency survives whether it
 * extends `SpecGanttConfigSchema` inline or through a local field map.
 *
 * ⚠️ This is a precision fix, and the direction that must not be lost is the
 * POSITIVE one: a scanner that stopped seeing comments AND stopped seeing real
 * references would go green on the list below while checking nothing. The fixture
 * suite asserts both directions, and the re-check itself is the live positive
 * proof — all eight pairs in `SPEC_DERIVED_PAIRS` are found by code reference alone.
 */
export function specReferencingExports(fileName: string, source: string): Set<string> {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS);

  /** Per top-level declaration: does it name a `Spec…` symbol, and what else does it name? */
  const decls = new Map<string, { spec: boolean; refs: Set<string> }>();
  const exported = new Set<string>();

  const collect = (node: ts.Node | undefined, into: { spec: boolean; refs: Set<string> }): void => {
    if (!node) return;
    const walk = (n: ts.Node): void => {
      if (ts.isIdentifier(n)) {
        if (/^Spec[A-Z]/.test(n.text)) into.spec = true;
        else into.refs.add(n.text);
      }
      ts.forEachChild(n, walk);
    };
    walk(node);
  };

  const record = (name: string, isExported: boolean, ...bodies: (ts.Node | undefined)[]): void => {
    const rec = decls.get(name) ?? { spec: false, refs: new Set<string>() };
    for (const b of bodies) collect(b, rec);
    decls.set(name, rec);
    if (isExported) exported.add(name);
  };

  for (const stmt of sf.statements) {
    const isExported = (ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined)
      ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        record(d.name.text, isExported, d.initializer, d.type);
      }
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      record(stmt.name.text, isExported, stmt.body, stmt.type);
    }
  }

  // File-local references resolved to a fixed point: a declaration built from one
  // that is spec-derived is itself spec-derived. Iterative, so a reference cycle
  // terminates instead of recursing.
  const specDerived = new Set<string>();
  for (const [name, rec] of decls) if (rec.spec) specDerived.add(name);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [name, rec] of decls) {
      if (specDerived.has(name)) continue;
      for (const r of rec.refs) {
        // Only through PRIVATE declarations. An exported mirror is a registered
        // pair with an entry of its own, so its spec sensitivity is already
        // recorded under its own key; hopping through it would re-attribute one
        // mirror's dependency to every mirror that merely names it. A private
        // const has no key of its own, so its dependency must be charged to the
        // export that uses it or it is lost.
        if (specDerived.has(r) && !exported.has(r)) {
          specDerived.add(name);
          changed = true;
          break;
        }
      }
    }
  }

  return new Set([...exported].filter((n) => specDerived.has(n)));
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
    // Read from the AST — see `specReferencingExports` for why prose does not count.
    const derived: string[] = [];
    const byFile = new Map<string, Set<string>>();
    for (const key of Object.keys(MIRRORS)) {
      const [file, name] = key.split('#');
      let refs = byFile.get(file);
      if (!refs) {
        refs = specReferencingExports(file, readFileSync(join(ZOD_DIR, file), 'utf8'));
        byFile.set(file, refs);
      }
      if (refs.has(name)) derived.push(key);
    }
    expect(derived.sort(), 'a mirror gained or lost a spec dependency — update SPEC_DERIVED_PAIRS')
      .toEqual([...SPEC_DERIVED_PAIRS].sort());
  });

  it('every exclusion carries a reason', () => {
    const empty = Object.entries(EXCLUSIONS).filter(([, why]) => why.trim().length < 20);
    expect(empty.map(([k]) => k), 'an exclusion without a reason is an oversight').toEqual([]);
  });
});

describe('the spec-reference scan reads code, not prose (objectui#6705)', () => {
  const scan = (src: string): string[] => [...specReferencingExports('fixture.zod.ts', src)].sort();

  it('a `Spec…` token mentioned only in a COMMENT is not a reference', () => {
    // The exact shape that flipped this file red: prose, nothing else moved.
    expect(
      scan(`
/**
 * Extends the spec's SpecGanttConfigSchema — mentioned in prose only.
 */
export const ObjectTreeSchema = z.object({ objectName: z.string() });
`),
    ).toEqual([]);
  });

  it('a `Spec…` token referenced in CODE still fires — the direction that must not be lost', () => {
    // ⚠️ The whole risk of this fix: a scanner that stops seeing comments AND
    // stops seeing real references goes green while checking nothing.
    expect(
      scan(`
export const ObjectGanttSchema = SpecGanttConfigSchema.extend({ lockField: z.string() });
`),
    ).toEqual(['ObjectGanttSchema']);
  });

  it('a `Spec…` token inside a STRING LITERAL is not a reference either', () => {
    // Including one carrying comment-like sequences, which is the hazard a
    // regex-based comment stripper would have had. Nothing is stripped here.
    expect(
      scan(`
export const TextSchema = z.string().describe('SpecFooSchema */ // not a reference');
`),
    ).toEqual([]);
  });

  it('a PRIVATE const between two exports charges its prose to NEITHER neighbour', () => {
    // The live misattribution: the docstring sat above the private const, and the
    // text window starting at the preceding export ran on past its own end.
    expect(
      scan(`
export const ObjectTreeSchema = z.object({ objectName: z.string() });

/** Everything beyond the spec's SpecGanttConfigSchema. */
const GanttConfigExtensionFields = { lockField: z.string() };

export const ObjectGanttSchema = z.object({ ...GanttConfigExtensionFields });
`),
    ).toEqual([]);
  });

  it('a PRIVATE const with a REAL spec reference is charged to its USER, not its neighbour', () => {
    // Attribution by declaration plus file-local resolution: `ObjectGanttSchema`
    // really is spec-derived through the field map; `ObjectTreeSchema` is not, and
    // the text window used to blame exactly it.
    expect(
      scan(`
export const ObjectTreeSchema = z.object({ objectName: z.string() });

const GanttConfigExtensionFields = SpecGanttConfigSchema.shape;

export const ObjectGanttSchema = z.object({ ...GanttConfigExtensionFields });
`),
    ).toEqual(['ObjectGanttSchema']);
  });

  it("the NEXT export's docstring is not charged to the previous export", () => {
    expect(
      scan(`
export const ObjectTreeSchema = z.object({ objectName: z.string() });

/** Built from SpecGanttConfigSchema. */
export const ObjectGanttSchema = SpecGanttConfigSchema.extend({});
`),
    ).toEqual(['ObjectGanttSchema']);
  });

  it('the scanner can actually see a real mirror source (non-vacuity)', () => {
    // A broken parser returns an empty set and every negative case above passes
    // while checking nothing. Pin it against the file this bug was found in.
    const src = readFileSync(join(ZOD_DIR, 'objectql.zod.ts'), 'utf8');
    expect([...specReferencingExports('objectql.zod.ts', src)]).toContain('ObjectGanttSchema');
  });
});

/* ── Runtime: bounding the region the type level cannot see (objectui#7069) ─── */

/**
 * `WiderThanDeclaredKeys` is blind wherever a mirror slot's input face is
 * `unknown`, and every such face in this registry comes from ONE const —
 * `SchemaNodeSchema`, annotated `z.ZodType< any >` to break its own `z.lazy`
 * recursion. That claim is what makes the exclusion a bounded hole rather than an
 * open one, and it is exactly the claim the type level cannot check: at the type
 * level every unconstrained face looks alike, so a SECOND annotated recursive
 * mirror would enlarge the blind region without changing anything the compiler
 * reads. At runtime the mirrors are values and the lazy nodes are identifiable.
 *
 * ⛔ This is not a count. A count of affected slots moves with every `.extend()`
 * and would be the hand-maintained number this file keeps removing; what is pinned
 * is the CAUSE — that the blind region has exactly one source.
 */
type ZodInternals = { _zod?: { def?: Record<string, unknown> } };

const defOf = (schema: unknown): Record<string, unknown> | undefined =>
  (schema as ZodInternals | undefined)?._zod?.def;

/** Every schema node reachable from one slot, through the shapes zod 4 nests. */
function reachableNodes(schema: unknown, seen = new Set<unknown>()): unknown[] {
  const def = defOf(schema);
  if (!def || seen.has(schema)) return [];
  seen.add(schema);
  const found: unknown[] = [schema];
  for (const key of ['innerType', 'element', 'valueType', 'keyType', 'schema', 'in', 'out'] as const) {
    found.push(...reachableNodes(def[key], seen));
  }
  for (const list of [def.options, def.items]) {
    if (Array.isArray(list)) for (const arm of list) found.push(...reachableNodes(arm, seen));
  }
  const shape = def.shape as Record<string, unknown> | undefined;
  if (shape) for (const key of Object.keys(shape)) found.push(...reachableNodes(shape[key], seen));
  return found;
}

describe('the wider-direction blind spot has exactly one source (objectui#7069)', () => {
  const lazySlots: { slot: string; isSchemaNode: boolean }[] = [];
  for (const [pair, mirror] of Object.entries(MIRRORS)) {
    const shape = defOf(mirror)?.shape as Record<string, unknown> | undefined;
    if (!shape) continue;
    for (const key of Object.keys(shape)) {
      for (const node of reachableNodes(shape[key])) {
        if (defOf(node)?.type !== 'lazy') continue;
        lazySlots.push({ slot: `${pair}.${key}`, isSchemaNode: node === SchemaNodeSchema });
      }
    }
  }

  it('the walk can actually see a lazy node (non-vacuity)', () => {
    // A walk that stopped following zod's nesting would report an empty region and
    // pass the next case while checking nothing — the failure mode objectui#6133
    // names, on the instrument rather than on the ledger.
    expect(lazySlots.length).toBeGreaterThan(0);
  });

  it('every lazy node under a registered mirror is SchemaNodeSchema', () => {
    const foreign = lazySlots.filter((entry) => !entry.isSchemaNode).map((entry) => entry.slot);
    // A second annotated recursive mirror would widen the region `Unconstrained`
    // excludes, and the ledger's SCHEMA-NODE class note would stop being true.
    expect(foreign).toEqual([]);
  });
});
