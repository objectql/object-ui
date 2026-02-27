/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NavigationOverlay } from '../custom/navigation-overlay';
import type { NavigationOverlayProps } from '../custom/navigation-overlay';

// Helper to create default props
function createProps(overrides: Partial<NavigationOverlayProps> = {}): NavigationOverlayProps {
  return {
    isOpen: true,
    selectedRecord: { _id: '1', name: 'Test Record', email: 'test@example.com' },
    mode: 'drawer',
    close: vi.fn(),
    setIsOpen: vi.fn(),
    isOverlay: true,
    children: (record: Record<string, unknown>) => (
      <div data-testid="record-content">
        <span>{String(record.name)}</span>
      </div>
    ),
    ...overrides,
  };
}

describe('NavigationOverlay', () => {
  // ============================================================
  // Non-overlay modes
  // ============================================================

  describe('non-overlay modes', () => {
    it('should render nothing for mode: page', () => {
      const { container } = render(
        <NavigationOverlay {...createProps({ mode: 'page' })} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('should render nothing for mode: new_window', () => {
      const { container } = render(
        <NavigationOverlay {...createProps({ mode: 'new_window' })} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('should render nothing for mode: none', () => {
      const { container } = render(
        <NavigationOverlay {...createProps({ mode: 'none' })} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('should render nothing when selectedRecord is null', () => {
      const { container } = render(
        <NavigationOverlay {...createProps({ selectedRecord: null })} />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  // ============================================================
  // Drawer mode (Sheet)
  // ============================================================

  describe('drawer mode', () => {
    it('should render Sheet with record content', () => {
      render(<NavigationOverlay {...createProps({ mode: 'drawer' })} />);
      expect(screen.getByText('Test Record')).toBeInTheDocument();
    });

    it('should render title', () => {
      render(
        <NavigationOverlay
          {...createProps({ mode: 'drawer', title: 'Contact Detail' })}
        />
      );
      expect(screen.getByText('Contact Detail')).toBeInTheDocument();
    });

    it('should render description when provided', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'drawer',
            title: 'Detail',
            description: 'View record details',
          })}
        />
      );
      expect(screen.getByText('View record details')).toBeInTheDocument();
    });

    it('should use default title when none provided', () => {
      render(<NavigationOverlay {...createProps({ mode: 'drawer' })} />);
      expect(screen.getByText('Record Detail')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Modal mode (Dialog)
  // ============================================================

  describe('modal mode', () => {
    it('should render Dialog with record content', () => {
      render(<NavigationOverlay {...createProps({ mode: 'modal' })} />);
      expect(screen.getByText('Test Record')).toBeInTheDocument();
    });

    it('should render title in dialog', () => {
      render(
        <NavigationOverlay
          {...createProps({ mode: 'modal', title: 'Account Detail' })}
        />
      );
      expect(screen.getByText('Account Detail')).toBeInTheDocument();
    });

    it('should render description in dialog', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'modal',
            description: 'View account information',
          })}
        />
      );
      expect(screen.getByText('View account information')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Split mode (ResizablePanelGroup)
  // ============================================================

  describe('split mode', () => {
    it('should render split panels with main content and record detail', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'split',
            mainContent: <div data-testid="main">Main Content</div>,
          })}
        />
      );
      expect(screen.getByTestId('main')).toBeInTheDocument();
      expect(screen.getByText('Test Record')).toBeInTheDocument();
    });

    it('should render nothing when mainContent is not provided', () => {
      const { container } = render(
        <NavigationOverlay
          {...createProps({ mode: 'split', mainContent: undefined })}
        />
      );
      expect(container.innerHTML).toBe('');
    });

    it('should render close button in split panel', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'split',
            mainContent: <div>Main</div>,
          })}
        />
      );
      expect(screen.getByLabelText('Close panel')).toBeInTheDocument();
    });

    it('should call close when close button clicked', () => {
      const close = vi.fn();
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'split',
            close,
            mainContent: <div>Main</div>,
          })}
        />
      );

      fireEvent.click(screen.getByLabelText('Close panel'));
      expect(close).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Popover mode
  // ============================================================

  describe('popover mode', () => {
    it('should render popover with record content when open', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'popover',
            popoverTrigger: <button>Trigger</button>,
          })}
        />
      );
      expect(screen.getByText('Test Record')).toBeInTheDocument();
    });

    it('should render title in popover', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'popover',
            title: 'Quick View',
          })}
        />
      );
      expect(screen.getByText('Quick View')).toBeInTheDocument();
    });

    it('should render fallback dialog when no popoverTrigger is provided', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'popover',
            title: 'Preview',
          })}
        />
      );
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Test Record')).toBeInTheDocument();
    });

    it('should not render fallback dialog when closed and no popoverTrigger', () => {
      const { container } = render(
        <NavigationOverlay
          {...createProps({
            mode: 'popover',
            isOpen: false,
          })}
        />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  // ============================================================
  // Width handling
  // ============================================================

  describe('width handling', () => {
    it('should render drawer with string width without error', () => {
      render(
        <NavigationOverlay
          {...createProps({ mode: 'drawer', width: '600px' })}
        />
      );
      expect(screen.getByText('Test Record')).toBeInTheDocument();
    });

    it('should render modal with numeric width without error', () => {
      render(
        <NavigationOverlay
          {...createProps({ mode: 'modal', width: 800 })}
        />
      );
      expect(screen.getByText('Test Record')).toBeInTheDocument();
    });
  });

  // ============================================================
  // Children render prop
  // ============================================================

  describe('children render prop', () => {
    it('should pass the selected record to children', () => {
      const record = { _id: '42', name: 'Jane Doe', status: 'active' };
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'drawer',
            selectedRecord: record,
            children: (r: Record<string, unknown>) => (
              <div>
                <span data-testid="name">{String(r.name)}</span>
                <span data-testid="status">{String(r.status)}</span>
              </div>
            ),
          })}
        />
      );
      expect(screen.getByTestId('name')).toHaveTextContent('Jane Doe');
      expect(screen.getByTestId('status')).toHaveTextContent('active');
    });
  });

  // ============================================================
  // renderView support
  // ============================================================

  describe('renderView support', () => {
    it('should use renderView when both renderView and view are provided', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'drawer',
            view: 'contact-detail',
            renderView: (record, viewName) => (
              <div data-testid="custom-view">
                <span data-testid="view-name">{viewName}</span>
                <span data-testid="record-name">{String(record.name)}</span>
              </div>
            ),
          })}
        />
      );
      expect(screen.getByTestId('custom-view')).toBeInTheDocument();
      expect(screen.getByTestId('view-name')).toHaveTextContent('contact-detail');
      expect(screen.getByTestId('record-name')).toHaveTextContent('Test Record');
      // Children should NOT be rendered
      expect(screen.queryByTestId('record-content')).not.toBeInTheDocument();
    });

    it('should fallback to children when renderView is provided but view is not', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'drawer',
            renderView: (_record, _viewName) => (
              <div data-testid="custom-view">Should not appear</div>
            ),
          })}
        />
      );
      // Children should be rendered since view is undefined
      expect(screen.getByTestId('record-content')).toBeInTheDocument();
      expect(screen.queryByTestId('custom-view')).not.toBeInTheDocument();
    });

    it('should fallback to children when view is provided but renderView is not', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'drawer',
            view: 'contact-detail',
          })}
        />
      );
      // Children should be rendered since renderView is undefined
      expect(screen.getByTestId('record-content')).toBeInTheDocument();
    });

    it('should use renderView in modal mode', () => {
      render(
        <NavigationOverlay
          {...createProps({
            mode: 'modal',
            view: 'edit-form',
            renderView: (record, viewName) => (
              <div data-testid="modal-custom-view">{viewName}: {String(record.name)}</div>
            ),
          })}
        />
      );
      expect(screen.getByTestId('modal-custom-view')).toHaveTextContent('edit-form: Test Record');
    });
  });
});
