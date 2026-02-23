/**
 * DesignDrawer
 *
 * A right-side drawer that hosts visual editors (PageCanvasEditor / DashboardEditor)
 * for inline editing with real-time preview.  Uses the Shadcn Sheet primitive so the
 * main workspace remains visible while the user edits.
 */

import { useCallback, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@object-ui/components';
import { toast } from 'sonner';
import { useAdapter } from '../context/AdapterProvider';

export interface DesignDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Called when the drawer requests close */
  onOpenChange: (open: boolean) => void;
  /** Human-readable title shown in the drawer header */
  title: string;
  /** Optional description */
  description?: string;
  /** The current schema (PageSchema | DashboardSchema) */
  schema: any;
  /** Called when the editor modifies the schema — parent updates its own state for live preview */
  onSchemaChange: (updated: any) => void;
  /** sys_page | sys_dashboard */
  collection: string;
  /** Record key for the update call */
  recordName: string;
  /** Render prop: receives (schema, onChange) and returns the editor JSX */
  children: (schema: any, onChange: (updated: any) => void) => React.ReactNode;
}

export function DesignDrawer({
  open,
  onOpenChange,
  title,
  description,
  schema,
  onSchemaChange,
  collection,
  recordName,
  children,
}: DesignDrawerProps) {
  const dataSource = useAdapter();
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  const saveSchema = useCallback(
    async (toSave: any) => {
      try {
        if (dataSource) {
          await dataSource.update(collection, recordName, toSave);
          return true;
        }
      } catch (err) {
        console.warn('[DesignDrawer] Auto-save failed:', err);
        // Save errors are non-blocking; user can retry via Ctrl+S
      }
      return false;
    },
    [dataSource, collection, recordName],
  );

  const handleChange = useCallback(
    async (updated: any) => {
      onSchemaChange(updated);
      await saveSchema(updated);
    },
    [onSchemaChange, saveSchema],
  );

  // Ctrl+S / Cmd+S keyboard shortcut to explicitly save while drawer is open
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSchema(schemaRef.current).then((ok) => {
          if (ok) toast.success(`${title} saved`);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, saveSchema, title]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:w-[540px] sm:max-w-[540px] lg:w-[640px] lg:max-w-[640px] p-0 flex flex-col"
        data-testid="design-drawer"
      >
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className={description ? '' : 'sr-only'}>
            {description || `Visual editor — configure and preview ${title}`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-auto p-4">
          {children(schema, handleChange)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
