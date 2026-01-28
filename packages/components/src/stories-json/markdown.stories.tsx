import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Markdown',
  component: SchemaRenderer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    schema: { table: { disable: true } },
  },
} satisfies Meta<any>;

export default meta;
type Story = StoryObj<typeof meta>;

const renderStory = (args: any) => <SchemaRenderer schema={args as unknown as BaseSchema} />;

export const Default: Story = {
  render: renderStory,
  args: {
    type: 'markdown',
    content: '# Hello World\n\nThis is a **markdown** component with *formatting* support.\n\n- Item 1\n- Item 2\n- Item 3'
  } as any,
};

export const CompleteExample: Story = {
  render: renderStory,
  args: {
    type: 'markdown',
    content: `# ObjectUI Documentation

## Introduction

ObjectUI is a **Universal, Server-Driven UI (SDUI) Engine** built on React + Tailwind + Shadcn.

### Key Features

- 🚀 JSON-based component definitions
- 🎨 Beautiful UI with Shadcn components
- ⚡ Fast and lightweight
- 🔧 Fully customizable

### Installation

\`\`\`bash
npm install @object-ui/react
\`\`\`

### Quick Start

\`\`\`javascript
import { SchemaRenderer } from '@object-ui/react';

const schema = {
  type: 'button',
  children: [{ type: 'text', content: 'Click Me' }]
};

<SchemaRenderer schema={schema} />
\`\`\`

> **Note:** This is just a sample documentation.

For more information, visit our [website](https://objectui.dev).
`
  } as any,
};

export const CodeExample: Story = {
  render: renderStory,
  args: {
    type: 'markdown',
    content: `## Code Snippets

Here's how to create a button component:

\`\`\`json
{
  "type": "button",
  "props": {
    "variant": "default"
  },
  "children": [
    {
      "type": "text",
      "content": "Click Me"
    }
  ]
}
\`\`\`

And here's a TypeScript example:

\`\`\`typescript
interface ButtonSchema {
  type: 'button';
  props?: {
    variant?: 'default' | 'outline' | 'ghost';
  };
  children?: BaseSchema[];
}
\`\`\`
`
  } as any,
};

export const TableExample: Story = {
  render: renderStory,
  args: {
    type: 'markdown',
    content: `## Component Comparison

| Feature | ObjectUI | Traditional |
|---------|----------|-------------|
| Development Speed | ⚡ Fast | 🐌 Slow |
| Flexibility | 🔥 High | ⭐ Medium |
| Learning Curve | 📚 Easy | 🎓 Steep |
| Performance | 🚀 Excellent | ✅ Good |

### Conclusion

ObjectUI provides a modern approach to building user interfaces with better development speed and flexibility.
`
  } as any,
};
