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
import {
  GripVertical,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  ArrowUp,
  ArrowDown,
  FolderPlus,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import type { MetadataSelection } from '../preview-registry';
import {
  readFields,
  writeFields,
  newField,
  toFieldName,
  groupEntries,
  readGroups,
  addGroup,
  renameGroup,
  removeGroup,
  moveGroup,
  clearFieldGroup,
  type FieldEntry,
  type FieldGroup,
} from './object-fields-io';
import {
  FIELD_TYPE_META,
  TYPES_BY_CATEGORY,
  CATEGORY_LABEL_EN,
  CATEGORY_LABEL_ZH,
  CATEGORY_TONE,
  type FieldTypeId,
  type FieldTypeMeta,
  type FieldTypeCategory,
} from './field-types';
import { FieldStub } from './FieldStub';
import { t, tFormat } from '../i18n';

/* ─── locale helpers ─── */
const isZh = (locale?: string) => (locale ?? '').toLowerCase().startsWith('zh');
/** Field-type display label in the active locale (data carries both). */
const typeLabel = (meta: FieldTypeMeta | undefined, locale?: string): string | undefined =>
  meta ? (isZh(locale) ? meta.labelZh : meta.label) : undefined;
const categoryLabel = (cat: FieldTypeCategory, locale?: string): string =>
  (isZh(locale) ? CATEGORY_LABEL_ZH : CATEGORY_LABEL_EN)[cat];

export interface ObjectFormCanvasProps {
  objectName: string;
  draft: Record<string, unknown>;
  onPatch?: (patch: Record<string, unknown>) => void;
  selection?: MetadataSelection | null;
  onSelectionChange?: (next: MetadataSelection | null) => void;
  locale?: string;
}

export function ObjectFormCanvas({
  objectName,
  draft,
  onPatch,
  selection,
  onSelectionChange,
  locale,
}: ObjectFormCanvasProps) {
  const readOnly = !onPatch;

  const view = React.useMemo(() => readFields((draft as any).fields), [draft]);
  const declaredGroups = React.useMemo<FieldGroup[]>(
    () => readGroups((draft as any).fieldGroups),
    [draft],
  );
  const hasGroups = declaredGroups.length > 0;
  // While editing, keep empty declared sections visible as drop targets.
  const groups = React.useMemo(
    () => groupEntries(view, declaredGroups, { includeEmptyDeclared: !readOnly }),
    [view, declaredGroups, readOnly],
  );

  // Collapse state is local UI — keyed by group key (null bucket → "").
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
  const collapseKey = (key: string | null) => key ?? '__ungrouped__';
  const toggleCollapse = React.useCallback((key: string | null) => {
    const k = key ?? '__ungrouped__';
    setCollapsed((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed[collapseKey(g.key)]);
  const setAllCollapsed = React.useCallback(
    (value: boolean) => {
      setCollapsed(() => {
        const next: Record<string, boolean> = {};
        for (const g of groups) next[collapseKey(g.key)] = value;
        return next;
      });
    },
    [groups],
  );

  const selectedName = selection?.kind === 'field' ? String(selection.id) : null;
  const requiredCount = view.entries.filter((e) => !!e.def.required).length;

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
    (type: FieldTypeId, groupKey?: string | null) => {
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
      if (groupKey) entry.def = { ...entry.def, group: groupKey };
      // Insert at the end of the target group's run so it lands in-section,
      // otherwise append to the very end (ungrouped / no groups).
      let insertAt = view.entries.length;
      if (groupKey) {
        for (let j = view.entries.length - 1; j >= 0; j -= 1) {
          if (view.entries[j].def.group === groupKey) { insertAt = j + 1; break; }
        }
      }
      const entries = view.entries.slice();
      entries.splice(insertAt, 0, entry);
      onPatch({ fields: writeFields({ shape: view.shape, entries }) });
      onSelectionChange?.({
        kind: 'field',
        id: name,
        label: String(entry.def.label ?? name),
      });
    },
    [onPatch, onSelectionChange, view],
  );

  /* ─── Section (field group) operations ─── */

  const addSection = React.useCallback(() => {
    if (!onPatch) return;
    const label = tFormat('designer.canvas.sectionN', locale, {
      n: declaredGroups.length + 1,
    });
    const next = addGroup(declaredGroups, label);
    const created = next[next.length - 1];
    onPatch({ fieldGroups: next });
    // Reveal the new (empty) section if everything was collapsed.
    setCollapsed((prev) => ({ ...prev, [created.key]: false }));
  }, [onPatch, declaredGroups, locale]);

  const renameSection = React.useCallback(
    (key: string, label: string) => {
      if (!onPatch) return;
      onPatch({ fieldGroups: renameGroup(declaredGroups, key, label) });
    },
    [onPatch, declaredGroups],
  );

  const removeSection = React.useCallback(
    (key: string) => {
      if (!onPatch) return;
      // Drop the declaration AND clear `group` from its members so they
      // fall back to the Ungrouped bucket rather than vanishing.
      const clearedView = clearFieldGroup(view, key);
      onPatch({
        fieldGroups: removeGroup(declaredGroups, key),
        fields: writeFields(clearedView),
      });
    },
    [onPatch, declaredGroups, view],
  );

  const moveSection = React.useCallback(
    (key: string, dir: -1 | 1) => {
      if (!onPatch) return;
      onPatch({ fieldGroups: moveGroup(declaredGroups, key, dir) });
    },
    [onPatch, declaredGroups],
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

  // Keyboard reorder (Alt+↑/↓): swap a field with its nearest neighbour
  // in the SAME group so a focused row moves predictably within its
  // section without ever changing groups.
  const moveFieldByOffset = React.useCallback(
    (name: string, dir: -1 | 1) => {
      if (!onPatch) return;
      const entries = view.entries.slice();
      const idx = entries.findIndex((e) => e.name === name);
      if (idx < 0) return;
      const grp = typeof entries[idx].def.group === 'string' ? entries[idx].def.group : null;
      let j = idx + dir;
      while (j >= 0 && j < entries.length) {
        const g = typeof entries[j].def.group === 'string' ? entries[j].def.group : null;
        if (g === grp) break;
        j += dir;
      }
      if (j < 0 || j >= entries.length) return;
      const tmp = entries[idx];
      entries[idx] = entries[j];
      entries[j] = tmp;
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
  // Section chrome (headers, collapse, drop-to-assign) only appears once
  // groups exist — otherwise the canvas stays a flat field list.
  const showSectionChrome = hasGroups || groups.length > 1;

  return (
    <div
      className="h-full overflow-auto bg-muted/20"
      onClick={handleBgClick}
      data-object-name={objectName}
    >
      <div className="mx-auto max-w-3xl px-6 py-6 space-y-4" onClick={handleBgClick}>
        {!emptyState && (
          <CanvasToolbar
            fieldCount={view.entries.length}
            requiredCount={requiredCount}
            sectionCount={declaredGroups.length}
            allCollapsed={allCollapsed}
            onToggleAll={showSectionChrome ? () => setAllCollapsed(!allCollapsed) : undefined}
            locale={locale}
          />
        )}

        {emptyState ? (
          <EmptyCanvas onAdd={readOnly ? undefined : addField} locale={locale} />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => {
              const declaredIdx = g.key
                ? declaredGroups.findIndex((d) => d.key === g.key)
                : -1;
              return (
                <GroupSection
                  key={g.key ?? '__ungrouped__'}
                  groupKey={g.key}
                  label={g.key === null ? t('designer.canvas.ungrouped', locale) : g.label}
                  count={g.entries.length}
                  showHeader={showSectionChrome}
                  collapsed={!!collapsed[collapseKey(g.key)]}
                  onToggleCollapse={() => toggleCollapse(g.key)}
                  readOnly={readOnly}
                  locale={locale}
                  canMoveUp={declaredIdx > 0}
                  canMoveDown={declaredIdx >= 0 && declaredIdx < declaredGroups.length - 1}
                  onRename={g.key ? (label) => renameSection(g.key!, label) : undefined}
                  onRemove={g.key ? () => removeSection(g.key!) : undefined}
                  onMove={g.key ? (dir) => moveSection(g.key!, dir) : undefined}
                  onAddField={readOnly ? undefined : (type) => addField(type, g.key)}
                  onDropField={readOnly ? undefined : moveToGroup}
                >
                  {g.entries.map((entry) => (
                    <FieldRow
                      key={entry.name}
                      entry={entry}
                      selected={entry.name === selectedName}
                      readOnly={readOnly}
                      locale={locale}
                      onClick={() => selectField(entry)}
                      onReorder={readOnly ? undefined : reorderField}
                      onRenameLabel={readOnly ? undefined : renameLabel}
                      onMoveOffset={readOnly ? undefined : (dir) => moveFieldByOffset(entry.name, dir)}
                    />
                  ))}
                  {g.entries.length === 0 && (
                    <div className="rounded-md border border-dashed bg-background/40 px-3 py-4 text-center text-[11px] text-muted-foreground">
                      {readOnly
                        ? t('designer.canvas.emptySection', locale)
                        : t('designer.canvas.dropHint', locale)}
                    </div>
                  )}
                </GroupSection>
              );
            })}
          </div>
        )}

        {!emptyState && !readOnly && (
          <div className="flex items-center gap-2 pt-1">
            <AddFieldButton onPick={(type) => addField(type)} locale={locale} />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={addSection}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {t('designer.canvas.addSection', locale)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────── Review toolbar ─────────────── */

function CanvasToolbar({
  fieldCount,
  requiredCount,
  sectionCount,
  allCollapsed,
  onToggleAll,
  locale,
}: {
  fieldCount: number;
  requiredCount: number;
  sectionCount: number;
  allCollapsed: boolean;
  onToggleAll?: () => void;
  locale?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-foreground/80">{fieldCount}</span>{' '}
        {t('designer.canvas.fields', locale)}
        <span className="text-muted-foreground/50">·</span>
        <span className="font-medium text-foreground/80">{requiredCount}</span>{' '}
        {t('designer.canvas.required', locale)}
        {sectionCount > 0 && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className="font-medium text-foreground/80">{sectionCount}</span>{' '}
            {t('designer.canvas.sections', locale)}
          </>
        )}
      </div>
      {onToggleAll && (
        <button
          type="button"
          onClick={onToggleAll}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground transition-colors"
        >
          {allCollapsed ? (
            <ChevronsUpDown className="h-3 w-3" />
          ) : (
            <ChevronsDownUp className="h-3 w-3" />
          )}
          {allCollapsed
            ? t('designer.canvas.expandAll', locale)
            : t('designer.canvas.collapseAll', locale)}
        </button>
      )}
    </div>
  );
}

/* ─────────────── Building blocks ─────────────── */

function GroupSection({
  groupKey,
  label,
  count,
  showHeader,
  collapsed,
  onToggleCollapse,
  readOnly,
  locale,
  canMoveUp,
  canMoveDown,
  onRename,
  onRemove,
  onMove,
  onAddField,
  onDropField,
  children,
}: {
  groupKey: string | null;
  label: string;
  count: number;
  showHeader: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  readOnly: boolean;
  locale?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** Rename/remove/move are only wired for real groups (not Ungrouped). */
  onRename?: (label: string) => void;
  onRemove?: () => void;
  onMove?: (dir: -1 | 1) => void;
  onAddField?: (type: FieldTypeId) => void;
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
        <SectionHeader
          label={label}
          count={count}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          readOnly={readOnly}
          locale={locale}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          dropActive={active}
          onRename={onRename}
          onRemove={onRemove}
          onMove={onMove}
          onAddField={onAddField}
        />
      )}
      {!collapsed && <div className="space-y-2.5">{children}</div>}
    </section>
  );
}

function SectionHeader({
  label,
  count,
  collapsed,
  onToggleCollapse,
  readOnly,
  locale,
  canMoveUp,
  canMoveDown,
  dropActive,
  onRename,
  onRemove,
  onMove,
  onAddField,
}: {
  label: string;
  count: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  readOnly: boolean;
  locale?: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  dropActive: boolean;
  onRename?: (label: string) => void;
  onRemove?: () => void;
  onMove?: (dir: -1 | 1) => void;
  onAddField?: (type: FieldTypeId) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  React.useEffect(() => { setDraft(label); }, [label]);
  const commit = () => {
    if (!onRename) { setEditing(false); return; }
    const next = draft.trim();
    if (next && next !== label) onRename(next);
    setEditing(false);
  };
  const Chevron = collapsed ? ChevronRight : ChevronDown;

  return (
    <div className="group/sec flex items-center gap-1.5 pl-0.5 min-h-[24px]">
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex items-center justify-center h-5 w-5 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
        aria-label={
          collapsed
            ? t('designer.canvas.expandSection', locale)
            : t('designer.canvas.collapseSection', locale)
        }
        aria-expanded={!collapsed}
      >
        <Chevron className="h-3.5 w-3.5" />
      </button>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            else if (e.key === 'Escape') { e.preventDefault(); setDraft(label); setEditing(false); }
          }}
          onBlur={commit}
          className="text-[11px] font-medium uppercase tracking-wider px-1 py-0.5 -my-0.5 rounded border border-primary bg-background outline-none min-w-0 flex-1 max-w-[220px]"
        />
      ) : (
        <span
          className={cn(
            'text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate',
            onRename && 'cursor-text hover:text-foreground',
          )}
          onDoubleClick={onRename ? () => { setDraft(label); setEditing(true); } : undefined}
          title={onRename ? t('designer.canvas.renameHint', locale) : undefined}
        >
          {label}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground/60 tabular-nums shrink-0">{count}</span>
      {dropActive && (
        <span className="text-primary normal-case text-[10px] font-normal">
          {t('designer.canvas.dropToAssign', locale)}
        </span>
      )}

      {/* Section actions — appear on hover, edit-mode only, real groups only. */}
      {!readOnly && (onMove || onRemove || onAddField) && (
        <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/sec:opacity-100 focus-within:opacity-100 transition-opacity">
          {onAddField && (
            <AddFieldButton onPick={onAddField} compact locale={locale} />
          )}
          {onMove && (
            <>
              <button
                type="button"
                onClick={() => onMove(-1)}
                disabled={!canMoveUp}
                className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                aria-label={t('designer.canvas.moveSectionUp', locale)}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onMove(1)}
                disabled={!canMoveDown}
                className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                aria-label={t('designer.canvas.moveSectionDown', locale)}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={t('designer.canvas.removeSection', locale)}
              title={t('designer.canvas.removeSectionHint', locale)}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({
  entry,
  selected,
  readOnly,
  locale,
  onClick,
  onReorder,
  onRenameLabel,
  onMoveOffset,
}: {
  entry: FieldEntry;
  selected: boolean;
  readOnly: boolean;
  locale?: string;
  onClick: () => void;
  onReorder?: (fromName: string, toName: string, position: 'before' | 'after') => void;
  onRenameLabel?: (name: string, nextLabel: string) => void;
  /** Keyboard reorder (Alt+↑/↓) — swap with same-group neighbour. */
  onMoveOffset?: (dir: -1 | 1) => void;
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
      <div
        role="button"
        tabIndex={readOnly ? -1 : 0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            if (onMoveOffset) {
              e.preventDefault();
              onMoveOffset(e.key === 'ArrowUp' ? -1 : 1);
            }
            return;
          }
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        draggable={draggable}
        onDragStart={handleDragStart}
        className={cn(
          'group block w-full text-left rounded-md border bg-card px-3.5 py-2.5 transition-colors',
          'hover:border-primary/40 hover:bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
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
                title={onRenameLabel ? t('designer.canvas.renameHint', locale) : undefined}
              >
                {label}
              </span>
            )}
            {required && <span className="text-destructive text-sm">*</span>}
            <code className="text-[10px] text-muted-foreground/70 font-mono truncate">{entry.name}</code>
          </div>
          <Badge variant="outline" className={cn('text-[10px] shrink-0 font-medium', tone.badge)}>
            {typeLabel(meta, locale) ?? typeStr}
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
          locale={locale}
        />
      </div>
      {dropZone === 'after' && (
        <div className="absolute left-0 right-0 -bottom-1 h-0.5 bg-primary rounded-full" />
      )}
    </div>
  );
}

function EmptyCanvas({ onAdd, locale }: { onAdd?: (type: FieldTypeId) => void; locale?: string }) {
  return (
    <div className="rounded-lg border-2 border-dashed bg-background py-16 px-6 text-center space-y-3">
      <div className="text-sm font-medium">{t('designer.canvas.noFields', locale)}</div>
      <div className="text-xs text-muted-foreground">
        {t('designer.canvas.noFieldsHint', locale)}
      </div>
      {onAdd && (
        <div className="pt-2">
          <AddFieldButton onPick={onAdd} locale={locale} />
        </div>
      )}
    </div>
  );
}

function AddFieldButton({ onPick, compact, locale }: { onPick: (type: FieldTypeId) => void; compact?: boolean; locale?: string }) {
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
        {compact ? (
          <button
            type="button"
            className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t('designer.canvas.addFieldToSection', locale)}
            title={t('designer.canvas.addFieldToSection', locale)}
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5 border-dashed">
            <Plus className="h-3.5 w-3.5" />
            {t('designer.canvas.addField', locale)}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0 max-h-[480px] overflow-hidden flex flex-col">
        <div className="p-2 border-b">
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t('designer.canvas.searchFieldType', locale)}
            className="h-7 w-full px-2 text-sm border rounded bg-background outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1 overflow-auto p-1">
          {groups.length === 0 ? (
            <div className="text-xs text-muted-foreground p-4 text-center">
              {t('designer.canvas.noMatchingTypes', locale)}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.category} className="mb-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-2 pb-1">
                  {categoryLabel(g.category, locale)}
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
                        <span className="truncate">{typeLabel(m, locale)}</span>
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
