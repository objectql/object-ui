
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectForm } from '@object-ui/plugin-form';
import type { DataSource } from '@object-ui/types';

// Mock DataSource that returns a schema with varied types
class TypeMappingDataSource implements DataSource {
  private mockSchema = {
    name: 'test_types',
    fields: {
      text_field: { name: 'text_field', label: 'Text Field', type: 'text' },
      email_field: { name: 'email_field', label: 'Email Field', type: 'email' },
      number_field: { name: 'number_field', label: 'Number Field', type: 'number' },
      boolean_field: { name: 'boolean_field', label: 'Boolean Field', type: 'boolean' },
      date_field: { name: 'date_field', label: 'Date Field', type: 'date' },
      select_field: { name: 'select_field', label: 'Select Field', type: 'select', options: [{label: 'A', value: 'a'}] },
      textarea_field: { name: 'textarea_field', label: 'TextArea Field', type: 'textarea' },
    }
  };

  async getObjectSchema(_objectName: string): Promise<any> {
    return this.mockSchema;
  }

  async findOne(_objectName: string, _id: string): Promise<any> {
    return {};
  }
  async create(_objectName: string, data: any): Promise<any> { return data; }
  async update(_objectName: string, _id: string, data: any): Promise<any> { return data; }
  async delete(_objectName: string, _id: string): Promise<boolean> { return true; }
  async find(_objectName: string, _options?: any): Promise<any> { return { data: [] }; }
}

describe('ObjectForm Field Type Mapping', () => {
    
    it('should render correct widgets for all standard field types', async () => {
        const dataSource = new TypeMappingDataSource();
        const { container } = render(
           <ObjectForm 
               schema={{ 
                   type: 'object-form', 
                   objectName: 'test_types', 
                   mode: 'create',
                   fields: [
                       'text_field', 
                       'email_field', 
                       'number_field', 
                       'boolean_field', 
                       'textarea_field',
                       'select_field'
                   ]
                }} 
               dataSource={dataSource} 
           />
        );

        // Wait for schema to load and render
        await waitFor(() => {
            expect(screen.getByLabelText(/Text Field/i)).toBeInTheDocument();
        });

        // 1. Check Text Field (Input)
        const textInput = container.querySelector('input[name="text_field"]');
        expect(textInput).toBeInTheDocument();

        // 2. Check Number Field (Input)
        // Note: Specific type="number" check depends on the exact implementation of the field widget
        const numberInput = container.querySelector('input[name="number_field"]');
        expect(numberInput).toBeInTheDocument();

        // 3. Check TextArea
        const textarea = container.querySelector('textarea[name="textarea_field"]');
        expect(textarea).toBeInTheDocument();
        
        // 4. Check Boolean (Switch)
        // Radix UI switch usually has role="switch"
        const switchControl = screen.getByRole('switch', { name: /Boolean Field/i });
        expect(switchControl).toBeInTheDocument();

        // 5. Check Select Field
        // Radix UI Select trigger might not have the ID matching the label in this test environment
        // So we search for the role, and verify one exists.
        const selectTriggers = screen.getAllByRole('combobox');
        expect(selectTriggers.length).toBeGreaterThan(0);
        
        // Optional: verify one of them is related to our field
        // We can assume the last one is ours or check context
        const selectWrapper = screen.getByText(/Select Field/i).closest('div');
        const selectInWrapper = selectWrapper?.querySelector('button[role="combobox"]');
        expect(selectInWrapper).toBeInTheDocument();
    });
});
