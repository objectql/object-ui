/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Complex Component Schemas
 * 
 * Type definitions for advanced/composite components.
 * 
 * @module complex
 * @packageDocumentation
 */

import type {
  DashboardWidget as SpecDashboardWidget,
  DateRangeDefaultRange as SpecDateRangeDefaultRange,
  GlobalFilter as SpecGlobalFilter,
  GroupingConfig,
} from '@objectstack/spec/ui';
import type { BaseSchema, SchemaNode } from './base.js';
import type { KanbanConditionalFormattingRule, ViewNavigationConfig } from './objectql.js';

/**
 * Kanban card — the shape the registered `'kanban'` renderer reads.
 *
 * ## Why this dialect lives here (objectui#7664, maintainer ruling (a), 2026-09-05)
 *
 * `@object-ui/types` used to declare a DIFFERENT board under the same
 * `'kanban'` key — the `DeclarativeKanban*` trio (`columns` with `color`,
 * `draggable`, cards with `labels` / `assignees` / `priority`), which was the
 * `'kanban'` arm of `ComplexSchema` → `AnyComponentSchema` → `safeValidateSchema`
 * — while the renderer registered for that key (`ObjectKanbanRenderer` in
 * `@object-ui/plugin-kanban`) consumed the plugin's own `KanbanSchema`. A board
 * could pass `objectui validate` and render EMPTY, because the validator and the
 * renderer honoured two unrelated faces (objectui#6086 measured the consequence).
 *
 * The ruling: for an authored `type: 'kanban'` document the PLUGIN dialect is
 * authoritative, so this package declares exactly that dialect and
 * `@object-ui/plugin-kanban` imports it back rather than declaring its own
 * (`packages/plugin-kanban/src/types.ts` re-exports these names — one
 * declaration, one authority, the dependency direction unchanged: `types`
 * declares, the plugin conforms). The declarative trio and its three Zod
 * mirrors are retired in the same change (ADR-0049 enforce-or-remove): its only
 * retained value was the validator arm, and that arm now validates this shape.
 * objectui#6172's "keep both faces" half is what this reverses; the ruling says
 * so explicitly.
 *
 * Every member below was carried from the plugin's declaration verbatim. The
 * runtime-computed members (`cardSubtitle`, `cardFieldCells`, `coverImage`,
 * a badge's `colorStyle`) are what `ObjectKanban` writes onto the cards it
 * hands the board and what `KanbanImpl` / `KanbanEnhanced` read back; the Zod
 * mirror (`zod/complex.zod.ts`) passes those through the way it passes
 * `TableColumn.headerIcon` through (objectui#6424).
 *
 * `React.CSSProperties` / `React.ReactNode` resolve through the ambient
 * namespace, the way `data-display.ts` already spells `headerIcon` and
 * `rowStyle` — this package still declares no React dependency.
 */
export interface KanbanCard {
  id: string;
  title: string;
  description?: string;
  badges?: Array<{
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    /**
     * Optional Tailwind class string applied to the badge. When set, it
     * overrides `variant` so callers can reuse the same colors as list/grid
     * cells.
     *
     * Derive it the way the grid cell derives it, or the same option renders
     * two colours on one screen (objectui#5183): prefer
     * `getBadgeHexAppearance(color)` from `@object-ui/fields` and use its
     * `className` — passing its `colorStyle` too — and fall back to
     * `getBadgeColorClasses(color, value)` only when it returns `undefined`.
     */
    colorClass?: string;
    /**
     * Inline style accompanying `colorClass`. **Required whenever the class
     * string came from `getBadgeHexAppearance`** — that className reads CSS
     * custom properties which only this style declares, so a badge carrying
     * the class without the style references undefined variables. Pass the
     * helper's `style` verbatim; leave unset on the palette-family path.
     */
    colorStyle?: React.CSSProperties;
  }>;
  /**
   * Synthesized card subtitle (e.g. "Account: Acme · Amount: $150K"). Rendered
   * in preference to `description` so we don't have to overwrite the record's
   * real `description` field — which would corrupt detail-view and edit-form
   * displays once a card is opened.
   *
   * Read by `KanbanImpl`; absent on a board that renders plain descriptions.
   */
  cardSubtitle?: string;
  /**
   * Structured per-field cells. When provided, the card body renders each
   * field via the unified `@object-ui/fields` cell-renderer pipeline (same
   * as Grid/Gallery), so lookup/user/email/url/phone/boolean/etc. fields
   * keep their semantic styling instead of being flattened to a text join.
   *
   * Takes precedence over `cardSubtitle` / `description` when present.
   */
  cardFieldCells?: Array<{ field: string; label?: string; node: React.ReactNode }>;
  /**
   * Resolved cover-image URL for the card, derived from the board's
   * `coverImageField`. Read by both board implementations.
   */
  coverImage?: string;
  [key: string]: any;
}

/**
 * Kanban column — a lane of the registered `'kanban'` renderer.
 */
export interface KanbanColumn {
  id: string;
  title: string;
  /**
   * Cards in this column.
   *
   * Named `cards` because that is what every board reads and every authored
   * document writes: `KanbanImpl` (12 lines), `KanbanEnhanced` (8) and
   * `bucketCardsIntoColumns` all read `column.cards`, and the two catalog
   * entries, the plugin docs and `content/docs/api/schema-reference.md` all
   * author it. The retired declarative face spelled this `items` until
   * objectui#6939 — a spelling with zero read sites, which made every authored
   * board fail `safeValidateSchema` while rendering correctly (objectui#6318's
   * bucket).
   */
  cards: KanbanCard[];
  /**
   * WIP limit — the card count at which the lane warns. Never reaches the
   * query; the board's fetch window is {@link KanbanSchema.limit}.
   */
  limit?: number;
  className?: string;
  /**
   * Whether the lane renders collapsed. Honoured by `KanbanEnhanced` (the
   * implementation that ships column collapsing); the plain board ignores it.
   */
  collapsed?: boolean;
  /**
   * RETIRED with the declarative face (objectui#7664, ADR-0049) — `color` was a
   * `DeclarativeKanbanColumn` member, and no registered board reads a column
   * colour (measured: zero `column.color` read sites across `KanbanImpl`,
   * `KanbanEnhanced`, `ObjectKanban`).
   *
   * A tombstone rather than a plain removal on BOTH prongs of the
   * discriminator the precedent changesets state (objectui#5941, #7526; the
   * one-line form is under correction as objectui#7678) — a tombstone exists
   * (1) to steer authors to a named live replacement KEY, or (2) to keep loud a
   * key the docs taught as working:
   *
   *   - prong 1: `className` is that live replacement — style a lane through
   *     it;
   *   - prong 2: `content/docs/api/schema-reference.md` taught this key as
   *     working. Before this card its kanban example authored a `color` on
   *     every one of its three columns (`"color": "#6366f1"` and two more) and
   *     its `columns` row read "each with `id`, `title`, `color`, and `cards`".
   *
   * ⚠️ The hazard prong 2 guards here is a SILENT STRIP, not a silent keep:
   * `KanbanColumn` does not extend {@link BaseSchema}, so its mirror is a plain
   * (non-passthrough) object. Measured on the built mirror: an undeclared
   * column key is accepted and dropped from the parsed output, while this
   * tombstone refuses `color` by name. A board that has always authored lane
   * colours therefore gets told, instead of quietly losing them.
   * @deprecated Not part of this contract — the value was inert.
   */
  color?: never;
}

/**
 * Kanban Board component schema — the `'kanban'` arm of {@link ComplexSchema}
 * and the face `ObjectKanbanRenderer` (registered for `'kanban'` and
 * `'object-kanban'`) consumes; `KanbanRenderer` (`'kanban-ui'`) and the
 * `'kanban-enhanced'` registration read the same keys off `schema`.
 *
 * Renders a drag-and-drop kanban board for task management: either bound to
 * an object (`objectName` + `groupBy`, lanes materialised from the group
 * field's options) or authored statically (`columns` carrying their `cards`).
 */
export interface KanbanSchema extends BaseSchema {
  type: 'kanban';

  /**
   * Object name to fetch data from.
   */
  objectName?: string;

  /**
   * Field to group records by (maps to column IDs).
   */
  groupBy?: string;

  /**
   * Field for swimlane rows (2D grouping). When set, cards are grouped
   * vertically by `groupBy` (columns) and horizontally by `swimlaneField` (rows).
   */
  swimlaneField?: string;

  /**
   * Field to use as the card title.
   */
  cardTitle?: string;

  /**
   * Fields to display on the card.
   */
  cardFields?: string[];

  /**
   * Static data or bound data. Stays a raw-row input: objectui#7651 (a
   * record-source ladder for the board) was ruled B and closed not_planned.
   */
  data?: any[];

  /**
   * Row cap for the fetch. Defaults to `DEFAULT_KANBAN_LIMIT` (100); a board
   * renders every fetched record into a lane and has no pagination control, so
   * this is the author's window rather than a page size. A bound `dataSource`
   * writes it here too — the binding's own `limit`, or the named view's
   * `pagination.pageSize`.
   *
   * Not to be confused with {@link KanbanColumn.limit}, one level down: that is
   * a lane's WIP limit (the card count at which the lane warns) and never
   * reaches the query.
   */
  limit?: number;

  /**
   * Array of columns to display in the kanban board.
   * Each column contains an array of cards.
   */
  columns?: KanbanColumn[];

  /**
   * Callback function when a card is moved between columns or reordered.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because
   * `KanbanRenderer` forwards it (`onCardMove={schema.onCardMove}`); the
   * object-bound board (`ObjectKanban`) supplies its own persisting handler.
   */
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void;

  /**
   * Callback function when a card is clicked.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * read on every channel measured (objectui#7664, the contract review of
   * PR #7743):
   *
   *   - `KanbanRenderer` forwards it (`onCardClick={schema.onCardClick}`) in the
   *     same block as {@link KanbanSchema.onCardMove} and
   *     {@link KanbanSchema.onQuickAdd};
   *   - on the `'kanban'` and `'object-kanban'` keys `ObjectKanban` substitutes
   *     its own function — and substitutes `onCardMove` in the very same object
   *     literal, so that reading retires both keys or neither;
   *   - and its substitute CALLS the authored handler: `ObjectKanban` declares
   *     an `onCardClick` PROP (`onCardMove` has none), which `SchemaRenderer`
   *     supplies by spreading every non-metadata schema key as a React prop.
   *
   * ⛔ Do not "simplify" this back into a deletion. `BaseSchema` is
   * `.passthrough()`, so removing the key does not refuse it — it stops being
   * judged and the value is kept, which is how the first cut of objectui#7664
   * turned a refused key into an accepted one with every ratchet green.
   * `plugin-kanban/src/__tests__/kanban-handler-slots-7664.test.tsx` derives the
   * forwarded key set from the read site and goes red on that deletion.
   *
   * The event is `unknown` rather than a mouse event because this package
   * declares zero dependencies and has no React types; `KanbanImpl` narrows it
   * to `React.MouseEvent` at the call site.
   */
  onCardClick?: (card: KanbanCard, event?: unknown) => void;

  /**
   * Optional CSS class name to apply custom styling.
   */
  className?: string;

  /**
   * Enable Quick Add button at the bottom of each column.
   * When true, a "+" button appears allowing inline card creation.
   * @default false
   */
  quickAdd?: boolean;

