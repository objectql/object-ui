/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * NavigationDesigner Component
 *
 * Drag-and-drop tree builder for NavigationItem[] with support for
 * recursive groups, quick add buttons, type badges, and live preview.
 * Aligned with @objectstack/spec NavigationItem schema.
 */

import React, { useState, useCallback } from 'react';
import type { NavigationItem, NavigationItemType } from '@object-ui/types';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FolderOpen,
  Globe,
  GripVertical,
  LayoutDashboard,
  Link,
  Minus,
  FileText,
  BarChart3,
  MousePointerClick,
  Plus,
  Trash2,
  Database,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDesignerTranslation } from './hooks/useDesignerTranslation';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Types
// ============================================================================

export interface NavigationDesignerProps {
  /** Navigation items to edit */
  items: NavigationItem[];
  /** Callback when items change */
  onChange: (items: NavigationItem[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Show live preview sidebar */
  showPreview?: boolean;
  /** CSS class */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

let ndCounter = 0;

function createId(prefix: string): string {
  ndCounter += 1;
  return `${prefix}_${Date.now()}_${ndCounter}`;
}

const NAV_TYPE_META: Record<NavigationItemType, { labelKey: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  object: { labelKey: 'appDesigner.navTypeObject', color: 'bg-green-100 text-green-700', Icon: Database },
  dashboard: { labelKey: 'appDesigner.navTypeDashboard', color: 'bg-amber-100 text-amber-700', Icon: LayoutDashboard },
  page: { labelKey: 'appDesigner.navTypePage', color: 'bg-teal-100 text-teal-700', Icon: FileText },
  report: { labelKey: 'appDesigner.navTypeReport', color: 'bg-rose-100 text-rose-700', Icon: BarChart3 },
  url: { labelKey: 'appDesigner.navTypeUrl', color: 'bg-sky-100 text-sky-700', Icon: Link },
  group: { labelKey: 'appDesigner.navTypeGroup', color: 'bg-purple-100 text-purple-700', Icon: FolderOpen },
  separator: { labelKey: 'appDesigner.navTypeSeparator', color: 'bg-gray-100 text-gray-600', Icon: Minus },
  action: { labelKey: 'appDesigner.navTypeAction', color: 'bg-orange-100 text-orange-700', Icon: MousePointerClick },
};

const QUICK_ADD_TYPES: Array<{ type: NavigationItemType; labelKey: string }> = [
  { type: 'object', labelKey: 'appDesigner.navObjectPage' },
  { type: 'dashboard', labelKey: 'appDesigner.navDashboard' },
  { type: 'page', labelKey: 'appDesigner.navPage' },
  { type: 'report', labelKey: 'appDesigner.navReport' },
  { type: 'group', labelKey: 'appDesigner.navGroup' },
  { type: 'url', labelKey: 'appDesigner.navUrl' },
  { type: 'separator', labelKey: 'appDesigner.navSeparator' },
];

// ============================================================================
// Navigation Item Row (recursive)
// ============================================================================

interface NavItemRowProps {
  item: NavigationItem;
  depth: number;
  index: number;
  total: number;
  readOnly: boolean;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onAddChild: (parentId: string, type: NavigationItemType) => void;
  expandedIds: Set<string>;
  t: (key: string) => string;
}

function NavItemRow({
  item,
  depth,
  index,
  total,
  readOnly,
  onRemove,
  onMoveUp,
  onMoveDown,
  onToggleExpand,
  onUpdateLabel,
  onAddChild,
  expandedIds,
  t,
}: NavItemRowProps) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(item.label);
  const meta = NAV_TYPE_META[item.type];
  const hasChildren = item.type === 'group' && item.children && item.children.length > 0;
  const isExpanded = expandedIds.has(item.id);

  const handleLabelCommit = () => {
    if (labelDraft.trim()) {
      onUpdateLabel(item.id, labelDraft.trim());
    } else {
      setLabelDraft(item.label);
    }
    setEditingLabel(false);
  };

  return (
    <>
      <li
        data-testid={`nav-designer-item-${item.id}`}
        className={cn(
          'flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 transition-colors hover:bg-gray-50',
        )}
        style={{ marginLeft: depth * 20 }}
      >
        {/* Drag handle */}
        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-300" />

        {/* Expand/collapse for groups */}
        {item.type === 'group' ? (
          <button
            type="button"
            onClick={() => onToggleExpand(item.id)}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600"
            aria-label={isExpanded ? t('appDesigner.navCollapseGroup') : t('appDesigner.navExpandGroup')}
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        <meta.Icon className="h-3.5 w-3.5 shrink-0 text-gray-500" />

        {/* Label */}
        {item.type === 'separator' ? (
          <span className="flex-1 text-xs italic text-gray-400">{t('appDesigner.separatorLabel')}</span>
        ) : editingLabel && !readOnly ? (
          <input
            type="text"
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={handleLabelCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleLabelCommit();
              if (e.key === 'Escape') {
                setLabelDraft(item.label);
                setEditingLabel(false);
              }
            }}
            autoFocus
            className="flex-1 rounded border border-blue-300 px-1.5 py-0.5 text-sm outline-none focus:ring-1 focus:ring-blue-400"
          />
        ) : (
          <span
            className={cn(
              'flex-1 truncate text-sm text-gray-800',
              !readOnly && 'cursor-text'
            )}
            onDoubleClick={() => {
              if (!readOnly && item.type !== 'separator') {
                setLabelDraft(item.label);
                setEditingLabel(true);
              }
            }}
          >
            {item.label}
          </span>
        )}

        {/* Type badge */}
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            meta.color
          )}
        >
          {t(meta.labelKey)}
        </span>

        {/* Add child (groups only) */}
        {item.type === 'group' && !readOnly && (
          <button
            type="button"
            onClick={() => onAddChild(item.id, 'page')}
            className="rounded p-0.5 text-gray-400 hover:text-blue-500"
            aria-label={t('appDesigner.navAddChild')}
            data-testid={`nav-designer-add-child-${item.id}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Reorder */}
        <button
          type="button"
          onClick={() => onMoveUp(item.id)}
          disabled={readOnly || index === 0}
          className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          aria-label={t('appDesigner.navMoveUp')}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(item.id)}
          disabled={readOnly || index === total - 1}
          className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          aria-label={t('appDesigner.navMoveDown')}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={readOnly}
          className="rounded p-0.5 text-gray-400 hover:text-red-500 disabled:opacity-30"
          aria-label={t('appDesigner.navRemove')}
          data-testid={`nav-designer-remove-${item.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </li>

      {/* Render children recursively */}
      {item.type === 'group' && isExpanded && item.children && (
        <>
          {item.children.map((child, ci) => (
            <NavItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              index={ci}
              total={item.children!.length}
              readOnly={readOnly}
              onRemove={onRemove}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              onToggleExpand={onToggleExpand}
              onUpdateLabel={onUpdateLabel}
              onAddChild={onAddChild}
              expandedIds={expandedIds}
              t={t}
            />
          ))}
        </>
      )}
    </>
  );
}

// ============================================================================
// Navigation Preview
// ============================================================================

function NavigationPreview({ items, t }: { items: NavigationItem[]; t: (key: string) => string }) {
  return (
    <div
      data-testid="nav-designer-preview"
      className="w-56 shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-3"
    >
      <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">{t('appDesigner.navLivePreview')}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">{t('appDesigner.navNoPreviewItems')}</p>
      ) : (
        <ul className="space-y-0.5">
          {items.map((item) => (
            <PreviewItem key={item.id} item={item} depth={0} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewItem({ item, depth }: { item: NavigationItem; depth: number }) {
  const meta = NAV_TYPE_META[item.type];

  if (item.type === 'separator') {
    return <li className="my-1 border-t border-gray-200" style={{ marginLeft: depth * 12 }} />;
  }

  return (
    <>
      <li
        className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
        style={{ marginLeft: depth * 12 }}
      >
        <meta.Icon className="h-3 w-3 text-gray-400" />
        <span className="truncate">{item.label}</span>
      </li>
      {item.type === 'group' && item.children?.map((child) => (
        <PreviewItem key={child.id} item={child} depth={depth + 1} />
      ))}
    </>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function NavigationDesigner({
  items,
  onChange,
  readOnly = false,
  showPreview = true,
  className,
}: NavigationDesignerProps) {
  const { t } = useDesignerTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(items.filter((i) => i.type === 'group').map((i) => i.id))
  );

  // ---- Helpers for deep tree operations ----
  const removeItem = useCallback(
    (id: string) => {
      function filterDeep(list: NavigationItem[]): NavigationItem[] {
        return list
          .filter((item) => item.id !== id)
          .map((item) =>
            item.children
              ? { ...item, children: filterDeep(item.children) }
              : item
          );
      }
      onChange(filterDeep(items));
    },
    [items, onChange]
  );

  const moveItem = useCallback(
    (id: string, direction: 'up' | 'down') => {
      function reorder(list: NavigationItem[]): NavigationItem[] {
        const idx = list.findIndex((item) => item.id === id);
        if (idx >= 0) {
          const target = direction === 'up' ? idx - 1 : idx + 1;
          if (target >= 0 && target < list.length) {
            const copy = [...list];
            [copy[idx], copy[target]] = [copy[target], copy[idx]];
            return copy;
          }
          return list;
        }
        return list.map((item) =>
          item.children
            ? { ...item, children: reorder(item.children) }
            : item
        );
      }
      onChange(reorder(items));
    },
    [items, onChange]
  );

  const updateLabel = useCallback(
    (id: string, label: string) => {
      function update(list: NavigationItem[]): NavigationItem[] {
        return list.map((item) => {
          if (item.id === id) return { ...item, label };
          if (item.children) return { ...item, children: update(item.children) };
          return item;
        });
      }
      onChange(update(items));
    },
    [items, onChange]
  );

  const addChild = useCallback(
    (parentId: string, type: NavigationItemType) => {
      const newItem: NavigationItem = {
        id: createId(type),
        type,
        label: type === 'separator' ? '' : `New ${t(NAV_TYPE_META[type].labelKey)}`,
        ...(type === 'group' ? { children: [] } : {}),
        ...(type === 'url' ? { url: '' } : {}),
      };

      function insertChild(list: NavigationItem[]): NavigationItem[] {
        return list.map((item) => {
          if (item.id === parentId && item.type === 'group') {
            return { ...item, children: [...(item.children || []), newItem] };
          }
          if (item.children) {
            return { ...item, children: insertChild(item.children) };
          }
          return item;
        });
      }
      onChange(insertChild(items));
      setExpandedIds((prev) => new Set(prev).add(parentId));
    },
    [items, onChange]
  );

  const addTopLevel = useCallback(
    (type: NavigationItemType) => {
      const newItem: NavigationItem = {
        id: createId(type),
        type,
        label: type === 'separator' ? '' : `New ${t(NAV_TYPE_META[type].labelKey)}`,
        ...(type === 'group' ? { children: [] } : {}),
        ...(type === 'url' ? { url: '' } : {}),
      };
      onChange([...items, newItem]);
    },
    [items, onChange, t]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div
      data-testid="navigation-designer"
      className={cn('flex gap-4', className)}
    >
      {/* Editor */}
      <div className="flex-1 space-y-3">
        {/* Quick add bar */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ADD_TYPES.map(({ type, labelKey }) => {
            const { Icon, color } = NAV_TYPE_META[type];
            return (
              <button
                key={type}
                type="button"
                data-testid={`nav-designer-add-${type}`}
                onClick={() => addTopLevel(type)}
                disabled={readOnly}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <Plus className="h-3 w-3" />
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        {/* Item tree */}
        {items.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">
            {t('appDesigner.navNoItems')}
          </div>
        ) : (
          <ul className="space-y-1" data-testid="nav-designer-tree">
            {items.map((item, idx) => (
              <NavItemRow
                key={item.id}
                item={item}
                depth={0}
                index={idx}
                total={items.length}
                readOnly={readOnly}
                onRemove={removeItem}
                onMoveUp={(id) => moveItem(id, 'up')}
                onMoveDown={(id) => moveItem(id, 'down')}
                onToggleExpand={toggleExpand}
                onUpdateLabel={updateLabel}
                onAddChild={addChild}
                expandedIds={expandedIds}
                t={t}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Preview */}
      {showPreview && <NavigationPreview items={items} t={t} />}
    </div>
  );
}

export default NavigationDesigner;
