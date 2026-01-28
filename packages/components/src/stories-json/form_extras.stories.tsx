import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';

const meta: Meta = {
  title: 'Primitives/Forms/Extras',
  component: SchemaRenderer,
  tags: ['autodocs'],
  argTypes: {
    // Schema properties
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Toggle: Story = {
  args: {
    type: 'toggle',
    ariaLabel: 'Toggle italic',
    variant: 'outline',
    children: [
        { type: 'icon', name: 'italic', className: 'h-4 w-4' }
    ]
  },
  render: (args) => <SchemaRenderer schema={args} />
};

export const ToggleGroup: Story = {
  args: {
    type: 'toggle-group',
    selectionType: 'multiple',
    variant: 'outline',
    items: [
        { value: 'bold', label: 'Bold', icon: <SchemaRenderer schema={{ type: 'icon', name: 'bold', className: 'h-4 w-4' }} /> },
        { value: 'italic', label: 'Italic', icon: <SchemaRenderer schema={{ type: 'icon', name: 'italic', className: 'h-4 w-4' }} /> },
        { value: 'underline', label: 'Underline', icon: <SchemaRenderer schema={{ type: 'icon', name: 'underline', className: 'h-4 w-4' }} /> }
    ]
  },
  // Note: SchemaRenderer in icon prop might not work if items expects pure objects. 
  // Let's check implementation. The implementation just renders {item.icon || item.label}.
  // It expects item.icon to be a ReactNode. We can't pass ReactNode in JSON.
  // Wait, if I am passing generic args, I can. But if this is strict JSON, I can't.
  // The renderer maps `items.map(...)`.
  // Let's try passing text first.
};

export const ToggleGroupText: Story = {
    args: {
      type: 'toggle-group',
      selectionType: 'single',
      variant: 'outline',
      items: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' }
      ]
    },
    render: (args) => <SchemaRenderer schema={args} />
  };

export const FileUpload: Story = {
    args: {
        type: 'file-upload',
        id: 'documents-upload',
        label: 'Upload Documents',
        buttonText: 'Drop files here',
        multiple: true,
        accept: 'image/*'
    },
    render: (args) => <SchemaRenderer schema={args} />
};

export const Calendar: Story = {
    args: {
        type: 'calendar',
        mode: 'single',
        className: 'rounded-md border shadow'
    },
    render: (args) => <SchemaRenderer schema={args} />
};

export const FormConfigured: Story = {
    args: {
        type: 'form',
        label: 'User Registration',
        submitLabel: 'Create Account',
        columns: 2,
        fields: [
            { name: 'firstName', label: 'First Name', required: true, placeholder: 'John' },
            { name: 'lastName', label: 'Last Name', required: true, placeholder: 'Doe' },
            { name: 'email', label: 'Email Address', inputType: 'email', required: true, className: 'col-span-2' },
            { name: 'role', label: 'Role', type: 'select', options: [{label: 'Admin', value: 'admin'}, {label: 'User', value: 'user'}], defaultValue: 'user' },
            { name: 'notifications', label: 'Receive Notifications', type: 'checkbox', className: 'flex flex-row items-center space-x-3 space-y-0 p-4' }
        ]
    },
    render: (args) => <SchemaRenderer schema={args} />
};

export const FormComposed: Story = {
    args: {
        type: 'form',
        submitLabel: 'Sign In',
        children: [
             {
                 type: 'div',
                 className: 'space-y-2',
                 children: [
                     { type: 'label', content: 'Username' },
                     { type: 'input', placeholder: 'user@example.com' }
                 ]
             },
             {
                type: 'div',
                className: 'space-y-2',
                children: [
                    { type: 'label', content: 'Password' },
                    { type: 'input', inputType: 'password' }
                ]
            }
        ]
    },
    render: (args) => <SchemaRenderer schema={args} />
};
