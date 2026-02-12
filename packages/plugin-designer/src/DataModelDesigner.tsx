/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { DataModelEntity, DataModelField, DataModelRelationship, DesignerCanvasConfig } from '@object-ui/types';
import { Database, Plus, Trash2, Link2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
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
  const [entities, setEntities] = useState<DataModelEntity[]>(initialEntities);
  const [relationships, setRelationships] = useState<DataModelRelationship[]>(initialRelationships);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const handleAddEntity = useCallback(() => {
    if (readOnly) return;
    const newEntity: DataModelEntity = {
      id: `entity-${Date.now()}`,
      name: `new_entity_${entities.length + 1}`,
      label: `New Entity ${entities.length + 1}`,
      fields: [
        { name: 'id', type: 'uuid', primaryKey: true, required: true },
        { name: 'created_at', type: 'datetime', required: true },
        { name: 'updated_at', type: 'datetime', required: true },
      ],
      position: { x: 50 + (entities.length % 4) * 280, y: 50 + Math.floor(entities.length / 4) * 250 },
    };
    const updated = [...entities, newEntity];
    setEntities(updated);
    setSelectedEntityId(newEntity.id);
    onEntitiesChange?.(updated);
  }, [entities, readOnly, onEntitiesChange]);

  const handleDeleteEntity = useCallback(
    (id: string) => {
      if (readOnly) return;
      const updatedEntities = entities.filter((e) => e.id !== id);
      const updatedRelationships = relationships.filter(
        (r) => r.sourceEntity !== id && r.targetEntity !== id,
      );
      setEntities(updatedEntities);
      setRelationships(updatedRelationships);
      if (selectedEntityId === id) setSelectedEntityId(null);
      onEntitiesChange?.(updatedEntities);
      onRelationshipsChange?.(updatedRelationships);
    },
    [entities, relationships, selectedEntityId, readOnly, onEntitiesChange, onRelationshipsChange],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedEntityId) {
        e.preventDefault();
        handleDeleteEntity(selectedEntityId);
      } else if (e.key === 'Escape') {
        setSelectedEntityId(null);
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [selectedEntityId, handleDeleteEntity]);

  return (
    <div ref={containerRef} tabIndex={0} className={cn('flex h-full w-full border rounded-lg overflow-hidden bg-background', className)}>
      {/* Toolbar */}
      <div className="flex flex-col w-full">
        <div role="toolbar" className="flex items-center gap-2 p-2 border-b bg-muted/20">
          <Database className="h-4 w-4" />
          <span className="font-medium text-sm">Data Model Designer</span>
          <div className="flex-1" />
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
        <div role="region" aria-label="Canvas" className="flex-1 overflow-auto bg-muted/10 p-4">
          <div
            className="relative"
            style={{
              width: canvas.width,
              minHeight: canvas.height,
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
                className={cn(
                  'absolute rounded-lg border-2 bg-background shadow-sm w-60 select-none',
                  selectedEntityId === entity.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50',
                )}
                style={{
                  left: entity.position.x,
                  top: entity.position.y,
                }}
                onClick={() => setSelectedEntityId(entity.id)}
              >
                {/* Entity header */}
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-t-lg font-medium text-sm"
                  style={{ backgroundColor: entity.color ?? 'hsl(var(--primary) / 0.1)' }}
                >
                  <Database className="h-3.5 w-3.5" />
                  <span className="truncate">{entity.label}</span>
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEntity(entity.id);
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
                  {entity.fields.map((field: DataModelField) => (
                    <div
                      key={field.name}
                      className="flex items-center gap-2 py-1 text-xs"
                    >
                      <span className={cn('font-mono', field.primaryKey && 'font-bold text-primary')}>
                        {field.primaryKey && <span className="text-[0.65rem] font-semibold text-primary mr-0.5">PK</span>}{field.name}
                      </span>
                      <span className="text-muted-foreground ml-auto">{field.type}</span>
                      {field.required && <span className="text-destructive">*</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
