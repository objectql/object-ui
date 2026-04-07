/**
 * Object Manager List Adapter
 *
 * Custom list component for the `object` metadata type, injected via the
 * `listComponent` extension point on MetadataTypeConfig. Wraps the existing
 * `ObjectManager` from @object-ui/plugin-designer and wires it to the
 * MetadataService CRUD pipeline (optimistic update → API call → rollback).
 *
 * The adapter is rendered by MetadataManagerPage when the resolved config
 * specifies a `listComponent`, replacing the default card/grid list.
 *
 * @module components/ObjectManagerListAdapter
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ObjectManager } from '@object-ui/plugin-designer';
import type { ObjectDefinition } from '@object-ui/types';
import { toast } from 'sonner';
import { useMetadata } from '../context/MetadataProvider';
import { useMetadataService } from '../hooks/useMetadataService';
import { MetadataService } from '../services/MetadataService';
import { toObjectDefinition, type MetadataObject } from '../utils/metadataConverters';
import type { MetadataListComponentProps } from '../config/metadataTypeRegistry';

export function ObjectManagerListAdapter({ basePath, metadataType }: MetadataListComponentProps) {
  const navigate = useNavigate();
  const { objects: metadataObjects, refresh } = useMetadata();
  const metadataService = useMetadataService();

  // Convert metadata objects to ObjectDefinition[]
  const objects = useMemo<ObjectDefinition[]>(
    () => (metadataObjects || []).map(toObjectDefinition),
    [metadataObjects],
  );

  // State for local object edits and saving indicator
  const [localObjects, setLocalObjects] = useState<ObjectDefinition[] | null>(null);
  const [saving, setSaving] = useState(false);
  const displayObjects = localObjects ?? objects;
  const prevObjectsRef = useRef<ObjectDefinition[]>(displayObjects);

  // Navigate to object detail page via the metadata detail route
  const handleSelectObject = useCallback(
    (obj: ObjectDefinition) => {
      navigate(`${basePath}/system/metadata/${metadataType}/${obj.name}`);
    },
    [navigate, basePath, metadataType],
  );

  const handleObjectsChange = useCallback(
    async (updated: ObjectDefinition[]) => {
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
          ? diff.type === 'create'
            ? `Object "${diff.object.label || diff.object.name}" created`
            : diff.type === 'update'
              ? `Object "${diff.object.label || diff.object.name}" updated`
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
    },
    [metadataService, refresh],
  );

  return (
    <>
      {/* Saving indicator */}
      {saving && (
        <div
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid="object-saving-indicator"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Saving object changes…
        </div>
      )}

      {/* ObjectManager from @object-ui/plugin-designer */}
      <ObjectManager
        objects={displayObjects}
        onObjectsChange={handleObjectsChange}
        onSelectObject={handleSelectObject}
        showSystemObjects
      />
    </>
  );
}
