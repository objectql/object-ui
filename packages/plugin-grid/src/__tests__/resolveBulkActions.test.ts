/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { resolveBulkActions, PROMOTED_BULK_BATCH_SIZE } from '../resolveBulkActions';
import type { BulkActionDef } from '@object-ui/types';

const PUSH_DOWN = {
  name: 'push_down',
  label: '下推',
  type: 'api',
  target: '/api/v1/plans/push',
};

const AUTHORED: BulkActionDef = {
  name: 'archive',
  label: 'Archive',
  operation: 'update',
  patch: { archived: true },
};

describe('resolveBulkActions', () => {
  it('promotes a named action to its declared def', () => {
    // Naming the action in the view's `bulkActions` is the ONLY declaration —
    // spec 17 retired `action.bulkEnabled` (framework#4054) and its tombstone
    // prescribes exactly this.
    const { defs, unresolved } = resolveBulkActions({
      bulkActions: ['push_down'],
      objectActions: [PUSH_DOWN],
    });

    expect(unresolved).toEqual([]);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({
      name: 'push_down',
      label: '下推',
      operation: 'custom',
      actionDef: PUSH_DOWN,
      batchSize: PROMOTED_BULK_BATCH_SIZE,
    });
  });

  it('surfaces nothing for an object action the view never names', () => {
    const rowOnly = { name: 'convert_lead', label: 'Convert', locations: ['list_item'] };
    const { defs, unresolved } = resolveBulkActions({ objectActions: [rowOnly, PUSH_DOWN] });

    expect(defs).toEqual([]);
    expect(unresolved).toEqual([]);
  });

  it('ignores a stale bulkEnabled flag on an object action', () => {
    // The key is a retiredKey() tombstone: `defineStack` hard-rejects a config
    // that sets it, so it must never be a path into the bar on its own.
    const stale = { name: 'push_down', label: '下推', bulkEnabled: true };
    const { defs, unresolved } = resolveBulkActions({ objectActions: [stale] });

    expect(defs).toEqual([]);
    expect(unresolved).toEqual([]);
  });

  it('keeps a name that matches no declared action for by-name dispatch', () => {
    const { defs, unresolved } = resolveBulkActions({
      bulkActions: ['push_down', 'crm_only_handler'],
      objectActions: [PUSH_DOWN],
    });

    expect(defs.map(d => d.name)).toEqual(['push_down']);
    expect(unresolved).toEqual(['crm_only_handler']);
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

  it('drops a repeated name', () => {
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
    const { defs } = resolveBulkActions({
      bulkActions: ['reassign'],
      objectActions: [withParams],
    });

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
    const mapLabel = { name: 'push_down', label: { en: 'Push', 'zh-CN': '下推' } };
    const { defs } = resolveBulkActions({
      bulkActions: ['push_down'],
      objectActions: [mapLabel],
    });

    expect(defs[0].label).toBeUndefined();
  });

  it('carries confirm text, icon and visible from the action', () => {
    const rich = {
      name: 'push_down',
      icon: 'send',
      variant: 'danger',
      confirm: { message: '确认下推?' },
      visible: { dialect: 'cel', source: 'current_user.is_admin' },
    };
    const { defs } = resolveBulkActions({
      bulkActions: ['push_down'],
      objectActions: [rich],
    });

    expect(defs[0]).toMatchObject({
      icon: 'send',
      variant: 'danger',
      confirmText: '确认下推?',
      visible: { dialect: 'cel', source: 'current_user.is_admin' },
    });
  });

  it('drops an action variant the bulk bar cannot render', () => {
    const linkVariant = { name: 'push_down', variant: 'link' };
    const { defs } = resolveBulkActions({
      bulkActions: ['push_down'],
      objectActions: [linkVariant],
    });

    expect(defs[0].variant).toBeUndefined();
  });

  it('localizes promoted labels through the supplied resolver', () => {
    const { defs } = resolveBulkActions({
      bulkActions: ['push_down'],
      objectActions: [PUSH_DOWN],
      localizeLabel: (name, fallback) => (name === 'push_down' ? 'Push Down' : fallback),
    });

    expect(defs[0].label).toBe('Push Down');
  });
});
