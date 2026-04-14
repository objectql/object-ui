import { useState, useEffect } from 'react';
import { SchemaRendererProvider } from '@object-ui/react';
import type { ObjectRendererProps } from '../types';

/**
 * ObjectRenderer - Renders object views (Grid, Kanban, List, etc.)
 *
 * Framework-agnostic component that renders an object view based on schema.
 * Supports all view types registered in the ComponentRegistry.
 */
export function ObjectRenderer({
  objectName,
  viewId,
  dataSource,
  onRecordClick: _onRecordClick,
  onEdit: _onEdit,
  objectDef: externalObjectDef,
  refreshKey = 0,
}: ObjectRendererProps) {
  const [objectDef, setObjectDef] = useState(externalObjectDef);
  const [loading, setLoading] = useState(!externalObjectDef);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (externalObjectDef) {
      setObjectDef(externalObjectDef);
      setLoading(false);
      return;
    }

    // Fetch object metadata if not provided
    if (dataSource.getMetadata) {
      setLoading(true);
      dataSource
        .getMetadata()
        .then((metadata: any) => {
          const obj = metadata.objects?.find(
            (o: any) => o.name === objectName
          );
          if (obj) {
            setObjectDef(obj);
            setError(null);
          } else {
            setError(`Object "${objectName}" not found`);
          }
        })
        .catch((err: Error) => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setError('Data source does not support metadata fetching');
      setLoading(false);
    }
  }, [objectName, dataSource, externalObjectDef]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  if (!objectDef) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">
          Object definition not found
        </div>
      </div>
    );
  }

  // Build view schema
  const viewSchema = buildObjectViewSchema(objectDef, viewId);

  return (
    <SchemaRendererProvider dataSource={dataSource}>
      <div className="object-renderer h-full" key={refreshKey}>
        {/* Render using SchemaRenderer from @object-ui/react */}
        {/* The actual implementation will delegate to registered view plugins */}
        <div className="h-full p-4">
          <h1 className="mb-4 text-2xl font-bold">
            {objectDef.label || objectDef.name}
          </h1>
          {/* TODO: Integrate with actual SchemaRenderer once available */}
          <div className="text-muted-foreground">
            View rendering for {objectName} (viewId: {viewId || 'default'})
          </div>
        </div>
      </div>
    </SchemaRendererProvider>
  );
}

/**
 * Helper to build view schema from object definition
 */
function buildObjectViewSchema(objectDef: any, viewId?: string) {
  // Find the requested view or use default
  const view = viewId
    ? objectDef.views?.find((v: any) => v.id === viewId || v.name === viewId)
    : objectDef.views?.[0];

  return {
    type: view?.type || 'grid',
    objectName: objectDef.name,
    viewId: view?.id,
    ...view,
  };
}
