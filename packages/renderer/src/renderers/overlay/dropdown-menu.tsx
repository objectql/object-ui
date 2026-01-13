import { ComponentRegistry } from '../../registry';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '@object-ui/ui';
import { renderChildren } from '../../utils';

// Helper for recursive menu items
const renderMenuItems = (items: any[]) => {
  if (!items) return null;
  return items.map((item: any, i: number) => {
    if (item.type === 'separator') return <DropdownMenuSeparator key={i} />;
    if (item.type === 'label') return <DropdownMenuLabel key={i}>{item.label}</DropdownMenuLabel>;
    if (item.children) {
        return (
            <DropdownMenuSub key={i}>
                <DropdownMenuSubTrigger inset={item.inset}>
                    {item.icon && <span className="mr-2">{item.icon}</span>}
                    {item.label}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    {renderMenuItems(item.children)}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        )
    }
    
    return (
      <DropdownMenuItem key={i} disabled={item.disabled} inset={item.inset} onSelect={item.onSelect}>
        {item.icon && <span className="mr-2">{item.icon}</span>}
        {item.label}
        {item.shortcut && <span className="ml-auto text-xs tracking-widest opacity-60">{item.shortcut}</span>}
      </DropdownMenuItem>
    );
  });
};

ComponentRegistry.register('dropdown-menu', 
  ({ schema, className, ...props }) => (
    <DropdownMenu modal={schema.modal} defaultOpen={schema.defaultOpen} {...props}>
      <DropdownMenuTrigger asChild>
         {renderChildren(schema.trigger)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={schema.align} side={schema.side} className={className}>
        {schema.label && <DropdownMenuLabel>{schema.label}</DropdownMenuLabel>}
        {schema.label && <DropdownMenuSeparator />}
        {renderMenuItems(schema.items)}
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  {
    label: 'Dropdown Menu',
    inputs: [
      { name: 'label', type: 'string', label: 'Menu Label' },
       { name: 'side', type: 'enum', enum: ['top', 'right', 'bottom', 'left'], label: 'Side' },
      { name: 'align', type: 'enum', enum: ['start', 'center', 'end'], label: 'Align' },
       { 
        name: 'trigger', 
        type: 'slot', 
        label: 'Trigger' 
      },
      { 
        name: 'items', 
        type: 'array', 
        label: 'Items',
        description: 'Recursive structure: { type?: "separator"|"label", label, icon, shortcut, disabled, children: [] }'
      },
      { name: 'className', type: 'string', label: 'Content CSS Class' }
    ],
    defaultProps: {
      trigger: [{ type: 'button', label: 'Menu', variant: 'outline' }],
      items: [
        { label: 'Item 1' },
        { label: 'Item 2' },
        { type: 'separator' },
        { label: 'Item 3' }
      ],
      align: 'start',
      side: 'bottom'
    }
  }
);
