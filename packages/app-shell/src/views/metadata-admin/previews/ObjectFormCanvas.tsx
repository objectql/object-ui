// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectFormCanvas — form-designer-style preview for an Object
 * metadata draft. Replaces the legacy CRUD grid in DesignerMode.
 *
 * Each field renders as the labeled input it will become at runtime
 * (via {@link FieldStub}). Clicking a row selects it and the host
 * swaps the inspector to {@link ObjectFieldInspector}. The trailing
 * "+ Add field" button opens a categorized type picker — picking a
 * type appends a fresh field and immediately selects it so authors
 * can fill in name/label in the inspector.
 *
 * All edits go through the host's `onPatch` callback. Read-only
 * surfaces (legacy tier objects, builtin objects) still render the
 * preview but suppress selection chrome + the add button.
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
  readFields,
  writeFields,
  newField,
  toFieldName,
  groupEntries,
  type FieldEntry,
} from './object-fields-io';
import {
  FIELD_TYPE_META,
  TYPES_BY_CATEGORY,
  CATEGORY_LABEL_EN,
  CATEGORY_TONE,
  type FieldTypeId,
} from './field-types';
import { FieldStub } from './FieldStub';

export interface ObjectFormCanvasProps {
  objectName: string;
  draft: Record<string, unknown>;
  onPatch?: (patch: Record<string, unknown>) => void;
  selection?: MetadataSelection | null;
  onSelectionChange?: (next: MetadataSelection | null) => void;
}

