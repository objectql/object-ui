// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * PageBlockCanvas — form-designer-style preview for a Page metadata
 * draft. Mirrors {@link ObjectFormCanvas}'s pattern: each block becomes
 * a clickable card with a type badge, drag handle, and inline-rename
 * affordance on its label. Regions become group sections that accept
 * drops to reassign blocks.
 *
 * Supports only the canonical Page shape (`regions[].components[]`).
 * Pages using the raw `children[]` shape fall back to the existing
 * SchemaRenderer preview (no inline editing).
 *
 * Selection emits `{ kind: 'block', id: 'regions[i].components[j]' }`
 * matching PageBlockInspector.
 */

import * as React from 'react';
import {
  Badge,
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@object-ui/components';
import { GripVertical, Plus } from 'lucide-react';
import type { MetadataSelection } from '../preview-registry';
import {
  BLOCK_TYPE_META,
  TYPES_BY_CATEGORY,
  CATEGORY_LABEL_EN,
  UnknownBlockIcon,
  resolveBlockTone,
  type BlockTypeId,
} from './block-types';
import { parsePath, hopsToPath, getByPath, setByPath } from '../inspectors/PageBlockInspector';

/** Container blocks expose nested child arrays (issue #1499). Returns each
 *  group's display label, the path suffix to its children array (relative to
 *  the block), and the current children. */
function childGroups(block: Block): Array<{ label: string; pathSuffix: string; children: Block[] }> {
  const props = (block?.properties as any) || {};
  switch (block?.type) {
    case 'page:tabs':
    case 'page:accordion': {
      const items = Array.isArray(props.items) ? props.items : [];
      return items.map((it: any, i: number) => ({
        label: it?.label || it?.key || `Item ${i + 1}`,
        pathSuffix: `properties.items[${i}].children`,
        children: Array.isArray(it?.children) ? it.children : [],
      }));
    }
    case 'page:card':
      return [{ label: 'Body', pathSuffix: 'properties.body', children: Array.isArray(props.body) ? props.body : [] }];
    case 'page:section':
      return [{ label: 'Content', pathSuffix: 'properties.children', children: Array.isArray(props.children) ? props.children : [] }];
    default:
      return [];
  }
}

interface Block {
  type?: string;
  id?: string;
  label?: string;
  title?: string;
  children?: Block[];
  [k: string]: unknown;
}

interface Region {
  name?: string;
  width?: string;
  components?: Block[];
}

export interface PageBlockCanvasProps {
  draft: Record<string, unknown>;
  onPatch?: (patch: Record<string, unknown>) => void;
  selection?: MetadataSelection | null;
  onSelectionChange?: (next: MetadataSelection | null) => void;
}

/** Canonical record-page slots, in render order. A `kind:'slotted'` page
 *  overrides individual slots; unoverridden ones are filled by the synthesizer.
 *  We surface all of them so an author can override an inherited slot too. */
export const SLOT_ORDER = ['header', 'actions', 'alerts', 'highlights', 'details', 'tabs', 'discussion'] as const;

/** slots object → one region per slot (single component normalised to array). */
export function slotsToRegions(slots: Record<string, unknown> | undefined): Region[] {
  const s = slots || {};
  return SLOT_ORDER.map((name) => {
    const v = (s as any)[name];
    const components = Array.isArray(v) ? (v as Block[]) : v != null ? [v as Block] : [];
    return { name, components };
  });
}

/** regions (one per slot) → slots object; empty slots are omitted (= inherited). */
export function regionsToSlots(regions: Region[]): Record<string, unknown> {
  const slots: Record<string, unknown> = {};
  for (const r of regions) {
    const comps = Array.isArray(r.components) ? r.components : [];
    if (comps.length === 0 || !r.name) continue; // omit empty → inherit the default
    slots[r.name] = comps;
  }
  return slots;
}

function readRegions(
  draft: Record<string, unknown>,
): { regions: Region[]; shape: 'regions' | 'children' | 'slots' } {
  // Slotted record page — edit the named slots (must win over an empty
  // `regions: []`, which slotted pages carry).
  const slots = (draft as any).slots;
  if ((draft as any).kind === 'slotted' && slots && typeof slots === 'object' && !Array.isArray(slots)) {
    return { regions: slotsToRegions(slots), shape: 'slots' };
  }
  const raw = (draft as any).regions;
  if (Array.isArray(raw)) return { regions: raw as Region[], shape: 'regions' };
  const kids = (draft as any).children;
  if (Array.isArray(kids)) {
    // Virtualise children[] as a single anonymous region.
    return { regions: [{ name: 'children', components: kids as Block[] }], shape: 'children' };
  }
  return { regions: [], shape: 'regions' };
}

/** Build a selection ID matching PageBlockInspector's parsePath regex.
 *  - regions shape:  regions[i].components[j]
 *  - children shape: children[j]  (flat, no nesting)
 */
function selectionId(
  shape: 'regions' | 'children' | 'slots',
  regionIdx: number,
  compIdx: number,
  slotName?: string,
): string {
  if (shape === 'children') return `children[${compIdx}]`;
  if (shape === 'slots') return `slot:${slotName}:${compIdx}`;
  return `regions[${regionIdx}].components[${compIdx}]`;
}

function blockLabel(b: Block): string {
  return (
    (typeof b.label === 'string' && b.label) ||
    (typeof b.title === 'string' && b.title) ||
    (typeof b.id === 'string' && b.id) ||
    String(b.type ?? 'block')
  );
}

const DT_MIME = 'text/x-objectui-pageblock';

export function PageBlockCanvas({
  draft,
  onPatch,
  selection,
  onSelectionChange,
}: PageBlockCanvasProps) {
  const readOnly = !onPatch;
  const { regions, shape } = React.useMemo(() => readRegions(draft), [draft]);

  const selectedId = selection?.kind === 'block' ? String(selection.id) : null;

  const writeRegions = React.useCallback(
    (next: Region[]) => {
      if (shape === 'children') {
        const comps = next.flatMap((r) => (Array.isArray(r.components) ? r.components : []));
        onPatch?.({ children: comps });
      } else if (shape === 'slots') {
        onPatch?.({ slots: regionsToSlots(next) });
      } else {
        onPatch?.({ regions: next });
      }
    },
    [onPatch, shape],
  );

  /** Move a block from src path → dst region (append) or before/after target block. */
  const moveBlock = React.useCallback(
    (
      src: { region: number; comp: number },
      dst:
        | { region: number; before?: number; after?: number }
        | { region: number; appendEnd: true },
    ) => {
      if (!onPatch) return;
      // Defensive copies — never mutate inputs.
      const next: Region[] = regions.map((r) => ({
        ...r,
        components: Array.isArray(r.components) ? [...r.components] : [],
      }));
      const srcComps = next[src.region]?.components;
      if (!srcComps) return;
      const [moved] = srcComps.splice(src.comp, 1);
      if (!moved) return;
      const dstComps = next[dst.region]?.components;
      if (!dstComps) return;
      let insertAt = dstComps.length;
      if ('appendEnd' in dst) insertAt = dstComps.length;
      else if (dst.before != null) {
        // Adjust if moving within same region above the original
        let idx = dst.before;
        if (src.region === dst.region && src.comp < idx) idx -= 1;
        insertAt = idx;
      } else if (dst.after != null) {
        let idx = dst.after + 1;
        if (src.region === dst.region && src.comp < dst.after + 1) idx -= 1;
        insertAt = idx;
      }
      dstComps.splice(insertAt, 0, moved);
      writeRegions(next);
      // Re-issue selection so inspector follows the move.
      const newId = selectionId(shape, dst.region, insertAt, next[dst.region]?.name);
      onSelectionChange?.({ kind: 'block', id: newId, label: blockLabel(moved) });
    },
    [onPatch, onSelectionChange, regions, writeRegions, shape],
  );

  const addBlock = React.useCallback(
    (regionIdx: number, type: BlockTypeId) => {
      if (!onPatch) return;
      const next: Region[] = regions.map((r) => ({
        ...r,
        components: Array.isArray(r.components) ? [...r.components] : [],
      }));
      if (!next[regionIdx]) {
        next[regionIdx] = { name: `region_${regionIdx + 1}`, components: [] };
      }
      const newBlock: Block = { type };
      next[regionIdx].components!.push(newBlock);
      writeRegions(next);
      const idx = next[regionIdx].components!.length - 1;
      onSelectionChange?.({
        kind: 'block',
        id: selectionId(shape, regionIdx, idx, next[regionIdx]?.name),
        label: blockLabel(newBlock),
      });
    },
    [onPatch, onSelectionChange, regions, writeRegions, shape],
  );

  const renameLabel = React.useCallback(
    (regionIdx: number, compIdx: number, nextLabel: string) => {
      if (!onPatch) return;
      const next: Region[] = regions.map((r) => ({
        ...r,
        components: Array.isArray(r.components) ? [...r.components] : [],
      }));
      const target = next[regionIdx]?.components?.[compIdx];
      if (!target) return;
      next[regionIdx].components![compIdx] = { ...target, label: nextLabel || undefined };
      writeRegions(next);
    },
    [onPatch, regions, writeRegions],
  );

  const addRegion = React.useCallback(() => {
    if (!onPatch) return;
    const next = [...regions, { name: `region_${regions.length + 1}`, components: [] }];
    writeRegions(next);
  }, [onPatch, regions, writeRegions]);

  // Append a block into a container's nested child array (issue #1499).
  // `baseId` is the container's selection id (`regions[r].components[c]` or
  // `slot:<name>:<idx>`); `pathSuffix` locates the children array within it.
  const addNestedBlock = React.useCallback(
    (baseId: string, pathSuffix: string, type: BlockTypeId) => {
      if (!onPatch) return;
      const slot = /^slot:([a-zA-Z_]+):(\d+)$/.exec(baseId);
      const subHops = parsePath(pathSuffix);
      if (!subHops) return;
      const subPath = hopsToPath(subHops);
      if (slot) {
        const name = slot[1];
        const idx = Number(slot[2]);
        const slots = ((draft as any).slots || {}) as Record<string, any>;
        const v = slots[name];
        const arr = Array.isArray(v) ? [...v] : v != null ? [v] : [];
        const base = arr[idx];
        if (!base) return;
        const cur = getByPath(base, subPath) || [];
        arr[idx] = setByPath(base, subPath, [...cur, { type }]);
        onPatch({ slots: { ...slots, [name]: arr } });
        onSelectionChange?.({ kind: 'block', id: `${baseId}.${pathSuffix}[${cur.length}]`, label: type });
      } else {
        const fullHops = parsePath(`${baseId}.${pathSuffix}`);
        if (!fullHops) return;
        const fullPath = hopsToPath(fullHops);
        const cur = getByPath(draft, fullPath) || [];
        const next = setByPath(draft, fullPath, [...cur, { type }]);
        onPatch({ [fullPath[0] as string]: next[fullPath[0]] });
        onSelectionChange?.({ kind: 'block', id: `${baseId}.${pathSuffix}[${cur.length}]`, label: type });
      }
    },
    [onPatch, draft, onSelectionChange],
  );

  const handleBgClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && selectedId) onSelectionChange?.(null);
    },
    [onSelectionChange, selectedId],
  );

  // Empty draft → empty canvas with hint. (ADR-0047 interface pages never
  // reach this canvas — PagePreview renders them as a live InterfaceListPage
  // in both design and preview modes — so no interface-specific hint here.)
  if (regions.length === 0) {
    return (
      <div className="h-full overflow-auto bg-muted/20" onClick={handleBgClick}>
        <div className="mx-auto max-w-3xl px-6 py-8">
          <div className="rounded-lg border-2 border-dashed bg-background py-16 px-6 text-center space-y-3">
            <div className="text-sm font-medium">No regions yet</div>
            <div className="text-xs text-muted-foreground">
              A Page is composed of regions (header / main / sidebar / …). Add a region to start dropping blocks into it.
            </div>
            {!readOnly && (
              <div className="pt-2">
                <Button variant="outline" size="sm" className="gap-1.5 border-dashed" onClick={addRegion}>
                  <Plus className="h-3.5 w-3.5" />
                  Add region
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-muted/20" onClick={handleBgClick}>
      <div className="mx-auto max-w-3xl px-6 py-6 space-y-5" onClick={handleBgClick}>
        {regions.map((region, regionIdx) => (
          <RegionSection
            key={regionIdx}
            region={region}
            regionIdx={regionIdx}
            shape={shape}
            selectedId={selectedId}
            readOnly={readOnly}
            onSelectBlock={(compIdx, blk) =>
              onSelectionChange?.({
                kind: 'block',
                id: selectionId(shape, regionIdx, compIdx, region.name),
                label: blockLabel(blk),
              })
            }
            onMoveBlock={moveBlock}
            onAddBlock={addBlock}
            onRenameLabel={renameLabel}
            baseIdOf={(compIdx) => selectionId(shape, regionIdx, compIdx, region.name)}
            onSelectId={(sid, lbl) => onSelectionChange?.({ kind: 'block', id: sid, label: lbl })}
            onAddNested={addNestedBlock}
          />
        ))}
        {!readOnly && shape === 'regions' && (
          <div className="pt-1">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={addRegion}>
              <Plus className="h-3.5 w-3.5" />
              Add region
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Region section ─────────────── */

function RegionSection({
  region,
  regionIdx,
  shape,
  selectedId,
  readOnly,
  onSelectBlock,
  onMoveBlock,
  onAddBlock,
  onRenameLabel,
  onSelectId,
  onAddNested,
}: {
  region: Region;
  regionIdx: number;
  shape: 'regions' | 'children' | 'slots';
  selectedId: string | null;
  readOnly: boolean;
  onSelectBlock: (compIdx: number, blk: Block) => void;
  onMoveBlock: (
    src: { region: number; comp: number },
    dst:
      | { region: number; before?: number; after?: number }
      | { region: number; appendEnd: true },
  ) => void;
  onAddBlock: (regionIdx: number, type: BlockTypeId) => void;
  onRenameLabel: (regionIdx: number, compIdx: number, nextLabel: string) => void;
  baseIdOf: (compIdx: number) => string;
  onSelectId: (id: string, label: string) => void;
  onAddNested: (baseId: string, pathSuffix: string, type: BlockTypeId) => void;
}) {
  const comps = Array.isArray(region.components) ? region.components : [];
  const [active, setActive] = React.useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    const types = e.dataTransfer.types;
    if (!types || !Array.from(types).includes(DT_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    setActive(false);
    if (e.defaultPrevented) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData(DT_MIME);
    if (!raw) return;
    try {
      const src = JSON.parse(raw) as { region: number; comp: number };
      if (typeof src.region !== 'number' || typeof src.comp !== 'number') return;
      onMoveBlock(src, { region: regionIdx, appendEnd: true });
    } catch {/* ignore */}
  };

  return (
    <section
      className={cn(
        'rounded-md transition-colors',
        active && 'bg-primary/5 ring-1 ring-primary/30 -mx-1 px-1 py-1',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground pl-1 mb-2 flex items-center gap-2">
        <span>{region.name || `region ${regionIdx + 1}`}</span>
        {region.width && (
          <span className="normal-case text-[10px] text-muted-foreground/60">· {region.width}</span>
        )}
        {active && <span className="text-primary normal-case text-[10px]">drop here</span>}
      </div>
      <div className="space-y-2.5">
        {comps.length === 0 ? (
          <div className="rounded border border-dashed bg-background/50 py-6 px-4 text-center text-xs text-muted-foreground">
            {shape === 'slots'
              ? 'Inherited from the default page — add a block to override this slot.'
              : 'Empty region — drop a block here or use the add button below.'}
          </div>
        ) : (
          comps.map((blk, compIdx) => {
            const id = selectionId(shape, regionIdx, compIdx, region.name);
            return (
              <React.Fragment key={`${regionIdx}:${compIdx}`}>
                <BlockRow
                  block={blk}
                  regionIdx={regionIdx}
                  compIdx={compIdx}
                  selected={id === selectedId}
                  readOnly={readOnly}
                  onClick={() => onSelectBlock(compIdx, blk)}
                  onMoveBlock={onMoveBlock}
                  onRenameLabel={(v) => onRenameLabel(regionIdx, compIdx, v)}
                />
                <NestedChildren
                  block={blk}
                  baseId={id}
                  selectedId={selectedId}
                  readOnly={readOnly}
                  onSelectId={onSelectId}
                  onAddNested={onAddNested}
                />
              </React.Fragment>
            );
          })
        )}
        {!readOnly && (
          <div className="pt-1">
            <AddBlockButton onPick={(type) => onAddBlock(regionIdx, type)} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ─────────────── Block row ─────────────── */

function BlockRow({
  block,
  regionIdx,
  compIdx,
  selected,
  readOnly,
  onClick,
  onMoveBlock,
  onRenameLabel,
}: {
  block: Block;
  regionIdx: number;
  compIdx: number;
  selected: boolean;
  readOnly: boolean;
  onClick: () => void;
  onMoveBlock: (
    src: { region: number; comp: number },
    dst:
      | { region: number; before?: number; after?: number }
      | { region: number; appendEnd: true },
  ) => void;
  onRenameLabel: (nextLabel: string) => void;
}) {
  const typeStr = String(block.type ?? '');
  const meta = BLOCK_TYPE_META[typeStr as BlockTypeId];
  const Icon = meta?.Icon ?? UnknownBlockIcon;
  const tone = resolveBlockTone(typeStr);
  const label = blockLabel(block);
  const draggable = !readOnly;
  const [dropZone, setDropZone] = React.useState<'before' | 'after' | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(DT_MIME, JSON.stringify({ region: regionIdx, comp: compIdx }));
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!draggable) return;
    const types = e.dataTransfer.types;
    if (!types || !Array.from(types).includes(DT_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setDropZone(e.clientY - rect.top < rect.height / 2 ? 'before' : 'after');
  };
  const handleDragLeave = () => setDropZone(null);
  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = dropZone ?? 'before';
    setDropZone(null);
    const raw = e.dataTransfer.getData(DT_MIME);
    if (!raw) return;
    try {
      const src = JSON.parse(raw) as { region: number; comp: number };
      if (src.region === regionIdx && src.comp === compIdx) return;
      const dst = pos === 'before'
        ? { region: regionIdx, before: compIdx }
        : { region: regionIdx, after: compIdx };
      onMoveBlock(src, dst);
    } catch {/* ignore */}
  };

  // Inline label rename
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  React.useEffect(() => { setDraft(label); }, [label]);
  const beginEdit = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setDraft(label);
    setEditingLabel(true);
  };
  const commitEdit = () => {
    if (readOnly) { setEditingLabel(false); return; }
    const next = draft.trim();
    if (next && next !== label) onRenameLabel(next);
    setEditingLabel(false);
  };
  const cancelEdit = () => { setDraft(label); setEditingLabel(false); };

  return (
    <div
      className={cn('relative', dropZone === 'before' && 'pt-1.5')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dropZone === 'before' && (
        <div className="absolute left-0 right-0 -top-0.5 h-0.5 bg-primary rounded-full" />
      )}
      <button
        type="button"
        onClick={onClick}
        draggable={draggable}
        onDragStart={handleDragStart}
        className={cn(
          'group w-full text-left rounded-md border bg-card px-3.5 py-2.5 transition-colors',
          'hover:border-primary/40 hover:bg-card',
          selected ? 'border-primary ring-2 ring-primary/30 shadow-sm' : 'border-border',
          readOnly && 'cursor-default',
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
        aria-pressed={selected}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {draggable && (
              <GripVertical
                className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground/80"
                aria-hidden="true"
              />
            )}
            <Icon className={cn('h-3.5 w-3.5 shrink-0', tone.icon)} />
            {editingLabel ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                  else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                }}
                onBlur={commitEdit}
                className="text-sm font-medium px-1 py-0.5 -mx-1 -my-0.5 rounded border border-primary bg-background outline-none min-w-0 flex-1"
              />
            ) : (
              <span
                className={cn('text-sm font-medium truncate', !readOnly && 'cursor-text')}
                onDoubleClick={beginEdit}
                title={!readOnly ? 'Double-click to rename' : undefined}
              >
                {label}
              </span>
            )}
            {block.id && block.id !== label && (
              <code className="text-[10px] text-muted-foreground/70 font-mono truncate">#{block.id}</code>
            )}
          </div>
          <Badge variant="outline" className={cn('text-[10px] shrink-0 font-mono', tone.badge)}>
            {typeStr}
          </Badge>
        </div>
      </button>
      {dropZone === 'after' && (
        <div className="absolute left-0 right-0 -bottom-1 h-0.5 bg-primary rounded-full" />
      )}
    </div>
  );
}

/* ─────────────── Nested container children (issue #1499) ─────────────── */

function NestedChildren({
  block,
  baseId,
  selectedId,
  readOnly,
  onSelectId,
  onAddNested,
}: {
  block: Block;
  baseId: string;
  selectedId: string | null;
  readOnly: boolean;
  onSelectId: (id: string, label: string) => void;
  onAddNested: (baseId: string, pathSuffix: string, type: BlockTypeId) => void;
}) {
  const groups = childGroups(block);
  if (groups.length === 0) return null;
  return (
    <div className="ml-5 mt-1.5 space-y-2.5 border-l border-dashed border-border pl-3">
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">{g.label}</div>
          {g.children.length === 0 ? (
            <div className="rounded border border-dashed bg-background/40 py-2 px-3 text-[11px] text-muted-foreground">
              Empty — add a block.
            </div>
          ) : (
            g.children.map((child, ci) => {
              const cid = `${baseId}.${g.pathSuffix}[${ci}]`;
              const typeStr = String(child?.type ?? '');
              const meta = BLOCK_TYPE_META[typeStr as BlockTypeId];
              const Icon = meta?.Icon ?? UnknownBlockIcon;
              return (
                <button
                  key={ci}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onSelectId(cid, blockLabel(child)); }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded border px-2.5 py-1.5 text-left text-xs transition-colors',
                    cid === selectedId
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                      : 'border-border bg-background hover:bg-muted/40',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{blockLabel(child)}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">{typeStr}</span>
                </button>
              );
            })
          )}
          {!readOnly && <AddBlockButton onPick={(type) => onAddNested(baseId, g.pathSuffix, type)} />}
        </div>
      ))}
    </div>
  );
}

/* ─────────────── Add block picker ─────────────── */

function AddBlockButton({ onPick }: { onPick: (type: BlockTypeId) => void }) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const q = filter.trim().toLowerCase();

  const groups = React.useMemo(() => {
    if (!q) return TYPES_BY_CATEGORY;
    return TYPES_BY_CATEGORY
      .map((g) => ({
        category: g.category,
        types: g.types.filter((id) => {
          const m = BLOCK_TYPE_META[id];
          return id.includes(q) || m.label.toLowerCase().includes(q);
        }),
      }))
      .filter((g) => g.types.length > 0);
  }, [q]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFilter(''); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-dashed">
          <Plus className="h-3.5 w-3.5" />
          Add block
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 max-h-[480px] overflow-hidden flex flex-col">
        <div className="p-2 border-b">
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search block type…"
            className="h-7 w-full px-2 text-sm border rounded bg-background outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-auto p-1">
          {groups.length === 0 ? (
            <div className="text-xs text-muted-foreground p-4 text-center">No matching types.</div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="mb-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
                  {CATEGORY_LABEL_EN[g.category]}
                </div>
                {g.types.map((id) => {
                  const m = BLOCK_TYPE_META[id];
                  const Icon = m.Icon;
                  const tone = resolveBlockTone(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { onPick(id); setOpen(false); setFilter(''); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                    >
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', tone.icon)} />
                      <span className="truncate">{m.label}</span>
                      <code className="ml-auto text-[10px] text-muted-foreground/70 font-mono truncate">{id}</code>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
