/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { resolveBulkActions, DERIVED_BULK_BATCH_SIZE } from '../resolveBulkActions';
import type { BulkActionDef } from '@object-ui/types';

const PUSH_DOWN = {
  name: 'push_down',
  label: '下推',
  type: 'api',
  target: '/api/v1/plans/push',
  bulkEnabled: true,
};

const AUTHORED: BulkActionDef = {
  name: 'archive',
  label: 'Archive',
  operation: 'update',
  patch: { archived: true },
};

describe('resolveBulkActions', () => {
  it('derives a def from an object action declaring bulkEnabled', () => {
    const { defs, unresolved } = resolveBulkActions({ objectActions: [PUSH_DOWN] });

    expect(unresolved).toEqual([]);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({
      name: 'push_down',
      label: '下推',
      operation: 'custom',
      actionDef: PUSH_DOWN,
      batchSize: DERIVED_BULK_BATCH_SIZE,
    });
  });

  it('leaves an action alone that never opted into bulk', () => {
    const rowOnly = { name: 'convert_lead', label: 'Convert', locations: ['list_item'] };
    const { defs, unresolved } = resolveBulkActions({ objectActions: [rowOnly] });

    expect(defs).toEqual([]);
    expect(unresolved).toEqual([]);
  });

  it('promotes a legacy name to its declared action even without bulkEnabled', () => {
    // Naming the action in the view's `bulkActions` IS the declaration of
    // intent at the view level — same rule the row fold applies to `rowActions`.
    const noFlag = { name: 'dispatch_job', label: '派工', type: 'api', target: '/x' };
    const { defs, unresolved } = resolveBulkActions({
      bulkActions: ['dispatch_job'],
      objectActions: [noFlag],
    });

    expect(unresolved).toEqual([]);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({ name: 'dispatch_job', operation: 'custom', actionDef: noFlag });
  });

  it('keeps a name that matches no declared action for by-name dispatch', () => {
    const { defs, unresolved } = resolveBulkActions({
      bulkActions: ['crm_only_handler'],
      objectActions: [PUSH_DOWN],
    });

    // push_down still derives from its own flag; the unknown name stays legacy.
    expect(defs.map(d => d.name)).toEqual(['push_down']);
    expect(unresolved).toEqual(['crm_only_handler']);
  });

  it('does not render a legacy name twice when it also derives from bulkEnabled', () => {
    const { defs, unresolved } = resolveBulkActions({
      bulkActions: ['push_down'],
      objectActions: [PUSH_DOWN],
    });

    expect(defs.map(d => d.name)).toEqual(['push_down']);
    expect(unresolved).toEqual([]);
  });

  it('lets an inline-authored def win over the object action of the same name', () => {
    const authoredPush: BulkActionDef = { name: 'push_down', operation: 'update', patch: { s: 1 } };
    const { defs } = resolveBulkActions({
      bulkActions: ['push_down'],
      bulkActionDefs: [authoredPush],
      objectActions: [PUSH_DOWN],
    });

    expect(defs).toEqual([authoredPush]);
  });

  it('drops a repeated legacy name', () => {
    const { defs, unresolved } = resolveBulkActions({
      bulkActions: ['dispatch_job', 'dispatch_job', 'ghost', 'ghost'],
      objectActions: [{ name: 'dispatch_job' }],
    });

    expect(defs).toHaveLength(1);
    expect(unresolved).toEqual(['ghost']);
  });

  it('returns the authored array by reference when nothing folds in', () => {
    const authored = [AUTHORED];
    const { defs } = resolveBulkActions({ bulkActionDefs: authored, objectActions: [] });

    expect(defs).toBe(authored);
  });

  it('maps spec param keys onto the dialog vocabulary', () => {
    const withParams = {
      name: 'reassign',
      bulkEnabled: true,
      params: [
        {
          field: 'owner',
          label: 'New owner',
          type: 'lookup',
          reference: 'sys_user',
          helpText: 'Who takes over',
          defaultValue: 'u1',
          required: true,
        },
        // Not authorable as a body key — no `name` and no `field` to fall back to.
        { label: 'orphan' },
      ],
    };
    const { defs } = resolveBulkActions({ objectActions: [withParams] });

    expect(defs[0].params).toEqual([
      expect.objectContaining({
        name: 'owner',
        label: 'New owner',
        type: 'lookup',
        object: 'sys_user',
        help: 'Who takes over',
        default: 'u1',
        required: true,
      }),
    ]);
  });

  it('drops a non-string I18nLabel rather than handing an object to the renderer', () => {
    const mapLabel = { name: 'push_down', bulkEnabled: true, label: { en: 'Push', 'zh-CN': '下推' } };
    const { defs } = resolveBulkActions({ objectActions: [mapLabel] });

    expect(defs[0].label).toBeUndefined();
  });

  it('carries confirm text, icon and visible from the action', () => {
    const rich = {
      name: 'push_down',
      bulkEnabled: true,
      icon: 'send',
      variant: 'danger',
      confirm: { message: '确认下推?' },
      visible: { dialect: 'cel', source: 'current_user.is_admin' },
    };
    const { defs } = resolveBulkActions({ objectActions: [rich] });

    expect(defs[0]).toMatchObject({
      icon: 'send',
      variant: 'danger',
      confirmText: '确认下推?',
      visible: { dialect: 'cel', source: 'current_user.is_admin' },
    });
  });

  it('drops an action variant the bulk bar cannot render', () => {
    const linkVariant = { name: 'push_down', bulkEnabled: true, variant: 'link' };
    const { defs } = resolveBulkActions({ objectActions: [linkVariant] });

    expect(defs[0].variant).toBeUndefined();
  });

  it('localizes derived labels through the supplied resolver', () => {
    const { defs } = resolveBulkActions({
      objectActions: [PUSH_DOWN],
      localizeLabel: (name, fallback) => (name === 'push_down' ? 'Push Down' : fallback),
    });

    expect(defs[0].label).toBe('Push Down');
  });
});
