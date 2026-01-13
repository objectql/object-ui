import { ComponentRegistry } from '@object-ui/core';
import { 
  AlertDialog, 
  AlertDialogTrigger, 
  AlertDialogContent, 
  AlertDialogHeader, 
  AlertDialogFooter, 
  AlertDialogTitle, 
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from '@/ui';
import { renderChildren } from '../../lib/utils';

ComponentRegistry.register('alert-dialog', 
  ({ schema, className, ...props }) => (
    <AlertDialog defaultOpen={schema.defaultOpen} {...props}>
      <AlertDialogTrigger asChild>
        {renderChildren(schema.trigger)}
      </AlertDialogTrigger>
      <AlertDialogContent className={className}>
        <AlertDialogHeader>
          {schema.title && <AlertDialogTitle>{schema.title}</AlertDialogTitle>}
          {schema.description && <AlertDialogDescription>{schema.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {renderChildren(schema.content)}
        <AlertDialogFooter>
          {schema.cancelText && <AlertDialogCancel>{schema.cancelText}</AlertDialogCancel>}
          {schema.actionText && <AlertDialogAction onClick={schema.onAction}>{schema.actionText}</AlertDialogAction>}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  {
    label: 'Alert Dialog',
    inputs: [
      { name: 'title', type: 'string', label: 'Title' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'cancelText', type: 'string', label: 'Cancel Text', defaultValue: 'Cancel' },
      { name: 'actionText', type: 'string', label: 'Action Text', defaultValue: 'Continue' },
       { name: 'defaultOpen', type: 'boolean', label: 'Default Open' },
      { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger'
      },
       { 
        name: 'content', 
        type: 'slot', 
        label: 'Content/Body'
      },
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ],
    defaultProps: {
      title: 'Are you sure?',
      description: 'This action cannot be undone.',
      cancelText: 'Cancel',
      actionText: 'Continue',
      trigger: [{ type: 'button', label: 'Open Alert', variant: 'destructive' }]
    }
  }
);
