/**
 * DashboardDesignPage
 *
 * Console page that wraps the DashboardEditor for editing dashboard schemas.
 *
 * Route: /design/dashboard/:dashboardName
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardEditor } from '@object-ui/plugin-designer';
import type { DashboardSchema } from '@object-ui/types';
import { toast } from 'sonner';
import { useAdapter } from '../context/AdapterProvider';
import { useMetadata } from '../context/MetadataProvider';
import { ArrowLeft } from 'lucide-react';

export function DashboardDesignPage() {
  const navigate = useNavigate();
  const { dashboardName } = useParams<{ dashboardName: string }>();
  const dataSource = useAdapter();
  const { dashboards, refresh } = useMetadata();

  const dashboard = dashboards?.find((d: any) => d.name === dashboardName);

  const [schema, setSchema] = useState<DashboardSchema>(
    () =>
      (dashboard as DashboardSchema) || {
        type: 'dashboard',
        name: dashboardName ?? '',
        title: dashboardName ?? '',
        columns: 2,
        widgets: [],
      },
  );
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  const saveSchema = useCallback(
    async (toSave: DashboardSchema) => {
      try {
        if (dataSource) {
          await dataSource.update('sys_dashboard', dashboardName!, toSave);
          // Refresh metadata cache so other pages see saved changes
          refresh().catch(() => {});
          return true;
        }
      } catch {
        // Save errors are non-blocking; user can retry via export
      }
      return false;
    },
    [dataSource, dashboardName, refresh],
  );

  const handleChange = useCallback(
    async (updated: DashboardSchema) => {
      setSchema(updated);
      await saveSchema(updated);
    },
    [saveSchema],
  );

  // Ctrl+S / Cmd+S keyboard shortcut to explicitly save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveSchema(schemaRef.current).then((ok) => {
          if (ok) toast.success('Dashboard saved');
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveSchema]);

  const handleExport = useCallback(
    (exported: DashboardSchema) => {
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboardName || 'dashboard'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dashboard schema exported');
    },
    [dashboardName],
  );

  const handleImport = useCallback(
    (imported: DashboardSchema) => {
      toast.success('Dashboard schema imported');
      handleChange(imported);
    },
    [handleChange],
  );

  if (!dashboard) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Dashboard &quot;{dashboardName}&quot; not found
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" data-testid="dashboard-design-page">
      <div className="flex items-center gap-3 border-b px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Go back"
          data-testid="dashboard-design-back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-semibold tracking-tight truncate">
          Edit Dashboard: {(dashboard as any).label || (dashboard as any).title || dashboardName}
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <DashboardEditor
          schema={schema}
          onChange={handleChange}
          onExport={handleExport}
          onImport={handleImport}
        />
      </div>
    </div>
  );
}
