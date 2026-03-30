/**
 * SystemObjectViewPage
 *
 * Reusable wrapper that renders a system management page using the
 * metadata-driven ObjectView from @object-ui/plugin-view.
 *
 * Each system object's metadata (from systemObjects.ts) drives the table
 * columns, search, filtering, and CRUD operations automatically —
 * replacing the previous hand-written table implementations.
 */

import type { ComponentType } from 'react';
import { ObjectView } from '@object-ui/plugin-view';
import type { ObjectViewSchema } from '@object-ui/types';
import { useAdapter } from '../../context/AdapterProvider';
import { systemObjects } from './systemObjects';

interface SystemObjectViewPageProps {
  /** System object name (e.g. 'sys_user', 'sys_org') */
  objectName: string;
  /** Page heading */
  title: string;
  /** Page subtitle */
  description: string;
  /** Lucide icon component */
  icon: ComponentType<{ className?: string }>;
  /** When true, disables all mutation operations (create/update/delete) */
  readOnly?: boolean;
  /** Whether the current user has admin privileges (enables CRUD) */
  isAdmin?: boolean;
}

export function SystemObjectViewPage({
  objectName,
  title,
  description,
  icon: Icon,
  readOnly = false,
  isAdmin = false,
}: SystemObjectViewPageProps) {
  const dataSource = useAdapter();
  const objDef = systemObjects.find((o) => o.name === objectName);

  if (!objDef) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6" data-testid={`system-page-${objectName}`}>
        <p className="text-sm text-destructive">
          System object &quot;{objectName}&quot; not found in metadata definitions.
        </p>
      </div>
    );
  }

  const viewDef = objDef.views?.[0];
  const canMutate = !readOnly && isAdmin;

  const schema: ObjectViewSchema = {
    type: 'object-view',
    objectName,
    showSearch: true,
    showFilters: true,
    showSort: true,
    showCreate: canMutate,
    table: {
      columns: viewDef?.columns,
    },
    operations: {
      create: canMutate,
      update: canMutate,
      delete: canMutate,
    },
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6" data-testid={`system-page-${objectName}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-primary/10 p-2 rounded-md shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {dataSource && (
        <ObjectView schema={schema} dataSource={dataSource} />
      )}
    </div>
  );
}
