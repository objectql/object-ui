/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * What an action is allowed to carry — objectstack#4075 step 1.
 *
 * `ActionDef` ends with `[key: string]: any`, so it accepts any key of any type.
 * Concretely (objectui#2990): deleting `ActionDef.execute` produced ZERO compile
 * errors even though the field had just been removed, and stale metadata still
 * authoring `execute: 'markDone'` type-checks today. The same deletion against
 * `@object-ui/types`' `ActionSchema` — which has no index signature — correctly
 * produced `TS2353` at the authoring site. One of the two readers can catch a
 * retired key; the other is structurally incapable.
 *
 * That asymmetry is the issue. An open key set on a DECLARED METADATA CONTRACT
 * is what lets a typo (`targt`, `exectue`) and a tombstoned key (`execute`) both
 * sail through to a runner that then silently does nothing — the #2169 "Mark
 * Done does nothing" shape.
 *
 * This module is step 1 of the staged narrowing: it makes the key set VISIBLE
 * and warns on anything outside it, without changing a single type. Nothing
 * breaks, and an invisible failure becomes an audible one. Steps 2 and 3 —
 * promoting the legitimate keys to explicit optional fields, then removing the
 * index signature — are what finally let `tsc` catch typos and retired keys.
 *
 * The lists are pinned by `__tests__/actionKeys.pin.test.ts`, which re-derives
 * each one from its actual source. A hand-maintained list that drifts from the
 * interface it mirrors would be the same "declared ≠ enforced" trap this whole
 * thread is about.
 *
 * ── What the inventory found, and what step 2 did with it ────────────────────
 * Step 1 found `ActionDef` declaring 34 keys against the spec `ActionSchema`'s
 * 36, overlapping on 17. The two halves of the difference were different
 * problems, and step 2 (objectstack#4075) treated them differently:
 *
 * 18 keys the SPEC owns that `ActionDef` never declared — `ai`, `aria`,
 * `bodyExtra`, `bodyShape`, `bulkEnabled`, `component`, `icon`, `locations`,
 * `mode`, `objectName`, `order`, `recordIdField`, `recordIdParam`,
 * `requiredPermissions`, `requiresFeature`, `shortcut`, `variant`, `visible`.
 * These are authored today and used to reach readers through the index
 * signature. **Step 2 promoted all 18 to explicit optional fields**, typed by
 * DERIVATION from `@objectstack/spec`'s `ActionInput` rather than by hand-copied
 * shapes. The `as any` casts `ActionEngine` needed to read `visible`,
 * `locations` and `requiredPermissions` are gone with them — those casts existed
 * only because the fields were undeclared.
 *
 * Two of the 18 landed as `undefined` rather than as usable types, which is the
 * correct outcome: spec 17 retired `shortcut` and `bulkEnabled` as `retiredKey()`
 * tombstones (`z.never()`), so deriving turns "authoring this is a parse
 * rejection" into a compile error at no cost. Hand-copying would have quietly
 * re-legitimized two dead keys — which is why the types are derived.
 *
 * 17 keys `ActionDef` declares that the spec does not own — `actionType`, `api`,
 * `chain`, `chainMode`, `close`, `condition`, `confirm`, `endpoint`, `modal`,
 * `navigate`, `onClick`, `onFailure`, `onSuccess`, `redirect`, `reload`, `toast`,
 * `actionParams`. Step 2 marked `@deprecated`, with the spec spelling to use
 * instead, ONLY the four the runner itself proves are aliases: `actionType` (→
 * `type`), `api` and `endpoint` (→ `target`; `executeAPI` resolves
 * `api || endpoint || target`), and `navigate` (→ flat `target`/`openIn`;
 * `executeNavigation` already falls back to them). The rest are runner mechanics
 * with no spec counterpart — chaining, toasts, post-execution reload/close — and
 * deprecating them toward a spelling that does not exist would be worse than
 * leaving them declared.
 *
 * Step 3 remains: remove the index signature, at which point `tsc` catches both
 * typos and retired keys and the dev-mode warning below can retire with it.
 */

/**
 * Every property `ActionDef` declares, in declaration order.
 *
 * Kept as data because TypeScript types do not survive to runtime — and
 * `keyof ActionDef` cannot substitute for this list: the index signature widens
 * it to `string | number`, which is precisely the problem being worked around.
 */
export const ACTION_DEF_KEYS = [
  'type',
  'actionType',
  'name',
  'label',
  'confirmText',
  'confirm',
  'condition',
  'disabled',
  'api',
  'endpoint',
  'method',
  'navigate',
  'onClick',
  'reload',
  'close',
  'redirect',
  'toast',
  'successMessage',
  'errorMessage',
  'refreshAfter',
  'undoable',
  'params',
  'actionParams',
  'resultDialog',
  'target',
  'body',
  'openIn',
  'modal',
  'chain',
  'chainMode',
  'onSuccess',
  'onFailure',
  'opensInNewTab',
  'newTabUrl',
  // Promoted out of the index signature by objectstack#4075 step 2 — the 18 keys
  // the spec owns that `ActionDef` had never declared. Their types are derived
  // from `@objectstack/spec`'s `ActionInput`, so this list is the only
  // hand-maintained half, and `actionKeys.pin.test.ts` re-derives it from the
  // interface's AST.
  'locations',
  'visible',
  'requiredPermissions',
  'icon',
  'variant',
  'order',
  'component',
  'objectName',
  'ai',
  'aria',
  'bodyExtra',
  'bodyShape',
  'mode',
  'recordIdField',
  'recordIdParam',
  'requiresFeature',
  'shortcut',
  'bulkEnabled',
] as const;

/**
 * Every property `@objectstack/spec`'s `ActionSchema` declares.
 *
 * `ActionDef` mirrors that schema, so a key the spec owns is legitimate even
 * when `ActionDef` has not declared it yet — several are read today only through
 * an `as any` cast (`visible` and `locations` in `ActionEngine`), which is the
 * cast this list exists to eventually retire.
 *
 * Pinned rather than read off the schema at runtime: the spec exports
 * `ActionSchema` as a lazy proxy that does not forward `.shape`, so resolving it
 * means walking zod internals (`_def.in` / `_def.innerType`). That is fine in a
 * test and wrong in shipped code — `@object-ui/types` made the same call for
 * `ActionComponent`. The pin test does the walk and fails the day this drifts.
 */
export const SPEC_ACTION_KEYS = [
  // The package-lock / provenance envelope, added to `ActionSchema` in spec
  // 17.0.0-rc.2. Not authorable action vocabulary — it is stamped on a record
  // that came from an installed package — but it IS declared by the schema, so
  // an action carrying it must not be reported as having unknown keys.
  '_lock',
  '_lockDocsUrl',
  '_lockReason',
  '_lockSource',
  '_packageId',
  '_packageVersion',
  '_provenance',
  'ai',
  'aria',
  'body',
  'bodyExtra',
  'bodyShape',
  'bulkEnabled',
  'component',
  'confirmText',
  // Added to `ActionSchema` in @objectstack/spec 17.0.0-rc.6. Listed here purely
  // because this array's contract is "every property the spec's `ActionSchema`
  // declares" — restating the spec, not adopting a feature. `ActionDef` does NOT
  // declare `description` and is not changed: whether the runner or any renderer
  // should READ it is a separate question, and `actionKeys.pin.test.ts`'s
  // `ActionDef` half stays green without it. What this entry buys is that an
  // action carrying a `description` is no longer reported as having an unknown
  // key, which is the only thing the inventory is consulted for.
  'description',
  'disabled',
  'errorMessage',
  'execute',
  'icon',
  'label',
  'locations',
  'method',
  'mode',
  'name',
  'newTabUrl',
  'objectName',
  'openIn',
  'opensInNewTab',
  'order',
  'params',
  'recordIdField',
  'recordIdParam',
  'refreshAfter',
  'requiredPermissions',
  'requiresFeature',
  'resultDialog',
  'shortcut',
  'successMessage',
  'target',
  'type',
  'undoable',
  'variant',
  'visible',
] as const;

/**
 * The `navigation` alias's own spelling of a target, read off the action itself
 * when no nested `navigate` object is present (`ActionRunner.executeNavigation`).
 *
 * A declared objectui-side dialect, not spec vocabulary: `replace` is documented
 * at its read site as "the one thing the `navigation` shape carries that
 * `ActionSchema` has no field for". Listing it here is what keeps it from being
 * silent dialect — the alternative is a warning that cries wolf on a shape the
 * runner itself supports.
 */
export const NAVIGATION_ALIAS_KEYS = ['to', 'external', 'newTab', 'replace'] as const;

/**
 * Keys the spec has TOMBSTONED: still present in `ActionSchema` so the parser can
 * reject them BY NAME with a rename prescription, rather than fail with a bare
 * "unrecognized key".
 *
 * Warned about separately from unknown keys, and more loudly: an unknown key is
 * probably a typo, while a retired key is metadata that used to work. That
 * distinction is why `executeScript` carries a runtime branch returning the
 * rename prescription — a branch that exists solely to compensate for the index
 * signature, and that can retire with it in step 3.
 */
export const RETIRED_ACTION_KEYS: Readonly<Record<string, string>> = {
  execute: '`execute` was removed in @objectstack/spec 17 (#3855) — rename the key to `target`. ' +
    'The value (a script name or expression) is unchanged. ' +
    'Run `os migrate meta --from 16` to rewrite it automatically.',
};

/** Every key an action may legitimately carry today. */
export const KNOWN_ACTION_KEYS: ReadonlySet<string> = new Set<string>([
  ...ACTION_DEF_KEYS,
  ...SPEC_ACTION_KEYS,
  ...NAVIGATION_ALIAS_KEYS,
].filter((key) => !(key in RETIRED_ACTION_KEYS)));

/** Split an action's own keys into the two things worth saying out loud. */
export function classifyActionKeys(action: object | null | undefined): {
  unknown: string[];
  retired: string[];
} {
  const unknown: string[] = [];
  const retired: string[] = [];
  if (!action || typeof action !== 'object') return { unknown, retired };
  for (const key of Object.keys(action)) {
    if (key in RETIRED_ACTION_KEYS) retired.push(key);
    else if (!KNOWN_ACTION_KEYS.has(key)) unknown.push(key);
  }
  return { unknown, retired };
}

// Warn once per (action, problem), not once per execution: an unrecognized key
// usually sits in metadata driving a button that gets clicked repeatedly, and a
// warning that floods the console is a warning that gets muted.
//
// Keyed by action name as well as by the keys, deliberately. Keying on the keys
// alone would report the FIRST action carrying `targt` and stay silent about
// every other one — sending the author to fix a button that was only the first
// symptom. The memo is bounded by the number of authored actions either way.
const warned = new Set<string>();

/** Reset the warn-once memo. Exported for tests. */
export function resetActionKeyWarnings(): void {
  warned.clear();
}

const isDev = (): boolean =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.NODE_ENV !==
  'production';

/**
 * Dev-mode only: name the keys an action carries that no reader will ever look
 * at. Non-breaking by construction — it changes no types and rejects nothing.
 *
 * Silently binding no handler is the #2169 "Mark Done does nothing" shape, and
 * the compiler cannot help while the index signature stands. Until it comes
 * down, this is the audible half.
 */
export function warnOnUnknownActionKeys(action: object | null | undefined, where = 'ActionRunner'): void {
  if (!isDev()) return;
  const { unknown, retired } = classifyActionKeys(action);
  const name = (action as { name?: unknown; type?: unknown })?.name ?? (action as { type?: unknown })?.type ?? '(unnamed)';

  for (const key of retired) {
    const memo = `retired:${String(name)}:${key}`;
    if (warned.has(memo)) continue;
    warned.add(memo);
    console.warn(`[${where}] action "${String(name)}" carries the retired key \`${key}\`. ${RETIRED_ACTION_KEYS[key]}`);
  }

  if (unknown.length === 0) return;
  const memo = `unknown:${String(name)}:${unknown.slice().sort().join(',')}`;
  if (warned.has(memo)) return;
  warned.add(memo);
  console.warn(
    `[${where}] action "${String(name)}" carries ${unknown.length === 1 ? 'a key' : 'keys'} no reader ` +
      `recognizes: \`${unknown.join('`, `')}\`. Nothing will read ${unknown.length === 1 ? 'it' : 'them'} — ` +
      'check for a typo, or promote the key to an explicit field on `ActionDef` ' +
      '(packages/core/src/actions/actionKeys.ts). Warned rather than rejected because `ActionDef` ' +
      'still carries `[key: string]: any`, so the compiler cannot see this (objectstack#4075).',
  );
}

/**
 * Keys a HOST stashes into an action's `params` for the runner's own plumbing,
 * rather than an author writing them there as a request payload.
 *
 * {@link warnOnDeprecatedObjectParams} has to tell "the author put the payload in
 * `params`" (the shape objectstack#5777 retires) apart from "a host stashed row
 * context there" (a shape the runner itself asks for, and that is not going
 * away). `DeclaredActionsBar` dispatches `params: { _rowRecord: record }`,
 * `RelatedRecordActionsBridge` does the same, and `ObjectGrid` adds
 * `_selectedIds`; the api handler lifts `recordId` out of the field values
 * before it updates. Warning on those would fire on nearly every declared-action
 * click and prescribe `bodyExtra`, which is the wrong home for all of them.
 *
 * The `_` prefix is the existing convention for the stash — `recordId` is its one
 * unprefixed member, so it is listed rather than inferred.
 */
const HOST_STASHED_PARAM_KEYS: ReadonlySet<string> = new Set(['recordId']);

const isAuthoredParamKey = (key: string): boolean =>
  !key.startsWith('_') && !HOST_STASHED_PARAM_KEYS.has(key);

/**
 * Does this action carry the DEPRECATED object-form `params` — a static request
 * payload written under the key that means "parameter definitions"?
 *
 * The discriminator is `Array.isArray` and the type guard is `api`, mirroring
 * `@objectstack/spec`'s `inline-action-api-params-to-body-extra` conversion
 * (ADR-0087 D2) key for key. Contract parity with the producer is the point: the
 * conversion rewrites exactly this shape to `bodyExtra` at load, so the runner
 * must recognize exactly the same shape as "the thing that got rewritten".
 *
 * The `api` guard is also what keeps the deprecation out of objectstack#6828's
 * territory — object-form `params` on a `type: 'url'` action is a THIRD meaning
 * (`interpolateTarget`'s `${param.X}` scope, `executeUrl`'s `params.newTab`) and
 * `bodyExtra` is NOT its replacement. Do not widen this guard without that
 * ruling.
 */
export function hasDeprecatedObjectParams(action: object | null | undefined): boolean {
  if (!action || typeof action !== 'object') return false;
  const { type, actionType, params } = action as {
    type?: unknown; actionType?: unknown; params?: unknown;
  };
  if ((type ?? actionType) !== 'api') return false;
  if (!params || typeof params !== 'object' || Array.isArray(params)) return false;
  return Object.keys(params).some(isAuthoredParamKey);
}

/**
 * Dev-mode only: name the object-form `params` that `@objectstack/spec` 17 already
 * refuses at the authoring door, and prescribe `bodyExtra`.
 *
 * This is the audible half of the compat window the maintainer's 2026-08-06
 * ruling on objectstack#5777 ordered (direction A — a separate key, no same-name
 * union): the runner keeps READING a non-array `params` as the static payload for
 * one version window, says so, and the arm is deleted at 18. The loud half lives
 * at the producer, where it belongs — spec's `params` field refuses the object
 * form outright with a message naming `bodyExtra`, and the ADR-0087 conversion
 * rewrites sources that still carry it. So a warning is the correct severity
 * HERE: by the time metadata reaches this runner the producer has already had its
 * say, and what is left to catch is a host composing an ActionDef in code.
 *
 * Dev-only and warn-once, matching {@link warnOnUnknownActionKeys} — a warning
 * that floods a production console is a warning that gets muted.
 */
export function warnOnDeprecatedObjectParams(action: object | null | undefined, where = 'ActionRunner'): void {
  if (!isDev()) return;
  if (!hasDeprecatedObjectParams(action)) return;
  const name = (action as { name?: unknown; type?: unknown })?.name ?? '(unnamed)';
  const memo = `deprecated-object-params:${String(name)}`;
  if (warned.has(memo)) return;
  warned.add(memo);
  console.warn(
    `[${where}] action "${String(name)}" carries a static request payload in \`params\`. ` +
      '`params` is the parameter DEFINITION array (fields collected from the user before the ' +
      'action runs), never a payload map — put the payload in `bodyExtra` instead ' +
      '(objectstack#5777). Still read as the payload for one version window; the arm is ' +
      'removed at 18. `bodyExtra` is merged LAST, so it overrides anything left here.',
  );
}
