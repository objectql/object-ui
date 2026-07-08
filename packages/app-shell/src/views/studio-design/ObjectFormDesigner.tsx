// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectFormDesigner — the WYSIWYG form-layout designer for the Studio Data
 * pillar's Form view. An admin arranges the object's default form exactly as
 * end users will see it: fields grouped into **sections** (the object's
 * `fieldGroups`), drag-reordered within a section and dragged **across**
 * sections, with per-field selection opening the same protocol field inspector
 * the grid uses.
 *
 * Build boundary: this component is only the drag/section CHROME. The data
 * model + all mutations are the existing, tested `object-fields-io` helpers
 * (readFields/writeFields · readGroups/addGroup/renameGroup/removeGroup/
 * moveGroup · clearFieldGroup · groupEntries), and section membership +
 * in-group order persist to the object draft (`fields[].group` + `fieldGroups`)
 * via the pillar's existing draft → publish. No new metadata shape.
 */

import * as React from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown, Rows3, Settings2 } from 'lucide-react';
import { inferColumns, containerGridColsFor, isWideFieldType } from '@object-ui/plugin-form';
import {
  readFields,
  writeFields,
  readGroups,
  addGroup,
  renameGroup,
  removeGroup,
  moveGroup,
  clearFieldGroup,
  type FieldEntry,
  type FieldsView,
} from '../metadata-admin/previews/object-fields-io';
import { t, tFormat, useMetadataLocale } from '../metadata-admin/i18n';

const UNGROUPED = '__ungrouped__';
const cid = (key: string) => `g:${key}`; // container (section) droppable id
const fid = (name: string) => `f:${name}`; // sortable field id
const unCid = (id: string) => id.slice(2);
const unFid = (id: string) => id.slice(2);

export interface ObjectFormDesignerProps {
  /** Object metadata draft (reads `fields` + `fieldGroups`). */
  draft: Record<string, unknown>;
  /** Field names to hide from the layout (system/audit) but preserve on write. */
  systemFieldNames: Set<string>;
  /** Persist a partial object-draft patch (fields / fieldGroups) + mark dirty. */
  onChange: (patch: Record<string, unknown>) => void;
  /** Currently selected field name (highlighted). */
  selectedField?: string | null;
  /** Select a field → opens the shared field inspector. */
  onSelectField: (name: string) => void;
  /** Append a new field (reuses the pillar's add-field). Omit to hide the button — e.g. a read-only package. */
  onAddField?: () => void;
  /** Currently selected group key (its section is highlighted). */
  selectedGroup?: string | null;
  /** Select a group (section) → opens the group property inspector. Omit to hide the affordance. */
  onSelectGroup?: (key: string) => void;
  /** Courtesy gate: layout stays viewable, but add/rename/reorder/delete are off. */
  readOnly?: boolean;
}

/** A faithful, non-interactive preview of a field's control (by type). */
function FieldControlPreview({ type }: { type: string }): React.ReactElement {
  const locale = useMetadataLocale();
  const box = 'mt-1 flex items-center rounded-md border bg-muted/30 px-2 text-[11px] text-muted-foreground';
  switch (type) {
    case 'select':
    case 'radio':
    case 'lookup':
    case 'reference':
    case 'user':
    case 'multiselect':
      return (
        <div className={`${box} h-7 justify-between`}>
          <span>{type === 'lookup' || type === 'reference' || type === 'user' ? t('engine.studio.designer.search', locale) : t('engine.studio.designer.select', locale)}</span>
          <span>▾</span>
        </div>
      );
    case 'textarea':
    case 'html':
    case 'markdown':
    case 'json':
    case 'code':
      return <div className={`${box} h-14 items-start pt-1.5`}>…</div>;
    case 'boolean':
    case 'checkbox':
    case 'switch':
      return (
        <div className="mt-1 flex items-center">
          <span className="h-4 w-7 rounded-full bg-muted" />
        </div>
      );
    case 'number':
    case 'currency':
    case 'percent':
      return <div className={`${box} h-7`}>0.00</div>;
    case 'date':
    case 'datetime':
    case 'time':
      return <div className={`${box} h-7`}>{t('engine.studio.designer.pickDate', locale)}</div>;
    default:
      return <div className={`${box} h-7`}>&nbsp;</div>;
  }
}

