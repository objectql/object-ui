/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigPanelRenderer } from '../custom/config-panel-renderer';
import type { ConfigPanelSchema } from '../types/config-panel';

const basicSchema: ConfigPanelSchema = {
  breadcrumb: ['Settings', 'General'],
  sections: [
    {
      key: 'basic',
      title: 'Basic Settings',
      fields: [
        { key: 'name', label: 'Name', type: 'input' },
        { key: 'enabled', label: 'Enabled', type: 'switch' },
      ],
    },
  ],
};

const collapsibleSchema: ConfigPanelSchema = {
  breadcrumb: ['Dashboard'],
  sections: [
    {
      key: 'layout',
      title: 'Layout',
      fields: [
        { key: 'columns', label: 'Columns', type: 'input' },
      ],
    },
    {
      key: 'appearance',
      title: 'Appearance',
      collapsible: true,
      defaultCollapsed: true,
      fields: [
        { key: 'theme', label: 'Theme', type: 'input' },
      ],
    },
    {
      key: 'data',
      title: 'Data',
      collapsible: true,
      fields: [
        { key: 'source', label: 'Source', type: 'input' },
      ],
    },
  ],
};

const conditionalSchema: ConfigPanelSchema = {
  breadcrumb: ['Config'],
  sections: [
    {
      key: 'main',
      title: 'Main',
      fields: [
        { key: 'mode', label: 'Mode', type: 'input' },
      ],
    },
    {
      key: 'advanced',
      title: 'Advanced',
      visibleWhen: (draft) => draft.mode === 'advanced',
      fields: [
        { key: 'setting', label: 'Setting', type: 'input' },
      ],
    },
  ],
};

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  draft: { name: 'Test', enabled: true },
  isDirty: false,
  onFieldChange: vi.fn(),
  onSave: vi.fn(),
  onDiscard: vi.fn(),
};