  /**
   * Callback when a new card is created via Quick Add.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because
   * `KanbanRenderer` forwards it (`onQuickAdd={schema.onQuickAdd}`), and
   * `ObjectKanban` spreads the authored schema into that renderer.
   */
  onQuickAdd?: (columnId: string, title: string) => void;

  /**
   * Field name to use as cover image on cards.
   * The field value should be a URL string or file object with a `url` property.
   */
  coverImageField?: string;

  /**
   * Conditional formatting rules for card coloring. Accepts the native
   * `{ field, operator, value }` shape and the spec `{ condition, style }` CEL
   * shape (issue #1584).
   */
  conditionalFormatting?: KanbanConditionalFormattingRule[];

  /**
   * Grouping configuration from ListView.
   * When set, the first grouping field is used as swimlaneField fallback.
   */
  grouping?: GroupingConfig;

  /**
   * Record navigation behaviour when a card is clicked (drawer / dialog /
   * page). Defaults to an inline right-side drawer; set `{ mode: 'page' }` to
   * route to the standalone detail page instead. Read at `ObjectKanban.tsx`
   * (`navConfig`), which feeds it to `useNavigationOverlay`.
   *
   * DECLARED by objectui#7742 (decision batch #70) on the gantt precedent
   * objectui#5903 set: the read existed and this face did not name it, so an
   * authored overlay mode rode {@link BaseSchema}'s `[key: string]: any` —
   * admitted, never examined — and the read site had to spell itself
   * `(schema as any).navigation`. Declaring it WIDENS the published accept set;
   * it is the one widening in a card whose other rows all narrow.
   *
   * The spec owns the member list — `mode`, `view`, `preventNavigation`,
   * `openNewTab`, `size`, `width` — and its schema REFUSES anything else. Do
   * not restate the vocabulary here.
   *
   * Same spec type as {@link ObjectGanttSchema.navigation} and
   * {@link ObjectGridSchema.navigation} — aligned with `@objectstack/spec`
   * `ListView.navigation` rather than restated, so the vocabulary cannot fork.
   */
  navigation?: ViewNavigationConfig;

  /**
   * RETIRED (objectui#7742, ADR-0049, maintainer decision batch #70,
   * 2026-09-07) — declared on both faces and read by NO registered board.
   *
   * Measured on this branch over `packages/plugin-kanban/src`, every file
   * including tests: `allowCollapse` 0 hits / 0 files, with `groupBy` (85/27),
   * `cardTitle` (18/9) and `coverImageField` (17/3) firing as controls on the
   * same instrument, so the zero is a reading and not a dead grep. The
   * capability EXISTS through another channel — `KanbanEnhanced` collapses a
   * lane off `KanbanColumn.collapsed` — so an author who wrote
   * `allowCollapse: true` validated green and got a board that never collapsed
   * off that key. A board-level switch wired to the per-lane mechanism is a new
   * card if it is ever wanted; the ruling did not order one.
   *
   * A tombstone rather than a plain removal on PRONG 2 of the discriminator the
   * precedent changesets state (objectui#5941, #7526): the key was TAUGHT as
   * working — `content/docs/api/schema-reference.md` carried the row
   * "`allowCollapse` | `boolean` | Allow columns to be collapsed." Prong 1 does
   * not apply: there is no live replacement KEY to name, only a different
   * channel.
   *
   * ⚠️ Inertness is why the key is retired, not why it is tombstoned. {@link
   * BaseSchema} is `.passthrough()`, so dropping it from the mirror would leave
   * a document naming it silently ACCEPTED with the value kept — the failure
   * objectui#7664's own first cut shipped at {@link KanbanSchema.onCardClick}.
   *
   * ⛔ NOT the same key as `ObjectKanbanSchema.allowCollapse` (`objectql.ts`),
   * which the batch #70 ruling did not reach and which stays declared on the
   * `object-kanban` arm.
   * @deprecated Not part of this contract — the value was inert.
   */
  allowCollapse?: never;

  /**
   * RETIRED (objectui#7742, ADR-0049, maintainer decision batch #70,
   * 2026-09-07) — declared on both faces and read by NO registered board.
   *
   * Measured with the census above: `cardTemplates` 0 hits / 0 files across
   * `packages/plugin-kanban/src`, same run and same firing controls. The
   * capability exists through a COMPONENT PROP — `CardTemplates.tsx` takes
   * `templates: CardTemplate[]` — never off the schema, so nothing an author
   * wrote here ever reached it. {@link CardTemplate} itself stays exported:
   * that prop and `plugin-kanban`'s re-export still consume the type.
   *
   * Tombstoned on PRONG 2, same as {@link KanbanSchema.allowCollapse}:
   * `content/docs/api/schema-reference.md` carried the row "`cardTemplates` |
   * `CardTemplate[]` | Predefined quick-add templates."
   * @deprecated Not part of this contract — the value was inert.
   */
  cardTemplates?: never;

  /**
   * RETIRED (objectui#7742, ADR-0049, maintainer decision batch #70,
   * 2026-09-07) — declared on both faces and read by NO registered board.
   *
   * Measured with the census above: `columnWidths` 0 hits / 0 files across
   * `packages/plugin-kanban/src`, same run and same firing controls. The
   * capability exists through a HOOK OPTION — `useColumnWidths` takes a
   * `ColumnWidthConfig` argument — never off the schema. {@link
   * ColumnWidthConfig} itself stays exported: that hook and `plugin-kanban`'s
   * re-export still consume the type.
   *
   * ⚠️ The repo-wide name census for this key is NOT zero (22 hits / 11 files)
   * and every one of those is a DIFFERENT key of the same spelling on the grid
   * surface — `data-table.tsx`, `ObjectGrid.tsx`, `RecordPickerDialog.tsx`. The
   * board's zero is the `packages/plugin-kanban/src` reading, and the grid key
   * is untouched by this retirement.
   *
   * Tombstoned on PRONG 2, same as {@link KanbanSchema.allowCollapse}:
   * `content/docs/api/schema-reference.md` carried the row "`columnWidths` |
   * `ColumnWidthConfig` | Column width configuration."
   * @deprecated Not part of this contract — the value was inert.
   */
  columnWidths?: never;

  /**
   * RETIRED on THIS arm (objectui#7742, ADR-0049, maintainer decision batch
   * #70, 2026-09-07) — one arm, one spelling: write {@link
   * KanbanSchema.cardTitle}.
   *
   * ⚠️ This tombstone is NOT an inertness finding, and reading it as one gets
   * the mechanism backwards. `ObjectKanban.tsx` DOES read the key —
   * `schema.cardTitle || schema.titleField` and `schema.cardTitle ??
   * schema.titleField` — and that read is load-bearing for the SIBLING arm:
   * `ObjectKanbanSchema` (`objectql.ts`) declares `titleField` and the batch #70
   * ruling says in as many words that the `object-kanban` arm KEEPS it
   * (objectui#7322 item ②, PR #8153, re-measured here from `25907cd70`). What
   * is retired is this arm's ACCEPTANCE of the legacy spelling, not the read.
   *
   * So a `{ "type": "kanban" }` document naming `titleField` is now refused BY
   * NAME and pointed at `cardTitle`; a `{ "type": "object-kanban" }` document
   * naming it still validates and still renders. One renderer, two node types,
   * two accept sets — which is the shape objectui#7322 item ② already gave the
   * component's prop union.
   *
   * ⚠️ Never declared on this face before now: it rode {@link BaseSchema}'s
   * `[key: string]: any`, which is why both reads were spelled `(schema as
   * any).titleField` until PR #8153 widened the prop to the two-arm union.
   * Declaring the tombstone is therefore the FIRST time this face judges the
   * key at all — a narrowing, not a re-narrowing.
   * @deprecated Not part of this contract on the `kanban` arm — write `cardTitle`.
   */
  titleField?: never;

  /**
   * RETIRED with the declarative face (objectui#7664, ADR-0049) — `draggable`
   * was a `DeclarativeKanbanSchema` member and no registered board reads it
   * (measured: zero `draggable` read sites in `@object-ui/plugin-kanban`;
   * drag-and-drop is always on).
   *
   * A tombstone rather than a plain removal on PRONG 2 of the discriminator the
   * precedent changesets state (objectui#5941, #7526; the one-line form is
   * under correction as objectui#7678) — a tombstone exists (1) to steer
   * authors to a named live replacement KEY, or (2) to keep loud a key the docs
   * taught as working. Prong 1 does not apply: drag-and-drop is unconditional,
   * so there is no replacement key to name, and the remedy is to delete the
   * member. Prong 2 carries it: `content/docs/api/schema-reference.md` taught
   * this key as working — before this card its kanban example opened with
   * `"draggable": true` and its property table read "`draggable` | `boolean` |
   * Enable drag-and-drop between columns."
   *
   * ⚠️ Inertness is why the key is retired, not why it is tombstoned. A key
   * this documented must be refused by NAME rather than dropped: {@link
   * BaseSchema} is `.passthrough()`, so dropping it from the mirror would leave
   * a document naming it silently accepted with the value kept — the failure
   * this card's own first cut shipped at {@link KanbanSchema.onCardClick}.
   * @deprecated Not part of this contract — the value was inert.
   */
  draggable?: never;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `kanban` renderer takes `({ schema })` and never reads it. Carried over
   * from the retired declarative face so the successor arm under the same
   * `'kanban'` key keeps refusing the spelling by name; author behaviour as a
   * node type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onColumnAdd?: never;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `kanban` renderer takes `({ schema })` and never reads it. Carried over
   * from the retired declarative face so the successor arm under the same
   * `'kanban'` key keeps refusing the spelling by name; author behaviour as a
   * node type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onCardAdd?: never;
}

/**
 * A predefined card template with pre-filled field values.
 */
export interface CardTemplate {
  /** Unique template identifier */
  id: string;
  /** Human-readable template name */
  name: string;
  /** Optional Lucide icon name */
  icon?: string;
  /** Pre-filled field values */
  values: Record<string, any>;
}

/**
 * Configuration for custom column widths.
 */
export interface ColumnWidthConfig {
  /** Default column width in pixels */
  defaultWidth?: number;
  /** Minimum column width in pixels */
  minWidth?: number;
  /** Maximum column width in pixels */
  maxWidth?: number;
  /** Per-column width overrides keyed by column ID */
  overrides?: Record<string, number>;
}

/**
 * Calendar view mode — the registered `calendar-view` renderer's rendered set.
 *
 * `'agenda'` was retired from this union (objectui#5740): no view ever
 * rendered it — the renderer resolved it to the `'month'` default — and no
 * measured app authors it (ADR-0049 enforce-or-remove, the value-level
 * residue of objectui#5667's key-level convergence).
 */
export type CalendarViewMode = 'month' | 'week' | 'day';

/**
 * Calendar event
 */
export interface CalendarEvent {
  /**
   * Unique event identifier
   */
  id: string;
  /**
   * Event title
   */
  title: string;
  /**
   * Event description
   */
  description?: string;
  /**
   * Event start date/time
   */
  start: string | Date;
  /**
   * Event end date/time
   */
  end: string | Date;
  /**
   * Whether event is all day
   */
  allDay?: boolean;
  /**
   * Event color
   */
  color?: string;
  /**
   * Additional event data
   */
  data?: any;
}

