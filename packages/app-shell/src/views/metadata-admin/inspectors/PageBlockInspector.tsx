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
  moveArray,
} from './_shared';
import { BLOCK_CONFIG, blockHasConfig, type BlockPropField } from '../previews/block-config';
import { ColorVariantPicker } from '../color-variant-field';
import { useObjectOptions } from '../previews/useObjectOptions';
import { useObjectFields } from '../previews/useObjectFields';
import {
  Button, Input, Label,
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue,
} from '@object-ui/components';
import { Plus, X, Trash2 } from 'lucide-react';

// ── Schema-driven picker fields ──────────────────────────────────────────────

/** Field options for an object (visible fields), as {value,label}. */
function useFieldOptions(objectName: string | undefined): Array<{ value: string; label: string }> {
  const { fields } = useObjectFields(objectName);
  return React.useMemo(
    () =>
      fields
        .filter((f) => !f.hidden)
        .map((f) => ({ value: f.name, label: f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name })),
    [fields],
  );
}

/** Object dropdown; falls back to a free-text input when the list is empty. */
function ObjectPickerField({ label, value, onCommit, disabled }: {
  label: string; value: string | undefined; onCommit: (v: string) => void; disabled?: boolean;
}) {
  const { options } = useObjectOptions();
  if (options.length === 0) {
    return <InspectorTextField label={label} value={value ?? ''} placeholder="snake_case object" onCommit={onCommit} disabled={disabled} mono />;
  }
  return <InspectorSelectField label={label} value={value || undefined} options={options} onCommit={onCommit} disabled={disabled} />;
}

/** Field dropdown for `objectName`; falls back to free text when unresolved. */
function FieldPickerField({ label, objectName, value, onCommit, disabled }: {
  label: string; objectName: string | undefined; value: string | undefined; onCommit: (v: string) => void; disabled?: boolean;
}) {
  const options = useFieldOptions(objectName);
  if (!objectName || options.length === 0) {
    return <InspectorTextField label={label} value={value ?? ''} onCommit={onCommit} disabled={disabled} mono />;
  }
  return <InspectorSelectField label={label} value={value || undefined} options={options} onCommit={onCommit} disabled={disabled} />;
}

/** Editable list of field names — each row a field dropdown (or text fallback). */
function FieldListField({ label, objectName, value, onChange, disabled }: {
  label: string; objectName: string | undefined; value: unknown; onChange: (v: string[]) => void; disabled?: boolean;
}) {
  const options = useFieldOptions(objectName);
  const arr: string[] = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {arr.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {options.length > 0 ? (
            <div className="flex-1">
              <Select value={s ? String(s) : ''} onValueChange={(v) => { const n = [...arr]; n[i] = v; onChange(n); }} disabled={disabled}>
                <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Input className="h-8 text-sm" value={String(s ?? '')} placeholder="field name" disabled={disabled}
              onChange={(e) => { const n = [...arr]; n[i] = e.target.value; onChange(n); }} />
          )}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={disabled} aria-label="Remove"
            onClick={() => onChange(arr.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...arr, ''])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add
        </Button>
      )}
    </div>
  );
}

/** Pretty-print a value for the JSON editor; undefined → empty string. */
function safeStringify(value: unknown): string {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

/** Editable JSON field for object/array properties — commits on blur so a
 *  half-typed value never trips the parser. Empty clears the property. */
function InspectorJsonField({ label, value, onCommit, disabled }: {
  label: string; value: unknown; onCommit: (v: unknown) => void; disabled?: boolean;
}) {
  const initial = React.useMemo(() => safeStringify(value), [value]);
  const [text, setText] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => { setText(initial); setError(null); }, [initial]);
  const commit = () => {
    if (disabled) return;
    const trimmed = text.trim();
    if (trimmed === '') { setError(null); onCommit(undefined); return; }
    try {
      const parsed = JSON.parse(trimmed);
      setError(null);
      onCommit(parsed);
    } catch {
      setError('Invalid JSON');
    }
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        disabled={disabled}
        spellCheck={false}
        rows={Math.min(12, Math.max(2, text.split('\n').length))}
        className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-primary resize-y disabled:opacity-60"
      />
      {error && <div className="text-[11px] text-destructive">{error}</div>}
    </div>
  );
}

