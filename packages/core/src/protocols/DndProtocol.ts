/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - DnD Protocol Bridge
 *
 * Converts spec-aligned DnD configuration schemas into runtime-usable
 * component props and CSS constraint styles for drag-and-drop interactions.
 *
 * @module protocols/DndProtocol
 * @packageDocumentation
 */

import type { DndConfig, DragItem, DropZone, DragConstraint } from '@object-ui/types';

// ============================================================================
// Resolved Types
// ============================================================================

/** Fully resolved DnD configuration with all defaults applied. */
export interface ResolvedDndConfig {
  enabled: boolean;
  sortable: boolean;
  autoScroll: boolean;
  touchDelay: number;
  dragItem?: DragItem;
  dropZone?: DropZone;
}

/** Component props for a draggable element. */
export interface DragItemProps {
  draggable: boolean;
  'aria-roledescription': string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  role: string;
  'data-drag-type': string;
  'data-drag-handle': string;
  'data-drag-disabled': string;
}

/** Component props for a droppable area. */
export interface DropZoneProps {
  'aria-dropeffect': string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  role: string;
  'data-drop-accept': string;
  'data-drop-max-items'?: number;
  'data-drop-highlight': string;
}

/** CSS constraint styles for drag movement. */
export interface DragConstraintStyles {
  position: string;
  touchAction: string;
  [key: string]: string | number | undefined;
}

// ============================================================================
// DnD Config Resolution
// ============================================================================

/**
 * Resolve a DnD configuration by applying spec defaults to missing fields.
 *
 * @param config - Partial DnD configuration from the spec
 * @returns Fully resolved DnD configuration
 */
export function resolveDndConfig(config: DndConfig): ResolvedDndConfig {
  return {
    enabled: config.enabled ?? false,
    sortable: config.sortable ?? false,
    autoScroll: config.autoScroll ?? true,
    touchDelay: config.touchDelay ?? 200,
    dragItem: config.dragItem,
    dropZone: config.dropZone,
  };
}

// ============================================================================
// Drag Item Props
// ============================================================================

/**
 * Convert a spec DragItem to component props suitable for a draggable element.
 * Produces `draggable`, ARIA attributes, and data attributes for DnD libraries.
 *
 * @param item - DragItem configuration from the spec
 * @returns Component props object for a draggable element
 */
export function createDragItemProps(item: DragItem): DragItemProps {
  const ariaLabel = typeof item.ariaLabel === 'string'
    ? item.ariaLabel
    : item.ariaLabel?.defaultValue;

  const label = typeof item.label === 'string'
    ? item.label
    : item.label?.defaultValue;

  return {
    draggable: !(item.disabled ?? false),
    'aria-roledescription': 'draggable',
    'aria-label': ariaLabel ?? label,
    'aria-describedby': item.ariaDescribedBy,
    role: item.role ?? 'listitem',
    'data-drag-type': item.type,
    'data-drag-handle': item.handle ?? 'element',
    'data-drag-disabled': String(item.disabled ?? false),
  };
}

// ============================================================================
// Drop Zone Props
// ============================================================================

/**
 * Convert a spec DropZone to component props suitable for a droppable area.
 * Produces ARIA attributes and data attributes for DnD libraries.
 *
 * @param zone - DropZone configuration from the spec
 * @returns Component props object for a droppable area
 */
export function createDropZoneProps(zone: DropZone): DropZoneProps {
  const ariaLabel = typeof zone.ariaLabel === 'string'
    ? zone.ariaLabel
    : zone.ariaLabel?.defaultValue;

  const label = typeof zone.label === 'string'
    ? zone.label
    : zone.label?.defaultValue;

  return {
    'aria-dropeffect': zone.dropEffect ?? 'move',
    'aria-label': ariaLabel ?? label,
    'aria-describedby': zone.ariaDescribedBy,
    role: zone.role ?? 'list',
    'data-drop-accept': zone.accept.join(','),
    'data-drop-max-items': zone.maxItems,
    'data-drop-highlight': String(zone.highlightOnDragOver ?? true),
  };
}

// ============================================================================
// Drag Constraint Styles
// ============================================================================

/**
 * Resolve a DragConstraint into CSS style properties that restrict
 * drag movement along an axis or within bounds.
 *
 * @param constraint - DragConstraint configuration from the spec
 * @returns CSS styles object for constraining drag movement
 */
export function resolveDragConstraints(constraint: DragConstraint): DragConstraintStyles {
  const styles: DragConstraintStyles = {
    position: 'relative',
    touchAction: 'none',
  };

  const axis = constraint.axis ?? 'both';
  if (axis === 'x') {
    styles.touchAction = 'pan-y';
  } else if (axis === 'y') {
    styles.touchAction = 'pan-x';
  }

  const bounds = constraint.bounds ?? 'none';
  if (bounds === 'parent') {
    styles.overflow = 'hidden';
  }

  if (constraint.grid) {
    styles['--drag-grid-x'] = `${constraint.grid[0]}px`;
    styles['--drag-grid-y'] = `${constraint.grid[1]}px`;
  }

  return styles;
}
