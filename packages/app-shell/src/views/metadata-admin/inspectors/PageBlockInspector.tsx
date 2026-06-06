// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PageBlockInspector — scoped editor for the selected page block /
 * component subtree.
 *
 * Selection shape:  { kind: 'block', id: 'children[i]' | 'children[i].children[j]' | … }
 *
 * A Page schema is a SDUI tree; "blocks" are children nodes. The id
 * is a dotted path of `children[i]` hops, identical in spirit to
 * AppNavInspector but always rooted at top-level `children`.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorReorderButtons,
  InspectorTextField,
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
  InspectorRemoveButton,
  InspectorEmptyState,
  spliceArray,
  moveArray,
} from './_shared';
import { BLOCK_CONFIG, blockHasConfig, type BlockPropField } from '../previews/block-config';
import { Button, Input, Label } from '@object-ui/components';
import { Plus, X, Trash2 } from 'lucide-react';

interface Block {
  type?: string;
  id?: string;
  className?: string;
  hidden?: string;
  children?: Block[];
  [k: string]: unknown;
}

type Hop = { key: string; index: number };

function parsePath(id: string): Hop[] | null {
  const segs = id.split('.');
  const hops: Hop[] = [];
  for (const s of segs) {
    const m = /^([a-zA-Z_]\w*)\[(\d+)\]$/.exec(s);
    if (!m) return null;
    hops.push({ key: m[1], index: Number(m[2]) });
  }
  return hops.length > 0 ? hops : null;
}

function readAt(root: Record<string, unknown>, hops: Hop[]): Block | null {
  let arr = (root as any)[hops[0].key] as Block[] | undefined;
  if (!Array.isArray(arr)) return null;
  let node: Block | null = arr[hops[0].index] ?? null;
  for (let h = 1; h < hops.length; h++) {
    if (!node) return null;
    arr = (node as any)[hops[h].key] as Block[] | undefined;
    if (!Array.isArray(arr)) return null;
    node = arr[hops[h].index] ?? null;
  }
  return node;
}

function writeAt(root: Record<string, unknown>, hops: Hop[], replacement: Block | null): Record<string, unknown> {
  const rootKey = hops[0].key;
  const rootArr = Array.isArray((root as any)[rootKey]) ? [...(root as any)[rootKey] as Block[]] : [];
  if (hops.length === 1) {
    return { [rootKey]: spliceArray(rootArr, hops[0].index, replacement) };
  }
  let arr = rootArr;
  for (let h = 0; h < hops.length - 1; h++) {
    const cur = { ...(arr[hops[h].index] ?? {}) } as Block;
    const nextKey = hops[h + 1].key;
    const childArr = Array.isArray((cur as any)[nextKey]) ? [...(cur as any)[nextKey] as Block[]] : [];
    (cur as any)[nextKey] = childArr;
    arr[hops[h].index] = cur;
    arr = childArr;
  }
  spliceArray; // (silence unused if any optimizer)
  const last = hops[hops.length - 1];
  // Replace within the inner-most reference (already cloned above).
  if (replacement === null) arr.splice(last.index, 1);
  else arr[last.index] = replacement;
  return { [rootKey]: rootArr };
}

/**
 * Read the sibling array containing the node at `hops` along with the
 * leaf index, so the inspector can offer reorder controls without
 * re-traversing the tree.
 */
function readSiblings(root: Record<string, unknown>, hops: Hop[]): { siblings: Block[]; index: number } | null {
  let arr = (root as any)[hops[0].key] as Block[] | undefined;
  if (!Array.isArray(arr)) return null;
  if (hops.length === 1) return { siblings: arr, index: hops[0].index };
  let node: Block | null = arr[hops[0].index] ?? null;
  for (let h = 1; h < hops.length - 1; h++) {
    if (!node) return null;
    arr = (node as any)[hops[h].key] as Block[] | undefined;
    if (!Array.isArray(arr)) return null;
    node = arr[hops[h].index] ?? null;
  }
  if (!node) return null;
  const last = hops[hops.length - 1];
  const sibs = (node as any)[last.key] as Block[] | undefined;
  if (!Array.isArray(sibs)) return null;
  return { siblings: sibs, index: last.index };
}

/**
 * Replace the sibling array at `hops` (without the final index hop)
 * with `nextSiblings`. Used by reorder so we can hand back a freshly
 * permuted array.
 */
function writeSiblings(root: Record<string, unknown>, hops: Hop[], nextSiblings: Block[]): Record<string, unknown> {
  const rootKey = hops[0].key;
  if (hops.length === 1) {
    return { [rootKey]: nextSiblings };
  }
  const rootArr = Array.isArray((root as any)[rootKey]) ? [...(root as any)[rootKey] as Block[]] : [];
  let arr = rootArr;
  for (let h = 0; h < hops.length - 2; h++) {
    const cur = { ...(arr[hops[h].index] ?? {}) } as Block;
    const nextKey = hops[h + 1].key;
    const childArr = Array.isArray((cur as any)[nextKey]) ? [...(cur as any)[nextKey] as Block[]] : [];
    (cur as any)[nextKey] = childArr;
    arr[hops[h].index] = cur;
    arr = childArr;
  }
  // Replace the inner-most container's child array with the permuted siblings.
  const parentHop = hops[hops.length - 2];
  const lastKey = hops[hops.length - 1].key;
  const parentCopy = { ...(arr[parentHop.index] ?? {}) } as Block;
  (parentCopy as any)[lastKey] = nextSiblings;
  arr[parentHop.index] = parentCopy;
  return { [rootKey]: rootArr };
}