/** Renders one arbitrary block property by inferring an editor from its
 *  runtime type. Guarantees the inspector can edit anything visible in the
 *  source, even block types with no curated BLOCK_CONFIG entry. */
function GenericPropField({ name, value, onCommit, disabled }: {
  name: string; value: unknown; onCommit: (v: unknown) => void; disabled?: boolean;
}) {
  if (typeof value === 'boolean') {
    return <InspectorCheckboxField label={name} value={value} onCommit={onCommit} disabled={disabled} />;
  }
  if (typeof value === 'number') {
    return <InspectorNumberField label={name} value={value} onCommit={(v) => onCommit(v)} disabled={disabled} />;
  }
  if (value === null || typeof value === 'string') {
    return <InspectorTextField label={name} value={value == null ? '' : value} onCommit={onCommit} disabled={disabled} mono />;
  }
  return <InspectorJsonField label={name} value={value} onCommit={onCommit} disabled={disabled} />;
}

/** Block `properties` keys whose values are nested block trees — these are
 *  edited visually on the canvas, so they are excluded from the generic
 *  property editor to avoid two conflicting editors for the same data. */
const STRUCTURAL_PROP_KEYS = new Set(['children', 'body']);

interface Block {
  type?: string;
  id?: string;
  className?: string;
  hidden?: string;
  children?: Block[];
  [k: string]: unknown;
}

/**
 * A path hop. `index < 0` means a plain object-property access (e.g.
 * `properties`); `index >= 0` adds an array index after the key (e.g.
 * `items[0]`). Supporting object hops lets us address nested container
 * children at `…components[0].properties.items[0].children[0]` (issue #1499).
 */
type Hop = { key: string; index: number };

export type PathSeg = string | number;
const REMOVE: unique symbol = Symbol('remove');

/** A segment is `key` (object) or `key[i]` (array). */
export function parsePath(id: string): Hop[] | null {
  const segs = id.split('.');
  const hops: Hop[] = [];
  for (const s of segs) {
    const m = /^([a-zA-Z_]\w*)(?:\[(\d+)\])?$/.exec(s);
    if (!m) return null;
    hops.push({ key: m[1], index: m[2] != null ? Number(m[2]) : -1 });
  }
  return hops.length > 0 ? hops : null;
}

/** Flatten hops to a JSON-pointer-like path: object key, then index if any. */
export function hopsToPath(hops: Hop[]): PathSeg[] {
  const p: PathSeg[] = [];
  for (const h of hops) {
    p.push(h.key);
    if (h.index >= 0) p.push(h.index);
  }
  return p;
}

export function getByPath(root: any, path: PathSeg[]): any {
  let node = root;
  for (const seg of path) {
    if (node == null) return null;
    node = node[seg as any];
  }
  return node ?? null;
}

/** Immutable set/remove along a path. `value === REMOVE` deletes the leaf. */
export function setByPath(root: any, path: PathSeg[], value: any): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (typeof head === 'number') {
    const arr = Array.isArray(root) ? [...root] : [];
    if (rest.length === 0) {
      if (value === REMOVE) arr.splice(head, 1);
      else arr[head] = value;
    } else arr[head] = setByPath(arr[head], rest, value);
    return arr;
  }
  const obj = { ...(root || {}) };
  if (rest.length === 0) {
    if (value === REMOVE) delete (obj as any)[head];
    else (obj as any)[head] = value;
  } else (obj as any)[head] = setByPath((obj as any)[head], rest, value);
  return obj;
}

export function readAt(root: Record<string, unknown>, hops: Hop[]): Block | null {
  return getByPath(root, hopsToPath(hops)) as Block | null;
}

/** Returns a shallow patch `{ [topKey]: newValue }` for onPatch. */
export function writeAt(root: Record<string, unknown>, hops: Hop[], replacement: Block | null): Record<string, unknown> {
  const path = hopsToPath(hops);
  const next = setByPath(root, path, replacement === null ? REMOVE : replacement);
  const topKey = path[0] as string;
  return { [topKey]: next[topKey] };
}

export function readSiblings(root: Record<string, unknown>, hops: Hop[]): { siblings: Block[]; index: number } | null {
  const path = hopsToPath(hops);
  const last = path[path.length - 1];
  if (typeof last !== 'number') return null;
  const siblings = getByPath(root, path.slice(0, -1));
  if (!Array.isArray(siblings)) return null;
  return { siblings: siblings as Block[], index: last };
}

