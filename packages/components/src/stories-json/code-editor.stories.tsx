import type { Meta, StoryObj } from '@storybook/react';
import { SchemaRenderer } from '../SchemaRenderer';
import type { BaseSchema } from '@object-ui/types';

const meta = {
  title: 'Views/Code Editor',
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

export const JavaScript: Story = {
  render: renderStory,
  args: {
    type: 'code-editor',
    value: '// Write your code here\nconsole.log("Hello, World!");',
    language: 'javascript',
    theme: 'vs-dark',
    height: '400px',
    readOnly: false
  } as any,
};

export const TypeScript: Story = {
  render: renderStory,
  args: {
    type: 'code-editor',
    value: 'interface User {\n  id: number;\n  name: string;\n  email: string;\n}\n\nconst user: User = {\n  id: 1,\n  name: "John Doe",\n  email: "john@example.com"\n};',
    language: 'typescript',
    theme: 'vs-dark',
    height: '400px',
    readOnly: false
  } as any,
};

export const Python: Story = {
  render: renderStory,
  args: {
    type: 'code-editor',
    value: 'def greet(name):\n    """Greet a person by name."""\n    return f"Hello, {name}!"\n\nif __name__ == "__main__":\n    print(greet("World"))',
    language: 'python',
    theme: 'vs-dark',
    height: '400px',
    readOnly: false
  } as any,
};

export const JSON: Story = {
  render: renderStory,
  args: {
    type: 'code-editor',
    value: '{\n  "name": "ObjectUI",\n  "version": "1.0.0",\n  "description": "Server-Driven UI Engine",\n  "features": [\n    "JSON-based components",\n    "React integration",\n    "Tailwind styling"\n  ]\n}',
    language: 'json',
    theme: 'vs-dark',
    height: '400px',
    readOnly: false
  } as any,
};

export const ReadOnly: Story = {
  render: renderStory,
  args: {
    type: 'code-editor',
    value: '// This editor is read-only\nconst message = "You cannot edit this code";\nconsole.log(message);',
    language: 'javascript',
    theme: 'vs-dark',
    height: '300px',
    readOnly: true
  } as any,
};

export const LightTheme: Story = {
  render: renderStory,
  args: {
    type: 'code-editor',
    value: 'function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}\n\nconsole.log(fibonacci(10));',
    language: 'javascript',
    theme: 'light',
    height: '400px',
    readOnly: false
  } as any,
};
