/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback } from 'react';
import type { ReportDesignerSection, ReportDesignerElement } from '@object-ui/types';
import { FileText, Plus, Trash2, Type, ImageIcon, BarChart3, Table2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

export interface ReportDesignerProps {
  /** Report name */
  reportName?: string;
  /** Data source object */
  objectName?: string;
  /** Page size */
  pageSize?: 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid';
  /** Page orientation */
  orientation?: 'portrait' | 'landscape';
  /** Page margins */
  margins?: { top: number; right: number; bottom: number; left: number };
  /** Report sections */
  sections?: ReportDesignerSection[];
  /** Show toolbar */
  showToolbar?: boolean;
  /** Show property panel */
  showPropertyPanel?: boolean;
  /** Preview mode */
  previewMode?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** Callback when sections change */
  onSectionsChange?: (sections: ReportDesignerSection[]) => void;
  /** Custom CSS class */
  className?: string;
}

const PAGE_SIZES = {
  A4: { width: 595, height: 842 },
  A3: { width: 842, height: 1191 },
  Letter: { width: 612, height: 792 },
  Legal: { width: 612, height: 1008 },
  Tabloid: { width: 792, height: 1224 },
};

/**
 * Report designer for creating printable report layouts.
 * Supports sections (header, detail, footer) with drag-and-drop elements.
 */
export function ReportDesigner({
  reportName = 'Untitled Report',
  objectName,
  pageSize = 'A4',
  orientation = 'portrait',
  margins = { top: 40, right: 40, bottom: 40, left: 40 },
  sections: initialSections = [],
  showToolbar = true,
  showPropertyPanel = true,
  readOnly = false,
  onSectionsChange,
  className,
}: ReportDesignerProps) {
  const [sections, setSections] = useState<ReportDesignerSection[]>(
    initialSections.length > 0
      ? initialSections
      : [
          { type: 'header', height: 80, elements: [] },
          { type: 'detail', height: 400, elements: [], repeat: true },
          { type: 'footer', height: 60, elements: [] },
        ],
  );
  const [selectedElement, setSelectedElement] = useState<string | null>(null);

  const pageDims = PAGE_SIZES[pageSize];
  const pageWidth = orientation === 'landscape' ? pageDims.height : pageDims.width;
  const pageHeight = orientation === 'landscape' ? pageDims.width : pageDims.height;

  const handleAddElement = useCallback(
    (sectionIndex: number, elementType: ReportDesignerElement['type']) => {
      if (readOnly) return;
      const newElement: ReportDesignerElement = {
        id: `elem-${Date.now()}`,
        type: elementType,
        position: { x: margins.left, y: 10, width: 200, height: 30 },
        properties: {
          text: elementType === 'text' ? 'New Text' : undefined,
          field: elementType === 'field' ? 'field_name' : undefined,
        },
      };
      const updated = sections.map((section, i) =>
        i === sectionIndex
          ? { ...section, elements: [...section.elements, newElement] }
          : section,
      );
      setSections(updated);
      setSelectedElement(newElement.id);
      onSectionsChange?.(updated);
    },
    [sections, margins.left, readOnly, onSectionsChange],
  );

  const handleDeleteElement = useCallback(
    (elementId: string) => {
      if (readOnly) return;
      const updated = sections.map((section) => ({
        ...section,
        elements: section.elements.filter((e) => e.id !== elementId),
      }));
      setSections(updated);
      if (selectedElement === elementId) setSelectedElement(null);
      onSectionsChange?.(updated);
    },
    [sections, selectedElement, readOnly, onSectionsChange],
  );

  const getSectionLabel = (type: string) => {
    switch (type) {
      case 'header': return 'Report Header';
      case 'page-header': return 'Page Header';
      case 'group-header': return 'Group Header';
      case 'detail': return 'Detail';
      case 'group-footer': return 'Group Footer';
      case 'page-footer': return 'Page Footer';
      case 'footer': return 'Report Footer';
      default: return type;
    }
  };

  return (
    <div className={cn('flex h-full w-full border rounded-lg overflow-hidden bg-background', className)}>
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        {showToolbar && (
          <div className="flex items-center gap-2 p-2 border-b bg-muted/20">
            <FileText className="h-4 w-4" />
            <span className="font-medium text-sm">{reportName}</span>
            {objectName && (
              <span className="text-xs text-muted-foreground">({objectName})</span>
            )}
            <div className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {pageSize} {orientation}
            </span>
          </div>
        )}

        {/* Report Canvas */}
        <div className="flex-1 overflow-auto bg-muted/10 p-4 flex justify-center">
          <div
            className="bg-white shadow-lg border"
            style={{
              width: pageWidth,
              minHeight: pageHeight,
            }}
          >
            {sections.map((section, sectionIndex) => (
              <div
                key={`${section.type}-${sectionIndex}`}
                className="relative border-b border-dashed border-gray-300"
                style={{ minHeight: section.height }}
              >
                {/* Section label */}
                <div className="absolute left-0 top-0 px-2 py-0.5 bg-muted text-xs text-muted-foreground border-r border-b rounded-br">
                  {getSectionLabel(section.type)}
                  {section.repeat && ' ↻'}
                </div>

                {/* Add element buttons */}
                {!readOnly && (
                  <div className="absolute right-1 top-0 flex items-center gap-0.5">
                    <button
                      onClick={() => handleAddElement(sectionIndex, 'text')}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Add Text"
                    >
                      <Type className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleAddElement(sectionIndex, 'field')}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Add Field"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleAddElement(sectionIndex, 'image')}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Add Image"
                    >
                      <ImageIcon className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleAddElement(sectionIndex, 'chart')}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Add Chart"
                    >
                      <BarChart3 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleAddElement(sectionIndex, 'table')}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Add Table"
                    >
                      <Table2 className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Elements */}
                <div className="relative" style={{ minHeight: section.height, paddingTop: 24 }}>
                  {section.elements.map((element) => (
                    <div
                      key={element.id}
                      className={cn(
                        'absolute border rounded px-2 py-1 text-xs cursor-pointer',
                        selectedElement === element.id
                          ? 'border-primary ring-1 ring-primary/30 bg-primary/5'
                          : 'border-dashed border-gray-400 hover:border-primary/50',
                      )}
                      style={{
                        left: element.position.x,
                        top: (typeof element.position.y === 'number' ? element.position.y : 0) + 24,
                        width: element.position.width,
                        height: element.position.height,
                      }}
                      onClick={() => setSelectedElement(element.id)}
                    >
                      <span className="text-muted-foreground">
                        {element.type === 'text' && (element.properties.text as string ?? 'Text')}
                        {element.type === 'field' && `{${element.properties.field as string ?? 'field'}}`}
                        {element.type === 'image' && '🖼 Image'}
                        {element.type === 'chart' && '📊 Chart'}
                        {element.type === 'table' && '📋 Table'}
                      </span>
                      {!readOnly && selectedElement === element.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteElement(element.id);
                          }}
                          className="absolute -top-2 -right-2 p-0.5 rounded-full bg-destructive text-destructive-foreground shadow"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Property Panel */}
      {showPropertyPanel && (
        <div className="w-56 border-l bg-muted/30 flex flex-col">
          <div className="p-3 border-b font-medium text-sm">Properties</div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedElement ? (
              <div className="space-y-2 text-xs">
                <div className="text-muted-foreground">Element ID: {selectedElement}</div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">
                Select an element to view properties
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
