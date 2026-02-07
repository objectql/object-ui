/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ICellRendererParams, ICellEditorParams } from 'ag-grid-community';
import type { FieldMetadata } from '@object-ui/types';
import { 
  FieldWidgetCellRenderer, 
  FieldWidgetCellEditor,
  createFieldCellRenderer,
  createFieldCellEditor 
} from './field-renderers';

describe('field-renderers', () => {
  describe('FieldWidgetCellRenderer', () => {
    let renderer: FieldWidgetCellRenderer;

    beforeEach(() => {
      renderer = new FieldWidgetCellRenderer();
    });

    afterEach(() => {
      renderer.destroy();
    });

    it('should initialize with a field widget for supported types', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'test value',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(params);

      expect(renderer.eGui).toBeDefined();
      expect(renderer.eGui.className).toBe('field-widget-cell');
      expect(renderer.root).toBeDefined();
    });

    it('should initialize with fallback for unsupported types', () => {
      const field = {
        name: 'testField',
        label: 'Test Field',
        type: 'unsupported_type',
      } as unknown as FieldMetadata;

      const params = {
        value: 'fallback value',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(params);

      expect(renderer.eGui).toBeDefined();
      expect(renderer.eGui.textContent).toBe('fallback value');
      expect(renderer.root).toBeNull();
    });

    it('should handle null values in fallback mode', () => {
      const field = {
        name: 'testField',
        label: 'Test Field',
        type: 'unsupported_type',
      } as unknown as FieldMetadata;

      const params = {
        value: null,
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(params);

      expect(renderer.eGui.textContent).toBe('');
    });

    it('should return the GUI element', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'test',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(params);
      const gui = renderer.getGui();

      expect(gui).toBe(renderer.eGui);
    });

    it('should refresh with new value for supported field type', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const initParams = {
        value: 'initial value',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(initParams);

      const refreshParams = {
        value: 'updated value',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      const result = renderer.refresh(refreshParams);

      expect(result).toBe(true);
    });

    it('should refresh with new value for unsupported field type', () => {
      const field = {
        name: 'testField',
        label: 'Test Field',
        type: 'unsupported_type',
      } as unknown as FieldMetadata;

      const initParams = {
        value: 'initial value',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(initParams);

      const refreshParams = {
        value: 'updated value',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      const result = renderer.refresh(refreshParams);

      expect(result).toBe(true);
      expect(renderer.eGui.textContent).toBe('updated value');
    });

    it('should clean up root on destroy', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'test',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(params);
      
      const unmountSpy = vi.spyOn(renderer.root!, 'unmount');
      renderer.destroy();

      expect(unmountSpy).toHaveBeenCalled();
    });

    it('should handle destroy when root is null', () => {
      const field = {
        name: 'testField',
        label: 'Test Field',
        type: 'unsupported_type',
      } as unknown as FieldMetadata;

      const params = {
        value: 'test',
        field,
      } as ICellRendererParams & { field: FieldMetadata };

      renderer.init(params);
      
      // Should not throw
      expect(() => renderer.destroy()).not.toThrow();
    });
  });

  describe('FieldWidgetCellEditor', () => {
    let editor: FieldWidgetCellEditor;

    beforeEach(() => {
      editor = new FieldWidgetCellEditor();
    });

    afterEach(() => {
      editor.destroy();
    });

    it('should initialize with a field widget for supported types', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'initial value',
        field,
      } as ICellEditorParams & { field: FieldMetadata };

      editor.init(params);

      expect(editor.eGui).toBeDefined();
      expect(editor.eGui.className).toBe('field-widget-editor');
      expect(editor.root).toBeDefined();
      expect(editor.currentValue).toBe('initial value');
    });

    it('should initialize with fallback input for unsupported types', () => {
      const field = {
        name: 'testField',
        label: 'Test Field',
        type: 'unsupported_type',
      } as unknown as FieldMetadata;

      const params = {
        value: 'fallback value',
        field,
      } as ICellEditorParams & { field: FieldMetadata };

      editor.init(params);

      expect(editor.eGui).toBeDefined();
      expect(editor.root).toBeNull();
      const input = editor.eGui.querySelector('input');
      expect(input).toBeDefined();
      expect(input?.value).toBe('fallback value');
    });

    it('should return current value', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'test value',
        field,
      } as ICellEditorParams & { field: FieldMetadata };

      editor.init(params);

      expect(editor.getValue()).toBe('test value');
    });

    it('should return the GUI element', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'test',
        field,
      } as ICellEditorParams & { field: FieldMetadata };

      editor.init(params);
      const gui = editor.getGui();

      expect(gui).toBe(editor.eGui);
    });

    it('should return true for popup editors for specific field types', () => {
      const popupTypes = ['date', 'datetime', 'select', 'lookup', 'color'] as const;

      popupTypes.forEach(type => {
        const field: FieldMetadata = {
          name: 'testField',
          label: 'Test Field',
          type,
        };

        const params = {
          value: 'test',
          field,
        } as ICellEditorParams & { field: FieldMetadata };

        const testEditor = new FieldWidgetCellEditor();
        testEditor.init(params);

        expect(testEditor.isPopup()).toBe(true);
        testEditor.destroy();
      });
    });

    it('should return false for popup editors for non-popup field types', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'test',
        field,
      } as ICellEditorParams & { field: FieldMetadata };

      editor.init(params);

      expect(editor.isPopup()).toBe(false);
    });

    it('should clean up root on destroy', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const params = {
        value: 'test',
        field,
      } as ICellEditorParams & { field: FieldMetadata };

      editor.init(params);
      
      const unmountSpy = vi.spyOn(editor.root!, 'unmount');
      editor.destroy();

      expect(unmountSpy).toHaveBeenCalled();
    });
  });

  describe('createFieldCellRenderer', () => {
    it('should create a renderer class with field metadata', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const RendererClass = createFieldCellRenderer(field);
      const renderer = new RendererClass();

      const params = {
        value: 'test value',
      } as ICellRendererParams;

      renderer.init(params);

      expect(renderer.eGui).toBeDefined();
      renderer.destroy();
    });
  });

  describe('createFieldCellEditor', () => {
    it('should create an editor class with field metadata', () => {
      const field: FieldMetadata = {
        name: 'testField',
        label: 'Test Field',
        type: 'text',
      };

      const EditorClass = createFieldCellEditor(field);
      const editor = new EditorClass();

      const params = {
        value: 'test value',
      } as ICellEditorParams;

      editor.init(params);

      expect(editor.eGui).toBeDefined();
      editor.destroy();
    });
  });
});
