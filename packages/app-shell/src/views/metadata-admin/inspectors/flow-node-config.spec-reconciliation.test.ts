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
// The Zod wrapper-key vocabulary — one list, read by the `.mjs` CI gates that
// walk the same internals (objectui#6923, ruled 2026-08-31).
import { ZOD_WRAPPER_KEYS } from '@object-ui/test-support';
import { fieldsForNodeType, type FlowConfigField } from './flow-node-config';

// Feature-detected exports — absent on a spec that predates framework#4278.
// (Truthiness alone never resolves a lazySchema proxy.)
const spec = Automation as Record<string, unknown>;
const ScriptConfigSchema = spec.ScriptConfigSchema;
const SubflowConfigSchema = spec.SubflowConfigSchema;
const DecisionConfigSchema = spec.DecisionConfigSchema;
const DecisionConditionSchema = spec.DecisionConditionSchema;
// Also the #4343 discriminator: the spec that converges `script` removes this
// constant along with the dispatch branches it described.
const SCRIPT_BUILTIN_ACTION_TYPES = spec.SCRIPT_BUILTIN_ACTION_TYPES as readonly string[] | undefined;

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

/**
 * The object shape behind a schema that may be wrapped in a pipe/effect.
 *
 * `unwrap()` above only walks `.optional()`/`.default()`; it cannot get past a
 * `ZodPipe` or a refinement wrapper, which expose neither `.shape` nor
 * `.unwrap`. `FlowNodeSchema` became one of those in @objectstack/spec
 * 17.0.0-rc.6, so the direct `FlowNodeSchema.shape` this file used to read went
 * `undefined` and every assertion below died on `Cannot read properties of
 * undefined`. The BLOCKS themselves are untouched — `connectorConfig`,
 * `waitEventConfig` and `boundaryConfig` are all still declared, verified by
 * walking the wrapper — so this is an access-path repair, not a changed
 * expectation.
 */
