import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { 
  TextField, 
  CurrencyField, 
  SelectField, 
  DateField,
  DateTimeField,
  TimeField,
  BooleanField,
  NumberField,
  PercentField,
  UrlField,
  PhoneField,
  EmailField,
  PasswordField,
  TextAreaField,
  AutoNumberField,
  LookupField,
  UserField,
  FileField,
  LocationField,
  FormulaField,
  SummaryField
} from '@object-ui/fields';
import { FieldMetadata } from '@object-ui/types';

/**
 * **Field Widgets** from `@object-ui/fields`.
 * 
 * These components handle data formatting, validation, and display logic for specific data types.
 * They are typically used within `ObjectForm` or `ObjectGrid` but can be used standalone.
 * 
 * Note: These widgets implement the `FieldWidgetProps` interface.
 */
const meta = {
  title: 'Fields/Gallery',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj<any>;

// Wrapper to handle state since these are controlled components
const FieldWrapper = ({ 
  Component, 
  field, 
  initialValue,
  readonly = false
}: { 
  Component: any, 
  field: Partial<FieldMetadata>, 
  initialValue?: any,
  readonly?: boolean
}) => {
  const [value, setValue] = useState(initialValue);
  
  // Ensure field has minimal required props
  const fullField = {
    name: 'test_field',
    label: 'Test Field',
    type: 'text',
    ...field
  } as FieldMetadata;

  return (
    <div className="w-[350px] space-y-2 p-4 border rounded-lg shadow-sm bg-white">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-gray-700">{fullField.label}</label>
        {readonly && <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">Read Only</span>}
      </div>
      
      <Component
        value={value}
        onChange={(val: any) => {
          console.log('onChange', val);
          setValue(val);
        }}
        field={fullField}
        readonly={readonly}
      />
      
      {!readonly && (
        <div className="text-xs text-muted-foreground mt-4 pt-2 border-t font-mono overflow-hidden text-ellipsis">
          Value: {JSON.stringify(value)}
        </div>
      )}
    </div>
  );
};

// --- Text Based ---

export const Text: Story = {
  render: () => (
    <FieldWrapper 
      Component={TextField}
      field={{ label: 'Deal Name', type: 'text', placeholder: 'Enter deal name...' }}
      initialValue="Big Enterprise Deal"
    />
  )
};

export const TextArea: Story = {
  render: () => (
    <FieldWrapper 
      Component={TextAreaField}
      field={{ label: 'Description', type: 'textarea', rows: 4 }}
      initialValue="This is a multi-line description text area."
    />
  )
};

export const Email: Story = {
  render: () => (
    <FieldWrapper 
      Component={EmailField}
      field={{ label: 'Email', type: 'email' }}
      initialValue="contact@example.com"
    />
  )
};

export const Phone: Story = {
  render: () => (
    <FieldWrapper 
      Component={PhoneField}
      field={{ label: 'Phone', type: 'phone' }}
      initialValue="+1 (555) 123-4567"
    />
  )
};

export const Url: Story = {
  render: () => (
    <FieldWrapper 
      Component={UrlField}
      field={{ label: 'Website', type: 'url' }}
      initialValue="https://objectui.org"
    />
  )
};

export const Password: Story = {
  render: () => (
    <FieldWrapper 
      Component={PasswordField}
      field={{ label: 'Secret Key', type: 'password' }}
      initialValue="supersecret"
    />
  )
};

export const AutoNumber: Story = {
  render: () => (
    <FieldWrapper 
      Component={AutoNumberField}
      field={{ label: 'Order Number', type: 'autonumber' }}
      initialValue="ORD-2024-001"
      readonly={true} 
    />
  )
};

// --- Numbers ---

export const Number: Story = {
  render: () => (
    <FieldWrapper 
      Component={NumberField}
      field={{ label: 'Quantity', type: 'number', scale: 0 }}
      initialValue={42}
    />
  )
};

export const Currency: Story = {
  render: () => (
    <FieldWrapper 
      Component={CurrencyField}
      field={{ label: 'Amount', type: 'currency', currency: 'USD', precision: 2 }}
      initialValue={1234567.89}
    />
  )
};

export const Percent: Story = {
  render: () => (
    <FieldWrapper 
      Component={PercentField}
      field={{ label: 'Probability', type: 'percent', precision: 2 }}
      initialValue={0.75}
    />
  )
};

// --- Date & Time ---

export const Date: Story = {
  render: () => (
    <FieldWrapper 
      Component={DateField}
      field={{ label: 'Close Date', type: 'date' }}
      initialValue={new Date().toISOString()}
    />
  )
};

export const DateTime: Story = {
  render: () => (
    <FieldWrapper 
      Component={DateTimeField}
      field={{ label: 'Meeting Time', type: 'datetime' }}
      initialValue={new Date().toISOString()}
    />
  )
};

export const Time: Story = {
  render: () => (
    <FieldWrapper 
      Component={TimeField}
      field={{ label: 'Start Time', type: 'time' }}
      initialValue="14:30"
    />
  )
};

// --- Selection ---

export const Boolean: Story = {
  render: () => (
    <FieldWrapper 
      Component={BooleanField}
      field={{ label: 'Is Active?', type: 'boolean' }}
      initialValue={true}
    />
  )
};

export const Select: Story = {
  render: () => (
    <FieldWrapper 
      Component={SelectField}
      field={{ 
        label: 'Stage', 
        type: 'select',
        options: [
          { label: 'Prospecting', value: 'prospecting' },
          { label: 'Qualification', value: 'qualification' },
          { label: 'Proposal', value: 'proposal' },
          { label: 'Closed Won', value: 'closed_won' },
          { label: 'Closed Lost', value: 'closed_lost' },
        ]
      }}
      initialValue="proposal"
    />
  )
};

export const Lookup: Story = {
  render: () => (
    <FieldWrapper 
      Component={LookupField}
      field={{ 
        label: 'Account', 
        type: 'lookup',
        options: [
          { label: 'Acme Corp', value: 'acme' },
          { label: 'Globex', value: 'globex' },
          { label: 'Soylent Corp', value: 'soylent' },
        ] as any
      }}
      initialValue="acme"
    />
  )
};

export const MultiSelectLookup: Story = {
  render: () => (
    <FieldWrapper 
      Component={LookupField}
      field={{ 
        label: 'Related Accounts', 
        type: 'lookup',
        multiple: true,
        options: [
          { label: 'Acme Corp', value: 'acme' },
          { label: 'Globex', value: 'globex' },
          { label: 'Soylent Corp', value: 'soylent' },
        ] as any
      }}
      initialValue={['acme', 'soylent']}
    />
  )
};

// --- Special ---

export const User: Story = {
  render: () => (
    <FieldWrapper 
      Component={UserField}
      field={{ label: 'Assigned To', type: 'user' }}
      initialValue={{ name: 'John Doe', username: 'jdoe' }}
    />
  )
};

export const File: Story = {
  render: () => (
    <FieldWrapper 
      Component={FileField}
      field={{ label: 'Attachment', type: 'file' }}
      initialValue={{ name: 'report.pdf', size: 1024000 }}
    />
  )
};

export const Location: Story = {
  render: () => (
    <FieldWrapper 
      Component={LocationField}
      field={{ label: 'Coordinates', type: 'location' }}
      initialValue={{ latitude: 37.7749, longitude: -122.4194 }}
    />
  )
};

export const Formula: Story = {
  render: () => (
    <FieldWrapper 
      Component={FormulaField}
      field={{ label: 'Net Profit', type: 'formula' }}
      initialValue={5000}
      readonly
    />
  )
};

export const Summary: Story = {
  render: () => (
    <FieldWrapper 
      Component={SummaryField}
      field={{ label: 'Total Sales', type: 'summary' }}
      initialValue={100000}
      readonly
    />
  )
};

export const ReadOnly: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <FieldWrapper 
        Component={TextField}
        field={{ label: 'Read Only Text', type: 'text' }}
        initialValue="You cannot edit this"
        readonly={true}
      />
      <FieldWrapper 
        Component={CurrencyField}
        field={{ label: 'Read Only Currency', type: 'currency' }}
        initialValue={9999.99}
        readonly={true}
      />
      <FieldWrapper 
        Component={UserField}
        field={{ label: 'Read Only User', type: 'user' }}
        initialValue={{ name: 'Jane Smith' }}
        readonly={true}
      />
    </div>
  )
};
