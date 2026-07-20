// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AppNavCanvas — form-canvas-style editor for an App's top-level
 * navigation tree. Each nav entry becomes a card with a drag handle,
 * a kind icon, an inline-rename label, the bound path, and a remove
 * affordance on hover. Drag-drop reorders within the root list.
 *
 * Nested children are rendered indented; cross-level moves and
 * adding child items are still handled by AppNavInspector (the
 * canvas keeps DnD focused on the root list to avoid surprising
 * cross-tree reorders).
 *
 * Selection IDs match AppNavInspector:
 *   { kind: 'nav', id: `${rootKey}[${i}]` }
 *   { kind: 'nav', id: `${rootKey}[${i}].children[${j}]` }
 */

import * as React from 'react';
import {
  BarChart3,
  Compass,
  Database,
  FileText,
  Folder,
  GripVertical,
  LayoutDashboard,
  Link as LinkIcon,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Badge, cn } from '@object-ui/components';
import { appendArray, moveArray, spliceArray } from '../inspectors/_shared';
import { t, useMetadataLocale } from '../i18n';

const DND_MIME = 'text/x-objectui-nav';

interface RawNav {
  id?: string;
  type?: string;
  label?: string;
  title?: string;
  name?: string;
  path?: string;
  href?: string;
  route?: string;
  url?: string;
  kind?: string;
  object?: string;
  objectName?: string;
  page?: string;
  pageName?: string;
  dashboard?: string;
  report?: string;
  children?: RawNav[];
  [k: string]: unknown;
}

function inferKind(it: RawNav): string {
  if (it.kind) return String(it.kind);
  if (it.object || it.objectName) return 'object';
  if (it.page || it.pageName) return 'page';
  if (it.dashboard) return 'dashboard';
  if (it.report) return 'report';
  if (Array.isArray(it.children) && it.children.length) return 'group';
  const path = it.path ?? it.href ?? it.route ?? it.url;
  if (typeof path === 'string' && /^https?:/i.test(path)) return 'link';
  return 'item';
}

function kindIcon(kind: string): LucideIcon {
  switch (kind) {
    case 'object':
      return Database;
    case 'page':
      return FileText;
    case 'dashboard':
      return LayoutDashboard;
    case 'report':
      return BarChart3;
    case 'link':
      return LinkIcon;
    case 'group':
      return Folder;
    default:
      return Compass;
  }
}

/**
 * Per-kind color tone — keeps nav kinds scannable at a glance and
 * mirrors the field-type category tinting used elsewhere in Studio.
 * Class strings are written out in full so Tailwind's JIT emits them.
 */
interface KindTone {
  icon: string;
  badge: string;
}

const KIND_TONE: Record<string, KindTone> = {
  object: {
    icon: 'text-blue-500',
    badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300',
  },
  page: {
    icon: 'text-violet-500',
    badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  },
  dashboard: {
    icon: 'text-teal-500',
    badge: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-300',
  },
  report: {
    icon: 'text-amber-500',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  },
  link: {
    icon: 'text-indigo-500',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300',
  },
  group: {
    icon: 'text-slate-500',
    badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
  },
  item: {
    icon: 'text-zinc-500',
    badge: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400',
  },
};

function kindTone(kind: string): KindTone {
  return KIND_TONE[kind] ?? KIND_TONE.item;
}

function navLabel(it: RawNav, i: number): string {
  const l = it.label ?? it.title ?? it.name ?? it.path;
  if (typeof l === 'string' && l.trim()) return l.trim();
  return `Item ${i + 1}`;
}

function navPath(it: RawNav): string | undefined {
  const p = it.path ?? it.href ?? it.route ?? it.url;
  return typeof p === 'string' && p ? p : undefined;
}

export interface AppNavCanvasProps {
  draft: Record<string, unknown>;
  rootKey: string;
  onPatch?: (patch: Record<string, unknown>) => void;
  selection: { kind: string; id: string } | null;
  onSelectionChange?: (sel: { kind: string; id: string; label?: string } | null) => void;
}

