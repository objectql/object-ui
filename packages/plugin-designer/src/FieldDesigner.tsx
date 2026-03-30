/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * FieldDesigner Component
 *
 * Enterprise-grade visual designer for configuring object fields.
 * Supports CRUD operations on fields, advanced property editing,
 * field grouping, sorting, validation rules, and system field display.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DesignerFieldDefinition, DesignerFieldType, DesignerFieldOption, DesignerValidationRule } from '@object-ui/types';
import {
  Plus,
  Search,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  Columns3,
  Settings2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  ListOrdered,
  Link2,
  AtSign,
  Phone,
  Globe,
  FileText,
  Image,
  Palette,
  Code,
  MapPin,
  Star,
  SlidersHorizontal,
  GripVertical,
  Shield,
  History,
  Key,
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

export interface FieldDesignerProps {
  /** Object name this designer belongs to */
  objectName: string;
  /** List of field definitions */
  fields: DesignerFieldDefinition[];
  /** Callback when fields change */
  onFieldsChange?: (fields: DesignerFieldDefinition[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** CSS class */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const FIELD_TYPE_META: Record<DesignerFieldType, { label: string; Icon: React.FC<{ className?: string }> }> = {
  text: { label: 'Text', Icon: Type },
  textarea: { label: 'Text Area', Icon: FileText },
  number: { label: 'Number', Icon: Hash },
  boolean: { label: 'Checkbox', Icon: ToggleLeft },
  date: { label: 'Date', Icon: Calendar },
  datetime: { label: 'Date/Time', Icon: Calendar },
  time: { label: 'Time', Icon: Calendar },
  select: { label: 'Picklist', Icon: ListOrdered },
  email: { label: 'Email', Icon: AtSign },
  phone: { label: 'Phone', Icon: Phone },
  url: { label: 'URL', Icon: Globe },
  password: { label: 'Password', Icon: Lock },
  currency: { label: 'Currency', Icon: Hash },
  percent: { label: 'Percent', Icon: Hash },
  lookup: { label: 'Lookup', Icon: Link2 },
  formula: { label: 'Formula', Icon: Code },
  autonumber: { label: 'Auto Number', Icon: Hash },
  file: { label: 'File', Icon: FileText },
  image: { label: 'Image', Icon: Image },
  markdown: { label: 'Markdown', Icon: FileText },
  html: { label: 'Rich Text', Icon: FileText },
  color: { label: 'Color', Icon: Palette },
  code: { label: 'Code', Icon: Code },
  location: { label: 'Location', Icon: MapPin },
  address: { label: 'Address', Icon: MapPin },
  rating: { label: 'Rating', Icon: Star },
  slider: { label: 'Slider', Icon: SlidersHorizontal },
};

const ALL_FIELD_TYPES = Object.keys(FIELD_TYPE_META) as DesignerFieldType[];

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
// Field Property Editor (inline)
// ============================================================================

interface FieldEditorProps {
  field: DesignerFieldDefinition;
  onChange: (updated: DesignerFieldDefinition) => void;
  readOnly: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function FieldEditor({ field, onChange, readOnly, t }: FieldEditorProps) {
  const update = useCallback(
    (partial: Partial<DesignerFieldDefinition>) => {
      onChange({ ...field, ...partial });
    },
    [field, onChange]
  );

  const addOption = useCallback(() => {
    const options = field.options || [];
    const newOption: DesignerFieldOption = {
      label: `Option ${options.length + 1}`,
      value: `option_${options.length + 1}`,
    };
    update({ options: [...options, newOption] });
  }, [field.options, update]);

  const removeOption = useCallback(
    (idx: number) => {
      const options = [...(field.options || [])];
      options.splice(idx, 1);
      update({ options });
    },
    [field.options, update]
  );

  const updateOption = useCallback(
    (idx: number, partial: Partial<DesignerFieldOption>) => {
      const options = [...(field.options || [])];
      options[idx] = { ...options[idx], ...partial };
      update({ options });
    },
    [field.options, update]
  );

  const addValidationRule = useCallback(() => {
    const rules = field.validationRules || [];
    const newRule: DesignerValidationRule = {
      type: 'minLength',
      value: 0,
      message: '',
    };
    update({ validationRules: [...rules, newRule] });
  }, [field.validationRules, update]);

  const removeValidationRule = useCallback(
    (idx: number) => {
      const rules = [...(field.validationRules || [])];
      rules.splice(idx, 1);
      update({ validationRules: rules });
    },
    [field.validationRules, update]
  );

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3" data-testid="field-editor">
      {/* Name */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.fieldName')}</label>
        <input
          type="text"
          value={field.name}
          onChange={(e) => update({ name: e.target.value })}
          disabled={readOnly || field.isSystem}
          data-testid="field-editor-name"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="api_name"
        />
      </div>

      {/* Label */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.fieldLabel')}</label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => update({ label: e.target.value })}
          disabled={readOnly}
          data-testid="field-editor-label"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Display Label"
        />
      </div>

      {/* Type */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.fieldType')}</label>
        <select
          value={field.type}
          onChange={(e) => update({ type: e.target.value as DesignerFieldType })}
          disabled={readOnly || field.isSystem}
          data-testid="field-editor-type"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
        >
          {ALL_FIELD_TYPES.map((ft) => (
            <option key={ft} value={ft}>{FIELD_TYPE_META[ft].label}</option>
          ))}
        </select>
      </div>

      {/* Group */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.fieldGroup')}</label>
        <input
          type="text"
          value={field.group || ''}
          onChange={(e) => update({ group: e.target.value })}
          disabled={readOnly}
          data-testid="field-editor-group"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Field Group"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.description')}</label>
        <textarea
          value={field.description || ''}
          onChange={(e) => update({ description: e.target.value })}
          disabled={readOnly}
          data-testid="field-editor-description"
          rows={2}
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Help text"
        />
      </div>

      {/* Boolean toggles */}
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.required || false}
            onChange={(e) => update({ required: e.target.checked })}
            disabled={readOnly}
            data-testid="field-editor-required"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs text-gray-700">{t('appDesigner.fieldDesigner.required')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.unique || false}
            onChange={(e) => update({ unique: e.target.checked })}
            disabled={readOnly}
            data-testid="field-editor-unique"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs text-gray-700">{t('appDesigner.fieldDesigner.unique')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.readonly || false}
            onChange={(e) => update({ readonly: e.target.checked })}
            disabled={readOnly}
            data-testid="field-editor-readonly"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs text-gray-700">{t('appDesigner.fieldDesigner.readOnly')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.hidden || false}
            onChange={(e) => update({ hidden: e.target.checked })}
            disabled={readOnly}
            data-testid="field-editor-hidden"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs text-gray-700">{t('appDesigner.fieldDesigner.hidden')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.indexed || false}
            onChange={(e) => update({ indexed: e.target.checked })}
            disabled={readOnly}
            data-testid="field-editor-indexed"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs text-gray-700">{t('appDesigner.fieldDesigner.indexed')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.externalId || false}
            onChange={(e) => update({ externalId: e.target.checked })}
            disabled={readOnly}
            data-testid="field-editor-external-id"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs text-gray-700">{t('appDesigner.fieldDesigner.externalId')}</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={field.trackHistory || false}
            onChange={(e) => update({ trackHistory: e.target.checked })}
            disabled={readOnly}
            data-testid="field-editor-track-history"
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          <span className="text-xs text-gray-700">{t('appDesigner.fieldDesigner.trackHistory')}</span>
        </label>
      </div>

      {/* Default Value */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.defaultValue')}</label>
        <input
          type="text"
          value={field.defaultValue != null ? String(field.defaultValue) : ''}
          onChange={(e) => update({ defaultValue: e.target.value || undefined })}
          disabled={readOnly}
          data-testid="field-editor-default"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Default value"
        />
      </div>

      {/* Placeholder */}
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.placeholder')}</label>
        <input
          type="text"
          value={field.placeholder || ''}
          onChange={(e) => update({ placeholder: e.target.value })}
          disabled={readOnly}
          data-testid="field-editor-placeholder"
          className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          placeholder="Placeholder text"
        />
      </div>

      {/* Lookup Reference (for lookup type) */}
      {field.type === 'lookup' && (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.referenceTo')}</label>
          <input
            type="text"
            value={field.referenceTo || ''}
            onChange={(e) => update({ referenceTo: e.target.value })}
            disabled={readOnly}
            data-testid="field-editor-reference"
            className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            placeholder="Object name"
          />
        </div>
      )}

      {/* Formula (for formula type) */}
      {field.type === 'formula' && (
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.formula')}</label>
          <textarea
            value={field.formula || ''}
            onChange={(e) => update({ formula: e.target.value })}
            disabled={readOnly}
            data-testid="field-editor-formula"
            rows={2}
            className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs font-mono shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            placeholder="e.g. price * quantity"
          />
        </div>
      )}

      {/* Options (for select type) */}
      {field.type === 'select' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.options')}</label>
            {!readOnly && (
              <button
                type="button"
                onClick={addOption}
                data-testid="field-editor-add-option"
                className="text-[10px] font-medium text-blue-600 hover:text-blue-700"
              >
                + {t('appDesigner.fieldDesigner.addOption')}
              </button>
            )}
          </div>
          {(field.options || []).map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1" data-testid={`field-option-${idx}`}>
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(idx, { label: e.target.value })}
                disabled={readOnly}
                className="flex-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs"
                placeholder="Label"
              />
              <input
                type="text"
                value={opt.value}
                onChange={(e) => updateOption(idx, { value: e.target.value })}
                disabled={readOnly}
                className="flex-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs"
                placeholder="Value"
              />
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeOption(idx)}
                  className="rounded p-0.5 text-gray-400 hover:text-red-500"
                  aria-label="Remove option"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Validation Rules */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-gray-500">{t('appDesigner.fieldDesigner.validationRules')}</label>
          {!readOnly && (
            <button
              type="button"
              onClick={addValidationRule}
              data-testid="field-editor-add-validation"
              className="text-[10px] font-medium text-blue-600 hover:text-blue-700"
            >
              + {t('appDesigner.fieldDesigner.addRule')}
            </button>
          )}
        </div>
        {(field.validationRules || []).map((rule, idx) => (
          <div key={idx} className="flex items-center gap-1" data-testid={`field-validation-${idx}`}>
            <select
              value={rule.type}
              onChange={(e) => {
                const rules = [...(field.validationRules || [])];
                rules[idx] = { ...rules[idx], type: e.target.value as DesignerValidationRule['type'] };
                update({ validationRules: rules });
              }}
              disabled={readOnly}
              className="rounded-md border border-gray-300 px-1 py-0.5 text-xs"
            >
              <option value="min">Min</option>
              <option value="max">Max</option>
              <option value="minLength">Min Length</option>
              <option value="maxLength">Max Length</option>
              <option value="pattern">Pattern</option>
              <option value="custom">Custom</option>
            </select>
            <input
              type="text"
              value={String(rule.value)}
              onChange={(e) => {
                const rules = [...(field.validationRules || [])];
                rules[idx] = { ...rules[idx], value: e.target.value };
                update({ validationRules: rules });
              }}
              disabled={readOnly}
              className="flex-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs"
              placeholder="Value"
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => removeValidationRule(idx)}
                className="rounded p-0.5 text-gray-400 hover:text-red-500"
                aria-label="Remove rule"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FieldDesigner({
  objectName,
  fields,
  onFieldsChange,
  readOnly = false,
  className,
}: FieldDesignerProps) {
  const { t } = useDesignerTranslation();
  const confirmDialog = useConfirmDialog();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DesignerFieldType | ''>('');

  // Filtered fields
  const filteredFields = useMemo(() => {
    let result = fields;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.label.toLowerCase().includes(q) ||
          (f.description && f.description.toLowerCase().includes(q))
      );
    }
    if (selectedType) {
      result = result.filter((f) => f.type === selectedType);
    }
    return result;
  }, [fields, searchQuery, selectedType]);

  // Grouped fields
  const groupedFields = useMemo(() => {
    const groups = new Map<string, DesignerFieldDefinition[]>();
    for (const field of filteredFields) {
      const group = field.group || t('appDesigner.fieldDesigner.ungrouped');
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(field);
    }
    // Sort within groups
    for (const [, flds] of groups) {
      flds.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return groups;
  }, [filteredFields, t]);

  const addField = useCallback(() => {
    const id = `fld_${Date.now()}`;
    const newField: DesignerFieldDefinition = {
      id,
      name: `new_field_${fields.length + 1}`,
      label: `New Field ${fields.length + 1}`,
      type: 'text',
      isSystem: false,
    };
    onFieldsChange?.([...fields, newField]);
    setEditingFieldId(id);
  }, [fields, onFieldsChange]);

  const deleteField = useCallback(
    async (id: string) => {
      const field = fields.find((f) => f.id === id);
      if (!field || field.isSystem) return;
      const confirmed = await confirmDialog.confirm(
        t('appDesigner.fieldDesigner.deleteConfirmTitle'),
        t('appDesigner.fieldDesigner.deleteConfirmMessage')
      );
      if (confirmed) {
        onFieldsChange?.(fields.filter((f) => f.id !== id));
        if (editingFieldId === id) setEditingFieldId(null);
      }
    },
    [fields, onFieldsChange, editingFieldId, confirmDialog, t]
  );

  const updateField = useCallback(
    (updated: DesignerFieldDefinition) => {
      onFieldsChange?.(fields.map((f) => (f.id === updated.id ? updated : f)));
    },
    [fields, onFieldsChange]
  );

  const toggleEdit = useCallback(
    (id: string) => {
      setEditingFieldId((prev) => (prev === id ? null : id));
    },
    []
  );

  const moveField = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const idx = fields.findIndex((f) => f.id === id);
      if (idx < 0) return;
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= fields.length) return;
      const updated = [...fields];
      [updated[idx], updated[target]] = [updated[target], updated[idx]];
      onFieldsChange?.(updated);
    },
    [fields, onFieldsChange]
  );

  return (
    <div
      data-testid="field-designer"
      className={cn('w-full space-y-3 rounded-lg border border-gray-200 bg-white p-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Columns3 className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">
            {t('appDesigner.fieldDesigner.title')}
          </h2>
          <span className="text-xs text-gray-500">— {objectName}</span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
            {filteredFields.length}
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={addField}
            data-testid="field-designer-add"
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3 w-3" />
            {t('appDesigner.fieldDesigner.addField')}
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="field-designer-search"
            placeholder={t('appDesigner.fieldDesigner.searchPlaceholder')}
            className="block w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as DesignerFieldType | '')}
          data-testid="field-designer-type-filter"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('appDesigner.fieldDesigner.allTypes')}</option>
          {ALL_FIELD_TYPES.map((ft) => (
            <option key={ft} value={ft}>{FIELD_TYPE_META[ft].label}</option>
          ))}
        </select>
      </div>

      {/* Field List */}
      <div className="space-y-3">
        {filteredFields.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400" data-testid="field-designer-empty">
            {t('appDesigner.fieldDesigner.noFields')}
          </p>
        ) : (
          Array.from(groupedFields.entries()).map(([group, flds]) => (
            <Section
              key={group}
              title={group}
              icon={<Settings2 className="h-3.5 w-3.5 text-gray-500" />}
              badge={String(flds.length)}
            >
              <ul className="space-y-1">
                {flds.map((field, idx) => {
                  const typeMeta = FIELD_TYPE_META[field.type] || { label: field.type, Icon: Type };
                  const TypeIcon = typeMeta.Icon;

                  return (
                    <li key={field.id} data-testid={`field-item-${field.id}`}>
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                          editingFieldId === field.id
                            ? 'bg-blue-50 ring-1 ring-blue-200'
                            : 'hover:bg-gray-50'
                        )}
                      >
                        <div className="flex flex-1 items-center gap-2 min-w-0">
                          <TypeIcon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                          <span className="truncate font-medium text-gray-700">{field.label}</span>
                          <span className="flex-shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[9px] text-gray-500">
                            {typeMeta.label}
                          </span>
                          {field.isSystem && (
                            <span className="flex-shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-700">
                              {t('appDesigner.fieldDesigner.systemBadge')}
                            </span>
                          )}
                          {field.required && (
                            <span className="text-red-400" title="Required">*</span>
                          )}
                          {field.unique && (
                            <Key className="h-3 w-3 flex-shrink-0 text-purple-400" title="Unique" />
                          )}
                          {field.externalId && (
                            <Shield className="h-3 w-3 flex-shrink-0 text-green-400" title="External ID" />
                          )}
                          {field.trackHistory && (
                            <History className="h-3 w-3 flex-shrink-0 text-blue-400" title="Track History" />
                          )}
                          {field.hidden && (
                            <EyeOff className="h-3 w-3 flex-shrink-0 text-gray-300" title="Hidden" />
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveField(field.id, 'up')}
                            disabled={readOnly || idx === 0}
                            className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveField(field.id, 'down')}
                            disabled={readOnly || idx === flds.length - 1}
                            className="rounded p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleEdit(field.id)}
                            disabled={readOnly}
                            data-testid={`field-edit-${field.id}`}
                            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                            aria-label={t('common.edit')}
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          {!field.isSystem && (
                            <button
                              type="button"
                              onClick={() => deleteField(field.id)}
                              disabled={readOnly}
                              data-testid={`field-delete-${field.id}`}
                              className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                              aria-label={t('common.delete')}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Editor */}
                      {editingFieldId === field.id && (
                        <div className="mt-1 ml-5">
                          <FieldEditor
                            field={field}
                            onChange={updateField}
                            readOnly={readOnly}
                            t={t}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
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

export default FieldDesigner;