describe('ConfigPanelRenderer', () => {
  describe('rendering', () => {
    it('should render nothing when closed', () => {
      const { container } = render(
        <ConfigPanelRenderer {...defaultProps} schema={basicSchema} open={false} />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('should render panel when open', () => {
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} />);
      expect(screen.getByTestId('config-panel')).toBeDefined();
    });

    it('should render breadcrumb segments', () => {
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} />);
      expect(screen.getByText('Settings')).toBeDefined();
      expect(screen.getByText('General')).toBeDefined();
    });

    it('should render section titles', () => {
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} />);
      expect(screen.getByText('Basic Settings')).toBeDefined();
    });

    it('should render field labels', () => {
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} />);
      expect(screen.getByText('Name')).toBeDefined();
      expect(screen.getByText('Enabled')).toBeDefined();
    });

    it('should render close button', () => {
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} />);
      expect(screen.getByTestId('config-panel-close')).toBeDefined();
    });

    it('should render header extra content', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={basicSchema}
          headerExtra={<span data-testid="extra">Extra</span>}
        />,
      );
      expect(screen.getByTestId('extra')).toBeDefined();
    });
  });

  describe('close behavior', () => {
    it('should call onClose when close button clicked', () => {
      const onClose = vi.fn();
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} onClose={onClose} />);
      fireEvent.click(screen.getByTestId('config-panel-close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('dirty state & footer', () => {
    it('should not show footer when not dirty', () => {
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} isDirty={false} />);
      expect(screen.queryByTestId('config-panel-footer')).toBeNull();
    });

    it('should show footer with save/discard when dirty', () => {
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} isDirty={true} />);
      expect(screen.getByTestId('config-panel-footer')).toBeDefined();
      expect(screen.getByTestId('config-panel-save')).toBeDefined();
      expect(screen.getByTestId('config-panel-discard')).toBeDefined();
    });

    it('should call onSave when save clicked', () => {
      const onSave = vi.fn();
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} isDirty={true} onSave={onSave} />);
      fireEvent.click(screen.getByTestId('config-panel-save'));
      expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('should call onDiscard when discard clicked', () => {
      const onDiscard = vi.fn();
      render(<ConfigPanelRenderer {...defaultProps} schema={basicSchema} isDirty={true} onDiscard={onDiscard} />);
      fireEvent.click(screen.getByTestId('config-panel-discard'));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it('should support custom save/discard labels', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={basicSchema}
          isDirty={true}
          saveLabel="Apply"
          discardLabel="Reset"
        />,
      );
      expect(screen.getByText('Apply')).toBeDefined();
      expect(screen.getByText('Reset')).toBeDefined();
    });
  });

  describe('collapsible sections', () => {
    it('should show defaultCollapsed section as collapsed', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={collapsibleSchema}
          draft={{ columns: '3', theme: 'dark', source: 'api' }}
        />,
      );
      // Appearance is defaultCollapsed, so Theme should not be visible
      expect(screen.queryByText('Theme')).toBeNull();
      // Data is collapsible but not defaultCollapsed, so Source should be visible
      expect(screen.getByText('Source')).toBeDefined();
      // Layout is not collapsible, so Columns should be visible
      expect(screen.getByText('Columns')).toBeDefined();
    });

    it('should toggle collapsible section on click', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={collapsibleSchema}
          draft={{ columns: '3', theme: 'dark', source: 'api' }}
        />,
      );
      // Appearance is collapsed by default
      expect(screen.queryByText('Theme')).toBeNull();

      // Click to expand
      fireEvent.click(screen.getByTestId('section-header-appearance'));
      expect(screen.getByText('Theme')).toBeDefined();

      // Click to collapse again
      fireEvent.click(screen.getByTestId('section-header-appearance'));
      expect(screen.queryByText('Theme')).toBeNull();
    });

    it('should toggle non-defaultCollapsed section', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={collapsibleSchema}
          draft={{ columns: '3', theme: 'dark', source: 'api' }}
        />,
      );
      // Data is expanded by default
      expect(screen.getByText('Source')).toBeDefined();

      // Click to collapse
      fireEvent.click(screen.getByTestId('section-header-data'));
      expect(screen.queryByText('Source')).toBeNull();

      // Click to expand again
      fireEvent.click(screen.getByTestId('section-header-data'));
      expect(screen.getByText('Source')).toBeDefined();
    });

    it('should use aria-expanded on collapsible sections', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={collapsibleSchema}
          draft={{ columns: '3', theme: 'dark', source: 'api' }}
        />,
      );
      const appearance = screen.getByTestId('section-header-appearance');
      expect(appearance.getAttribute('aria-expanded')).toBe('false');

      const data = screen.getByTestId('section-header-data');
      expect(data.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('conditional sections', () => {
    it('should hide section when visibleWhen returns false', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={conditionalSchema}
          draft={{ mode: 'simple' }}
        />,
      );
      expect(screen.getByText('Main')).toBeDefined();
      expect(screen.queryByText('Advanced')).toBeNull();
    });

    it('should show section when visibleWhen returns true', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={conditionalSchema}
          draft={{ mode: 'advanced' }}
        />,
      );
      expect(screen.getByText('Main')).toBeDefined();
      expect(screen.getByText('Advanced')).toBeDefined();
    });
  });

  describe('section hints', () => {
    it('should render section hint text', () => {
      const schemaWithHint: ConfigPanelSchema = {
        breadcrumb: ['Test'],
        sections: [
          {
            key: 'sec',
            title: 'Section',
            hint: 'This is a helpful hint',
            fields: [{ key: 'x', label: 'X', type: 'input' }],
          },
        ],
      };
      render(<ConfigPanelRenderer {...defaultProps} schema={schemaWithHint} />);
      expect(screen.getByText('This is a helpful hint')).toBeDefined();
    });
  });

  describe('field change propagation', () => {
    it('should call onFieldChange when a field changes', () => {
      const onFieldChange = vi.fn();
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={basicSchema}
          onFieldChange={onFieldChange}
        />,
      );
      const nameInput = screen.getByTestId('config-field-name');
      fireEvent.change(nameInput, { target: { value: 'NewName' } });
      expect(onFieldChange).toHaveBeenCalledWith('name', 'NewName');
    });
  });

  describe('expandedSections prop', () => {
    it('should override defaultCollapsed when section is in expandedSections', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={collapsibleSchema}
          draft={{ columns: '3', theme: 'dark', source: 'api' }}
          expandedSections={['appearance']}
        />,
      );
      // Appearance is defaultCollapsed=true but expandedSections overrides it
      expect(screen.getByText('Theme')).toBeDefined();
    });

    it('should not affect sections not in expandedSections', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={collapsibleSchema}
          draft={{ columns: '3', theme: 'dark', source: 'api' }}
          expandedSections={['appearance']}
        />,
      );
      // Data section is not in expandedSections, should remain expanded (its default)
      expect(screen.getByText('Source')).toBeDefined();
    });

    it('should allow local toggle to still work alongside expandedSections', () => {
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={collapsibleSchema}
          draft={{ columns: '3', theme: 'dark', source: 'api' }}
          expandedSections={['appearance']}
        />,
      );
      // Appearance is forced expanded by expandedSections
      expect(screen.getByText('Theme')).toBeDefined();

      // Data section can still be toggled locally
      expect(screen.getByText('Source')).toBeDefined();
      fireEvent.click(screen.getByTestId('section-header-data'));
      expect(screen.queryByText('Source')).toBeNull();
    });
  });

  describe('disabledWhen on fields', () => {
    it('should disable input field when disabledWhen returns true', () => {
      const schemaWithDisabledWhen: ConfigPanelSchema = {
        breadcrumb: ['Test'],
        sections: [
          {
            key: 'sec',
            title: 'Section',
            fields: [
              {
                key: 'name',
                label: 'Name',
                type: 'input',
                disabledWhen: (draft) => draft.locked === true,
              },
            ],
          },
        ],
      };
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={schemaWithDisabledWhen}
          draft={{ name: 'Test', locked: true }}
        />,
      );
      const input = screen.getByTestId('config-field-name');
      expect((input as HTMLInputElement).disabled).toBe(true);
    });

    it('should enable input field when disabledWhen returns false', () => {
      const schemaWithDisabledWhen: ConfigPanelSchema = {
        breadcrumb: ['Test'],
        sections: [
          {
            key: 'sec',
            title: 'Section',
            fields: [
              {
                key: 'name',
                label: 'Name',
                type: 'input',
                disabledWhen: (draft) => draft.locked === true,
              },
            ],
          },
        ],
      };
      render(
        <ConfigPanelRenderer
          {...defaultProps}
          schema={schemaWithDisabledWhen}
          draft={{ name: 'Test', locked: false }}
        />,
      );
      const input = screen.getByTestId('config-field-name');
      expect((input as HTMLInputElement).disabled).toBe(false);
    });
  });
});
