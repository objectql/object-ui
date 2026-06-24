// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PagePreview — renders a Page metadata record using the runtime
 * SchemaRenderer so authors see exactly what end-users would see.
 *
 * Reads the live draft (not the server-saved record) so edits in the
 * Form tab preview instantly. URL query params are intentionally not
 * threaded in: previews run in a sandbox with no params context.
 */

import * as React from 'react';
import { SchemaRenderer, RecordContextProvider } from '@object-ui/react';
import { buildExpandFields } from '@object-ui/core';
import { buildDefaultPageSchema } from '@object-ui/plugin-detail';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewErrorBoundary, PreviewMessage } from './PreviewShell';
import { OutlineStrip } from './OutlineStrip';
import { PageBlockCanvas } from './PageBlockCanvas';
import { InterfaceListPage } from '../../InterfaceListPage';
import { t as tr } from '../i18n';

interface Block { type?: string; id?: string; children?: Block[]; [k: string]: unknown }

export function PagePreview({ draft, editing, selection, onSelectionChange, onPatch, locale }: MetadataPreviewProps) {
  const schema = React.useMemo(() => {
    // SchemaRenderer needs a `type` discriminator. Page schemas may
    // omit it (Page is the implicit type at this metadata level), so
    // we inject it if missing while preserving any explicit override.
    const t = (draft as { type?: string }).type ?? 'page';
    return { ...(draft as Record<string, unknown>), type: t };
  }, [draft]);

  const designMode = !!(editing && onSelectionChange);
  const canEdit = designMode && !!onPatch;
  const selectedId = selection && selection.kind === 'block' ? selection.id : null;

  // ADR-0047 interface pages are config-driven, not region-composed. The
  // runtime (PageView) renders them via InterfaceListPage; the generic
  // SchemaRenderer fallback would only produce a bare list shell with no
  // source binding or user filters. Computed here, consumed after all hooks
  // (the early return must not sit above later hooks — Rules of Hooks).
  const isInterfacePage = !!(draft as { interfaceConfig?: { source?: string } })?.interfaceConfig?.source;

  // Pages may use either of two canonical shapes:
  //   1. `regions: [{ name, components: [...] }]`  (ObjectStack spec, used by seeded pages)
  //   2. `children: [...]`                         (raw SDUI tree shape)
  // Detect which one is in use and surface chips/IDs accordingly.
  const shape: 'regions' | 'children' = React.useMemo(() => {
    if (Array.isArray((draft as any).regions)) return 'regions';
    return 'children';
  }, [draft]);

  const blockEntries = React.useMemo(() => {
    if (shape === 'regions') {
      const regions = (draft as any).regions as Array<{ name?: string; components?: Block[] }>;
      const out: { id: string; label: string }[] = [];
      regions.forEach((r, i) => {
        const comps = Array.isArray(r.components) ? r.components : [];
        comps.forEach((c, j) => {
          out.push({
            id: `regions[${i}].components[${j}]`,
            label: c.id || c.type || `${r.name ?? `region ${i + 1}`} · ${j + 1}`,
          });
        });
      });
      return out;
    }
    const children = Array.isArray((draft as any).children) ? (draft as any).children as Block[] : [];
    return children.map((b, i) => ({ id: `children[${i}]`, label: b.id || b.type || `block ${i + 1}` }));
  }, [draft, shape]);

  const handleAddBlock = React.useCallback(() => {
    if (!canEdit) return;
    // `container` is a safe default that renders an empty box and
    // accepts further nested children — the user picks the real type
    // from the inspector immediately after.
    const newBlock: Block = { type: 'container' };
    if (shape === 'regions') {
      const regions = Array.isArray((draft as any).regions) ? [...((draft as any).regions as Array<{ name?: string; components?: Block[] }>)] : [];
      // Append to the last region; create a default region if none exist.
      let targetIdx = regions.length - 1;
      if (targetIdx < 0) {
        regions.push({ name: 'main', components: [] });
        targetIdx = 0;
      }
      const region = { ...regions[targetIdx] };
      const comps = Array.isArray(region.components) ? [...region.components] : [];
      comps.push(newBlock);
      region.components = comps;
      regions[targetIdx] = region;
      onPatch!({ regions });
      onSelectionChange?.({ kind: 'block', id: `regions[${targetIdx}].components[${comps.length - 1}]`, label: newBlock.type });
      return;
    }
    const children = Array.isArray((draft as any).children) ? (draft as any).children as Block[] : [];
    const next = [...children, newBlock];
    onPatch!({ children: next });
    onSelectionChange?.({ kind: 'block', id: `children[${next.length - 1}]`, label: newBlock.type });
  }, [canEdit, draft, onPatch, onSelectionChange, shape]);

  // ── Record binding ──────────────────────────────────────────────────────
  // A `type: 'record'` page's `record:*` blocks (details / highlights / path /
  // alert) read their data from <RecordContextProvider>. The metadata editor
  // has no record route, so without binding a sample they render the
  // "bind a record to preview" placeholder — i.e. the author designs blind.
  // Fetch a handful of real records of the bound object + its schema and let
  // the author pick which one to preview against (mirrors the runtime
  // RecordDetailView's RecordContextProvider).
  // Match the runtime resolver (usePageAssignment): a record page is keyed by
  // either bare `type: 'record'` (editor draft shape) or `pageType: 'record'`
  // (persisted envelope shape). Both must bind a sample record so record:*
  // blocks render real data.
  const isRecordPage = (draft as { type?: string; pageType?: string })?.type === 'record'
    || (draft as { pageType?: string })?.pageType === 'record';
  const recordObject = isRecordPage ? (draft as { object?: string })?.object : undefined;
  const [recordSamples, setRecordSamples] = React.useState<any[]>([]);
  const [recordSchema, setRecordSchema] = React.useState<any>(null);
  const [selectedRecordId, setSelectedRecordId] = React.useState<string | number | null>(null);
  React.useEffect(() => {
    if (!recordObject) { setRecordSamples([]); setRecordSchema(null); setSelectedRecordId(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const opts = { headers: { accept: 'application/json' }, credentials: 'include' as const };
        // Schema first: it tells us which fields are lookup/master_detail so we
        // can `$expand` them. Without expansion record:details/highlights would
        // show raw foreign-key IDs (e.g. "O4VKrNesnsj2JYMa") instead of display
        // names — the runtime RecordDetailView $expands for exactly this reason.
        const schemaRes = await fetch(`/api/v1/meta/object/${encodeURIComponent(recordObject)}`, opts);
        const schemaJson = await schemaRes.json().catch(() => null);
        const schema = schemaJson?.item ?? schemaJson?.data ?? schemaJson;
        const expand = buildExpandFields(schema?.fields);
        const query = expand.length > 0
          ? `?$top=50&$expand=${encodeURIComponent(expand.join(','))}`
          : `?$top=50`;
        const recsRes = await fetch(`/api/v1/data/${encodeURIComponent(recordObject)}${query}`, opts);
        const recsJson = await recsRes.json().catch(() => null);
        // The REST data endpoint returns `{ object, records, total, hasMore }`;
        // tolerate the other common envelopes too.
        const recs = Array.isArray(recsJson?.records) ? recsJson.records
          : Array.isArray(recsJson?.items) ? recsJson.items
          : Array.isArray(recsJson?.data) ? recsJson.data
          : Array.isArray(recsJson) ? recsJson : [];
        if (cancelled) return;
        setRecordSamples(recs);
        setRecordSchema(schema);
        // Same id-resolution order as recordIdOf so the initial selection's
        // value matches an <option> even for objects keyed only by `name`.
        setSelectedRecordId((prev) => prev ?? (recs[0]?.id ?? recs[0]?._id ?? recs[0]?.name ?? null));
      } catch { if (!cancelled) { setRecordSamples([]); setRecordSchema(null); } }
    })();
    return () => { cancelled = true; };
  }, [recordObject]);
  const recordIdOf = (r: any) => r?.id ?? r?._id ?? r?.name;
  const recordLabelOf = (r: any) =>
    String(r?.name ?? r?.title ?? r?.label ?? r?.subject ?? recordIdOf(r) ?? '(record)');
  const selectedRecord = React.useMemo(() => {
    if (!recordSamples.length) return null;
    return recordSamples.find((r) => String(recordIdOf(r)) === String(selectedRecordId)) ?? recordSamples[0];
  }, [recordSamples, selectedRecordId]);

  // ── Slotted record page synthesis ────────────────────────────────────────
  // A `kind: 'slotted'` page carries an empty `regions: []` plus a `slots` map
  // of overrides, so the raw draft renders blank through SchemaRenderer (there
  // are no regions to walk). Mirror the runtime RecordDetailView: synthesize the
  // canonical default page from the bound object's schema and apply the slot
  // overrides via the SAME `buildDefaultPageSchema(objectDef, { slots })` path,
  // so omitted slots fall through to the synthesized header/details/discussion
  // while authored slots (highlights/tabs/…) override in place. Non-slotted
  // pages render their authored schema unchanged.
  const isSlotted = (draft as { kind?: string })?.kind === 'slotted';
  const renderSchema = React.useMemo(() => {
    if (!isSlotted) return schema;
    try {
      const slots = (draft as { slots?: Record<string, unknown> })?.slots ?? {};
      // `recordSchema` arrives async; until then synthesize with no objectDef
      // (structure renders immediately, field-level detail fills in on load).
      return buildDefaultPageSchema(recordSchema ?? undefined, { slots }) as Record<string, unknown>;
    } catch {
      return schema;
    }
  }, [isSlotted, schema, draft, recordSchema]);
  // Wrap record-page content in the record context (+ a sample-record picker)
  // so detail/highlights/path/alert blocks render real data. No-op for
  // non-record pages and for record pages with no rows yet (renders the node
  // unchanged so the existing placeholder still shows).
  const withRecordBinding = (node: React.ReactNode): React.ReactNode => {
    if (!recordObject || !selectedRecord) return node;
    return (
      <RecordContextProvider
        objectName={recordObject}
        recordId={recordIdOf(selectedRecord)}
        data={selectedRecord}
        objectSchema={recordSchema ?? undefined}
        embedded
      >
        {recordSamples.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30 text-xs">
            <span className="text-muted-foreground shrink-0">Preview record</span>
            <select
              className="h-7 rounded-md border bg-background px-2 text-xs max-w-[260px]"
              value={String(selectedRecordId ?? '')}
              onChange={(e) => setSelectedRecordId(e.target.value)}
            >
              {recordSamples.map((r) => {
                const id = recordIdOf(r);
                return <option key={String(id)} value={String(id)}>{recordLabelOf(r)}</option>;
              })}
            </select>
            <span className="text-muted-foreground/70 shrink-0">{recordSamples.length} sample{recordSamples.length === 1 ? '' : 's'}</span>
          </div>
        )}
        {node}
      </RecordContextProvider>
    );
  };

  // Interface page → always mirror the runtime (InterfaceListPage), in BOTH
  // design and preview modes. These pages are config-driven, not region-
  // composed, so there is nothing to drag on a canvas: the author edits the
  // Properties panel on the right and sees the real list (source view + user
  // filters + data) update live on the left — no tab switch, no placeholder.
  if (isInterfacePage) {
    return (
      <PreviewShell hint="page · interface">
        <PreviewErrorBoundary fallbackHint="The interface page references a source object/view that isn't available.">
          <InterfaceListPage
            page={draft as Record<string, unknown>}
            onConfigChange={canEdit ? (patch) => onPatch!({ interfaceConfig: { ...(((draft as any).interfaceConfig) || {}), ...patch } }) : undefined}
          />
        </PreviewErrorBoundary>
      </PreviewShell>
    );
  }

  // Empty draft → no preview; but if we're in design mode show the
  // canvas so users can author from scratch.
  if (!schema || Object.keys(schema).length <= 1) {
    return (
      <PreviewShell hint={`page${designMode ? ' · design' : ''}`}>
        {designMode && shape === 'regions' ? (
          <PageBlockCanvas
            draft={draft}
            onPatch={canEdit ? onPatch : undefined}
            selection={selection ?? null}
            onSelectionChange={onSelectionChange}
          />
        ) : designMode ? (
          <OutlineStrip
            title={tr('engine.inspector.pageBlock.outlineLabel', locale)}
            entries={blockEntries}
            selectedId={selectedId}
            onSelect={(e) => onSelectionChange?.({ kind: 'block', id: e.id, label: e.label })}
            onAdd={canEdit ? handleAddBlock : undefined}
            addLabel={tr('engine.inspector.add.block', locale)}
          />
        ) : null}
        {!designMode && <PreviewMessage>Add components to the page to see a preview.</PreviewMessage>}
      </PreviewShell>
    );
  }

  // Design mode with regions shape — show the form-canvas style
  // designer instead of the runtime renderer so authors can drag,
  // rename, and add blocks inline. The outline strip becomes
  // redundant in this view.
  if (designMode && shape === 'regions') {
    return (
      <PreviewShell hint={`page · design`}>
        {withRecordBinding(
          <PageBlockCanvas
            draft={draft}
            onPatch={canEdit ? onPatch : undefined}
            selection={selection ?? null}
            onSelectionChange={onSelectionChange}
          />
        )}
      </PreviewShell>
    );
  }

  return (
    <PreviewShell hint={`page${designMode ? ' · design' : ''}`}>
      <PreviewErrorBoundary fallbackHint="The Page schema is incomplete or references a component that hasn't been registered yet.">
        {designMode && (
          <OutlineStrip
            title={tr('engine.inspector.pageBlock.outlineLabel', locale)}
            entries={blockEntries}
            selectedId={selectedId}
            onSelect={(e) => onSelectionChange?.({ kind: 'block', id: e.id, label: e.label })}
            onAdd={canEdit ? handleAddBlock : undefined}
            addLabel={tr('engine.inspector.add.block', locale)}
          />
        )}
        {withRecordBinding(
          <div className="min-h-[200px] max-h-[70vh] overflow-auto p-4">
            <SchemaRenderer schema={renderSchema as any} />
          </div>
        )}
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
