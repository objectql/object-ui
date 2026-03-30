/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectManager Component
 *
 * Enterprise-grade visual designer for managing object definitions.
 * Supports CRUD operations, property editing, relationship display,
 * grouping, search, and read-only mode.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { ObjectDefinition, ObjectDefinitionRelationship } from '@object-ui/types';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Database,
  Link2,
  Settings2,
  Box,
  Eye,
  EyeOff,
  GripVertical,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDesignerTranslation } from './hooks/useDesignerTranslation';
import { useConfirmDialog } from './hooks/useConfirmDialog';
import { ConfirmDialog } from './components/ConfirmDialog';

function cn(...inputs: (string | undefined | false)[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// Types
// ============================================================================

export interface ObjectManagerProps {
  /** List of object definitions */
  objects: ObjectDefinition[];
  /** Callback when objects change */
  onObjectsChange?: (objects: ObjectDefinition[]) => void;
  /** Callback when an object is selected for field editing */
  onSelectObject?: (object: ObjectDefinition) => void;
  /** Whether to show system objects */
  showSystemObjects?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** CSS class */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const OBJECT_GROUPS = [
  'Custom Objects',
  'System Objects',
  'Integration',
  'Analytics',
];

const ICON_OPTIONS = [
  'Box', 'Database', 'Users', 'FileText', 'Settings',
  'ShoppingCart', 'Calendar', 'Mail', 'Briefcase', 'Building',
  'Globe', 'Heart', 'Star', 'Tag', 'Bookmark',
  'Folder', 'Archive', 'Package', 'Truck', 'CreditCard',
];

// ============================================================================
// Collapsible Section
// ============================================================================

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
}

function Section({ title, icon, defaultOpen = true, children, badge }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 pb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-2 text-left"
      >
        {icon}
        <span className="flex-1 text-xs font-semibold uppercase text-gray-500">{title}</span>
        {badge && (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            {badge}
          </span>
        )}
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        )}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  );
}

// ============================================================================
// Object Property Editor (inline)
// ============================================================================

