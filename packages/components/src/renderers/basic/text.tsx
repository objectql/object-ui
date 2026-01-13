import { ComponentRegistry } from '@object-ui/core';

ComponentRegistry.register('text', 
  ({ schema }) => (
    <>{schema.content}</>
  ),
  {
    label: 'Text',
    inputs: [
      { name: 'content', type: 'string', label: 'Content', required: true }
    ],
    defaultProps: {
      content: 'Text content'
    }
  }
);
