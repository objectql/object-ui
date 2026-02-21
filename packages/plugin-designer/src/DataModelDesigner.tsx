/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { DataModelEntity, DataModelField, DataModelRelationship, DesignerCanvasConfig } from '@object-ui/types';
import { Database, Plus, Trash2, Link2, Undo2, Redo2, Grid3X3, ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronRight, Copy, Clipboard, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDesignerHistory } from './hooks/useDesignerHistory';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import { useMultiSelect } from './hooks/useMultiSelect';
import { useClipboard } from './hooks/useClipboard';
import { useCanvasPanZoom } from './hooks/useCanvasPanZoom';
import { ConfirmDialog } from './components/ConfirmDialog';
import { PropertyEditor, type PropertyField } from './components/PropertyEditor';
import { Minimap } from './components/Minimap';
import { useCollaboration } from './CollaborationProvider';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

/** Supported data field types for the DataModel designer */
const DATA_MODEL_FIELD_TYPES = [
  'text', 'number', 'boolean', 'date', 'datetime', 'uuid',
  'email', 'url', 'phone', 'json', 'integer', 'float',
  'decimal', 'currency', 'percent', 'textarea', 'select',
  'multiselect', 'lookup', 'attachment', 'formula', 'autonumber',
] as const;

/** Arrange entities in a grid layout */
function calculateGridAutoLayout(
  entities: DataModelEntity[],
  columns = 4,
  gapX = 280,
  gapY = 250,
  offsetX = 50,
  offsetY = 50,
): DataModelEntity[] {
  return entities.map((entity, index) => ({
    ...entity,
    position: {
      x: offsetX + (index % columns) * gapX,
      y: offsetY + Math.floor(index / columns) * gapY,
    },
  }));
}

interface DesignerState {
  entities: DataModelEntity[];
  relationships: DataModelRelationship[];
}

export interface DataModelDesignerProps {
  /** Entities in the model */
  entities?: DataModelEntity[];
  /** Relationships between entities */
  relationships?: DataModelRelationship[];
  /** Canvas configuration */
  canvas?: DesignerCanvasConfig;
  /** Show relationship labels */
  showRelationshipLabels?: boolean;
  /** Auto-layout enabled */
  autoLayout?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when entities change */
  onEntitiesChange?: (entities: DataModelEntity[]) => void;
  /** Callback when relationships change */
  onRelationshipsChange?: (relationships: DataModelRelationship[]) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Data model designer for creating ER diagrams.
 * Allows visual design of entities, fields, and relationships.
 * Supports undo/redo, multi-select, copy/paste, pan/zoom, drag-to-reposition,
 * inline field editing, property editor, minimap, auto-layout, and collaboration.
 */
export function DataModelDesigner({
  entities: initialEntities = [],
  relationships: initialRelationships = [],
  canvas = { width: 1200, height: 800, showGrid: true },
  showRelationshipLabels = true,
  readOnly = false,
  onEntitiesChange,
  onRelationshipsChange,
  className,
}: DataModelDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Undo/Redo ---
  const undoRedo = useDesignerHistory<DesignerState>(
    { entities: initialEntities, relationships: initialRelationships },
    { maxHistory: 50 },
  );
  const { entities, relationships } = undoRedo.current;

  const pushState = useCallback(
    (next: DesignerState) => {
      undoRedo.push(next);
      onEntitiesChange?.(next.entities);
      onRelationshipsChange?.(next.relationships);
    },
    [undoRedo, onEntitiesChange, onRelationshipsChange],
  );

  // --- Confirm dialog ---
  const confirmDialog = useConfirmDialog();

  // --- Multi-select ---
  const multiSelect = useMultiSelect();

  // Selected entity for property editor (first selected)
  const selectedEntityId = multiSelect.count > 0
    ? Array.from(multiSelect.selectedIds)[0]
    : null;

  // --- Clipboard ---
  const clipboard = useClipboard<DataModelEntity[]>();

  // --- Pan/Zoom ---
  const panZoom = useCanvasPanZoom({ minZoom: 0.25, maxZoom: 3, zoomStep: 0.1 });

  // --- Collaboration ---
  const collaboration = useCollaboration();

  // --- Collapsible panels ---
  const [showProperties, setShowProperties] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);

