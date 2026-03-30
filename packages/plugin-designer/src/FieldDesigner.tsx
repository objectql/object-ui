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
 * Uses standard ObjectGrid for the list view and a specialized
 * FieldEditor panel for advanced property editing (type picker,
 * options editor, validation rules, conditional fields).
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DesignerFieldDefinition, DesignerFieldType, DesignerFieldOption, DesignerValidationRule } from '@object-ui/types';
import type { ObjectGridSchema, ListColumn } from '@object-ui/types';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ValueDataSource } from '@object-ui/core';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Columns3,
  Settings2,
  Lock,
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
  X,
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
// Field Property Editor (specialized panel)
// ============================================================================

interface FieldEditorProps {
  field: DesignerFieldDefinition;
  onChange: (updated: DesignerFieldDefinition) => void;
  onClose: () => void;
  readOnly: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function FieldEditor({ field, onChange, onClose, readOnly, t }: FieldEditorProps) {
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
      {/* Editor header with close button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">
          {t('common.edit')} — {field.label}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
          aria-label="Close editor"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

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

  const [editingField, setEditingField] = useState<DesignerFieldDefinition | null>(null);
  const [typeFilter, setTypeFilter] = useState<DesignerFieldType | ''>('');

  // Pre-filter fields by type (external filter before ObjectGrid)
  const filteredFields = useMemo(() => {
    if (!typeFilter) return fields;
    return fields.filter((f) => f.type === typeFilter);
  }, [fields, typeFilter]);

  // Create ValueDataSource for ObjectGrid
  const dataSource = useMemo(
    () => new ValueDataSource({ items: filteredFields }),
    [filteredFields]
  );

  // Grid schema
  const gridColumns: ListColumn[] = useMemo(() => [
    { field: 'name', label: t('appDesigner.fieldDesigner.fieldName'), width: 140 },
    { field: 'label', label: t('appDesigner.fieldDesigner.fieldLabel'), width: 160 },
    { field: 'type', label: t('appDesigner.fieldDesigner.fieldType'), width: 100 },
    { field: 'required', label: t('appDesigner.fieldDesigner.required'), width: 80 },
    { field: 'unique', label: t('appDesigner.fieldDesigner.unique'), width: 80 },
    { field: 'group', label: t('appDesigner.fieldDesigner.fieldGroup'), width: 120 },
  ], [t]);

  const gridSchema = useMemo<ObjectGridSchema>(() => ({
    type: 'object-grid',
    objectName: 'field_definition',
    columns: gridColumns,
    searchableFields: ['name', 'label', 'description'],
    showSearch: true,
  }), [gridColumns]);

  // Handlers
  // Note: ObjectGrid applies $select using column fields, which strips `id`.
  // Use `name` (always in columns) as the lookup key instead of `id`.
  const handleEdit = useCallback((record: Record<string, unknown>) => {
    const field = fields.find((f) => f.name === record.name);
    if (field) setEditingField(field);
  }, [fields]);

  const handleDelete = useCallback(async (record: Record<string, unknown>) => {
    const field = fields.find((f) => f.name === record.name);
    if (!field || field.isSystem) return;
    const confirmed = await confirmDialog.confirm(
      t('appDesigner.fieldDesigner.deleteConfirmTitle'),
      t('appDesigner.fieldDesigner.deleteConfirmMessage')
    );
    if (confirmed) {
      onFieldsChange?.(fields.filter((f) => f.id !== field.id));
      if (editingField?.id === field.id) setEditingField(null);
    }
  }, [fields, onFieldsChange, editingField, confirmDialog, t]);

  const handleAddField = useCallback(() => {
    const id = `fld_${Date.now()}`;
    const newField: DesignerFieldDefinition = {
      id,
      name: `new_field_${fields.length + 1}`,
      label: `New Field ${fields.length + 1}`,
      type: 'text',
      isSystem: false,
    };
    const updated = [...fields, newField];
    onFieldsChange?.(updated);
    setEditingField(newField);
  }, [fields, onFieldsChange]);

  const handleFieldUpdate = useCallback((updated: DesignerFieldDefinition) => {
    onFieldsChange?.(fields.map((f) => (f.id === updated.id ? updated : f)));
    setEditingField(updated);
  }, [fields, onFieldsChange]);

  const handleEditorClose = useCallback(() => {
    setEditingField(null);
  }, []);

  return (
    <div
      data-testid="field-designer"
      className={cn('w-full space-y-3', className)}
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
      </div>

      {/* Type filter (external to ObjectGrid for type-specific filtering) */}
      <div className="flex gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as DesignerFieldType | '')}
          data-testid="field-designer-type-filter"
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs shadow-sm outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          <option value="">{t('appDesigner.fieldDesigner.allTypes')}</option>
          {ALL_FIELD_TYPES.map((ft) => (
            <option key={ft} value={ft}>{FIELD_TYPE_META[ft].label}</option>
          ))}
        </select>
      </div>

      {/* ObjectGrid for the field list */}
      <ObjectGrid
        schema={gridSchema}
        dataSource={dataSource}
        onEdit={readOnly ? undefined : handleEdit}
        onDelete={readOnly ? undefined : handleDelete}
        onAddRecord={readOnly ? undefined : handleAddField}
      />

      {/* Specialized Field Editor panel */}
      {editingField && (
        <FieldEditor
          field={editingField}
          onChange={handleFieldUpdate}
          onClose={handleEditorClose}
          readOnly={readOnly}
          t={t}
        />
      )}

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
