/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Kanban conditional formatting accepts CEL (#1584).
 *
 * Since kanban card styling moved onto the shared CEL evaluator, the kanban
 * schema's type + zod contract must match the runtime: a rule may be the native
 * `{ field, operator, value }` shape OR the spec `{ condition, style }` CEL
 * shape. This locks both so the two can't drift back apart.
 */
import { describe, it, expect } from 'vitest';
import { ObjectKanbanSchema } from '../zod/index.zod';
import type { KanbanConditionalFormattingRule } from '../objectql';

describe('kanban conditionalFormatting — zod contract', () => {
  const base = { type: 'object-kanban', objectName: 'task', groupField: 'status' };

  it('accepts the native { field, operator, value } rule (back-compat)', () => {
    const parsed = ObjectKanbanSchema.safeParse({
      ...base,
      conditionalFormatting: [
        { field: 'priority', operator: 'equals', value: 'high', backgroundColor: '#fee2e2' },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts the spec { condition, style } CEL rule (new)', () => {
    const parsed = ObjectKanbanSchema.safeParse({
      ...base,
      conditionalFormatting: [
        { condition: "record.status == 'done'", style: { backgroundColor: '#e0ffe0' } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts a mix of both shapes in one rule list', () => {
    const parsed = ObjectKanbanSchema.safeParse({
      ...base,
      conditionalFormatting: [
        { condition: "record.blocked == true", style: { borderColor: 'red' } },
        { field: 'priority', operator: 'in', value: ['high', 'urgent'], backgroundColor: '#fef9c3' },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('kanban conditionalFormatting — type contract', () => {
  it('KanbanConditionalFormattingRule admits both shapes at compile time', () => {
    const native: KanbanConditionalFormattingRule = {
      field: 'priority',
      operator: 'equals',
      value: 'high',
      backgroundColor: '#fee2e2',
    };
    const cel: KanbanConditionalFormattingRule = {
      condition: "record.status == 'done'",
      style: { backgroundColor: '#e0ffe0' },
    };
    expect(native).toBeTruthy();
    expect(cel).toBeTruthy();
  });
});
