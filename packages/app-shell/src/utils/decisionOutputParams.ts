/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * decisionOutputParams — the ONE place an approval node's declared decision
 * outputs (framework#3447 P2) become action params.
 *
 * An approval node may declare `decisionOutputs: [{ key, label, type, multiple }]`;
 * the approver fills them in while deciding and the flow reads them back as
 * `vars.<nodeId>.<key>`. The key set is PER-REQUEST, so these can never be
 * static action params — every decision surface has to synthesize them from the
 * request row (`decision_output_defs`, or the bare `decision_outputs` key list
 * from a pre-typed backend).
 *
 * Both decision surfaces — the Approval Center's declared approve/reject
 * actions (`DeclaredActionsBar`) and the record header's Approve/Reject
 * (`RecordDetailView`) — go through here, so a typed output renders the SAME
 * picker in both places (objectui#2955).
 *
 * ## The `reference` key is load-bearing
 *
 * Params are handed to `resolveActionParams()` before the dialog sees them, and
 * its inline branch REBUILDS the param from a fixed key list: the picker target
 * is read from `reference` (the spec's `ActionParamSchema.reference` spelling)
 * and re-emitted as `referenceTo`. A param that arrives already spelled
 * `referenceTo` loses its target there, and `paramToField()` then degrades a
 * targetless picker to a raw record-id text box — which is exactly how the
 * Approval Center shipped "请填写记录 ID" text inputs where a `position` picker
 * belonged (objectui#2955). Emit `reference`, never `referenceTo`.
 */

import type { DecisionOutputDef as SpecDecisionOutputDef } from '@objectstack/spec/automation';

/**
 * An approval node's declared decision output, as the server surfaces it.
 *
 * A plain re-export of `@objectstack/spec/automation`'s `DecisionOutputDef` —
 * the spec models every key this module needs, so there is nothing left to
 * derive (objectstack#4562). The re-export is kept rather than pointing call
 * sites at the spec directly because this module is the ONE place decision
 * outputs become action params, and its consumers read the type from here.
 *
 * Two properties the re-export inherits are load-bearing here. `type` is the
 * spec's closed `'user' | 'department' | 'position' | 'team' | 'text'` enum,
 * so a typo'd kind fails to compile instead of silently degrading to a raw
 * record-id text box — the objectui#2955 failure this module exists to
 * prevent. `required` is now spec-modelled too (objectui#2955 shipped it
 * locally while the spec lagged; the spec adopted it in cd6b9f202, pinned at
 * the schema level by objectstack#4561): the server enforces it (`decide()`
 * rejects a blank required output before any write) and the dialog mirrors it
 * so the approver is stopped at the field rather than by a 400. It stays
 * optional — a backend predating the flag still parses.
 *
 * `__tests__/spec-symbol-parity.test.ts` pins the exclusion set at empty, so
 * a future local addition to this symbol cannot slip in undocumented.
 */
export type DecisionOutputDef = SpecDecisionOutputDef;

/** Param-name prefix the api handler folds back into the nested `outputs` body. */
export const DECISION_OUTPUT_PARAM_PREFIX = 'outputs.';

/**
 * Record kinds that ride a `lookup` param pointed at a system object. `user`
 * is absent on purpose — it has its own picker widget and needs no target.
 */
const OUTPUT_LOOKUP_OBJECTS: Record<string, string> = {
  department: 'sys_business_unit',
  position: 'sys_position',
  team: 'sys_team',
};

/**
 * Read the declared outputs off an approval request row. Prefers the typed
 * declarations; falls back to the bare key list an older backend sends.
 */
export function decisionOutputDefs(record: unknown): DecisionOutputDef[] {
  const row = record != null && typeof record === 'object' ? (record as Record<string, any>) : {};
  const typed = row.decision_output_defs;
  if (Array.isArray(typed) && typed.length > 0) {
    return (typed as DecisionOutputDef[]).filter((d) => d && d.key);
  }
  const bare = row.decision_outputs;
  if (Array.isArray(bare) && bare.length > 0) {
    return bare.map((k) => ({ key: String(k) })).filter((d) => d.key);
  }
  return [];
}

/** Title-case a bare output key for the label a pre-typed backend didn't send. */
function humanizeKey(key: string): string {
  return key
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Build the action params that collect an approval's decision outputs.
 *
 * Params are named `outputs.<key>`; `useConsoleActionRuntime`'s api handler
 * folds that dotted prefix back into the nested `outputs` object the decide
 * route expects. `t` localizes the help text — these params are synthesized,
 * so no `_actions.<action>.params.*` bundle entry can ever match them and the
 * literal we pass IS what renders (objectui#2762 P0-3).
 *
 * A `required` output is marked required on the APPROVE dialog only — pass
 * `{ decision: 'approve' }`. That mirrors the server, which enforces `required`
 * on approve and never on reject (the run leaves down the reject edge, where
 * nothing reads the outputs, so demanding routing data to say "no" would trap
 * the rejection). Marking it here is what turns the server's 400 into a
 * blocked Confirm button with the field flagged, instead of a round trip.
 */
export function decisionOutputParams(
  defs: DecisionOutputDef[],
  t: (key: string) => string,
  opts: { decision?: 'approve' | 'reject' } = {},
): Array<Record<string, unknown>> {
  return defs.filter((d) => d && d.key).map((d) => {
    const base = {
      name: `${DECISION_OUTPUT_PARAM_PREFIX}${d.key}`,
      label: d.label ?? humanizeKey(d.key),
      required: opts.decision === 'approve' && d.required === true,
    };
    if (d.type === 'user') {
      return {
        ...base,
        type: 'user',
        multiple: d.multiple === true,
        helpText: t('actions.decisionOutput.help'),
      };
    }
    const lookupObject = d.type ? OUTPUT_LOOKUP_OBJECTS[d.type] : undefined;
    if (lookupObject) {
      return {
        ...base,
        type: 'lookup',
        // NOT `referenceTo` — see the module note above.
        reference: lookupObject,
        multiple: d.multiple === true,
        helpText: t('actions.decisionOutput.help'),
      };
    }
    return {
      ...base,
      type: 'text',
      helpText: t('actions.decisionOutput.helpMultiValue'),
    };
  });
}

/**
 * Split a collected param-values map into the decide body's `outputs` object
 * and everything else. The Approval Center's decide actions are `type: 'api'`
 * and get this folding from the shared api handler; the record header decides
 * through `useRecordApprovals`, which posts the body itself — so it folds here.
 *
 * Blank values are dropped: an untouched optional output must not overwrite
 * `vars.<node>.<key>` with an empty string.
 */
export function foldDecisionOutputs(
  values: Record<string, any> | undefined,
): { rest: Record<string, any>; outputs?: Record<string, any> } {
  const rest: Record<string, any> = {};
  let outputs: Record<string, any> | undefined;
  for (const [k, v] of Object.entries(values ?? {})) {
    if (k.startsWith(DECISION_OUTPUT_PARAM_PREFIX) && k.length > DECISION_OUTPUT_PARAM_PREFIX.length) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      (outputs ??= {})[k.slice(DECISION_OUTPUT_PARAM_PREFIX.length)] = v;
      continue;
    }
    rest[k] = v;
  }
  return outputs ? { rest, outputs } : { rest };
}
