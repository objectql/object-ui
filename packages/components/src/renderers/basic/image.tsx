import { ComponentRegistry } from '@object-ui/core';

ComponentRegistry.register('image',
  ({ schema, className, ...props }) => (
    <img
      src={schema.src}
      alt={schema.alt || ''}
      className={className}
      {...props}
    />
  ),
  {
    label: 'Image',
    icon: 'image',
    category: 'basic',
    inputs: [
      { name: 'src', type: 'string', label: 'Source URL' },
      { name: 'alt', type: 'string', label: 'Alt Text' },
      { name: 'className', type: 'string', label: 'Classes' }
    ]
  }
);
