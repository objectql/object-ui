/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppCreationWizard } from '../AppCreationWizard';
import type { ObjectSelection } from '@object-ui/types';

const MOCK_OBJECTS: ObjectSelection[] = [
  { name: 'contacts', label: 'Contacts', icon: 'Users', selected: false },
  { name: 'orders', label: 'Orders', icon: 'ShoppingCart', selected: false },
  { name: 'products', label: 'Products', icon: 'Package', selected: false },
];

const MOCK_TEMPLATES = [
  { id: 'crm', label: 'CRM', description: 'Customer relationship management' },
  { id: 'erp', label: 'ERP', description: 'Enterprise resource planning' },
];

describe('AppCreationWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================
  // Rendering
  // ============================
  describe('Rendering', () => {
    it('should render with default props', () => {
      render(<AppCreationWizard />);
      expect(screen.getByTestId('wizard-step-basic')).toBeDefined();
      expect(screen.getByTestId('wizard-step-objects')).toBeDefined();
      expect(screen.getByTestId('wizard-step-navigation')).toBeDefined();
      expect(screen.getByTestId('wizard-step-branding')).toBeDefined();
    });

    it('should render step 1 content by default', () => {
      render(<AppCreationWizard />);
      expect(screen.getByTestId('wizard-step-basic-content')).toBeDefined();
      expect(screen.getByTestId('app-name-input')).toBeDefined();
      expect(screen.getByTestId('app-title-input')).toBeDefined();
    });

    it('should render cancel button', () => {
      render(<AppCreationWizard />);
      expect(screen.getByTestId('wizard-cancel')).toBeDefined();
    });

    it('should render next button on step 1', () => {
      render(<AppCreationWizard />);
      expect(screen.getByTestId('wizard-next')).toBeDefined();
    });
  });

  // ============================
  // Step 1: Basic Info
  // ============================
  describe('Step 1: Basic Info', () => {
    it('should accept valid snake_case app name', () => {
      render(<AppCreationWizard />);
      const nameInput = screen.getByTestId('app-name-input');
      fireEvent.change(nameInput, { target: { value: 'my_app' } });
      expect((nameInput as HTMLInputElement).value).toBe('my_app');
    });

    it('should show error for invalid app name', () => {
      render(<AppCreationWizard />);
      const nameInput = screen.getByTestId('app-name-input');
      fireEvent.change(nameInput, { target: { value: 'My App' } });
      expect(screen.getByText(/snake_case/)).toBeDefined();
    });

    it('should accept title input', () => {
      render(<AppCreationWizard />);
      const titleInput = screen.getByTestId('app-title-input');
      fireEvent.change(titleInput, { target: { value: 'My Application' } });
      expect((titleInput as HTMLInputElement).value).toBe('My Application');
    });

    it('should render layout options', () => {
      render(<AppCreationWizard />);
      expect(screen.getByTestId('app-layout-sidebar')).toBeDefined();
      expect(screen.getByTestId('app-layout-header')).toBeDefined();
      expect(screen.getByTestId('app-layout-empty')).toBeDefined();
    });

    it('should disable next when name is empty', () => {
      render(<AppCreationWizard />);
      const nextBtn = screen.getByTestId('wizard-next');
      expect(nextBtn.hasAttribute('disabled')).toBe(true);
    });

    it('should disable next when name is invalid', () => {
      render(<AppCreationWizard />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'Bad Name' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'Title' } });
      const nextBtn = screen.getByTestId('wizard-next');
      expect(nextBtn.hasAttribute('disabled')).toBe(true);
    });

    it('should enable next when name and title are valid', () => {
      render(<AppCreationWizard />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'my_app' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'My App' } });
      const nextBtn = screen.getByTestId('wizard-next');
      expect(nextBtn.hasAttribute('disabled')).toBe(false);
    });

    it('should render templates when provided', () => {
      render(<AppCreationWizard templates={MOCK_TEMPLATES} />);
      expect(screen.getByText('CRM')).toBeDefined();
    });
  });

  // ============================
  // Step Navigation
  // ============================
  describe('Step Navigation', () => {
    function goToStep2() {
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'test_app' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    it('should navigate to step 2 on next', () => {
      render(<AppCreationWizard availableObjects={MOCK_OBJECTS} />);
      goToStep2();
      expect(screen.getByTestId('wizard-step-objects-content')).toBeDefined();
    });

    it('should show back button on step 2', () => {
      render(<AppCreationWizard availableObjects={MOCK_OBJECTS} />);
      goToStep2();
      expect(screen.getByTestId('wizard-back')).toBeDefined();
    });

    it('should navigate back to step 1', () => {
      render(<AppCreationWizard availableObjects={MOCK_OBJECTS} />);
      goToStep2();
      fireEvent.click(screen.getByTestId('wizard-back'));
      expect(screen.getByTestId('wizard-step-basic-content')).toBeDefined();
    });

    it('should navigate to step 3 from step 2', () => {
      render(<AppCreationWizard availableObjects={MOCK_OBJECTS} />);
      goToStep2();
      fireEvent.click(screen.getByTestId('wizard-next'));
      expect(screen.getByTestId('wizard-step-navigation-content')).toBeDefined();
    });

    it('should show complete button on last step', () => {
      render(<AppCreationWizard availableObjects={MOCK_OBJECTS} />);
      goToStep2();
      fireEvent.click(screen.getByTestId('wizard-next')); // step 3
      fireEvent.click(screen.getByTestId('wizard-next')); // step 4
      expect(screen.getByTestId('wizard-complete')).toBeDefined();
    });
  });

  // ============================
  // Step 2: Object Selection
  // ============================
  describe('Step 2: Object Selection', () => {
    function renderStep2() {
      render(<AppCreationWizard availableObjects={MOCK_OBJECTS} />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'test_app' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    it('should render object cards', () => {
      renderStep2();
      expect(screen.getByTestId('object-card-contacts')).toBeDefined();
      expect(screen.getByTestId('object-card-orders')).toBeDefined();
      expect(screen.getByTestId('object-card-products')).toBeDefined();
    });

    it('should toggle object selection', () => {
      renderStep2();
      fireEvent.click(screen.getByTestId('object-card-contacts'));
      // Card should be selected (visual feedback)
      expect(screen.getByTestId('object-card-contacts')).toBeDefined();
    });

    it('should render search input', () => {
      renderStep2();
      expect(screen.getByTestId('object-search')).toBeDefined();
    });

    it('should filter objects by search', () => {
      renderStep2();
      fireEvent.change(screen.getByTestId('object-search'), { target: { value: 'contact' } });
      expect(screen.getByTestId('object-card-contacts')).toBeDefined();
      expect(screen.queryByTestId('object-card-orders')).toBeNull();
    });
  });

  // ============================
  // Step 3: Navigation Builder
  // ============================
  describe('Step 3: Navigation Builder', () => {
    function renderStep3WithObjects() {
      render(<AppCreationWizard availableObjects={MOCK_OBJECTS} />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'test_app' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('wizard-next')); // step 2
      // Select objects
      fireEvent.click(screen.getByTestId('object-card-contacts'));
      fireEvent.click(screen.getByTestId('object-card-orders'));
      fireEvent.click(screen.getByTestId('wizard-next')); // step 3
    }

    it('should auto-generate nav items from selected objects', () => {
      renderStep3WithObjects();
      expect(screen.getByTestId('nav-item-contacts')).toBeDefined();
      expect(screen.getByTestId('nav-item-orders')).toBeDefined();
    });

    it('should render add buttons', () => {
      renderStep3WithObjects();
      expect(screen.getByTestId('add-group-btn')).toBeDefined();
      expect(screen.getByTestId('add-url-btn')).toBeDefined();
      expect(screen.getByTestId('add-separator-btn')).toBeDefined();
    });

    it('should add a group nav item', () => {
      renderStep3WithObjects();
      fireEvent.click(screen.getByTestId('add-group-btn'));
      expect(screen.getByText('New Group')).toBeDefined();
    });

    it('should add a URL nav item', () => {
      renderStep3WithObjects();
      fireEvent.click(screen.getByTestId('add-url-btn'));
      expect(screen.getByText('New Link')).toBeDefined();
    });
  });

  // ============================
  // Step 4: Branding
  // ============================
  describe('Step 4: Branding', () => {
    function renderStep4() {
      render(<AppCreationWizard />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'test_app' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'Test' } });
      fireEvent.click(screen.getByTestId('wizard-next')); // step 2
      fireEvent.click(screen.getByTestId('wizard-next')); // step 3
      fireEvent.click(screen.getByTestId('wizard-next')); // step 4
    }

    it('should render branding inputs', () => {
      renderStep4();
      expect(screen.getByTestId('branding-logo-input')).toBeDefined();
      expect(screen.getByTestId('branding-color-input')).toBeDefined();
      expect(screen.getByTestId('branding-favicon-input')).toBeDefined();
    });

    it('should accept logo URL', () => {
      renderStep4();
      const input = screen.getByTestId('branding-logo-input');
      fireEvent.change(input, { target: { value: 'https://example.com/logo.svg' } });
      expect((input as HTMLInputElement).value).toBe('https://example.com/logo.svg');
    });

    it('should accept primary color', () => {
      renderStep4();
      const input = screen.getByTestId('branding-color-input');
      fireEvent.change(input, { target: { value: '#ff5733' } });
      expect((input as HTMLInputElement).value).toBe('#ff5733');
    });
  });

  // ============================
  // Callbacks
  // ============================
  describe('Callbacks', () => {
    it('should call onCancel directly when no changes made', () => {
      const onCancel = vi.fn();
      render(<AppCreationWizard onCancel={onCancel} />);
      fireEvent.click(screen.getByTestId('wizard-cancel'));
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('should show confirm dialog when cancelling with unsaved changes', async () => {
      const onCancel = vi.fn();
      render(<AppCreationWizard onCancel={onCancel} />);
      // Make changes so the wizard has unsaved state
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'my_app' } });
      // Click cancel
      fireEvent.click(screen.getByTestId('wizard-cancel'));
      // Should show confirm dialog, not call onCancel yet
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.getByTestId('cancel-confirm-dialog')).toBeDefined();
    });

    it('should call onCancel after confirming discard', async () => {
      const onCancel = vi.fn();
      render(<AppCreationWizard onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'my_app' } });
      fireEvent.click(screen.getByTestId('wizard-cancel'));
      // Click discard in confirm dialog
      fireEvent.click(screen.getByTestId('cancel-confirm-discard'));
      await waitFor(() => {
        expect(onCancel).toHaveBeenCalledOnce();
      });
    });

    it('should not call onCancel after keeping editing', async () => {
      const onCancel = vi.fn();
      render(<AppCreationWizard onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'my_app' } });
      fireEvent.click(screen.getByTestId('wizard-cancel'));
      // Click keep editing
      fireEvent.click(screen.getByTestId('cancel-confirm-keep'));
      expect(onCancel).not.toHaveBeenCalled();
      // Dialog should be gone
      expect(screen.queryByTestId('cancel-confirm-dialog')).toBeNull();
    });

    it('should call onComplete with draft on complete', () => {
      const onComplete = vi.fn();
      render(<AppCreationWizard onComplete={onComplete} />);
      // Fill step 1
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'test_app' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'Test App' } });
      // Navigate to step 4
      fireEvent.click(screen.getByTestId('wizard-next')); // step 2
      fireEvent.click(screen.getByTestId('wizard-next')); // step 3
      fireEvent.click(screen.getByTestId('wizard-next')); // step 4
      // Complete
      fireEvent.click(screen.getByTestId('wizard-complete'));
      expect(onComplete).toHaveBeenCalledOnce();
      expect(onComplete.mock.calls[0][0]).toMatchObject({
        name: 'test_app',
        title: 'Test App',
      });
    });
  });

  // ============================
  // Save Draft
  // ============================
  describe('Save Draft', () => {
    it('should render save draft button when onSaveDraft is provided', () => {
      const onSaveDraft = vi.fn();
      render(<AppCreationWizard onSaveDraft={onSaveDraft} />);
      expect(screen.getByTestId('wizard-save-draft')).toBeDefined();
    });

    it('should not render save draft button when onSaveDraft is not provided', () => {
      render(<AppCreationWizard />);
      expect(screen.queryByTestId('wizard-save-draft')).toBeNull();
    });

    it('should call onSaveDraft with current draft', () => {
      const onSaveDraft = vi.fn();
      render(<AppCreationWizard onSaveDraft={onSaveDraft} />);
      fireEvent.change(screen.getByTestId('app-name-input'), { target: { value: 'my_app' } });
      fireEvent.change(screen.getByTestId('app-title-input'), { target: { value: 'Draft App' } });
      fireEvent.click(screen.getByTestId('wizard-save-draft'));
      expect(onSaveDraft).toHaveBeenCalledOnce();
      expect(onSaveDraft.mock.calls[0][0]).toMatchObject({
        name: 'my_app',
        title: 'Draft App',
      });
    });
  });

  // ============================
  // i18n Integration
  // ============================
  describe('i18n Integration', () => {
    it('should display translated labels via fallback (no provider)', () => {
      render(<AppCreationWizard />);
      // Step labels should render with fallback English
      expect(screen.getByText('Basic Info')).toBeDefined();
      // Form labels
      expect(screen.getByText(/App Name/)).toBeDefined();
      expect(screen.getByText(/Title/)).toBeDefined();
    });

    it('should display translated button text via fallback', () => {
      render(<AppCreationWizard />);
      expect(screen.getByText('Cancel')).toBeDefined();
      expect(screen.getByText('Next')).toBeDefined();
    });

    it('should display translated layout options', () => {
      render(<AppCreationWizard />);
      expect(screen.getByText('Sidebar')).toBeDefined();
      expect(screen.getByText('Header')).toBeDefined();
      expect(screen.getByText('Empty')).toBeDefined();
    });
  });

  // ============================
  // Read-only Mode
  // ============================
  describe('Read-only Mode', () => {
    it('should disable inputs in read-only mode', () => {
      render(<AppCreationWizard readOnly />);
      const nameInput = screen.getByTestId('app-name-input') as HTMLInputElement;
      expect(nameInput.disabled).toBe(true);
    });

    it('should disable next button in read-only mode', () => {
      render(<AppCreationWizard readOnly />);
      const nextBtn = screen.getByTestId('wizard-next');
      expect(nextBtn.hasAttribute('disabled')).toBe(true);
    });
  });
});
