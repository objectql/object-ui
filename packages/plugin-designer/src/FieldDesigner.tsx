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
 * Uses standard ObjectGrid for the list view and ModalForm for
 * create/edit dialogs with type-specific field properties.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { DesignerFieldDefinition, DesignerFieldType } from '@object-ui/types';
import type { ObjectGridSchema, ListColumn } from '@object-ui/types';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { ModalForm } from '@object-ui/plugin-form';
import type { ModalFormSchema } from '@object-ui/plugin-form';
import { ValueDataSource } from '@object-ui/core';
import {
  Columns3,
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
  Lock,
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

const FIELD_TYPE_OPTIONS = ALL_FIELD_TYPES.map((ft) => ({
  label: FIELD_TYPE_META[ft].label,
  value: ft,
}));

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

  const [formOpen, setFormOpen] = useState(false);
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
    operations: readOnly ? undefined : { create: true, update: true, delete: true },
  }), [gridColumns, readOnly]);

  // Handlers
  // Note: ObjectGrid applies $select using column fields, which strips `id`.
  // Use `name` (always in columns) as the lookup key instead of `id`.
  const handleEdit = useCallback((record: Record<string, unknown>) => {
    const field = fields.find((f) => f.name === record.name);
    if (field) {
      setEditingField(field);
      setFormOpen(true);
    }
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
    }
  }, [fields, onFieldsChange, confirmDialog, t]);

  const handleAddField = useCallback(() => {
    setEditingField(null);
    setFormOpen(true);
  }, []);

  const handleFormSuccess = useCallback((data: Record<string, unknown>) => {
    if (editingField) {
      // Update existing field
      const updated: DesignerFieldDefinition = {
        ...editingField,
        name: String(data.name || editingField.name),
        label: String(data.label || editingField.label),
        type: (data.type as DesignerFieldType) || editingField.type,
        group: data.group ? String(data.group) : undefined,
        description: data.description ? String(data.description) : undefined,
        required: data.required === true,
        unique: data.unique === true,
        readonly: data.readonly === true,
        hidden: data.hidden === true,
        indexed: data.indexed === true,
        externalId: data.externalId === true,
        trackHistory: data.trackHistory === true,
        defaultValue: data.defaultValue ? String(data.defaultValue) : undefined,
        placeholder: data.placeholder ? String(data.placeholder) : undefined,
        referenceTo: data.referenceTo ? String(data.referenceTo) : undefined,
        formula: data.formula ? String(data.formula) : undefined,
      };
      onFieldsChange?.(fields.map((f) => (f.id === editingField.id ? updated : f)));
    } else {
      // Create new field
      const newField: DesignerFieldDefinition = {
        id: `fld_${Date.now()}`,
        name: String(data.name || `new_field_${fields.length + 1}`),
        label: String(data.label || `New Field ${fields.length + 1}`),
        type: (data.type as DesignerFieldType) || 'text',
        group: data.group ? String(data.group) : undefined,
        description: data.description ? String(data.description) : undefined,
        required: data.required === true,
        unique: data.unique === true,
        readonly: data.readonly === true,
        hidden: data.hidden === true,
        indexed: data.indexed === true,
        externalId: data.externalId === true,
        trackHistory: data.trackHistory === true,
        defaultValue: data.defaultValue ? String(data.defaultValue) : undefined,
        placeholder: data.placeholder ? String(data.placeholder) : undefined,
        referenceTo: data.referenceTo ? String(data.referenceTo) : undefined,
        formula: data.formula ? String(data.formula) : undefined,
        isSystem: false,
      };
      onFieldsChange?.([...fields, newField]);
    }
    setFormOpen(false);
    setEditingField(null);
  }, [editingField, fields, onFieldsChange]);

  const handleFormClose = useCallback((open: boolean) => {
    if (!open) {
      setFormOpen(false);
      setEditingField(null);
    }
  }, []);

  // ModalForm schema — mirrors ObjectManager pattern
  const formSchema = useMemo<ModalFormSchema>(() => ({
    type: 'object-form',
    formType: 'modal',
    objectName: 'field_definition',
    mode: editingField ? 'edit' : 'create',
    title: editingField
      ? `${t('common.edit')} — ${editingField.label}`
      : t('appDesigner.fieldDesigner.addField'),
    open: formOpen,
    onOpenChange: handleFormClose,
    modalSize: 'lg',
    customFields: [
      { name: 'name', label: t('appDesigner.fieldDesigner.fieldName'), type: 'text', required: true, placeholder: 'api_name', disabled: readOnly || (editingField?.isSystem ?? false) },
      { name: 'label', label: t('appDesigner.fieldDesigner.fieldLabel'), type: 'text', required: true, placeholder: 'Display Label', disabled: readOnly },
      { name: 'type', label: t('appDesigner.fieldDesigner.fieldType'), type: 'select', required: true, options: FIELD_TYPE_OPTIONS, disabled: readOnly || (editingField?.isSystem ?? false) },
      { name: 'group', label: t('appDesigner.fieldDesigner.fieldGroup'), type: 'text', placeholder: 'Field Group', disabled: readOnly },
      { name: 'description', label: t('appDesigner.fieldDesigner.description'), type: 'textarea', disabled: readOnly },
      { name: 'required', label: t('appDesigner.fieldDesigner.required'), type: 'boolean', disabled: readOnly },
      { name: 'unique', label: t('appDesigner.fieldDesigner.unique'), type: 'boolean', disabled: readOnly },
      { name: 'readonly', label: t('appDesigner.fieldDesigner.readOnly'), type: 'boolean', disabled: readOnly },
      { name: 'hidden', label: t('appDesigner.fieldDesigner.hidden'), type: 'boolean', disabled: readOnly },
      { name: 'indexed', label: t('appDesigner.fieldDesigner.indexed'), type: 'boolean', disabled: readOnly },
      { name: 'externalId', label: t('appDesigner.fieldDesigner.externalId'), type: 'boolean', disabled: readOnly },
      { name: 'trackHistory', label: t('appDesigner.fieldDesigner.trackHistory'), type: 'boolean', disabled: readOnly },
      { name: 'defaultValue', label: t('appDesigner.fieldDesigner.defaultValue'), type: 'text', placeholder: 'Default value', disabled: readOnly },
      { name: 'placeholder', label: t('appDesigner.fieldDesigner.placeholder'), type: 'text', placeholder: 'Placeholder text', disabled: readOnly },
      { name: 'referenceTo', label: t('appDesigner.fieldDesigner.referenceTo'), type: 'text', placeholder: 'Referenced object', disabled: readOnly },
      { name: 'formula', label: t('appDesigner.fieldDesigner.formula'), type: 'textarea', placeholder: 'e.g. price * quantity', disabled: readOnly },
    ],
    initialValues: editingField
      ? {
          name: editingField.name,
          label: editingField.label,
          type: editingField.type,
          group: editingField.group || '',
          description: editingField.description || '',
          required: editingField.required || false,
          unique: editingField.unique || false,
          readonly: editingField.readonly || false,
          hidden: editingField.hidden || false,
          indexed: editingField.indexed || false,
          externalId: editingField.externalId || false,
          trackHistory: editingField.trackHistory || false,
          defaultValue: editingField.defaultValue != null ? String(editingField.defaultValue) : '',
          placeholder: editingField.placeholder || '',
          referenceTo: editingField.referenceTo || '',
          formula: editingField.formula || '',
        }
      : { type: 'text', required: false, unique: false },
    onSuccess: handleFormSuccess,
    onCancel: () => handleFormClose(false),
    readOnly,
  }), [editingField, formOpen, handleFormClose, handleFormSuccess, readOnly, t]);

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

      {/* ModalForm for create / edit */}
      {formOpen && <ModalForm schema={formSchema} />}

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
