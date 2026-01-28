import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Primitives/Display/Typography',
  component: SchemaRenderer,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } }
  }
} satisfies Meta<typeof SchemaRenderer>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Headings: Story = {
  render: renderStory,
  args: {
    type: 'div',
    className: 'space-y-4',
    children: [
        { type: 'html', html: '<h1>Taxing Laughter: The Joke Tax Chronicles</h1>', className: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl' },
        { type: 'html', html: '<h2>The People of the Kingdom</h2>', className: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0' },
        { type: 'html', html: '<h3>The Joke Tax</h3>', className: 'scroll-m-20 text-2xl font-semibold tracking-tight' },
        { type: 'html', html: '<h4>People stopped telling jokes</h4>', className: 'scroll-m-20 text-xl font-semibold tracking-tight' },
    ]
  } as any,
};

export const Paragraphs: Story = {
  render: renderStory,
  args: {
    type: 'div',
    className: 'space-y-4 max-w-lg',
    children: [
        { type: 'html', html: '<p>The king, seeing how much happier his subjects were, realized the error of his ways and repealed the joke tax.</p>', className: 'leading-7 [&:not(:first-child)]:mt-6' },
        { type: 'html', html: '<blockquote>"After all," he said, "everyone enjoys a good joke, so it\'s only fair that they should pay for the privilege."</blockquote>', className: 'mt-6 border-l-2 pl-6 italic' },
        { type: 'text', content: 'Just a plain text node without wrapper.' }
    ]
  } as any,
};
