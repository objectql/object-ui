
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AutoNumberField } from './widgets/AutoNumberField';
import { FormulaField } from './widgets/FormulaField';
import { SummaryField } from './widgets/SummaryField';
import { PercentField } from './widgets/PercentField';
import { ImageField } from './widgets/ImageField';
import { LocationField } from './widgets/LocationField';
import { ObjectField } from './widgets/ObjectField';
import { UserField } from './widgets/UserField';
import { VectorField } from './widgets/VectorField';
import type { FieldWidgetProps } from './widgets/types';

// ------------- Mocks & Setup -------------

const mockField = {
  name: 'test_field',
  label: 'Test Field',
} as any;

const baseProps: FieldWidgetProps<any> = {
  field: mockField,
  value: undefined,
  onChange: vi.fn(),
  readonly: false,
};

describe('Remaining Field Widgets', () => {
  
  // 1. AutoNumberField
  describe('AutoNumberField', () => {
    it('should render value as string', () => {
      render(<AutoNumberField {...baseProps} value={1001} />);
      expect(screen.getByText('1001')).toBeInTheDocument();
    });

    it('should render dash for null value', () => {
      render(<AutoNumberField {...baseProps} value={null as any} />);
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });

  // 2. FormulaField
  describe('FormulaField', () => {
    it('should format return_type=currency', () => {
      const field = { ...mockField, return_type: 'currency' };
      render(<FormulaField {...baseProps} field={field} value={123.456} />);
      // Checks for 2 decimal places
      expect(screen.getByText('123.46')).toBeInTheDocument();
    });

    it('should format return_type=boolean', () => {
      const field = { ...mockField, return_type: 'boolean' };
      render(<FormulaField {...baseProps} field={field} value={true} />);
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
  });

  // 3. SummaryField
  describe('SummaryField', () => {
    it('should render count as integer', () => {
      const field = { ...mockField, summary_type: 'count' };
      render(<SummaryField {...baseProps} field={field} value={42} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render sum with decimals', () => {
      const field = { ...mockField, summary_type: 'sum' };
      render(<SummaryField {...baseProps} field={field} value={10.566} />);
      expect(screen.getByText('10.57')).toBeInTheDocument();
    });
  });

  // 4. PercentField
  describe('PercentField', () => {
    it('should display value * 100 in input', () => {
      render(<PercentField {...baseProps} value={0.5} />);
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('50');
    });

    it('should display formatted value in readonly', () => {
      render(<PercentField {...baseProps} value={0.125} readonly={true} />);
      expect(screen.getByText('12.50%')).toBeInTheDocument();
    });

    it('should call onChange with value / 100', () => {
        const handleChange = vi.fn();
        render(<PercentField {...baseProps} onChange={handleChange} value={0} />);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '75' } });
        expect(handleChange).toHaveBeenCalledWith(0.75);
    });
  });

  // 5. ImageField
  describe('ImageField', () => {
    const images = [
      { url: 'http://example.com/1.jpg', name: 'Img 1' },
      { url: 'http://example.com/2.jpg', name: 'Img 2' }
    ];

    it('should render images in readonly mode', () => {
      render(<ImageField {...baseProps} value={images} readonly={true} />);
      const imgs = screen.getAllByRole('img');
      expect(imgs).toHaveLength(2);
      expect(imgs[0]).toHaveAttribute('src', 'http://example.com/1.jpg');
    });
    
    // Complex interaction omitted for brevity, focusing on render contracts
  });

  // 6. LocationField
  describe('LocationField', () => {
    it('should render lat,long string', () => {
       const loc = { latitude: 34.05, longitude: -118.25 };
       render(<LocationField {...baseProps} value={loc} />);
       const input = screen.getByRole('textbox') as HTMLInputElement;
       expect(input.value).toContain('34.05, -118.25');
    });

    it('should parse string input to object', () => {
        const handleChange = vi.fn();
        render(<LocationField {...baseProps} onChange={handleChange} />);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: '10.5, 20.5' } });
        expect(handleChange).toHaveBeenCalledWith({ latitude: 10.5, longitude: 20.5 });
    });
  });

  // 7. ObjectField
  describe('ObjectField', () => {
    const obj = { foo: 'bar', num: 1 };
    
    it('should render JSON string in readonly', () => {
      render(<ObjectField {...baseProps} value={obj} readonly={true} />);
      // pre tag usually contains formatted JSON
      expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
    });

    it('should parse valid JSON input', () => {
        const handleChange = vi.fn();
        render(<ObjectField {...baseProps} onChange={handleChange} value={obj} />);
        const textarea = screen.getByRole('textbox');
        const newJson = '{"test": true}';
        fireEvent.change(textarea, { target: { value: newJson } });
        expect(handleChange).toHaveBeenCalledWith({ test: true });
    });
  });

  // 8. UserField
  describe('UserField', () => {
    const user = { name: 'Alice Smith', id: 'u1' };
    
    it('should render user avatar in readonly', () => {
       render(<UserField {...baseProps} value={user} readonly={true} />);
       // Avatar fallback logic splits name
       expect(screen.getByText('AS')).toBeInTheDocument();
    });
  });

  // 9. VectorField
  describe('VectorField', () => {
    it('should render vector values', () => {
       const vec = [0.12345, 0.67891, 0.00001];
       render(<VectorField {...baseProps} value={vec} />);
       expect(screen.getByText(/0.1235/)).toBeInTheDocument(); // toFixed(4)
       expect(screen.getByText('(3D)')).toBeInTheDocument();
    });
  });
});