  // --- Inline field editing ---
  const [editingField, setEditingField] = useState<{ entityId: string; fieldIndex: number } | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState('');

  // --- Inline entity label editing ---
  const [editingEntityLabel, setEditingEntityLabel] = useState<string | null>(null);
  const [editingEntityLabelValue, setEditingEntityLabelValue] = useState('');

  // --- Drag state ---
  const dragRef = useRef<{ entityId: string; offsetX: number; offsetY: number } | null>(null);

  // --- Handlers ---

  const handleAddEntity = useCallback(() => {
    if (readOnly) return;
    const current = undoRedo.current;
    const newEntity: DataModelEntity = {
      id: `entity-${Date.now()}`,
      name: `new_entity_${current.entities.length + 1}`,
      label: `New Entity ${current.entities.length + 1}`,
      fields: [
        { name: 'id', type: 'uuid', primaryKey: true, required: true },
        { name: 'created_at', type: 'datetime', required: true },
        { name: 'updated_at', type: 'datetime', required: true },
      ],
      position: {
        x: 50 + (current.entities.length % 4) * 280,
        y: 50 + Math.floor(current.entities.length / 4) * 250,
      },
    };
    const next: DesignerState = {
      entities: [...current.entities, newEntity],
      relationships: current.relationships,
    };
    pushState(next);
    multiSelect.selectOne(newEntity.id);
    collaboration?.sendOperation({ type: 'insert', userId: collaboration?.currentUserId ?? '', elementId: newEntity.id, data: { name: newEntity.name, label: newEntity.label } });
  }, [readOnly, undoRedo, pushState, multiSelect, collaboration]);

  const handleDeleteEntity = useCallback(
    async (id: string) => {
      if (readOnly) return;
      const entity = entities.find((e) => e.id === id);
      const confirmed = await confirmDialog.confirm(
        'Delete Entity',
        `Are you sure you want to delete "${entity?.label ?? id}"? This action cannot be undone.`,
      );
      if (!confirmed) return;

      const current = undoRedo.current;
      const next: DesignerState = {
        entities: current.entities.filter((e) => e.id !== id),
        relationships: current.relationships.filter(
          (r) => r.sourceEntity !== id && r.targetEntity !== id,
        ),
      };
      pushState(next);
      if (multiSelect.isSelected(id)) {
        multiSelect.clearSelection();
      }
      collaboration?.sendOperation({ type: 'delete', userId: collaboration?.currentUserId ?? '', elementId: id, data: {} });
    },
    [readOnly, entities, confirmDialog, undoRedo, pushState, multiSelect, collaboration],
  );

  const handleDeleteSelected = useCallback(async () => {
    if (readOnly || multiSelect.count === 0) return;
    const ids = Array.from(multiSelect.selectedIds);
    const confirmed = await confirmDialog.confirm(
      'Delete Entities',
      `Are you sure you want to delete ${ids.length} selected entity(s)? This action cannot be undone.`,
    );
    if (!confirmed) return;

    const current = undoRedo.current;
    const idSet = new Set(ids);
    const next: DesignerState = {
      entities: current.entities.filter((e) => !idSet.has(e.id)),
      relationships: current.relationships.filter(
        (r) => !idSet.has(r.sourceEntity) && !idSet.has(r.targetEntity),
      ),
    };
    pushState(next);
    multiSelect.clearSelection();
  }, [readOnly, multiSelect, confirmDialog, undoRedo, pushState]);

  const handleAutoLayout = useCallback(() => {
    if (readOnly) return;
    const current = undoRedo.current;
    const next: DesignerState = {
      entities: calculateGridAutoLayout(current.entities),
      relationships: current.relationships,
    };
    pushState(next);
  }, [readOnly, undoRedo, pushState]);

  const handleCopy = useCallback(() => {
    const selected = entities.filter((e) => multiSelect.isSelected(e.id));
    if (selected.length > 0) {
      clipboard.copy(selected);
    }
  }, [entities, multiSelect, clipboard]);

