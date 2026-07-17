// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * EmbeddedItemEditor — full-form editor for items that live INSIDE a
 * parent metadata body (e.g. `object.fields.email`).
 *
 * Embedded items don't have their own HTTP endpoint (`PUT /meta/field/email`
 * does NOT exist for object-scoped fields) — so we:
 *   1. Re-fetch the parent's effective body.
 *   2. Render a SchemaForm using the registered sub-type's schema / form
 *      (e.g. `field` for `object.fields`).
 *   3. On save: deep-clone the parent, splice the modified item back
 *      under `parent.<embeddedPath>.<itemName>`, and PUT the parent.
 *
 * If the sub-type isn't registered (e.g. `index` has no `editAs`), we
 * fall back to a raw-JSON editor so users can still hand-edit and save.
 */

import * as React from 'react';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@object-ui/components';
import { SchemaForm, type SchemaFormIssue } from './SchemaForm';
import { useMetadataClient, useMetadataTypes } from './useMetadata';
import { useMetadataLocale, t, tFormat, translateValidationMessage } from './i18n';

export interface EmbeddedItemEditorProps {
  parentType: string;
  parentName: string;
  /** Dotted path inside parent body where the collection lives. */
  embeddedPath?: string;
  /** Key of the item within the collection (e.g. field name). */
  itemName: string;
  /** Metadata type whose schema/form drives the form. */
  editAs?: string;
  /** Snapshot of the item at the moment of opening (initial draft). */
  initialRaw: Record<string, unknown>;
  /** Called after a successful save with the freshly-saved item. */
  onSaved?: (item: Record<string, unknown>) => void;
}

