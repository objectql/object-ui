/**
 * Object Manager Page
 *
 * System administration page for managing object definitions and their fields.
 * Integrates ObjectManager (object list) from @object-ui/plugin-designer and
 * renders the object detail view via PageSchema-driven SchemaRenderer.
 *
 * All object mutations are persisted via MetadataService (optimistic update →
 * API call → rollback on failure). The detail view sections (properties,
 * relationships, keys, data experience, data preview, field designer) are
 * self-contained SchemaNode widgets registered in the ComponentRegistry.
 *
 * Routes:
 *   /system/objects           → Object list (ObjectManager)
 *   /system/objects/:objectName → Object detail (PageSchema via SchemaRenderer)
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Badge } from '@object-ui/components';
import {
  ArrowLeft,
  Database,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { ObjectManager } from '@object-ui/plugin-designer';
import { SchemaRenderer } from '@object-ui/react';
import type { ObjectDefinition, SchemaNode, BaseSchema } from '@object-ui/types';
import { toast } from 'sonner';
import { useMetadata } from '../../context/MetadataProvider';
import { useMetadataService } from '../../hooks/useMetadataService';
import { MetadataService } from '../../services/MetadataService';
import { toObjectDefinition, type MetadataObject } from '../../utils/metadataConverters';
import { buildObjectDetailPageSchema } from '../../schemas/objectDetailPageSchema';

// ---------------------------------------------------------------------------
// Schema rendering error boundary
// ---------------------------------------------------------------------------

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SchemaErrorBoundaryProps {
  children: ReactNode;
}

interface SchemaErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ObjectDetailErrorBoundary extends Component<SchemaErrorBoundaryProps, SchemaErrorBoundaryState> {
  constructor(props: SchemaErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SchemaErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ObjectManagerPage] Schema rendering error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-destructive/50 bg-destructive/5 p-6 text-center"
          data-testid="schema-render-error"
        >
          <AlertTriangle className="h-8 w-8 mx-auto mb-3 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            Failed to render object detail page
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Schema detail content — renders PageSchema body nodes
// ---------------------------------------------------------------------------

function ObjectSchemaDetailContent({ objectName, metadataObject }: {
  objectName: string;
  metadataObject: MetadataObject | undefined;
}) {
  const pageSchema = useMemo(
    () => buildObjectDetailPageSchema(objectName, metadataObject as Record<string, unknown> | undefined),
    [objectName, metadataObject],
  );

  const bodyNodes = pageSchema.body || [];

  return (
    <div className="flex flex-col gap-6" data-testid="schema-detail-content">
      {bodyNodes.map((node: SchemaNode, idx: number) => (
        <SchemaRenderer key={(node as BaseSchema)?.id || idx} schema={node} />
      ))}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export function ObjectManagerPage() {
  const navigate = useNavigate();
  const { appName, objectName: routeObjectName } = useParams();
  const basePath = appName ? `/apps/${appName}/system/objects` : '/system/objects';
  const { objects: metadataObjects, refresh } = useMetadata();
  const metadataService = useMetadataService();

  // Convert metadata objects to ObjectDefinition[]
  const objects = useMemo<ObjectDefinition[]>(
    () => (metadataObjects || []).map(toObjectDefinition),
    [metadataObjects]
  );

  // State for local object edits and saving indicator
  const [localObjects, setLocalObjects] = useState<ObjectDefinition[] | null>(null);
  const [saving, setSaving] = useState(false);
  const displayObjects = localObjects ?? objects;
  const prevObjectsRef = useRef<ObjectDefinition[]>(displayObjects);

  // Find selected object from URL param
  const selectedObject = useMemo(() => {
    if (!routeObjectName) return null;
    return displayObjects.find((o) => o.name === routeObjectName) ?? null;
  }, [routeObjectName, displayObjects]);

  // Find the raw metadata object for field extraction
  const selectedMetadataObject = useMemo(() => {
    if (!routeObjectName) return undefined;
    return (metadataObjects || []).find((o: MetadataObject) => o.name === routeObjectName);
  }, [routeObjectName, metadataObjects]);

  // Navigate to object detail page
  const handleSelectObject = useCallback((obj: ObjectDefinition) => {
    navigate(`${basePath}/${obj.name}`);
  }, [navigate, basePath]);

  // Navigate back to object list
  const handleBackToList = useCallback(() => {
    navigate(basePath);
  }, [navigate, basePath]);

  const handleObjectsChange = useCallback(async (updated: ObjectDefinition[]) => {
    const previous = prevObjectsRef.current;

    // Optimistic update
    setLocalObjects(updated);
    prevObjectsRef.current = updated;

    if (!metadataService) {
      toast.error('Service unavailable — changes saved locally only');
      return;
    }

    const diff = MetadataService.diffObjects(previous, updated);

    setSaving(true);
    try {
      if (diff) {
        if (diff.type === 'delete') {
          await metadataService.deleteObject(diff.object.name);
        } else {
          // create or update — saveItem is an upsert
          await metadataService.saveObject(diff.object);
        }
      } else {
        // Multiple changes or reorder — save all objects
        for (const obj of updated) {
          await metadataService.saveObject(obj);
        }
      }

      await refresh();

      const actionLabel = diff
        ? diff.type === 'create' ? `Object "${diff.object.label || diff.object.name}" created`
          : diff.type === 'update' ? `Object "${diff.object.label || diff.object.name}" updated`
          : `Object "${diff.object.label || diff.object.name}" deleted`
        : 'Object definitions updated';
      toast.success(actionLabel);
    } catch (err: any) {
      // Rollback on failure
      setLocalObjects(previous);
      prevObjectsRef.current = previous;
      toast.error(err?.message || 'Failed to save object changes');
    } finally {
      setSaving(false);
    }
  }, [metadataService, refresh]);

  // Detail view mode: show object detail via PageSchema
  if (selectedObject) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="object-manager-page">
        {/* Back navigation + header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToList}
              data-testid="back-to-objects"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="bg-primary/10 p-2 rounded-md shrink-0">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {selectedObject.label}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedObject.description || selectedObject.name}
              </p>
            </div>
          </div>
        </div>

        {/* PageSchema-driven content with error boundary */}
        <ObjectDetailErrorBoundary>
          <div data-testid="object-detail-view">
            <ObjectSchemaDetailContent
              objectName={selectedObject.name}
              metadataObject={selectedMetadataObject}
            />
          </div>
        </ObjectDetailErrorBoundary>
      </div>
    );
  }

  // List view mode: show ObjectManager
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="object-manager-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-primary/10 p-2 rounded-md shrink-0">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Object Manager
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage object definitions and field configurations
            </p>
          </div>
        </div>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="object-saving-indicator">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving object changes…
        </div>
      )}

      {/* Content */}
      <ObjectManager
        objects={displayObjects}
        onObjectsChange={handleObjectsChange}
        onSelectObject={handleSelectObject}
        showSystemObjects
      />
    </div>
  );
}