  const handlePaste = useCallback(() => {
    if (readOnly) return;
    const items = clipboard.paste();
    if (!items || items.length === 0) return;

    const current = undoRedo.current;
    const pasted = items.map((e, i) => ({
      ...e,
      id: `entity-${Date.now()}-${i}`,
      name: `${e.name}_copy`,
      label: `${e.label} (Copy)`,
      position: { x: e.position.x + 30, y: e.position.y + 30 },
    }));
    const next: DesignerState = {
      entities: [...current.entities, ...pasted],
      relationships: current.relationships,
    };
    pushState(next);
    multiSelect.selectMany(pasted.map((e) => e.id));
  }, [readOnly, clipboard, undoRedo, pushState, multiSelect]);

  // --- Add field to entity ---
  const handleAddField = useCallback(
    (entityId: string) => {
      if (readOnly) return;
      const current = undoRedo.current;
      const next: DesignerState = {
        entities: current.entities.map((e) => {
          if (e.id !== entityId) return e;
          const newField: DataModelField = {
            name: `field_${e.fields.length + 1}`,
            type: 'text',
            required: false,
          };
          return { ...e, fields: [...e.fields, newField] };
        }),
        relationships: current.relationships,
      };
      pushState(next);
    },
    [readOnly, undoRedo, pushState],
  );

  // --- Inline field name editing ---
  const handleStartFieldEdit = useCallback(
    (entityId: string, fieldIndex: number, currentName: string) => {
      if (readOnly) return;
      setEditingField({ entityId, fieldIndex });
      setEditingFieldValue(currentName);
    },
    [readOnly],
  );

  const handleCommitFieldEdit = useCallback(() => {
    if (!editingField) return;
    const trimmed = editingFieldValue.trim();
    if (trimmed === '') {
      setEditingField(null);
      return;
    }
    const current = undoRedo.current;
    const next: DesignerState = {
      entities: current.entities.map((e) => {
        if (e.id !== editingField.entityId) return e;
        const fields = e.fields.map((f, i) =>
          i === editingField.fieldIndex ? { ...f, name: trimmed } : f,
        );
        return { ...e, fields };
      }),
      relationships: current.relationships,
    };
    pushState(next);
    setEditingField(null);
  }, [editingField, editingFieldValue, undoRedo, pushState]);

  const handleCancelFieldEdit = useCallback(() => {
    setEditingField(null);
  }, []);

  // --- Inline entity label editing ---
  const handleStartEntityLabelEdit = useCallback(
    (entityId: string, currentLabel: string) => {
      if (readOnly) return;
      setEditingEntityLabel(entityId);
      setEditingEntityLabelValue(currentLabel);
    },
    [readOnly],
  );

  const handleCommitEntityLabelEdit = useCallback(() => {
    if (!editingEntityLabel) return;
    const trimmed = editingEntityLabelValue.trim();
    if (trimmed === '') {
      setEditingEntityLabel(null);
      return;
    }
    const current = undoRedo.current;
    const next: DesignerState = {
      entities: current.entities.map((e) =>
        e.id === editingEntityLabel ? { ...e, label: trimmed } : e,
      ),
      relationships: current.relationships,
    };
    pushState(next);
    setEditingEntityLabel(null);
  }, [editingEntityLabel, editingEntityLabelValue, undoRedo, pushState]);

  const handleCancelEntityLabelEdit = useCallback(() => {
    setEditingEntityLabel(null);
  }, []);

  // --- Field type change ---
  const handleFieldTypeChange = useCallback(
    (entityId: string, fieldIndex: number, newType: string) => {
      if (readOnly) return;
      const current = undoRedo.current;
      const next: DesignerState = {
        entities: current.entities.map((e) => {
          if (e.id !== entityId) return e;
          const fields = e.fields.map((f, i) =>
            i === fieldIndex ? { ...f, type: newType } : f,
          );
          return { ...e, fields };
        }),
        relationships: current.relationships,
      };
      pushState(next);
    },
    [readOnly, undoRedo, pushState],
  );