export function writeSiblings(root: Record<string, unknown>, hops: Hop[], nextSiblings: Block[]): Record<string, unknown> {
  const path = hopsToPath(hops);
  const next = setByPath(root, path.slice(0, -1), nextSiblings);
  const topKey = path[0] as string;
  return { [topKey]: next[topKey] };
}

export function PageBlockInspector({ selection, draft, onPatch, onClearSelection, onSelectionChange, locale, readOnly }: MetadataInspectorProps) {
  // Slotted record page: selection ids are `slot:<name>:<index>` and address
  // `draft.slots.<name>` (a single component is normalised to a 1-element array).
  // `slot:<name>:<idx>` optionally followed by a nested sub-path within the
  // slot's block (e.g. `slot:tabs:0.properties.items[0].children[0]`), so a
  // block inside a slotted container is addressable too (issue #1499).
  const slotMatch = /^slot:([a-zA-Z_]+):(\d+)(?:\.(.+))?$/.exec(selection.id);
  const hops = slotMatch ? null : parsePath(selection.id);

  const slotName = slotMatch ? slotMatch[1] : '';
  const slotIdx = slotMatch ? Number(slotMatch[2]) : -1;
  const slotSub = slotMatch ? slotMatch[3] : undefined;
  const subHops = slotSub ? parsePath(slotSub) : null;
  const slotsObj: Record<string, any> =
    (draft as any).slots && typeof (draft as any).slots === 'object' ? ((draft as any).slots as Record<string, any>) : {};
  const slotArr: Block[] = slotMatch
    ? Array.isArray(slotsObj[slotName])
      ? (slotsObj[slotName] as Block[])
      : slotsObj[slotName] != null
        ? [slotsObj[slotName] as Block]
        : []
    : [];
  const slotBase: Block | null = slotMatch ? (slotArr[slotIdx] ?? null) : null;
  // Write the slot's whole array back (delete the base block when null).
  const writeSlot = (nextArr: Block[]) => onPatch({ slots: { ...slotsObj, [slotName]: nextArr } });
  const writeSlotBase = (nextBase: Block | null) =>
    writeSlot(nextBase === null ? slotArr.filter((_, i) => i !== slotIdx) : slotArr.map((b, i) => (i === slotIdx ? nextBase : b)));

  const block: Block | null = slotMatch
    ? subHops
      ? readAt((slotBase || {}) as any, subHops)
      : slotBase
    : hops
      ? readAt(draft, hops)
      : null;
  const sibInfo = slotMatch
    ? subHops
      ? readSiblings((slotBase || {}) as any, subHops)
      : { siblings: slotArr, index: slotIdx }
    : hops
      ? readSiblings(draft, hops)
      : null;

  if ((!slotMatch && !hops) || !block) {
    return (
      <InspectorShell kindLabel={t('engine.inspector.pageBlock.kind', locale)} title={selection.label ?? selection.id} onClose={onClearSelection} closeLabel={t('engine.inspector.pageBlock.close', locale)}>
        <InspectorEmptyState message={selection.id} />
      </InspectorShell>
    );
  }

  const patch = (updates: Partial<Block>) => {
    if (!slotMatch) return onPatch(writeAt(draft, hops!, { ...block, ...updates }));
    if (subHops) return writeSlotBase({ ...(slotBase as Block), ...writeAt((slotBase || {}) as any, subHops, { ...block, ...updates }) });
    return writeSlotBase({ ...block, ...updates });
  };

  // Per-block configurable properties (spec `properties`). The renderer hoists
  // `properties.*` to the top level, so we read from either and always write
  // back to `properties` (the canonical shape).
  const blockProps = (block.properties as Record<string, unknown>) || {};
  // The record page's bound object — drives `field-picker`/`field-list` with
  // objectFrom:'page'. (objectFrom:'self' reads a sibling block property.)
  const pageObject = typeof (draft as any)?.object === 'string' ? ((draft as any).object as string) : undefined;
  const resolveObject = (src: BlockPropField & { objectFrom?: string; objectProp?: string }): string | undefined =>
    src.objectFrom === 'page'
      ? pageObject
      : src.objectProp != null && blockProps[src.objectProp] != null
        ? String(blockProps[src.objectProp])
        : undefined;
  const readProp = (name: string): unknown => blockProps[name] ?? (block as any)[name];
  const patchProp = (name: string, value: unknown) =>
    patch({ properties: { ...blockProps, [name]: value } } as Partial<Block>);

  // Properties already handled by curated fields — excluded from the generic
  // "Advanced" section so each property has exactly one editor.
  const curatedNames = new Set(
    (blockHasConfig(block.type) ? BLOCK_CONFIG[block.type as string] : []).map((f) => f.name),
  );
  const advancedKeys = Object.keys(blockProps).filter(
    (key) => !curatedNames.has(key) && !STRUCTURAL_PROP_KEYS.has(key),
  );

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
      case 'color':
        return (
          <div key={k} className="space-y-1">
            <Label className="text-xs text-muted-foreground">{f.label}</Label>
            <ColorVariantPicker
              value={read(f.name) != null ? String(read(f.name)) : undefined}
              onChange={(v) => write(f.name, v)}
              disabled={readOnly}
              options={f.options}
            />
          </div>
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
      case 'object-picker':
        return (
          <ObjectPickerField key={k} label={f.label}
            value={read(f.name) != null ? String(read(f.name)) : undefined}
            onCommit={(v) => write(f.name, v)} disabled={readOnly} />
        );
      case 'field-picker':
        return (
          <FieldPickerField key={k} label={f.label} objectName={resolveObject(f)}
            value={read(f.name) != null ? String(read(f.name)) : undefined}
            onCommit={(v) => write(f.name, v)} disabled={readOnly} />
        );
      case 'field-list':
        return (
          <FieldListField key={k} label={f.label} objectName={resolveObject(f)}
            value={read(f.name)} onChange={(v) => write(f.name, v)} disabled={readOnly} />
        );
      default:
        return (
          <InspectorTextField key={k} label={f.label}
            value={read(f.name) != null ? String(read(f.name)) : ''}
            placeholder={(f as any).placeholder} onCommit={(v) => write(f.name, v)} disabled={readOnly} />
        );
    }
  };
  const remove = () => {
    if (slotMatch) {
      if (subHops) writeSlotBase({ ...(slotBase as Block), ...writeAt((slotBase || {}) as any, subHops, null) });
      else writeSlotBase(null);
    } else onPatch(writeAt(draft, hops!, null));
    onClearSelection();
  };
  // Re-serialise hops to an id, honouring object hops (index < 0 → no `[i]`).
  const fmtHops = (hs: Hop[]) => hs.map((h) => (h.index >= 0 ? `${h.key}[${h.index}]` : h.key)).join('.');
  const move = (to: number) => {
    if (!sibInfo) return;
    if (slotMatch) {
      if (subHops) {
        const next = moveArray(sibInfo.siblings, sibInfo.index, to);
        writeSlotBase({ ...(slotBase as Block), ...writeSiblings((slotBase || {}) as any, subHops, next) });
        const newSub = fmtHops([...subHops.slice(0, -1), { key: subHops[subHops.length - 1].key, index: to }]);
        onSelectionChange?.({ kind: 'block', id: `slot:${slotName}:${slotIdx}.${newSub}`, label: String(block.id || block.type || to) });
      } else {
        writeSlot(moveArray(slotArr, slotIdx, to));
        onSelectionChange?.({ kind: 'block', id: `slot:${slotName}:${to}`, label: String(block.id || block.type || to) });
      }
      return;
    }
    const next = moveArray(sibInfo.siblings, sibInfo.index, to);
    onPatch(writeSiblings(draft, hops!, next));
    const newId = fmtHops([...hops!.slice(0, -1), { key: hops![hops!.length - 1].key, index: to }]);
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

      {/* Generic fallback: any property present in the source but not covered
          by a curated field above. Without this, selecting a block with no (or
          partial) BLOCK_CONFIG left the inspector blank while source showed a
          full `properties` object — the "config panel ⇄ source" disconnect. */}
      {advancedKeys.length > 0 && (
        <div className="space-y-3 border-t border-border pt-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('engine.inspector.pageBlock.advanced', locale)}
          </div>
          {advancedKeys.map((key) => (
            <GenericPropField
              key={key}
              name={key}
              value={blockProps[key]}
              onCommit={(v) => patchProp(key, v)}
              disabled={readOnly}
            />
          ))}
        </div>
      )}
    </InspectorShell>
  );
}
