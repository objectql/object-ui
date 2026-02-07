/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FormRenderer } from './FormRenderer';
import type { FormView } from '@objectstack/spec/ui';
import type { ExtendedFormField } from './FieldFactory';

// Helper type for form views with extended fields
type ExtendedFormView = Omit<FormView, 'sections'> & {
  sections?: Array<{
    label?: string;
    collapsible?: boolean;
    collapsed?: boolean;
    columns?: '1' | '2' | '3' | '4';
    fields: (string | ExtendedFormField)[];
  }>;
};

describe('FormRenderer', () => {
  it('should render a simple form with text fields', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Personal Information',
          collapsible: false,
          collapsed: false,
          columns: 2,
          fields: [
            {
              field: 'firstName',
              label: 'First Name',
              required: true,
              widget: 'text',
            },
            {
              field: 'lastName',
              label: 'Last Name',
              required: true,
              widget: 'text',
            },
          ],
        },
      ],
    };

    const { container } = render(<FormRenderer schema={schema} />);
    
    expect(screen.getByText('Personal Information')).toBeInTheDocument();
    expect(screen.getByLabelText(/First Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/)).toBeInTheDocument();
  });

  it('should render form with initial data', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'User Details',
          collapsible: false,
          collapsed: false,
          columns: 1,
          fields: [
            {
              field: 'username',
              label: 'Username',
              widget: 'text',
            },
          ],
        },
      ],
    };

    const data = { username: 'john_doe' };

    render(<FormRenderer schema={schema} data={data} />);
    
    const input = screen.getByLabelText('Username') as HTMLInputElement;
    expect(input.value).toBe('john_doe');
  });

  it('should handle multi-column layout', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Contact',
          collapsible: false,
          collapsed: false,
          columns: 3,
          fields: [
            {
              field: 'email',
              label: 'Email',
              widget: 'email',
            },
            {
              field: 'phone',
              label: 'Phone',
              widget: 'tel',
            },
            {
              field: 'address',
              label: 'Address',
              widget: 'textarea',
              colSpan: 3,
            },
          ],
        },
      ],
    };

    render(<FormRenderer schema={schema} />);
    
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeInTheDocument();
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
  });

  it('should hide fields marked as hidden', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Form',
          collapsible: false,
          collapsed: false,
          columns: 1,
          fields: [
            {
              field: 'visible',
              label: 'Visible Field',
              widget: 'text',
            },
            {
              field: 'hidden',
              label: 'Hidden Field',
              widget: 'text',
              hidden: true,
            },
          ],
        },
      ],
    };

    render(<FormRenderer schema={schema} />);
    
    expect(screen.getByLabelText('Visible Field')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hidden Field')).not.toBeInTheDocument();
  });

  it('should support legacy string field format', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Legacy Form',
          collapsible: false,
          collapsed: false,
          columns: 1,
          fields: ['username', 'email'],
        },
      ],
    };

    const { container } = render(<FormRenderer schema={schema} />);
    
    // String fields should still render as inputs
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('should handle number fields', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Numbers',
          collapsible: false,
          collapsed: false,
          columns: 1,
          fields: [
            {
              field: 'age',
              label: 'Age',
              widget: 'number',
              required: true,
            },
          ],
        },
      ],
    };

    render(<FormRenderer schema={schema} />);
    
    const input = screen.getByLabelText(/Age/) as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('should handle checkbox fields', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Preferences',
          collapsible: false,
          collapsed: false,
          columns: 1,
          fields: [
            {
              field: 'subscribe',
              label: 'Subscribe to newsletter',
              widget: 'checkbox',
            },
          ],
        },
      ],
    };

    render(<FormRenderer schema={schema} />);
    
    const checkbox = screen.getByLabelText('Subscribe to newsletter') as HTMLInputElement;
    expect(checkbox.type).toBe('checkbox');
  });

  it('should render help text when provided', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Help Text',
          collapsible: false,
          collapsed: false,
          columns: 1,
          fields: [
            {
              field: 'password',
              label: 'Password',
              widget: 'password',
              helpText: 'Must be at least 8 characters',
            },
          ],
        },
      ],
    };

    render(<FormRenderer schema={schema} />);
    
    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
  });

  it('should mark required fields with asterisk', () => {
    const schema: FormView = {
      type: 'simple',
      sections: [
        {
          label: 'Required',
          collapsible: false,
          collapsed: false,
          columns: 1,
          fields: [
            {
              field: 'name',
              label: 'Name',
              widget: 'text',
              required: true,
            },
          ],
        },
      ],
    };

    const { container } = render(<FormRenderer schema={schema} />);
    
    // Check for asterisk
    const asterisk = container.querySelector('.text-red-500');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk?.textContent).toContain('*');
  });

  // Test new field types
  describe('Extended field types', () => {
    it('should render currency field with dollar sign', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Pricing',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'price',
                label: 'Price',
                widget: 'currency',
              },
            ],
          },
        ],
      };

      const { container } = render(<FormRenderer schema={schema} />);
      expect(screen.getByLabelText('Price')).toBeInTheDocument();
      expect(container.querySelector('.absolute')?.textContent).toBe('$');
    });

    it('should render percent field with percent sign', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Metrics',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'discount',
                label: 'Discount',
                widget: 'percent',
              },
            ],
          },
        ],
      };

      const { container } = render(<FormRenderer schema={schema} />);
      expect(screen.getByLabelText('Discount')).toBeInTheDocument();
      expect(container.querySelector('.absolute')?.textContent).toBe('%');
    });

    it('should render phone field', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Contact',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'phoneNumber',
                label: 'Phone Number',
                widget: 'phone',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);
      const input = screen.getByLabelText('Phone Number') as HTMLInputElement;
      expect(input.type).toBe('tel');
    });

    it('should render markdown field as textarea', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Content',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'content',
                label: 'Content',
                widget: 'markdown',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);
      const textarea = screen.getByLabelText('Content') as HTMLTextAreaElement;
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render html field as textarea', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Content',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'htmlContent',
                label: 'HTML Content',
                widget: 'html',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);
      const textarea = screen.getByLabelText('HTML Content') as HTMLTextAreaElement;
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render file field', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Upload',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'document',
                label: 'Document',
                widget: 'file',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);
      const input = screen.getByLabelText('Document') as HTMLInputElement;
      expect(input.type).toBe('file');
    });

    it('should render image field', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Upload',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'avatar',
                label: 'Avatar',
                widget: 'image',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);
      const input = screen.getByLabelText('Avatar') as HTMLInputElement;
      expect(input.type).toBe('file');
    });

    it('should render location field with lat/lng inputs', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Location',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'coordinates',
                label: 'Coordinates',
                widget: 'location',
              },
            ],
          },
        ],
      };

      const { container } = render(<FormRenderer schema={schema} />);
      const inputs = container.querySelectorAll('input[type="number"]');
      expect(inputs.length).toBe(2);
    });

    it('should render lookup field as select', () => {
      const schema: ExtendedFormView = {
        type: 'simple',
        sections: [
          {
            label: 'Relations',
            collapsible: false,
            collapsed: false,
            columns: '1',
            fields: [
              {
                field: 'account',
                label: 'Account',
                widget: 'lookup',
                options: [
                  { label: 'Account 1', value: '1' },
                  { label: 'Account 2', value: '2' },
                ],
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema as FormView} />);
      const select = screen.getByLabelText('Account') as HTMLSelectElement;
      expect(select.tagName).toBe('SELECT');
    });

    it('should render user field as select', () => {
      const schema: ExtendedFormView = {
        type: 'simple',
        sections: [
          {
            label: 'Assignment',
            collapsible: false,
            collapsed: false,
            columns: '1',
            fields: [
              {
                field: 'assignedTo',
                label: 'Assigned To',
                widget: 'user',
                options: [
                  { label: 'User 1', value: 'user1' },
                  { label: 'User 2', value: 'user2' },
                ],
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema as FormView} />);
      const select = screen.getByLabelText('Assigned To') as HTMLSelectElement;
      expect(select.tagName).toBe('SELECT');
    });

    it('should render formula field as disabled input', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Computed',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'total',
                label: 'Total',
                widget: 'formula',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);
      const input = screen.getByLabelText('Total') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('should render object field as JSON textarea', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Data',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'metadata',
                label: 'Metadata',
                widget: 'object',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);
      const textarea = screen.getByLabelText('Metadata') as HTMLTextAreaElement;
      expect(textarea.tagName).toBe('TEXTAREA');
    });
  });

  // ==========================================================================
  // FormField.dependsOn — conditional field visibility based on parent value
  // ==========================================================================

  describe('FormField.dependsOn', () => {
    it('should hide fields with dependsOn when parent has no value', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Cascading Fields',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'country',
                label: 'Country',
                widget: 'text',
              },
              {
                field: 'state',
                label: 'State',
                widget: 'text',
                dependsOn: 'country',
              },
            ],
          },
        ],
      };

      render(<FormRenderer schema={schema} />);

      // Parent field is always visible
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      // Dependent field is hidden when parent has no value
      expect(screen.queryByLabelText('State')).not.toBeInTheDocument();
    });

    it('should show fields with dependsOn when parent has a value', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Cascading Fields',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'country',
                label: 'Country',
                widget: 'text',
              },
              {
                field: 'state',
                label: 'State',
                widget: 'text',
                dependsOn: 'country',
              },
            ],
          },
        ],
      };

      // When country has an initial value, state should be visible
      render(<FormRenderer schema={schema} data={{ country: 'USA' }} />);

      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      expect(screen.getByLabelText('State')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // FormField.visibleOn — expression-based visibility
  // ==========================================================================

  describe('FormField.visibleOn', () => {
    it('should hide fields when visibleOn evaluates to false', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Conditional Fields',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'status',
                label: 'Status',
                widget: 'text',
              },
              {
                field: 'price',
                label: 'Price',
                widget: 'currency',
                visibleOn: "${data.status === 'active'}",
              },
            ],
          },
        ],
      };

      // Status is 'draft', so price should be hidden
      render(<FormRenderer schema={schema} data={{ status: 'draft' }} />);

      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.queryByLabelText('Price')).not.toBeInTheDocument();
    });

    it('should show fields when visibleOn evaluates to true', () => {
      const schema: FormView = {
        type: 'simple',
        sections: [
          {
            label: 'Conditional Fields',
            collapsible: false,
            collapsed: false,
            columns: 1,
            fields: [
              {
                field: 'status',
                label: 'Status',
                widget: 'text',
              },
              {
                field: 'price',
                label: 'Price',
                widget: 'currency',
                visibleOn: "${data.status === 'active'}",
              },
            ],
          },
        ],
      };

      // Status is 'active', so price should be visible
      render(<FormRenderer schema={schema} data={{ status: 'active' }} />);

      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByLabelText('Price')).toBeInTheDocument();
    });
  });
});