/**
 * Calendar view component.
 *
 * The authored surface of the registered `calendar-view` renderer, converged
 * on the renderer's measured read set (objectui#5667): the calendar's events
 * are COMPUTED from the node's `data` array plus the five field-name keys
 * below — there is no authorable `events` key. An authored `events` is dropped
 * by design (objectui#4433); this repo's action metadata rides
 * `properties.action`, not a calendar prop.
 *
 * Nine formerly declared keys — `events` (the interface's only required key
 * besides `type`, and the one the renderer refuses), `defaultView`,
 * `defaultDate`, `date`, `views`, `editable`, `onEventCreate`,
 * `onEventUpdate`, `onDateChange` — are RETIRED rather than implemented:
 * none had a read site on the authored-node path, and no measured app authors
 * any of them (ADR-0049 enforce-or-remove, objectui#5667).
 */
export interface CalendarViewSchema extends BaseSchema {
  type: 'calendar-view';
  /**
   * Records to display as events — the renderer computes its events from this
   * array plus the field-name keys below.
   *
   * Redeclared from `BaseSchema` (same `any` type) because a binding
   * expression string is also legal here and resolves to the array before the
   * renderer reads it. A non-array value renders an empty calendar.
   */
  data?: any;
  /**
   * Record field to use for the event title.
   * @default 'title'
   */
  titleField?: string;
  /**
   * Record field containing the event start date/time.
   * @default 'start'
   */
  startDateField?: string;
  /**
   * Record field containing the event end date/time.
   * @default 'end'
   */
  endDateField?: string;
  /**
   * Record field indicating an all-day event.
   * @default 'allDay'
   */
  allDayField?: string;
  /**
   * Record field to use for the event color.
   * @default 'color'
   */
  colorField?: string;
  /**
   * Calendar view mode.
   *
   * {@link CalendarViewMode} equals the renderer's rendered set since
   * objectui#5740 retired `'agenda'`; at runtime the renderer still resolves
   * any off-union value in raw metadata to the `'month'` default.
   * @default 'month'
   */
  view?: CalendarViewMode;
  /**
   * Initial calendar date — an ISO date string when authored as JSON; a
   * `Date` instance is accepted from a React host.
   */
  currentDate?: string | Date;
  /**
   * Show the "New event" affordance; clicking it dispatches a
   * `{ type: 'create' }` action on the node's action channel (objectui#4454).
   * @default false
   */
  allowCreate?: boolean;
  /**
   * Tailwind classes for the calendar container. Redeclared from `BaseSchema`
   * as part of the converged authored surface.
   */
  className?: string;
  /**
   * Event click handler — HOST-ONLY. The renderer forwards it only when the
   * value is a function, which authored JSON can never produce; supply it from
   * a React host (`<SchemaRenderer ... onEventClick={fn} />`).
   *
   * RUNTIME SLOT (objectui#7344, the objectui#6124 shape) — the zod twin, which
   * declared `z.function()` in a multi-line spelling PR #7339's census missed,
   * now refuses this key by name, like `onViewChange` below.
   */
  onEventClick?: (event: CalendarEvent) => void;
  /**
   * View change handler — HOST-ONLY, same rule as {@link
   * CalendarViewSchema.onEventClick}.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * read by `calendar-view`'s `pickHostCallbacks` off the spread props
   * (function values only).
   */
  onViewChange?: (view: CalendarViewMode) => void;
}

/**
 * Filter operator
 */
export type FilterBuilderOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in';

/**
 * Filter condition
 */
export interface FilterBuilderCondition {
  /**
   * Row identity.
   *
   * REQUIRED, and deliberately asymmetric with `FilterGroup.id` below
   * (objectui#8415). The group's `id` has zero read sites and is optional for
   * that reason; a CONDITION's `id` is the identity every affordance on the row
   * matches on — `removeCondition`, `updateCondition`, `changeOperator` and
   * `changeField` in `packages/components/src/custom/filter-builder.tsx`, plus
   * the React `key`. The component's own `FilterBuilderCondition` declares it
   * `string`, and `addCondition` emits `crypto.randomUUID()`.
   *
   * Undeclared, it was STRIPPED by the `z.object` mirror in silence, so a
   * correctly authored row validated and rendered with no individual identity:
   * every affordance is handed `undefined`, `c.id === conditionId` is TRUE for
   * every id-less row, and so one click removes all of them at once — the
   * clicked row included — while one edit fans out across all of them. A row
   * cannot be edited or removed on its own. (Not "matches none"; the failure is
   * en bloc.) Declaring it is what makes `declared = enforced`.
   */
  id: string;
  /**
   * Field to filter
   */
  field: string;
  /**
   * Filter operator
   */
  operator: FilterBuilderOperator;
  /**
   * Filter value
   */
  value?: any;
}

/**
 * Filter group — the shape `FilterBuilder` reads (objectui#6939, the
 * `filter-builder` group; maintainer ruling 2026-09-02, director seat summon
 * #8, verbatim 「同意」).
 *
 * The gate is `isValidGroup`,
 * `packages/components/src/custom/filter-builder.tsx:1060`:
 * `Array.isArray(v.conditions) && (v.logic === "and" || v.logic === "or")`.
 * `logic` is the read key; the former `operator` on this face had zero read
 * sites, and a group spelled that way fails the gate, falls back to
 * `EMPTY_GROUP` and renders an EMPTY board.
 */
export interface FilterGroup {
  /**
   * Group id.
   *
   * OPTIONAL on purpose. `isValidGroup` never consults it and nothing reads
   * `filterGroup.id`; measured, deleting it from an authored group renders
   * byte-identically. It is declared because the component's own `FilterGroup`
   * carries it, `EMPTY_GROUP` emits it and it round-trips out through
   * `onChange` — so a document that carries it should be TYPE-CHECKED on it
   * rather than admitted unvalidated.
   */
  id?: string;
  /**
   * How the conditions combine — the key `isValidGroup` reads.
   * @default 'and'
   */
  logic: 'and' | 'or';
  /**
   * Filter conditions or nested groups
   */
  conditions: (FilterBuilderCondition | FilterGroup)[];
}

/**
 * Filter builder component
 */
export interface FilterBuilderSchema extends BaseSchema {
  type: 'filter-builder';
  /**
   * Available fields for filtering
   */
  fields: FilterField[];
  /**
   * Default filter configuration
   */
  defaultValue?: FilterGroup;
  /**
   * Controlled filter value
   */
  value?: FilterGroup;
  /**
   * Change handler
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * called by the `filter-builder` renderer as `props.onChange` after
   * `SchemaRenderer` spreads it.
   */
  onChange?: (filter: FilterGroup) => void;
  /**
   * Allow nested groups
   * @default true
   */
  allowGroups?: boolean;
  /**
   * Maximum nesting depth
   * @default 3
   */
  maxDepth?: number;
  /**
   * Tailwind classes on the outermost wrapper `div`.
   *
   * READ SITE: `packages/components/src/renderers/complex/filter-builder.tsx:37`
   * — `className={schema.wrapperClass || ''}`.
   *
   * Distinct from {@link BaseSchema.className}, which this renderer applies
   * further in. Declared by objectui#6150.
   */
  wrapperClass?: string;
}

/**
 * Filter field definition — one entry of `FilterBuilderSchema.fields`
 * (objectui#6939, same ruling).
 *
 * Renamed from `name` to `value`: every read site matches on `value`
 * (`fields.find((f) => f.value === …)` in `getOperatorsForField`,
 * `changeField`, `getInputType` and `renderValueInput`; `fields[0]?.value` in
 * `addCondition`; `<SelectItem value={field.value}>` in the field dropdown),
 * `name` had zero, and `FilterBuilderProps.fields` in
 * `packages/components/src/custom/filter-builder.tsx` already declares
 * `Array<{ value, label, type? }>`.
 */
export interface FilterField {
  /**
   * Field key — the identity the builder matches a condition's `field`
   * against, and the value its field dropdown puts on each option.
   */
  value: string;
  /**
   * Field label
   */
  label: string;
  /**
   * Field type — the value FAMILY the column is edited in. OPTIONAL: absent
   * means `text`, which is what `valueFamilyForFieldType` and
   * `operatorsForFieldType` both read (`fieldType || "text"`,
   * `custom/filter-builder.tsx:408` and `:964`).
   *
   * The fourteen members are the published doc's
   * (`content/docs/components/complex/filter-builder.mdx`), which objectui#7562
   * ruled the authority for this authoring surface, in the doc's own order.
   * Every one of them was measured to have a renderer branch before this union
   * widened — the ruling's precondition — and none had to be withdrawn from the
   * doc. The mirror's docblock (`zod/complex.zod.ts`, `FilterFieldSchema`)
   * carries the branch-by-branch table with the file:line for each bucket.
   *
   * `string` is still absent and is the contrast that makes the rest read: it
   * is named nowhere in the renderer and reaches the text control only by the
   * unrecognised-word fallthrough, so it is a phantom (objectui#6939). `text`
   * shares that fallthrough but IS named — line 408 is where an absent `type`
   * acquires it — which is why one is declared and the other is not.
   */
  type?:
    | 'text' | 'number' | 'currency' | 'percent' | 'rating'
    | 'date' | 'datetime' | 'time'
    | 'boolean'
    | 'select' | 'status'
    | 'lookup' | 'master_detail' | 'user';
  /**
   * Available operators for this field
   */
  operators?: FilterBuilderOperator[];
  /**
   * Options (for select type)
   */
  options?: { label: string; value: any }[];
}

/**
 * Carousel item
 */
export interface CarouselItem {
  /**
   * Unique item identifier
   */
  id?: string;
  /**
   * Item content
   */
  content: SchemaNode | SchemaNode[];
}

/**
 * Carousel component
 */
