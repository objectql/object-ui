import { ComponentRegistry } from '@object-ui/core';
import { Markdown } from '@/ui';

/**
 * Markdown Renderer Component
 * 
 * A schema-driven renderer that displays markdown content in Object UI applications.
 * This component follows the "Schema First" principle, enabling markdown rendering
 * through pure JSON/YAML configuration without writing custom code.
 * 
 * @example
 * ```json
 * {
 *   "type": "markdown",
 *   "content": "# Hello World\n\nThis is **markdown** text."
 * }
 * ```
 * 
 * Features:
 * - GitHub Flavored Markdown support (tables, strikethrough, task lists)
 * - XSS protection via rehype-sanitize
 * - Dark mode support
 * - Tailwind CSS prose styling
 */
ComponentRegistry.register('markdown', 
  ({ schema, className, ...props }) => (
    <Markdown 
      content={schema.content || ''} 
      className={className}
      {...props}
    />
  ),
  {
    label: 'Markdown',
    inputs: [
      { 
        name: 'content', 
        type: 'string', 
        label: 'Markdown Content', 
        required: true,
        inputType: 'textarea'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      content: '# Hello World\n\nThis is a **markdown** component with *formatting* support.\n\n- Item 1\n- Item 2\n- Item 3',
    }
  }
);
