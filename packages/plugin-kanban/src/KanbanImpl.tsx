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
import { Badge, Card, CardHeader, CardTitle, CardDescription, CardContent, ScrollArea } from "@object-ui/components"
import { useHasDndProvider, useDnd } from "@object-ui/react"

// Utility function to merge class names (inline to avoid external dependency)
const cn = (...classes: (string | undefined)[]) => classes.filter(Boolean).join(' ')

export interface KanbanCard {
  id: string
  title: string
  description?: string
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "destructive" | "outline" }>
  [key: string]: any
}

export interface KanbanColumn {
  id: string
  title: string
  cards: KanbanCard[]
  limit?: number
  className?: string
}

export interface KanbanBoardProps {
  columns: KanbanColumn[]
  onCardMove?: (cardId: string, fromColumnId: string, toColumnId: string, newIndex: number) => void
  className?: string
}

function SortableCard({ card }: { card: KanbanCard }) {
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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} role="listitem" aria-label={card.title}>
      <Card className="mb-2 cursor-grab active:cursor-grabbing border-border bg-card/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 group">
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

function KanbanColumn({
  column,
  cards,
}: {
  column: KanbanColumn
  cards: KanbanCard[]
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
        "flex flex-col w-80 flex-shrink-0 rounded-lg border border-border bg-card/20 backdrop-blur-sm shadow-xl",
        column.className
      )}
    >
      <div className="p-4 border-b border-border/50 bg-muted/20">
        <div className="flex items-center justify-between">
          <h3 id={`kanban-col-${column.id}`} className="font-mono text-sm font-semibold tracking-wider text-primary/90 uppercase">{column.title}</h3>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground" aria-label={`${safeCards.length} cards${column.limit ? ` of ${column.limit} maximum` : ''}`}>
              {safeCards.length}
              {column.limit && ` / ${column.limit}`}
            </span>
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
            {safeCards.map((card) => (
              <SortableCard key={card.id} card={card} />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  )
}

/** Bridge wrapper that reads the ObjectUI DnD context and injects it into KanbanBoardInner. */
function DndBridge({ children }: { children: (dnd: ReturnType<typeof useDnd>) => React.ReactNode }) {
  const dnd = useDnd()
  return <>{children(dnd)}</>
}

export default function KanbanBoard({ columns, onCardMove, className }: KanbanBoardProps) {
  const hasDnd = useHasDndProvider()

  if (hasDnd) {
    return (
      <DndBridge>
        {(dnd) => <KanbanBoardInner columns={columns} onCardMove={onCardMove} className={className} dnd={dnd} />}
      </DndBridge>
    )
  }

  return <KanbanBoardInner columns={columns} onCardMove={onCardMove} className={className} dnd={null} />
}

function KanbanBoardInner({ columns, onCardMove, className, dnd }: KanbanBoardProps & { dnd: ReturnType<typeof useDnd> | null }) {
  const [activeCard, setActiveCard] = React.useState<KanbanCard | null>(null)
  
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
      <div className={cn("flex gap-4 overflow-x-auto p-4", className)} role="region" aria-label="Kanban board">
        {boardColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={column.cards}
          />
        ))}
      </div>
      <DragOverlay>
        <div aria-live="assertive" aria-label={activeCard ? `Dragging ${activeCard.title}` : undefined}>
          {activeCard ? <SortableCard card={activeCard} /> : null}
        </div>
      </DragOverlay>
    </DndContext>
  )
}
