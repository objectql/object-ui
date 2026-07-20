// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ViewPreview — renders a View metadata draft using the same `object-view`
 * SchemaRenderer the runtime ObjectView route uses, with the draft's own
 * `config` body injected as a named `listView` so the preview reflects the
 * unsaved edit (not the last saved version).
 *
 * A view is the canonical first-class **ViewItem** ({ viewKind, config }):
 * one view, one `config` body — there are no in-document variant tabs. An
 * object's *other* views are independent ViewItems surfaced by the view
 * switcher (a query), not nested here.
 *
 * The render path forks on `viewKind`:
 *   - list-family (grid / kanban / calendar / …) → `object-view`, with the
 *     draft body injected as a named listView (below);
 *   - form-family (simple / drawer / …) → `object-form`, with the draft's
 *     sections mapped onto the form schema (a form view binds a record layout,
 *     not a list, so the list renderer would just fall back to a bare grid).
 *
 * A raw single-schema draft (a bare `{ type, … }` with no `config` wrapper,
 * e.g. an ad-hoc preview) is rendered straight through SchemaRenderer.
 */

import * as React from 'react';
import { SchemaRenderer, PreviewModeProvider } from '@object-ui/react';
import { toInlineFormType } from './form-preview';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';
import { primaryVariantBinding } from '../view-variant-model';

function resolveObjectName(
  draft: Record<string, unknown>,
  body?: Record<string, unknown>,
): string | undefined {
  const candidates: any[] = [
    body?.object,
    (body as any)?.data?.object,
    (body as any)?.objectName,
    (draft as any).object,
    (draft as any).objectName,
    (draft as any).data?.object,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c) return c;
  }
  return undefined;
}


// A ViewItem form section uses the spec's `{ field, readonly, … }` shape, but
// `object-form` selects fields by `name` and reads `readOnly`. Normalize so the
// section's fields resolve (otherwise every section comes up empty).
function toFormFieldEntry(f: unknown): string | Record<string, unknown> {
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') {
    const o = f as Record<string, unknown>;
    const name = (o.field ?? o.name) as string | undefined;
    if (!name) return o;
    return { ...o, name, readOnly: o.readOnly ?? o.readonly };
  }
  return String(f);
}

function buildFormPreviewSchema(
  objectName: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const rawType = typeof body.type === 'string' ? body.type : 'simple';
  const formType = toInlineFormType(rawType);
  const sections = Array.isArray(body.sections)
    ? (body.sections as any[]).map((s) => ({
        ...s,
        fields: Array.isArray(s?.fields) ? s.fields.map(toFormFieldEntry) : [],
      }))
    : undefined;
  return {
    type: 'object-form',
    objectName,
    // A blank create-mode form: the preview shows the layout without needing a
    // sample record to be selected.
    mode: 'create',
    formType,
    sections,
    fields: Array.isArray(body.fields) ? body.fields : undefined,
    showSubmit: false,
    showCancel: false,
  };
}

export function ViewPreview({ name, draft, editing }: MetadataPreviewProps) {
  // The single ViewItem body (`draft.config`), or undefined for a raw schema.
  const body = React.useMemo(
    () => primaryVariantBinding(draft)?.schema,
    [draft],
  );
  const objectName = React.useMemo(
    () => resolveObjectName(draft, body),
    [draft, body],
  );

  const designMode = !!editing;

  // Surface the draft body as a named listView so the preview renders THIS
  // view (with unsaved edits) rather than the object's saved default.
  const { listViews, defaultViewId, defaultViewType } = React.useMemo(() => {
    if (!body) {
      return { listViews: {}, defaultViewId: undefined, defaultViewType: 'grid' };
    }
    const id = String(name) || 'default';
    return {
      listViews: {
        [id]: {
          ...body,
          label: (body as any).label ?? (draft as any).label ?? name,
        },
      },
      defaultViewId: id,
      defaultViewType: ((body as any).type as string) ?? 'grid',
    };
  }, [body, draft, name]);

  // Hoisted above the early returns below so this hook runs on every render
  // (hook order must stay stable). Only the final `object-view` branch reads it;
  // the earlier branches shadow it with their own local `schema`/`formSchema`.
  const schema = React.useMemo(
    () => ({
      type: 'object-view',
      objectName,
      defaultViewType,
      defaultListView: defaultViewId,
      listViews,
      showSearch: true,
      showFilters: true,
      showCreate: false,
      showRefresh: true,
      showViewSwitcher: true,
    }),
    [objectName, defaultViewType, defaultViewId, listViews],
  );

  // -------------------------------------------------------------------------
  // Raw single-schema draft (no ViewItem `config` wrapper): render directly.
  // -------------------------------------------------------------------------
  if (!body && (draft as any).type) {
    const schema = { ...(draft as Record<string, unknown>) };
    return (
      <PreviewShell hint={`view · ${(schema as any).type}${designMode ? ' · design' : ''}`}>
        <PreviewErrorBoundary fallbackHint="The view's `type` may not be registered, or required fields are missing.">
          <div className="min-h-[300px] max-h-[75vh] overflow-auto">
            <PreviewModeProvider><SchemaRenderer schema={schema as any} /></PreviewModeProvider>
          </div>
        </PreviewErrorBoundary>
      </PreviewShell>
    );
  }

  if (!objectName) {
    return (
      <PreviewShell hint={`view${designMode ? ' · design' : ''}`}>
        <PreviewMessage tone="warn">
          This view has no object binding yet. Set the bound <code>Object</code> in
          the right panel to fetch live data and field options.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  // -------------------------------------------------------------------------
  // Form-family view (`viewKind: 'form'`): render the record form layout via
  // `object-form`. The list renderer (`object-view`) has no form layout, so a
  // form view routed through it just falls back to a bare grid.
  // -------------------------------------------------------------------------
  if ((draft as any).viewKind === 'form' && body) {
    const rawType = String((body as any).type ?? 'simple');
    const formSchema = buildFormPreviewSchema(objectName, body as Record<string, unknown>);
    return (
      <PreviewShell hint={`view · ${rawType} · form${designMode ? ' · design' : ''}`}>
        <PreviewErrorBoundary fallbackHint="The form view references an object or field that doesn't resolve.">
          <div className="min-h-[300px] max-h-[75vh] overflow-auto">
            <PreviewModeProvider><SchemaRenderer schema={formSchema as any} /></PreviewModeProvider>
          </div>
        </PreviewErrorBoundary>
      </PreviewShell>
    );
  }

  // -------------------------------------------------------------------------
  // Delegate to `object-view` — the same renderer the runtime route uses —
  // with the draft body injected so the preview reflects unsaved edits.
  // -------------------------------------------------------------------------
  return (
    <PreviewShell hint={`view · ${defaultViewType}${designMode ? ' · design' : ''}`}>
      <PreviewErrorBoundary fallbackHint="The view references an object or field that doesn't resolve.">
        <div className="min-h-[300px] max-h-[75vh] overflow-auto">
          <PreviewModeProvider><SchemaRenderer schema={schema as any} /></PreviewModeProvider>
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
