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
 * ── What the inventory found, i.e. step 2's worklist ─────────────────────────
 * `ActionDef` declares 34 keys, the spec's `ActionSchema` declares 36, and they
 * overlap on 17. The two halves of the difference are different problems:
 *
 * 18 keys the SPEC owns that `ActionDef` never declared — `ai`, `aria`,
 * `bodyExtra`, `bodyShape`, `bulkEnabled`, `component`, `icon`, `locations`,
 * `mode`, `objectName`, `order`, `recordIdField`, `recordIdParam`,
 * `requiredPermissions`, `requiresFeature`, `shortcut`, `variant`, `visible`.
 * These are authored today and reach readers through the index signature.
 * `ActionEngine` reads two of them (`visible` at the location filter, `locations`
 * at registration) through an `as any` cast — a cast that exists ONLY because the
 * field is undeclared, and that goes away when step 2 promotes them.
 *
 * 17 keys `ActionDef` declares that the spec does not own — `actionType`, `api`,
 * `chain`, `chainMode`, `close`, `condition`, `confirm`, `endpoint`, `modal`,
 * `navigate`, `onClick`, `onFailure`, `onSuccess`, `redirect`, `reload`, `toast`,
 * `actionParams`. Several are already marked legacy at their declaration. These
 * are objectui's own dialect and need the #4115 treatment: kept and documented as
 * deliberate, or retired — but not silently carried.
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
  'ai',
  'aria',
  'body',
  'bodyExtra',
  'bodyShape',
  'bulkEnabled',
  'component',
  'confirmText',
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

// Warn once per key, not once per execution: an unrecognized key usually sits in
// metadata driving a button that gets clicked repeatedly, and a warning that
// floods the console is a warning that gets muted.
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
    const memo = `retired:${key}`;
    if (warned.has(memo)) continue;
    warned.add(memo);
    console.warn(`[${where}] action "${String(name)}" carries the retired key \`${key}\`. ${RETIRED_ACTION_KEYS[key]}`);
  }

  if (unknown.length === 0) return;
  const memo = `unknown:${unknown.slice().sort().join(',')}`;
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
