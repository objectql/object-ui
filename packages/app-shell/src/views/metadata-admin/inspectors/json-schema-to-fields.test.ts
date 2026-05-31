// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { jsonSchemaToFlowFields, humanizeKey } from './json-schema-to-fields';

/**
 * The exact JSON Schema the engine publishes for the Approval node config
 * (`z.toJSONSchema(ApprovalNodeConfigSchema, { io: 'input' })`), captured from
 * `GET /api/v1/automation/actions`. Drives the server-driven property form.
 */
const APPROVAL_CONFIG_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  properties: {
    approvers: {
      minItems: 1,
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['user', 'role', 'team', 'department', 'manager', 'field', 'queue'] },
          value: { description: 'User id / role / team / department / field / queue — per `type`', type: 'string' },
        },
        required: ['type'],
      },
      description: 'Allowed approvers for this node',
    },
    behavior: {
      default: 'first_response',
      description: 'How to combine multiple approvers',
      type: 'string',
      enum: ['first_response', 'unanimous'],
    },
    lockRecord: { default: true, description: 'Lock the record from editing while pending', type: 'boolean' },
    approvalStatusField: {
      description: 'Business-object field to mirror request status onto',
      type: 'string',
      xRef: { kind: 'object-field', objectSource: '$trigger' },
    },
    escalation: {
      description: 'Per-node SLA escalation',
      type: 'object',
      properties: {
        enabled: { default: false, description: 'Enable SLA-based escalation for this node', type: 'boolean' },
        timeoutHours: { type: 'number', minimum: 1, description: 'Hours before escalation triggers' },
        action: { default: 'notify', description: 'Action on escalation timeout', type: 'string', enum: ['reassign', 'auto_approve', 'auto_reject', 'notify'] },
        escalateTo: { description: 'User id, role, or manager level to escalate to', type: 'string' },
        notifySubmitter: { default: true, description: 'Notify the original submitter on escalation', type: 'boolean' },
      },
      required: ['timeoutHours'],
    },
  },
  required: ['approvers'],
};

describe('humanizeKey', () => {
  it('title-cases camelCase and snake_case', () => {
    expect(humanizeKey('approvalStatusField')).toBe('Approval Status Field');
    expect(humanizeKey('first_response')).toBe('First Response');
    expect(humanizeKey('lockRecord')).toBe('Lock Record');
  });
});

describe('jsonSchemaToFlowFields', () => {
  it('returns null for non-object schemas (caller falls back to hardcoded fields)', () => {
    expect(jsonSchemaToFlowFields(undefined)).toBeNull();
    expect(jsonSchemaToFlowFields({ type: 'string' })).toBeNull();
    expect(jsonSchemaToFlowFields({ type: 'object' })).toBeNull(); // no properties
  });

  it('preserves property order from the schema', () => {
    const fields = jsonSchemaToFlowFields(APPROVAL_CONFIG_SCHEMA)!;
    expect(fields.map((f) => f.id)).toEqual([
      'approvers',
      'behavior',
      'lockRecord',
      'approvalStatusField',
      // escalation flattens into config.escalation.* sub-fields
      'escalation.enabled',
      'escalation.timeoutHours',
      'escalation.action',
      'escalation.escalateTo',
      'escalation.notifySubmitter',
    ]);
  });

  it('maps an array-of-object into an objectList with columns', () => {
    const fields = jsonSchemaToFlowFields(APPROVAL_CONFIG_SCHEMA)!;
    const approvers = fields.find((f) => f.id === 'approvers')!;
    expect(approvers.kind).toBe('objectList');
    expect(approvers.path).toEqual(['config', 'approvers']);
    expect(approvers.label).toBe('Approvers');
    expect(approvers.help).toBe('Allowed approvers for this node');
    const colKeys = approvers.columns!.map((c) => c.key);
    expect(colKeys).toEqual(['type', 'value']);
    const typeCol = approvers.columns!.find((c) => c.key === 'type')!;
    expect(typeCol.kind).toBe('select');
    expect(typeCol.options!.map((o) => o.value)).toEqual(['user', 'role', 'team', 'department', 'manager', 'field', 'queue']);
    const valueCol = approvers.columns!.find((c) => c.key === 'value')!;
    expect(valueCol.kind).toBe('text');
    expect(valueCol.placeholder).toBe('User id / role / team / department / field / queue — per `type`');
  });

  it('maps an enum string into a select with humanized option labels + default', () => {
    const fields = jsonSchemaToFlowFields(APPROVAL_CONFIG_SCHEMA)!;
    const behavior = fields.find((f) => f.id === 'behavior')!;
    expect(behavior.kind).toBe('select');
    expect(behavior.defaultValue).toBe('first_response');
    expect(behavior.options).toEqual([
      { value: 'first_response', label: 'First Response' },
      { value: 'unanimous', label: 'Unanimous' },
    ]);
  });

  it('maps boolean scalars', () => {
    const fields = jsonSchemaToFlowFields(APPROVAL_CONFIG_SCHEMA)!;
    const lock = fields.find((f) => f.id === 'lockRecord')!;
    expect(lock.kind).toBe('boolean');
    expect(lock.defaultValue).toBe('true');
  });

  it('maps an xRef string into a reference field (picker, not free text)', () => {
    const fields = jsonSchemaToFlowFields(APPROVAL_CONFIG_SCHEMA)!;
    const statusField = fields.find((f) => f.id === 'approvalStatusField')!;
    expect(statusField.kind).toBe('reference');
    expect(statusField.path).toEqual(['config', 'approvalStatusField']);
    expect(statusField.ref).toEqual({ kind: 'object-field', objectSource: '$trigger' });
    // Description still flows through as help.
    expect(statusField.help).toBe('Business-object field to mirror request status onto');
  });

  it('falls back to plain text for a string with no xRef', () => {
    const fields = jsonSchemaToFlowFields({
      type: 'object',
      properties: { note: { type: 'string', description: 'free text' } },
    })!;
    const note = fields.find((f) => f.id === 'note')!;
    expect(note.kind).toBe('text');
    expect(note.ref).toBeUndefined();
  });

  it('ignores an xRef with an unknown kind (treats as plain text)', () => {
    const fields = jsonSchemaToFlowFields({
      type: 'object',
      properties: { weird: { type: 'string', xRef: { kind: 'bogus' } } },
    })!;
    const weird = fields.find((f) => f.id === 'weird')!;
    expect(weird.kind).toBe('text');
    expect(weird.ref).toBeUndefined();
  });

  it('flattens a nested object and gates siblings behind its enabled toggle', () => {
    const fields = jsonSchemaToFlowFields(APPROVAL_CONFIG_SCHEMA)!;
    const enabled = fields.find((f) => f.id === 'escalation.enabled')!;
    expect(enabled.kind).toBe('boolean');
    expect(enabled.path).toEqual(['config', 'escalation', 'enabled']);
    // The gate adopts the parent group's label, not "Enabled".
    expect(enabled.label).toBe('Escalation');
    expect(enabled.showWhen).toBeUndefined();

    const timeout = fields.find((f) => f.id === 'escalation.timeoutHours')!;
    expect(timeout.kind).toBe('number');
    expect(timeout.showWhen).toEqual({ field: 'escalation.enabled', equals: ['true'] });

    const action = fields.find((f) => f.id === 'escalation.action')!;
    expect(action.kind).toBe('select');
    expect(action.defaultValue).toBe('notify');
    expect(action.options!.map((o) => o.value)).toEqual(['reassign', 'auto_approve', 'auto_reject', 'notify']);
    expect(action.showWhen).toEqual({ field: 'escalation.enabled', equals: ['true'] });
  });
});
