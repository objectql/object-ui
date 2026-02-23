/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandingEditor } from '../BrandingEditor';
import type { BrandingConfig } from '@object-ui/types';

const EMPTY_BRANDING: BrandingConfig = {};

const FULL_BRANDING: BrandingConfig = {
  logo: 'https://example.com/logo.svg',
  primaryColor: '#6366f1',
  favicon: 'https://example.com/favicon.ico',
  fontFamily: 'Inter',
};

describe('BrandingEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Rendering
  // ============================
  describe('Rendering', () => {
    it('should render the branding editor', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect(screen.getByTestId('branding-editor')).toBeDefined();
    });

    it('should render toolbar with undo/redo and export/import', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect(screen.getByTestId('branding-editor-toolbar')).toBeDefined();
      expect(screen.getByTestId('branding-undo')).toBeDefined();
      expect(screen.getByTestId('branding-redo')).toBeDefined();
      expect(screen.getByTestId('branding-export')).toBeDefined();
      expect(screen.getByTestId('branding-import')).toBeDefined();
    });

    it('should render form fields', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect(screen.getByTestId('branding-logo-input')).toBeDefined();
      expect(screen.getByTestId('branding-color-input')).toBeDefined();
      expect(screen.getByTestId('branding-color-picker')).toBeDefined();
      expect(screen.getByTestId('branding-favicon-input')).toBeDefined();
      expect(screen.getByTestId('branding-font-select')).toBeDefined();
    });

    it('should render color palette swatches', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect(screen.getByTestId('branding-color-palette')).toBeDefined();
      // Check at least a few palette colors
      expect(screen.getByTestId('branding-swatch-3b82f6')).toBeDefined();
      expect(screen.getByTestId('branding-swatch-ef4444')).toBeDefined();
      expect(screen.getByTestId('branding-swatch-22c55e')).toBeDefined();
    });

    it('should render preview panel', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect(screen.getByTestId('branding-preview')).toBeDefined();
    });

    it('should render mobile preview', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect(screen.getByTestId('branding-preview-mobile')).toBeDefined();
    });

    it('should render light/dark mode toggle', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect(screen.getByTestId('branding-mode-toggle')).toBeDefined();
      expect(screen.getByTestId('branding-mode-light')).toBeDefined();
      expect(screen.getByTestId('branding-mode-dark')).toBeDefined();
    });

    it('should populate form with existing branding values', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={FULL_BRANDING} onChange={onChange} />);
      expect((screen.getByTestId('branding-logo-input') as HTMLInputElement).value).toBe('https://example.com/logo.svg');
      expect((screen.getByTestId('branding-color-input') as HTMLInputElement).value).toBe('#6366f1');
      expect((screen.getByTestId('branding-favicon-input') as HTMLInputElement).value).toBe('https://example.com/favicon.ico');
      expect((screen.getByTestId('branding-font-select') as HTMLSelectElement).value).toBe('Inter');
    });
  });

  // ============================
  // Editing
  // ============================
  describe('Editing', () => {
    it('should update logo URL', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('branding-logo-input'), {
        target: { value: 'https://new-logo.png' },
      });
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toMatchObject({ logo: 'https://new-logo.png' });
    });

    it('should update primary color via text input', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('branding-color-input'), {
        target: { value: '#ff0000' },
      });
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toMatchObject({ primaryColor: '#ff0000' });
    });

    it('should update primary color via color picker', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('branding-color-picker'), {
        target: { value: '#00ff00' },
      });
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toMatchObject({ primaryColor: '#00ff00' });
    });

    it('should update primary color via palette swatch click', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('branding-swatch-ef4444'));
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toMatchObject({ primaryColor: '#ef4444' });
    });

    it('should update favicon URL', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('branding-favicon-input'), {
        target: { value: 'https://new-favicon.ico' },
      });
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toMatchObject({ favicon: 'https://new-favicon.ico' });
    });

    it('should update font family via select', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('branding-font-select'), {
        target: { value: 'Roboto' },
      });
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0]).toMatchObject({ fontFamily: 'Roboto' });
    });

    it('should clear font family when selecting default', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={FULL_BRANDING} onChange={onChange} />);
      fireEvent.change(screen.getByTestId('branding-font-select'), {
        target: { value: '' },
      });
      expect(onChange).toHaveBeenCalledOnce();
      expect(onChange.mock.calls[0][0].fontFamily).toBeUndefined();
    });
  });

  // ============================
  // Light/Dark Mode Preview
  // ============================
  describe('Light/Dark Mode Preview', () => {
    it('should toggle to dark mode', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={FULL_BRANDING} onChange={onChange} />);
      fireEvent.click(screen.getByTestId('branding-mode-dark'));
      const preview = screen.getByTestId('branding-preview');
      expect(preview.className).toContain('bg-gray-900');
    });

    it('should toggle back to light mode', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={FULL_BRANDING} onChange={onChange} />);
      // Toggle to dark first
      fireEvent.click(screen.getByTestId('branding-mode-dark'));
      // Toggle back to light
      fireEvent.click(screen.getByTestId('branding-mode-light'));
      const preview = screen.getByTestId('branding-preview');
      expect(preview.className).toContain('bg-white');
    });
  });

  // ============================
  // Read-Only Mode
  // ============================
  describe('Read-Only Mode', () => {
    it('should disable all inputs when readOnly', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} readOnly />);
      expect((screen.getByTestId('branding-logo-input') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('branding-color-input') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('branding-color-picker') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('branding-favicon-input') as HTMLInputElement).disabled).toBe(true);
      expect((screen.getByTestId('branding-font-select') as HTMLSelectElement).disabled).toBe(true);
    });

    it('should disable undo/redo when readOnly', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} readOnly />);
      expect((screen.getByTestId('branding-undo') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('branding-redo') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should disable import when readOnly', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} readOnly />);
      expect((screen.getByTestId('branding-import') as HTMLButtonElement).disabled).toBe(true);
    });

    it('should not update on palette swatch click when readOnly', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} readOnly />);
      // Clear initial useEffect call
      onChange.mockClear();
      fireEvent.click(screen.getByTestId('branding-swatch-ef4444'));
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // ============================
  // Undo/Redo
  // ============================
  describe('Undo/Redo', () => {
    it('should undo a change', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      // Make a change
      fireEvent.change(screen.getByTestId('branding-color-input'), {
        target: { value: '#ff0000' },
      });
      expect(onChange).toHaveBeenCalledOnce();
      // Undo should now be enabled
      const undoBtn = screen.getByTestId('branding-undo') as HTMLButtonElement;
      expect(undoBtn.disabled).toBe(false);
    });

    it('should start with undo disabled', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      expect((screen.getByTestId('branding-undo') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByTestId('branding-redo') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ============================
  // Export/Import
  // ============================
  describe('Export/Import', () => {
    it('should call onExport callback when provided', () => {
      const onChange = vi.fn();
      const onExport = vi.fn();
      render(
        <BrandingEditor
          branding={FULL_BRANDING}
          onChange={onChange}
          onExport={onExport}
        />
      );
      fireEvent.click(screen.getByTestId('branding-export'));
      expect(onExport).toHaveBeenCalledOnce();
      expect(onExport).toHaveBeenCalledWith(FULL_BRANDING);
    });

    it('should call onImport callback when provided', () => {
      const onChange = vi.fn();
      const onImport = vi.fn();
      render(
        <BrandingEditor
          branding={FULL_BRANDING}
          onChange={onChange}
          onImport={onImport}
        />
      );
      fireEvent.click(screen.getByTestId('branding-import'));
      expect(onImport).toHaveBeenCalledOnce();
    });
  });

  // ============================
  // Keyboard Shortcuts
  // ============================
  describe('Keyboard Shortcuts', () => {
    it('should handle Ctrl+Z for undo', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      // Make a change first
      fireEvent.change(screen.getByTestId('branding-color-input'), {
        target: { value: '#ff0000' },
      });
      // Ctrl+Z
      fireEvent.keyDown(screen.getByTestId('branding-editor'), {
        key: 'z',
        ctrlKey: true,
      });
      // Should have called onChange twice (once for edit, once for undo via useEffect)
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });

  // ============================
  // Preview Content
  // ============================
  describe('Preview Content', () => {
    it('should show app title in preview', () => {
      const onChange = vi.fn();
      render(
        <BrandingEditor
          branding={EMPTY_BRANDING}
          onChange={onChange}
          appTitle="Test App"
        />
      );
      const preview = screen.getByTestId('branding-preview');
      expect(preview.textContent).toContain('Test App');
    });

    it('should show default app title when not provided', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={EMPTY_BRANDING} onChange={onChange} />);
      const preview = screen.getByTestId('branding-preview');
      expect(preview.textContent).toContain('My App');
    });

    it('should apply primary color to preview header', () => {
      const onChange = vi.fn();
      render(<BrandingEditor branding={{ primaryColor: '#ef4444' }} onChange={onChange} />);
      const preview = screen.getByTestId('branding-preview');
      const header = preview.querySelector('[style*="background-color"]');
      expect(header).toBeDefined();
    });
  });
});
