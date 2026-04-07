/**
 * Object Manager Page
 *
 * System administration page for managing object definitions and their fields.
 * Integrates both ObjectManager (object list/CRUD) and FieldDesigner (field
 * configuration wizard) from @object-ui/plugin-designer.
 *
 * All object and field mutations are persisted to the backend via the
 * MetadataService (optimistic update → API call → rollback on failure).
 *
 * Routes:
 *   /system/objects           → Object list (ObjectManager)
 *   /system/objects/:objectName → Object detail with field management (FieldDesigner)
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Badge } from '@object-ui/components';
import {
  ArrowLeft,
  Database,
  Settings2,
  Link2,
  Loader2,
  KeyRound,
  LayoutList,
  PanelTop,
  BarChart3,
  Table,
  AlertCircle,
} from 'lucide-react';
import { ObjectManager, FieldDesigner } from '@object-ui/plugin-designer';
import type { ObjectDefinition, DesignerFieldDefinition } from '@object-ui/types';
import { toast } from 'sonner';
import { useMetadata } from '../../context/MetadataProvider';
import { useMetadataService } from '../../hooks/useMetadataService';
import { MetadataService } from '../../services/MetadataService';
import { toObjectDefinition, toFieldDefinition, type MetadataObject } from '../../utils/metadataConverters';

// ============================================================================
// Object Detail View
// ============================================================================

interface ObjectDetailViewProps {
  object: ObjectDefinition;
  metadataObject: MetadataObject | undefined;
  onBack: () => void;
  metadataService: MetadataService | null;
  onRefresh: () => Promise<void>;
}

function ObjectDetailView({ object, metadataObject, onBack, metadataService, onRefresh }: ObjectDetailViewProps) {
  const rawFields = metadataObject
    ? (Array.isArray(metadataObject.fields) ? metadataObject.fields : Object.values(metadataObject.fields || {}))
    : [];
  const fields = useMemo(() => rawFields.map(toFieldDefinition), [rawFields]);
  const [localFields, setLocalFields] = useState<DesignerFieldDefinition[] | null>(null);
  const [saving, setSaving] = useState(false);
  const displayFields = localFields ?? fields;
  const prevFieldsRef = useRef<DesignerFieldDefinition[]>(displayFields);

  const handleFieldsChange = useCallback(async (updated: DesignerFieldDefinition[]) => {
    const previous = prevFieldsRef.current;

    // Optimistic update
    setLocalFields(updated);
    prevFieldsRef.current = updated;

    if (!metadataService) {
      toast.error('Service unavailable — changes saved locally only');
      return;
    }

    const diff = MetadataService.diffFields(previous, updated);
    const actionLabel = diff
      ? diff.type === 'create' ? `Field "${diff.field.label || diff.field.name}" created`
        : diff.type === 'update' ? `Field "${diff.field.label || diff.field.name}" updated`
        : `Field "${diff.field.label || diff.field.name}" deleted`
      : 'Field configuration updated';

    setSaving(true);
    try {
      await metadataService.saveFields(object.name, updated);
      await onRefresh();
      toast.success(actionLabel);
    } catch (err: any) {
      // Rollback on failure
      setLocalFields(previous);
      prevFieldsRef.current = previous;
      toast.error(err?.message || 'Failed to save field changes');
    } finally {
      setSaving(false);
    }
  }, [metadataService, object.name, onRefresh]);

  return (
    <div className="flex flex-col gap-6" data-testid="object-detail-view">
      {/* Back navigation + header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="back-to-objects"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="bg-primary/10 p-2 rounded-md shrink-0">
            <Database className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {object.label}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {object.description || object.name}
            </p>
          </div>
        </div>
      </div>

      {/* Object Properties Card */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4" data-testid="object-properties">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Object Properties
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">API Name</span>
            <p className="font-mono text-xs mt-0.5">{object.name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Label</span>
            <p className="mt-0.5">{object.label}</p>
          </div>
          {object.pluralLabel && (
            <div>
              <span className="text-muted-foreground">Plural Label</span>
              <p className="mt-0.5">{object.pluralLabel}</p>
            </div>
          )}
          {object.group && (
            <div>
              <span className="text-muted-foreground">Group</span>
              <p className="mt-0.5">{object.group}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Status</span>
            <p className="mt-0.5">
              <Badge variant={object.enabled !== false ? 'default' : 'secondary'}>
                {object.enabled !== false ? 'Enabled' : 'Disabled'}
              </Badge>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Fields</span>
            <Badge variant="outline">{object.fieldCount ?? fields.length}</Badge>
          </div>
          {object.isSystem && (
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="mt-0.5">
                <Badge variant="secondary">System Object</Badge>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Relationships Section */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4" data-testid="relationships-section">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Relationships
        </h2>
        {object.relationships && object.relationships.length > 0 ? (
          <div className="space-y-2">
            {object.relationships.map((rel, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                <Badge variant="outline" className="text-xs shrink-0">
                  {rel.type}
                </Badge>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{rel.label || rel.relatedObject}</span>
                  {rel.label && rel.label !== rel.relatedObject && (
                    <span className="text-muted-foreground ml-1">→ {rel.relatedObject}</span>
                  )}
                  {rel.foreignKey && (
                    <span className="text-muted-foreground text-xs ml-2">(FK: {rel.foreignKey})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No relationships defined for this object.</p>
        )}
      </div>

      {/* Keys Section */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4" data-testid="keys-section">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Keys
        </h2>
        {(() => {
          const keyFields = displayFields.filter(
            (f) => f.unique || f.name === 'id' || f.externalId
          );
          if (keyFields.length > 0) {
            return (
              <div className="space-y-2">
                {keyFields.map((kf) => (
                  <div key={kf.name} className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                    <Badge variant={kf.name === 'id' ? 'default' : 'outline'} className="text-xs shrink-0">
                      {kf.name === 'id' ? 'Primary Key' : kf.externalId ? 'External ID' : 'Unique'}
                    </Badge>
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{kf.label || kf.name}</span>
                      <span className="text-muted-foreground text-xs ml-2">({kf.type})</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <p className="text-sm text-muted-foreground">No unique keys or primary keys found.</p>
          );
        })()}
      </div>

      {/* Data Experience Section */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4" data-testid="data-experience-section">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <LayoutList className="h-4 w-4" />
          Data Experience
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-md border border-dashed p-4 text-center" data-testid="data-experience-forms">
            <PanelTop className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Forms</p>
            <p className="text-xs text-muted-foreground mt-1">Design forms for data entry</p>
          </div>
          <div className="rounded-md border border-dashed p-4 text-center" data-testid="data-experience-views">
            <LayoutList className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Views</p>
            <p className="text-xs text-muted-foreground mt-1">Configure list and detail views</p>
          </div>
          <div className="rounded-md border border-dashed p-4 text-center" data-testid="data-experience-dashboards">
            <BarChart3 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Dashboards</p>
            <p className="text-xs text-muted-foreground mt-1">Build visual dashboards</p>
          </div>
        </div>
      </div>

      {/* Inline Data Preview (placeholder) */}
      <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4" data-testid="data-preview-section">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Table className="h-4 w-4" />
          Data Preview
        </h2>
        <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
          <Table className="h-8 w-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">Sample Data</p>
          <p className="text-xs mt-1">
            Live data preview for &ldquo;{object.label}&rdquo; will be available here
          </p>
        </div>
      </div>

      {/* Field Management Section */}
      <div className="space-y-3" data-testid="field-management-section">
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="field-saving-indicator">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving field changes…
          </div>
        )}
        {/* System field hint */}
        {displayFields.some((f) => f.isSystem) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2" data-testid="system-field-hint">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            System fields (e.g. id, createdAt, updatedAt) are read-only and cannot be edited or deleted.
          </div>
        )}
        <FieldDesigner
          objectName={object.name}
          fields={displayFields}
          onFieldsChange={handleFieldsChange}
        />
      </div>
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

  // Detail view mode: show object detail + FieldDesigner
  if (selectedObject) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="object-manager-page">
        <ObjectDetailView
          object={selectedObject}
          metadataObject={selectedMetadataObject}
          onBack={handleBackToList}
          metadataService={metadataService}
          onRefresh={refresh}
        />
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
