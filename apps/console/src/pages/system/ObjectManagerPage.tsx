/**
 * Object Manager Page
 *
 * System administration page for managing object definitions and their fields.
 * Integrates both ObjectManager (object list/CRUD) and FieldDesigner (field
 * configuration wizard) from @object-ui/plugin-designer.
 *
 * When an object is selected, the FieldDesigner opens to configure its fields.
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@object-ui/components';
import { ArrowLeft } from 'lucide-react';
import { ObjectManager, FieldDesigner } from '@object-ui/plugin-designer';
import type { ObjectDefinition, DesignerFieldDefinition } from '@object-ui/types';
import { toast } from 'sonner';
import { useMetadata } from '../../context/MetadataProvider';

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
    type: field.type || 'text',
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

export function ObjectManagerPage() {
  const navigate = useNavigate();
  const { appName } = useParams();
  const basePath = appName ? `/apps/${appName}` : '';
  const { objects: metadataObjects } = useMetadata();

  // Convert metadata objects to ObjectDefinition[]
  const objects = useMemo<ObjectDefinition[]>(
    () => (metadataObjects || []).map(toObjectDefinition),
    [metadataObjects]
  );

  // State
  const [selectedObject, setSelectedObject] = useState<ObjectDefinition | null>(null);
  const [localObjects, setLocalObjects] = useState<ObjectDefinition[] | null>(null);

  // Use local state if user has made changes, otherwise use metadata
  const displayObjects = localObjects ?? objects;

  // Get fields for the selected object from metadata
  const selectedObjectFields = useMemo<DesignerFieldDefinition[]>(() => {
    if (!selectedObject) return [];
    const metaObj = (metadataObjects || []).find((o: MetadataObject) => o.name === selectedObject.name);
    if (!metaObj) return [];
    const rawFields = Array.isArray(metaObj.fields) ? metaObj.fields : Object.values(metaObj.fields || {});
    return rawFields.map(toFieldDefinition);
  }, [selectedObject, metadataObjects]);

  const [localFields, setLocalFields] = useState<DesignerFieldDefinition[] | null>(null);
  const displayFields = localFields ?? selectedObjectFields;

  // Reset local fields when selected object changes
  const handleSelectObject = useCallback((obj: ObjectDefinition) => {
    setSelectedObject(obj);
    setLocalFields(null);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedObject(null);
    setLocalFields(null);
  }, []);

  const handleObjectsChange = useCallback((updated: ObjectDefinition[]) => {
    setLocalObjects(updated);
    toast.success('Object definitions updated');
  }, []);

  const handleFieldsChange = useCallback((updated: DesignerFieldDefinition[]) => {
    setLocalFields(updated);
    toast.success('Field configuration updated');
  }, []);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" data-testid="object-manager-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {selectedObject && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBackToList}
              data-testid="back-to-objects"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {selectedObject ? selectedObject.label : 'Object Manager'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedObject
                ? `Configure fields for ${selectedObject.label}`
                : 'Manage object definitions and field configurations'}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedObject ? (
        <FieldDesigner
          objectName={selectedObject.name}
          fields={displayFields}
          onFieldsChange={handleFieldsChange}
        />
      ) : (
        <ObjectManager
          objects={displayObjects}
          onObjectsChange={handleObjectsChange}
          onSelectObject={handleSelectObject}
          showSystemObjects
        />
      )}
    </div>
  );
}
