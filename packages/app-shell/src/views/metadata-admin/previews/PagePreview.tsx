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
import { SchemaRenderer } from '@object-ui/react';
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

  // Interface page → always mirror the runtime (InterfaceListPage), in BOTH
  // design and preview modes. These pages are config-driven, not region-
  // composed, so there is nothing to drag on a canvas: the author edits the
  // Properties panel on the right and sees the real list (source view + user
  // filters + data) update live on the left — no tab switch, no placeholder.
  if (isInterfacePage) {
    return (
      <PreviewShell hint="page · interface">
        <PreviewErrorBoundary fallbackHint="The interface page references a source object/view that isn't available.">
          <InterfaceListPage page={draft as Record<string, unknown>} />
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
        <PageBlockCanvas
          draft={draft}
          onPatch={canEdit ? onPatch : undefined}
          selection={selection ?? null}
          onSelectionChange={onSelectionChange}
        />
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
        <div className="min-h-[200px] max-h-[70vh] overflow-auto p-4">
          <SchemaRenderer schema={schema as any} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}
