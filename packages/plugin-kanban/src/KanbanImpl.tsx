/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, ScrollArea, Button, Input, useResizeObserver, DataEmptyState } from "@object-ui/components"
import { useHasDndProvider, useDnd, usePredicateScope } from "@object-ui/react"
import { resolveConditionalFormatting } from "@object-ui/core"
import type { KanbanConditionalFormattingRule } from "@object-ui/types"
import type { KanbanCard, KanbanColumn } from './types'
import { createSafeTranslation } from "@object-ui/i18n"
import { Plus } from "lucide-react"
import { useKanbanRecordsSettled } from './KanbanRecordsSettled'

// Utility function to merge class names (inline to avoid external dependency)
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

// Safe translation hook — falls back to English defaults when no I18nProvider
// is mounted (e.g. plugin-kanban consumed standalone or in unit tests).
const useKanbanT = createSafeTranslation(
  {
    'kanban.addCard': 'Add card',
    'kanban.noCards': 'No cards',
    'kanban.cardTitlePlaceholder': 'Enter card title…',
  },
  'kanban.noCards',
)

const UNCATEGORIZED_LANE = 'Uncategorized'

/**
 * Marks a swimlane row as a participant in the board's ONE horizontal axis
 * (objectui#8448).
 *
 * The swimlane layout paints its column titles once, above every lane, and then
 * paints each lane's cells in its own row. Both rows are `overflow-x-auto`, so
 * before this attribute existed they were INDEPENDENT scroll containers: driving
 * a lane to `scrollLeft: 298` left the header at `0`, and every column title
 * then sat over the wrong column. Measured in Chromium 1194 at 1600x1000 with
 * five columns — `'Open'` title at x=200, the Open lane cell at x=-97 — and the
 * row already overflows at ordinary widths there (`scrollWidth` 1840 vs
 * `clientWidth` 1552). Nothing errored; the board simply lied about which lane
 * was which status, which is worse than the height-0 row objectui#7303 fixed
 * because that one failed loudly.
 *
 * ⚠️ The sync is a scroll handler rather than one shared scrolling ANCESTOR,
 * and that is a measurement, not a preference. Folding the header row and the
 * lane rows into a single `overflow-x-auto` wrapper is refused by objectui#7303's
 * own pin, which reads the header row as `region.firstElementChild` and asserts
 * that its `pl-*` indent EQUALS the lane content row's. A wrapper becomes that
 * first child, and hoisting the shared indent onto it is exactly what makes the
 * two indents differ — so the restructuring cannot be done without editing a pin
 * that must stay unweakened. It also drags the lane chrome (border box and
 * collapse button) inside the scroller, where the lane's own name scrolls out of
 * view: a second "the board no longer says which lane this is" defect, of the
 * family this fix exists to remove.
 *
 * Keeping the DOM as it is has a second payoff: the header row stays a direct
 * flex child of the swimlane region, so objectui#8449's ruled vertical arm
 * (region scrolls, header row sticks) remains reachable without undoing any of
 * this. That arm has since landed — the region is `overflow-y-auto` and this
 * row is `sticky top-0` — and it needed no change here, as predicted.
 */
const SWIMLANE_SCROLL_ROW_ATTR = 'data-swimlane-scroll-row'

/**
 * The horizontal padding carried by EVERY row on the swimlane board's shared
 * horizontal axis — the column-header row and each lane content row alike.
 *
 * It is one constant, used twice, because equal `scrollLeft` is only equal
 * ALIGNMENT while the two kinds of row have the same scrollable RANGE, and the
 * range is `scrollWidth - clientWidth` — which horizontal padding moves
 * (objectui#8797). The rows carried different padding before this: the lane
 * rows had `px-2`, the header row had none, so the lane rows' `scrollWidth` was
 * 8px larger. objectui#8448's sync copies one `scrollLeft` onto every row, so
 * driving a lane to its own maximum asked the header row for a position past
 * ITS maximum, the header row CLAMPED, and every column title stopped tracking
 * its column — permanently, until the user scrolled back.
 *
 * ⚠️ `pl-36 sm:pl-44` must stay AFTER `px-2`, and both must stay in this one
 * string. Tailwind emits `pl-*` after `px-*`, so the indent wins the left side
 * and `px-2`'s only live effect is the 8px on the RIGHT — measured, both rows
 * read `padding-left: 176px` at `sm`. Splitting them across two class lists is
 * what let them drift apart in the first place.
 *
 * Measured in Chromium 1194 at 1600x1000, five columns and six swimlanes, the
 * axis driven through the real input pipeline with `mouse.wheel`:
 *
 *   before  header max scrollLeft 288, lane max 298 -> worst title/cell dx 9px
 *   after   header max scrollLeft 296, lane max 298 -> worst title/cell dx 1px
 *
 * ⚠️ The residual 2px of range is NOT padding and cannot be closed from here:
 * each lane row sits inside the lane's `border rounded-lg` wrapper, so its
 * `clientWidth` is 1550 against the header row's 1552. That same 1px border is
 * the 1px title/cell baseline objectui#7303 and objectui#8448 already record.
 * Reported on objectui#8797 rather than compensated for with a magic offset.
 */
const SWIMLANE_AXIS_X_PADDING = 'px-2 pl-36 sm:pl-44'