/** One draggable field card inside a section. */
function SortableField({
  entry,
  columns,
  selected,
  onSelect,
}: {
  entry: FieldEntry;
  columns: number;
  selected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const locale = useMetadataLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: fid(entry.name) });
  const type = String(entry.def.type ?? 'text');
  const label = String(entry.def.label ?? entry.name);
  const required = !!entry.def.required;
  // Mirror the real form: wide widgets (textarea/markdown/html/…) take the whole
  // row. `col-span-full` (grid-column: 1/-1) spans every column at ANY container
  // width, so it stays correct as the responsive grid collapses to one column.
  const spanFull = columns > 1 && isWideFieldType(type);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      {...attributes}
      {...listeners}
      aria-label={tFormat('engine.studio.designer.fieldAria', locale, { label })}
      className={
        'group relative flex cursor-grab touch-none select-none items-start gap-1.5 rounded-md border bg-background px-2 py-2 active:cursor-grabbing ' +
        (spanFull ? 'col-span-full ' : '') +
        (selected ? 'ring-2 ring-primary' : 'hover:border-foreground/25') +
        (isDragging ? ' opacity-40' : '')
      }
    >
      <span className="mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100">
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-xs font-medium">
          <span className="truncate">{label}</span>
          {required && <span className="text-destructive">*</span>}
          {/* Quiet type hint — a faint label, not a boxed chip on every row,
              so a form full of fields doesn't read as a wall of grey tags. */}
          <span className="ml-1 text-[9px] uppercase tracking-wide text-muted-foreground/70">{type}</span>
        </div>
        <FieldControlPreview type={type} />
      </div>
    </div>
  );
}

