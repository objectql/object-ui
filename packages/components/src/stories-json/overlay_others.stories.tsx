import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Schema/Overlay',
  component: SchemaRenderer,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } }
  }
} satisfies Meta<typeof SchemaRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Tooltip: Story = {
  render: renderStory,
  args: {
    type: 'tooltip',
    content: 'Add to library',
    trigger: [
        { type: 'button', props: { variant: 'outline' }, children: [{type:'text', content: 'Hover Me'}] }
    ]
  } as any,
};

export const Popover: Story = {
  render: renderStory,
  args: {
    type: 'popover',
    trigger: [
        { type: 'button', props: { variant: 'outline' }, children: [{type: 'text', content: 'Open Popover'}] }
    ],
    content: [
         { type: 'div', className: 'grid gap-4', children: [
             { type: 'div', className: 'space-y-2', children: [
                 { type: 'html', tag: 'h4', className: 'font-medium leading-none', content: 'Dimensions' },
                 { type: 'text', content: 'Set the dimensions for the layer.', className: 'text-sm text-muted-foreground' }
             ]},
             { type: 'div', className: 'grid gap-2', children: [
                 { type: 'input', label: 'Width', defaultValue: '100%' },
                 { type: 'input', label: 'Max. width', defaultValue: '300px' },
                 { type: 'input', label: 'Height', defaultValue: '25px' },
                 { type: 'input', label: 'Max. height', defaultValue: 'none' },
             ]}
         ]}
    ]
  } as any,
};

export const HoverCard: Story = {
    render: renderStory,
    args: {
      type: 'hover-card',
      trigger: [
          { type: 'button', props: { variant: 'link' }, children: [{ type: 'text', content: '@nextjs'}] }
      ],
      content: [
          { type: 'div', className: 'flex justify-between space-x-4', children: [
              { type: 'avatar', src: 'https://github.com/vercel.png', fallback: 'VC' },
              { type: 'div', className: 'space-y-1', children: [
                  { type: 'html', tag: 'h4', className: 'text-sm font-semibold', content: '@nextjs' },
                  { type: 'text', content: 'The React Framework – created and maintained by @vercel.', className: 'text-sm' },
                  { type: 'div', className: 'flex items-center pt-2', children: [
                      { type: 'icon', name: 'calendar', className: 'mr-2 h-4 w-4 opacity-70' },
                      { type: 'text', content: 'Joined December 2021', className: 'text-xs text-muted-foreground' }
                  ]}
              ]}
          ]}
      ]
    } as any,
  };
