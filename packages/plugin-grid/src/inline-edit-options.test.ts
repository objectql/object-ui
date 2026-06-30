/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { stateMachineNextValues } from './inline-edit-options';

// Mirrors examples/app-showcase task.object.ts — the state machine that rejected
// done → in_review live (done only transitions to in_progress).
const taskSchema = {
  validations: [
    {
      type: 'state_machine',
      field: 'status',
      transitions: {
        backlog: ['todo'],
        todo: ['in_progress', 'backlog'],
        in_progress: ['in_review', 'todo'],
        in_review: ['done', 'in_progress'],
        done: ['in_progress'],
      },
    },
  ],
};

describe('stateMachineNextValues', () => {
  it('returns the current value plus its allowed transitions', () => {
    const r = stateMachineNextValues(taskSchema, 'status', 'in_review');
    expect(r).not.toBeNull();
    expect([...(r as Set<string>)].sort()).toEqual(['done', 'in_progress', 'in_review']);
  });

  it('constrains a near-terminal state to itself + its one valid move', () => {
    // The exact live bug: from `done` the only valid move is `in_progress`,
    // so `in_review` must NOT be offered.
    const r = stateMachineNextValues(taskSchema, 'status', 'done');
    expect([...(r as Set<string>)].sort()).toEqual(['done', 'in_progress']);
    expect((r as Set<string>).has('in_review')).toBe(false);
  });

  it('always includes the current value so it stays selectable', () => {
    const r = stateMachineNextValues(taskSchema, 'status', 'backlog');
    expect((r as Set<string>).has('backlog')).toBe(true);
    expect((r as Set<string>).has('todo')).toBe(true);
  });

  it('returns null (unconstrained) for a field with no state machine', () => {
    expect(stateMachineNextValues(taskSchema, 'priority', 'medium')).toBeNull();
  });

  it('returns null when the current state is undeclared (lenient, mirrors the engine)', () => {
    expect(stateMachineNextValues(taskSchema, 'status', 'archived')).toBeNull();
  });

  it('returns only the current value for a terminal state (no outgoing edges)', () => {
    const terminal = {
      validations: [{ type: 'state_machine', field: 'status', transitions: { done: [] } }],
    };
    const r = stateMachineNextValues(terminal, 'status', 'done');
    expect([...(r as Set<string>)]).toEqual(['done']);
  });

  it('returns null for missing/empty schema or validations', () => {
    expect(stateMachineNextValues(null, 'status', 'done')).toBeNull();
    expect(stateMachineNextValues({}, 'status', 'done')).toBeNull();
    expect(stateMachineNextValues({ validations: [] }, 'status', 'done')).toBeNull();
  });

  it('coerces non-string transition values to strings', () => {
    const numeric = {
      validations: [{ type: 'state_machine', field: 'level', transitions: { 1: [2, 3] } }],
    };
    const r = stateMachineNextValues(numeric, 'level', 1);
    expect([...(r as Set<string>)].sort()).toEqual(['1', '2', '3']);
  });
});
