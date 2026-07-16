/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * FormView spec conformance round-trip (#2545).
 *
 * The bridge must never silently drop `@objectstack/spec` FormViewSchema
 * configuration: every serializable spec key is either mapped onto the
 * `object-form` node or explicitly listed in IGNORED_SPEC_KEYS with a reason.
 * The fixture below carries every top-level FormViewSchema key (spec 14.6.0 /
 * 15.0.0 — identical key sets), so a newly-added spec key that the bridge
 * ignores will fail the completeness assertion when the fixture is updated.
 */
import { describe, it, expect } from 'vitest';
import { SpecBridge } from '../SpecBridge';

/** Spec keys intentionally NOT copied onto the node, with reasons. */
const IGNORED_SPEC_KEYS: Record<string, string> = {
  type: 'mapped to node.formType (ObjectUI rename), not carried verbatim',
  groups: 'legacy alias of sections — normalized into node.sections',
};

/** Every top-level serializable key of spec FormViewSchema (14.6.0 / 15.0.0). */
const FULL_SPEC_FORM_VIEW = {
  type: 'wizard',
  layout: 'grid',
  columns: 2,
  title: 'Edit Opportunity',
  description: 'All the fields',
  defaultTab: 'details',
  tabPosition: 'left',
  allowSkip: true,
  showStepIndicator: false,
  splitDirection: 'horizontal',
  splitSize: 40,
  splitResizable: true,
  drawerSide: 'right',
  drawerWidth: '480px',
  modalSize: 'lg',
  data: { provider: 'object', object: 'opportunity' },
  sections: [
    {
      name: 'basic_info',
      label: 'Basic Info',
      description: 'Who and what',
      collapsible: true,
      collapsed: false,
      columns: 2,
      visibleWhen: 'record.stage != "closed"',
      fields: [
        {
          field: 'name',
          type: 'text',
          label: 'Name',
          required: true,
          placeholder: 'Acme deal',
          helpText: 'Deal name',
          colSpan: 2,
          widget: 'input',
          dependsOn: ['account'],
          visibleWhen: 'record.active == true',
        },
        {
          field: 'account',
          type: 'lookup',
          reference: 'account',
          options: [{ label: 'A', value: 'a' }],
          readonly: true,
          hidden: false,
        },
      ],
    },
  ],
  subforms: [{ childObject: 'opportunity_line_item', amountField: 'amount' }],
  defaultSort: [{ field: 'name', order: 'asc' }],
  sharing: { visibility: 'team' },
  submitBehavior: { kind: 'redirect', url: '/done' },
  aria: { ariaLabel: 'Opportunity form', role: 'form' },
};

describe('FormView spec conformance (#2545)', () => {
  it('carries every spec FormViewSchema key onto the node (no silent drops)', () => {
    const bridge = new SpecBridge();
    const node = bridge.transformFormView(FULL_SPEC_FORM_VIEW);

    for (const key of Object.keys(FULL_SPEC_FORM_VIEW)) {
      if (key in IGNORED_SPEC_KEYS) continue;
      expect(node[key], `spec key "${key}" was silently dropped by the bridge`).toBeDefined();
    }
    // The two intentionally-diverted keys land in their mapped slots.
    expect(node.formType).toBe('wizard');
    expect(node.sections).toHaveLength(1);
  });

  it('passes shared layout/variant keys through verbatim', () => {
    const bridge = new SpecBridge();
    const node = bridge.transformFormView(FULL_SPEC_FORM_VIEW);

    expect(node.layout).toBe('grid');
    expect(node.columns).toBe(2);
    expect(node.title).toBe('Edit Opportunity');
    expect(node.description).toBe('All the fields');
    expect(node.defaultTab).toBe('details');
    expect(node.tabPosition).toBe('left');
    expect(node.allowSkip).toBe(true);
    expect(node.showStepIndicator).toBe(false);
    expect(node.splitDirection).toBe('horizontal');
    expect(node.splitSize).toBe(40);
    expect(node.splitResizable).toBe(true);
    expect(node.drawerSide).toBe('right');
    expect(node.drawerWidth).toBe('480px');
    expect(node.modalSize).toBe('lg');
    expect(node.subforms).toEqual(FULL_SPEC_FORM_VIEW.subforms);
    expect(node.submitBehavior).toEqual({ kind: 'redirect', url: '/done' });
  });

  it('preserves spec FormSection name/description/visibleWhen', () => {
    const bridge = new SpecBridge();
    const node = bridge.transformFormView(FULL_SPEC_FORM_VIEW);
    const section = (node.sections as any[])[0];

    expect(section.name).toBe('basic_info');
    expect(section.description).toBe('Who and what');
    expect(section.visibleWhen).toBe('record.stage != "closed"');
    expect(section.label).toBe('Basic Info');
    expect(section.columns).toBe(2);
  });

  it('preserves spec FormField type/options/reference', () => {
    const bridge = new SpecBridge();
    const node = bridge.transformFormView(FULL_SPEC_FORM_VIEW);
    const [name, account] = (node.sections as any[])[0].fields;

    expect(name.type).toBe('text');
    // field-level visibleWhen lands in the renderer's visibleOn slot (ADR-0089)
    expect(name.visibleOn).toBe('record.active == true');
    expect(account.type).toBe('lookup');
    expect(account.reference).toBe('account');
    expect(account.options).toEqual([{ label: 'A', value: 'a' }]);
  });

  it('normalizes legacy groups into sections (groups-only spec now renders)', () => {
    const bridge = new SpecBridge();
    const node = bridge.transformFormView({
      type: 'simple',
      groups: [
        { label: 'Legacy Group', fields: [{ field: 'name' }] },
      ],
    });

    expect(node.groups).toBeUndefined();
    const sections = node.sections as any[];
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('Legacy Group');
    expect(sections[0].fields[0].name).toBe('name');
  });

  it('prefers sections over groups when both are present', () => {
    const bridge = new SpecBridge();
    const node = bridge.transformFormView({
      sections: [{ label: 'Canonical', fields: [] }],
      groups: [{ label: 'Legacy', fields: [] }],
    });

    const sections = node.sections as any[];
    expect(sections).toHaveLength(1);
    expect(sections[0].label).toBe('Canonical');
  });
});