interface ObjectEditorProps {
  object: ObjectDefinition;
  onChange: (updated: ObjectDefinition) => void;
  readOnly: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function ObjectEditor({ object, onChange, readOnly, t }: ObjectEditorProps) {
  const update = useCallback(
    (partial: Partial<ObjectDefinition>) => {
      onChange({ ...object, ...partial });
    },
    [object, onChange]
  );

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3" data-testid="object-editor">
      {/* Name */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.objectManager.objectName')}</label>
        <input
          type="text"
          value={object.name}
          onChange={(e) => update({ name: e.target.value })}
          disabled={readOnly || object.isSystem}
          data-testid="object-editor-name"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="api_name"
        />
      </div>

      {/* Label */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.objectManager.objectLabel')}</label>
        <input
          type="text"
          value={object.label}
          onChange={(e) => update({ label: e.target.value })}
          disabled={readOnly}
          data-testid="object-editor-label"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Display Name"
        />
      </div>

      {/* Plural Label */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.objectManager.pluralLabel')}</label>
        <input
          type="text"
          value={object.pluralLabel || ''}
          onChange={(e) => update({ pluralLabel: e.target.value })}
          disabled={readOnly}
          data-testid="object-editor-plural"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Display Names"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.appDescription')}</label>
        <textarea
          value={object.description || ''}
          onChange={(e) => update({ description: e.target.value })}
          disabled={readOnly}
          data-testid="object-editor-description"
          rows={2}
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Object description"
        />
      </div>

      {/* Icon */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.objectManager.icon')}</label>
        <select
          value={object.icon || ''}
          onChange={(e) => update({ icon: e.target.value })}
          disabled={readOnly}
          data-testid="object-editor-icon"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          <option value="">{t('appDesigner.objectManager.selectIcon')}</option>
          {ICON_OPTIONS.map((icon) => (
            <option key={icon} value={icon}>{icon}</option>
          ))}
        </select>
      </div>

      {/* Group */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.objectManager.group')}</label>
        <select
          value={object.group || ''}
          onChange={(e) => update({ group: e.target.value })}
          disabled={readOnly}
          data-testid="object-editor-group"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          <option value="">{t('appDesigner.objectManager.noGroup')}</option>
          {OBJECT_GROUPS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      {/* Sort Order */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.objectManager.sortOrder')}</label>
        <input
          type="number"
          value={object.sortOrder ?? 0}
          onChange={(e) => update({ sortOrder: parseInt(e.target.value, 10) || 0 })}
          disabled={readOnly}
          data-testid="object-editor-sort-order"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          min={0}
        />
      </div>

      {/* Enabled toggle */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={object.enabled !== false}
          onChange={(e) => update({ enabled: e.target.checked })}
          disabled={readOnly}
          data-testid="object-editor-enabled"
          className="h-3.5 w-3.5 rounded border-gray-300"
        />
        <span className="text-xs text-gray-700">{t('appDesigner.objectManager.enabled')}</span>
      </label>

      {/* Relationships (read-only display) */}
      {object.relationships && object.relationships.length > 0 && (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.objectManager.relationships')}</label>
          <ul className="space-y-1">
            {object.relationships.map((rel, idx) => (
              <li
                key={`${rel.relatedObject}-${idx}`}
                className="flex items-center gap-1.5 rounded bg-white px-2 py-1 text-xs text-gray-600"
              >
                <Link2 className="h-3 w-3 text-gray-400" />
                <span className="font-medium">{rel.relatedObject}</span>
                <span className="text-gray-400">({rel.type})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ObjectManager({
  objects,
  onObjectsChange,
  onSelectObject,
  showSystemObjects = true,
  readOnly = false,
  className,
}: ObjectManagerProps) {
  const { t } = useDesignerTranslation();
  const confirmDialog = useConfirmDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);

  // Filtered objects
  const filteredObjects = useMemo(() => {
    let result = objects;
    if (!showSystemObjects) {
      result = result.filter((o) => !o.isSystem);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.label.toLowerCase().includes(q) ||
          (o.description && o.description.toLowerCase().includes(q))
      );
    }
    return result;
  }, [objects, showSystemObjects, searchQuery]);

  // Grouped objects
  const groupedObjects = useMemo(() => {
    const groups = new Map<string, ObjectDefinition[]>();
    for (const obj of filteredObjects) {
      const group = obj.group || t('appDesigner.objectManager.ungrouped');
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(obj);
    }
    // Sort within groups
    for (const [, objs] of groups) {
      objs.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return groups;
  }, [filteredObjects, t]);

  const addObject = useCallback(() => {
    const id = `obj_${Date.now()}`;
    const newObj: ObjectDefinition = {
      id,
      name: `new_object_${objects.length + 1}`,
      label: `New Object ${objects.length + 1}`,
      isSystem: false,
      enabled: true,
      fieldCount: 0,
    };
    onObjectsChange?.([...objects, newObj]);
    setEditingObjectId(id);
  }, [objects, onObjectsChange]);

  const deleteObject = useCallback(
    async (id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj || obj.isSystem) return;
      const confirmed = await confirmDialog.confirm(
        t('appDesigner.objectManager.deleteConfirmTitle'),
        t('appDesigner.objectManager.deleteConfirmMessage')
      );
      if (confirmed) {
        onObjectsChange?.(objects.filter((o) => o.id !== id));
        if (editingObjectId === id) setEditingObjectId(null);
      }
    },
    [objects, onObjectsChange, editingObjectId, confirmDialog, t]
  );

  const updateObject = useCallback(
    (updated: ObjectDefinition) => {
      onObjectsChange?.(objects.map((o) => (o.id === updated.id ? updated : o)));
    },
    [objects, onObjectsChange]
  );

  const toggleEdit = useCallback(
    (id: string) => {
      setEditingObjectId((prev) => (prev === id ? null : id));
    },
    []
  );

  return (
    <div
      data-testid="object-manager"
      className={cn('w-full space-y-3 rounded-lg border border-gray-200 bg-white p-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">
            {t('appDesigner.objectManager.title')}
          </h2>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            {filteredObjects.length}
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addObject}
            data-testid="object-manager-add"
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" />
            {t('appDesigner.objectManager.addObject')}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          data-testid="object-manager-search"
          placeholder={t('appDesigner.objectManager.searchPlaceholder')}
          className="block w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Object List */}
      <div className="space-y-3">
        {filteredObjects.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400" data-testid="object-manager-empty">
            {t('appDesigner.objectManager.noObjects')}
          </p>
        ) : (
          Array.from(groupedObjects.entries()).map(([group, objs]) => (
            <Section
              key={group}
              title={group}
              icon={<Box className="h-3.5 w-3.5 text-gray-500" />}
              badge={String(objs.length)}
            >
              <ul className="space-y-1">
                {objs.map((obj) => (
                  <li key={obj.id} data-testid={`object-item-${obj.id}`}>
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                        editingObjectId === obj.id
                          ? 'bg-blue-50 ring-1 ring-blue-200'
                          : 'hover:bg-gray-50'
                      )}
                    >
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <Database className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <button
                          type="button"
                          onClick={() => onSelectObject?.(obj)}
                          className="flex-1 truncate text-left font-medium text-gray-700 hover:text-blue-600"
                          data-testid={`object-select-${obj.id}`}
                        >
                          {obj.label}
                        </button>
                        {obj.isSystem && (
                          <span className="flex-shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700">
                            {t('appDesigner.objectManager.systemBadge')}
                          </span>
                        )}
                        {obj.enabled === false && (
                          <EyeOff className="h-3 w-3 flex-shrink-0 text-gray-300" />
                        )}
                        {obj.fieldCount != null && (
                          <span className="flex-shrink-0 text-[10px] text-gray-400">
                            {t('appDesigner.objectManager.fieldCount', { count: obj.fieldCount })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleEdit(obj.id)}
                          disabled={readOnly}
                          data-testid={`object-edit-${obj.id}`}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                          aria-label={t('common.edit')}
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        {!obj.isSystem && (
                          <button
                            type="button"
                            onClick={() => deleteObject(obj.id)}
                            disabled={readOnly}
                            data-testid={`object-delete-${obj.id}`}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Editor */}
                    {editingObjectId === obj.id && (
                      <div className="mt-1 ml-5">
                        <ObjectEditor
                          object={obj}
                          onChange={updateObject}
                          readOnly={readOnly}
                          t={t}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          ))
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
        destructive
      />
    </div>
  );
}

export default ObjectManager;
