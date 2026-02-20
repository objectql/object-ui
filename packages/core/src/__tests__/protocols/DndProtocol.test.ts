import { describe, it, expect } from 'vitest';
import type { DndConfig, DragItem, DropZone, DragConstraint } from '@object-ui/types';
import {
  resolveDndConfig,
  createDragItemProps,
  createDropZoneProps,
  resolveDragConstraints,
} from '../../protocols/DndProtocol';

describe('DndProtocol', () => {
  // ==========================================================================
  // resolveDndConfig
  // ==========================================================================
  describe('resolveDndConfig', () => {
    it('should apply all defaults for minimal config', () => {
      const config = {} as DndConfig;
      const resolved = resolveDndConfig(config);

      expect(resolved.enabled).toBe(false);
      expect(resolved.sortable).toBe(false);
      expect(resolved.autoScroll).toBe(true);
      expect(resolved.touchDelay).toBe(200);
      expect(resolved.dragItem).toBeUndefined();
      expect(resolved.dropZone).toBeUndefined();
    });

    it('should preserve explicit values', () => {
      const config = {
        enabled: true,
        sortable: true,
        autoScroll: false,
        touchDelay: 500,
      } as DndConfig;
      const resolved = resolveDndConfig(config);

      expect(resolved.enabled).toBe(true);
      expect(resolved.sortable).toBe(true);
      expect(resolved.autoScroll).toBe(false);
      expect(resolved.touchDelay).toBe(500);
    });

    it('should pass through dragItem and dropZone', () => {
      const dragItem = { type: 'card' } as DragItem;
      const dropZone = { accept: ['card'] } as DropZone;
      const config = { dragItem, dropZone } as DndConfig;
      const resolved = resolveDndConfig(config);

      expect(resolved.dragItem).toBe(dragItem);
      expect(resolved.dropZone).toBe(dropZone);
    });
  });

  // ==========================================================================
  // createDragItemProps
  // ==========================================================================
  describe('createDragItemProps', () => {
    it('should return correct props for a basic drag item', () => {
      const item = { type: 'card', label: 'Task card' } as DragItem;
      const props = createDragItemProps(item);

      expect(props.draggable).toBe(true);
      expect(props['aria-roledescription']).toBe('draggable');
      expect(props['aria-label']).toBe('Task card');
      expect(props.role).toBe('listitem');
      expect(props['data-drag-type']).toBe('card');
      expect(props['data-drag-handle']).toBe('element');
      expect(props['data-drag-disabled']).toBe('false');
    });

    it('should set draggable false when disabled', () => {
      const item = { type: 'card', disabled: true } as DragItem;
      const props = createDragItemProps(item);

      expect(props.draggable).toBe(false);
      expect(props['data-drag-disabled']).toBe('true');
    });

    it('should use ariaLabel over label when both provided', () => {
      const item = { type: 'card', label: 'Label', ariaLabel: 'Aria Label' } as DragItem;
      const props = createDragItemProps(item);

      expect(props['aria-label']).toBe('Aria Label');
    });

    it('should handle translation object for ariaLabel', () => {
      const item = {
        type: 'card',
        ariaLabel: { key: 'drag.label', defaultValue: 'Translated label' },
      } as unknown as DragItem;
      const props = createDragItemProps(item);

      expect(props['aria-label']).toBe('Translated label');
    });

    it('should use custom role and handle when provided', () => {
      const item = { type: 'row', role: 'option', handle: 'grip' } as DragItem;
      const props = createDragItemProps(item);

      expect(props.role).toBe('option');
      expect(props['data-drag-handle']).toBe('grip');
    });
  });

  // ==========================================================================
  // createDropZoneProps
  // ==========================================================================
  describe('createDropZoneProps', () => {
    it('should return correct props for a basic drop zone', () => {
      const zone = { accept: ['card', 'task'], label: 'Column' } as unknown as DropZone;
      const props = createDropZoneProps(zone);

      expect(props['aria-dropeffect']).toBe('move');
      expect(props['aria-label']).toBe('Column');
      expect(props.role).toBe('list');
      expect(props['data-drop-accept']).toBe('card,task');
      expect(props['data-drop-highlight']).toBe('true');
    });

    it('should use explicit dropEffect and role', () => {
      const zone = { accept: ['item'], dropEffect: 'copy', role: 'region' } as unknown as DropZone;
      const props = createDropZoneProps(zone);

      expect(props['aria-dropeffect']).toBe('copy');
      expect(props.role).toBe('region');
    });

    it('should set maxItems when provided', () => {
      const zone = { accept: ['card'], maxItems: 10 } as unknown as DropZone;
      const props = createDropZoneProps(zone);

      expect(props['data-drop-max-items']).toBe(10);
    });

    it('should handle ariaLabel as translation object', () => {
      const zone = {
        accept: ['card'],
        ariaLabel: { key: 'drop.label', defaultValue: 'Drop here' },
      } as unknown as DropZone;
      const props = createDropZoneProps(zone);

      expect(props['aria-label']).toBe('Drop here');
    });
  });

  // ==========================================================================
  // resolveDragConstraints
  // ==========================================================================
  describe('resolveDragConstraints', () => {
    it('should return base styles for default axis (both)', () => {
      const constraint = {} as DragConstraint;
      const styles = resolveDragConstraints(constraint);

      expect(styles.position).toBe('relative');
      expect(styles.touchAction).toBe('none');
    });

    it('should set touchAction to pan-y for x axis', () => {
      const constraint = { axis: 'x' } as DragConstraint;
      const styles = resolveDragConstraints(constraint);

      expect(styles.touchAction).toBe('pan-y');
    });

    it('should set touchAction to pan-x for y axis', () => {
      const constraint = { axis: 'y' } as DragConstraint;
      const styles = resolveDragConstraints(constraint);

      expect(styles.touchAction).toBe('pan-x');
    });

    it('should set overflow hidden for parent bounds', () => {
      const constraint = { bounds: 'parent' } as DragConstraint;
      const styles = resolveDragConstraints(constraint);

      expect(styles.overflow).toBe('hidden');
    });

    it('should set grid CSS custom properties', () => {
      const constraint = { grid: [20, 30] } as unknown as DragConstraint;
      const styles = resolveDragConstraints(constraint);

      expect(styles['--drag-grid-x']).toBe('20px');
      expect(styles['--drag-grid-y']).toBe('30px');
    });
  });
});
