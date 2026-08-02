import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DateField } from './widgets/DateField';
import { DateTimeField } from './widgets/DateTimeField';
import { TimeField } from './widgets/TimeField';
import type { FieldWidgetComponentProps } from './widgets/types';

const mockField = {
  name: 'test_field',
  label: 'Test Field',
  type: 'date',
} as any;

const baseProps: FieldWidgetComponentProps<string> = {
  field: mockField,
  value: '',
  onChange: vi.fn(),
  readonly: false,
};

describe('Date/Time Widgets', () => {
    describe('DateField', () => {
        it('renders date input in edit mode', () => {
            const { container } = render(<DateField {...baseProps} />);
            const dateInput = container.querySelector('input[type="date"]');
            expect(dateInput).toBeInTheDocument();
        });

        it('calls onChange when value changes', () => {
            const { container } = render(<DateField {...baseProps} />);
            const input = container.querySelector('input[type="date"]') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '2023-01-01' } });
            expect(baseProps.onChange).toHaveBeenCalledWith('2023-01-01');
        });

        it('renders formatted date in readonly mode', () => {
            render(<DateField {...baseProps} readonly value="2023-01-01" />);
            const date = new Date('2023-01-01');
            expect(screen.getByText(date.toLocaleDateString())).toBeInTheDocument();
            expect(document.querySelector('input')).not.toBeInTheDocument();
        });

        it('renders dash for empty readonly value', () => {
            render(<DateField {...baseProps} readonly value={''} />);
            expect(screen.getByText('—')).toBeInTheDocument();
        });
    });

    describe('DateTimeField', () => {
        it('renders datetime-local input in edit mode', () => {
            const { container } = render(<DateTimeField {...baseProps} />);
            const input = container.querySelector('input[type="datetime-local"]');
            expect(input).toBeInTheDocument();
        });

        it('calls onChange when value changes', () => {
            const { container } = render(<DateTimeField {...baseProps} />);
            const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '2023-01-01T12:00' } });
            expect(baseProps.onChange).toHaveBeenCalledWith('2023-01-01T12:00');
        });

        it('renders formatted datetime in readonly mode', () => {
            const val = '2023-01-01T12:00:00.000Z';
            render(<DateTimeField {...baseProps} readonly value={val} />);
            const date = new Date(val);
            const span = screen.getByText((content) => {
                return content.includes(date.toLocaleDateString());
            });
            expect(span).toBeInTheDocument();
        });
    });

    describe('TimeField', () => {
        it('renders time input in edit mode', () => {
            const { container } = render(<TimeField {...baseProps} />);
            const input = container.querySelector('input[type="time"]');
            expect(input).toBeInTheDocument();
        });

        it('calls onChange when value changes', () => {
            const { container } = render(<TimeField {...baseProps} />);
            const input = container.querySelector('input[type="time"]') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '14:30' } });
            expect(baseProps.onChange).toHaveBeenCalledWith('14:30');
        });

        it('renders value directly in readonly mode', () => {
            render(<TimeField {...baseProps} readonly value="14:30" />);
            expect(screen.getByText('14:30')).toBeInTheDocument();
        });
    });
});
