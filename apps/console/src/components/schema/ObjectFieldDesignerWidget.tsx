/**
 * Object Field Designer Widget
 *
 * Self-contained SchemaNode widget that renders the FieldDesigner with full
 * CRUD interactivity (optimistic update → API → rollback). Registered as
 * `object-field-designer` in the ComponentRegistry.
 *
 * Schema: { type: 'object-field-designer', objectName: 'account' }
 *
 * @module components/schema/ObjectFieldDesignerWidget
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { FieldDesigner } from '@object-ui/plugin-designer';
import type { DesignerFieldDefinition } from '@object-ui/types';
import type { SchemaNode } from '@object-ui/core';
import { toast } from 'sonner';
import { useMetadata } from '../../context/MetadataProvider';
import { useMetadataService } from '../../hooks/useMetadataService';
import { MetadataService } from '../../services/MetadataService';
import { toFieldDefinition, type MetadataObject } from '../../utils/metadataConverters';

/** Schema props for the field designer widget. */
interface ObjectFieldDesignerSchema extends SchemaNode {
  objectName: string;
}

export function ObjectFieldDesignerWidget({ schema }: { schema: ObjectFieldDesignerSchema }) {
  const objectName = schema.objectName;
  const { objects: metadataObjects, refresh } = useMetadata();
  const metadataService = useMetadataService();

  // Resolve raw metadata object
  const metadataObject: MetadataObject | undefined = useMemo(
    () => (metadataObjects || []).find((o: MetadataObject) => o.name === objectName),
    [metadataObjects, objectName],
  );

  // Convert raw fields to DesignerFieldDefinition[]
  const fields = useMemo(() => {
    if (!metadataObject) return [];
    const raw = Array.isArray(metadataObject.fields)
      ? metadataObject.fields
      : Object.values(metadataObject.fields || {});
    return raw.map(toFieldDefinition);
  }, [metadataObject]);

  // Local state for optimistic updates
  const [localFields, setLocalFields] = useState<DesignerFieldDefinition[] | null>(null);
  const [saving, setSaving] = useState(false);
  const displayFields = localFields ?? fields;
  const prevFieldsRef = useRef<DesignerFieldDefinition[]>(displayFields);

  const handleFieldsChange = useCallback(
    async (updated: DesignerFieldDefinition[]) => {
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
        ? diff.type === 'create'
          ? `Field "${diff.field.label || diff.field.name}" created`
          : diff.type === 'update'
            ? `Field "${diff.field.label || diff.field.name}" updated`
            : `Field "${diff.field.label || diff.field.name}" deleted`
        : 'Field configuration updated';

      setSaving(true);
      try {
        await metadataService.saveFields(objectName, updated);
        await refresh();
        toast.success(actionLabel);
      } catch (err: any) {
        // Rollback on failure
        setLocalFields(previous);
        prevFieldsRef.current = previous;
        toast.error(err?.message || 'Failed to save field changes');
      } finally {
        setSaving(false);
      }
    },
    [metadataService, objectName, refresh],
  );

  return (
    <div className="space-y-3" data-testid="field-management-section">
      {saving && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="field-saving-indicator">
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving field changes…
        </div>
      )}
      {displayFields.some((f) => f.isSystem) && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2"
          data-testid="system-field-hint"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          System fields (e.g. id, createdAt, updatedAt) are read-only and cannot be edited or deleted.
        </div>
      )}
      <FieldDesigner
        objectName={objectName}
        fields={displayFields}
        onFieldsChange={handleFieldsChange}
      />
    </div>
  );
}
