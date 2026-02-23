/**
 * Page View Component
 * Renders a custom page based on the pageName parameter.
 * Edit opens a right-side drawer with PageCanvasEditor for real-time preview.
 */

import { useState, useCallback, lazy, Suspense } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { SchemaRenderer } from '@object-ui/react';
import { Empty, EmptyTitle, EmptyDescription } from '@object-ui/components';
import { FileText, Pencil } from 'lucide-react';
import { MetadataToggle, MetadataPanel, useMetadataInspector } from './MetadataInspector';
import { useMetadata } from '../context/MetadataProvider';
import { DesignDrawer } from './DesignDrawer';
import type { PageSchema } from '@object-ui/types';

const PageCanvasEditor = lazy(() =>
  import('@object-ui/plugin-designer').then((m) => ({ default: m.PageCanvasEditor })),
);

export function PageView() {
  const { pageName } = useParams<{ pageName: string }>();
  const [searchParams] = useSearchParams();
  const { showDebug, toggleDebug } = useMetadataInspector();
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Find page definition from API-driven metadata
  const { pages } = useMetadata();
  const page = pages?.find((p: any) => p.name === pageName);

  // Local schema state for live preview — initialised from metadata
  const [editSchema, setEditSchema] = useState<PageSchema | null>(null);

  const handleOpenDrawer = useCallback(() => {
    // Snapshot the current page definition as starting schema
    setEditSchema(page as PageSchema);
    setDrawerOpen(true);
  }, [page]);

  const handleCloseDrawer = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      // Drawer closed — keep the latest saved schema (already persisted via auto-save)
    }
  }, []);

  if (!page) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <Empty>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <EmptyTitle>Page Not Found</EmptyTitle>
          <EmptyDescription>
            The page &quot;{pageName}&quot; could not be found.
            It may have been removed or renamed.
          </EmptyDescription>
        </Empty>
      </div>
    );
  }

  // Convert URL search params to an object for the page context
  const params = Object.fromEntries(searchParams.entries());

  // Use the live-edited schema for preview when the drawer is open
  const previewSchema = drawerOpen && editSchema ? editSchema : page;

  return (
    <div className="flex flex-row h-full w-full overflow-hidden relative">
        <div className="flex-1 overflow-auto h-full relative group">
             <div className={`absolute top-1.5 sm:top-2 right-1.5 sm:right-2 z-50 flex items-center gap-1.5 transition-opacity ${showDebug ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                 <button
                   type="button"
                   onClick={handleOpenDrawer}
                   className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
                   data-testid="page-edit-button"
                 >
                   <Pencil className="h-3.5 w-3.5" />
                   Edit
                 </button>
                 <MetadataToggle open={showDebug} onToggle={toggleDebug} />
             </div>
             <SchemaRenderer 
                schema={{
                    ...previewSchema,
                    type: (previewSchema as any).type || 'page',
                    context: { ...(previewSchema as any).context, params }
                }} 
             />
        </div>
        <MetadataPanel
            open={showDebug}
            sections={[{ title: 'Page Configuration', data: previewSchema }]}
        />
        <DesignDrawer
          open={drawerOpen}
          onOpenChange={handleCloseDrawer}
          title={`Edit Page: ${(page as any).label || (page as any).title || pageName}`}
          schema={editSchema || page}
          onSchemaChange={setEditSchema}
          collection="sys_page"
          recordName={pageName!}
        >
          {(schema, onChange) => (
            <Suspense fallback={<div className="p-4 text-muted-foreground">Loading editor…</div>}>
              <PageCanvasEditor schema={schema} onChange={onChange} />
            </Suspense>
          )}
        </DesignDrawer>
    </div>
  );
}
