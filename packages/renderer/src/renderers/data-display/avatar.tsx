import { ComponentRegistry } from '../../registry';
import {
  Avatar,
  AvatarImage,
  AvatarFallback
} from '@object-ui/ui';

ComponentRegistry.register('avatar', 
  ({ schema, className, ...props }) => (
    <Avatar className={className} {...props}>
      <AvatarImage src={schema.src} alt={schema.alt} />
      <AvatarFallback>{schema.fallback}</AvatarFallback>
    </Avatar>
  ),
  {
    label: 'Avatar',
    inputs: [
      { name: 'src', type: 'string', label: 'Image URL' },
      { name: 'alt', type: 'string', label: 'Alt Text' },
      { name: 'fallback', type: 'string', label: 'Fallback Initials', defaultValue: 'CN' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
