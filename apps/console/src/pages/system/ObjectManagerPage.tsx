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
import { ArrowLeft, Database, Settings2, Link2, Loader2 } from 'lucide-react';
import { ObjectManager, FieldDesigner } from '@object-ui/plugin-designer';
import type { ObjectDefinition, DesignerFieldDefinition, DesignerFieldType } from '@object-ui/types';
import { toast } from 'sonner';
import { useMetadata } from '../../context/MetadataProvider';
import { useMetadataService } from '../../hooks/useMetadataService';
import { MetadataService } from '../../services/MetadataService';

/** Loose shape of a metadata object definition from the ObjectStack API. */
interface MetadataObject {
  name?: string;
  label?: string | { defaultValue?: string; key?: string };
  pluralLabel?: string;
  plural_label?: string;
  description?: string | { defaultValue?: string };
  icon?: string;
  enabled?: boolean;
  fields?: MetadataField[] | Record<string, MetadataField>;
  relationships?: Array<{
    object?: string;
    relatedObject?: string;
    type?: string;
    label?: string;
    name?: string;
    foreign_key?: string;
    foreignKey?: string;
  }>;
}

/** Loose shape of a metadata field definition from the ObjectStack API. */
interface MetadataField {
  name?: string;
  label?: string | { defaultValue?: string; key?: string };
  type?: string;
  group?: string;
  description?: string;
  help?: string;
  required?: boolean;
  unique?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  defaultValue?: string;
  default_value?: string;
  placeholder?: string;
  options?: Array<string | { label?: string; value: string; color?: string }>;
  externalId?: boolean;
  trackHistory?: boolean;
  track_history?: boolean;
  indexed?: boolean;
  reference_to?: string;
  referenceTo?: string;
  formula?: string;
}

/**
 * Convert a metadata object definition (from the API/spec) to the ObjectDefinition
 * type used by the ObjectManager component.
 */
function toObjectDefinition(obj: MetadataObject, index: number): ObjectDefinition {
  const fields = Array.isArray(obj.fields) ? obj.fields : Object.values(obj.fields || {});
  return {
    id: obj.name || `obj_${index}`,
    name: obj.name || '',
    label: typeof obj.label === 'object' ? obj.label.defaultValue || obj.label.key || '' : (obj.label || obj.name || ''),
    pluralLabel: obj.pluralLabel || obj.plural_label || undefined,
    description: typeof obj.description === 'object' ? obj.description.defaultValue : (obj.description || undefined),
    icon: obj.icon || undefined,
    group: obj.name?.startsWith('sys_') ? 'System Objects' : 'Custom Objects',
    sortOrder: index,
    isSystem: obj.name?.startsWith('sys_') || false,
    enabled: obj.enabled !== false,
    fieldCount: fields.length,
    relationships: Array.isArray(obj.relationships)
      ? obj.relationships.map((r: any) => ({
          relatedObject: r.object || r.relatedObject || '',
          type: r.type || 'one-to-many',
          label: r.label || r.name || undefined,
          foreignKey: r.foreign_key || r.foreignKey || undefined,
        }))
      : undefined,
  };
}

/**
 * Convert a metadata field definition to the DesignerFieldDefinition
 * type used by the FieldDesigner component.
 */
function toFieldDefinition(field: MetadataField, index: number): DesignerFieldDefinition {
  return {
    id: field.name || `fld_${index}`,
    name: field.name || '',
    label: typeof field.label === 'object' ? field.label.defaultValue || field.label.key || '' : (field.label || field.name || ''),
    type: (field.type || 'text') as DesignerFieldType,
    group: field.group || undefined,
    sortOrder: index,
    description: field.description || field.help || undefined,
    required: field.required || false,
    unique: field.unique || false,
    readonly: field.readonly || false,
    hidden: field.hidden || false,
    defaultValue: field.defaultValue || field.default_value || undefined,
    placeholder: field.placeholder || undefined,
    options: Array.isArray(field.options)
      ? field.options.map((opt) =>
          typeof opt === 'string'
            ? { label: opt, value: opt }
            : { label: opt.label || opt.value, value: opt.value, color: opt.color }
        )
      : undefined,
    isSystem: field.readonly === true && (field.name === 'id' || field.name === 'createdAt' || field.name === 'updatedAt'),
    externalId: field.externalId || false,
    trackHistory: field.trackHistory || field.track_history || false,
    indexed: field.indexed || false,
    referenceTo: field.reference_to || field.referenceTo || undefined,
    formula: field.formula || undefined,
  };
}

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
      ? diff.type === 'create' ? `Field "${diff.field.label}" created`
        : diff.type === 'update' ? `Field "${diff.field.label}" updated`
        : `Field "${diff.field.label}" deleted`
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
        {/* Relationships */}
        {object.relationships && object.relationships.length > 0 && (
          <div className="pt-2 border-t">
            <span className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
              <Link2 className="h-3.5 w-3.5" />
              Relationships
            </span>
            <div className="flex flex-wrap gap-2">
              {object.relationships.map((rel, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {rel.label || rel.relatedObject} ({rel.type})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Field Management Section */}
      <div className="space-y-3" data-testid="field-management-section">
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="field-saving-indicator">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving field changes…
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
        ? diff.type === 'create' ? `Object "${diff.object.label}" created`
          : diff.type === 'update' ? `Object "${diff.object.label}" updated`
          : `Object "${diff.object.label}" deleted`
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
