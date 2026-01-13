import { ComponentRegistry } from '../../registry';
import { renderChildren } from '../../utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@object-ui/ui';

ComponentRegistry.register('card', 
  ({ schema, className, ...props }) => (
    <Card className={className} {...props}>
      {(schema.title || schema.description) && (
        <CardHeader>
          {schema.title && <CardTitle>{schema.title}</CardTitle>}
          {schema.description && <CardDescription>{schema.description}</CardDescription>}
        </CardHeader>
      )}
      {schema.body && <CardContent>{renderChildren(schema.body)}</CardContent>}
      {schema.footer && <CardFooter>{renderChildren(schema.footer)}</CardFooter>}
    </Card>
  ),
  {
    label: 'Card',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      title: 'Card Title',
      description: 'Card description goes here',
      className: 'w-full'
    }
  }
);