export function AppNavCanvas({
  draft,
  rootKey,
  onPatch,
  selection,
  onSelectionChange,
}: AppNavCanvasProps) {
  const locale = useMetadataLocale();
  const items: RawNav[] = React.useMemo(() => {
    const v = (draft as any)[rootKey];
    return Array.isArray(v) ? (v as RawNav[]) : [];
  }, [draft, rootKey]);

  const selectedId = selection && selection.kind === 'nav' ? selection.id : null;
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const setItems = React.useCallback(
    (next: RawNav[]) => {
      if (!onPatch) return;
      onPatch({ [rootKey]: next });
    },
    [onPatch, rootKey],
  );

  const addItem = React.useCallback(() => {
    if (!onPatch) return;
    const newLabel = t('engine.appNav.newItem', locale);
    // Spec invariants from birth (#2245): a snake_case `id` and a `type`
    // (object is the 80% case per the app-composition guide) — never the
    // old `{label, path:''}` placeholder that failed save validation. The
    // item completes once the inspector's object picker fills `objectName`.
    const taken = new Set(items.map((it) => (typeof it.id === 'string' ? it.id : '')).filter(Boolean));
    let navId = `nav_item_${items.length + 1}`;
    for (let n = items.length + 2; taken.has(navId); n++) navId = `nav_item_${n}`;
    const newItem: RawNav = { id: navId, type: 'object', label: newLabel };
    const next = appendArray(items, newItem);
    setItems(next);
    onSelectionChange?.({
      kind: 'nav',
      id: `${rootKey}[${next.length - 1}]`,
      label: newLabel,
    });
  }, [onPatch, items, setItems, rootKey, onSelectionChange, locale]);

  const removeItem = React.useCallback(
    (index: number) => {
      if (!onPatch) return;
      const next = spliceArray(items, index, null);
      setItems(next);
      if (selectedId === `${rootKey}[${index}]`) onSelectionChange?.(null);
    },
    [onPatch, items, setItems, rootKey, selectedId, onSelectionChange],
  );

  const renameItem = React.useCallback(
    (index: number, nextLabel: string) => {
      if (!onPatch) return;
      const cur = items[index] ?? {};
      const updated = { ...cur, label: nextLabel };
      const next = spliceArray(items, index, updated);
      setItems(next);
      if (selectedId === `${rootKey}[${index}]`) {
        onSelectionChange?.({ kind: 'nav', id: `${rootKey}[${index}]`, label: nextLabel });
      }
    },
    [onPatch, items, setItems, rootKey, selectedId, onSelectionChange],
  );

  const moveItem = React.useCallback(
    (from: number, before: number) => {
      if (!onPatch) return;
      let to = before;
      if (from < before) to = before - 1;
      if (to === from) return;
      const next = moveArray(items, from, to);
      setItems(next);
      onSelectionChange?.({
        kind: 'nav',
        id: `${rootKey}[${to}]`,
        label: navLabel(next[to] ?? {}, to),
      });
    },
    [onPatch, items, setItems, rootKey, onSelectionChange],
  );

  return (
    <div className="rounded-md border bg-card/40">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium uppercase tracking-wide text-muted-foreground">
            {t('engine.appNav.heading', locale)}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {items.length} {items.length === 1 ? t('engine.appNav.itemOne', locale) : t('engine.appNav.itemOther', locale)}
          </Badge>
        </div>
        {onPatch && (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-dashed px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            onClick={addItem}
          >
            <Plus className="h-3 w-3" /> {t('engine.appNav.addItem', locale)}
          </button>
        )}
      </div>
      <div
        className="space-y-1.5 p-2"
        onDragOver={(e) => {
          if (!onPatch) return;
          if (!e.dataTransfer.types.includes(DND_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          if (!onPatch) return;
          if (!e.dataTransfer.types.includes(DND_MIME)) return;
          e.preventDefault();
          if (dragIndex == null) return;
          moveItem(dragIndex, items.length);
          setDragIndex(null);
        }}
      >
        {items.length === 0 ? (
          <div className="rounded border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">
            {onPatch
              ? t('engine.appNav.empty', locale)
              : t('engine.appNav.emptyReadonly', locale)}
          </div>
        ) : (
          items.map((it, i) => (
            <NavCardTree
              key={i}
              item={it}
              index={i}
              depth={0}
              path={`${rootKey}[${i}]`}
              selectedId={selectedId}
              canEdit={!!onPatch}
              onClick={(p, lbl) => onSelectionChange?.({ kind: 'nav', id: p, label: lbl })}
              onRename={(lbl) => renameItem(i, lbl)}
              onRemove={() => removeItem(i)}
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => setDragIndex(null)}
              onDropBefore={() => {
                if (dragIndex == null) return;
                moveItem(dragIndex, i);
                setDragIndex(null);
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NavCardTree({
  item,
  index,
  depth,
  path,
  selectedId,
  canEdit,
  onClick,
  onRename,
  onRemove,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  item: RawNav;
  index: number;
  depth: number;
  path: string;
  selectedId: string | null;
  canEdit: boolean;
  onClick: (path: string, label: string) => void;
  onRename: (label: string) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
}) {
  return (
    <>
      <NavCard
        item={item}
        index={index}
        depth={depth}
        path={path}
        isSelected={selectedId === path}
        canEdit={canEdit && depth === 0}
        onClick={() => onClick(path, navLabel(item, index))}
        onRename={onRename}
        onRemove={onRemove}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDropBefore={onDropBefore}
      />
      {Array.isArray(item.children) &&
        item.children.map((c, j) => {
          const childPath = `${path}.children[${j}]`;
          return (
            <NavCardTree
              key={j}
              item={c}
              index={j}
              depth={depth + 1}
              path={childPath}
              selectedId={selectedId}
              canEdit={canEdit}
              onClick={onClick}
              onRename={() => undefined}
              onRemove={() => undefined}
              onDragStart={() => undefined}
              onDragEnd={() => undefined}
              onDropBefore={() => undefined}
            />
          );
        })}
    </>
  );
}

function NavCard({
  item,
  index,
  depth,
  path,
  isSelected,
  canEdit,
  onClick,
  onRename,
  onRemove,
  onDragStart,
  onDragEnd,
  onDropBefore,
}: {
  item: RawNav;
  index: number;
  depth: number;
  path: string;
  isSelected: boolean;
  canEdit: boolean;
  onClick: () => void;
  onRename: (label: string) => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
}) {
  const locale = useMetadataLocale();
  const kind = inferKind(item);
  const Icon = kindIcon(kind);
  const tone = kindTone(kind);
  const path0 = navPath(item);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(navLabel(item, index));
  const [hover, setHover] = React.useState(false);
  const [dropPos, setDropPos] = React.useState<'before' | null>(null);

  React.useEffect(() => {
    if (!editing) setDraft(navLabel(item, index));
  }, [item, index, editing]);

  return (
    <div className="relative" style={{ paddingLeft: depth * 16 }}>
      {dropPos === 'before' && (
        <div className="pointer-events-none absolute inset-x-0 -top-0.5 h-0.5 rounded bg-primary" />
      )}
      <button
        type="button"
        draggable={canEdit && !editing}
        onDragStart={(e) => {
          if (!canEdit) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData(DND_MIME, path);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e) => {
          if (!canEdit) return;
          if (!e.dataTransfer.types.includes(DND_MIME)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropPos('before');
        }}
        onDragLeave={() => setDropPos(null)}
        onDrop={(e) => {
          if (!canEdit) return;
          if (!e.dataTransfer.types.includes(DND_MIME)) return;
          e.preventDefault();
          e.stopPropagation();
          setDropPos(null);
          onDropBefore();
        }}
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-pressed={isSelected}
        className={`group flex w-full items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/40 ${
          isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
        } ${canEdit && !editing ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {canEdit ? (
          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
        ) : (
          <span className="w-3.5" />
        )}
        {/* eslint-disable-next-line react-hooks/static-components -- kindIcon returns a stable icon component from a static registry, not one created during render */}
        <Icon className={cn('h-3.5 w-3.5 shrink-0', tone.icon)} />
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => {
              setEditing(false);
              const v = draft.trim();
              if (v && v !== navLabel(item, index)) onRename(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraft(navLabel(item, index));
                setEditing(false);
              }
            }}
            className="flex-1 min-w-0 rounded border border-input bg-background px-1.5 py-0.5 text-xs outline-none focus:border-primary"
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate font-medium"
            onDoubleClick={(e) => {
              if (!canEdit) return;
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {navLabel(item, index)}
          </span>
        )}
        <Badge variant="outline" className={cn('text-[10px] font-medium', tone.badge)}>
          {kind}
        </Badge>
        {path0 && (
          <code className="ml-0 text-[10px] text-muted-foreground truncate max-w-[10rem]">
            {path0}
          </code>
        )}
        {canEdit && hover && !editing && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRemove();
              }
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={t('engine.appNav.removeItem', locale)}
          >
            <Trash2 className="h-3 w-3" />
          </span>
        )}
      </button>
    </div>
  );
}
