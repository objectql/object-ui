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
 * ## ⭐ This mirror authors no default, imported subschemas included
 *
 * `result.data` is the document you handed in. This face VALIDATES; it does not
 * write values into an author's document — not on the keys this package
 * declares (objectui#7735, decision batch #69) and not on the keys it imports
 * by reference from `@objectstack/spec` (objectui#8317, decision batch #90).
 * An author who writes `navigation: {}` gets `navigation: {}` back, not
 * `navigation: { mode: 'page', preventNavigation: false, openNewTab: false,
 * size: 'auto' }`.
 *
 * ⇒ There is no key on this face whose presence in `result.data` means anything
 * other than "the author wrote it", and no import graph to read to find out
 * which keys those are. The authoritative default for a key is the RENDERER's
 * own fallback, which is what actually runs; a `@default` JSDoc tag DESCRIBES
 * that fallback and never installs one.
 *
 * ⛔ So: no `.default()` in `zod/*.zod.ts`, and every `@objectstack/spec` import
 * re-bound through `zod/imported-defaults.ts`. Both halves are ratcheted at zero
 * by `__tests__/zod-mirror-authors-no-defaults-7735.test.ts` and
 * `__tests__/imported-defaults-8317.test.ts`. The accept set is unchanged by
 * either: a key that was omissible stays omissible.
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
import { defineNodeComponentUnion } from './base.zod.js';
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
 *
 * ⭐ It is ALSO the node recursion point (objectui#8344): every child slot is
 * `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])`, and `SchemaNodeSchema`
 * resolves its component arm to THIS union, so a nested node is judged by its own
 * component schema at every depth instead of by the ~21 base keys. The wiring is a
 * late-binding holder rather than an import because 14 modules import `base.zod.js`
 * and this module is built from all 13 category modules — the full reasoning, and
 * what the UNFILLED holder answers, live on `SchemaNodeSchema` in `base.zod.ts`.
 *
 * ⚠️ The fill is written as this const's own initializer, not as a statement beside
 * it, so no bundler can keep the union and drop the wiring, and no future edit can
 * reorder the two. ⛔ Do not "simplify" it back into a bare
 * `defineNodeComponentUnion(AnyComponentSchema)` call underneath.
 *
 * ## Why this is discriminated (objectui#8498)
 *
 * A flat `z.union` reports EVERY arm's issues under one `invalid_union`, and
 * Zod's `$ZodError` initializer `JSON.stringify`s that whole tree into
 * `.message` EAGERLY — `zod/v4/core/errors.js:13`, in the constructor, not
 * behind a getter. The cost is paid whether or not anyone reads the message,
 * and it compounds once a refused node can appear at a child slot: a root-level
 * refusal cost 14,624 chars, growing ~25x per level of nesting until
 * `RangeError: Invalid string length` — a THROW out of the function this file
 * documents below as validating "without throwing". Discriminating selects ONE
 * arm from the authored literal: same document, same zod 4.4.3, 164 chars.
 *
 * ⛔ Not an accept-set change, and the property it rests on is measured rather
 * than assumed: the 13 arms declare 107 `type` literals with ZERO collisions,
 * so the arm a literal selects is the only arm that could ever have accepted
 * it. ⚠️ Every arm must declare its literals to Zod — a plain `z.union` member
 * computes no `propValues` and is REFUSED here (`Invalid discriminated union
 * option at index "9"`), which is why `objectql.zod.ts` and `crud.zod.ts` are
 * discriminated too. `__tests__/any-component-union-fanout.test.ts` pins all of
 * it.
 *
 * ⚠️ BOTH of the above are live here, and the composition is the whole resolution:
 * objectui#8498 changed WHICH arm reports, objectui#8344 changed WHERE this union is
 * consulted. The discriminated union is what gets written into the node option slot,
 * so `defineNodeComponentUnion` wraps it rather than replacing it. The slot itself is
 * still a plain `z.union` in `base.zod.ts` — that is what keeps its option array by
 * reference, and it is untouched by the discrimination.
 */
export const AnyComponentSchema = defineNodeComponentUnion(z.discriminatedUnion('type', [
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
], {
  // Zod's default message for a missed discriminator spells out EVERY accepted
  // literal — measured, 1,462 chars naming all 107. That is the "print every
  // arm" output the 2026-09-02 maintainer ruling rejected as noise, arriving by
  // the back door on a card about message size. `Invalid input` is what the flat
  // union reported here before, so the published root diagnostic is unchanged;
  // the ruling's capped list stays the one place arm names are printed, built by
  // `@object-ui/cli` from `issue.options`, which this does not touch.
  // ⚠️ Narrowed to `invalid_union`: an unconditional map is scoped to the WHOLE
  // schema, so it also rewrote this union's `invalid_type` and a non-object root
  // lost "expected object, received number". `undefined` declines to the locale.
  error: (issue) => (issue.code === 'invalid_union' ? 'Invalid input' : undefined),
}));

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

// ============================================================================
// Strict authoring face — the derived, unknown-key-closing twin (objectui#8345)
// ============================================================================

/**
 * The strict twin of the node face, derived from the mirrors above rather than
 * hand-written, under the objectui#5250 ruling (option 2: "each node schema
 * gets a derived strict variant; `objectui validate` and the doc-snippet gates
 * run strict; renderer props keep the tolerant face unchanged").
 *
 * ⛔ Nothing here changes the accept set of anything exported above. The
 * rendering face keeps its `.passthrough()`; this is a SECOND face, and no
 * consumer in this repository is wired to it yet.
 *
 * ⚠️ The module is `../strict-authoring-face.ts`, OUTSIDE this directory, and
 * the placement is deliberate. `__tests__/zod-mirror-parity.test.ts` runs a
 * census closed over the `export const`s of `src/zod/*.zod.ts`: every one is
 * either a registered hand-written mirror or a declared exclusion. A DERIVED
 * twin restates no declaration and has nothing to drift from, so it is not a
 * member of that population — and it lives outside the directory the census is
 * closed over, which keeps that closure statement exactly as true as it is
 * today rather than needing a new row to say "not really one of these".
 */
export {
  deriveStrictAuthoringSchema,
  StrictAnyComponentSchema,
  StrictSchemaNodeSchema,
} from '../strict-authoring-face.js';
export type {
  DeriveStrictAuthoringOptions,
  StrictAuthoringLimit,
} from '../strict-authoring-face.js';
