// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { fieldsForNodeType, isFieldVisible } from './flow-node-config';

describe('start node trigger-field gating (#5)', () => {
  const fields = fieldsForNodeType('start');
  const objectName = fields.find((f) => f.id === 'objectName')!;
  const condition = fields.find((f) => f.id === 'condition')!;

  it('hides Object / Entry condition on a screen / manual start (no record trigger)', () => {
    const node = { id: 'start', type: 'start' }; // no config.triggerType
    expect(isFieldVisible(objectName, node, fields)).toBe(false);
    expect(isFieldVisible(condition, node, fields)).toBe(false);
  });

  it('shows them once a record trigger is picked', () => {
    const node = { id: 'start', type: 'start', config: { triggerType: 'record-after-update' } };
    expect(isFieldVisible(objectName, node, fields)).toBe(true);
    expect(isFieldVisible(condition, node, fields)).toBe(true);
  });

  it('shows for a schedule trigger too', () => {
    const node = { id: 'start', type: 'start', config: { triggerType: 'schedule' } };
    expect(isFieldVisible(objectName, node, fields)).toBe(true);
    expect(isFieldVisible(condition, node, fields)).toBe(true);
  });

  it('hides for a manual / autolaunched trigger', () => {
    const node = { id: 'start', type: 'start', config: { triggerType: 'manual' } };
    expect(isFieldVisible(objectName, node, fields)).toBe(false);
  });

  it('never hides a field that already holds a value (non-destructive)', () => {
    const node = { id: 'start', type: 'start', config: { objectName: 'crm_lead' } }; // no triggerType
    expect(isFieldVisible(objectName, node, fields)).toBe(true);
  });
});