function objectShape(schema: unknown, depth = 0): Record<string, unknown> | null {
  const s = schema as Record<string, unknown> | undefined;
  if (!s || depth > 8) return null;
  if (s.shape) return s.shape as Record<string, unknown>;
  const def = (s._def ?? s.def) as Record<string, unknown> | undefined;
  if (!def) return null;
  if (def.shape) return def.shape as Record<string, unknown>;
  for (const key of ZOD_WRAPPER_KEYS) {
    const found = def[key] ? objectShape(def[key], depth + 1) : null;
    if (found) return found;
  }
  return null;
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

/**
 * The `script` panel spans a spec bump, so it asserts what is true on EITHER
 * side of it (framework#4343).
 *
 * The form has converged to the one thing the node does — call a registered
 * function — and the five dispatch keys it used to offer are legacy render-only
 * here. On the spec that retires them those keys leave the contract too
 * (`zodKeys` drops `[REMOVED]` tombstones), so the full bidirectional ledger
 * applies. On the spec still installed today they are live contract keys the
 * form no longer offers, and only the "offers nothing the executor ignores"
 * direction is meaningful — asserting the other one would demand the form keep
 * authoring branches that never delivered anything.
 *
 * `SCRIPT_BUILTIN_ACTION_TYPES` is the discriminator: framework#4343 removes it
 * along with the branches it described, so this arms itself on the bump.
 */
const SPEC_PREDATES_SCRIPT_CONVERGENCE = SCRIPT_BUILTIN_ACTION_TYPES !== undefined;

describe.skipIf(!ScriptConfigSchema)('script form ↔ ScriptConfigSchema (framework#4278, #4343)', () => {
  it.skipIf(SPEC_PREDATES_SCRIPT_CONVERGENCE)('offers exactly the executor-read keys', () => {
    reconcile('script', ScriptConfigSchema);
  });

  it.skipIf(!SPEC_PREDATES_SCRIPT_CONVERGENCE)(
    'offers nothing the executor ignores (pre-#4343 spec: the retired branches are still contract keys)',
    () => {
      const contract = zodKeys(ScriptConfigSchema);
      expect(
        offeredConfigKeys('script').filter((k) => !contract.includes(k)),
        'script: offered by the designer form but never read by the executor',
      ).toEqual([]);
    },
  );

  it('offers the function path and nothing else', () => {
    // The whole authorable surface, on either spec. `timeoutMs` is node-level,
    // so `offeredConfigKeys` (config-rooted only) does not carry it.
    expect(offeredConfigKeys('script')).toEqual(['function', 'inputs', 'outputVariable']);
  });

  it('keeps every retired key rendering for stored nodes, without offering it', () => {
    // Stored metadata is never hidden — the same rule that kept the inline
    // `script` body visible after #3099 dropped it from new authoring.
    for (const key of ['actionType', 'template', 'recipients', 'variables', 'script']) {
      const field = fieldsForNodeType('script').find((f) => f.path[0] === 'config' && f.path[1] === key);
      expect(field, `script: retired key '${key}' must keep a field so stored values render`).toBeDefined();
      expect(isLegacyGated(field!), `script: '${key}' must be legacy-gated, not offered`).toBe(true);
      expect(field!.help, `script: '${key}' must name its replacement`).toMatch(/[Rr]etired in spec 17/);
    }
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
  const flowNodeShape = objectShape(spec.FlowNodeSchema);

  it('the spec still exposes the FlowNode block shape this suite reads', () => {
    // Guards the assertions below from passing vacuously if the walk stops
    // resolving — the failure mode rc.6 produced, seen one level up.
    expect(flowNodeShape, 'could not resolve FlowNodeSchema’s object shape').toBeTruthy();
    expect(Object.keys(flowNodeShape ?? {})).toEqual(
      expect.arrayContaining(['waitEventConfig', 'connectorConfig', 'boundaryConfig']),
    );
  });

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
    const blockKeys = zodKeys(unwrapped(flowNodeShape?.[block]));

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

/**
 * **Declared defaults ↔ spec defaults — `escalation.notifySubmitter`** (#6794).
 *
 * Everything above is a KEY-set ledger: it proves the form edits exactly the
 * keys the executor reads. The default a field DECLARES is the other axis, and
 * it had drifted here — the hand-written table declared no `defaultValue` for
 * `escalation.notifySubmitter` while the installed `@objectstack/spec` defaults
 * the key to `true`, so the table stated the opposite of what an omitted key
 * does at runtime. Not cosmetic: `defaultValue` is what `isFieldVisible`
 * resolves an unset controller against, and it is what the ONLINE half of this
 * form already carries (a published `configSchema` sends `default: true`, which
 * `json-schema-to-fields` turns into `defaultValue: 'true'`) — so offline and
 * online disagreed about the same key.
 *
 * The expected value is READ FROM THE INSTALLED SPEC, never spelled out here:
 * objectui is the consumer, and a literal would make this file a second source
 * of truth for a published contract.
 *
 * ⛔ Deliberately scoped to `notifySubmitter` alone. The sibling controller
 * `escalation.enabled` is #6620 — held on hold behind a future
 * `@objectstack/spec` bump that flips ITS default; installed spec and table
 * agree on it today. Generalising this assertion across the block would arm
 * that card's tripwire here, discharging an on-hold card without its restart
 * condition being met.
 */
describe('approval escalation: declared default ↔ ApprovalEscalationSchema (#6794)', () => {
  const EscalationSchema = spec.ApprovalEscalationSchema as
    | { safeParse: (value: unknown) => { success: boolean; data?: Record<string, unknown> } }
    | undefined;

  /** What the spec applies when the key is omitted — the runtime's own answer. */
  function specDefaultFor(key: string): unknown {
    expect(
      EscalationSchema,
      '@objectstack/spec/automation must export ApprovalEscalationSchema',
    ).toBeDefined();
    // `timeoutHours` is the block's only required key.
    const parsed = EscalationSchema!.safeParse({ timeoutHours: 24 });
    expect(parsed.success, 'a minimal escalation block must parse').toBe(true);
    return parsed.data?.[key];
  }

  it('the spec still materialises notifySubmitter from an omitted key', () => {
    // Vacuity guard: were the key to stop being defaulted, the comparison below
    // would silently be a comparison against `undefined`.
    expect(typeof specDefaultFor('notifySubmitter')).toBe('boolean');
  });

  it('the form declares the default the spec applies', () => {
    const field = fieldsForNodeType('approval').find((f) => f.id === 'escalation.notifySubmitter');
    expect(field, 'the approval form must offer escalation.notifySubmitter').toBeDefined();
    // Defaults are strings in this table — booleans spelled 'true' / 'false',
    // the spelling `isFieldVisible` compares a controller against.
    expect(field!.defaultValue).toBe(String(specDefaultFor('notifySubmitter')));
  });
});
