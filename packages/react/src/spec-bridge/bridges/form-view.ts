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
  /** Field type (spec FormFieldSchema reuses Data.FieldType; auto-infers widget). */
  type?: string;
  /** Options for select/multiselect/radio/checkboxes fields. */
  options?: any[];
  /** Target object name for lookup/master_detail fields. */
  reference?: string;
  label?: string;
  placeholder?: string;
  helpText?: string;
  readonly?: boolean;
  required?: boolean;
  hidden?: boolean;
  colSpan?: number;
  widget?: string;
  dependsOn?: string[];
  /** Canonical conditional-visibility predicate (ADR-0089). */
  visibleWhen?: string;
  /** @deprecated ADR-0089 → `visibleWhen`. */
  visibleOn?: string;
}

interface FormSection {
  /** Stable section identifier for i18n lookup (spec FormSectionSchema.name). */
  name?: string;
  label?: string;
  description?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  columns?: number;
  /** Section-level conditional-visibility predicate (ADR-0089). */
  visibleWhen?: string;
  fields?: FormField[];
}

/**
 * The subset of `@objectstack/spec` FormViewSchema the bridge consumes.
 * Every serializable spec key is either mapped onto the `object-form` node
 * or listed here with an explicit reason for being ignored — the bridge must
 * never silently drop spec configuration (#2545).
 */
interface FormViewSpec {
  type?: string;
  layout?: string;
  columns?: number;
  title?: string;
  description?: string;
  // Tabbed (`type: 'tabbed'`)
  defaultTab?: string;
  tabPosition?: string;
  // Wizard (`type: 'wizard'`)
  allowSkip?: boolean;
  showStepIndicator?: boolean;
  // Split (`type: 'split'`)
  splitDirection?: string;
  splitSize?: number;
  splitResizable?: boolean;
  // Drawer (`type: 'drawer'`)
  drawerSide?: string;
  drawerWidth?: string;
  // Modal (`type: 'modal'`)
  modalSize?: string;
  data?: any;
  sections?: FormSection[];
  /** Legacy alias of `sections` (spec: "Legacy support → alias to sections"). */
  groups?: FormSection[];
  /** Inline master-detail child collections. */
  subforms?: any[];
  defaultSort?: any;
  sharing?: any;
  aria?: { ariaLabel?: string; ariaDescribedBy?: string; role?: string };
  submitBehavior?: any;
}

function mapField(field: FormField): Record<string, any> {
  const mapped: Record<string, any> = {
    name: field.field,
    label: field.label ?? field.field,
  };

  if (field.type) mapped.type = field.type;
  if (field.options) mapped.options = field.options;
  if (field.reference) mapped.reference = field.reference;
  if (field.placeholder) mapped.placeholder = field.placeholder;
  if (field.helpText) mapped.helpText = field.helpText;
  if (field.readonly != null) mapped.readonly = field.readonly;
  if (field.required != null) mapped.required = field.required;
  if (field.hidden != null) mapped.hidden = field.hidden;
  if (field.colSpan != null) mapped.colSpan = field.colSpan;
  if (field.widget) mapped.widget = field.widget;
  if (field.dependsOn) mapped.dependsOn = field.dependsOn;
  // ADR-0089: `visibleWhen` is the canonical view-form-field visibility predicate
  // (the spec folds the deprecated `visibleOn` into it at parse). Prefer it and
  // fall back to `visibleOn` for raw / un-normalized metadata. The ObjectForm
  // renderer reads this view-level predicate from the node's `visibleOn` slot.
  const visiblePredicate = field.visibleWhen ?? field.visibleOn;
  if (visiblePredicate) mapped.visibleOn = visiblePredicate;

  return mapped;
}

function mapSection(section: FormSection): Record<string, any> {
  const mapped: Record<string, any> = {
    fields: (section.fields ?? []).map(mapField),
  };

  if (section.name) mapped.name = section.name;
  if (section.label) mapped.label = section.label;
  if (section.description) mapped.description = section.description;
  if (section.collapsible != null) mapped.collapsible = section.collapsible;
  if (section.collapsed != null) mapped.collapsed = section.collapsed;
  if (section.columns != null) mapped.columns = section.columns;
  if (section.visibleWhen) mapped.visibleWhen = section.visibleWhen;

  return mapped;
}

/** Maps spec formType to ObjectUI formType */
function mapFormType(type?: string): string | undefined {
  if (!type) return undefined;
  const validTypes = ['simple', 'tabbed', 'wizard', 'split', 'drawer', 'modal'];
  return validTypes.includes(type) ? type : undefined;
}

/**
 * Spec FormViewSchema keys carried onto the `object-form` node verbatim.
 * All of them are declared with the same name (and semantics) on
 * `ObjectFormSchema`, so no per-key mapping is needed — only presence checks.
 */
const PASSTHROUGH_KEYS = [
  'layout',
  'columns',
  'title',
  'description',
  'defaultTab',
  'tabPosition',
  'allowSkip',
  'showStepIndicator',
  'splitDirection',
  'splitSize',
  'splitResizable',
  'drawerSide',
  'drawerWidth',
  'modalSize',
  'subforms',
] as const;

/** Transforms a FormView spec into a Form SchemaNode */
export const bridgeFormView: BridgeFn<FormViewSpec> = (
  spec: FormViewSpec,
  _context: BridgeContext,
): SchemaNode => {
  // Spec defines `groups` as a legacy alias of `sections`; normalize here so
  // downstream renderers only ever see `sections` (ObjectForm never reads a
  // `groups` key — before this normalization a groups-only spec silently
  // rendered no sections at all, #2545).
  const sections = (spec.sections ?? spec.groups ?? []).map(mapSection);
  const formType = mapFormType(spec.type);

  const node: SchemaNode = {
    type: 'object-form',
    id: `form-${spec.type ?? 'default'}`,
    sections,
    data: spec.data,
  };

  // P1.2 — formType mapping (tabbed, wizard, split, drawer, modal)
  if (formType) node.formType = formType;

  // #2545 — same-name spec keys (layout, title, tab/wizard/split/drawer/modal
  // options, subforms) pass straight through onto the node.
  for (const key of PASSTHROUGH_KEYS) {
    if (spec[key] != null) node[key] = spec[key];
  }

  if (spec.defaultSort) node.defaultSort = spec.defaultSort;
  if (spec.submitBehavior) node.submitBehavior = spec.submitBehavior;

  // P1.6 — i18n & ARIA
  if (spec.sharing) node.sharing = spec.sharing;
  if (spec.aria) node.aria = spec.aria;

  return node;
};
