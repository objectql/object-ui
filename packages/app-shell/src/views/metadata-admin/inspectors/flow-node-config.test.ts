// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { fieldsForNodeType, isFieldVisible, getFieldValue, configKeyOf } from './flow-node-config';

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

describe('scheduled trigger — canonical config.schedule (not flat config.cron)', () => {
  const fields = fieldsForNodeType('start');
  const expr = fields.find((f) => f.id === 'schedule.expression')!;

  it('replaces the dead flat `config.cron` field with a `config.schedule.expression` field', () => {
    // The old "Cron schedule" field wrote config.cron, which resolveTriggerBinding /
    // normalizeSchedule never read — so those scheduled flows silently never bound.
    expect(fields.find((f) => f.id === 'cron')).toBeUndefined();
    expect(expr).toBeDefined();
    expect(expr.path).toEqual(['config', 'schedule', 'expression']);
    expect(configKeyOf(expr)).toBe('schedule'); // owns the whole block (kept out of Advanced JSON)
  });

  it('reads the cron out of an object-shaped config.schedule (no "[object Object]")', () => {
    const node = {
      id: 'start',
      type: 'start',
      config: { triggerType: 'schedule', schedule: { type: 'cron', expression: '0 8 * * *' } },
    };
    expect(getFieldValue(node, expr)).toBe('0 8 * * *');
  });

  it('surfaces a legacy flat config.cron via fallbackPath (so it migrates on edit)', () => {
    const node = { id: 'start', type: 'start', config: { triggerType: 'schedule', cron: '0 7 * * *' } };
    expect(expr.fallbackPath).toEqual(['config', 'cron']);
    expect(getFieldValue(node, expr)).toBe('0 7 * * *');
  });

  it('shows for schedule and time_relative triggers, hides for record triggers', () => {
    const at = (tt: string) => ({ id: 'start', type: 'start', config: { triggerType: tt } });
    expect(isFieldVisible(expr, at('schedule'), fields)).toBe(true);
    expect(isFieldVisible(expr, at('time_relative'), fields)).toBe(true);
    expect(isFieldVisible(expr, at('record-after-update'), fields)).toBe(false);
  });

  it('drops the raw text field on config.schedule (which rendered an object as "[object Object]")', () => {
    expect(
      fields.find((f) => f.path.length === 2 && f.path[0] === 'config' && f.path[1] === 'schedule'),
    ).toBeUndefined();
  });
});

describe('time-relative trigger fields (#1874)', () => {
  const fields = fieldsForNodeType('start');
  const triggerType = fields.find((f) => f.id === 'triggerType')!;
  const trFields = [
    'timeRelative.object',
    'timeRelative.dateField',
    'timeRelative.withinDays',
    'timeRelative.offsetDays',
    'timeRelative.filter',
    'timeRelative.maxRecords',
  ].map((id) => fields.find((f) => f.id === id)!);

  it('offers a time_relative option on the trigger select', () => {
    expect(triggerType.options?.some((o) => o.value === 'time_relative')).toBe(true);
  });

  it('maps each descriptor field to the right kind under the nested config.timeRelative block', () => {
    const byId = Object.fromEntries(trFields.map((f) => [f.id, f]));
    expect(byId['timeRelative.object'].kind).toBe('reference');
    expect(byId['timeRelative.dateField'].kind).toBe('text');
    expect(byId['timeRelative.withinDays'].kind).toBe('number');
    // Offset days is a number[] — a numberList so the designer emits numbers, not
    // strings (the backend schema is strict `z.array(z.number())`).
    expect(byId['timeRelative.offsetDays'].kind).toBe('numberList');
    expect(byId['timeRelative.filter'].kind).toBe('keyValue');
    expect(byId['timeRelative.maxRecords'].kind).toBe('number');
  });

  it('shows the descriptor fields only for a time_relative trigger', () => {
    const trNode = { id: 'start', type: 'start', config: { triggerType: 'time_relative' } };
    const schedNode = { id: 'start', type: 'start', config: { triggerType: 'schedule' } };
    for (const f of trFields) {
      expect(isFieldVisible(f, trNode, fields)).toBe(true);
      expect(isFieldVisible(f, schedNode, fields)).toBe(false);
    }
  });

  it('claims the whole config.timeRelative block so it never leaks to Advanced JSON', () => {
    for (const f of trFields) expect(configKeyOf(f)).toBe('timeRelative');
  });
});

describe('approval node config (ADR-0044)', () => {
  const fields = fieldsForNodeType('approval');

  it('surfaces maxRevisions as a number field (offline / fallback parity with the server schema)', () => {
    const maxRevisions = fields.find((f) => f.id === 'maxRevisions');
    expect(maxRevisions).toBeDefined();
    expect(maxRevisions!.kind).toBe('number');
    expect(maxRevisions!.path).toEqual(['config', 'maxRevisions']);
    // Always visible (no showWhen gating) so the guard is discoverable.
    expect(isFieldVisible(maxRevisions!, { id: 'a', type: 'approval' }, fields)).toBe(true);
  });
});


describe('wait node loose-config fallback (ADR-0044 showcase parity)', () => {
  const fields = fieldsForNodeType('wait');
  const eventType = fields.find((f) => f.id === 'waitEventConfig.eventType')!;
  const signalName = fields.find((f) => f.id === 'waitEventConfig.signalName')!;

  it('reads the canonical waitEventConfig shape', () => {
    const node = { id: 'w', type: 'wait', waitEventConfig: { eventType: 'signal', signalName: 'x' } };
    expect(getFieldValue(node, eventType)).toBe('signal');
    expect(getFieldValue(node, signalName)).toBe('x');
  });

  it('falls back to a loose config shape the engine also accepts', () => {
    // showcase_budget_approval authors the wait node as `config: { eventType, signalName }`.
    const node = { id: 'w', type: 'wait', config: { eventType: 'signal', signalName: 'budget_revision' } };
    expect(getFieldValue(node, eventType)).toBe('signal');
    expect(getFieldValue(node, signalName)).toBe('budget_revision');
    // The dependent field reveals because its controller resolves via the fallback.
    expect(isFieldVisible(signalName, node, fields)).toBe(true);
  });

  it('prefers the canonical path when both shapes are present', () => {
    const node = { id: 'w', type: 'wait', waitEventConfig: { eventType: 'timer' }, config: { eventType: 'signal' } };
    expect(getFieldValue(node, eventType)).toBe('timer');
  });
});