// `KanbanCard` / `KanbanColumn` have ONE authority in this package: `./types`
// (objectui#6172 / #6155). This file used to redeclare both, and the copies had
// drifted — the local `KanbanCard` carried `cardSubtitle` / `cardFieldCells` /
// `coverImage` that `./types` did not. Those members moved to the canonical
// declaration (all optional, so nothing that type-checked before stopped), and
// the re-export below keeps this module's export surface byte-for-byte what it
// was for any importer. A re-export is not a second declaration.
export type { KanbanCard, KanbanColumn } from './types'

// Card formatting accepts the native `{ field, operator, value }` shape and the
// spec `{ condition, style }` CEL shape (issue #1584) — see @object-ui/types.
export type ConditionalFormattingRule = KanbanConditionalFormattingRule

export interface KanbanBoardProps {
  columns: KanbanColumn[]
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void
  onCardClick?: (card: KanbanCard, event?: React.MouseEvent) => void
  className?: string
  quickAdd?: boolean
  onQuickAdd?: (columnId: string, title: string) => void
  coverImageField?: string
  conditionalFormatting?: ConditionalFormattingRule[]
  /** Object field definitions — see `getCardStyles` (objectui#3501). */
  objectFields?: unknown
  /** Field name for swimlane rows (2D grouping) */
  swimlaneField?: string
  /**
   * The cards in `columns` are a fetched WINDOW, not the whole group
   * (objectui#8307) — see `laneCountLabel`. Injected by `ObjectKanban`, the
   * only entry point that issues the windowed query; a board handed its rows
   * whole leaves it unset and keeps the bare number.
   */
  countsAreWindowed?: boolean
}

/**
 * Evaluate conditional formatting rules for a card.
 * Returns CSS style overrides for backgroundColor and borderColor.
 */
// Card conditional formatting now delegates to the shared CEL evaluator
// (issue #1584 / ADR-0058) so kanban cards, list rows, and grid rows reach the
// identical verdict. Beyond the native `{ field, operator, value }` rules the
// kanban schema declares, this also accepts spec `{ condition, style }` rules.
// The host predicate scope is bound alongside the card so `features.*` /
// `current_user.*` conditions resolve here exactly as they do on grid rows.
function getCardStyles(
  card: KanbanCard,
  rules?: ConditionalFormattingRule[],
  scope?: Record<string, unknown>,
  objectFields?: unknown,
): React.CSSProperties {
  // `objectFields` binds a relation field as the stored foreign key rather than
  // the record `$expand` substituted for it. The board expands relations for
  // display exactly as the grid does, so without it a rule like
  // `record.account == "<id>"` compared an object to a string and could only
  // ever be false — on the board only, while the same rule matched on the grid
  // view of the same list (objectui#3501). Absent on the schema-only entry
  // point, where the payload is used verbatim.
  return resolveConditionalFormatting(card as Record<string, unknown>, rules as any, scope, objectFields as never) as React.CSSProperties
}

