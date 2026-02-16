/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
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
import { Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input } from "@object-ui/components"
import { ChevronDown, ChevronRight, AlertTriangle, Plus } from "lucide-react"

const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')

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
  collapsed?: boolean
}

export interface ConditionalFormattingRule {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'in'
  value: string | string[]
  backgroundColor?: string
  borderColor?: string
}

export interface KanbanEnhancedProps {
  columns: KanbanColumn[]
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void
  onColumnToggle?: (columnId: string, collapsed: boolean) => void
  enableVirtualScrolling?: boolean
  virtualScrollThreshold?: number
  className?: string
  quickAdd?: boolean
  onQuickAdd?: (columnId: string, title: string) => void
  conditionalFormatting?: ConditionalFormattingRule[]
}

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

function SortableCard({ card, conditionalFormatting }: { card: KanbanCard; conditionalFormatting?: ConditionalFormattingRule[] }) {
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-2 cursor-grab active:cursor-grabbing border-border bg-card/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group" style={cardStyles}>
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
        <CardHeader className="p-4">
          <CardTitle className="text-sm font-medium font-mono tracking-tight text-foreground group-hover:text-primary transition-colors">{card.title}</CardTitle>
          {card.description && (
            <CardDescription className="text-xs text-muted-foreground font-mono">
              {card.description}
            </CardDescription>
          )}
        </CardHeader>
        {card.badges && card.badges.length > 0 && (
          <CardContent className="p-4 pt-0">
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

function VirtualizedCardList({ cards, parentRef, conditionalFormatting }: { cards: KanbanCard[]; parentRef: React.RefObject<HTMLDivElement | null>; conditionalFormatting?: ConditionalFormattingRule[] }) {
  const rowVirtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  })

  return (
    <div
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualItem) => {
        const card = cards[virtualItem.index]
        return (
          <div
            key={card.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <SortableCard card={card} conditionalFormatting={conditionalFormatting} />
          </div>
        )
      })}
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

function KanbanColumnEnhanced({
  column,
  cards,
  onToggle,
  enableVirtual,
  quickAdd,
  onQuickAdd,
  conditionalFormatting,
}: {
  column: KanbanColumn
  cards: KanbanCard[]
  onToggle: (collapsed: boolean) => void
  enableVirtual: boolean
  quickAdd?: boolean
  onQuickAdd?: (columnId: string, title: string) => void
  conditionalFormatting?: ConditionalFormattingRule[]
}) {
  const safeCards = cards || []
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const { setNodeRef } = useSortable({
    id: column.id,
    data: {
      type: "column",
    },
  })

  const isLimitExceeded = column.limit && safeCards.length >= column.limit
  const isNearLimit = column.limit && safeCards.length >= column.limit * 0.8

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col flex-shrink-0 rounded-lg border border-border bg-card/20 backdrop-blur-sm shadow-xl transition-all",
        column.collapsed ? "w-16" : "w-80",
        column.className
      )}
    >
      <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggle(!column.collapsed)}
          >
            {column.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {!column.collapsed && (
            <>
              <h3 className="font-mono text-sm font-semibold tracking-wider text-primary/90 uppercase truncate">
                {column.title}
              </h3>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "font-mono text-xs",
                  isLimitExceeded ? "text-destructive" : isNearLimit ? "text-yellow-500" : "text-muted-foreground"
                )}>
                  {safeCards.length}
                  {column.limit && ` / ${column.limit}`}
                </span>
                {isLimitExceeded && (
                  <Badge variant="destructive" className="text-xs">
                    Full
                  </Badge>
                )}
                {isNearLimit && !isLimitExceeded && (
                  <AlertTriangle className="h-3 w-3 text-yellow-500" />
                )}
              </div>
            </>
          )}
        </div>
        {column.collapsed && (
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-xs font-bold text-primary/90 [writing-mode:vertical-rl] rotate-180">
              {column.title}
            </span>
            <Badge variant="secondary" className="text-xs">
              {safeCards.length}
            </Badge>
          </div>
        )}
      </div>
      {!column.collapsed && (
        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto" style={{ maxHeight: '600px' }}>
          <SortableContext
            items={safeCards.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {enableVirtual ? (
              <VirtualizedCardList cards={safeCards} parentRef={scrollRef} conditionalFormatting={conditionalFormatting} />
            ) : (
              <div className="space-y-2">
                {safeCards.map((card) => (
                  <SortableCard key={card.id} card={card} conditionalFormatting={conditionalFormatting} />
                ))}
              </div>
            )}
          </SortableContext>
          {quickAdd && onQuickAdd && (
            <QuickAddForm columnId={column.id} onAdd={onQuickAdd} />
          )}
        </div>
      )}
    </div>
  )
}

export function KanbanEnhanced({
  columns,
  onCardMove,
  onColumnToggle,
  enableVirtualScrolling = false,
  virtualScrollThreshold = 50,
  className,
  quickAdd,
  onQuickAdd,
  conditionalFormatting,
}: KanbanEnhancedProps) {
  const [activeCard, setActiveCard] = React.useState<KanbanCard | null>(null)
  
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const card = findCard(active.id as string)
    setActiveCard(card)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    if (activeId === overId) return

    const activeColumn = findColumnByCardId(activeId)
    const overColumn = findColumnByCardId(overId) || findColumnById(overId)

    if (!activeColumn || !overColumn) return

    if (activeColumn.id === overColumn.id) {
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
      const activeCards = [...activeColumn.cards]
      const overCards = [...overColumn.cards]
      const activeIndex = activeCards.findIndex((c) => c.id === activeId)
      
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

  const handleColumnToggle = React.useCallback((columnId: string, collapsed: boolean) => {
    setBoardColumns(prev => 
      prev.map(col => col.id === columnId ? { ...col, collapsed } : col)
    )
    onColumnToggle?.(columnId, collapsed)
  }, [onColumnToggle])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("flex gap-4 overflow-x-auto p-4", className)}>
        {boardColumns.map((column) => {
          const shouldUseVirtual = enableVirtualScrolling && column.cards.length > virtualScrollThreshold
          return (
            <KanbanColumnEnhanced
              key={column.id}
              column={column}
              cards={column.cards}
              onToggle={(collapsed) => handleColumnToggle(column.id, collapsed)}
              enableVirtual={shouldUseVirtual}
              quickAdd={quickAdd}
              onQuickAdd={onQuickAdd}
              conditionalFormatting={conditionalFormatting}
            />
          )
        })}
      </div>
      <DragOverlay>
        {activeCard ? <SortableCard card={activeCard} conditionalFormatting={conditionalFormatting} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

export default KanbanEnhanced;
