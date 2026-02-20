/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '@object-ui/core';
import type { BridgeContext, BridgeFn } from '../types';

interface FormField {
  field: string;
  label?: string;
  placeholder?: string;
  helpText?: string;
  readonly?: boolean;
  required?: boolean;
  hidden?: boolean;
  colSpan?: number;
  widget?: string;
  dependsOn?: string[];
  visibleOn?: string;
}

interface FormSection {
  label?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: number;
  fields?: FormField[];
}

interface FormViewSpec {
  type?: string;
  data?: any;
  sections?: FormSection[];
  groups?: any;
  // P1.2 additions
  defaultSort?: any;
  sharing?: any;
  aria?: { ariaLabel?: string; ariaDescribedBy?: string; role?: string };
}

function mapField(field: FormField): Record<string, any> {
  const mapped: Record<string, any> = {
    name: field.field,
    label: field.label ?? field.field,
  };

  if (field.placeholder) mapped.placeholder = field.placeholder;
  if (field.helpText) mapped.helpText = field.helpText;
  if (field.readonly != null) mapped.readonly = field.readonly;
  if (field.required != null) mapped.required = field.required;
  if (field.hidden != null) mapped.hidden = field.hidden;
  if (field.colSpan != null) mapped.colSpan = field.colSpan;
  if (field.widget) mapped.widget = field.widget;
  if (field.dependsOn) mapped.dependsOn = field.dependsOn;
  if (field.visibleOn) mapped.visibleOn = field.visibleOn;

  return mapped;
}

function mapSection(section: FormSection): Record<string, any> {
  const mapped: Record<string, any> = {
    fields: (section.fields ?? []).map(mapField),
  };

  if (section.label) mapped.label = section.label;
  if (section.collapsible != null) mapped.collapsible = section.collapsible;
  if (section.collapsed != null) mapped.collapsed = section.collapsed;
  if (section.columns != null) mapped.columns = section.columns;

  return mapped;
}

/** Maps spec formType to ObjectUI formType */
function mapFormType(type?: string): string | undefined {
  if (!type) return undefined;
  const validTypes = ['simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal'];
  return validTypes.includes(type) ? type : undefined;
}

/** Transforms a FormView spec into a Form SchemaNode */
export const bridgeFormView: BridgeFn<FormViewSpec> = (
  spec: FormViewSpec,
  _context: BridgeContext,
): SchemaNode => {
  const sections = (spec.sections ?? []).map(mapSection);
  const formType = mapFormType(spec.type);

  const node: SchemaNode = {
    type: 'object-form',
    id: `form-${spec.type ?? 'default'}`,
    sections,
    data: spec.data,
  };

  // P1.2 — formType mapping (tabbed, wizard, split, drawer, modal)
  if (formType) node.formType = formType;
  if (spec.groups) node.groups = spec.groups;
  if (spec.defaultSort) node.defaultSort = spec.defaultSort;

  // P1.6 — i18n & ARIA
  if (spec.sharing) node.sharing = spec.sharing;
  if (spec.aria) node.aria = spec.aria;

  return node;
};
