/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailSection, getResponsiveSpanClass } from '../DetailSection';

describe('DetailSection', () => {
  it('should render text fields as plain text', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'name', label: 'Name', type: 'text' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ name: 'Alice' }} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render date fields formatted (not raw ISO)', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'order_date', label: 'Order Date', type: 'date' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ order_date: '2024-01-15T00:00:00.000Z' }} />);
    // Should NOT show raw ISO string
    expect(screen.queryByText('2024-01-15T00:00:00.000Z')).not.toBeInTheDocument();
    // Should show formatted date (e.g. "Jan 15, 2024")
    expect(screen.getByText(/Jan/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
  });

  it('should render currency fields formatted', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'total_amount', label: 'Total Amount', type: 'currency' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ total_amount: 15459.99 }} />);
    // Should NOT show plain number
    expect(screen.queryByText('15459.99')).not.toBeInTheDocument();
    // Should show formatted currency (e.g. "$15,459.99")
    expect(screen.getByText(/15,459\.99/)).toBeInTheDocument();
  });

  it('should render boolean fields with checkbox', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'active', label: 'Active', type: 'boolean' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ active: true }} />);
    // BooleanCellRenderer renders a checkbox
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
  });

  it('should render select fields as badge', () => {
    const section = {
      title: 'Info',
      fields: [
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'Draft', label: 'Draft', color: 'yellow' },
            { value: 'Active', label: 'Active', color: 'green' },
          ],
        },
      ],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ status: 'Draft' }} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should render null/undefined values as dash', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'missing', label: 'Missing', type: 'text' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{}} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should render section title', () => {
    const section = {
      title: 'Basic Information',
      fields: [{ name: 'name', label: 'Name' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ name: 'Test' }} />);
    expect(screen.getByText('Basic Information')).toBeInTheDocument();
  });

  it('should auto-infer 2 columns when columns is not set and 5+ fields exist', () => {
    const section = {
      title: 'Auto Layout',
      fields: Array.from({ length: 6 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    // The grid container should have the md:grid-cols-2 class
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('md:grid-cols-2');
  });

  it('should auto-infer 3 columns when columns is not set and 11+ fields exist', () => {
    const section = {
      title: 'Many Fields',
      fields: Array.from({ length: 12 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('lg:grid-cols-3');
  });

  it('should keep 1 column when columns is not set and ≤3 fields exist', () => {
    const section = {
      title: 'Few Fields',
      fields: [
        { name: 'a', label: 'A', type: 'text' },
        { name: 'b', label: 'B', type: 'text' },
      ],
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('grid-cols-1');
    expect(grid!.className).not.toContain('sm:grid-cols-2');
  });

  it('should respect explicit columns=1 even with many fields', () => {
    const section = {
      title: 'Forced Single Column',
      fields: Array.from({ length: 15 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
      columns: 1,
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('grid-cols-1');
    expect(grid!.className).not.toContain('sm:grid-cols-2');
  });

  it('should hide empty fields when hideEmpty is true', () => {
    const section = {
      title: 'Info',
      hideEmpty: true,
      fields: [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'email', label: 'Email', type: 'text' },
        { name: 'phone', label: 'Phone', type: 'text' },
      ],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ name: 'Alice', email: null, phone: '' }} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
  });

  it('should hide entire section when all fields are empty and hideEmpty is true', () => {
    const section = {
      title: 'Empty Section',
      hideEmpty: true,
      fields: [
        { name: 'a', label: 'A', type: 'text' },
        { name: 'b', label: 'B', type: 'text' },
      ],
      columns: 1,
    };
    const { container } = render(<DetailSection section={section} data={{ a: null, b: undefined }} />);
    // Section should be hidden entirely
    expect(container.innerHTML).toBe('');
  });

  it('should still show empty fields when hideEmpty is not set', () => {
    const section = {
      title: 'Info',
      fields: [
        { name: 'name', label: 'Name', type: 'text' },
        { name: 'missing', label: 'Missing', type: 'text' },
      ],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ name: 'Alice' }} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should use md: breakpoint for 2-column layouts', () => {
    const section = {
      title: 'Responsive',
      fields: Array.from({ length: 6 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('md:grid-cols-2');
    expect(grid!.className).not.toContain('sm:grid-cols-2');
  });

  it('should use lg: breakpoint for 3-column layouts', () => {
    const section = {
      title: 'Responsive',
      fields: Array.from({ length: 12 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('lg:grid-cols-3');
    expect(grid!.className).not.toContain('md:grid-cols-3');
  });

  it('should enrich field type from objectSchema when field.type is not set', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'status', label: 'Status' }],
      columns: 1,
    };
    const objectSchema = {
      fields: {
        status: {
          type: 'select',
          options: [
            { value: 'Draft', label: 'Draft', color: 'yellow' },
            { value: 'Active', label: 'Active', color: 'green' },
          ],
        },
      },
    };
    render(<DetailSection section={section} data={{ status: 'Draft' }} objectSchema={objectSchema} />);
    // Should render via SelectCellRenderer (displays label), not plain String()
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should render percent field from objectSchema enrichment', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'discount', label: 'Discount' }],
      columns: 1,
    };
    const objectSchema = {
      fields: {
        discount: { type: 'percent' },
      },
    };
    render(<DetailSection section={section} data={{ discount: 25 }} objectSchema={objectSchema} />);
    // PercentCellRenderer should format as "25%" 
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByText(/%/)).toBeInTheDocument();
  });

  it('should fall back to String(value) when neither field.type nor objectSchema provides a type', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'notes', label: 'Notes' }],
      columns: 1,
    };
    render(<DetailSection section={section} data={{ notes: 'Hello World' }} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should prefer explicit field.type over objectSchema type', () => {
    const section = {
      title: 'Info',
      fields: [{ name: 'name', label: 'Name', type: 'text' as const }],
      columns: 1,
    };
    const objectSchema = {
      fields: {
        name: { type: 'number' },
      },
    };
    render(<DetailSection section={section} data={{ name: 'Alice' }} objectSchema={objectSchema} />);
    // Should use 'text' renderer, not 'number'
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should use responsive span classes for wide fields in 3-column layout', () => {
    const section = {
      title: 'Wide Fields',
      fields: Array.from({ length: 12 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: i === 5 ? 'textarea' : 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.className).toContain('lg:grid-cols-3');
    // Wide field (textarea) should have responsive span, not bare col-span-3
    const fields = container.querySelectorAll('[class*="col-span"]');
    fields.forEach((field) => {
      // No bare col-span-3 at base level — must be lg: prefixed
      const classes = field.className.split(/\s+/);
      const hasBareSpan3 = classes.some((c: string) => c === 'col-span-3');
      expect(hasBareSpan3).toBe(false);
    });
  });

  it('should use responsive span classes for wide fields in 2-column layout', () => {
    const section = {
      title: 'Wide Fields',
      fields: [
        { name: 'a', label: 'A', type: 'text' },
        { name: 'b', label: 'B', type: 'text' },
        { name: 'c', label: 'C', type: 'text' },
        { name: 'd', label: 'D', type: 'text' },
        { name: 'notes', label: 'Notes', type: 'textarea' },
      ],
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid!.className).toContain('md:grid-cols-2');
    // Wide field should have md:col-span-2, not bare col-span-2
    const fields = container.querySelectorAll('[class*="col-span"]');
    fields.forEach((field) => {
      const classes = field.className.split(/\s+/);
      const hasBareSpan2 = classes.some((c: string) => c === 'col-span-2');
      expect(hasBareSpan2).toBe(false);
    });
  });

  it('should not apply col-span at base breakpoint to prevent implicit grid columns on mobile', () => {
    const section = {
      title: 'Mobile Safe',
      fields: Array.from({ length: 15 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: i === 0 ? 'textarea' : 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    // Ensure no bare col-span-N (N>1) classes without responsive prefix
    const allElements = container.querySelectorAll('*');
    allElements.forEach((el) => {
      const classes = el.className?.split?.(/\s+/) || [];
      classes.forEach((cls: string) => {
        if (cls.match(/^col-span-[2-9]$/)) {
          throw new Error(`Found bare "${cls}" class without responsive prefix — would break mobile single-column layout`);
        }
      });
    });
  });

  it('should initially render a batch when virtualScroll is enabled with many fields', () => {
    const section = {
      title: 'Virtual',
      fields: Array.from({ length: 50 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection
        section={section}
        data={{}}
        virtualScroll={{ enabled: true, batchSize: 10 }}
      />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    // Initially should render only the batch (10 fields), not all 50
    const fieldElements = grid!.children;
    expect(fieldElements.length).toBeLessThanOrEqual(10);
  });

  it('should render all fields when virtualScroll is disabled', () => {
    const section = {
      title: 'No Virtual',
      fields: Array.from({ length: 50 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection section={section} data={{}} />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.children.length).toBe(50);
  });

  it('should render all fields when virtualScroll is enabled but field count is below batch size', () => {
    const section = {
      title: 'Small',
      fields: Array.from({ length: 5 }, (_, i) => ({
        name: `field_${i}`,
        label: `Field ${i}`,
        type: 'text',
      })),
    };
    const { container } = render(
      <DetailSection
        section={section}
        data={{}}
        virtualScroll={{ enabled: true, batchSize: 20 }}
      />
    );
    const grid = container.querySelector('.grid');
    expect(grid).toBeTruthy();
    expect(grid!.children.length).toBe(5);
  });
});

describe('getResponsiveSpanClass', () => {
  it('should return empty string for no span', () => {
    expect(getResponsiveSpanClass(undefined, 2)).toBe('');
  });

  it('should return empty string for span=1', () => {
    expect(getResponsiveSpanClass(1, 3)).toBe('');
  });

  it('should return empty string for 1-column layout', () => {
    expect(getResponsiveSpanClass(3, 1)).toBe('');
  });

  it('should return md:col-span-2 for span=2 in 2-column layout', () => {
    expect(getResponsiveSpanClass(2, 2)).toBe('md:col-span-2');
  });

  it('should cap span to 2 in 2-column layout', () => {
    expect(getResponsiveSpanClass(3, 2)).toBe('md:col-span-2');
    expect(getResponsiveSpanClass(6, 2)).toBe('md:col-span-2');
  });

  it('should return md:col-span-2 for span=2 in 3-column layout', () => {
    expect(getResponsiveSpanClass(2, 3)).toBe('md:col-span-2');
  });

  it('should return responsive classes for span=3 in 3-column layout', () => {
    expect(getResponsiveSpanClass(3, 3)).toBe('md:col-span-2 lg:col-span-3');
  });

  it('should cap span to 3 in 3-column layout', () => {
    expect(getResponsiveSpanClass(6, 3)).toBe('md:col-span-2 lg:col-span-3');
  });
});