  // --- Drag to reposition ---
  const handleDragStart = useCallback(
    (e: React.DragEvent, entityId: string) => {
      if (readOnly) return;
      const entity = entities.find((ent) => ent.id === entityId);
      if (!entity) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      dragRef.current = {
        entityId,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
      };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', entityId);
    },
    [readOnly, entities],
  );

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragRef.current) return;
      const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const zoom = panZoom.zoom;
      const newX = (e.clientX - canvasRect.left - panZoom.panOffset.x) / zoom - dragRef.current.offsetX;
      const newY = (e.clientY - canvasRect.top - panZoom.panOffset.y) / zoom - dragRef.current.offsetY;

      const current = undoRedo.current;
      const next: DesignerState = {
        entities: current.entities.map((ent) =>
          ent.id === dragRef.current!.entityId
            ? { ...ent, position: { x: Math.max(0, Math.round(newX)), y: Math.max(0, Math.round(newY)) } }
            : ent,
        ),
        relationships: current.relationships,
      };
      pushState(next);
      dragRef.current = null;
    },
    [panZoom.zoom, panZoom.panOffset, undoRedo, pushState],
  );

  // --- Property editor fields for selected entity ---
  const selectedEntity = selectedEntityId ? entities.find((e) => e.id === selectedEntityId) : null;
  const propertyFields: PropertyField[] = selectedEntity
    ? [
        { name: 'name', label: 'Name', type: 'text' as const, value: selectedEntity.name, group: 'General' },
        { name: 'label', label: 'Label', type: 'text' as const, value: selectedEntity.label, group: 'General' },
        { name: 'description', label: 'Description', type: 'textarea' as const, value: selectedEntity.description ?? '', group: 'General' },
        { name: 'color', label: 'Color', type: 'color' as const, value: selectedEntity.color ?? '#3b82f6', group: 'Appearance' },
        { name: 'position.x', label: 'X Position', type: 'number' as const, value: selectedEntity.position.x, group: 'Position' },
        { name: 'position.y', label: 'Y Position', type: 'number' as const, value: selectedEntity.position.y, group: 'Position' },
      ]
    : [];

  const handlePropertyChange = useCallback(
    (name: string, value: unknown) => {
      if (!selectedEntityId) return;
      const current = undoRedo.current;
      const next: DesignerState = {
        entities: current.entities.map((e) => {
          if (e.id !== selectedEntityId) return e;
          if (name === 'position.x') return { ...e, position: { ...e.position, x: Number(value) } };
          if (name === 'position.y') return { ...e, position: { ...e.position, y: Number(value) } };
          return { ...e, [name]: value };
        }),
        relationships: current.relationships,
      };
      pushState(next);
    },
    [selectedEntityId, undoRedo, pushState],
  );

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key === 'z') {
        e.preventDefault();
        undoRedo.undo();
      } else if (isCtrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        undoRedo.redo();
      } else if (isCtrl && e.key === 'c') {
        e.preventDefault();
        handleCopy();
      } else if (isCtrl && e.key === 'v') {
        e.preventDefault();
        handlePaste();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && multiSelect.count > 0) {
        e.preventDefault();
        void handleDeleteSelected();
      } else if (e.key === 'Escape') {
        multiSelect.clearSelection();
        setEditingField(null);
        setEditingEntityLabel(null);
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [undoRedo, handleCopy, handlePaste, handleDeleteSelected, multiSelect]);

  // --- Minimap items ---
  const minimapItems = entities.map((e) => ({
    id: e.id,
    x: e.position.x,
    y: e.position.y,
    width: 240,
    height: 40 + e.fields.length * 24,
    color: e.color,
    selected: multiSelect.isSelected(e.id),
  }));

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn('flex h-full w-full border rounded-lg overflow-hidden bg-background', className)}
    >
      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div role="toolbar" aria-label="Designer toolbar" className="flex items-center gap-2 p-2 border-b bg-muted/20 flex-wrap">
          <Database className="h-4 w-4" />
          <span className="font-medium text-sm">Data Model Designer</span>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 ml-2 border-l pl-2">
            <button
              onClick={() => undoRedo.undo()}
              disabled={!undoRedo.canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              className="p-1 rounded hover:bg-accent disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => undoRedo.redo()}
              disabled={!undoRedo.canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Y)"
              className="p-1 rounded hover:bg-accent disabled:opacity-40"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border-l pl-2">
            <button
              onClick={panZoom.zoomOut}
              aria-label="Zoom Out"
              title="Zoom Out"
              className="p-1 rounded hover:bg-accent"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs tabular-nums w-10 text-center">{Math.round(panZoom.zoom * 100)}%</span>
            <button
              onClick={panZoom.zoomIn}
              aria-label="Zoom In"
              title="Zoom In"
              className="p-1 rounded hover:bg-accent"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={panZoom.resetZoom}
              aria-label="Reset Zoom"
              title="Reset Zoom"
              className="p-1 rounded hover:bg-accent"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Copy/Paste */}
          {!readOnly && (
            <div className="flex items-center gap-1 border-l pl-2">
              <button
                onClick={handleCopy}
                disabled={multiSelect.count === 0}
                aria-label="Copy"
                title="Copy (Ctrl+C)"
                className="p-1 rounded hover:bg-accent disabled:opacity-40"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handlePaste}
                disabled={!clipboard.hasContent}
                aria-label="Paste"
                title="Paste (Ctrl+V)"
                className="p-1 rounded hover:bg-accent disabled:opacity-40"
              >
                <Clipboard className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Auto-layout */}
          {!readOnly && (
            <button
              onClick={handleAutoLayout}
              aria-label="Auto Layout"
              title="Auto Layout"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-accent"
            >
              <Grid3X3 className="h-3 w-3" /> Auto Layout
            </button>
          )}

          <div className="flex-1" />

          {/* Collaboration status */}
          {collaboration?.isConnected && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground" role="status" aria-label="Collaboration active">
              <Users className="h-3 w-3" />
              <span>{collaboration.users.length} user{collaboration.users.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Multi-select count */}
          {multiSelect.count > 1 && (
            <span className="text-xs text-muted-foreground">{multiSelect.count} selected</span>
          )}

          {/* Add entity / relationship buttons */}
          {!readOnly && (
            <>
              <button
                onClick={handleAddEntity}
                aria-label="Add Entity"
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-3 w-3" /> Add Entity
              </button>
              <button
                aria-label="Add Relationship"
                title="Add Relationship (coming soon)"
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-secondary text-secondary-foreground hover:bg-secondary/80"
              >
                <Link2 className="h-3 w-3" /> Add Relationship
              </button>
            </>
          )}
        </div>

        {/* Canvas */}
        <div
          role="region"
          aria-label="Canvas"
          className="flex-1 overflow-auto bg-muted/10 p-4 relative"
          onWheel={panZoom.handleWheel}
          onMouseDown={panZoom.startPan}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          <div
            className="relative"
            style={{
              width: canvas.width,
              minHeight: canvas.height,
              ...panZoom.transformStyle,
              backgroundImage: canvas.showGrid
                ? 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)'
                : undefined,
              backgroundSize: canvas.showGrid ? '20px 20px' : undefined,
            }}
          >
            {/* Relationship lines (SVG overlay) */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvas.width}
              height={canvas.height}
            >
              {relationships.map((rel) => {
                const source = entities.find((e) => e.id === rel.sourceEntity);
                const target = entities.find((e) => e.id === rel.targetEntity);
                if (!source || !target) return null;

                return (
                  <g key={rel.id}>
                    <line
                      x1={source.position.x + 120}
                      y1={source.position.y + 50}
                      x2={target.position.x + 120}
                      y2={target.position.y + 50}
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeDasharray={rel.type === 'many-to-many' ? '5,5' : undefined}
                    />
                    {showRelationshipLabels && rel.label && (
                      <text
                        x={(source.position.x + target.position.x) / 2 + 120}
                        y={(source.position.y + target.position.y) / 2 + 50 - 8}
                        textAnchor="middle"
                        className="text-xs fill-muted-foreground"
                      >
                        {rel.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Entity cards */}
            {entities.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                No entities in the model. Click &apos;Add Entity&apos; to create your first entity.
              </div>
            )}
            {entities.map((entity) => (
              <div
                key={entity.id}
                role="group"
                aria-label={entity.label}
                draggable={!readOnly}
                onDragStart={(e) => handleDragStart(e, entity.id)}
                className={cn(
                  'absolute rounded-lg border-2 bg-background shadow-sm w-60 select-none cursor-grab active:cursor-grabbing',
                  multiSelect.isSelected(entity.id)
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50',
                )}
                style={{
                  left: entity.position.x,
                  top: entity.position.y,
                }}
                onClick={(e) => multiSelect.toggle(entity.id, e.shiftKey)}
              >
                {/* Entity header */}
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-t-lg font-medium text-sm"
                  style={{ backgroundColor: entity.color ?? 'hsl(var(--primary) / 0.1)' }}
                >
                  <Database className="h-3.5 w-3.5" />
                  {editingEntityLabel === entity.id ? (
                    <input
                      type="text"
                      value={editingEntityLabelValue}
                      onChange={(e) => setEditingEntityLabelValue(e.target.value)}
                      onBlur={handleCommitEntityLabelEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitEntityLabelEdit();
                        if (e.key === 'Escape') handleCancelEntityLabelEdit();
                      }}
                      className="text-sm font-medium px-1 py-0 border rounded bg-background w-32 focus:outline-none focus:ring-1 focus:ring-primary"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`entity-label-input-${entity.id}`}
                    />
                  ) : (
                    <span
                      className="truncate cursor-text"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartEntityLabelEdit(entity.id, entity.label);
                      }}
                      title="Double-click to edit label"
                      data-testid={`entity-label-${entity.id}`}
                    >
                      {entity.label}
                    </span>
                  )}
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteEntity(entity.id);
                      }}
                      aria-label={`Delete ${entity.label}`}
                      className="ml-auto p-0.5 rounded hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </div>
                {/* Fields */}
                <div className="px-3 py-1 divide-y">
                  {entity.fields.map((field: DataModelField, fieldIndex: number) => (
                    <div
                      key={`${field.name}-${fieldIndex}`}
                      className="flex items-center gap-2 py-1 text-xs"
                    >
                      {editingField &&
                      editingField.entityId === entity.id &&
                      editingField.fieldIndex === fieldIndex ? (
                        <input
                          type="text"
                          value={editingFieldValue}
                          onChange={(e) => setEditingFieldValue(e.target.value)}
                          onBlur={handleCommitFieldEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitFieldEdit();
                            if (e.key === 'Escape') handleCancelFieldEdit();
                          }}
                          className="font-mono text-xs px-1 py-0 border rounded bg-background w-24 focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className={cn(
                            'font-mono cursor-text',
                            field.primaryKey && 'font-bold text-primary',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartFieldEdit(entity.id, fieldIndex, field.name);
                          }}
                          title="Click to edit field name"
                        >
                          {field.primaryKey && (
                            <span className="text-[0.65rem] font-semibold text-primary mr-0.5">PK</span>
                          )}
                          {field.name}
                        </span>
                      )}
                      {!readOnly ? (
                        <select
                          value={field.type}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleFieldTypeChange(entity.id, fieldIndex, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-muted-foreground ml-auto bg-transparent border-none focus:ring-1 focus:ring-primary rounded cursor-pointer p-0"
                          data-testid={`field-type-${entity.id}-${fieldIndex}`}
                        >
                          {DATA_MODEL_FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground ml-auto">{field.type}</span>
                      )}
                      {field.required && <span className="text-destructive">*</span>}
                    </div>
                  ))}
                </div>
                {/* Add field button */}
                {!readOnly && (
                  <div className="px-3 py-1 border-t">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddField(entity.id);
                      }}
                      aria-label={`Add field to ${entity.label}`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full py-0.5"
                    >
                      <Plus className="h-3 w-3" /> Add Field
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Minimap */}
          {showMinimap && entities.length > 0 && (
            <Minimap
              items={minimapItems}
              canvasWidth={canvas.width}
              canvasHeight={canvas.height}
              position="bottom-right"
              size={150}
            />
          )}
        </div>
      </div>

      {/* Right sidebar: Property Editor & Panels */}
      <div className="w-64 border-l flex flex-col bg-background shrink-0">
        {/* Properties panel */}
        <div className="flex flex-col flex-1 min-h-0">
          <button
            onClick={() => setShowProperties((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 border-b"
            aria-expanded={showProperties}
            aria-controls="property-editor-panel"
          >
            {showProperties ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Properties
          </button>
          {showProperties && (
            <div id="property-editor-panel" className="flex-1 overflow-y-auto">
              <PropertyEditor
                title={selectedEntity ? selectedEntity.label : 'Properties'}
                fields={propertyFields}
                onChange={handlePropertyChange}
              />
            </div>
          )}
        </div>

        {/* Minimap toggle */}
        <div className="border-t">
          <button
            onClick={() => setShowMinimap((v) => !v)}
            className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 w-full"
            aria-expanded={showMinimap}
          >
            {showMinimap ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Minimap
          </button>
        </div>
      </div>

      {/* Confirmation dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        destructive
      />
    </div>
  );
}
