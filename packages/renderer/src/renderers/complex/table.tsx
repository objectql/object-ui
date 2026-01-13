// table.tsx implementation
import { ComponentRegistry } from '../../registry';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableFooter, 
  TableHead, 
  TableRow, 
  TableCell, 
  TableCaption 
} from '@object-ui/ui';

// A simple data-driven table
ComponentRegistry.register('table', 
  ({ schema, className, ...props }) => (
    <Table className={className} {...props}>
      {schema.caption && <TableCaption>{schema.caption}</TableCaption>}
      <TableHeader>
        <TableRow>
          {schema.columns?.map((col: any, index: number) => (
            <TableHead key={index} className={col.className} style={{ width: col.width }}>
                {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {schema.data?.map((row: any, rowIndex: number) => (
          <TableRow key={rowIndex}>
            {schema.columns?.map((col: any, colIndex: number) => (
                <TableCell key={colIndex} className={col.cellClassName}>
                    {row[col.accessorKey]}
                </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      {schema.footer && (
          <TableFooter>
              <TableRow>
                   <TableCell colSpan={schema.columns?.length}>{schema.footer}</TableCell>
              </TableRow>
          </TableFooter>
      )}
    </Table>
  ),
  {
    label: 'Table',
    inputs: [
      { name: 'caption', type: 'string', label: 'Caption' },
      { name: 'footer', type: 'string', label: 'Footer Content' },
      { 
          name: 'columns', 
          type: 'array', 
          label: 'Columns',
          description: 'Array of { header, accessorKey, className, width }'
      },
       { 
          name: 'data', 
          type: 'array', 
          label: 'Data',
          description: 'Array of objects'
      },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ]
  }
);