export interface CarouselSchema extends BaseSchema {
  type: 'carousel';
  /**
   * Carousel items
   */
  items: CarouselItem[];
  /**
   * Option bag forwarded VERBATIM to the underlying embla carousel.
   *
   * READ SITE: `packages/components/src/renderers/complex/carousel.tsx:23` —
   * `opts={schema.opts}`, passed straight through to the `Carousel`
   * primitive, whose own `opts` is embla's `EmblaOptionsType`.
   *
   * ⚠️ Deliberately declared OPEN rather than as the two-key shape the docs
   * page shows (`{ loop?, align? }`). The renderer forwards the whole bag, so
   * every other embla option authored today reaches the library and works;
   * declaring the documented pair would REFUSE those authored documents —
   * a narrowing of a published surface, which is a ruling and not a
   * declaration. objectui#6150 records the capability as it is; picking a
   * narrower shape is escalated with that card.
   */
  opts?: Record<string, unknown>;
  /**
   * Scroll axis.
   *
   * READ SITE: `renderers/complex/carousel.tsx:24` —
   * `orientation={schema.orientation || 'horizontal'}`.
   *
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Tailwind classes applied to EACH slide (not the container — that is
   * {@link BaseSchema.className}).
   *
   * READ SITE: `renderers/complex/carousel.tsx:30` —
   * `className={schema.itemClassName}` on every `CarouselItem`.
   */
  itemClassName?: string;
  /**
   * Auto-play interval (ms)
   */
  autoPlay?: number;
  /**
   * Show navigation arrows
   * @default true
   */
  showArrows?: boolean;
  /**
   * Show pagination dots
   * @default true
   */
  showDots?: boolean;
  /**
   * Enable infinite loop
   * @default true
   */
  loop?: boolean;
  /**
   * Items visible at once
   * @default 1
   */
  itemsPerView?: number;
  /**
   * Gap between items
   */
  gap?: number;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `carousel` renderer spreads it onto a `<div>` that has no such event (React
   * attaches nothing). The zod twin refuses it by name; author behaviour as a
   * node type (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onSlideChange?: never;
}

/**
 * Chatbot message
 */
export interface ChatMessage {
  /**
   * Unique message identifier
   */
  id: string;
  /**
   * Message role
   */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /**
   * Message content
   */
  content: string;
  /**
   * Message timestamp
   */
  timestamp?: string | Date;
  /**
   * Message metadata
   */
  metadata?: any;
  /**
   * Whether this message is currently being streamed
   */
  streaming?: boolean;
  /**
   * Tool invocations associated with this message (for tool-calling flows)
   */
  toolInvocations?: ChatToolInvocation[];
  /**
   * Chain-of-thought / reasoning text emitted alongside the answer.
   * Surfaced by the chatbot UI as a collapsible "Thoughts" panel.
   */
  reasoning?: string;
  /**
   * Optional citation / RAG sources for this assistant message.
   * Surfaced by the chatbot UI as an inline citation panel.
   */
  sources?: ChatMessageSource[];
  /**
   * Optional backend trace id (e.g. the `ai_traces.id` produced by
   * `@objectstack/service-ai`'s auto-tracing) for "view trace" affordances.
   */
  traceId?: string;
  /**
   * Per-message avatar image URL, overriding the chatbot-level
   * `userAvatarUrl` / `assistantAvatarUrl` for this one message.
   *
   * READ SITE: `packages/plugin-chatbot/src/index.tsx:173–174` —
   * `message.avatar || userAvatarUrl` on a user message and
   * `message.avatar || assistantAvatarUrl` on an assistant one; the
   * authoring-to-runtime seam (`chatMessageAdapter.ts`, `...passthrough`)
   * carries it untouched. Undeclared until objectui#7295: this interface has
   * no index signature (objectui#5155 — and must not gain one), so an author
   * annotating `ChatbotSchema.messages` was told a value that renders is an
   * error (TS2353), and the zod mirror — a plain strip-mode `z.object` —
   * dropped it at parse. objectui#4424's `RuntimeOnlyMessageKeys` named only
   * the three keys API mode lifts out of the stream, never the two a human
   * author writes by hand.
   */
  avatar?: string;
  /**
   * Per-message avatar fallback text (initials), shown when `avatar` is unset
   * or fails to load; overrides the chatbot-level `userAvatarFallback` /
   * `assistantAvatarFallback` for this one message.
   *
   * READ SITE: `packages/plugin-chatbot/src/index.tsx:177–178` —
   * `message.avatarFallback || userAvatarFallback` on a user message and
   * `message.avatarFallback || assistantAvatarFallback` on an assistant one.
   * Same history as `avatar` above (objectui#7295).
   */
  avatarFallback?: string;
}

/**
 * Citation / RAG source attached to a chat message.
 */
export interface ChatMessageSource {
  id?: string;
  title?: string;
  url: string;
}

/**
 * Represents a tool invocation from an AI assistant message
 */
export interface ChatToolInvocation {
  /**
   * Unique tool call identifier
   */
  toolCallId: string;
  /**
   * Name of the tool being invoked
   */
  toolName: string;
  /**
   * Arguments passed to the tool
   */
  args?: Record<string, unknown> | unknown;
  /**
   * Result of the tool invocation (set when complete)
   */
  result?: unknown;
  /**
   * Error text when the tool call ends in an error state.
   */
  errorText?: string;
  /**
   * Tool invocation state. The legacy `partial-call`/`call`/`result` values
   * are kept for back-compat; the AI SDK v6 lifecycle states map cleanly to
   * `input-streaming`/`input-available`/`output-available`/`output-error`
   * and friends and are now accepted directly.
   */
  state?:
    | 'partial-call'
    | 'call'
    | 'result'
    | 'input-streaming'
    | 'input-available'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-available'
    | 'output-error'
    | 'output-denied';
}

/**
 * Chatbot component — the authoring face of the
 * `ComponentRegistry.register('chatbot', ...)` registration in
 * `packages/plugin-chatbot/src/renderer.tsx` (objectui#7655).
 *
 * ## Six ADR-0049 retirement tombstones (objectui#7703)
 *
 * `loading`, `showAvatars`, `userAvatar`, `assistantAvatar`, `markdown` and
 * `height` are `?: never` below, each paired with a `retirementTombstone()`
 * arm on the Zod twin (`zod/complex.zod.ts`). They were declared here,
 * mirrored there, and read by NO registration — a published type teaching six
 * knobs that did nothing.
 *
 * The instrument, re-measured on this branch's base rather than inherited
 * from the card: one `schema.KEY` count per `ComponentRegistry.register(...)`
 * body of `renderer.tsx`, the file split at the three register calls
 * (`chatbot` / `chatbot-enhanced` / `chatbot-floating`). All six read
 * 0 / 0 / 0. Lit controls on the same instrument in the same pass —
 * `placeholder` 1 / 1 / 1, `messages` 1 / 1 / 1, `userAvatarUrl` 1 / 1 / 1,
 * `maxHeight` 1 / 1 / 0, `floatingConfig` 0 / 0 / 1, `processVisibility`
 * 0 / 1 / 0 — so the zeros are readings, not a blind grep.
 *
 * The named-read census is now the WHOLE channel. It was not always: the
 * `chatbot-floating` registration used to end its `<FloatingChatbot>` element
 * with a raw `{...props}` spread, which handed the panel's `<ChatbotEnhanced>`
 * every authored key unfiltered — and that component HAS a `showAvatars` prop,
 * so the key was live there by accident. objectui#7708 ruled FENCE: the spread
 * is filtered through `toDomProps` and moved to the head of the element, the
 * shape the two sibling registrations already used. ⇒ `showAvatars` is a key
 * the FENCE turned dark, not a key nothing ever read; the other five were live
 * on no channel at any time (`loading`, `userAvatar`, `assistantAvatar`,
 * `markdown` and `height` are not `ChatbotEnhancedProps` members either —
 * markdown exists there only as `enableMarkdown` — so the spread had nothing
 * to land them on).
 *
 * ⚠️ `processVisibility` is deliberately NOT part of this retirement:
 * `chatbot-enhanced` reads it (0 / 1 / 0), and objectui#7655 left the member
 * here exactly as it was.
 *
 * ## Why tombstones and not deletions — the mirror decides it here
 *
 * All six HAVE a Zod arm, so deleting the declaration would trade one silent
 * no-op for another: `BaseSchema` is `.passthrough()` on the Zod side and
 * carries a `[key: string]: any` index signature on the TS side, so an
 * UNDECLARED key is not refused, it is KEPT. That is the hazard the two-prong
 * discriminator leaves to the carrier — where there is no mirror there is "no
 * silent-strip hazard for prong 2 to guard" (`mobile.ts`, objectui#5941 /
 * #7526 / #7678: a tombstone exists to steer authors to a named live
 * replacement KEY, or to keep loud a key the docs taught as working). Here
 * there IS a mirror to host the refusal, and prong 1 holds by the letter for
 * four of the six — `userAvatar` → `userAvatarUrl`, `assistantAvatar` →
 * `assistantAvatarUrl`, `height` → `maxHeight`, `markdown` →
 * `enableMarkdown` on a `chatbot-enhanced` node. Each member's own comment
 * names its replacement, or says there is none.
 *
 * ## Why not ENFORCE, decided per key
 *
 * The other arm of enforce-or-remove was taken key by key and refused each
 * time. `<Chatbot>` — the component THIS registration renders
 * (`plugin-chatbot/src/index.tsx`) — declares `messages`, `placeholder`,
 * `onSendMessage`, `disabled`, `showTimestamp`, `userAvatarUrl`,
 * `userAvatarFallback`, `assistantAvatarUrl`, `assistantAvatarFallback` and
 * `maxHeight`, and not one of the six. Enforcing any of them would mean
 * growing a component prop (a feature, not a retirement) or wiring a SECOND
 * spelling of a key that already works — the N dialects AGENTS.md #0.1
 * forbids. Per-key argument in each member's comment.
 *
 * Pinned in `__tests__/chatbot-dark-keys-retired-7703.test.ts`.
 */
export interface ChatbotSchema extends BaseSchema {
  type: 'chatbot';
  /**
   * Chat messages
   */
  messages: ChatMessage[];
  /**
   * Input placeholder
   * @default 'Type a message...'
   */
  placeholder?: string;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `loading` (objectui#7703). See
   * {@link ChatbotSchema} for the census, the instrument and the route.
   *
   * Chat progress is RUNTIME state, not authorable metadata. The `chatbot`
   * registration derives it from `useObjectChat` as `isLoading` and spends it
   * on `disabled={hostDisabled || isLoading}`; `<Chatbot>` declares no
   * `loading` prop for an authored value to land on. So `loading: true` never
   * showed a spinner and `loading: false` never hid one.
   *
   * ENFORCE was refused here on the classification, not only on the missing
   * prop: an authored boolean would be a static declaration of a value the
   * chat runtime owns and updates per token — it would fight the runtime, not
   * configure it (AGENTS.md #8: state that a refresh must survive never lives
   * in metadata that cannot see the refresh).
   *
   * There is NO replacement key: nothing authorable selects this. Delete it.
   *
   * @deprecated Not part of this contract — the value was inert. Loading is
   * derived from the chat runtime.
   */
  loading?: never;
  /**
   * RETIRED (objectui#6124, ADR-0049) — JSON has no function value, and the
   * `chatbot` renderer wires its own `handleSendMessage` and `toDomProps` drops
   * the key. The zod twin refuses it by name; author behaviour as a node type
   * (`{ "type": "toast" }`, an `action:button` node) instead.
   * @deprecated Not part of this contract — the value was inert.
   */
  onSendMessage?: never;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `showAvatars` (objectui#7703). See
   * {@link ChatbotSchema} for the census, the instrument and the route.
   *
   * ⭐ The one key of the six whose provenance is a FENCE, not an absence.
   * `<ChatbotEnhanced>` really does have a `showAvatars` prop, and until
   * objectui#7708 the `chatbot-floating` registration's raw trailing
   * `{...props}` spread delivered an authored value straight to it — measured
   * live through the real host. That ruling was FENCE: the spread now goes
   * through `toDomProps` at the head of the element, so the key is dark on all
   * three registrations by ruling. It was never live on a `chatbot` node: no
   * registration forwards it by name, and this one renders `<Chatbot>`, which
   * has no such prop — the card's own counter-example, re-confirmed here.
   *
   * ENFORCE was refused: on a `chatbot` node it has no target to forward to,
   * and re-declaring it on the two faces that CAN reach `<ChatbotEnhanced>`
   * would re-open by declaration exactly the channel objectui#7708 closed by
   * fence, one card earlier. `@default true` was published prose only — the
   * plain `<Chatbot>` renders an avatar beside every message unconditionally,
   * with no gate, and `<ChatbotEnhanced>`'s own prop defaults to `false`.
   *
   * There is no replacement KEY. The avatar IMAGES are `userAvatarUrl` /
   * `assistantAvatarUrl` and their `*Fallback` siblings, which all three
   * registrations read; delete this one.
   *
   * @deprecated Not part of this contract — the value was inert on a `chatbot`
   * node and is dark everywhere since objectui#7708.
   */
  showAvatars?: never;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `userAvatar` (objectui#7703). See
   * {@link ChatbotSchema} for the census, the instrument and the route.
   *
   * Write **`userAvatarUrl`** (with `userAvatarFallback` for the text shown
   * while it loads or fails) — the live spelling, read 1 / 1 / 1 and declared
   * on all three faces through {@link ChatbotSharedKey}. `userAvatar` has zero
   * word-boundary hits anywhere in `packages/plugin-chatbot/src`: not a stale
   * read, a spelling no code ever had.
   *
   * ENFORCE was refused: wiring it would give one avatar image TWO authorable
   * spellings, the second de-facto contract AGENTS.md #0.1 exists to stop.
   *
   * @deprecated Not part of this contract — the value was inert. Write
   * `userAvatarUrl`.
   */
  userAvatar?: never;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `assistantAvatar` (objectui#7703). See
   * {@link ChatbotSchema} for the census, the instrument and the route.
   *
   * Write **`assistantAvatarUrl`** (with `assistantAvatarFallback`) — the live
   * spelling, read 1 / 1 / 1 and declared on all three faces through
   * {@link ChatbotSharedKey}. `assistantAvatar` has zero word-boundary hits
   * anywhere in `packages/plugin-chatbot/src`.
   *
   * ENFORCE was refused for the same reason as `userAvatar`: a second
   * authorable spelling of one image is a second contract.
   *
   * @deprecated Not part of this contract — the value was inert. Write
   * `assistantAvatarUrl`.
   */
  assistantAvatar?: never;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `markdown` (objectui#7703). See
   * {@link ChatbotSchema} for the census, the instrument and the route.
   *
   * The `chatbot` node renders `<Chatbot>`, which has no markdown path at all:
   * it prints message content as text, so there was never a renderer for this
   * switch to reach. Markdown is a `chatbot-enhanced` / `chatbot-floating`
   * capability, where the live spelling is **`enableMarkdown`** on
   * {@link ChatbotEnhancedSchema} / {@link ChatbotFloatingSchema} (read
   * 0 / 1 / 1). `markdown` is not a `ChatbotEnhancedProps` member either.
   *
   * ENFORCE was refused twice over: on this node it would mean building a
   * markdown renderer into `<Chatbot>` (a feature), and on the other two it
   * would be a second spelling of `enableMarkdown`. `@default true` was
   * published prose the plain component never honoured.
   *
   * @deprecated Not part of this contract — the value was inert. Author
   * `type: 'chatbot-enhanced'` with `enableMarkdown` instead.
   */
  markdown?: never;
  /**
   * How much agent reasoning/tool detail to show.
   * @default 'summary'
   */
  processVisibility?: 'hidden' | 'summary' | 'debug';
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `height` (objectui#7703). See
   * {@link ChatbotSchema} for the census, the instrument and the route.
   *
   * Write **`maxHeight`** (a CSS length string, default `'500px'`) — the live
   * spelling, read 1 / 1 / 0 and forwarded to `<Chatbot>`'s own `maxHeight`
   * prop. On a `chatbot-floating` node neither key applies: size that panel
   * with `floatingConfig.panelHeight`, a NUMBER of pixels, which is what the
   * panel reads.
   *
   * ENFORCE was refused: `<Chatbot>` has no `height` prop, and adding one
   * beside the `maxHeight` it already forwards would publish two authorable
   * spellings for one dimension — with a `string | number` union that does not
   * even match the live key's `string`.
   *
   * @deprecated Not part of this contract — the value was inert. Write
   * `maxHeight`, or `floatingConfig.panelHeight` on a floating node.
   */
  height?: never;

  // --- AI / service-ai integration fields ---

  /**
   * Backend API endpoint for chat (e.g., '/api/v1/ai/chat').
   * When set, the chatbot uses streaming SSE via the vercel/ai SDK.
   * When not set, the chatbot falls back to local auto-response mode (legacy/demo).
   */
  api?: string;
  /**
   * Conversation ID for multi-turn context.
   * Sent to the backend as an `x-conversation-id` HTTP header.
   */
  conversationId?: string;
  /**
   * System prompt to configure assistant behavior.
   */
  systemPrompt?: string;
  /**
   * AI model identifier (e.g., 'gpt-4o', 'claude-3-opus').
   */
  model?: string;
  /**
   * Whether streaming is enabled for AI responses.
   * @default true
   */
  streamingEnabled?: boolean;
  /**
   * Additional headers to send with API requests (e.g., auth tokens).
   */
  headers?: Record<string, string>;
  /**
   * Additional body parameters to include with each API request.
   */
  requestBody?: Record<string, unknown>;
  /**
   * Maximum number of tool-calling round-trips per user message.
   *
   * @deprecated objectui#5605 — INERT, and not fixable from here. The renderer
   * really does thread this value into `useObjectChat`, which then drops it:
   * the installed chat runtime (`@ai-sdk/react`'s `useChat`) exposes no
   * client-side round-trip cap — the numeric knob was removed from `useChat`,
   * and its successor step cap (`stopWhen` / `stepCountIs`) exists only on the
   * server-side call functions. ObjectUI is backend-agnostic, so it does not
   * own a server loop to cap either. Setting this has never limited anything.
   *
   * Cap tool-calling loops on the agent instead — `planning.maxIterations`,
   * which the platform spec declares and enforces.
   *
   * Still declared and still accepted so documents that already author it keep
   * parsing; authoring it now logs a one-time notice from the chatbot plugin.
   * Slated for removal in a future major (ADR-0049 enforce-or-remove, staged).
   */
  maxToolRoundtrips?: number;
  /**
   * Callback when an error occurs during streaming or API calls.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * forwarded by `plugin-chatbot` into `useObjectChat({ onError })`.
   */
  onError?: (error: Error) => void;

  // --- Local display + legacy auto-response fields (objectui#6169) ---
  //
  // Lifted from an anonymous inline intersection that used to live ONLY at
  // `packages/plugin-chatbot/src/renderer.tsx`'s `chatbot` registration site
  // (`ComponentRegistry.register('chatbot', ...)`), where nothing outside
  // that one file could reference, validate, or document them. Each key
  // below was read-site-censused before being declared here — every one has
  // a live reader in `renderer.tsx` and/or `useObjectChat.ts`; none were
  // dead. `disabled` is deliberately NOT redeclared in this group: it is
  // already `BaseSchema.disabled` (`boolean | string`), read generically by
  // `SchemaRenderer` for every node type, not specific to `chatbot`.

  /**
   * Display a timestamp on each message.
   * @default false
   */
  showTimestamp?: boolean;
  /**
   * URL of the user's avatar image.
   */
  userAvatarUrl?: string;
  /**
   * Fallback text shown when `userAvatarUrl` is not set or fails to load.
   * @default 'You'
   */
  userAvatarFallback?: string;
  /**
   * URL of the assistant's avatar image.
   */
  assistantAvatarUrl?: string;
  /**
   * Fallback text shown when `assistantAvatarUrl` is not set or fails to load.
   * @default 'AI'
   */
  assistantAvatarFallback?: string;
  /**
   * Maximum height of the chat message container (CSS value).
   * @default '500px'
   */
  maxHeight?: string;
  /**
   * Enable local auto-response (demo/playground) mode. Ignored once `api`
   * is set — API mode replaces the local echo entirely.
   * @default false
   */
  autoResponse?: boolean;
  /**
   * The text of the local auto-response, used when `autoResponse` is true.
   */
  autoResponseText?: string;
  /**
   * Delay in milliseconds before the local auto-response is sent.
   * @default 1000
   */
  autoResponseDelay?: number;
  /**
   * Called after a message is sent, in both API and local auto-response mode,
   * with the trimmed content and the full message list at that point.
   * `messages` here is the same authoring-side {@link ChatMessage} shape as the
   * `messages` field above; the plugin's own runtime message type is a
   * structural superset (objectui#4424) and still satisfies a handler typed
   * against this narrower, published shape.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because it is
   * forwarded by `plugin-chatbot` into `useObjectChat({ onSend })`.
   */
  onSend?: (content: string, messages: ChatMessage[]) => void;

  // --- Floating / FAB configuration ---

  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `displayMode` (objectui#7654, maintainer
   * ruling B, 2026-09-05). Write the node `type` instead: `'chatbot-floating'`
   * for the trigger-and-panel presentation, `'chatbot'` / `'chatbot-enhanced'`
   * for an inline one. The node's `type` is the one selector of presentation;
   * this key was a second spelling of that choice that no renderer has ever
   * read.
   *
   * What was measured, on the retiring PR's base: `displayMode` was declared
   * here and on {@link ChatbotFloatingSchema}, offered as a "Display Mode"
   * control in the `chatbot-floating` registration's `inputs`, and seeded as
   * `'floating'` by that registration's `defaultProps` — and read by nothing.
   * `chatbot-floating` renders `<FloatingChatbot>` unconditionally and
   * `chatbot` never looked at the key, so `'floating'` on a `chatbot` node
   * produced no trigger and `'inline'` on a `chatbot-floating` node changed
   * nothing. A whole-repo `git grep` census over tracked files, build output
   * excluded, returned those sites, the doc comments and ledger entries beside
   * them, one historical CHANGELOG line and two unrelated `displayMode` props
   * (`GridField`, `MasterDetailForm`); the same pass over `floatingConfig`, a
   * key that IS read, returned 79 lines, so the instrument was not blind. The
   * control and the seed are removed in the same change; the restatement of
   * that control is this tombstone plus the release note (objectui#7070: a
   * control is restated, never deleted into a vacuum).
   *
   * ## Why a tombstone — discriminator prong 2 — and why it is loud-vs-silent here
   *
   * A `?: never` tombstone is available only on a surviving carrier
   * (`ChatbotSchema` survives) and is used when either prong of this package's
   * discriminator holds: it steers authors to a named live replacement KEY,
   * or it keeps loud a key the docs taught as working. Prong 2 holds: the key
   * was advertised in the 3.3.0 release record (`CHANGELOG.md:578`, "Extended
   * `ChatbotSchema` with `displayMode` (`'inline' | 'floating'`) …") and its
   * published comment told authors it selected the presentation. Prong 1 is
   * not met by the letter — the replacement is the discriminant `type`, not a
   * new key — which is why the guidance above names `type`.
   *
   * On a carrier extending {@link BaseSchema} — every component schema in this
   * package — deleting an optional member is SILENT in every value shape,
   * because the `[key: string]: any` index signature defeats both
   * excess-property checking and the weak-type check. Measured on THIS member
   * with `tsc -p tsconfig.test.json`, a no-index-signature control carrier
   * (`FloatingChatbotConfig`) lit in the same run (TS2353 on a fresh undeclared
   * key, TS2559 on a lone-key widened value):
   *
   *   | route      | fresh `'floating'` | fresh `'bogus'` | widened `'floating'` |
   *   |------------|--------------------|-----------------|----------------------|
   *   | declared   | clean              | TS2322          | clean                |
   *   | DELETED    | clean              | clean           | clean                |
   *   | TOMBSTONED | TS2322             | TS2322          | TS2322               |
   *
   * Deleted, the member reads as `any` through the index signature and even a
   * wrong-typed value goes quiet. Tombstoned, PRESENCE with any value is a
   * compile error — a channel deletion cannot produce on this carrier at all:
   * on a `BaseSchema` carrier the two routes are loud-vs-silent, not
   * louder-vs-quieter. Pinned, the deleted row included as a live control, in
   * `__tests__/chatbot-display-mode-retired.test.ts`.
   *
   * ## Runtime: unchanged, deliberately — zero validation before and after
   *
   * There is NO `retirementTombstone()` half. `displayMode` has never had a
   * Zod arm: it sits in the `UnmirroredDeclared` ledger for both
   * `complex.zod.ts#ChatbotSchema` and `#ChatbotFloatingSchema`
   * (`__tests__/zod-mirror-parity.test.ts`), and `BaseSchema` is
   * `.passthrough()`, so a stored document carrying `displayMode: 'floating'`
   * — every node the designer ever created — parsed green before this change
   * and parses green after it, and the value is dropped at render time as it
   * always was. Minting an arm to refuse it would be the declared-but-
   * unmirrored axis (objectui#6152); the retirement test pins both twins'
   * shapes as a tripwire so that whoever mints the mirror adds the
   * `retirementTombstone()` half at that time.
   *
   * @deprecated Not part of this contract — the value was inert. The node
   * `type` selects the presentation.
   */
  displayMode?: never;

  /**
   * Configuration for the floating action button and the panel it opens —
   * read by `chatbot-floating` alone and forwarded to `<FloatingChatbot>`.
   */
  floatingConfig?: FloatingChatbotConfig;
}

/**
 * The chat-surface keys that ALL THREE `plugin-chatbot` registrations read
 * (objectui#7655) — the members {@link ChatbotEnhancedSchema} and
 * {@link ChatbotFloatingSchema} pick off {@link ChatbotSchema} by name, so the
 * three faces share ONE declaration and ONE doc comment per key.
 *
 * Every member was read-site-censused per registration on the PR's base: one
 * NAMED `schema.KEY` read in each of the three `ComponentRegistry.register(...)`
 * bodies of `packages/plugin-chatbot/src/renderer.tsx`, forwarded into
 * `useObjectChat` or onto the rendered component. (Named reads are the
 * instrument; the `chatbot-floating` registration also HAD an unfiltered
 * props spread on this census's base — fenced since, objectui#7708; see
 * {@link ChatbotFloatingSchema}.) The instrument was lit by
 * keys that are NOT shared — `processVisibility` read 0 / 1 / 0 across
 * `chatbot` / `chatbot-enhanced` / `chatbot-floating` and `floatingConfig`
 * 0 / 0 / 1 — so a zero in that census is a reading, not a blind grep.
 *
 * Exported only because an exported interface may not extend a `Pick` over a
 * private name (TS4022). It is a census, not an authoring face, and it is not
 * re-exported from the package entry: the node types are.
 */
export type ChatbotSharedKey =
  | 'messages'
  | 'placeholder'
  | 'api'
  | 'conversationId'
  | 'systemPrompt'
  | 'model'
  | 'streamingEnabled'
  | 'headers'
  | 'requestBody'
  | 'maxToolRoundtrips'
  | 'onError'
  | 'showTimestamp'
  | 'userAvatarUrl'
  | 'userAvatarFallback'
  | 'assistantAvatarUrl'
  | 'assistantAvatarFallback'
  | 'autoResponse'
  | 'autoResponseText'
  | 'autoResponseDelay'
  | 'onSend';

/**
 * `chatbot-enhanced` component — the authoring face of the
 * `ComponentRegistry.register('chatbot-enhanced', ...)` registration in
 * `packages/plugin-chatbot/src/renderer.tsx` (objectui#7655, under the
 * objectui#6169 / #6172 family ruling: every component node has exactly one
 * named, importable authoring-face type).
 *
 * Until objectui#7655 this node had no importable type: {@link ChatbotSchema}
 * pins `type` to `'chatbot'`, so an author either dropped to untyped JSON or
 * annotated with `ChatbotSchema` and lied about `type`. The registration's
 * parameter type was an anonymous `ChatbotSchema & { ... }` intersection
 * local to the renderer, referenceable by nothing outside that file.
 *
 * What is declared here is what THIS registration reads — censused per key on
 * the PR's base, not copied off `ChatbotSchema`:
 *
 *   - the twenty {@link ChatbotSharedKey} members every registration reads;
 *   - `maxHeight` and `processVisibility`, which `chatbot-enhanced` forwards to
 *     `<ChatbotEnhanced>` by name and `chatbot-floating` has no named read for
 *     (its panel is sized by `floatingConfig.panelHeight`; for the second,
 *     unnamed channel on that registration see {@link ChatbotFloatingSchema});
 *   - `enableMarkdown`, `enableFileUpload`, `surface` and the `onClear`
 *     runtime slot, which `ChatbotSchema` never declared.
 *
 * NOT declared, on purpose: `loading`, `showAvatars`, `userAvatar`,
 * `assistantAvatar`, `markdown` and `height` — `ChatbotSchema` members this
 * registration has no read for. `disabled` and `className` are inherited from
 * {@link BaseSchema}: `SchemaRenderer` evaluates `disabled` / `disabledOn`
 * for every node type and hands the verdict to the registration as a prop, so
 * redeclaring `disabled` here as `boolean` would only narrow away the
 * expression-string half of an inherited field (objectui#6169, #7087).
 */
export interface ChatbotEnhancedSchema
  extends BaseSchema,
    Pick<ChatbotSchema, ChatbotSharedKey | 'maxHeight' | 'processVisibility'> {
  type: 'chatbot-enhanced';
  /**
   * Render assistant messages as markdown. Forwarded to `<ChatbotEnhanced>`'s
   * `enableMarkdown` prop; an unauthored value falls back to `true` at the
   * registration (`schema.enableMarkdown ?? true`).
   * @default true
   */
  enableMarkdown?: boolean;
  /**
   * Show the file-attachment control in the composer. Forwarded to
   * `<ChatbotEnhanced>`'s `enableFileUpload` prop; an unauthored value falls
   * back to `false` at the registration.
   * @default false
   */
  enableFileUpload?: boolean;
  /**
   * Visual chrome for the chat surface (objectui#6687, maintainer ruling
   * 2026-08-29). `'card'` keeps the embeddable bordered panel; `'plain'`
   * removes the panel chrome for a full-page chat workspace. Declared on this
   * node only: `chatbot-enhanced` is the one registration that renders
   * `<ChatbotEnhanced>` and has a `surface` prop to forward it to. Passed
   * through `undefined` when unauthored, so the component's own `'card'`
   * default keeps applying.
   *
   * The plugin's `ChatbotSurface` alias (`@object-ui/plugin-chatbot`) is the
   * component-side spelling of this same union; the plugin's tests pin the
   * two equal so they cannot drift into two dialects (AGENTS.md #0.1).
   * @default 'card'
   */
  surface?: 'card' | 'plain';
  /**
   * Called after the conversation is cleared through the composer's clear
   * control, once the chat runtime has dropped its messages.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata: JSON has no function value, so the zod twin refuses this key by
   * name and points at the node-type spelling. Kept callable here because
   * `plugin-chatbot`'s `handleClear` invokes `schema.onClear?.()`.
   */
  onClear?: () => void;
}

/**
 * `chatbot-floating` component — the authoring face of the
 * `ComponentRegistry.register('chatbot-floating', ...)` registration
 * (objectui#7655; same ruling and same census discipline as
 * {@link ChatbotEnhancedSchema}). The floating-action-button presentation: a
 * trigger in a page corner that opens a chat panel overlay.
 *
 * Declared here is what THIS registration reads by name (`schema.KEY`),
 * censused per key on the PR's base:
 *
 *   - the twenty {@link ChatbotSharedKey} members;
 *   - `enableMarkdown`, `enableFileUpload` and the `onClear` runtime slot,
 *     forwarded into the panel's `<ChatbotEnhanced>`;
 *   - `floatingConfig`, the trigger and panel geometry
 *     ({@link FloatingChatbotConfig}) — ALSO declared on {@link ChatbotSchema},
 *     unchanged there — and `displayMode`, a `?: never` tombstone on both
 *     faces since objectui#7654; see each member's comment.
 *
 * NOT declared, on purpose: `maxHeight` (the panel pins its inner chat to
 * `100%` of `floatingConfig.panelHeight` AFTER any forwarded value, so an
 * authored `maxHeight` is dead here), `processVisibility` and `surface` (no
 * named read in this registration), and the six `ChatbotSchema` legacy
 * members no registration reads by name. `disabled` / `className` are
 * inherited from {@link BaseSchema}, as on the two sibling faces.
 *
 * The named-read census used to not be the only channel: this registration
 * ended its `<FloatingChatbot>` element with a raw `{...props}` spread —
 * every authored key `SchemaRenderer` forwards, unfiltered — and the panel
 * is a `<ChatbotEnhanced>`, so an authored `processVisibility`, `surface` or
 * `showAvatars` reached it (measured through the real host, objectui#7708).
 * That channel was accidental, not contract, and is now CLOSED: the spread
 * is fenced through `toDomProps` and moved to the head of the element, the
 * same shape the two sibling registrations already use, so this face's
 * declared set is now also its delivered set. `processVisibility` and
 * `surface` are dark on `chatbot-floating` on purpose, same as `showAvatars`
 * above — author them on `chatbot-enhanced` instead.
 */
export interface ChatbotFloatingSchema
  extends BaseSchema,
    Pick<ChatbotSchema, ChatbotSharedKey> {
  type: 'chatbot-floating';
  /**
   * Render assistant messages as markdown inside the panel. Forwarded to the
   * panel's `enableMarkdown` prop; an unauthored value falls back to `true` at
   * the registration.
   * @default true
   */
  enableMarkdown?: boolean;
  /**
   * Show the file-attachment control in the panel's composer. Forwarded to
   * the panel's `enableFileUpload` prop; an unauthored value falls back to
   * `false` at the registration.
   * @default false
   */
  enableFileUpload?: boolean;
  /**
   * Called after the conversation is cleared through the panel's clear
   * control, once the chat runtime has dropped its messages.
   *
   * RUNTIME SLOT (objectui#6124) — a host-supplied function, NOT authorable
   * metadata; the zod twin refuses it by name. Kept callable here because
   * `plugin-chatbot`'s `handleClear` invokes `schema.onClear?.()`.
   */
  onClear?: () => void;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — the same `displayMode` retirement as
   * {@link ChatbotSchema.displayMode} (objectui#7654, maintainer ruling B,
   * 2026-09-05); the rationale, the measurements and the runtime note live
   * there, once. Declared here as well because objectui#7655 put the member on
   * this face with `ChatbotSchema`'s own three lines so the retirement would
   * find it on both faces — and because this is the face of the one
   * registration that offered the control: a `chatbot-floating` node IS the
   * floating presentation, so there is nothing left for this key to select.
   * `type: 'chatbot-floating'` is the whole spelling.
   * @deprecated Not part of this contract — the value was inert. The node
   * `type` selects the presentation.
   */
  displayMode?: never;
  /**
   * Configuration for the floating action button and the panel it opens —
   * read by `chatbot-floating` alone and forwarded to `<FloatingChatbot>`.
   */
  floatingConfig?: FloatingChatbotConfig;
}

/**
 * Configuration for the floating chatbot FAB widget.
 */
export interface FloatingChatbotConfig {
  /**
   * Position of the FAB trigger button.
   * @default 'bottom-right'
   */
  position?: 'bottom-right' | 'bottom-left';
  /**
   * Whether the panel is open by default on mount.
   * @default false
   */
  defaultOpen?: boolean;
  /**
   * Width of the floating panel.
   * @default 400
   */
  panelWidth?: number;
  /**
   * Height of the floating panel.
   * @default 520
   */
  panelHeight?: number;
  /**
   * Title displayed in the panel header.
   * @default 'Chat'
   */
  title?: string;
  /**
   * ADR-0049 RETIREMENT TOMBSTONE — `triggerIcon` (objectui#7654).
   *
   * `?: never` is this package's tombstone convention (see {@link
   * ComponentInput} in `base.ts`, `crud.ts` `confirm`, and {@link
   * StaticTableColumn} in `data-display.ts`): the key stays DECLARED and
   * becomes UNWRITABLE, so authoring one is a `tsc` error here.
   *
   * What was measured, on the merge-base of the retiring PR: nothing reads it.
   * `FloatingChatbot` (`plugin-chatbot/src/FloatingChatbot.tsx`) destructures
   * six of this interface's seven keys — `position`, `defaultOpen`,
   * `panelWidth`, `panelHeight`, `title`, `triggerSize` — and never this one;
   * `FloatingChatbotTrigger` takes no icon prop at all, so the promised
   * `'MessageCircle'` default never rendered either. A whole-repo `git grep`
   * census over tracked files, build output excluded, returned exactly this
   * declaration and one historical CHANGELOG line; the same pass over
   * `triggerSize`, a key that IS read, returned ten sites across four files, so
   * the instrument was demonstrably not blind.
   *
   * It is also absent from the `chatbot-floating` registration's `inputs` AND
   * its `defaultProps` (`plugin-chatbot/src/renderer.tsx`), so no designer
   * control ever offered it and no designer-created node carries it. The key
   * was reachable from TypeScript alone — which is exactly the surface this
   * tombstone closes.
   *
   * ## Why there is NO `retirementTombstone()` half, and why that is not an omission
   *
   * The other tombstones in this package pair `?: never` with a
   * `retirementTombstone()` refusal on the Zod twin. There is no twin to carry
   * one here: `FloatingChatbotConfig` has NO Zod mirror at all, and
   * `floatingConfig` sits in the `UnmirroredDeclared` ledger
   * (`__tests__/zod-mirror-parity.test.ts`, `complex.zod.ts#ChatbotSchema`).
   * `BaseSchema` is `.passthrough()`, so the whole `floatingConfig` object
   * rides through unvalidated — before this change and after it, byte for
   * byte. Minting a mirror to host a refusal would be the declared-but-
   * UNMIRRORED axis (objectui#6152), a different defect from this one: a key
   * can be mirrored and inert, or unmirrored and live, and fixing one says
   * nothing about the other. This retirement deliberately does not widen into
   * it, so `triggerIcon`'s refusal is TYPE-LEVEL ONLY. Runtime parse behaviour
   * is unchanged.
   *
   * ## Why a tombstone and not a deletion, with only the `tsc` channel available
   *
   * The usual argument for `?: never` over deletion is about the mirror (an
   * undeclared key is silently STRIPPED by a non-strict `z.object`), and with
   * no mirror here that argument does not apply. The tombstone earns its place
   * on the TypeScript channel alone instead, measured both ways:
   *
   *   - DELETED, a fresh object literal is refused — `TS2353: Object literal
   *     may only specify known properties` — but a WIDENED value is not.
   *     `const raw = { triggerIcon: 'Sparkles' }; const c: FloatingChatbotConfig
   *     = raw;` compiled CLEAN, because excess-property checking does not reach
   *     a non-fresh type. That is the silent no-op traded for another one.
   *   - TOMBSTONED, both paths are refused: the declared `never` makes the
   *     assignment itself ill-typed, so freshness stops mattering.
   *
   * Pinned in `__tests__/floating-chatbot-trigger-icon-retired.test.ts`,
   * including the deletion contrast, so nobody can "simplify" this back into a
   * deletion without that file going red.
   *
   * RETIRED (objectui#7654, ADR-0049) — never read: the FAB trigger renders a
   * fixed icon and takes no icon prop. There is no authored spelling that
   * changes it; the trigger's markup is the only place to change it.
   * @deprecated Not part of `FloatingChatbotConfig`'s contract — the value was inert.
   */
  triggerIcon?: never;
  /**
   * Custom size for the FAB trigger button in pixels.
   * @default 56
   */
  triggerSize?: number;
}

/**
 * objectui COMPONENT types admitted into a dashboard **widget slot** — the
 * CLOSED enum the maintainer ruling of 2026-08-14 (objectstack#8593) directs
 * `metric-card` into, verbatim: *an SDUI dashboard COMPONENT node validates
 * against objectui's own component schema; the spec's `DashboardSchema` governs
 * stored dashboard metadata documents only and grows no component projection;
 * `metric-card` joins objectui's own CLOSED component enum as an explicitly
 * allowed objectui extension, NOT the spec widget enum.*
 *
 * A member here is not a visualization family at all. `classifyWidgetType`
 * (`@object-ui/plugin-dashboard`'s `widgetDispatch.ts`) returns `passthrough`
 * for it, and `DashboardRenderer` then hands `{ ...widget }` straight to
 * `SchemaRenderer`, which resolves it through `ComponentRegistry` — so the
 * widget slot is holding an ordinary objectui SDUI **component node** whose
 * other keys are that component's own props (`value` / `icon` / `trend` /
 * `trendValue` for `metric-card`, declared as registry `inputs` at
 * `plugin-dashboard/src/index.tsx`). Those props are NOT widget keys and must
 * not be added to {@link DashboardWidgetSchema}; a member of this list is
 * validated as a component node against objectui's own passthrough
 * `BaseSchema`, which is what keeps them. On the TypeScript face that node is
 * {@link DashboardWidgetSlotComponentSchema}, the component arm — first, as
 * in the Zod twin — of `DashboardComponentSchema.widgets` (objectui#7952).
 *
 * ⛔ CLOSED on purpose. The ruling's triage block named an open
 * "extension allowed" hatch as the thing to avoid: an open hatch re-creates
 * exactly the hole the catalog gate exists to close, because a typo'd or
 * retired `type` would keep validating. Adding a member is a deliberate act
 * with a registration behind it — `examples/schema-catalog/test/
 * plugin-dashboard-component-schema.test.ts` is the standing gate, and
 * `__tests__/report-chart-query-spec-parity.test.ts` pins the closure.
 */
export const DASHBOARD_COMPONENT_WIDGET_TYPES = ['metric-card'] as const;

/** An objectui component type legal in a dashboard widget slot. */
export type DashboardComponentWidgetType = (typeof DASHBOARD_COMPONENT_WIDGET_TYPES)[number];

/**
 * objectui-only widget FAMILIES — visualization families objectui renders that
 * `@objectstack/spec`'s `ChartTypeSchema` does not model. Distinct from
 * {@link DASHBOARD_COMPONENT_WIDGET_TYPES} above: these two really are widget
 * types (`classifyWidgetType` routes `list` to the table family and `custom` to
 * the author-supplied-`component` branch), they just have no spec counterpart.
 *
 * The pre-existing divergence, previously carried only as prose on the `type`
 * key ("widened off the spec's enum") and enforced nowhere. If the spec adopts
 * either family, drop it from here and let it flow in from the spec enum.
 */
export const DASHBOARD_WIDGET_TYPE_EXTENSIONS = ['list', 'custom'] as const;

/** An objectui-only dashboard widget family. */
export type DashboardWidgetTypeExtension = (typeof DASHBOARD_WIDGET_TYPE_EXTENSIONS)[number];

/**
 * The CLOSED vocabulary a dashboard widget's `type` may name.
 *
 * The spec half flows in BY REFERENCE (`SpecDashboardWidget['type']`, i.e. the
 * spec's `ChartTypeSchema`) rather than being restated, so a family the spec
 * adds or retires lands here with no edit — the same discipline
 * {@link DashboardWidgetSchema} already uses for its key set. objectui's own
 * two extension sets are spelled out above, each with its own reason.
 *
 * This used to be bare `string`. That was the open hatch: `type: 'metrci-card'`
 * type-checked, validated, and rendered the registry's red OBJUI-001 panel —
 * and `examples/schema-catalog` is an AI few-shot retrieval source, so what it
 * shows is what gets copied.
 *
 * Zod twin: `zod/complex.zod.ts` `DashboardWidgetTypeSchema`.
 */
export type DashboardWidgetTypeName =
  | NonNullable<SpecDashboardWidget['type']>
  | DashboardWidgetTypeExtension
  | DashboardComponentWidgetType;

/**
 * Dashboard Widget Layout
 */
export interface DashboardWidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Dashboard Widget — DERIVED from `@objectstack/spec/ui`'s `DashboardWidget`
 * (objectstack#4115): every spec key it does not override flows in through the
 * `extends` above, so the key set tracks the protocol instead of being restated.
 *
 * Supports two formats:
 * 1. **Component format** (legacy): `{ id, component: { type, ... }, layout }`
 * 2. **Shorthand format** (@objectstack/spec): `{ type: 'metric'|'bar'|…, options: {…}, layout }`
 *
 * `Partial<>` because the spec requires `id` while stored objectui dashboards
 * (and every widget in the legacy component format) omit it. The `Omit` list is
 * the set of keys objectui deliberately re-types, each explained at its
 * declaration below; anything not listed there is the spec's.
 *
 * Zod twin: `zod/complex.zod.ts` `DashboardWidgetSchema`.
 * Drift guard: `__tests__/report-chart-query-spec-parity.test.ts`.
 */
export interface DashboardWidgetSchema
  extends Omit<Partial<SpecDashboardWidget>, 'type' | 'options' | 'chartConfig' | 'filter'> {
  // `id`, `title`, `description`, `colorVariant`, `dataset`, `dimensions`,
  // `values`, `filterBindings`, `requiresObject`, `requiresService`,
  // `compareTo`, … all flow in from the spec through the `extends` above — do
  // not restate them here.
  //
  // `actionUrl`, `actionType`, `actionIcon` and `aria` flow in too, but as
  // RETIRED keys: @objectstack/spec 17.0.0-rc.3 (objectstack#5010, ADR-0049 D2)
  // turned them into `retiredKey` tombstones, so the spec types them `never`
  // and the Zod twin refuses any value. They inherit as `?: never` — authoring
  // one is a tsc error here and a parse error at validation. Reading one still
  // type-checks (`never | undefined`), which is how objectui's widget config
  // panel kept producing `actionUrl` until objectstack#7129. A dashboard
  // widget's click-through affordance lives in `header.actions[]`, whose own
  // `actionUrl` is unrelated and still live.
  //
  // `responsive` inherits the same way, from a SEPARATE retirement:
  // @objectstack/spec 17.0.0-rc.6 (objectstack#4876, ADR-0049 D2) — so its
  // tombstone message differs from the four above. It was re-typed `any` here
  // on the stated grounds that "the renderer reads a per-breakpoint record";
  // objectui#3173's measurement found zero `widget.responsive` read points in
  // the whole repo and zero authored occurrences in either corpus, so that
  // premise was false and the override only made TS accept a key the Zod twin
  // already refused. ⚠️ This note used to add that the shared `ResponsiveConfig`
  // shape was "NOT gone — it stays live on `page.components[].responsive`,
  // which `useResponsiveConfig` really does read". Both halves of that have
  // since expired and it is corrected rather than left standing, because a
  // stale liveness claim is what the next agent reads as the measurement:
  // objectstack#11027 retired `ResponsiveConfigSchema` outright (the census
  // behind it measured `page.components[].responsive` inert), and objectui#7580
  // deleted `useResponsiveConfig` with it at zero callers. What survives the
  // retirement is the BREAKPOINT vocabulary, re-homed into `@object-ui/types`
  // and `@object-ui/layout` because `responsive-grid` renders it — not this key.
  // Pinned by `__tests__/report-chart-query-spec-parity.test.ts`.
  /** Component schema (legacy format) — objectui-only, no spec counterpart. */
  component?: SchemaNode;
  layout?: DashboardWidgetLayout;
  /**
   * Widget visualization type (spec shorthand format), or an objectui component
   * type the widget slot holds directly.
   *
   * CLOSED — see {@link DashboardWidgetTypeName}. The spec's families flow in by
   * reference; objectui's additions are the two named, closed extension sets.
   * It was `string` until objectui#4600, which is why a retired family, a typo,
   * or a component type nothing registers all type-checked here and only
   * surfaced as the renderer's red OBJUI-001 panel at runtime.
   */
  type?: DashboardWidgetTypeName;
  /** Widget-specific configuration (spec shorthand format). Kept `unknown` — objectui
   *  renderers pass widget-family-specific bags the spec's `options` object does not model. */
  options?: unknown;
  /** Chart configuration for chart-type widgets */
  chartConfig?: any;
  /**
   * Data binding: filter conditions. Kept `any` — objectui passes an ObjectQL
   * FilterNode array here, not the spec's `FilterCondition` envelope.
   */
  filter?: any;
  /**
   * Enable search input for table-type widgets. objectui-only — no spec counterpart.
   * @default false
   */
  searchable?: boolean;
  /**
   * Enable pagination for table-type widgets. objectui-only — no spec counterpart.
   * @default false
   */
  pagination?: boolean;
}

/**
 * A COMPONENT node sitting directly in a dashboard's widget slot — the
 * `metric-card` extension the 2026-08-14 ruling (objectstack#8593) admits, on
 * the TypeScript face. Twin of `zod/complex.zod.ts`
 * `DashboardWidgetSlotComponentSchema`, spelled the same way that arm is:
 * `BaseSchema` plus a `type` narrowed to the CLOSED component set
 * ({@link DASHBOARD_COMPONENT_WIDGET_TYPES}).
 *
 * `BaseSchema`'s `[key: string]: any` is the passthrough. `value` / `icon` /
 * `trend` / `trendValue` are `MetricCard`'s registry `inputs`, not widget keys:
 * they reach the compiler through the index signature here and MUST NOT be
 * declared on {@link DashboardWidgetSchema} — the compiler's own TS2561
 * suggestion ("Did you mean to write 'values'?") points at exactly that
 * forbidden repair.
 *
 * Until objectui#7952 this arm existed on the Zod face only:
 * `DashboardComponentSchema.widgets` was `DashboardWidgetSchema[]`, so the
 * `metric-card` blocks `plugin-dashboard/README.md` teaches parsed green
 * under `safeParse` and `tsc --strict` refused every one of them (6 × TS2561
 * on `value`, measured at `fc32921`). Ruled option (a) by the director seat
 * (decision batch #68, 2026-09-07, maintainer 「同意」): the TypeScript face
 * gains the component arm; the Zod face is untouched.
 *
 * Exported on purpose, where the Zod twin is not. The compiler does not force
 * it — measured in this package's own build (`declaration` + `composite`,
 * TypeScript 6.0.3): a non-exported arm referenced from the exported
 * `DashboardComponentSchema` emits into `dist/complex.d.ts` as a local
 * interface, exit 0, and a barrel consumer still writes the node with no
 * name. The export is an authoring-surface decision — a name an author can
 * annotate the node with, which `plugin-dashboard/README.md` teaches — taken
 * deliberately in the opposite direction to the Zod arm, whose own docblock
 * keeps that const private because its routing is an internal property of
 * the slot. Same interface shape as {@link DashboardComponentSchema} itself
 * (`extends BaseSchema` + a literal `type`), which is why it is an interface
 * rather than an intersection.
 *
 * Pinned by `__tests__/dashboard-widget-slot-component-arm-7952.test.ts`.
 */
export interface DashboardWidgetSlotComponentSchema extends BaseSchema {
  /** An objectui component type legal in a widget slot — the CLOSED set. */
  type: DashboardComponentWidgetType;
}

/**
 * Dashboard Schema
 */
export interface DashboardComponentSchema extends BaseSchema {
  type: 'dashboard';
  // `title` was DECLARED here until objectui#7623, under the comment "Dashboard
  // title displayed in the header" — by then a description of behaviour that had
  // stopped existing: objectui#7509 retired all five dashboard-root `title` read
  // arms under ADR-0049 (PR #7622), so the key was declared, documented as
  // rendering, and inert. The header text is the spec-canonical `label`
  // (`BaseSchema`), resolved through `pickLocalized`; `plugin-dashboard` has no
  // dashboard-root `title` read site left (pinned by that package's
  // `__tests__/dashboardAuthoredInputs.test.tsx`).
  //
  // Unlike `aria` below there is NO spec tombstone to inherit: `@objectstack/spec`'s
  // strict `DashboardSchema` refuses a root `title` as an UNRECOGNIZED key, not with
  // a named removal message, so the Zod twin (`zod/complex.zod.ts`, `.passthrough()`
  // via `BaseSchema`) gains no refusal from this deletion and ⛔ must not be given a
  // hand-written one — that would assert a spec behaviour that does not exist.
  // Note `BaseSchema`'s index signature still types an authored `title` as `any`:
  // this deletion removes the type-level suggestion and the false rendering claim,
  // not a key that ever rendered. Pinned by
  // `__tests__/dashboard-title-retired-declaration.test.ts`.
  columns?: number;
  gap?: number;
  /**
   * The widget slot — TWO arms, matching the Zod twin (`zod/complex.zod.ts`
   * `DashboardComponentSchema.widgets`, component arm first): a component
   * node ({@link DashboardWidgetSlotComponentSchema}, `type` in the closed
   * {@link DASHBOARD_COMPONENT_WIDGET_TYPES}) or a spec-family / legacy
   * `component`-envelope widget ({@link DashboardWidgetSchema}).
   *
   * One-armed (`DashboardWidgetSchema[]`) until objectui#7952, which refused
   * the shape the 2026-08-14 ruling (objectstack#8593) admits and the runtime
   * renders — see the arm's own docblock for the measurement and the ruling.
   *
   * ⚠️ Measured limits of a TypeScript union with a passthrough arm, recorded
   * so nobody reads them as a hatch (pinned two-faced next to the arm):
   *  - a literal that NAMES a `type` outside the component set is discriminated
   *    by it — `{ type: 'bar', bogus: 1 }` is still refused, because `'bar'`
   *    excludes the component arm and `DashboardWidgetSchema` has no `bogus`;
   *  - a literal with NO `type` (the legacy `component` envelope) cannot be
   *    discriminated, and the component arm's index signature then satisfies
   *    the union's excess-property check, so `{ component, bogus: 1 }`
   *    compiles here. The Zod face refuses it (`.strict()` widget schema) —
   *    the runtime is the strict face on that corner, as it already was for
   *    every `BaseSchema` slot.
   */
  widgets: Array<DashboardWidgetSlotComponentSchema | DashboardWidgetSchema>;
  /**
   * Auto-refresh interval in seconds. When set, the dashboard will periodically
   * trigger onRefresh.
   *
   * Renamed from `refreshInterval` in @objectstack/spec 17.4.0 (objectstack#15680,
   * ruling B on objectstack#14478: a duration-shaped number carries its unit in
   * the key name, never only in the describe prose). The spec's `DashboardSchema`
   * — which this node derives its spec-owned half from — now REFUSES the old
   * spelling with a `retiredKey` tombstone naming this one, so the two faces
   * would disagree at parse if this declaration had stayed (objectui#7783).
   */
  refreshIntervalSeconds?: number;
  /**
   * Dashboard header configuration.
   * Aligned with @objectstack/spec DashboardHeaderSchema.
   */
  header?: {
    showTitle?: boolean;
    showDescription?: boolean;
    actions?: Array<{
      label: string;
      actionUrl?: string;
      actionType?: string;
      icon?: string;
    }>;
  };
  /**
   * Global filter configurations.
   * Applied across all dashboard widgets.
   *
   * BOUND to `@objectstack/spec`'s `GlobalFilter` rather than restated
   * (objectui#4032, merged scope from the #4163 part-1 audit). It used to be a
   * hand-written inline object literal that happened to carry the same nine
   * keys, and the copy drifted in the one direction that costs the most:
   * `label` was declared `string` here long after the spec widened it (and its
   * `options[].label`) to `I18nLabel`. Because the restatement was NARROWER
   * than the contract, an authored per-locale map was a legal document that
   * objectui's own types said could not exist — so every read site that
   * stringified one was invisible to `tsc`, which is precisely how the filter
   * bar shipped `[object Object]: All` and how `normalizeFilterOptions` shipped
   * a coercion that discarded map labels in every locale.
   *
   * `DashboardWidgetSchema` above already takes this route (`extends
   * Omit<Partial< SpecDashboardWidget >, …>`), which is why the widget half of
   * the same widening WAS compile-visible and got repaired in #4208. Binding is
   * preferred over restating for exactly that asymmetry: the key set and the
   * value vocabularies now track the protocol instead of a snapshot of it.
   */
  globalFilters?: SpecGlobalFilter[];
  /**
   * Date range filter configuration.
   * Aligned with @objectstack/spec DashboardSchema.dateRange.
   *
   * `defaultRange` is BOUND to the spec's `DateRangeDefaultRange` rather than
   * restated (objectui#4984). It used to be a hand-written 14-member union —
   * byte-faithful to the spec, but faithful only until the next spec release:
   * a preset the spec ADDS would be a legal document that objectui's own types
   * say cannot exist, the same "narrower than the contract it implements" shape
   * as objectui#4163's `label`, whose consequence was that the bad reads were
   * invisible to `tsc`. No gate could report the drift either — `check:spec-symbols`
   * rule 1 matches by NAME and an inline union on an interface member has no
   * symbol to collide with, while rule 2's claim heuristic was waved through by
   * the `SpecGlobalFilter` reference a few lines up. Binding makes the "Aligned
   * with" line above structural instead of prose.
   *
   * `DATE_RANGE_DEFAULT_RANGES` is `[...DATE_RANGE_PRESETS, 'custom']`, so this
   * tracks the same vocabulary `@object-ui/core` re-exports by reference
   * (objectui#4167) — one list, reached two ways.
   */
  dateRange?: {
    field?: string;
    defaultRange?: SpecDateRangeDefaultRange;
    allowCustomRange?: boolean;
  };
  // `aria` was DECLARED here until objectui#5830, under a comment claiming
  // alignment with @objectstack/spec AriaPropsSchema — by then the opposite of
  // the contract: the spec removed `dashboard.aria` at the #3896 audit
  // close-out (no dashboard renderer ever applied it), so
  // `DashboardSchema.shape.aria` is a tombstone that refuses any value, the
  // Zod twin (`zod/complex.zod.ts`) inherits that refusal through
  // `SpecDashboardFields`, and `plugin-dashboard` has no `schema.aria` read
  // site. Note `BaseSchema`'s index signature still types an authored `aria`
  // as `any` — this deletion removes the type-level suggestion and the false
  // parity claim, not a key that ever rendered. Pinned by
  // `__tests__/dashboard-aria-retired-contract-twins.test.ts`.
}

/**
 * Union type of all complex schemas
 */
export type ComplexSchema =
  | KanbanSchema
  | CalendarViewSchema
  | FilterBuilderSchema
  | CarouselSchema
  | ChatbotSchema
  | ChatbotEnhancedSchema
  | ChatbotFloatingSchema
  | DashboardComponentSchema;
