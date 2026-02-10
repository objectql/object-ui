/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
  DesignerComponent,
  DesignerCanvasConfig,
  DesignerPaletteCategory,
} from '@object-ui/types';
import { GripVertical, Undo2, Redo2, Eye, Layers, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

export interface PageDesignerProps {
  /** Canvas configuration */
  canvas?: DesignerCanvasConfig;
  /** Initial components */
  components?: DesignerComponent[];
  /** Component palette categories */
  palette?: DesignerPaletteCategory[];
  /** Show component tree panel */
  showComponentTree?: boolean;
  /** Enable undo/redo */
  undoRedo?: boolean;
  /** Property editor */
  propertyEditor?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when components change */
  onChange?: (components: DesignerComponent[]) => void;
  /** Custom CSS class */
  className?: string;
}

/**
 * Drag-and-drop page designer component.
 * Allows visual composition of UI components on a canvas.
 */
export function PageDesigner({
  canvas = { width: 1200, height: 800, gridSize: 8, showGrid: true, snapToGrid: true },
  components: initialComponents = [],
  palette = DEFAULT_PALETTE,
  showComponentTree = true,
  undoRedo = true,
  readOnly = false,
  onChange,
  className,
}: PageDesignerProps) {
  const [components, setComponents] = useState<DesignerComponent[]>(initialComponents);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, _setZoom] = useState(canvas.zoom ?? 1);

  const selectedComponent = useMemo(
    () => components.find((c) => c.id === selectedId),
    [components, selectedId],
  );

  const handleAddComponent = useCallback(
    (type: string, label: string) => {
      if (readOnly) return;
      const newComponent: DesignerComponent = {
        id: `comp-${Date.now()}`,
        type,
        label,
        position: { x: 100, y: 100, width: 200, height: 100 },
        props: {},
      };
      const updated = [...components, newComponent];
      setComponents(updated);
      setSelectedId(newComponent.id);
      onChange?.(updated);
    },
    [components, readOnly, onChange],
  );

  const handleDeleteComponent = useCallback(
    (id: string) => {
      if (readOnly) return;
      const updated = components.filter((c) => c.id !== id);
      setComponents(updated);
      if (selectedId === id) setSelectedId(null);
      onChange?.(updated);
    },
    [components, selectedId, readOnly, onChange],
  );

  return (
    <div className={cn('flex h-full w-full border rounded-lg overflow-hidden bg-background', className)}>
      {/* Left Panel - Component Palette */}
      {!readOnly && (
        <div className="w-60 border-r bg-muted/30 flex flex-col">
          <div className="p-3 border-b font-medium text-sm">Components</div>
          <div className="flex-1 overflow-y-auto p-2">
            {palette.map((category) => (
              <div key={category.name} className="mb-3">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase">
                  {category.label}
                </div>
                {category.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleAddComponent(item.type, item.label)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent text-left"
                  >
                    <Plus className="h-3 w-3" />
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 border-b bg-muted/20">
          {undoRedo && !readOnly && (
            <>
              <button className="p-1.5 rounded hover:bg-accent" title="Undo">
                <Undo2 className="h-4 w-4" />
              </button>
              <button className="p-1.5 rounded hover:bg-accent" title="Redo">
                <Redo2 className="h-4 w-4" />
              </button>
              <div className="w-px h-5 bg-border mx-1" />
            </>
          )}
          <button className="p-1.5 rounded hover:bg-accent" title="Preview">
            <Eye className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto bg-muted/10 p-4">
          <div
            className="relative bg-background border rounded shadow-sm mx-auto"
            style={{
              width: canvas.width * zoom,
              height: canvas.height * zoom,
              backgroundImage: canvas.showGrid
                ? `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`
                : undefined,
              backgroundSize: canvas.showGrid && canvas.gridSize
                ? `${canvas.gridSize * zoom}px ${canvas.gridSize * zoom}px`
                : undefined,
            }}
          >
            {components.map((comp) => (
              <div
                key={comp.id}
                className={cn(
                  'absolute border rounded cursor-move select-none transition-shadow',
                  selectedId === comp.id
                    ? 'border-primary ring-2 ring-primary/20 shadow-md'
                    : 'border-border hover:border-primary/50',
                )}
                style={{
                  left: comp.position.x * zoom,
                  top: comp.position.y * zoom,
                  width: typeof comp.position.width === 'number' ? comp.position.width * zoom : comp.position.width,
                  height: typeof comp.position.height === 'number' ? comp.position.height * zoom : comp.position.height,
                }}
                onClick={() => setSelectedId(comp.id)}
              >
                <div className="flex items-center gap-1 px-2 py-1 bg-muted/50 text-xs border-b">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate">{comp.label ?? comp.type}</span>
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteComponent(comp.id);
                      }}
                      className="ml-auto p-0.5 rounded hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </button>
                  )}
                </div>
                <div className="p-2 text-xs text-muted-foreground">
                  {comp.type}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Component Tree / Properties */}
      {showComponentTree && (
        <div className="w-60 border-l bg-muted/30 flex flex-col">
          <div className="p-3 border-b font-medium text-sm flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Component Tree
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {components.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">
                No components added yet
              </div>
            ) : (
              components.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => setSelectedId(comp.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded text-left',
                    selectedId === comp.id ? 'bg-accent' : 'hover:bg-accent/50',
                  )}
                >
                  <span className="truncate">{comp.label ?? comp.type}</span>
                </button>
              ))
            )}
          </div>
          {selectedComponent && (
            <div className="border-t p-3">
              <div className="text-xs font-medium mb-2">Properties</div>
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Type: {selectedComponent.type}</div>
                <div>ID: {selectedComponent.id}</div>
                <div>
                  Position: {selectedComponent.position.x}, {selectedComponent.position.y}
                </div>
                <div>
                  Size: {selectedComponent.position.width} × {selectedComponent.position.height}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEFAULT_PALETTE: DesignerPaletteCategory[] = [
  {
    name: 'layout',
    label: 'Layout',
    items: [
      { type: 'container', label: 'Container', defaultSize: { width: 400, height: 300 } },
      { type: 'flex', label: 'Flex', defaultSize: { width: 400, height: 200 } },
      { type: 'grid', label: 'Grid', defaultSize: { width: 400, height: 300 } },
      { type: 'card', label: 'Card', defaultSize: { width: 300, height: 200 } },
      { type: 'tabs', label: 'Tabs', defaultSize: { width: 400, height: 300 } },
    ],
  },
  {
    name: 'form',
    label: 'Form',
    items: [
      { type: 'input', label: 'Input', defaultSize: { width: 300, height: 60 } },
      { type: 'textarea', label: 'Textarea', defaultSize: { width: 300, height: 120 } },
      { type: 'select', label: 'Select', defaultSize: { width: 300, height: 60 } },
      { type: 'checkbox', label: 'Checkbox', defaultSize: { width: 200, height: 40 } },
      { type: 'button', label: 'Button', defaultSize: { width: 120, height: 40 } },
    ],
  },
  {
    name: 'data',
    label: 'Data',
    items: [
      { type: 'table', label: 'Table', defaultSize: { width: 600, height: 400 } },
      { type: 'chart', label: 'Chart', defaultSize: { width: 400, height: 300 } },
      { type: 'list', label: 'List', defaultSize: { width: 300, height: 400 } },
      { type: 'statistic', label: 'Statistic', defaultSize: { width: 200, height: 100 } },
    ],
  },
];
