/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Helpers for constraining an inline cell editor's choices to what the data
 * layer would actually accept — so the editor can't stage an edit the server
 * is bound to reject.
 */

/**
 * For a field governed by a `state_machine` validation, the set of values
 * reachable from `currentValue` — the current value itself plus its declared
 * allowed transitions.
 *
 * Returns `null` (= "don't constrain the options") when:
 *  - the object has no `state_machine` validation for the field, or
 *  - the current state isn't declared in the transition map.
 *
 * The second case mirrors the validation engine's lenient "allow" for
 * undeclared from-states (an unconstrained state simply isn't policed), so the
 * editor stays permissive exactly where the server would.
 */
export function stateMachineNextValues(
  objectSchema: unknown,
  fieldName: string,
  currentValue: unknown,
): Set<string> | null {
  const rules = (objectSchema as { validations?: unknown })?.validations;
  if (!Array.isArray(rules)) return null;
  const sm = rules.find(
    (r): r is { transitions: Record<string, string[]> } =>
      !!r &&
      typeof r === 'object' &&
      (r as { type?: unknown }).type === 'state_machine' &&
      (r as { field?: unknown }).field === fieldName &&
      !!(r as { transitions?: unknown }).transitions,
  );
  if (!sm) return null;
  const from = currentValue == null ? '' : String(currentValue);
  const allowed = sm.transitions[from];
  if (!Array.isArray(allowed)) return null; // undeclared from-state → unconstrained
  return new Set<string>([from, ...allowed.map((s) => String(s))]);
}
