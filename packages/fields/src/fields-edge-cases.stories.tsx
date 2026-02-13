/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import {
  TextField,
  NumberField,
  SelectField,
  CurrencyField,
  EmailField,
  TextAreaField,
  BooleanField,
  UrlField,
} from './index';
import { FieldMetadata } from '@object-ui/types';

/**
 * **Field Widgets – Edge Cases** from `@object-ui/fields`.
 *
 * Stories that exercise boundary conditions: empty values, overflow text,
 * RTL content, emoji-only input, error states, disabled state, and readonly
 * variants across multiple field types.
 */
const meta = {
  title: 'Fields/Edge Cases',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    readonly: { control: 'boolean', description: 'Toggle readonly mode' },
    disabled: { control: 'boolean', description: 'Toggle disabled mode' },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<any>;

// Wrapper to handle state since these are controlled components
const FieldWrapper = ({
  Component,
  field,
  initialValue,
  readonly = false,
  disabled = false,
  errorMessage,
}: {
  Component: any;
  field: Partial<FieldMetadata>;
  initialValue?: any;
  readonly?: boolean;
  disabled?: boolean;
  errorMessage?: string;
}) => {
  const [value, setValue] = useState(initialValue);

  const fullField = {
    name: 'test_field',
    label: 'Test Field',
    type: 'text',
    ...field,
  } as FieldMetadata;

  return (
    <div className="w-[350px] space-y-2 p-4 border rounded-lg shadow-sm bg-white">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-gray-700">{fullField.label}</label>
        {readonly && (
          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">
            Read Only
          </span>
        )}
        {disabled && (
          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-medium">
            Disabled
          </span>
        )}
      </div>

      <Component
        value={value}
        onChange={(val: any) => {
          console.log('onChange', val);
          setValue(val);
        }}
        field={fullField}
        readonly={readonly}
        disabled={disabled}
        errorMessage={errorMessage}
      />

      {errorMessage && (
        <div className="text-xs text-destructive mt-1">{errorMessage}</div>
      )}

      {!readonly && (
        <div className="text-xs text-muted-foreground mt-4 pt-2 border-t font-mono overflow-hidden text-ellipsis">
          Value: {JSON.stringify(value)}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 1. Empty / Null / Undefined Values
// ---------------------------------------------------------------------------

export const EmptyText: Story = {
  name: 'Empty – Text (undefined)',
  render: () => (
    <FieldWrapper
      Component={TextField}
      field={{ label: 'Empty Text', type: 'text', placeholder: 'Type here…' }}
      initialValue={undefined}
    />
  ),
};

export const NullNumber: Story = {
  name: 'Empty – Number (null)',
  render: () => (
    <FieldWrapper
      Component={NumberField}
      field={{ label: 'Null Number', type: 'number', precision: 2 }}
      initialValue={null}
    />
  ),
};

export const EmptySelect: Story = {
  name: 'Empty – Select (empty string)',
  render: () => (
    <FieldWrapper
      Component={SelectField}
      field={{
        label: 'No Selection',
        type: 'select',
        options: [
          { label: 'Option A', value: 'a' },
          { label: 'Option B', value: 'b' },
        ],
      }}
      initialValue=""
    />
  ),
};

// ---------------------------------------------------------------------------
// 2. Very Long Strings (overflow handling)
// ---------------------------------------------------------------------------

const LONG_STRING =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20).trim();

export const LongText: Story = {
  name: 'Overflow – Long Text',
  render: () => (
    <FieldWrapper
      Component={TextField}
      field={{ label: 'Long Value', type: 'text' }}
      initialValue={LONG_STRING}
    />
  ),
};

export const LongTextArea: Story = {
  name: 'Overflow – Long TextArea',
  render: () => (
    <FieldWrapper
      Component={TextAreaField}
      field={{ label: 'Long TextArea', type: 'textarea', rows: 4 }}
      initialValue={LONG_STRING}
    />
  ),
};

export const LongUrl: Story = {
  name: 'Overflow – Long URL',
  render: () => (
    <FieldWrapper
      Component={UrlField}
      field={{ label: 'Long URL', type: 'url' }}
      initialValue={`https://example.com/${'segment/'.repeat(50)}`}
    />
  ),
};

// ---------------------------------------------------------------------------
// 3. RTL Text (Arabic)
// ---------------------------------------------------------------------------

export const RTLText: Story = {
  name: 'RTL – Arabic Text',
  render: () => (
    <FieldWrapper
      Component={TextField}
      field={{ label: 'Arabic Input', type: 'text' }}
      initialValue="مرحبا بالعالم — هذا نص عربي طويل لاختبار الاتجاه"
    />
  ),
};

export const RTLTextArea: Story = {
  name: 'RTL – Arabic TextArea',
  render: () => (
    <FieldWrapper
      Component={TextAreaField}
      field={{ label: 'Arabic TextArea', type: 'textarea', rows: 3 }}
      initialValue="هذا نص عربي يمتد على عدة أسطر.\nالسطر الثاني هنا.\nالسطر الثالث."
    />
  ),
};

// ---------------------------------------------------------------------------
// 4. Emoji-Only Values
// ---------------------------------------------------------------------------

export const EmojiText: Story = {
  name: 'Emoji – Text Field',
  render: () => (
    <FieldWrapper
      Component={TextField}
      field={{ label: 'Emoji Only', type: 'text' }}
      initialValue="🚀🔥✨💯🎉🌍"
    />
  ),
};

export const EmojiEmail: Story = {
  name: 'Emoji – Email Field (invalid)',
  render: () => (
    <FieldWrapper
      Component={EmailField}
      field={{ label: 'Emoji Email', type: 'email' }}
      initialValue="🚀@emoji.com"
    />
  ),
};

// ---------------------------------------------------------------------------
// 5. Error State (with errorMessage prop)
// ---------------------------------------------------------------------------

export const ErrorText: Story = {
  name: 'Error – Text Field',
  render: () => (
    <FieldWrapper
      Component={TextField}
      field={{ label: 'Name', type: 'text', placeholder: 'Required field' }}
      initialValue=""
      errorMessage="This field is required."
    />
  ),
};

export const ErrorNumber: Story = {
  name: 'Error – Number Field',
  render: () => (
    <FieldWrapper
      Component={NumberField}
      field={{ label: 'Age', type: 'number', precision: 0 }}
      initialValue={-5}
      errorMessage="Value must be a positive number."
    />
  ),
};

export const ErrorSelect: Story = {
  name: 'Error – Select Field',
  render: () => (
    <FieldWrapper
      Component={SelectField}
      field={{
        label: 'Priority',
        type: 'select',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' },
        ],
      }}
      initialValue=""
      errorMessage="Please select a priority."
    />
  ),
};

// ---------------------------------------------------------------------------
// 6. Disabled State
// ---------------------------------------------------------------------------

export const DisabledText: Story = {
  name: 'Disabled – Text Field',
  render: () => (
    <FieldWrapper
      Component={TextField}
      field={{ label: 'Locked Name', type: 'text' }}
      initialValue="Cannot change this"
      disabled={true}
    />
  ),
};

export const DisabledNumber: Story = {
  name: 'Disabled – Number Field',
  render: () => (
    <FieldWrapper
      Component={NumberField}
      field={{ label: 'Locked Qty', type: 'number', precision: 0 }}
      initialValue={100}
      disabled={true}
    />
  ),
};

export const DisabledSelect: Story = {
  name: 'Disabled – Select Field',
  render: () => (
    <FieldWrapper
      Component={SelectField}
      field={{
        label: 'Locked Status',
        type: 'select',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      }}
      initialValue="active"
      disabled={true}
    />
  ),
};

export const DisabledBoolean: Story = {
  name: 'Disabled – Boolean Field',
  render: () => (
    <FieldWrapper
      Component={BooleanField}
      field={{ label: 'Locked Toggle', type: 'boolean' }}
      initialValue={true}
      disabled={true}
    />
  ),
};

// ---------------------------------------------------------------------------
// 7. Readonly State with Various Field Types
// ---------------------------------------------------------------------------

export const ReadonlyGallery: Story = {
  name: 'Readonly – Multiple Fields',
  render: () => (
    <div className="flex flex-col gap-4">
      <FieldWrapper
        Component={TextField}
        field={{ label: 'Read Only Text', type: 'text' }}
        initialValue="Immutable value"
        readonly={true}
      />
      <FieldWrapper
        Component={NumberField}
        field={{ label: 'Read Only Number', type: 'number', precision: 2 }}
        initialValue={3.14}
        readonly={true}
      />
      <FieldWrapper
        Component={CurrencyField}
        field={{ label: 'Read Only Currency', type: 'currency', currency: 'USD', precision: 2 }}
        initialValue={9999.99}
        readonly={true}
      />
      <FieldWrapper
        Component={SelectField}
        field={{
          label: 'Read Only Select',
          type: 'select',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Archived', value: 'archived' },
          ],
        }}
        initialValue="active"
        readonly={true}
      />
      <FieldWrapper
        Component={BooleanField}
        field={{ label: 'Read Only Boolean', type: 'boolean' }}
        initialValue={false}
        readonly={true}
      />
      <FieldWrapper
        Component={EmailField}
        field={{ label: 'Read Only Email', type: 'email' }}
        initialValue="admin@example.com"
        readonly={true}
      />
    </div>
  ),
};
