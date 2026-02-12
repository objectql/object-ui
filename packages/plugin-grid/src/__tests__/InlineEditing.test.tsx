/**
 * InlineEditing Component Tests
 *
 * Tests for the grid inline editing component covering save/cancel,
 * validation feedback, keyboard navigation, and display modes.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { InlineEditing } from '../InlineEditing';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: (props: any) => <svg data-testid="icon-check" {...props} />,
  X: (props: any) => <svg data-testid="icon-x" {...props} />,
}));

// Mock cn utility to pass through classes
vi.mock('@object-ui/components', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('InlineEditing', () => {
  describe('Display mode', () => {
    it('renders the value in display mode by default', () => {
      render(<InlineEditing value="Hello" onSave={vi.fn()} />);

      expect(screen.getByText('Hello')).toBeInTheDocument();
      // Should not show an input
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('shows placeholder when value is empty', () => {
      render(<InlineEditing value="" onSave={vi.fn()} placeholder="Enter text" />);

      expect(screen.getByText('Enter text')).toBeInTheDocument();
    });

    it('shows default placeholder when value is null', () => {
      render(<InlineEditing value={null} onSave={vi.fn()} />);

      expect(screen.getByText('Click to edit')).toBeInTheDocument();
    });

    it('has data-slot="inline-editing" on root', () => {
      const { container } = render(<InlineEditing value="test" onSave={vi.fn()} />);
      expect(container.querySelector('[data-slot="inline-editing"]')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <InlineEditing value="test" onSave={vi.fn()} className="custom-class" />,
      );
      const root = container.querySelector('[data-slot="inline-editing"]');
      expect(root?.className).toContain('custom-class');
    });
  });

  describe('Entering edit mode', () => {
    it('enters edit mode on click', async () => {
      const user = userEvent.setup();
      render(<InlineEditing value="Hello" onSave={vi.fn()} />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Hello');
    });

    it('enters edit mode on Enter key press', () => {
      render(<InlineEditing value="Hello" onSave={vi.fn()} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('enters edit mode on Space key press', () => {
      render(<InlineEditing value="Hello" onSave={vi.fn()} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('starts in edit mode when editing prop is true', () => {
      render(<InlineEditing value="Hello" onSave={vi.fn()} editing={true} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('does not enter edit mode when disabled', async () => {
      const user = userEvent.setup();
      render(<InlineEditing value="Hello" onSave={vi.fn()} disabled />);

      await user.click(screen.getByText('Hello'));

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('Save', () => {
    it('saves on Enter key press', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<InlineEditing value="Hello" onSave={onSave} editing={true} />);

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'World');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('World');
      });
    });

    it('saves on save button click', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<InlineEditing value="Hello" onSave={onSave} editing={true} />);

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Updated');

      await user.click(screen.getByLabelText('Save'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('Updated');
      });
    });

    it('coerces value to number when type is number', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <InlineEditing value={42} onSave={onSave} type="number" editing={true} />,
      );

      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '99');
      await user.click(screen.getByLabelText('Save'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(99);
      });
    });

    it('exits edit mode after successful save', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<InlineEditing value="Hello" onSave={onSave} editing={true} />);

      await user.click(screen.getByLabelText('Save'));

      await waitFor(() => {
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Cancel', () => {
    it('cancels on Escape key press', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(
        <InlineEditing value="Hello" onSave={vi.fn()} onCancel={onCancel} editing={true} />,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, ' extra');
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(onCancel).toHaveBeenCalled();
    });

    it('cancels on cancel button click', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      render(
        <InlineEditing value="Hello" onSave={vi.fn()} onCancel={onCancel} editing={true} />,
      );

      await user.click(screen.getByLabelText('Cancel'));

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(onCancel).toHaveBeenCalled();
    });

    it('restores original value after cancel', async () => {
      const user = userEvent.setup();
      render(
        <InlineEditing value="Original" onSave={vi.fn()} editing={true} />,
      );

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.type(input, 'Changed');
      await user.keyboard('{Escape}');

      // Back to display mode, showing original value
      expect(screen.getByText('Original')).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('shows validation error and prevents save', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const validate = (val: any) =>
        String(val).trim() === '' ? 'Required field' : undefined;

      render(
        <InlineEditing
          value="Hello"
          onSave={onSave}
          validate={validate}
          editing={true}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.click(screen.getByLabelText('Save'));

      expect(screen.getByRole('alert')).toHaveTextContent('Required field');
      expect(onSave).not.toHaveBeenCalled();
      // Should still be in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('clears validation error on input change', async () => {
      const user = userEvent.setup();
      const validate = (val: any) =>
        String(val).trim() === '' ? 'Required field' : undefined;

      render(
        <InlineEditing
          value="Hello"
          onSave={vi.fn()}
          validate={validate}
          editing={true}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.clear(input);
      await user.click(screen.getByLabelText('Save'));

      expect(screen.getByRole('alert')).toBeInTheDocument();

      // Start typing to clear error
      await user.type(input, 'A');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows error returned from onSave', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockReturnValue('Server error');

      render(
        <InlineEditing value="Hello" onSave={onSave} editing={true} />,
      );

      await user.click(screen.getByLabelText('Save'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Server error');
      });
    });

    it('marks input as aria-invalid when error is present', async () => {
      const user = userEvent.setup();
      const validate = () => 'Error';

      render(
        <InlineEditing value="" onSave={vi.fn()} validate={validate} editing={true} />,
      );

      await user.click(screen.getByLabelText('Save'));

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Async save', () => {
    it('handles async onSave', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockResolvedValue(undefined);

      render(<InlineEditing value="Hello" onSave={onSave} editing={true} />);

      await user.click(screen.getByLabelText('Save'));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('Hello');
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      });
    });

    it('shows error when async onSave throws', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));

      render(<InlineEditing value="Hello" onSave={onSave} editing={true} />);

      await user.click(screen.getByLabelText('Save'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Network error');
      });

      // Should still be in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Input types', () => {
    it('renders text input by default', () => {
      render(<InlineEditing value="text" onSave={vi.fn()} editing={true} />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');
    });

    it('renders number input when type is number', () => {
      render(<InlineEditing value={42} onSave={vi.fn()} type="number" editing={true} />);
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
    });

    it('renders email input when type is email', () => {
      render(<InlineEditing value="a@b.com" onSave={vi.fn()} type="email" editing={true} />);
      const input = screen.getByDisplayValue('a@b.com');
      expect(input).toHaveAttribute('type', 'email');
    });
  });

  describe('data-slot attributes', () => {
    it('has correct data-slot attributes in display mode', () => {
      const { container } = render(<InlineEditing value="test" onSave={vi.fn()} />);

      expect(container.querySelector('[data-slot="inline-editing"]')).toBeInTheDocument();
      expect(container.querySelector('[data-slot="inline-editing-display"]')).toBeInTheDocument();
    });

    it('has correct data-slot attributes in edit mode', () => {
      const { container } = render(
        <InlineEditing value="test" onSave={vi.fn()} editing={true} />,
      );

      expect(container.querySelector('[data-slot="inline-editing"]')).toBeInTheDocument();
      expect(container.querySelector('[data-slot="inline-editing-input"]')).toBeInTheDocument();
      expect(container.querySelector('[data-slot="inline-editing-save"]')).toBeInTheDocument();
      expect(container.querySelector('[data-slot="inline-editing-cancel"]')).toBeInTheDocument();
    });
  });
});