export function EmbeddedItemEditor({
  parentType,
  parentName,
  embeddedPath,
  itemName,
  editAs,
  initialRaw,
  onSaved,
}: EmbeddedItemEditorProps) {
  const locale = useMetadataLocale();
  const client = useMetadataClient();
  const { entries } = useMetadataTypes(client);
  const subEntry = editAs ? entries.find((e) => e.type === editAs) : undefined;
  // Fallback inline schemas for sub-types the framework registers without
  // a JSON-Schema (validation / index live in object.body but the
  // registry only exposes their metadata, not their shape). The
  // schemas below mirror the framework's Zod definitions and the
  // shapes we see on disk under packages/data-objectstack fixtures.
  const fallback = !subEntry?.schema && editAs ? FALLBACK_SCHEMAS[editAs] : undefined;
  const schema = (subEntry?.schema as Record<string, unknown> | undefined) ?? fallback?.schema;
  const form = (subEntry?.form as any) ?? fallback?.form;

  const [draft, setDraft] = React.useState<Record<string, unknown>>(initialRaw);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [issues, setIssues] = React.useState<SchemaFormIssue[]>([]);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  // Resync if a different item is opened in the drawer.
  React.useEffect(() => {
    setDraft(initialRaw);
    setError(null);
    setIssues([]);
    setSavedAt(null);
  }, [initialRaw, itemName, parentType, parentName]);

  const readOnly =
    subEntry != null && !subEntry.allowOrgOverride && !subEntry.allowRuntimeCreate;

  async function doSave() {
    if (!embeddedPath) {
      setError(t('engine.embedded.saveNoPath', locale));
      return;
    }
    setSaving(true);
    setError(null);
    setIssues([]);
    try {
      // 1. Re-fetch parent to avoid clobbering concurrent edits.
      const layered = await client.layered<Record<string, unknown>>(
        parentType,
        parentName,
      );
      const parent =
        (layered.effective ?? layered.code ?? {}) as Record<string, unknown>;

      // 2. Splice modified item back into the parent collection.
      const updated = spliceEmbedded(parent, embeddedPath, itemName, draft);

      // 3. PUT the parent.
      await client.save(parentType, parentName, updated);
      setSavedAt(Date.now());
      onSaved?.(draft);
    } catch (err: any) {
      // Validation issues from the parent save apply to the embedded
      // path. Try to scope them back to this item.
      if (err?.status === 422 || err?.code === 'invalid_metadata' || err?.code === 'invalid_payload') {
        const raw = err?.body?.issues ?? [];
        const mapped: SchemaFormIssue[] = (Array.isArray(raw) ? raw : []).map((x: any) => {
          const fullPath = Array.isArray(x.path) ? x.path.join('.') : String(x.path ?? '');
          // Trim the `<embeddedPath>.<itemName>.` prefix so issues
          // align with the field they reference inside the sub-form.
          const prefix = `${embeddedPath}.${itemName}.`;
          const trimmed = fullPath.startsWith(prefix)
            ? fullPath.slice(prefix.length)
            : fullPath;
          return { path: trimmed, message: translateValidationMessage(String(x.message ?? 'Invalid'), locale) };
        });
        setIssues(mapped);
        setError(
          mapped.length === 1
            ? t('engine.validation.failedOne', locale)
            : tFormat('engine.validation.failed', locale, { count: mapped.length }),
        );
      } else {
        setError(err?.message ?? String(err));
      }
    } finally {
      setSaving(false);
    }
  }

  // No schema registered for this sub-type: fall back to JSON editing.
  if (!schema) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-xs text-muted-foreground">
          {tFormat('engine.embedded.noSchema', locale, {
            type: editAs ?? 'this item',
            target: `${parentType}/${parentName}.${embeddedPath}.${itemName}`,
          })}
        </div>
        <textarea
          className="w-full h-[60vh] font-mono text-xs border rounded p-3 bg-muted/30"
          value={JSON.stringify(draft, null, 2)}
          onChange={(e) => {
            try {
              setDraft(JSON.parse(e.target.value));
              setError(null);
            } catch (err: any) {
              setError(`${t('engine.form.invalidJson', locale)}: ${err.message}`);
            }
          }}
        />
        {error && (
          <div className="text-sm text-destructive border border-destructive/30 rounded p-2 bg-destructive/5">
            <AlertTriangle className="h-4 w-4 inline mr-1" /> {error}
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={doSave} disabled={saving || !embeddedPath}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            {tFormat('engine.embedded.saveIntoParent', locale, { parentType: 'parent' })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded p-3 bg-destructive/5">
          {error}
        </div>
      )}
      {savedAt != null && !error && (
        <div className="text-sm text-emerald-700 border border-emerald-300 bg-emerald-50 rounded p-2">
          {t('engine.embedded.saved', locale)}
        </div>
      )}
      {readOnly && (
        <div className="text-xs text-amber-800 border border-amber-300 bg-amber-50 rounded p-2">
          {t('engine.embedded.readOnlyParent', locale)}
        </div>
      )}

      <SchemaForm
        schema={schema}
        form={form}
        value={draft}
        onChange={setDraft}
        issues={issues}
      />

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button onClick={doSave} disabled={saving || !embeddedPath}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1" />
          )}
          {tFormat('engine.embedded.saveIntoParent', locale, { parentType })}
        </Button>
      </div>

      {!embeddedPath && (
        <div className="text-xs text-muted-foreground border rounded p-3">
          <div className="font-medium">{t('engine.embedded.readOnly', locale)}</div>
          <div>{t('engine.embedded.noPathHint', locale)}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Return a NEW parent object with the embedded item replaced. The
 * collection at `path` may be either a name-keyed map (`object.fields`)
 * or an array of `{ name, … }` entries (`object.indexes`); we keep the
 * existing shape.
 */
function spliceEmbedded(
  parent: Record<string, unknown>,
  path: string,
  itemName: string,
  item: Record<string, unknown>,
): Record<string, unknown> {
  const segs = path.split('.');
  const next = structuredClone(parent);
  let cur: any = next;
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur[segs[i]] == null) cur[segs[i]] = {};
    cur = cur[segs[i]];
  }
  const leaf = segs[segs.length - 1];
  const existing = cur[leaf];
  if (Array.isArray(existing)) {
    const idx = existing.findIndex(
      (x) => x && typeof x === 'object' && (x as any).name === itemName,
    );
    if (idx >= 0) {
      existing[idx] = item;
    } else {
      existing.push(item);
    }
  } else if (existing && typeof existing === 'object') {
    // Strip the synthetic `name` we injected when extracting the map.
    const { name: _n, ...rest } = item as { name?: unknown } & Record<string, unknown>;
    (existing as Record<string, unknown>)[itemName] = rest;
  } else {
    // Path didn't exist — initialise as a map keyed by item name.
    const { name: _n, ...rest } = item as { name?: unknown } & Record<string, unknown>;
    cur[leaf] = { [itemName]: rest };
  }
  return next;
}

/**
 * Inline JSONSchema + form-spec fallbacks for sub-types that the
 * framework's `/meta` registry doesn't expose a `schema`/`form` for.
 *
 * `index` is the only one we still need to ship here: it's an
 * embedded-only sub-type (lives inside `object.indexes[]`) and is not
 * registered as a standalone metadata type, so the server has no slot
 * to publish a schema for it. Once / if the framework grows an
 * embedded-sub-type registry, this can move server-side too.
 *
 * `validation` used to be here but is now published by the server via
 * `HAND_CRAFTED_SCHEMAS.validation` in `objectql/protocol.ts`.
 */
const FALLBACK_SCHEMAS: Record<
  string,
  { schema: Record<string, unknown>; form?: Record<string, unknown> }
> = {
  index: {
    schema: {
      type: 'object',
      required: ['fields'],
      properties: {
        name: {
          type: 'string',
          title: 'Name',
          description: 'Synthesised from columns if omitted (e.g. idx_email).',
        },
        fields: {
          type: 'array',
          title: 'Fields',
          description: 'Columns to index, in order.',
          items: { type: 'string' },
        },
        type: {
          type: 'string',
          title: 'Algorithm',
          enum: ['btree', 'hash', 'gin', 'gist', 'brin'],
          default: 'btree',
        },
        unique: {
          type: 'boolean',
          title: 'Unique',
          description: 'Enforce uniqueness across the indexed columns.',
        },
        where: {
          type: 'string',
          title: 'Partial-index predicate',
          description: 'Optional WHERE clause for a partial index.',
        },
      },
    },
  },
};