/** A section (declared group or the implicit ungrouped bucket) = a drop zone. */
function Section({
  containerId,
  title,
  fieldIds,
  columns,
  isDeclared,
  canMoveUp,
  canMoveDown,
  entryByName,
  selectedField,
  onSelectField,
  selected = false,
  onSelect,
  onRename,
  onDelete,
  onMove,
  readOnly = false,
}: {
  containerId: string;
  title: string;
  fieldIds: string[];
  columns: number;
  isDeclared: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  entryByName: Map<string, FieldEntry>;
  selectedField?: string | null;
  onSelectField: (name: string) => void;
  selected?: boolean;
  onSelect?: () => void;
  onRename: (label: string) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  readOnly?: boolean;
}): React.ReactElement {
  const locale = useMetadataLocale();
  const { setNodeRef, isOver } = useDroppable({ id: containerId });
  // `@container` scopes the field grid's container queries to THIS section's
  // width, so a wide screen spreads fields to the same column count the real
  // form uses — while a narrow panel collapses to one column.
  const stateCls = isOver
    ? 'border-primary bg-primary/5'
    : selected
      ? 'border-primary/50 bg-primary/5 ring-2 ring-primary'
      : 'bg-muted/20';
  return (
    <div className={'@container rounded-lg border ' + stateCls}>
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        {isDeclared && !readOnly ? (
          <input
            defaultValue={title}
            onBlur={(e) => e.target.value.trim() && e.target.value !== title && onRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[13px] font-medium outline-none hover:bg-muted focus:bg-background focus:ring-1 focus:ring-primary"
          />
        ) : (
          <span className="flex-1 px-1 text-[13px] font-medium text-muted-foreground">{title}</span>
        )}
        {isDeclared && onSelect && (
          <button
            type="button"
            onClick={onSelect}
            aria-label={t('engine.studio.designer.group.settings', locale)}
            title={t('engine.studio.designer.group.settings', locale)}
            className={
              'rounded p-0.5 hover:bg-muted ' +
              (selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground')
            }
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        )}
        {isDeclared && !readOnly && (
          <>
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              aria-label={t('engine.studio.designer.groupUp', locale)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              aria-label={t('engine.studio.designer.groupDown', locale)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t('engine.studio.designer.groupDelete', locale)}
              title={t('engine.studio.designer.groupDeleteTitle', locale)}
              className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
        {/* Field grid mirrors the real form's density: container-query columns
            (1 → up to `columns`) via {@link containerGridColsFor}, so the layout
            designer matches what end users actually see. */}
        <div
          ref={setNodeRef}
          className={'min-h-[52px] p-2.5 ' + (containerGridColsFor(columns) ?? 'grid grid-cols-1 gap-4')}
        >
          {fieldIds.length === 0 && (
            <div className="col-span-full flex items-center justify-center rounded-md border border-dashed py-3 text-[11px] text-muted-foreground">
              {t('engine.studio.designer.dropHere', locale)}
            </div>
          )}
          {fieldIds.map((id) => {
            const name = unFid(id);
            const entry = entryByName.get(name);
            if (!entry) return null;
            return (
              <SortableField
                key={id}
                entry={entry}
                columns={columns}
                selected={selectedField === name}
                onSelect={() => onSelectField(name)}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}

export function ObjectFormDesigner({
  draft,
  systemFieldNames,
  onChange,
  selectedField,
  onSelectField,
  onAddField,
  selectedGroup,
  onSelectGroup,
  readOnly = false,
}: ObjectFormDesignerProps): React.ReactElement {
  const locale = useMetadataLocale();
  const view = React.useMemo(() => readFields(draft.fields), [draft.fields]);
  const groups = React.useMemo(() => readGroups(draft.fieldGroups), [draft.fieldGroups]);
  const entryByName = React.useMemo(() => new Map(view.entries.map((e) => [e.name, e] as const)), [view]);

  // Column count mirrors the real form (objectui#2578): derived ONCE from the
  // object's editable field count and applied to every section, so the layout
  // designer reads at the same density end users see. Each section's container
  // queries then clamp this cap to the actually-rendered width.
  const formColumns = React.useMemo(
    () => inferColumns(view.entries.filter((e) => !systemFieldNames.has(e.name)).length),
    [view.entries, systemFieldNames],
  );

  // Container order: declared groups (in order) then the ungrouped bucket.
  const containerOrder = React.useMemo(() => [...groups.map((g) => cid(g.key)), cid(UNGROUPED)], [groups]);
  const labelOf = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) m.set(cid(g.key), g.label || g.key);
    m.set(cid(UNGROUPED), t('engine.studio.designer.ungrouped', locale));
    return m;
  }, [groups, locale]);

  // Derive container → ordered field ids from the draft (editable fields only;
  // system/audit fields are preserved on write but never shown in the layout).
  const derived = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const c of containerOrder) map[c] = [];
    for (const e of view.entries) {
      if (systemFieldNames.has(e.name)) continue;
      const g = typeof e.def.group === 'string' ? e.def.group : '';
      const target = g && map[cid(g)] ? cid(g) : cid(UNGROUPED);
      map[target].push(fid(e.name));
    }
    return map;
  }, [view.entries, containerOrder, systemFieldNames]);

  const [items, setItems] = React.useState<Record<string, string[]>>(derived);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  // Re-sync from the draft whenever it changes and we are not mid-drag.
  React.useEffect(() => {
    if (!activeId) setItems(derived);
  }, [derived, activeId]);
  // Latest items snapshot for drag-end math — robust whether or not onDragOver
  // fired (e.g. synthetic/automated drags that skip intermediate move events).
  const itemsRef = React.useRef(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = React.useCallback(
    (id: string): string | undefined => {
      if (id.startsWith('g:')) return id;
      return Object.keys(items).find((k) => items[k].includes(id));
    },
    [items],
  );

  /** Flatten the container map back to `fields` (stamping group + order) and persist. */
  const commit = React.useCallback(
    (next: Record<string, string[]>) => {
      const editable: FieldEntry[] = [];
      for (const c of containerOrder) {
        const groupKey = unCid(c);
        for (const id of next[c] ?? []) {
          const e = entryByName.get(unFid(id));
          if (!e) continue;
          const def = { ...e.def };
          if (groupKey === UNGROUPED) delete def.group;
          else def.group = groupKey;
          editable.push({ name: e.name, def });
        }
      }
      const system = view.entries.filter((e) => systemFieldNames.has(e.name));
      const finalView: FieldsView = { shape: view.shape, entries: [...system, ...editable] };
      onChange({ fields: writeFields(finalView) });
    },
    [containerOrder, entryByName, view, systemFieldNames, onChange],
  );

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragOver = (e: DragOverEvent) => {
    const activeIdStr = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const from = findContainer(activeIdStr);
    const to = findContainer(overId);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const fromItems = prev[from] ?? [];
      const toItems = prev[to] ?? [];
      const overIndex = overId.startsWith('g:') ? toItems.length : toItems.indexOf(overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;
      return {
        ...prev,
        [from]: fromItems.filter((i) => i !== activeIdStr),
        [to]: [...toItems.slice(0, insertAt), activeIdStr, ...toItems.slice(insertAt)],
      };
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const activeIdStr = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const prev = itemsRef.current;
    const inContainer = (id: string): string | undefined =>
      id.startsWith('g:') && id in prev ? id : Object.keys(prev).find((k) => prev[k].includes(id));
    const from = inContainer(activeIdStr);
    const to = inContainer(overId);
    if (!from || !to) return;
    let next: Record<string, string[]>;
    if (from === to) {
      const list = prev[from];
      const oldIndex = list.indexOf(activeIdStr);
      const newIndex = overId.startsWith('g:') ? list.length - 1 : list.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) {
        commit(prev);
        return;
      }
      next = { ...prev, [from]: arrayMove(list, oldIndex, newIndex) };
    } else {
      const fromItems = prev[from].filter((i) => i !== activeIdStr);
      const toItems = prev[to];
      const overIndex = overId.startsWith('g:') ? toItems.length : toItems.indexOf(overId);
      const insertAt = overIndex < 0 ? toItems.length : overIndex;
      next = {
        ...prev,
        [from]: fromItems,
        [to]: [...toItems.slice(0, insertAt), activeIdStr, ...toItems.slice(insertAt)],
      };
    }
    setItems(next);
    commit(next);
  };

  const addSection = () => onChange({ fieldGroups: addGroup(groups, t('engine.studio.designer.newGroup', locale)) });
  const renameSection = (key: string, label: string) => onChange({ fieldGroups: renameGroup(groups, key, label) });
  const moveSection = (key: string, dir: -1 | 1) => onChange({ fieldGroups: moveGroup(groups, key, dir) });
  const deleteSection = (key: string) =>
    onChange({ fieldGroups: removeGroup(groups, key), fields: writeFields(clearFieldGroup(view, key)) });

  const activeEntry = activeId && !activeId.startsWith('g:') ? entryByName.get(unFid(activeId)) : null;

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Rows3 className="h-3.5 w-3.5" /> {t('engine.studio.designer.hint', locale)}
        </span>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={addSection}
              className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> {t('engine.studio.designer.addGroup', locale)}
            </button>
            {onAddField && (
              <button
                type="button"
                onClick={onAddField}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {t('engine.studio.data.addField', locale)}
              </button>
            )}
          </>
        )}
      </div>

      <DndContext
        sensors={readOnly ? [] : sensors}
        collisionDetection={pointerWithin}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          {containerOrder.map((c) => {
            const isUngrouped = c === cid(UNGROUPED);
            // Hide the ungrouped bucket only when it is empty AND groups exist.
            if (isUngrouped && (items[c]?.length ?? 0) === 0 && groups.length > 0) return null;
            const declaredIdx = groups.findIndex((g) => cid(g.key) === c);
            return (
              <Section
                key={c}
                containerId={c}
                title={labelOf.get(c) ?? t('engine.studio.designer.ungrouped', locale)}
                fieldIds={items[c] ?? []}
                columns={formColumns}
                isDeclared={!isUngrouped}
                canMoveUp={declaredIdx > 0}
                canMoveDown={declaredIdx >= 0 && declaredIdx < groups.length - 1}
                entryByName={entryByName}
                selectedField={selectedField}
                onSelectField={onSelectField}
                selected={!isUngrouped && selectedGroup === unCid(c)}
                onSelect={!isUngrouped && onSelectGroup ? () => onSelectGroup(unCid(c)) : undefined}
                onRename={(label) => renameSection(unCid(c), label)}
                onDelete={() => deleteSection(unCid(c))}
                onMove={(dir) => moveSection(unCid(c), dir)}
                readOnly={readOnly}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeEntry ? (
            <div className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-2 shadow-lg">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{String(activeEntry.def.label ?? activeEntry.name)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
