/**
 * Object Detail Widgets
 *
 * Self-contained, schema-driven widget components for the object detail page.
 * Each widget receives an `objectName` from its schema props and looks up
 * data from React context (MetadataProvider) — no prop drilling needed.
 *
 * Registered in the ComponentRegistry so they can be composed via PageSchema
 * and rendered by SchemaRenderer.
 *
 * @module components/schema/objectDetailWidgets
 */

import { useMemo } from 'react';
import { Badge } from '@object-ui/components';
import {
  Settings2,
  Link2,
  KeyRound,
  LayoutList,
  PanelTop,
  BarChart3,
  Table,
} from 'lucide-react';
import type { SchemaNode } from '@object-ui/core';
import { useMetadata } from '../../context/MetadataProvider';
import { toObjectDefinition, toFieldDefinition, type MetadataObject } from '../../utils/metadataConverters';

// ---------------------------------------------------------------------------
// Widget schema interface
// ---------------------------------------------------------------------------

/** Schema props for object detail widgets. All widgets receive `objectName`. */
interface ObjectWidgetSchema extends SchemaNode {
  objectName: string;
}

// ---------------------------------------------------------------------------
// Shared hook: resolve object definition + fields from metadata context
// ---------------------------------------------------------------------------

function useObjectData(objectName: string) {
  const { objects: metadataObjects } = useMetadata();

  const metadataObject: MetadataObject | undefined = useMemo(
    () => (metadataObjects || []).find((o: MetadataObject) => o.name === objectName),
    [metadataObjects, objectName],
  );

  const object = useMemo(
    () => (metadataObject ? toObjectDefinition(metadataObject) : null),
    [metadataObject],
  );

  const fields = useMemo(() => {
    if (!metadataObject) return [];
    const raw = Array.isArray(metadataObject.fields)
      ? metadataObject.fields
      : Object.values(metadataObject.fields || {});
    return raw.map(toFieldDefinition);
  }, [metadataObject]);

  return { object, fields, metadataObject };
}

// ---------------------------------------------------------------------------
// ObjectPropertiesWidget
// Schema: { type: 'object-properties', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectPropertiesWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { object, fields } = useObjectData(objectName);

  if (!object) return null;

  return (
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
  );
}

// ---------------------------------------------------------------------------
// ObjectRelationshipsWidget
// Schema: { type: 'object-relationships', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectRelationshipsWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { object } = useObjectData(objectName);

  if (!object) return null;

  return (
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
  );
}

// ---------------------------------------------------------------------------
// ObjectKeysWidget
// Schema: { type: 'object-keys', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectKeysWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { fields } = useObjectData(objectName);

  const keyFields = useMemo(
    () => fields.filter((f) => f.unique || f.name === 'id' || f.externalId),
    [fields],
  );

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4" data-testid="keys-section">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <KeyRound className="h-4 w-4" />
        Keys
      </h2>
      {keyFields.length > 0 ? (
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
      ) : (
        <p className="text-sm text-muted-foreground">No unique keys or primary keys found.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectDataExperienceWidget
// Schema: { type: 'object-data-experience', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectDataExperienceWidget(_props: { schema: ObjectWidgetSchema }) {
  return (
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
  );
}

// ---------------------------------------------------------------------------
// ObjectDataPreviewWidget
// Schema: { type: 'object-data-preview', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectDataPreviewWidget({ schema }: { schema: ObjectWidgetSchema }) {
  const objectName = schema.objectName;
  const { object } = useObjectData(objectName);

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-6 space-y-4" data-testid="data-preview-section">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Table className="h-4 w-4" />
        Data Preview
      </h2>
      <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
        <Table className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p className="text-sm font-medium">Sample Data</p>
        <p className="text-xs mt-1">
          Live data preview for &ldquo;{object?.label || objectName}&rdquo; will be available here
        </p>
      </div>
    </div>
  );
}
