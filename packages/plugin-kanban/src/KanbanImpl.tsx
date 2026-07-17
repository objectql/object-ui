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
import { createSafeTranslation } from "@object-ui/i18n"
import { Plus } from "lucide-react"

// Utility function to merge class names (inline to avoid external dependency)
const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

// Safe translation hook — falls back to English defaults when no I18nProvider
// is mounted (e.g. plugin-kanban consumed standalone or in unit tests).
const useKanbanT = createSafeTranslation(
  {
    'kanban.addCard': 'Add card',
    'kanban.noCards': 'No cards',
    'kanban.cardTitlePlaceholder': 'Enter card title...',
  },
  'kanban.noCards',
)

const UNCATEGORIZED_LANE = 'Uncategorized'

export interface KanbanCard {
  id: string
  title: string
  description?: string
  /**
   * Synthesized card subtitle (e.g. "Account: Acme · Amount: $150K"). Rendered
   * in preference to `description` so we don't have to overwrite the record's
   * real `description` field — which would corrupt detail-view and edit-form
   * displays once a card is opened.
   */
  cardSubtitle?: string
  /**
   * Structured per-field cells. When provided, the card body renders each
   * field via the unified `@object-ui/fields` cell-renderer pipeline (same
   * as Grid/Gallery), so lookup/user/email/url/phone/boolean/etc. fields
   * keep their semantic styling instead of being flattened to a text join.
   *
   * Takes precedence over `cardSubtitle` / `description` when present.
   */
  cardFieldCells?: Array<{ field: string; label?: string; node: React.ReactNode }>
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline"; colorClass?: string }>
  coverImage?: string
  [key: string]: any
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  limit?: number
  className?: string
}

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
  /** Field name for swimlane rows (2D grouping) */
  swimlaneField?: string
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
): React.CSSProperties {
  return resolveConditionalFormatting(card as Record<string, unknown>, rules as any, scope) as React.CSSProperties
}