export function ObjectFormCanvas({
  objectName,
  draft,
  onPatch,
  selection,
  onSelectionChange,
}: ObjectFormCanvasProps) {
  const readOnly = !onPatch;

  const view = React.useMemo(() => readFields((draft as any).fields), [draft]);
  const fieldGroups = Array.isArray((draft as any).fieldGroups)
    ? ((draft as any).fieldGroups as Array<{ key?: string; label?: string }>)
    : undefined;
  const groups = React.useMemo(() => groupEntries(view, fieldGroups), [view, fieldGroups]);

  const selectedName = selection?.kind === 'field' ? String(selection.id) : null;

  const selectField = React.useCallback(
    (entry: FieldEntry) => {
      if (!onSelectionChange) return;
      onSelectionChange({
        kind: 'field',
        id: entry.name,
        label: typeof entry.def.label === 'string' ? (entry.def.label as string) : entry.name,
      });
    },
    [onSelectionChange],
  );

  const addField = React.useCallback(
    (type: FieldTypeId) => {
      if (!onPatch) return;
      const existing = view.entries.map((e) => e.name);
      const base = type === 'select' ? 'status' : type;
      let i = 1;
      let name = base;
      while (existing.includes(name)) {
        i += 1;
        name = `${base}_${i}`;
      }
      const entry = newField(name, type);
      const next = { shape: view.shape, entries: [...view.entries, entry] };
      onPatch({ fields: writeFields(next) });
      onSelectionChange?.({
        kind: 'field',
        id: name,
        label: String(entry.def.label ?? name),
      });
    },
    [onPatch, onSelectionChange, view],
  );

  // Reorder fields by moving `fromName` to the position of `toName`.
  // Uses native HTML5 DnD — no library, no animations, just a working
  // reorder for the most common designer interaction.
  // If `toName`'s field is in a different group than the dragged field,
  // adopt that group so cross-group drops are intuitive.
  const reorderField = React.useCallback(
    (fromName: string, toName: string, position: 'before' | 'after') => {
      if (!onPatch) return;
      if (fromName === toName) return;
      const entries = view.entries.slice();
      const fromIdx = entries.findIndex((e) => e.name === fromName);
      if (fromIdx < 0) return;
      const [moved] = entries.splice(fromIdx, 1);
      const toIdx = entries.findIndex((e) => e.name === toName);
      const targetEntry = toIdx >= 0 ? entries[toIdx] : undefined;
      if (targetEntry) {
        const targetGroup = typeof targetEntry.def.group === 'string' ? targetEntry.def.group : undefined;
        const fromGroup = typeof moved.def.group === 'string' ? moved.def.group : undefined;
        if (targetGroup !== fromGroup) {
          moved.def = { ...moved.def, group: targetGroup };
        }
      }
      if (toIdx < 0) {
        entries.push(moved);
      } else {
        entries.splice(position === 'before' ? toIdx : toIdx + 1, 0, moved);
      }
      onPatch({ fields: writeFields({ shape: view.shape, entries }) });
    },
    [onPatch, view],
  );

  // Drop a field into a group section's empty space (or onto its header).
  // Reassigns Field.group and moves the entry to the end of that group's
  // run in the source order so it visually lands where it was dropped.
  const moveToGroup = React.useCallback(
    (fromName: string, groupKey: string | null) => {
      if (!onPatch) return;
      const entries = view.entries.slice();
      const fromIdx = entries.findIndex((e) => e.name === fromName);
      if (fromIdx < 0) return;
      const [moved] = entries.splice(fromIdx, 1);
      const currentGroup = typeof moved.def.group === 'string' ? moved.def.group : null;
      if (currentGroup === groupKey) {
        // No group change — re-insert at original position (effectively no-op).
        entries.splice(fromIdx, 0, moved);
        return;
      }
      moved.def = { ...moved.def, group: groupKey ?? undefined };
      // Find end of target group's run; if no members, append at end.
      let insertAt = entries.length;
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const g = typeof entries[i].def.group === 'string' ? entries[i].def.group : null;
        if (g === groupKey) { insertAt = i + 1; break; }
      }
      entries.splice(insertAt, 0, moved);
      onPatch({ fields: writeFields({ shape: view.shape, entries }) });
    },
    [onPatch, view],
  );

  // Inline label rename — used by double-click on the field card label.
  const renameLabel = React.useCallback(
    (name: string, nextLabel: string) => {
      if (!onPatch) return;
      const entries = view.entries.map((e) =>
        e.name === name
          ? { name, def: { ...e.def, label: nextLabel || undefined } }
          : e,
      );
      onPatch({ fields: writeFields({ shape: view.shape, entries }) });
    },
    [onPatch, view],
  );

  // Click anywhere on the empty canvas background to clear selection.
  const handleBgClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && selectedName) {
        onSelectionChange?.(null);
      }
    },
    [onSelectionChange, selectedName],
  );

  const emptyState = view.entries.length === 0;

  return (
    <div
      className="h-full overflow-auto bg-muted/20"
      onClick={handleBgClick}
      data-object-name={objectName}
    >
      <div className="mx-auto max-w-3xl px-6 py-6 space-y-6" onClick={handleBgClick}>
        {emptyState ? (
          <EmptyCanvas onAdd={readOnly ? undefined : addField} />
        ) : (
          groups.map((g) => (
            <GroupSection
              key={g.key ?? '__ungrouped__'}
              groupKey={g.key}
              label={g.label}
              showHeader={groups.length > 1}
              onDropField={readOnly ? undefined : moveToGroup}
            >
              {g.entries.map((entry) => (
                <FieldRow
                  key={entry.name}
                  entry={entry}
                  selected={entry.name === selectedName}
                  readOnly={readOnly}
                  onClick={() => selectField(entry)}
                  onReorder={readOnly ? undefined : reorderField}
                  onRenameLabel={readOnly ? undefined : renameLabel}
                />
              ))}
            </GroupSection>
          ))
        )}

        {!emptyState && !readOnly && (
          <div className="pt-1">
            <AddFieldButton onPick={addField} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Building blocks ─────────────── */

function GroupSection({
  groupKey,
  label,
  showHeader,
  onDropField,
  children,
}: {
  groupKey: string | null;
  label: string;
  showHeader: boolean;
  onDropField?: (fromName: string, groupKey: string | null) => void;
  children: React.ReactNode;
}) {
  const [active, setActive] = React.useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    if (!onDropField) return;
    const types = e.dataTransfer.types;
    if (!types || !Array.from(types).includes('text/x-objectui-field')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setActive(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    // Only deactivate when leaving the section container itself, not its children.
    if (e.currentTarget === e.target) setActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!onDropField) return;
    // Let inner FieldRow drops win — only handle if no row already consumed it.
    if (e.defaultPrevented) { setActive(false); return; }
    e.preventDefault();
    const from = e.dataTransfer.getData('text/x-objectui-field');
    setActive(false);
    if (from) onDropField(from, groupKey);
  };
  return (
    <section
      className={cn(
        'space-y-2.5 rounded-md transition-colors',
        active && 'bg-primary/5 ring-1 ring-primary/30 -mx-1 px-1 py-1',
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {showHeader && (
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground pl-1 flex items-center gap-1.5">
          {label}
          {active && <span className="text-primary normal-case text-[10px]">drop to assign</span>}
        </div>
      )}
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function FieldRow({
  entry,
  selected,
  readOnly,
  onClick,
  onReorder,
  onRenameLabel,
}: {
  entry: FieldEntry;
  selected: boolean;
  readOnly: boolean;
  onClick: () => void;
  onReorder?: (fromName: string, toName: string, position: 'before' | 'after') => void;
  onRenameLabel?: (name: string, nextLabel: string) => void;
}) {
  const def = entry.def;
  const typeStr = typeof def.type === 'string' ? (def.type as string) : 'text';
  const meta = FIELD_TYPE_META[typeStr as FieldTypeId];
  const Icon = meta?.Icon;
  const tone = CATEGORY_TONE[meta?.category ?? 'advanced'];
  const label = typeof def.label === 'string' ? (def.label as string) : entry.name;
  const required = !!def.required;
  const description = typeof def.description === 'string' ? (def.description as string) : null;
  const options = Array.isArray(def.options)
    ? (def.options as Array<{ value?: unknown; label?: unknown }>).map((o) => ({
        value: String(o.value ?? ''),
        label: typeof o.label === 'string' ? o.label : undefined,
      }))
    : undefined;
  const referenceTo = typeof def.reference === 'string' ? (def.reference as string) : undefined;
  const formula = typeof def.formula === 'string' ? (def.formula as string) : undefined;
  const placeholder = typeof def.placeholder === 'string' ? (def.placeholder as string) : undefined;

  const [dropZone, setDropZone] = React.useState<'before' | 'after' | null>(null);
  const draggable = !!onReorder;

  const [editingLabel, setEditingLabel] = React.useState(false);
  const [labelDraft, setLabelDraft] = React.useState(label);
  React.useEffect(() => { setLabelDraft(label); }, [label]);
  const beginEdit = (e: React.MouseEvent) => {
    if (!onRenameLabel) return;
    e.preventDefault();
    e.stopPropagation();
    setLabelDraft(label);
    setEditingLabel(true);
  };
  const commitEdit = () => {
    if (!onRenameLabel) { setEditingLabel(false); return; }
    const next = labelDraft.trim();
    if (next && next !== label) onRenameLabel(entry.name, next);
    setEditingLabel(false);
  };
  const cancelEdit = () => {
    setLabelDraft(label);
    setEditingLabel(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/x-objectui-field', entry.name);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!draggable) return;
    const types = e.dataTransfer.types;
    if (!types || !Array.from(types).includes('text/x-objectui-field')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
    setDropZone(pos);
  };
  const handleDragLeave = () => setDropZone(null);
  const handleDrop = (e: React.DragEvent) => {
    if (!onReorder) return;
    e.preventDefault();
    e.stopPropagation();
    const from = e.dataTransfer.getData('text/x-objectui-field');
    setDropZone(null);
    if (from && from !== entry.name) {
      onReorder(from, entry.name, dropZone ?? 'before');
    }
  };

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
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {draggable && (
              <GripVertical
                className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground/80"
                aria-hidden="true"
              />
            )}
            {Icon && <Icon className={cn('h-3.5 w-3.5 shrink-0', tone.icon)} />}
            {editingLabel ? (
              <input
                autoFocus
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
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
                className={cn('text-sm font-medium truncate', onRenameLabel && 'cursor-text')}
                onDoubleClick={beginEdit}
                title={onRenameLabel ? 'Double-click to rename' : undefined}
              >
                {label}
              </span>
            )}
            {required && <span className="text-destructive text-sm">*</span>}
            <code className="text-[10px] text-muted-foreground/70 font-mono truncate">{entry.name}</code>
          </div>
          <Badge variant="outline" className={cn('text-[10px] shrink-0 font-medium', tone.badge)}>
            {meta?.label ?? typeStr}
          </Badge>
        </div>
        {description && (
          <div className="text-[11px] text-muted-foreground mb-1.5 line-clamp-1">{description}</div>
        )}
        <FieldStub
          type={typeStr}
          label={label}
          placeholder={placeholder}
          options={options}
          referenceTo={referenceTo}
          formula={formula}
        />
      </button>
      {dropZone === 'after' && (
        <div className="absolute left-0 right-0 -bottom-1 h-0.5 bg-primary rounded-full" />
      )}
    </div>
  );
}

function EmptyCanvas({ onAdd }: { onAdd?: (type: FieldTypeId) => void }) {
  return (
    <div className="rounded-lg border-2 border-dashed bg-background py-16 px-6 text-center space-y-3">
      <div className="text-sm font-medium">No fields yet</div>
      <div className="text-xs text-muted-foreground">
        Add a field to start designing the form. Click any field to edit its properties on the right.
      </div>
      {onAdd && (
        <div className="pt-2">
          <AddFieldButton onPick={onAdd} />
        </div>
      )}
    </div>
  );
}

function AddFieldButton({ onPick }: { onPick: (type: FieldTypeId) => void }) {
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState('');
  const q = filter.trim().toLowerCase();

  const groups = React.useMemo(() => {
    if (!q) return TYPES_BY_CATEGORY;
    return TYPES_BY_CATEGORY
      .map((g) => ({
        category: g.category,
        types: g.types.filter((id) => {
          const m = FIELD_TYPE_META[id];
          return id.includes(q) || m.label.toLowerCase().includes(q) || m.labelZh.includes(filter.trim());
        }),
      }))
      .filter((g) => g.types.length > 0);
  }, [q, filter]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setFilter('');
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 border-dashed">
          <Plus className="h-3.5 w-3.5" />
          Add field
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 max-h-[480px] overflow-hidden flex flex-col">
        <div className="p-2 border-b">
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search field type…"
            className="h-7 w-full px-2 text-sm border rounded bg-background outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-auto p-1">
          {groups.length === 0 ? (
            <div className="text-xs text-muted-foreground p-4 text-center">No matching types.</div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="mb-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1">
                  {CATEGORY_LABEL_EN[g.category]}
                </div>
                <div className="grid grid-cols-2 gap-0.5">
                  {g.types.map((id) => {
                    const m = FIELD_TYPE_META[id];
                    const Icon = m.Icon;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onPick(id);
                          setOpen(false);
                          setFilter('');
                        }}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-accent"
                      >
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', CATEGORY_TONE[m.category].icon)} />
                        <span className="truncate">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Internal helper for callers that want to normalize a name in their own UI.
export { toFieldName };
