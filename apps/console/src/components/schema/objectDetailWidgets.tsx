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
    () => (metadataObject ? toObjectDefinition(metadataObject, 0) : null),
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
    <div className="space-y-6" data-testid="object-properties">
      {/* Basic Information Section */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Basic Information
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-muted-foreground">Display Name</dt>
            <dd className="text-sm font-medium">{object.label}</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-muted-foreground">API Name</dt>
            <dd className="text-sm font-mono bg-muted/50 rounded px-2 py-1">{object.name}</dd>
          </div>
          {object.pluralLabel && (
            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-muted-foreground">Plural Label</dt>
              <dd className="text-sm font-medium">{object.pluralLabel}</dd>
            </div>
          )}
          {object.group && (
            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-muted-foreground">Group</dt>
              <dd className="text-sm font-medium">{object.group}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Configuration Section */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Configuration
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={object.enabled !== false ? 'default' : 'secondary'} className="font-normal">
                {object.enabled !== false ? 'Enabled' : 'Disabled'}
              </Badge>
            </dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-muted-foreground">Field Count</dt>
            <dd className="text-sm font-medium">
              {(object.fieldCount ?? fields.length) === 1
                ? '1 field'
                : `${object.fieldCount ?? fields.length} fields`}
            </dd>
          </div>
          {object.isSystem && (
            <div className="space-y-1.5">
              <dt className="text-xs font-medium text-muted-foreground">Type</dt>
              <dd>
                <Badge variant="secondary" className="font-normal">System Object</Badge>
              </dd>
            </div>
          )}
        </dl>
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

  const hasRelationships = object.relationships && object.relationships.length > 0;

  return (
    <div className="space-y-4" data-testid="relationships-section">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Relationships
        </h3>
        {hasRelationships ? (
          <div className="space-y-3">
            {(object.relationships ?? []).map((rel, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <Badge variant="outline" className="text-xs shrink-0 mt-0.5">
                  {rel.type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{rel.label || rel.relatedObject}</p>
                  {rel.label && rel.label !== rel.relatedObject && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Related Object: {rel.relatedObject}
                    </p>
                  )}
                  {rel.foreignKey && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Foreign Key: <span className="font-mono">{rel.foreignKey}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 border border-dashed rounded-lg">
            <Link2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No relationships defined for this object.</p>
          </div>
        )}
      </div>
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
    <div className="space-y-4" data-testid="keys-section">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Unique Keys
        </h3>
        {keyFields.length > 0 ? (
          <div className="space-y-3">
            {keyFields.map((kf) => (
              <div
                key={kf.name}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <Badge
                  variant={kf.name === 'id' ? 'default' : 'outline'}
                  className="text-xs shrink-0 mt-0.5"
                >
                  {kf.name === 'id' ? 'Primary Key' : kf.externalId ? 'External ID' : 'Unique'}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{kf.label || kf.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Type: <span className="font-mono">{kf.type}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 px-4 border border-dashed rounded-lg">
            <KeyRound className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No unique keys or primary keys found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ObjectDataExperienceWidget
// Schema: { type: 'object-data-experience', objectName: 'account' }
// ---------------------------------------------------------------------------

export function ObjectDataExperienceWidget(_props: { schema: ObjectWidgetSchema }) {
  return (
    <div className="space-y-4" data-testid="data-experience-section">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Data Experience
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure how users interact with data in this object
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border p-6 text-center" data-testid="data-experience-forms">
            <PanelTop className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-semibold mb-1">Forms</p>
            <p className="text-xs text-muted-foreground">Design forms for data entry</p>
          </div>
          <div className="rounded-lg border p-6 text-center" data-testid="data-experience-views">
            <LayoutList className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-semibold mb-1">Views</p>
            <p className="text-xs text-muted-foreground">Configure list and detail views</p>
          </div>
          <div className="rounded-lg border p-6 text-center" data-testid="data-experience-dashboards">
            <BarChart3 className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-semibold mb-1">Dashboards</p>
            <p className="text-xs text-muted-foreground">Build visual dashboards</p>
          </div>
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
    <div className="space-y-4" data-testid="data-preview-section">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Data Preview
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          View sample records from this object
        </p>
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Table className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium mb-1">Sample Data</p>
          <p className="text-xs text-muted-foreground">
            Live data preview for &ldquo;{object?.label || objectName}&rdquo; will be available here
          </p>
        </div>
      </div>
    </div>
  );
}
