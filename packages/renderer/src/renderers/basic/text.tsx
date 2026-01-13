import { ComponentRegistry } from '../../registry';

ComponentRegistry.register('text', 
  ({ schema }) => (
    <>{schema.content}</>
  ),
  {
    label: 'Text',
    inputs: [
      { name: 'content', type: 'string', label: 'Content', required: true }
    ]
  }
);
