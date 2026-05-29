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

function readRegions(
  draft: Record<string, unknown>,
): { regions: Region[]; shape: 'regions' | 'children' } {
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
  shape: 'regions' | 'children',
  regionIdx: number,
  compIdx: number,
): string {
  return shape === 'children'
    ? `children[${compIdx}]`
    : `regions[${regionIdx}].components[${compIdx}]`;
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
      const newId = `regions[${dst.region}].components[${insertAt}]`;
      onSelectionChange?.({ kind: 'block', id: newId, label: blockLabel(moved) });
    },
    [onPatch, onSelectionChange, regions, writeRegions],
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
        id: `regions[${regionIdx}].components[${idx}]`,
        label: blockLabel(newBlock),
      });
    },
    [onPatch, onSelectionChange, regions, writeRegions],
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

  const handleBgClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && selectedId) onSelectionChange?.(null);
    },
    [onSelectionChange, selectedId],
  );

  // Empty draft → empty canvas with hint.
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
                id: `regions[${regionIdx}].components[${compIdx}]`,
                label: blockLabel(blk),
              })
            }
            onMoveBlock={moveBlock}
            onAddBlock={addBlock}
            onRenameLabel={renameLabel}
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
}: {
  region: Region;
  regionIdx: number;
  shape: 'regions' | 'children';
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
            Empty region — drop a block here or use the add button below.
          </div>
        ) : (
          comps.map((blk, compIdx) => {
            const id = selectionId(shape, regionIdx, compIdx);
            return (
              <BlockRow
                key={`${regionIdx}:${compIdx}`}
                block={blk}
                regionIdx={regionIdx}
                compIdx={compIdx}
                selected={id === selectedId}
                readOnly={readOnly}
                onClick={() => onSelectBlock(compIdx, blk)}
                onMoveBlock={onMoveBlock}
                onRenameLabel={(v) => onRenameLabel(regionIdx, compIdx, v)}
              />
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
