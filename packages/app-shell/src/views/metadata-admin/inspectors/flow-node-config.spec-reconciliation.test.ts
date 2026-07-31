// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * **Hand-written `FLOW_NODE_CONFIG` ↔ spec-published executor contracts**
 * (framework#4278).
 *
 * Five builtins deliberately publish no descriptor `configSchema` (framework
 * `config-schemas.test.ts`): the schema-driven online form cannot express
 * their editors — decision's virtual Target column, script's
 * actionType-conditional groups, the spec-structured sibling blocks. Their
 * Studio form is therefore this package's hand-written table, and until #4278
 * nothing reconciled that table against what the executors actually read.
 * `script` had drifted user-visibly: an `outputVariables` field nothing reads,
 * `sms` / `notification` options that fail every run, a no-op `code` default,
 * and no way to author the `function` / `inputs` / `outputVariable` path that
 * works.
 *
 * The machine-readable half now lives in `@objectstack/spec/automation`:
 * executor-derived config Zods for `script` / `subflow` / `decision`
 * (`schemaless-node-config.zod.ts`) plus the `FlowNodeSchema` sibling blocks
 * for `wait` / `connector_action` / `boundary_event`. This file is the
 * objectui half of the ledger — the same bidirectional key-set comparison
 * service-automation's `builtin-node-form-zod-ledger.test.ts` performs for the
 * descriptor-schema'd builtins, carried across the repo seam by the
 * `@objectstack/spec` dependency this package already has.
 *
 * The script/subflow/decision panels feature-detect their spec exports and
 * skip while the installed spec predates them (they arm themselves on the next
 * `@objectstack/spec` bump — see the version-alignment section of AGENTS.md);
 * the sibling-block panels run against every spec version this repo supports.
 */

import { describe, it, expect } from 'vitest';
import * as Automation from '@objectstack/spec/automation';
import { fieldsForNodeType, type FlowConfigField } from './flow-node-config';

// Feature-detected exports — absent on a spec that predates framework#4278.
// (Truthiness alone never resolves a lazySchema proxy.)
const spec = Automation as Record<string, unknown>;
const ScriptConfigSchema = spec.ScriptConfigSchema;
const SubflowConfigSchema = spec.SubflowConfigSchema;
const DecisionConfigSchema = spec.DecisionConfigSchema;
const DecisionConditionSchema = spec.DecisionConditionSchema;
const SCRIPT_BUILTIN_ACTION_TYPES = spec.SCRIPT_BUILTIN_ACTION_TYPES as readonly string[] | undefined;
const SCRIPT_INVOKE_FUNCTION_ACTION_TYPE = spec.SCRIPT_INVOKE_FUNCTION_ACTION_TYPE as string | undefined;

/**
 * Keys a Zod object schema accepts, read straight off `.shape`.
 *
 * `retiredKey()` tombstones are excluded: a retired key stays in the shape so
 * its rejection carries the upgrade prescription (spec `shared/retired-key.ts`
 * marks it with a `[REMOVED]` description), but it is NOT part of the
 * authorable contract — a form field writing one produces metadata the loader
 * rejects. Counting tombstones as contract keys would false-pass exactly that
 * drift (e.g. `waitEventConfig.timeoutMs` / `.onTimeout`, retired by
 * framework#4198 — this filter is what makes the `wait` panel fire on the spec
 * bump that carries their tombstones, until the form drops the two fields).
 *
 * That bump is a **17.0.0-rc refresh**, not the "spec 18" the tombstone text
 * itself names: changesets computes a pre-release train off the last
 * *published* major (`@objectstack/spec` latest is 16.1.0, `rc` is
 * 17.0.0-rc.0), so the retirement's `major` resolves to **17.0.0** — and
 * framework main carries the tombstones with `PROTOCOL_VERSION = '17.0.0'`.
 * The trigger is the next rc this repo installs, not a major that the current
 * release train cannot produce. Tracked in #3101.
 */
function zodKeys(schema: unknown): string[] {
  const shape = (schema as { shape?: Record<string, unknown> }).shape;
  expect(shape, 'expected a Zod object schema exposing .shape').toBeDefined();
  return Object.keys(shape ?? {})
    .filter((k) => {
      const description = (shape![k] as { description?: string } | undefined)?.description;
      return !(typeof description === 'string' && description.startsWith('[REMOVED]'));
    })
    .sort();
}

/** Unwrap `.optional()` / `.default()` wrappers down to the object schema. */
function unwrapped(schema: unknown): unknown {
  let cur = schema as { shape?: unknown; unwrap?: () => unknown } | undefined;
  for (let i = 0; cur && !cur.shape && typeof cur.unwrap === 'function' && i < 5; i++) {
    cur = cur.unwrap() as typeof cur;
  }
  return cur;
}

/** A field render-gated behind the never-matching `__legacy__` controller. */
function isLegacyGated(f: FlowConfigField): boolean {
  return f.showWhen?.field === '__legacy__';
}

/** Config keys the form OFFERS for new authoring (legacy render-only excluded). */
function offeredConfigKeys(type: string): string[] {
  return [...new Set(
    fieldsForNodeType(type)
      .filter((f) => f.path[0] === 'config' && !isLegacyGated(f))
      .map((f) => f.path[1]!),
  )].sort();
}

/**
 * Reconcile one node type's config-rooted form keys against its executor
 * contract. `renderOnly` names contract keys the form deliberately does NOT
 * offer for new authoring — each must still be present as a legacy-gated
 * field so stored metadata keeps rendering, and each needs its reason here.
 */
function reconcile(type: string, zod: unknown, renderOnly: Record<string, string> = {}) {
  const offered = offeredConfigKeys(type);
  const contract = zodKeys(zod);

  // Read by the executor, absent from the form ⇒ authorable only by hand —
  // the exact shape #4278 found for script's function/inputs/outputVariable.
  expect(
    contract.filter((k) => !offered.includes(k) && !(k in renderOnly)),
    `${type}: read by the executor but not offered by the designer form`,
  ).toEqual([]);

  // Offered by the form, never read by the executor ⇒ a Studio field that
  // does nothing — the #3528 / outputVariables shape.
  expect(
    offered.filter((k) => !contract.includes(k)),
    `${type}: offered by the designer form but never read by the executor`,
  ).toEqual([]);

  // Every render-only exemption must (a) be part of the executor contract and
  // (b) still render for stored metadata via a legacy-gated field.
  for (const key of Object.keys(renderOnly)) {
    expect(contract, `${type}: render-only exemption '${key}' must be a contract key`).toContain(key);
    const field = fieldsForNodeType(type).find((f) => f.path[0] === 'config' && f.path[1] === key);
    expect(field, `${type}: render-only key '${key}' must keep a (legacy-gated) field`).toBeDefined();
    expect(isLegacyGated(field!), `${type}: '${key}' must be legacy-gated, not offered`).toBe(true);
  }
}

describe.skipIf(!ScriptConfigSchema)('script form ↔ ScriptConfigSchema (framework#4278)', () => {
  it('offers exactly the executor-read keys; inline `script` stays render-only (a recognized no-op)', () => {
    reconcile('script', ScriptConfigSchema, {
      script: 'recognized but NOT executed by the built-in runtime (no server-side JS sandbox) — renders for stored nodes, steers authors to `function`',
    });
  });

  it('offers exactly the published action types: invoke_function + the built-in set', () => {
    const actionType = fieldsForNodeType('script').find((f) => f.id === 'actionType')!;
    expect(actionType.options!.map((o) => o.value).sort()).toEqual(
      [SCRIPT_INVOKE_FUNCTION_ACTION_TYPE!, ...SCRIPT_BUILTIN_ACTION_TYPES!].sort(),
    );
    // The default is the path that runs real logic, not the no-op.
    expect(actionType.defaultValue).toBe(SCRIPT_INVOKE_FUNCTION_ACTION_TYPE);
  });
});

describe.skipIf(!SubflowConfigSchema)('subflow form ↔ SubflowConfigSchema (framework#4278)', () => {
  it('offers exactly the executor-read keys', () => {
    reconcile('subflow', SubflowConfigSchema);
  });
});

describe.skipIf(!DecisionConfigSchema)('decision form ↔ DecisionConfigSchema (framework#4278)', () => {
  it('offers exactly the executor-read keys (legacy single `condition` stays render-only)', () => {
    // `condition` (singular) is legacy-gated in the form and deliberately NOT
    // in the contract: the decision executor never reads it — branching lives
    // in `conditions[]` or on edge conditions. Legacy-gated fields are already
    // excluded from `offered`, so plain reconciliation covers it.
    reconcile('decision', DecisionConfigSchema);
  });

  it('branch columns match DecisionConditionSchema one level down (Target is virtual)', () => {
    const conditions = fieldsForNodeType('decision').find((f) => f.id === 'conditions')!;
    const columnKeys = conditions.columns!.map((c) => c.key).sort();
    const contract = zodKeys(DecisionConditionSchema);
    // `target` is a VIRTUAL column — projected from / applied to the out-edges
    // by flow-decision-edges, never stored on the branch — so it is the one
    // legitimate column the stored-shape contract does not carry.
    expect(columnKeys.filter((k) => k !== 'target')).toEqual(contract);
    expect(columnKeys).toContain('target');
  });
});

describe('sibling-block forms ↔ FlowNodeSchema blocks (framework#4278 ratchet)', () => {
  // These blocks are published by every spec version this repo supports, so
  // no feature detection: the hand-written groups for wait / connector_action
  // / boundary_event must edit exactly the keys the spec block declares —
  // #4161 / #4210 verified them by hand once; this keeps them verified.
  const FlowNodeSchema = spec.FlowNodeSchema as { shape: Record<string, unknown> };

  const BLOCKS: ReadonlyArray<{ type: string; block: string }> = [
    { type: 'wait', block: 'waitEventConfig' },
    { type: 'connector_action', block: 'connectorConfig' },
    { type: 'boundary_event', block: 'boundaryConfig' },
  ];

  it.each(BLOCKS)('$type: the $block fields match the spec block exactly', ({ type, block }) => {
    const formKeys = [...new Set(
      fieldsForNodeType(type)
        .filter((f) => f.path[0] === block)
        .map((f) => f.path[1]!),
    )].sort();
    const blockKeys = zodKeys(unwrapped(FlowNodeSchema.shape[block]));

    expect(
      blockKeys.filter((k) => !formKeys.includes(k)),
      `${type}: declared by the spec block but absent from the designer form`,
    ).toEqual([]);
    expect(
      formKeys.filter((k) => !blockKeys.includes(k)),
      `${type}: edited by the designer form but not declared by the spec block`,
    ).toEqual([]);
  });
});