export function PageBlockInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  const hops = parsePath(selection.id);
  const block = hops ? readAt(draft, hops) : null;
  const sibInfo = hops ? readSiblings(draft, hops) : null;

  if (!hops || !block) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.pageBlock.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.pageBlock.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<Block>) => onPatch(writeAt(draft, hops, { ...block, ...updates }));

  // Per-block configurable properties (spec `properties`). The renderer hoists
  // `properties.*` to the top level, so we read from either and always write
  // back to `properties` (the canonical shape).
  const blockProps = (block.properties as Record<string, unknown>) || {};
  const readProp = (name: string): unknown => blockProps[name] ?? (block as any)[name];
  const patchProp = (name: string, value: unknown) =>
    patch({ properties: { ...blockProps, [name]: value } } as Partial<Block>);

  // Generic, recursive field renderer. `read`/`write` abstract the value source
  // (the block's `properties` at the top level, or an item object inside an
  // `array` field), so the same code drives nested array-item editors.
  const renderField = (
    f: BlockPropField,
    read: (name: string) => unknown,
    write: (name: string, value: unknown) => void,
    keyPrefix = '',
  ): React.ReactNode => {
    const k = `${keyPrefix}${f.name}`;
    switch (f.kind) {
      case 'number':
        return (
          <InspectorNumberField key={k} label={f.label}
            value={typeof read(f.name) === 'number' ? (read(f.name) as number) : undefined}
            placeholder={f.placeholder} onCommit={(v) => write(f.name, v)} disabled={readOnly} />
        );
      case 'boolean':
        return (
          <InspectorCheckboxField key={k} label={f.label} value={!!read(f.name)}
            onCommit={(v) => write(f.name, v)} disabled={readOnly} />
        );
      case 'select':
        return (
          <InspectorSelectField key={k} label={f.label}
            value={read(f.name) != null ? String(read(f.name)) : undefined}
            options={f.options} onCommit={(v) => write(f.name, v)} disabled={readOnly} />
        );
      case 'string-list': {
        const arr = Array.isArray(read(f.name)) ? (read(f.name) as unknown[]) : [];
        return (
          <div key={k} className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            {arr.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <Input className="h-8 text-sm" value={String(s ?? '')} placeholder={f.placeholder} disabled={readOnly}
                  onChange={(e) => { const next = [...arr]; next[i] = e.target.value; write(f.name, next); }} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={readOnly}
                  aria-label="Remove" onClick={() => write(f.name, arr.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={() => write(f.name, [...arr, ''])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            )}
          </div>
        );
      }
      case 'array': {
        const arr = Array.isArray(read(f.name)) ? (read(f.name) as unknown[]) : [];
        return (
          <div key={k} className="space-y-2">
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            {arr.map((item, i) => {
              const itemObj = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
              return (
                <div key={i} className="space-y-2 rounded-md border border-border p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">#{i + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={readOnly}
                      aria-label="Remove item" onClick={() => write(f.name, arr.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {f.itemFields.map((itf) =>
                    renderField(
                      itf,
                      (n) => itemObj[n],
                      (n, v) => { const next = [...arr]; next[i] = { ...itemObj, [n]: v }; write(f.name, next); },
                      `${k}-${i}-`,
                    ),
                  )}
                </div>
              );
            })}
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={() => write(f.name, [...arr, {}])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> {f.addLabel || 'Add'}
              </Button>
            )}
          </div>
        );
      }
      default:
        return (
          <InspectorTextField key={k} label={f.label}
            value={read(f.name) != null ? String(read(f.name)) : ''}
            placeholder={f.placeholder} onCommit={(v) => write(f.name, v)} disabled={readOnly} />
        );
    }
  };
  const remove = () => { onPatch(writeAt(draft, hops, null)); onClearSelection(); };
  const move = (to: number) => {
    if (!sibInfo) return;
    const next = moveArray(sibInfo.siblings, sibInfo.index, to);
    onPatch(writeSiblings(draft, hops, next));
    const prefix = hops.slice(0, -1).map((h) => `${h.key}[${h.index}]`).join('.');
    const lastKey = hops[hops.length - 1].key;
    const newId = prefix ? `${prefix}.${lastKey}[${to}]` : `${lastKey}[${to}]`;
    onSelectionChange?.({ kind: 'block', id: newId, label: String(block.id || block.type || newId) });
  };

  return (
    <InspectorShell
      kindLabel={t('engine.inspector.pageBlock.kind', locale)}
      title={String(block.id || block.type || selection.id)}
      onClose={onClearSelection}
      closeLabel={t('engine.inspector.pageBlock.close', locale)}
      headerActions={sibInfo ? (
        <InspectorReorderButtons
          index={sibInfo.index}
          total={sibInfo.siblings.length}
          onMove={move}
          upLabel={t('engine.inspector.reorder.up', locale)}
          downLabel={t('engine.inspector.reorder.down', locale)}
          disabled={readOnly}
        />
      ) : undefined}
      footer={<InspectorRemoveButton label={t('engine.inspector.pageBlock.remove', locale)} onClick={remove} disabled={readOnly} />}
    >
      <InspectorTextField label={t('engine.inspector.pageBlock.type', locale)} value={block.type ?? ''} onCommit={(v) => patch({ type: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.pageBlock.id', locale)} value={block.id ?? ''} onCommit={(v) => patch({ id: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.pageBlock.className', locale)} value={block.className ?? ''} onCommit={(v) => patch({ className: v })} disabled={readOnly} mono />
      <InspectorTextField label={t('engine.inspector.pageBlock.hidden', locale)} value={block.hidden ?? ''} onCommit={(v) => patch({ hidden: v })} disabled={readOnly} mono />

      {blockHasConfig(block.type) && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('engine.inspector.pageBlock.properties', locale)}
          </div>
          {BLOCK_CONFIG[block.type as string].map((f) => renderField(f, readProp, patchProp))}
        </div>
      )}
    </InspectorShell>
  );
}
