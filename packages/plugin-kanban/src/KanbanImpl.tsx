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
import { Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, ScrollArea, Button, Input } from "@object-ui/components"
import { useHasDndProvider, useDnd } from "@object-ui/react"
import { Plus } from "lucide-react"

// Utility function to merge class names (inline to avoid external dependency)
const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')

const UNCATEGORIZED_LANE = 'Uncategorized'

export interface KanbanCard {
  id: string
  title: string
  description?: string
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline" }>
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

export interface ConditionalFormattingRule {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'in'
  value: string | string[]
  backgroundColor?: string
  borderColor?: string
}

export interface KanbanBoardProps {
  columns: KanbanColumn[]
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void
  onCardClick?: (card: KanbanCard) => void
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
function getCardStyles(card: KanbanCard, rules?: ConditionalFormattingRule[]): React.CSSProperties {
  if (!rules || rules.length === 0) return {}

  for (const rule of rules) {
    const fieldValue = card[rule.field]
    if (fieldValue === undefined || fieldValue === null) continue

    let matches = false
    const strValue = String(fieldValue)

    switch (rule.operator) {
      case 'equals':
        matches = strValue === String(rule.value)
        break
      case 'not_equals':
        matches = strValue !== String(rule.value)
        break
      case 'contains':
        matches = strValue.toLowerCase().includes(String(rule.value).toLowerCase())
        break
      case 'in':
        matches = Array.isArray(rule.value) && rule.value.includes(strValue)
        break
    }

    if (matches) {
      return {
        ...(rule.backgroundColor ? { backgroundColor: rule.backgroundColor } : {}),
        ...(rule.borderColor ? { borderColor: rule.borderColor } : {}),
      }
    }
  }
  return {}
}

function SortableCard({ card, onCardClick, conditionalFormatting }: { card: KanbanCard; onCardClick?: (card: KanbanCard) => void; conditionalFormatting?: ConditionalFormattingRule[] }) {
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

  const cardStyles = getCardStyles(card, conditionalFormatting)

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} role="listitem" aria-label={card.title}
      onClick={() => onCardClick?.(card)}
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
        <CardHeader className="p-2 sm:p-4">
          <CardTitle className="text-xs sm:text-sm font-medium font-mono tracking-tight text-foreground group-hover:text-primary transition-colors">{card.title}</CardTitle>
          {card.description && (
            <CardDescription className="text-xs text-muted-foreground font-mono line-clamp-2 sm:line-clamp-none">
              {card.description}
            </CardDescription>
          )}
        </CardHeader>
        {card.badges && card.badges.length > 0 && (
          <CardContent className="p-2 sm:p-4 pt-0">
            <div className="flex flex-wrap gap-1">
              {card.badges.map((badge, index) => (
                <Badge key={index} variant={badge.variant || "default"} className="text-xs">
                  {badge.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function QuickAddForm({ columnId, onAdd }: { columnId: string; onAdd: (columnId: string, title: string) => void }) {
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
        Add Card
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
        placeholder="Enter card title..."
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
}: {
  column: KanbanColumn
  cards: KanbanCard[]
  onCardClick?: (card: KanbanCard) => void
  quickAdd?: boolean
  onQuickAdd?: (columnId: string, title: string) => void
  conditionalFormatting?: ConditionalFormattingRule[]
}) {
  const safeCards = cards || [];
  const { setNodeRef } = useSortable({
    id: column.id,
    data: {
      type: "column",
    },
  })

  const isLimitExceeded = column.limit && safeCards.length >= column.limit

  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={column.title}
      className={cn(
        "flex flex-col w-[85vw] sm:w-80 flex-shrink-0 rounded-lg border border-border bg-card/20 backdrop-blur-sm shadow-xl snap-start",
        column.className
      )}
    >
      <div className="p-3 sm:p-4 border-b border-border/50 bg-muted/30 rounded-t-lg">
        <div className="flex items-center justify-between">
          <h3 id={`kanban-col-${column.id}`} className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-primary/90 uppercase truncate">{column.title}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-mono tabular-nums">
              {safeCards.length}
              {column.limit && ` / ${column.limit}`}
            </Badge>
            {isLimitExceeded && (
              <Badge variant="destructive" className="text-xs">
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
            {safeCards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                <span className="text-xs font-mono">No cards</span>
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

function KanbanBoardInner({ columns, onCardMove, onCardClick, className, dnd, quickAdd, onQuickAdd, coverImageField, conditionalFormatting, swimlaneField }: KanbanBoardProps & { dnd: ReturnType<typeof useDnd> | null }) {
  const [activeCard, setActiveCard] = React.useState<KanbanCard | null>(null)

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex sm:hidden items-center justify-between px-3 pb-2 text-xs text-muted-foreground">
        <span>{boardColumns.length} columns</span>
        <span>← Swipe to navigate →</span>
      </div>

      {swimlanes ? (
        /* Swimlane (2D) layout */
        <div className={cn("flex flex-col gap-1 p-2 sm:p-4", className)} role="region" aria-label="Kanban board with swimlanes">
          {/* Column headers */}
          <div className="flex gap-3 sm:gap-4 pl-36 sm:pl-44 overflow-x-auto">
            {boardColumns.map(col => (
              <div key={col.id} className="w-[85vw] sm:w-80 flex-shrink-0 text-center">
                <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-primary/90 uppercase">{col.title}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">({col.cards.length})</span>
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
                  <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">{lane}</span>
                  <span className="font-mono text-xs text-muted-foreground">({laneCardCount})</span>
                </button>

                {/* Lane content */}
                {!isCollapsed && (
                  <div className="flex gap-3 sm:gap-4 overflow-x-auto px-2 pb-3 pl-36 sm:pl-44">
                    {boardColumns.map(col => {
                      const laneCards = col.cards.filter(c =>
                        (c[swimlaneField!] != null ? String(c[swimlaneField!]) : UNCATEGORIZED_LANE) === lane
                      )
                      return (
                        <div key={col.id} className="w-[85vw] sm:w-80 flex-shrink-0 min-h-[60px] rounded-md bg-card/20 p-2">
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
        <div className={cn("flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory p-2 sm:p-4 bg-muted/10 rounded-lg [-webkit-overflow-scrolling:touch]", className)} role="region" aria-label="Kanban board">
          {boardColumns.map((column) => (
            <KanbanColumnView
              key={column.id}
              column={column}
              cards={column.cards}
              onCardClick={onCardClick}
              quickAdd={quickAdd}
              onQuickAdd={onQuickAdd}
              conditionalFormatting={conditionalFormatting}
            />
          ))}
        </div>
      )}

      <DragOverlay>
        <div aria-live="assertive" aria-label={activeCard ? `Dragging ${activeCard.title}` : undefined}>
          {activeCard ? <SortableCard card={activeCard} conditionalFormatting={conditionalFormatting} /> : null}
        </div>
      </DragOverlay>
    </DndContext>
  )
}