function SortableCard({ card, onCardClick, conditionalFormatting }: { card: KanbanCard; onCardClick?: (card: KanbanCard, event?: React.MouseEvent) => void; conditionalFormatting?: ConditionalFormattingRule[] }) {
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
  const cardStyles = getCardStyles(card, conditionalFormatting, predicateScope)

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

function KanbanColumnView({
  column,
  cards,
  onCardClick,
  quickAdd,
  onQuickAdd,
  conditionalFormatting,
  columnStyle,
  suppressEmptyPlaceholder,
}: {
  column: KanbanColumn
  cards: KanbanCard[]
  onCardClick?: (card: KanbanCard, event?: React.MouseEvent) => void
  quickAdd?: boolean
  onQuickAdd?: (columnId: string, title: string) => void
  conditionalFormatting?: ConditionalFormattingRule[]
  /** Container-aware width override from useResizeObserver in KanbanBoardInner. */
  columnStyle?: React.CSSProperties
  /**
   * When the board is globally empty (every column has zero cards), the
   * parent renders a single page-level Empty banner and asks each column
   * to suppress its own dashed "No cards" placeholder so the screen
   * doesn't read as N redundant copies of the same message.
   */
  suppressEmptyPlaceholder?: boolean
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
  // so they don't fight with the container-derived value.
  const widthClasses = columnStyle && columnStyle.width != null
    ? "shrink-0"
    : "w-[85vw] sm:w-80 shrink-0";

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
              {safeCards.length}
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
              <SortableCard key={card.id} card={card} onCardClick={onCardClick} conditionalFormatting={conditionalFormatting} />
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

export default function KanbanBoard({ columns, onCardMove, onCardClick, className, quickAdd, onQuickAdd, coverImageField, conditionalFormatting, swimlaneField }: KanbanBoardProps) {
  const hasDnd = useHasDndProvider()

  if (hasDnd) {
    return (
      <DndBridge>
        {(dnd) => <KanbanBoardInner columns={columns} onCardMove={onCardMove} onCardClick={onCardClick} className={className} dnd={dnd} quickAdd={quickAdd} onQuickAdd={onQuickAdd} coverImageField={coverImageField} conditionalFormatting={conditionalFormatting} swimlaneField={swimlaneField} />}
      </DndBridge>
    )
  }

  return <KanbanBoardInner columns={columns} onCardMove={onCardMove} onCardClick={onCardClick} className={className} dnd={null} quickAdd={quickAdd} onQuickAdd={onQuickAdd} coverImageField={coverImageField} conditionalFormatting={conditionalFormatting} swimlaneField={swimlaneField} />
}

function KanbanBoardInner({ columns, onCardMove, onCardClick, className, dnd, quickAdd, onQuickAdd, coverImageField: _coverImageField, conditionalFormatting, swimlaneField }: KanbanBoardProps & { dnd: ReturnType<typeof useDnd> | null }) {
  const { t } = useKanbanT()
  const [activeCard, setActiveCard] = React.useState<KanbanCard | null>(null)

  /**
   * Container-aware column sizing — replaces hard-coded `w-[85vw] sm:w-80`
   * (viewport-relative) with a width derived from the board's own slot.
   * That way an embedded Kanban (in a panel, drawer, or pop-out window)
   * scales correctly without overflowing or wasting space.
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

  const [boardColumns, setBoardColumns] = React.useState<KanbanColumn[]>(safeColumns)

  React.useEffect(() => {
    setBoardColumns(safeColumns)
  }, [safeColumns])

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
        const isBoardEmpty = totalCardCount === 0 && boardColumns.length > 1;
        return (
      <>
      {isBoardEmpty && (
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
        /* Swimlane (2D) layout */
        <div className={cn("flex flex-col gap-2 px-4 sm:px-6 py-3 sm:py-4 min-w-0 overflow-hidden", className)} role="region" aria-label="Kanban board with swimlanes">
          {/* Column headers */}
          <div className="flex gap-3 sm:gap-4 pl-36 sm:pl-44 overflow-x-auto">
            {boardColumns.map(col => (
              <div key={col.id} className="w-[85vw] sm:w-80 shrink-0 text-center">
                <span className=" text-xs sm:text-sm font-semibold tracking-wider text-primary/90 uppercase">{col.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">({col.cards.length})</span>
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
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => toggleLane(lane)}
                  aria-expanded={!isCollapsed}
                >
                  <span className={cn("transition-transform text-xs", isCollapsed ? "" : "rotate-90")}>▶</span>
                  <span className=" text-xs font-semibold text-muted-foreground uppercase tracking-wider">{lane}</span>
                  <span className=" text-xs text-muted-foreground">({laneCardCount})</span>
                </button>

                {/* Lane content */}
                {!isCollapsed && (
                  <div className="flex gap-3 sm:gap-4 overflow-x-auto px-2 pb-3 pl-36 sm:pl-44">
                    {boardColumns.map(col => {
                      const laneCards = col.cards.filter(c =>
                        (c[swimlaneField!] != null ? String(c[swimlaneField!]) : UNCATEGORIZED_LANE) === lane
                      )
                      return (
                        <div key={col.id} className="w-[85vw] sm:w-80 shrink-0 min-h-[60px] rounded-md bg-card/20 p-2">
                          <SortableContext items={laneCards.map(c => c.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2" role="list" aria-label={`${col.title} - ${lane} cards`}>
                              {laneCards.map(card => (
                                <SortableCard key={card.id} card={card} onCardClick={onCardClick} conditionalFormatting={conditionalFormatting} />
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
              columnStyle={columnInlineStyle}
              suppressEmptyPlaceholder={isBoardEmpty}
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
          {activeCard ? <SortableCard card={activeCard} conditionalFormatting={conditionalFormatting} /> : null}
        </div>
      </DragOverlay>
    </DndContext>
  )
}