function SortableCard({ card, onCardClick, conditionalFormatting, objectFields }: { card: KanbanCard; onCardClick?: (card: KanbanCard, event?: React.MouseEvent) => void; conditionalFormatting?: ConditionalFormattingRule[]; objectFields?: unknown }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  const predicateScope = usePredicateScope()
  const cardStyles = getCardStyles(card, conditionalFormatting, predicateScope, objectFields)

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} role="listitem" aria-label={card.title}
      onClick={(e) => onCardClick?.(card, e)}
    >
      <Card className="mb-2 cursor-grab active:cursor-grabbing border-border border-l-4 border-l-primary/40 bg-card/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group touch-manipulation" style={cardStyles}>
        {card.coverImage && (
          <div className="w-full h-32 overflow-hidden rounded-t-lg">
            <img
              src={card.coverImage}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <CardHeader className="p-2 sm:p-4 pb-2">
          <CardTitle className="text-xs sm:text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">{card.title}</CardTitle>
          {!(card.cardFieldCells && card.cardFieldCells.length > 0) && (card.cardSubtitle ?? card.description) && (
            <CardDescription className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-none">
              {card.cardSubtitle ?? card.description}
            </CardDescription>
          )}
        </CardHeader>
        {((card.cardFieldCells && card.cardFieldCells.length > 0) || (card.badges && card.badges.length > 0)) && (
          <CardContent className="p-2 sm:p-4 pt-0 space-y-1.5">
            {card.cardFieldCells && card.cardFieldCells.length > 0 && (
              // Dense single-column metadata list — values only, with the
              // field label as a hover tooltip. Pipeline cards across
              // Salesforce / HubSpot / Linear all drop the `Label: value`
              // pair pattern because the value's own type (currency, date,
              // lookup avatar/badge) already conveys its meaning, and the
              // saved horizontal space lets the card title breathe.
              <dl className="space-y-1 text-xs">
                {card.cardFieldCells.map((cell) => (
                  <div
                    key={cell.field}
                    className="min-w-0 truncate text-foreground/85"
                    title={cell.label || cell.field}
                  >
                    <dt className="sr-only">{cell.label || cell.field}</dt>
                    <dd className="min-w-0 truncate">{cell.node}</dd>
                  </div>
                ))}
              </dl>
            )}
            {card.badges && card.badges.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {card.badges.map((badge, index) => (
                  <Badge
                    key={index}
                    variant={badge.colorClass ? "outline" : (badge.variant || "default")}
                    className={cn("text-xs font-normal", badge.colorClass)}
                    style={badge.colorStyle}
                  >
                    {badge.label}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function QuickAddForm({ columnId, onAdd }: { columnId: string; onAdd: (columnId: string, title: string) => void }) {
  const { t } = useKanbanT()
  const [isAdding, setIsAdding] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = title.trim()
    if (trimmed) {
      onAdd(columnId, trimmed)
      setTitle('')
    }
    setIsAdding(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setTitle('')
      setIsAdding(false)
    }
  }

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 text-muted-foreground hover:text-foreground"
        onClick={() => {
          setIsAdding(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        <Plus className="h-4 w-4 mr-1" />
        {t('kanban.addCard')}
      </Button>
    )
  }

  return (
    <div className="mt-2 space-y-2">
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown} 
        onBlur={handleSubmit}
        placeholder={t('kanban.cardTitlePlaceholder')}
        className="text-sm"
        autoFocus
      />
    </div>
  )
}

/**
 * The column-width contract, in ONE place, for BOTH board layouts.
 *
 * `KanbanBoardInner` derives `columnInlineStyle` from the board's own slot
 * (`useResizeObserver`) and hands the SAME object to both layouts: the flat
 * one through `KanbanColumnView`'s `columnStyle` prop, the swimlane one
 * straight onto the plain cells it paints itself. Where a container-derived
 * width is present the viewport-relative classes must step aside rather than
 * fight the inline value; where it is absent (SSR, or before the first
 * observation) they are the fallback.
 *
 * This is a shared function rather than a ternary copied per call site because
 * the swimlane layout has no column components to inherit the behaviour from.
 * The rule previously existed only on the flat path, so a swimlane board stayed
 * viewport-sized — `w-[85vw]` on every cell — while the docblock over
 * `columnInlineStyle` claimed those hard-coded classes had been replaced
 * (objectui#8508). Adding a layout means calling this, not re-deriving it.
 */
function columnWidthClasses(columnStyle?: React.CSSProperties): string {
  return columnStyle && columnStyle.width != null
    ? "shrink-0"
    : "w-[85vw] sm:w-80 shrink-0";
}

/**
 * How a lane count is WRITTEN, in ONE place, for every header on this board.
 *
 * The number handed in is `col.cards.length` — the count of fetched rows that
 * fell into this lane. The fetch is windowed at a real `$top` (objectui#4025),
 * and the board groups what came back, so over any object with more rows than
 * the window that number is not the size of the group: every lane is short,
 * the lanes sum to the window, and the result is CREDIBLE — 77 / 19 / 2 reads
 * as a plausible funnel against a true 88 / 46 / 28 / 14 / 9 / 15, so nothing
 * prompts the reader to distrust it (objectui#8307).
 *
 * The fix is not a better number — this component does not have one, and
 * getting one means a server-side group-count aggregate over the whole
 * filtered set. The fix is to stop the number claiming to be something it is
 * not: `77+` says "at least 77", which is what a count over a window actually
 * establishes.
 *
 * ⚠️ The boundary case is deliberate. `countsAreWindowed` comes from
 * "the fetch came back with at least as many rows as it asked for", and a
 * board holding EXACTLY the window is indistinguishable from a truncated one
 * from this side of the wire — no client-side signal separates them without
 * asking the server a second question. So such a board renders `77+` for a
 * lane that really does hold 77. That is the safe half of the ambiguity:
 * "at least 77" is TRUE when the lane holds exactly 77, whereas the bare
 * "77" is FALSE whenever the board is in fact truncated. The marker is
 * conservative; it is never wrong.
 *
 * A shared function rather than a template literal repeated per header,
 * because this board paints lane counts from three places (the flat column
 * header, and the swimlane layout's column-title row and lane rows) and a
 * count that is honest on one layout and bare on another is the same defect
 * with a smaller blast radius. Adding a header means calling this.
 */
function laneCountLabel(count: number, countsAreWindowed?: boolean): string {
  return countsAreWindowed ? `${count}+` : String(count)
}

function KanbanColumnView({
  column,
  cards,
  onCardClick,
  quickAdd,
  onQuickAdd,
  conditionalFormatting,
  objectFields,
  columnStyle,
  suppressEmptyPlaceholder,
  countsAreWindowed,
}: {
  column: KanbanColumn
  cards: KanbanCard[]
  onCardClick?: (card: KanbanCard, event?: React.MouseEvent) => void
  quickAdd?: boolean
  onQuickAdd?: (columnId: string, title: string) => void
  conditionalFormatting?: ConditionalFormattingRule[]
  /** Object field definitions — see `getCardStyles` (objectui#3501). */
  objectFields?: unknown
  /** Container-aware width override from useResizeObserver in KanbanBoardInner. */
  columnStyle?: React.CSSProperties
  /**
   * When the board is globally empty (every column has zero cards), the
   * parent renders a single page-level Empty banner and asks each column
   * to suppress its own dashed "No cards" placeholder so the screen
   * doesn't read as N redundant copies of the same message.
   */
  suppressEmptyPlaceholder?: boolean
  /** The cards handed in are a fetched window — see `laneCountLabel` (objectui#8307). */
  countsAreWindowed?: boolean
}) {
  const { t } = useKanbanT()
  const safeCards = cards || [];
  const { setNodeRef, isOver } = useSortable({
    id: column.id,
    data: {
      type: "column",
    },
  })

  const isLimitExceeded = column.limit && safeCards.length >= column.limit

  // When the parent passes inline width, drop the viewport-relative classes
  // so they don't fight with the container-derived value. Shared with the
  // swimlane layout's own cells — see `columnWidthClasses`.
  const widthClasses = columnWidthClasses(columnStyle);

  // Stage progress indicator: the colored top stripe was distracting on
  // boards with many columns ("rainbow stripe" effect). The lane border
  // and header `border-b` are sufficient for scannability; the **cards**
  // should be the loudest thing on screen — Linear / HubSpot pattern.

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={column.title}
      style={columnStyle}
      className={cn(
        "relative flex flex-col rounded-xl border border-border/60 bg-muted/15 snap-start max-h-full min-h-0 transition-all duration-200 shadow-sm hover:shadow-md overflow-hidden",
        widthClasses,
        // P2-5: when a card is being dragged over this column, highlight the
        // whole column so users can see exactly which lane will receive the
        // drop. This is critical for empty columns where there's no card
        // gap-indicator from SortableContext to show drop position.
        isOver && "ring-2 ring-primary/60 bg-primary/5",
        column.className
      )}
    >
      <div className="px-3 sm:px-4 pt-3 pb-2.5 border-b border-border/40">
        <div className="flex items-center justify-between gap-2">
          <h3 id={`kanban-col-${column.id}`} className="text-xs sm:text-[13px] font-semibold tracking-tight truncate text-foreground/85 uppercase">{column.title}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-md text-[11px] font-medium tabular-nums",
                isLimitExceeded
                  ? "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/30"
                  : "bg-muted/70 text-muted-foreground",
              )}
            >
              {laneCountLabel(safeCards.length, countsAreWindowed)}
              {column.limit && <span className="text-muted-foreground/70 font-normal">{` / ${column.limit}`}</span>}
            </span>
            {isLimitExceeded && (
              <Badge variant="destructive" className="text-[10px] h-[20px] px-1.5">
                Full
              </Badge>
            )}
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 p-4">
        <SortableContext
          items={safeCards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2" role="list" aria-label={`${column.title} cards`}>
            {safeCards.length === 0 && !suppressEmptyPlaceholder && (
              <div
                className={cn(
                  "flex flex-col items-center justify-center py-6 rounded-md border-2 border-dashed transition-colors gap-1",
                  isOver
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border/40 text-muted-foreground/60"
                )}
              >
                {!isOver && quickAdd && onQuickAdd && (
                  <Plus className="h-3.5 w-3.5 opacity-60" aria-hidden />
                )}
                <span className="text-xs">
                  {isOver ? '↓ ' : ''}{t('kanban.noCards')}
                </span>
              </div>
            )}
            {safeCards.map((card) => (
              <SortableCard key={card.id} card={card} onCardClick={onCardClick} conditionalFormatting={conditionalFormatting} objectFields={objectFields} />
            ))}
          </div>
        </SortableContext>
        {quickAdd && onQuickAdd && (
          <QuickAddForm columnId={column.id} onAdd={onQuickAdd} />
        )}
      </ScrollArea>
    </div>
  )
}

/** Bridge wrapper that reads the ObjectUI DnD context and injects it into KanbanBoardInner. */
function DndBridge({ children }: { children: (dnd: ReturnType<typeof useDnd>) => React.ReactNode }) {
  const dnd = useDnd()
  return <>{children(dnd)}</>
}

export default function KanbanBoard({ columns, onCardMove, onCardClick, className, quickAdd, onQuickAdd, coverImageField, conditionalFormatting, objectFields, swimlaneField, countsAreWindowed }: KanbanBoardProps) {
  const hasDnd = useHasDndProvider()

  if (hasDnd) {
    return (
      <DndBridge>
        {(dnd) => <KanbanBoardInner columns={columns} onCardMove={onCardMove} onCardClick={onCardClick} className={className} dnd={dnd} quickAdd={quickAdd} onQuickAdd={onQuickAdd} coverImageField={coverImageField} conditionalFormatting={conditionalFormatting} objectFields={objectFields} swimlaneField={swimlaneField} countsAreWindowed={countsAreWindowed} />}
      </DndBridge>
    )
  }

  return <KanbanBoardInner columns={columns} onCardMove={onCardMove} onCardClick={onCardClick} className={className} dnd={null} quickAdd={quickAdd} onQuickAdd={onQuickAdd} coverImageField={coverImageField} conditionalFormatting={conditionalFormatting} objectFields={objectFields} swimlaneField={swimlaneField} countsAreWindowed={countsAreWindowed} />
}

function KanbanBoardInner({ columns, onCardMove, onCardClick, className, dnd, quickAdd, onQuickAdd, coverImageField: _coverImageField, conditionalFormatting, objectFields, swimlaneField, countsAreWindowed }: KanbanBoardProps & { dnd: ReturnType<typeof useDnd> | null }) {
  const { t } = useKanbanT()
  const [activeCard, setActiveCard] = React.useState<KanbanCard | null>(null)

  /**
   * objectui#8827 — have the records this board is drawing SETTLED?
   *
   * Read from a package-private context (`ObjectKanban` provides it, the
   * schema-only `kanban-ui` entry has no provider and gets the settled
   * default). It gates the two places below that say "No cards", because both
   * of them are assertions ABOUT THE DATA and this component is reachable —
   * through `KanbanRenderer`'s `React.lazy` boundary — before the data exists.
   * ⛔ It gates nothing else: lanes, headers, counts and drop targets all keep
   * rendering while the rows are in flight. The full argument, the measured
   * reproduction and the settle contract live on the context.
   */
  const recordsSettled = useKanbanRecordsSettled()

  /**
   * Container-aware column sizing — replaces hard-coded `w-[85vw] sm:w-80`
   * (viewport-relative) with a width derived from the board's own slot.
   * That way an embedded Kanban (in a panel, drawer, or pop-out window)
   * scales correctly without overflowing or wasting space.
   *
   * `boardRef` is on the wrapper that encloses BOTH layouts, and both read this
   * value: the flat layout passes it to `KanbanColumnView` as `columnStyle`,
   * the swimlane layout puts it on the header cells and lane cells it paints
   * itself. Until objectui#8508 only the flat path consumed it, so the sentence
   * above was true of one of the two layouts and an embedded swimlane board —
   * the panel/drawer/pop-out case this exists for — stayed viewport-sized.
   * Whichever layout a cell belongs to, its class list comes from
   * `columnWidthClasses(columnInlineStyle)` so the two cannot drift apart.
   */
  const boardRef = React.useRef<HTMLDivElement>(null);
  const { width: boardWidth } = useResizeObserver(boardRef);
  const columnInlineStyle = React.useMemo<React.CSSProperties>(() => {
    if (!boardWidth) return {};
    if (boardWidth < 480) return { width: Math.max(boardWidth - 32, 220) }; // 1-up
    if (boardWidth < 720) return { width: 280 };
    return { width: 320 };
  }, [boardWidth]);

  // Persist collapsed swimlane state per swimlaneField
  const storageKey = swimlaneField ? `objectui:kanban-collapsed:${swimlaneField}` : null
  const [collapsedLanes, setCollapsedLanes] = React.useState<Set<string>>(() => {
    if (!storageKey) return new Set()
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) return new Set(parsed.filter((v): v is string => typeof v === 'string'))
      }
    } catch { /* ignore corrupt data */ }
    return new Set()
  })
  
  // Ensure we always have valid columns with cards array
  const safeColumns = React.useMemo(() => {
    return (columns || []).map(col => ({
      ...col,
      cards: col.cards || []
    }));
  }, [columns]);

  // The board keeps its own copy of the columns, and that mirror STAYS: the drag
  // path writes it optimistically (`handleDragEnd` below), and the `columns`
  // prop never carries card ORDER back. A same-column reorder notifies nobody —
  // `handleDragEnd` takes its local branch without calling `onCardMove` — and
  // `ObjectKanban.handleCardMove` early-returns on `fromColumnId === toColumnId`
  // and discards `newIndex` outright. Order truth is local-only, so deriving
  // this away would roll a committed reorder back on the next prop change.
  //
  // What does NOT stay is syncing it from a passive effect. An effect runs after
  // commit, so every prop-driven column change reached the DOM one commit late:
  // a board whose data resolved after mount painted a frame of headers with
  // empty lists before the cards appeared. Aligning during render instead makes
  // React re-run this component with the new state BEFORE it commits, so the
  // first painted frame that has headers already has the cards. This is React's
  // documented "adjusting state when a prop changes" pattern, and it keeps the
  // reset trigger byte-identical to the effect's (`safeColumns` identity), so
  // the rejected-move rollback of objectui#4138 still fires exactly as before.
  // objectui#8534.
  const [boardColumns, setBoardColumns] = React.useState<KanbanColumn[]>(safeColumns)
  const [syncedColumns, setSyncedColumns] = React.useState<KanbanColumn[]>(safeColumns)

  if (syncedColumns !== safeColumns) {
    setSyncedColumns(safeColumns)
    setBoardColumns(safeColumns)
  }

  // Compute swimlane rows when swimlaneField is provided
  const swimlanes = React.useMemo(() => {
    if (!swimlaneField) return null
    const allCards = boardColumns.flatMap(col => col.cards)
    const laneValues = new Set<string>()
    allCards.forEach(card => {
      const val = card[swimlaneField]
      laneValues.add(val != null ? String(val) : UNCATEGORIZED_LANE)
    })
    return Array.from(laneValues).sort()
  }, [boardColumns, swimlaneField])

  const toggleLane = React.useCallback((lane: string) => {
    setCollapsedLanes(prev => {
      const next = new Set(prev)
      if (next.has(lane)) next.delete(lane)
      else next.add(lane)
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch { /* quota exceeded */ }
      }
      return next
    })
  }, [storageKey])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const card = findCard(active.id as string)
    setActiveCard(card)

    // Bridge to ObjectUI spec DnD system
    if (dnd && card) {
      const column = findColumnByCardId(card.id)
      if (column) {
        dnd.startDrag({ id: card.id, type: 'kanban-card', data: card, sourceId: column.id })
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over) {
      if (dnd) dnd.endDrag()
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) {
      if (dnd) dnd.endDrag()
      return
    }

    const activeColumn = findColumnByCardId(activeId)
    const overColumn = findColumnByCardId(overId) || findColumnById(overId)

    if (!activeColumn || !overColumn) {
      if (dnd) dnd.endDrag()
      return
    }

    if (activeColumn.id === overColumn.id) {
      // Same column reordering
      const cards = [...activeColumn.cards]
      const oldIndex = cards.findIndex((c) => c.id === activeId)
      const newIndex = cards.findIndex((c) => c.id === overId)

      const newCards = arrayMove(cards, oldIndex, newIndex)
      setBoardColumns((prev) =>
        prev.map((col) =>
          col.id === activeColumn.id ? { ...col, cards: newCards } : col
        )
      )
    } else {
      // Moving between columns
      const activeCards = [...activeColumn.cards]
      const overCards = [...overColumn.cards]
      const activeIndex = activeCards.findIndex((c) => c.id === activeId)
      
      // Calculate target index: if dropping on column itself, append to end; otherwise insert at card position
      const isDroppingOnColumn = overId === overColumn.id
      const overIndex = isDroppingOnColumn 
        ? overCards.length 
        : overCards.findIndex((c) => c.id === overId)

      const [movedCard] = activeCards.splice(activeIndex, 1)
      overCards.splice(overIndex, 0, movedCard)

      setBoardColumns((prev) =>
        prev.map((col) => {
          if (col.id === activeColumn.id) {
            return { ...col, cards: activeCards }
          }
          if (col.id === overColumn.id) {
            return { ...col, cards: overCards }
          }
          return col
        })
      )

      if (onCardMove) {
        onCardMove(activeId, activeColumn.id, overColumn.id, overIndex)
      }
    }

    // Bridge to ObjectUI spec DnD system
    if (dnd) dnd.endDrag(overColumn.id)
  }

  const findCard = React.useCallback(
    (cardId: string): KanbanCard | null => {
      for (const column of boardColumns) {
        const card = column.cards.find((c) => c.id === cardId)
        if (card) return card
      }
      return null
    },
    [boardColumns]
  )

  const findColumnByCardId = React.useCallback(
    (cardId: string): KanbanColumn | null => {
      return boardColumns.find((col) => col.cards.some((c) => c.id === cardId)) || null
    },
    [boardColumns]
  )

  const findColumnById = React.useCallback(
    (columnId: string): KanbanColumn | null => {
      return boardColumns.find((col) => col.id === columnId) || null
    },
    [boardColumns]
  )

  // Mobile: track which column is currently snapped into view so we can
  // render a compact dot indicator instead of the noisier "← Swipe to
  // navigate →" hint that used to live above the board.
  const flatScrollRef = React.useRef<HTMLDivElement | null>(null)
  const [activeColumnIndex, setActiveColumnIndex] = React.useState(0)
  React.useEffect(() => {
    const el = flatScrollRef.current
    if (!el) return
    const handle = () => {
      const colWidth = el.clientWidth
      if (colWidth <= 0) return
      const idx = Math.round(el.scrollLeft / colWidth)
      setActiveColumnIndex(Math.max(0, Math.min(boardColumns.length - 1, idx)))
    }
    handle()
    el.addEventListener('scroll', handle, { passive: true })
    return () => el.removeEventListener('scroll', handle)
  }, [boardColumns.length])

  /**
   * The swimlane board's single horizontal scroll position (objectui#8448).
   *
   * A ref, not state: this value must be readable from a `scroll` handler and
   * from a mount-time `ref` callback without re-rendering the board on every
   * scroll frame. Nothing renders from it.
   */
  const swimlaneScrollLeftRef = React.useRef(0)

  /**
   * Propagate one row's new position to every other row of the same board.
   *
   * Rows are found by attribute rather than collected into a ref, because a
   * plain `ref` callback is handed `null` on unmount and cannot say WHICH
   * element left; a DOM query is always the live set. `boardRef` scopes it to
   * this board, and the attribute is carried only by swimlane rows, so the flat
   * layout's own scroller can never be pulled along.
   *
   * The equality guards are what make this terminate. Assigning a `scrollLeft`
   * that a row already holds fires no `scroll` event, so the echo from the rows
   * this handler moves dies on its first hop; the shared-position guard on top
   * makes a second row reporting the same value a no-op rather than a second
   * pass. The one place a row can disagree is the extreme right edge: a lane row
   * carries ~10px more scrollable width than the header row (its `pr` plus the
   * lane's border), so a lane driven to its own maximum clamps the header to the
   * header's, whose echo then pulls the lanes back to it. That converges in one
   * hop and settles on the most restrictive row, which is the honest reading of
   * "one axis for the whole board".
   */
  const syncSwimlaneScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const source = event.currentTarget
    const next = source.scrollLeft
    if (next === swimlaneScrollLeftRef.current) return
    swimlaneScrollLeftRef.current = next
    const board = boardRef.current
    if (!board) return
    for (const row of board.querySelectorAll<HTMLElement>(`[${SWIMLANE_SCROLL_ROW_ATTR}]`)) {
      if (row !== source && row.scrollLeft !== next) row.scrollLeft = next
    }
  }, [])

  /**
   * Give a row that mounts LATE the board's current position.
   *
   * Expanding a collapsed lane mounts a fresh row at `scrollLeft: 0`; without
   * this it would render one lane's cells offset from every other lane's and
   * from the titles above them — the same defect, arriving by a different door.
   * The callback identity is stable, so React runs it once per mount and once
   * with `null` per unmount rather than on every render (which would reset the
   * position mid-scroll).
   */
  const adoptSwimlaneScroll = React.useCallback((el: HTMLDivElement | null) => {
    if (el && el.scrollLeft !== swimlaneScrollLeftRef.current) {
      el.scrollLeft = swimlaneScrollLeftRef.current
    }
  }, [])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div ref={boardRef} className="flex flex-col min-w-0 min-h-0 h-full">
      {/* Mobile-only column indicator. Replaces the prior verbose
          "← Swipe to navigate →" caption with a low-noise dot row that
          also doubles as a position indicator. Hidden when there is only
          one column since the affordance is meaningless then. */}
      {boardColumns.length > 1 && (
        <div className="flex sm:hidden items-center justify-center gap-1.5 px-3 pb-2" aria-hidden>
          {boardColumns.map((col, i) => (
            <span
              key={col.id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === activeColumnIndex ? "w-4 bg-foreground/70" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}

      {(() => {
        const totalCardCount = boardColumns.reduce((sum, c) => sum + (c.cards?.length || 0), 0);
        // "This board holds no cards" — a fact about what was HANDED to this
        // component, true the instant it renders.
        const isBoardEmpty = totalCardCount === 0 && boardColumns.length > 1;
        // "This board HAS no cards" — a fact about the DATA, which is only
        // knowable once the records have settled (objectui#8827). Before
        // #8827 the two were the same expression, so a board whose lazy chunk
        // won the race against its own fetch announced an empty result it had
        // not yet received. ⚠️ `recordsSettled` defaults to `true`, so a
        // genuinely empty board still paints this the moment it settles —
        // withholding it forever is the regression this must not trade for.
        const showEmptyState = isBoardEmpty && recordsSettled;
        return (
      <>
      {showEmptyState && (
        <div className="px-4 sm:px-6 pt-3">
          <DataEmptyState
            role="status"
            aria-live="polite"
            showIcon={false}
            className="rounded-lg border border-dashed border-border/60 bg-muted/10 py-8 gap-2 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:text-foreground/80"
            title={t('kanban.noCards')}
            description={`${boardColumns.length} ${t('kanban.columns', { defaultValue: 'columns' })}`}
          />
        </div>
      )}
      {swimlanes ? (
        /* Swimlane (2D) layout — the region OWNS the vertical scroll (objectui#8449).
           It was `overflow-hidden`, which made the lanes below the fold
           UNREACHABLE rather than merely awkward: the region is a flex item of
           a height-bounded (`h-full`) board, and a non-`visible` overflow
           zeroes a flex item's automatic minimum size, so the region was
           already being shrunk to the board's height while its content stayed
           at full height — measured in Chromium at 1600x1000 with three lanes
           as `scrollHeight` 2104 against `clientHeight` 1000, with
           `document.documentElement` not scrollable either. Two of the three
           lanes had no gesture that reached them.

           `overflow-y-auto` puts the scroll where the overflow is and leaves
           the board a self-contained pane — the ruling's option A. Option B
           (drop the height bound, let the page scroll) was refused on blast
           radius: it changes what the component promises every embedder, and
           none were enumerated.

           ⚠️ The Y axis only. `overflow-x` stays `hidden` here so this does not
           become a second horizontal scroller competing with the ONE axis
           objectui#8448 settled on the header row and the lane rows. Pinned by
           `__tests__/swimlaneVerticalScroll-8449.test.tsx`. */
        <div className={cn("flex flex-col gap-2 px-4 sm:px-6 pb-3 sm:pb-4 min-w-0 overflow-x-hidden overflow-y-auto", className)} role="region" aria-label="Kanban board with swimlanes">
          {/* Column headers.
              This is a SECOND header implementation, parallel to the per-column
              `<h3 id={`kanban-col-${column.id}`}>` that `KanbanColumnView`
              renders. The two cannot be folded into one: this layout has no
              column components at all — every lane paints its own row of plain
              column cells — so the titles have to be drawn once, above every
              lane, instead of once per column.

              Having no column components is also why the width has to be
              applied by hand here: these cells and the lane cells below take it
              from `columnWidthClasses(columnInlineStyle)`, the same source
              `KanbanColumnView` reads on the flat path (objectui#8508). The two
              rows must stay on the same width for the titles to sit over their
              columns, exactly as with the `pl-*` indent noted below.

              `shrink-0` is load-bearing, not cosmetic (objectui#7303). This row
              is a flex ITEM of the swimlane region, which is a `flex-col` inside
              a height-bounded board (`h-full`). `overflow-x-auto` makes the row
              a scroll container, and a flex item's automatic minimum size
              (`min-height: auto`) applies only while its overflow is `visible`
              — so as a scroll container this row may legally be shrunk to
              height 0. The lanes below stay `overflow: visible`, so their own
              automatic minimum size clamps them at content height and they
              refuse to shrink: the moment the lanes overflow the board, the
              ENTIRE deficit lands on this one shrinkable item. The titles then
              stay in the DOM, at the right coordinates, painting nothing.
              Measured in Chromium 1194 at 1600x1000 before the fix: row height
              0, cell height 0, title span height 16, and `elementFromPoint` at
              a title's own centre returning the lane-collapse `<button>` behind
              it. Pinned by `__tests__/swimlaneColumnHeaderRow-7303.test.tsx`.

              The horizontal padding is shared with the lane content rows
              below, as the single `SWIMLANE_AXIS_X_PADDING` constant both class
              lists interpolate — the `pl-36 sm:pl-44` half is what lines the
              titles up with their columns, and the `px-2` half is what keeps
              the two rows' scroll RANGES equal (objectui#8797). It must move on
              both rows or neither, which is now a property of the source rather
              than of two class lists agreeing by hand.

              `pt-3 sm:pt-4` is the region's former TOP padding, moved onto this
              row on purpose. A scroll container's padding is inside its
              scrollport, so content scrolls THROUGH it: with the padding left
              on the region, a 16px band of the previous lane's cards stayed
              visible above the pinned header (measured in Chromium — the header
              stuck at `top + 16`, not `top + 0`). Carried here it is painted
              with the row's own opaque background instead. The region keeps
              `pb-*`, which nothing scrolls past.

              `sticky top-0` is the other half of objectui#8449's ruling. Now
              that the region scrolls vertically, a header row that scrolled
              away with the lanes would recreate objectui#7303's defect by a
              different route — the titles gone, the cells still there. The row
              is a direct flex child of the scrolling region, so it sticks to
              that region's scrollport. `bg-background` is load-bearing with it:
              without an opaque background the lanes paint THROUGH the pinned
              row. `z-10` orders it above the lane cards, whose drag transforms
              (dnd-kit) otherwise paint over it as later positioned siblings.

              ⚠️ `sticky` does NOT take the row out of the flex shrink pool —
              a sticky box is still in flow — so `shrink-0` above stays exactly
              as load-bearing as objectui#7303's pin says it is. */}
          <div
            className={`flex shrink-0 gap-3 sm:gap-4 ${SWIMLANE_AXIS_X_PADDING} pt-3 sm:pt-4 overflow-x-auto sticky top-0 z-10 bg-background`}
            ref={adoptSwimlaneScroll}
            onScroll={syncSwimlaneScroll}
            data-swimlane-scroll-row=""
          >
            {boardColumns.map(col => (
              <div
                key={col.id}
                style={columnInlineStyle}
                className={cn(columnWidthClasses(columnInlineStyle), "text-center")}
              >
                <span className=" text-xs sm:text-sm font-semibold tracking-wider text-primary/90 uppercase">{col.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">({laneCountLabel(col.cards.length, countsAreWindowed)})</span>
              </div>
            ))}
          </div>

          {/* Swimlane rows */}
          {swimlanes.map(lane => {
            const isCollapsed = collapsedLanes.has(lane)
            const laneCardCount = boardColumns.reduce((sum, col) =>
              sum + col.cards.filter(c => (c[swimlaneField!] != null ? String(c[swimlaneField!]) : UNCATEGORIZED_LANE) === lane).length, 0)

            return (
              <div key={lane} className="border rounded-lg bg-muted/10">
                {/* Lane header */}
                <button type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => toggleLane(lane)}
                  aria-expanded={!isCollapsed}
                >
                  <span className={cn("transition-transform text-xs", isCollapsed ? "" : "rotate-90")}>▶</span>
                  <span className=" text-xs font-semibold text-muted-foreground uppercase tracking-wider">{lane}</span>
                  <span className=" text-xs text-muted-foreground">({laneCountLabel(laneCardCount, countsAreWindowed)})</span>
                </button>

                {/* Lane content */}
                {!isCollapsed && (
                  <div
                    className={`flex gap-3 sm:gap-4 overflow-x-auto ${SWIMLANE_AXIS_X_PADDING} pb-3`}
                    ref={adoptSwimlaneScroll}
                    onScroll={syncSwimlaneScroll}
                    data-swimlane-scroll-row=""
                  >
                    {boardColumns.map(col => {
                      const laneCards = col.cards.filter(c =>
                        (c[swimlaneField!] != null ? String(c[swimlaneField!]) : UNCATEGORIZED_LANE) === lane
                      )
                      return (
                        <div
                          key={col.id}
                          style={columnInlineStyle}
                          className={cn(columnWidthClasses(columnInlineStyle), "min-h-[60px] rounded-md bg-card/20 p-2")}
                        >
                          <SortableContext items={laneCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2" role="list" aria-label={`${col.title} - ${lane} cards`}>
                              {laneCards.map(card => (
                                <SortableCard key={card.id} card={card} onCardClick={onCardClick} conditionalFormatting={conditionalFormatting} objectFields={objectFields} />
                              ))}
                            </div>
                          </SortableContext>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Standard flat layout */
        <div ref={flatScrollRef} className={cn("flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory px-4 sm:px-6 py-3 sm:py-4 [-webkit-overflow-scrolling:touch] min-w-0 min-h-0 h-full", className)} role="region" aria-label="Kanban board">
          {boardColumns.map((column) => (
            <KanbanColumnView
              key={column.id}
              column={column}
              cards={column.cards}
              onCardClick={onCardClick}
              quickAdd={quickAdd}
              onQuickAdd={onQuickAdd}
              conditionalFormatting={conditionalFormatting}
              objectFields={objectFields}
              columnStyle={columnInlineStyle}
              // Two reasons to withhold a column's "No cards" placeholder,
              // and they are different reasons (objectui#8827). `isBoardEmpty`
              // means the BOARD-level empty state above is already saying it,
              // so a per-column copy would be a duplicate. `!recordsSettled`
              // means nobody may say it yet: the placeholder renders the same
              // `kanban.noCards` string, so leaving it ungated would have kept
              // the false claim alive on any board with a single lane — where
              // `isBoardEmpty` is false and the board-level gate never runs.
              suppressEmptyPlaceholder={isBoardEmpty || !recordsSettled}
              countsAreWindowed={countsAreWindowed}
            />
          ))}
        </div>
      )}
      </>
        );
      })()}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        <div
          aria-live="assertive"
          aria-label={activeCard ? `Dragging ${activeCard.title}` : undefined}
          // Lift the card visibly while in flight: slight rotate + scale +
          // strong shadow + ring. Matches the Linear / Trello "pickup"
          // affordance and makes the destination obvious because the
          // overlay reads as elevated above every column.
          className={cn(
            activeCard && 'motion-safe:rotate-2 motion-safe:scale-[1.03] motion-safe:transition-transform shadow-2xl shadow-primary/25 ring-1 ring-primary/40 rounded-xl cursor-grabbing'
          )}
        >
          {activeCard ? <SortableCard card={activeCard} conditionalFormatting={conditionalFormatting} objectFields={objectFields} /> : null}
        </div>
      </DragOverlay>
    </DndContext>
  )
}
