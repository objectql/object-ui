/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { forwardRef, useContext, useMemo, useEffect, useReducer, useState, Component, type ForwardRefExoticComponent, type RefAttributes } from 'react';
import type { BaseSchema } from '@object-ui/types';
import {
  ComponentRegistry,
  ExpressionEvaluator,
  isObjectUIError,
  type ObjectUIError,
  ERROR_CODES,
  debugLog,
  debugTime,
  debugTimeEnd,
  DebugCollector,
  validateSchema,
  hasDeclaredPredicate,
  hasResponsiveStyles,
  scopeClassFor,
  compileScopedStyles,
} from '@object-ui/core';
import { SchemaRendererContext } from './context/SchemaRendererContext.js';
import { useRecordContext } from './context/RecordContext.js';
import { usePredicateScope } from './hooks/useExpression.js';
import { usePageVariables } from './hooks/usePageVariables.js';
import { resolveKeyedI18nLabel } from './utils/i18n.js';
import { reportUnevaluatedExpressions } from './utils/unevaluatedExpression.js';
import {
  reportUnresolvableVisibilityPredicate,
  reportAdapterOnlyDataPredicate,
} from './utils/visibilityDiagnostic.js';
import type { PredicateGateKind } from './utils/visibilityDiagnostic.js';

/**
 * Dev-mode schema validation.
 *
 * In development, every schema object is validated exactly once (deduped
 * via a WeakSet) using the canonical {@link validateSchema} from
 * `@object-ui/core`. Errors are reported via `console.warn` with the
 * offending JSON path, and the rendered host element gets a
 * `data-obj-schema-invalid` attribute so apps can opt into a visual cue
 * (e.g. red outline) via CSS.
 *
 * In production this is a no-op: the validation pass is skipped entirely
 * and `data-obj-schema-invalid` is never emitted.
 */
const __DEV__ = (() => {
  try {
    return (globalThis as any).process?.env?.NODE_ENV !== 'production';
  } catch {
    return true;
  }
})();

type _ValidationCacheEntry = { valid: boolean; messages: string[] };
const _validationCache: WeakMap<object, _ValidationCacheEntry> =
  typeof WeakMap !== 'undefined'
    ? new WeakMap()
    : ({ set() {}, get() { return undefined; }, has() { return false; } } as any);
const _warnedSchemas: WeakSet<object> =
  typeof WeakSet !== 'undefined' ? new WeakSet() : ({ add() {}, has() { return false; } } as any);

function validateSchemaOnce(schema: any): _ValidationCacheEntry {
  if (!__DEV__ || !schema || typeof schema !== 'object') {
    return { valid: true, messages: [] };
  }
  // Return cached result so re-renders (and the post-mount forceUpdate that
  // runs to pick up lazy plugin registrations) preserve the invalid flag.
  // Dedup of the console.warn is handled separately via _warnedSchemas.
  const cached = _validationCache.get(schema);
  if (cached) {
    return cached;
  }
  let entry: _ValidationCacheEntry = { valid: true, messages: [] };
  try {
    const result = validateSchema(schema);
    if (!result.valid) {
      const msgs = result.errors.map(e => `${e.path}: ${e.message}`);
      entry = { valid: false, messages: msgs };
      if (!_warnedSchemas.has(schema)) {
        _warnedSchemas.add(schema);
        console.warn(
          '[ObjectUI] Invalid schema detected:\n' + msgs.join('\n'),
          schema
        );
      }
    }
  } catch (err) {
    // Validator itself failed — surface but don't crash render.
    if (!_warnedSchemas.has(schema)) {
      _warnedSchemas.add(schema);
      console.warn('[ObjectUI] Schema validator threw:', err);
    }
  }
  _validationCache.set(schema, entry);
  return entry;
}

/**
 * What `evaluateCondition` accepts, read off the evaluator rather than
 * re-spelled here — a hand-copied union is the shape that drifts.
 */
type VisibilityPredicate = Parameters<ExpressionEvaluator['evaluateCondition']>[0];

/**
 * Extract AriaPropsSchema properties from a schema node and convert
 * them to standard HTML ARIA attributes.
 *
 * @objectstack/spec AriaPropsSchema defines:
 *   ariaLabel: string | I18nLabel (→ aria-label)
 *   ariaDescribedBy: string (→ aria-describedby)
 *   role: string (→ role)
 */
function resolveAriaProps(schema: Record<string, any>): Record<string, string | undefined> {
  const aria: Record<string, string | undefined> = {};
  if (schema.ariaLabel) {
    aria['aria-label'] = resolveKeyedI18nLabel(schema.ariaLabel);
  }
  if (schema.ariaDescribedBy) {
    aria['aria-describedby'] = schema.ariaDescribedBy;
  }
  if (schema.role) {
    aria['role'] = schema.role;
  }
  return aria;
}

/**
 * Keys the `properties` hoist deliberately refuses to copy onto the node — they
 * identify WHICH renderer to dispatch to, so an inner `properties.type` (e.g. a
 * tab's visual style `line` | `card` | `pill`) must never shadow the outer
 * component descriptor. See the hoist in the evaluation memo below.
 */
const HOIST_PROTECTED_KEYS = new Set(['type', 'id']);

/**
 * The legacy `props` bag, minus every key the canonical `properties` bag also
 * declares (objectui#5123).
 *
 * A node may spell its config bag `properties` (the spec spelling) or `props`
 * (the annotated legacy alias). A node that writes BOTH used to get a DIFFERENT
 * answer for the same key depending on which channel read it, and the two
 * channels' precedence was exactly OPPOSITE:
 *
 *   - config bag: `readProps()` in the `element:*` family merges
 *     `{ ...schema.props, ...schema.properties }` — `properties` wins.
 *   - React prop: `createElement` below spread `...componentProps` (which
 *     carries the hoisted `properties.*` values) and then
 *     `...(evaluatedSchema.props || {})` LAST, which overwrote them —
 *     `props` won.
 *
 * Measured on one render of one node carrying both:
 * `bagRead(properties.content)="FROM_PROPERTIES"` while
 * `reactPropRead(content)="FROM_PROPS"`. Which one reached the screen depended
 * only on whether the renderer happened to be in the `readProps()` family.
 *
 * Maintainer ruling 2026-08-18: **`properties` wins on BOTH channels — one
 * answer per key.** The config-bag order was already correct and is untouched;
 * this narrowing is the React-prop half. It restores the declared posture
 * (`props` is an annotated legacy alias) rather than changing it.
 *
 * Implemented by REMOVING the overlapping keys from the alias spread rather
 * than by re-spreading `properties` after it. That matters: `properties.*` is
 * already on the node via the hoist, so the values are in `componentProps`
 * having passed the metadata strip. Re-spreading the raw bag would push
 * stripped schema metadata back out as React props — exactly the regression
 * that made a spec-documented `dataSource` binding shadow the injected adapter
 * and break the component (objectstack#5576). Subtracting adds no key to the
 * outgoing bag; it only decides which of two co-present values a key carries.
 *
 * Scope, deliberately narrow — this only moves a reading where BOTH bags
 * declare the same key:
 *   - a key only `props` declares is untouched (the alias keeps working);
 *   - a key only `properties` declares is untouched (it already won);
 *   - `type`/`id` are skipped, because the hoist never copied a canonical value
 *     up for them, so dropping the alias would DELETE the prop rather than
 *     replace it;
 *   - a degenerate (non-object) `properties` is left alone — the hoist and
 *     `readProps()` both merely object-spread it, and there is no canonical bag
 *     to prefer.
 *
 * Adjacent but NOT decided here: objectui#4795's pending question ② (whether
 * the `properties` envelope is an official `ui:*` authoring channel at all).
 * This is a precedence rule between two co-present spellings and takes no
 * position on whether either should exist.
 */
function propsWithoutCanonicalKeys(
  propsBag: Record<string, any> | undefined,
  propertiesBag: unknown
): Record<string, any> {
  if (!propsBag) return {};
  // Only a real object bag can win a key. `typeof null === 'object'` is covered
  // by the truthiness check; arrays are excluded for the same reason the
  // evaluation guard excludes them — a degenerate `properties` must not have
  // its shape reinterpreted here.
  if (
    !propertiesBag ||
    typeof propertiesBag !== 'object' ||
    Array.isArray(propertiesBag)
  ) {
    return propsBag;
  }
  let narrowed: Record<string, any> | null = null;
  for (const key of Object.keys(propertiesBag)) {
    if (HOIST_PROTECTED_KEYS.has(key)) continue;
    if (!Object.prototype.hasOwnProperty.call(propsBag, key)) continue;
    // Copy lazily: the overwhelmingly common node declares one bag or neither,
    // and this runs on every render of every node.
    if (!narrowed) narrowed = { ...propsBag };
    delete narrowed[key];
  }
  return narrowed ?? propsBag;
}

/**
 * The visibility-chain keys, in the EXACT precedence order the `shouldHide`
 * IIFE in the evaluation memo consults them (objectui#5756).
 *
 * That chain is one sequence of `if (…) return …` — an early-return chain,
 * not independent checks — so only the FIRST key here found "declared" on a
 * node is ever the one that decides, and every lower-priority key is never
 * even asked. `SHOW` keys ask "is it `!== undefined`?" (their `true` means
 * *shown*, so "absent" already means shown and needs no narrower test);
 * `HIDE` keys ask {@link hasDeclaredPredicate} instead, because their `true`
 * means *hidden* and the wider `!== undefined` test would vanish a node for
 * `hidden: ''` (objectui#3955). See {@link winningVisibilityKey}.
 */
const VISIBILITY_SHOW_KEYS = ['visibleWhen', 'visible', 'visibleOn', 'visibility'] as const;
const VISIBILITY_HIDE_KEYS = ['hidden', 'hiddenOn'] as const;

/**
 * The six legs, as ONE closed type — so a seventh cannot be added to the chain
 * without also being classified below.
 */
type VisibilityChainKey =
  | (typeof VISIBILITY_SHOW_KEYS)[number]
  | (typeof VISIBILITY_HIDE_KEYS)[number];

/**
 * Which CONSEQUENCE the diagnostic should print for a faulting predicate on
 * this leg (objectui#6503).
 *
 * ## The defect this closes
 *
 * `evaluateCondition` answers an unevaluable predicate with `true` on every
 * path. On the four SHOW legs the chain negates that answer, so the node is
 * SHOWN and the reporter's "the gate did NOT bite" is true. On the two HIDE
 * legs the chain returns it UN-negated (see `shouldHide` below), so the same
 * `true` sets `_hidden` and this component returns `null`: the gate bit, and
 * bit harder than on either sibling gate — the node is not on screen at all.
 * Both were routed to `'visibility'`, so an author whose block VANISHED read a
 * line telling them the gate did not bite and went looking for a rendering bug
 * that does not exist. The polarity was documented in
 * `visibilityDiagnostic.ts` and printed anyway; this is the routing that makes
 * the documented split the one that is actually applied.
 *
 * ## Why derived from the two constants, when the reporter refuses to deduce
 *
 * `PredicateGateKind`'s docblock refuses to deduce the gate from `key` INSIDE
 * the reporter, and that refusal stands: the reporter is exported and called
 * from other packages, where an unheard-of spelling would silently inherit
 * some other gate's sentence. Here the caller IS the chain. The two arrays
 * above are the same declaration `shouldHide` and {@link winningVisibilityKey}
 * consult, and {@link VisibilityChainKey} closes the parameter over them, so
 * this is not a second table that can drift from the first — it is the same
 * one, read for a second question. It also removes the failure mode that
 * produced this card: a leg added to the chain and left with a consequence
 * sentence written about a different polarity is now a TYPE error here, not a
 * line of false console copy.
 *
 * The `disabled` / `disabledOn` gate is deliberately not reachable from this
 * function: those legs are not in the visibility chain and route through
 * `evaluateEnablementPredicate`, which states `'enablement'` at its own call
 * site.
 */
const visibilityGateKind = (key: VisibilityChainKey): PredicateGateKind =>
  (VISIBILITY_HIDE_KEYS as readonly string[]).includes(key) ? 'concealment' : 'visibility';

/**
 * Which ONE visibility key actually decides a node's fate, mirroring both the
 * `properties` hoist's precedence (same-named key: `properties.<key>`
 * overwrites a node-level `<key>`) and `shouldHide`'s early-return chain
 * (first-declared-wins across {@link VISIBILITY_SHOW_KEYS} then
 * {@link VISIBILITY_HIDE_KEYS}) — without waiting for either to run.
 *
 * ## Why this exists (objectui#5756)
 *
 * A `${…}` template written as `properties.visible` is evaluated — and
 * collapsed to a plain boolean — by the loop that runs BEFORE the hoist, in
 * the SAME render pass. By the time `shouldHide` runs, the predicate TEXT is
 * gone; there is nothing left to diagnose. Reaching it means asking "does
 * THIS properties key actually decide?" at the one point in the render where
 * the raw text still exists — which means asking the precedence question
 * EARLY, on values the hoist has not yet merged and `shouldHide` has not yet
 * consulted.
 *
 * ## Why the precedence question, and not just "is it in `properties`?"
 *
 * Without it, a `properties.visible` template that a co-declared `visibleWhen`
 * OUTRANKS (exactly `shouldHide`'s own early-return: `visibleWhen` short-
 * circuits before `visible` is ever reached) would be reported even though it
 * decides nothing — a false positive for a leg that never runs. Restricting
 * the report to the WINNING key mirrors what `shouldHide` already does for
 * every OTHER key spelling (objectui#5454's leg-3 reporter is only ever
 * invoked on the leg that is actually consulted, by construction of the same
 * early-return chain) rather than inventing a different posture for this one.
 *
 * ## Why `node.properties` must already be POST-evaluation here
 *
 * The caller runs this AFTER the `properties.*` evaluation loop (so
 * `node.properties.visible` may already be the collapsed boolean, not the raw
 * template) and BEFORE the hoist (so a plain node-level key, untouched by that
 * loop, is still exactly what `shouldHide` will see). That ordering is what
 * makes "declared" answered here agree bit-for-bit with what `shouldHide`
 * answers later — including the corner a naive PRE-evaluation read would get
 * wrong: a template that evaluates to a literal `undefined` (e.g.
 * `${data.missing}` read alone) is `!== undefined` on its RAW text but not on
 * its EVALUATED value, and `shouldHide` falls through to the next key for
 * exactly that reason. Reading pre-eval text here would call `visible` the
 * winner when the real chain does not.
 *
 * Read-only: decides nothing about visibility itself, only which key a
 * DIAGNOSTIC should look at.
 */
function winningVisibilityKey(node: Record<string, unknown>): VisibilityChainKey | undefined {
  const propertiesBag = node.properties;
  const hasPropertiesBag =
    propertiesBag != null && typeof propertiesBag === 'object' && !Array.isArray(propertiesBag);
  const effective = (key: string): unknown =>
    hasPropertiesBag && Object.prototype.hasOwnProperty.call(propertiesBag, key)
      ? (propertiesBag as Record<string, unknown>)[key]
      : node[key];
  for (const key of VISIBILITY_SHOW_KEYS) {
    if (effective(key) !== undefined) return key;
  }
  for (const key of VISIBILITY_HIDE_KEYS) {
    if (hasDeclaredPredicate(effective(key))) return key;
  }
  return undefined;
}

/**
 * The registry key that differs from `type` only in case, when there is one.
 *
 * objectui#5247 ruled Option C — keep lookup strict, make the failure teach.
 * Registry lookup stays exactly case-sensitive (`ComponentRegistry.get` is a
 * plain `Map.get`), so a node typed `Page` still MISSES `page` and still
 * renders the OBJUI-001 panel below. What changes is only what that panel
 * SAYS: when the miss is a case mismatch and nothing else, it names the
 * spelling that would have worked. Making `Page` resolve is the REJECTED
 * option B — it would legalise `PAGE` / `pAge` across docs, the designer,
 * `sdui-intrinsics.d.ts` and every registration site, permanently.
 *
 * The candidate set is read from the LIVE registry — `getKnownTypes()`, which
 * is loaded registrations plus pending `registerLazy` stubs — never from a
 * list typed alongside it. A hand-kept copy goes stale silently and then
 * confidently suggests a type nothing registers any more; objectui#5115
 * measured exactly that drift on the CLI's copy, in both directions at once.
 *
 * Case is the ONLY trigger the ruling grants. This is deliberately not an edit
 * distance: `pge` suggests nothing.
 *
 * `objectui check` emits the same clause from
 * `packages/cli/src/utils/known-type-case-suggestion.ts`. The two surfaces
 * cannot share one implementation because they cannot share a candidate SET:
 * the published CLI runs inside a USER's project and depends on neither
 * `@object-ui/core` nor the plugin packages that register most types, so it
 * answers from the generated `KNOWN_SCHEMA_TYPES` snapshot instead — the
 * measurement is in `scripts/regenerate-known-schema-types.mjs`. Keep the
 * emitted wording in step with that file; both are pinned by tests.
 */
function suggestTypeByCase(type: unknown): string | undefined {
  if (typeof type !== 'string' || type === '') return undefined;
  const wanted = type.toLowerCase();
  for (const candidate of ComponentRegistry.getKnownTypes()) {
    if (candidate !== type && candidate.toLowerCase() === wanted) return candidate;
  }
  return undefined;
}

/**
 * Per-component Error Boundary for SchemaRenderer.
 * Catches render errors in individual components, preventing one broken
 * component from crashing the entire page.
 */
interface SchemaErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SchemaErrorBoundary extends Component<
  { componentType?: string; children: React.ReactNode; resetKey?: any },
  SchemaErrorBoundaryState
> {
  state: SchemaErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): SchemaErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps: { componentType?: string; resetKey?: any }) {
    // Auto-recover when the upstream component identity or an explicit reset
    // key changes. This makes "Retry" implicit: as soon as the producer of
    // the schema fixes the offending value (e.g. user edits the date field
    // in view config), the broken widget re-mounts cleanly.
    if (
      this.state.hasError &&
      (prevProps.componentType !== this.props.componentType ||
        prevProps.resetKey !== this.props.resetKey)
    ) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const error = this.state.error;
      const isDev = (globalThis as any).process?.env?.NODE_ENV !== 'production';
      const objuiError = isObjectUIError(error) ? error as ObjectUIError : null;

      return (
        <div className="p-4 border border-orange-400 rounded bg-orange-50 text-orange-700 my-2" role="alert">
          <p className="font-medium">
            Component{this.props.componentType ? ` "${this.props.componentType}"` : ''} failed to render
          </p>
          <p className="text-sm mt-1">{error.message}</p>
          {isDev && objuiError?.code && (
            <p className="text-xs mt-1 text-orange-500">
              Error code: {objuiError.code}
              {objuiError.details?.suggestion ? (
                <span className="block mt-0.5">💡 {String(objuiError.details.suggestion)}</span>
              ) : null}
            </p>
          )}
          <button type="button"
            onClick={this.handleRetry}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Shared "no data source" fallback. MUST be a module constant: it feeds the
 * `evaluatedSchema` memo below, and a fresh `{}` per render defeats that memo
 * for every SchemaRenderer without a provider above it — re-cloning the schema
 * and re-running the ExpressionEvaluator on each render, and handing a new
 * schema identity to children that memoise on it. For a `kind:'react'` page
 * that identity IS the compile key, so the page was silently remounted and its
 * `useState` wiped (objectui#2954's latent hazard, made real by this line).
 */
const NO_DATA_SOURCE: Record<string, any> = {};

/**
 * The props `SchemaRenderer` DECLARES and reads itself (objectui#4548).
 *
 * ## Why `schema` is spelled as this union and not as a `SchemaNode`
 *
 * The repo carries two competing `SchemaNode` types: `@object-ui/core`'s
 * interface (which requires `type: string`) and `@object-ui/types`' union
 * (`BaseSchema | string | number | boolean | null | undefined`). This component
 * matched NEITHER. It declared core's — narrower than what it accepts, so every
 * caller holding the types union was wrong and could not be told — while its
 * runtime returns early for strings and nullish, which core's interface forbids.
 * The erasure below hid the mismatch completely: with props collapsed to an
 * index signature, `schema` resolved to `any` and no call site was ever checked.
 *
 * So the contract is STATED HERE, by this component, as what it actually
 * handles: an object schema, a bare string (rendered as text), or nothing at
 * all. `number` / `boolean` are deliberately excluded — the runtime tolerates
 * them defensively (see the primitive guard in the evaluation memo) but no
 * author should be invited to pass them. Reconciling the two repo-wide
 * `SchemaNode` spellings is a separate concern and deliberately not done here.
 */
export interface SchemaRendererProps {
  schema: BaseSchema | string | null | undefined;
}

/**
 * The open forwarding surface, named once so it reads as the decision it is.
 *
 * `SchemaRenderer` passes every prop it does not itself read straight through to
 * the component the schema names, which is resolved at RUNTIME from a
 * plugin-extensible registry — so the set of valid keys is not knowable here,
 * and `packages/react/README.md` documents callers relying on it. The `any` is
 * the point: this is a pass-through channel, not a typed prop.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see doc comment above: the forwarded value is opaque to this component by construction.
type ForwardedProps = Record<string, any>;

/**
 * The renderer loop.
 *
 * ## The explicit type annotation is the contract, and it is deliberate
 *
 * `forwardRef< T, P >` routes `P` through React's `PropsWithoutRef`:
 *
 *     Props extends any ? ('ref' extends keyof Props ? Omit< Props, 'ref' > : Props) : Props
 *
 * A string index signature on `P` puts `string` into `keyof Props`, so
 * `'ref' extends keyof Props` is ALWAYS true, the `Omit` branch always runs, and
 * `Omit` over a type carrying a string index signature keeps ONLY the index
 * signature. Every declared prop is erased — on both sides. This component used
 * to hand `forwardRef` a props type of `{ schema: SchemaNode } & Record< string,
 * any >`, so its own `schema` resolved to `any` at every one of the ~376 call
 * sites in this repo, and was not even REQUIRED: `< SchemaRenderer / >` with no
 * schema at all type-checked (objectui#4548, measured).
 *
 * The fix is NOT to close the surface. This is the renderer loop: it forwards
 * every prop it does not read to the component the schema names, resolved at
 * RUNTIME from a plugin-extensible `ComponentRegistry`. That forwarding is a
 * documented, load-bearing feature — `packages/react/README.md` shows
 * `< SchemaRenderer schema={formSchema} onSubmit={handleSubmit} / >`, and
 * `@object-ui/components`' form renderer consumes that `onSubmit` as a React
 * prop. A closed props type would state a FALSE contract and would force every
 * leaf plugin's props into this package to stay usable.
 *
 * So the two halves are separated deliberately:
 *
 *   * the `forwardRef` TYPE ARGUMENT is the honest `SchemaRendererProps`, with
 *     no index signature — nothing for `PropsWithoutRef` to collapse, so
 *     `schema` survives to the call site typed and required; and
 *   * the open forwarding surface is stated ONCE, here, in this export
 *     annotation. Because the annotation is applied to the already-built
 *     component, `PropsWithoutRef` never runs over it, so `Record< string, any >`
 *     widens the surface WITHOUT erasing anything.
 *
 * The repo-wide guard (`scripts/__tests__/forwardref-props-erasure.guard.test.ts`)
 * judges the TYPE ARGUMENT only, for exactly this reason: an index signature
 * there is an accidental eraser, whereas one here is a stated contract.
 */
export const SchemaRenderer: ForwardRefExoticComponent<
  SchemaRendererProps & ForwardedProps & RefAttributes<unknown>
> = forwardRef<unknown, SchemaRendererProps>(({ schema, ...props }: SchemaRendererProps & ForwardedProps, _ref) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = context?.dataSource || NO_DATA_SOURCE;
  // Ambient host scope (user / app / features), fed by app-shell's
  // ExpressionProvider. Threaded into `visible`/expression evaluation so
  // component predicates can gate on the signed-in user & deployment flags.
  const predicateScope = usePredicateScope();
  // The row the page is about, from `RecordContextProvider` (objectui#5454).
  //
  // `@objectstack/spec` has always DECLARED that a component node's
  // `visibleWhen` binds it — `page.zod.ts`: *"Binds `record`, `current_user`,
  // `page.<var>`"* — and until this change the evaluator below bound no
  // `record` at all, on any block, on any record page. A `record.*` predicate
  // therefore could not resolve; this surface is fail-soft, so it resolved to
  // SHOWN. That is not a gate that misfires, it is a gate that never gates:
  // both polarities of the same predicate returned the same verdict, measured
  // on `record:alert`, `record:path`, `page:card` and `element:text`.
  //
  // Bound as the `record` ROOT ONLY — the exact three roots the describe
  // promises, and nothing else:
  //
  //   * NOT as bare fields. `page:tabs`' item-level predicate spreads the row
  //     flat as well (`containers.tsx`), but that breadth is undeclared on
  //     both surfaces, and contract-first (AGENTS.md #0.1) says bind what the
  //     spec states rather than accrete a second de-facto spelling here.
  //   * NOT over `data`. `data` on this evaluator is the data-source ADAPTER
  //     from `SchemaRendererContext`, which is what `${data.total}` in a
  //     `properties` / `props` / `content` value resolves against — a
  //     documented, pinned binding. Overwriting it with the row would be a
  //     silent interpolation change nobody asked for.
  const recordContext = useRecordContext();
  const boundRecord = recordContext?.data;
  // Page-local state (PageSchema.variables), provided by PageVariablesProvider.
  // Exposed to predicates/bindings under `page.<var>` so an interactive element
  // (e.g. element:record_picker) writing a variable can drive another
  // component's `visible`/`visibility`. Empty object outside a Page.
  const { variables: pageVariables } = usePageVariables();

  // Re-render trigger when the global ComponentRegistry mutates (e.g. a
  // lazy-loaded plugin finishes registering its components).
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const unsubscribe = ComponentRegistry.subscribe(forceUpdate);
    // Recheck after mount: if the lazy plugin finished registering between
    // the first render and this effect (e.g. its module was already cached so
    // notify() fired synchronously before subscribe()), we'd otherwise stay
    // stuck on the "Loading…" fallback forever. A one-shot forceUpdate gives
    // the next render a fresh look at the registry.
    forceUpdate();
    return unsubscribe;
  }, []);
  const [lazyError, setLazyError] = useState<Error | null>(null);
  // Stable fallback id for scoping a styled node that didn't declare an `id`.
  const autoStyleId = React.useId();

  // Evaluate schema expressions against the data source
  const evaluatedSchema = useMemo(() => {
    // Nothing to evaluate unless the node is an OBJECT. `!schema` covers the
    // nullish/empty cases and `typeof !== 'object'` covers every primitive —
    // both return the value untouched for the render pass below to place.
    //
    // The `typeof` half is what used to be missing (objectui#4548): the guard
    // named `string` only, so a `number` or `true` fell through to the
    // `{ ...schema }` shallow copy on the next line, spread to an EMPTY object,
    // lost its `type`, and surfaced as the red "Unknown component type:
    // undefined" box — an accident of the spread, not a decision. The declared
    // props type now excludes those primitives outright; this guard is the
    // defence-in-depth behind it, and it is what makes the copy below provably
    // an object spread.
    if (!schema || typeof schema !== 'object') return schema;

    // `data` (record/datasource) plus the ambient host scope. `current_user`
    // is aliased to `user` so both `user.email` and `current_user.email`
    // resolve in component `visible`/`visibleOn` expressions. `page` exposes
    // page-local state so predicates can gate on `page.<var>` (e.g. a record
    // picker's selection toggling another component's visibility).
    //
    // `record` is written AFTER the ambient spread so a page's own row wins
    // over anything a host put in the scope — the same precedence
    // `usePredicateRecordContext` states for the `useCondition` tier. And it is
    // written CONDITIONALLY, for the other half of that same rule: no row binds
    // NOTHING rather than an empty object. `{ record: undefined }` would SHADOW
    // a `record` a host had legitimately supplied through the ambient scope
    // (how `action:group`'s dropdown leaf is driven), turning "this surface has
    // no row of its own" into "this surface's row is empty" — only the latter
    // is entitled to shadow.
    const evaluator = new ExpressionEvaluator({
      ...predicateScope,
      current_user: (predicateScope as any)?.user,
      ...(boundRecord && typeof boundRecord === 'object' && !Array.isArray(boundRecord)
        ? { record: boundRecord }
        : null),
      data: dataSource,
      page: pageVariables,
    });
    // Shallow copy
    const newSchema = { ...schema };

    /**
     * Evaluate ONE visibility predicate, and make an unresolvable one LOUD
     * (objectui#5454, leg 3 of the 2026-08-21 ruling).
     *
     * ## The verdict is byte-for-byte what it was — only the silence moved
     *
     * `evaluateCondition` answers an unresolvable predicate with `true`, on
     * every one of its three internal paths: the CEL envelope fails soft to its
     * `true` fallback, a bare expression that throws is caught and returns
     * `true`, and a `${…}` template that throws returns its own SOURCE TEXT,
     * which is a non-empty string and therefore truthy. Passing
     * `throwOnError: true` changes none of those verdicts — it only converts
     * "could not evaluate" from a value into a throw — so this helper returns
     * `true` from the catch and reproduces the old answer exactly. That is why
     * it is safe on the two NON-negated legs (`hidden` / `hiddenOn`) as well,
     * where the same `true` means HIDE rather than SHOW.
     *
     * ## Why it needed saying at all
     *
     * A fail-soft surface answers "this predicate is broken" and "this
     * predicate said yes" with the same word. On the negated legs that word is
     * SHOWN, so a `record.*` gate written before objectui#5454 bound the row
     * rendered its block unconditionally and looked exactly like a gate the
     * author had got right. One of the three paths was already loud — the CEL
     * envelope's `evalFieldPredicate` warns (objectstack#5149) — and the other
     * two were mute, so whether an author heard about their own typo depended
     * on which dialect they happened to write it in.
     *
     * Deduped per (node type, key, predicate source): a broken predicate is
     * re-evaluated on every render, and the point is one line, not a wall. The
     * key is the predicate SOURCE TEXT plus the gate it was authored on — never
     * the render and never the schema object — so the same broken predicate
     * rendered over two hundred rows reports once, and a SECOND distinct
     * predicate still reports (objectui#6038 pins both halves).
     *
     * ## Production is loud too, since objectui#6038
     *
     * It was `__DEV__`-only, and the maintainer's 2026-08-25 ruling retired
     * that silence: a gate that stops biting in production used to leave
     * nothing on the console for the bare-string dialect, so a class-1 defect
     * could sit live and undiscovered (measured in objectstack#11254). The
     * `__DEV__` gate below no longer decides WHETHER the fault is reported,
     * only HOW it is detected — see the two branches.
     *
     * ## Defined HERE, ahead of the `properties` evaluation loop below
     *
     * It used to sit just above `shouldHide`, its only caller. objectui#5756
     * added a second call site — inside the `properties` loop below, on the
     * raw (pre-evaluation) text of whichever key that loop is about to collapse
     * — so the definition moved up to be in scope for both. Nothing about the
     * function changed; `shouldHide` below still calls it exactly as before,
     * on the POST-evaluation, POST-hoist schema, for the real verdict.
     */
    const evaluateVisibilityPredicate = (
      raw: VisibilityPredicate,
      key: VisibilityChainKey,
    ): boolean => {
      // WHICH consequence this leg's fail-soft default earns (objectui#6503).
      // Computed once, used by both branches, so the production and the
      // development report cannot disagree about what the default DID.
      const gate = visibilityGateKind(key);
      // PRODUCTION STILL MAKES THE SINGLE CALL — it just no longer makes it
      // in silence (objectui#6038, maintainer ruling 2026-08-25, option B).
      //
      // `throwOnError` remains the DEV probe and remains too expensive to ship:
      // on the CEL branch `evaluateCelCondition` implements it by evaluating
      // TWICE (once with each fallback — a value that tracks the fallback both
      // times is a fault), and spec-parsed metadata normalizes `visibleWhen`
      // into a `{ dialect: 'cel' }` envelope, so that branch is the common one
      // in production. Paying for the probe here would double the engine calls
      // for every predicate of every node.
      //
      // `onFault` is the way out of that trade: the evaluator hands back the
      // reason at the point it ALREADY knows the predicate faulted, inside the
      // catch it already runs, so the fault becomes observable at ONE engine
      // call. The verdict is `evaluateCondition(raw)`'s, unchanged — this card
      // is observability only, and the fail-open semantics are not its to move.
      //
      // The reporter is the SAME one the dev branch below uses: same message,
      // same severity, same dedupe `Set`, same key. Production and development
      // now print the identical line for the identical fault, which is the
      // property the `__DEV__` gate used to cost us.
      if (!__DEV__) {
        return evaluator.evaluateCondition(raw, {
          onFault: (reason) =>
            // `'page-component'` stated rather than defaulted (objectui#6487):
            // this is the tier whose roots the spec declares for a node gate,
            // and saying so here is what keeps the advice paragraph a decision
            // this call site owns.
            reportUnresolvableVisibilityPredicate(
              newSchema.type,
              newSchema.id,
              key,
              raw,
              reason,
              'page-component',
              gate,
            ),
        });
      }
      try {
        const verdict = evaluator.evaluateCondition(raw, { throwOnError: true });
        // objectui#5687 — the NON-throwing half of the same silence, and it is
        // reachable ONLY here, on the branch where the predicate evaluated
        // cleanly. A `data.*` read the adapter cannot answer is not a fault the
        // evaluator can raise: `undefined == 'draft'` is a perfectly good
        // `false`. Verdict untouched — `verdict` is returned exactly as
        // computed, which is what keeps the ruling's "no verdict changes" true
        // by construction rather than by review.
        reportAdapterOnlyDataPredicate(newSchema.type, newSchema.id, key, raw, dataSource);
        return verdict;
      } catch (err) {
        reportUnresolvableVisibilityPredicate(
          newSchema.type,
          newSchema.id,
          key,
          raw,
          err,
          'page-component',
          gate,
        );
        // The historical fail-soft answer, unchanged — and identical to what
        // the production branch above returns for the same input, which is what
        // keeps the two branches one behaviour rather than two. See the
        // docblock: `true` is the value EVERY path of `evaluateCondition`
        // already returned for an unevaluable predicate.
        return true;
      }
    };

    /**
     * Evaluate ONE enablement predicate (`disabled` / `disabledOn`), and make an
     * unresolvable one LOUD (objectui#6445).
     *
     * ## Why this pair needed its own card at all
     *
     * Six legs of the visibility chain above route through
     * {@link evaluateVisibilityPredicate} and report. These two called
     * `evaluateCondition` BARE, so a faulting `disabled` predicate had never
     * been reported in any build, in any dialect that does not report on its
     * own — the only uninstrumented predicate pair left in this file.
     *
     * And it is the pair where the fail-soft default BITES. `evaluateCondition`
     * answers an unevaluable predicate with `true`; on the negated visibility
     * legs that means SHOWN, here it means GREYED OUT. The asymmetry this file
     * already records for objectui#3862/#3955 cuts the other way for the
     * console: "a greyed-out control is still on screen", so the user has a
     * symptom and the author has nothing to grep for. That is why the reporter
     * is handed a different consequence paragraph (`'enablement'`) rather than
     * the visibility copy, which states the opposite of what this gate did.
     *
     * ## The verdict is byte-for-byte what it was
     *
     * `evaluateCondition(raw)` with an `onFault` callback returns exactly what
     * `evaluateCondition(raw)` returned: `onFault` is invoked for its side
     * effect and its return value is ignored (objectui#6038's seam). Fail-soft
     * is PRESERVED deliberately — flipping it is a shipped-behaviour change on
     * a live surface and is not this card's to make.
     *
     * ## One engine call, both builds — no `__DEV__` split here
     *
     * The visibility helper keeps a `__DEV__` branch because its dev leg needs
     * a CLEANLY-evaluated verdict to run objectui#5687's adapter-only reporter
     * on. This gate reports faults only, so `onFault` alone covers both builds:
     * one engine call, one code path, and dev and production print the same
     * line by construction rather than by keeping two branches in step.
     *
     * objectui#5687's `reportAdapterOnlyDataPredicate` is deliberately NOT
     * called here. Its ruling (2026-08-22, option A) is scoped to the
     * visibility gate and its message text is written about one — "a constant
     * `false` hides the node on every row" is not what a constant does to a
     * `disabled` gate. Wiring it would need its own copy decision and its own
     * ruling; filed rather than smuggled in (objectui#6504).
     */
    const evaluateEnablementPredicate = (raw: VisibilityPredicate, key: string): boolean =>
      evaluator.evaluateCondition(raw, {
        onFault: (reason) =>
          reportUnresolvableVisibilityPredicate(
            newSchema.type,
            newSchema.id,
            key,
            raw,
            reason,
            // Stated, not defaulted, for both arguments (objectui#6487,
            // objectui#6445): this is the node tier, whose roots the spec
            // declares, and the gate whose safe default disables the control.
            'page-component',
            'enablement',
          ),
      });

    // Evaluate 'properties' — the SPEC spelling of a node's config bag, of
    // which `props` (evaluated below) is the legacy alias.
    //
    // objectui#4799: only `props` used to be evaluated here. Renderers in the
    // `element:*` namespace read their config out of `schema.properties` FIRST
    // (`readProps()` merges `{ ...schema.props, ...schema.properties }`), so a
    // node written the canonical way handed the renderer the RAW `${…}` source
    // and put it on screen verbatim, while the same node written with the
    // "legacy alias" evaluated correctly. Measured through a real render with
    // `dataSource: { total: 99 }`: `props: { content: '${data.total}' }` → `99`,
    // `properties: { content: '${data.total}' }` → `${data.total}`. That is the
    // inverse of contract-first (AGENTS.md #0.1) — the tolerant spelling was
    // fed and the canonical one starved — so the fix belongs HERE, at the one
    // producer of evaluated schema, not as a second read in each consumer.
    //
    // Order matters: this runs BEFORE the hoist block below, because that block
    // copies every `properties.*` value onto the node's top level (and those
    // copies are spread as React props at render). Evaluating first is what
    // makes one key mean one thing whether it is read as `schema.properties.x`,
    // as `schema.x`, or as the `x` prop. It also leaves the `content` leg below
    // idempotent: a value evaluated here no longer carries a `${…}`.
    //
    // Per-value and SHALLOW, matching the `props` branch exactly:
    // `evaluator.evaluate` returns every non-string untouched, so a nested
    // object/array value is passed through rather than walked (measured: an
    // `aria: { label: '${data.total}' }` nested under EITHER key renders the raw
    // source today). Deepening that is a separate decision and would have to be
    // taken for both spellings at once — not smuggled in on one side here.
    //
    // The guard is wider than the `props` branch's bare truthiness on purpose:
    // this value FEEDS the hoist, so re-shaping a degenerate `properties`
    // (a string, an array) via the object spread would propagate. Non-objects
    // skip evaluation and reach the hoist exactly as they do today.
    // Snapshotted BEFORE evaluation — objectui#5756's diagnostic below reads
    // the RAW (pre-collapse) text from this reference, since `newSchema.properties`
    // is about to be replaced with the evaluated copy.
    const rawPropertiesBag: Record<string, unknown> | undefined =
      newSchema.properties &&
      typeof newSchema.properties === 'object' &&
      !Array.isArray(newSchema.properties)
        ? (newSchema.properties as Record<string, unknown>)
        : undefined;

    if (rawPropertiesBag) {
      const newProperties: Record<string, any> = { ...rawPropertiesBag };
      for (const [key, val] of Object.entries(newProperties)) {
        newProperties[key] = evaluator.evaluate(val as any);
      }
      newSchema.properties = newProperties;
    }

    /**
     * objectui#5756 — the `${…}` HALF of the #5687/#5454 silence, reached at
     * the one point in this render where it still can be: BEFORE the hoist
     * (which would bury it under the node-level keys) and immediately AFTER
     * the loop above (so `newSchema.properties` already reflects which key
     * would win the SAME precedence `shouldHide` applies later — see
     * {@link winningVisibilityKey}).
     *
     * A `${…}`-spelled visibility predicate written inside `properties` is
     * evaluated — and collapsed to a plain boolean — by the loop directly
     * above, before `shouldHide` (and its #5454/#5687 reporter) ever sees it.
     * The bare-string spelling of the SAME gate (`properties: { visible:
     * "data.status == 'draft'" }`) is untouched by that loop (no `${` to
     * interpolate) and reaches `shouldHide` intact, where the existing
     * reporter already catches it — this block exists only to give the
     * template spelling the same fate, not a different one.
     *
     * ## What this does NOT do
     *
     * - **No verdict change.** This call's return value is discarded; the
     *   REAL verdict is still decided by `shouldHide` below, off the
     *   POST-evaluation, POST-hoist schema, exactly as before this card.
     * - **No new report shape.** It is the SAME `evaluateVisibilityPredicate`
     *   `shouldHide` calls — same two reporters, same dedupe `Set`, same
     *   `__DEV__` gate — called one render-step earlier, on the text this
     *   step is about to erase. There is nothing here to duplicate the LATER
     *   call: by the time `shouldHide` runs, this key's value is already the
     *   collapsed boolean, which carries no `data.` text for either reporter
     *   to match — so at most one of the two calls ever fires per predicate.
     * - **Only the WINNING key.** Gated on {@link winningVisibilityKey} so a
     *   `properties.visible` template that a co-declared `visibleWhen`
     *   outranks is not reported for deciding nothing (mirrors #5454's own
     *   leg semantics: its reporter is likewise only ever invoked on the leg
     *   `shouldHide` actually consults).
     * - **Only what would actually collapse.** A bare string (no `${`) is
     *   untouched by the loop above and is left for the existing gate-time
     *   report to catch, unchanged.
     */
    if (__DEV__) {
      const winningKey = winningVisibilityKey(newSchema);
      if (winningKey && rawPropertiesBag && Object.prototype.hasOwnProperty.call(rawPropertiesBag, winningKey)) {
        const rawWinningValue = rawPropertiesBag[winningKey];
        if (typeof rawWinningValue === 'string' && rawWinningValue.includes('${')) {
          // Diagnostic only — the boolean this returns is thrown away.
          evaluateVisibilityPredicate(rawWinningValue as VisibilityPredicate, winningKey);
        }
      }
    }

    // COMPAT: Hoist 'properties' up to schema level
    // This allows support for strict configs that wrap all props in 'properties'.
    // IMPORTANT: never let inner `properties.type` / `properties.id` shadow the
    // outer component descriptor — those identify which renderer to dispatch to
    // (e.g. 'page:tabs'), whereas inner `type` may be a renderer-specific prop
    // (e.g. tab visual style: 'line' | 'card' | 'pill'). Keep `properties`
    // intact on the schema so renderers can still read these collision-prone
    // keys via `schema.properties.<key>`.
    if (newSchema.properties) {
        const outerType = newSchema.type;
        const outerId = newSchema.id;
        const props = newSchema.properties;
        for (const [k, v] of Object.entries(props)) {
            if (k === 'type' || k === 'id') continue;
            newSchema[k] = v;
        }
        if (outerType !== undefined) newSchema.type = outerType;
        if (outerId !== undefined) newSchema.id = outerId;
        newSchema.properties = props;
    }

    // Evaluate 'content' (common in Text, Button)
    if (typeof newSchema.content === 'string') {
      newSchema.content = evaluator.evaluate(newSchema.content);
    }
    
    // Evaluate 'props'
    if (newSchema.props) {
      const newProps = { ...newSchema.props };
      for (const [key, val] of Object.entries(newProps)) {
        newProps[key] = evaluator.evaluate(val as any);
      }
      newSchema.props = newProps;
    }

    // Evaluate visibility: visibleWhen / visible / visibleOn / visibility / hidden / hiddenOn
    const shouldHide = (() => {
      // `visibleWhen` is the single canonical conditional-visibility predicate
      // across every layer since ADR-0089 (show-when-truthy), and it is the one
      // this shape DECLARES: `PageComponentSchema` is a closed object that
      // declares `visibleWhen` (+ the deprecated `visibility`) and REFUSES a
      // node-level `visible` outright, with the prescription "move it up one
      // level to the component node's own `visibleWhen` … inside `properties`
      // it is hoisted onto the node by the renderer but evaluated by nothing"
      // (`component.zod.ts`, COMPONENT_NODE_VISIBILITY_KEYS).
      //
      // It is tested FIRST — ahead of `visible` — since objectui#5454. The
      // hoist block above copies every `properties.*` value onto the node, so a
      // node carrying `properties.visible` arrived here with `schema.visible`
      // set, and the `visible` leg used to short-circuit before the DECLARED
      // node predicate was ever consulted. Measured on `record:alert`,
      // `record:path`, `page:card` and `element:text`: `properties.visible`
      // present and truthy made a co-declared `visibleWhen: false` a no-op, so
      // the one key the spec tells authors to write was the one key that could
      // be silently ignored. A declared node predicate now outranks a hoisted
      // renderer prop; when both resolve to "show", both still have to.
      if (newSchema.visibleWhen !== undefined) {
        return !evaluateVisibilityPredicate(newSchema.visibleWhen, 'visibleWhen');
      }
      // `visible` — objectui's own `BaseSchema` tier (`@object-ui/types`), and
      // the landing spot of a hoisted `properties.visible`. Kept ABOVE the two
      // deprecated aliases: they normalize into `visibleWhen` at parse, so a
      // spec-parsed page never reaches them, and re-ranking them would move
      // verdicts for raw metadata that objectui#5454 did not rule on.
      if (newSchema.visible !== undefined) {
        return !evaluateVisibilityPredicate(newSchema.visible, 'visible');
      }
      // @deprecated ADR-0089 → `visibleWhen`. Defensive read for raw /
      // un-normalized metadata reaching the renderer.
      if (newSchema.visibleOn !== undefined) {
        return !evaluateVisibilityPredicate(newSchema.visibleOn, 'visibleOn');
      }
      // @deprecated ADR-0089 → `visibleWhen` (was PageNodeSchema.visibility,
      // an ExpressionInput) — show-when-truthy, same semantics as `visibleOn`.
      if (newSchema.visibility !== undefined) {
        return !evaluateVisibilityPredicate(newSchema.visibility, 'visibility');
      }
      // Ask "is a `hidden` gate DECLARED?" — not "is the key present?"
      // (objectui#3955). These two legs are the only ones in this chain whose
      // verdict is NOT negated, so the evaluator's single default for "there is
      // nothing to evaluate" (`true`, meaning *visible/enabled*) arrives here
      // meaning HIDE: `hidden: ''` / `null` (`null !== undefined`) / a
      // whitespace-only string / the `{ dialect, source: '' }` envelope
      // `objectstack build` emits for an empty predicate each made the node
      // VANISH, on the generic path, for a value the metadata never used to say
      // anything. Harder to diagnose than its `disabled` twin below
      // (objectui#3862): a greyed-out control is still on screen, a node that
      // never rendered is indistinguishable from metadata that meant it.
      //
      // `hasDeclaredPredicate` is the repo's one definition of "declared"
      // (core's `evaluator/declaredPredicate.ts`) — a local `&& !== ''` here
      // would have been the Nth dialect of one question. The verdict still reads
      // the RAW value; only the gate in front of it narrowed. Not an
      // equivalence, and pinned as a behaviour change: an UNDECLARED `hidden` no
      // longer short-circuits, so a declared `hiddenOn` is finally consulted.
      if (hasDeclaredPredicate(newSchema.hidden)) {
        return evaluateVisibilityPredicate(newSchema.hidden, 'hidden');
      }
      if (hasDeclaredPredicate(newSchema.hiddenOn)) {
        return evaluateVisibilityPredicate(newSchema.hiddenOn, 'hiddenOn');
      }
      return false;
    })();

    if (shouldHide) {
      newSchema._hidden = true;
    }

    // Evaluate disabled: disabled / disabledOn
    //
    // Ask "is a `disabled` gate DECLARED?" — not "is the key present?"
    // (objectui#3862). `!== undefined` was the widest of the three spellings this
    // question used to have, and this is the key where breadth is not free: the
    // evaluation entry answers an empty predicate with `true`, meaning "no
    // condition → visible/enabled", and on `disabled` that `true` means GREYED
    // OUT. So `disabled: ''`, `disabled: null` (`null !== undefined`), a
    // whitespace-only string and the `{ dialect, source: '' }` envelope
    // `objectstack build` emits for an empty predicate each disabled the node —
    // on the GENERIC path, since this block runs for every schema type, and not
    // as an internal flag either: `_disabled` is forwarded below as a real
    // `disabled` prop.
    //
    // The `visible` / `visibleWhen` / `visibleOn` / `visibility` legs above keep
    // `!== undefined` deliberately: their `true` is NEGATED, so an empty predicate
    // already lands on "shown", which is what "no gate" means anyway, and
    // narrowing them would change ALIAS PRECEDENCE rather than fix anything. The
    // `hidden` / `hiddenOn` legs were the exception — not negated, so they carried
    // this same defect with the polarity that makes the node VANISH — and they now
    // read this same definition (objectui#3955).
    //
    // `hasDeclaredPredicate` is the one definition of "declared" (core's
    // `evaluator/declaredPredicate.ts`, objectui#3850's ruling — read there for
    // the scope), shared with the action renderers' `hasDeclaredVisibilityGate`
    // and `ActionRunner`'s execution gates. A local `&& !== ''` here would have
    // been a fourth dialect of one question, which is what objectui#3842 /
    // objectui#3849 spent two PRs merging away. The verdict still reads the RAW
    // value, exactly as before — only the gate in front of it narrowed. An
    // undeclared `disabled` now falls through to `disabledOn` instead of
    // short-circuiting on an empty predicate.
    //
    // Both legs route through `evaluateEnablementPredicate` (objectui#6445), so
    // a predicate that cannot be evaluated is reported instead of silently
    // greying the control out. The verdicts below are unchanged: that helper
    // returns `evaluateCondition`'s own answer, and an UNDECLARED gate never
    // reaches it at all — `hasDeclaredPredicate` still decides that, one line
    // earlier, which is what keeps the objectui#3862 empty-shape rows silent
    // as well as enabled.
    const isDisabled = (() => {
      if (hasDeclaredPredicate(newSchema.disabled)) {
        return evaluateEnablementPredicate(newSchema.disabled, 'disabled');
      }
      if (hasDeclaredPredicate(newSchema.disabledOn)) {
        return evaluateEnablementPredicate(newSchema.disabledOn, 'disabledOn');
      }
      return false;
    })();

    if (isDisabled) {
      newSchema._disabled = true;
    }

    return newSchema;
  }, [schema, dataSource, predicateScope, pageVariables, boundRecord]);

  /**
   * SDUI scoped styling (ADR-0065): a node's `responsiveStyles` compiles to
   * id-scoped CSS injected as a `<style>` tag, and a scope class is appended to
   * the node's className.
   *
   * ## Why this is a memo, and why it is HERE and not at its use site
   *
   * The scope-class branch rebuilds the schema object (`{ ...evaluatedSchema,
   * className: mergedClassName }`) so renderers that read `schema.className`
   * see the scope class. Unmemoised, that spread allocated a NEW object on
   * every render of this component — even when the `evaluatedSchema` memo
   * directly above it HELD — so every downstream renderer that memoises on
   * `[schema]` (e.g. `ObjectMap`'s `dataConfig` / `mapConfig`, and the whole
   * marker cascade below them) saw a fresh identity and re-ran (objectui#6270).
   * Only nodes taking this branch were affected: a plain node was handed
   * `evaluatedSchema` itself and was already stable.
   *
   * It is hoisted ABOVE the early returns below because it is a HOOK. Its use
   * site sits after `if (!evaluatedSchema) return null`, the `_hidden` return
   * and the unresolved-component returns, so a `useMemo` written there is a
   * CONDITIONAL hook: a node toggling hidden -> visible would call one more
   * hook than the previous render and React would throw "Rendered more hooks
   * than during the previous render". Hoisting is what makes the memo legal,
   * not a stylistic preference.
   *
   * `[evaluatedSchema, autoStyleId]` is the complete dependency set: every
   * value below is a pure function of the evaluated node (`className`, `id`,
   * `responsiveStyles`) and the `useId` fallback. `evaluatedSchema` is itself a
   * fresh object whenever anything it interpolates changes, so a genuinely
   * changed className, value or breakpoint still produces a NEW identity here —
   * memoising cannot make a live value go stale.
   *
   * Non-object / primitive nodes fall through untouched: the render pass below
   * returns them as text before any of this is read.
   */
  const scopedStyling = useMemo(() => {
    const node = evaluatedSchema;
    if (!node || typeof node !== 'object') {
      return { scopeClass: '', scopedCss: '', mergedClassName: undefined, schemaForComponent: node };
    }
    const responsiveStyles = (node as Record<string, unknown>).responsiveStyles;
    if (!hasResponsiveStyles(responsiveStyles)) {
      // No scope class: hand the component `evaluatedSchema` ITSELF, which the
      // memo above already keeps stable. Never a copy — a copy here would
      // reintroduce the same instability for every node in the tree.
      return {
        scopeClass: '',
        scopedCss: '',
        mergedClassName: node.className,
        schemaForComponent: node,
      };
    }
    const scopeClass = scopeClassFor(node.id ?? autoStyleId);
    const mergedClassName = [node.className, scopeClass].filter(Boolean).join(' ');
    return {
      scopeClass,
      scopedCss: compileScopedStyles(`.${scopeClass}`, responsiveStyles),
      mergedClassName,
      // Some renderers read `schema.className` directly (e.g. element:text)
      // while others read the `className` prop (e.g. flex/container). Set both
      // so the scope class lands regardless of which channel a renderer honours.
      schemaForComponent: { ...node, className: mergedClassName },
    };
  }, [evaluatedSchema, autoStyleId]);

  if (!evaluatedSchema) return null;
  // If schema is just a string, render it as text
  if (typeof evaluatedSchema === 'string') return <>{evaluatedSchema}</>;
  // Any other primitive that reached here renders as its text too
  // (objectui#4548). The declared props type does not admit `number` /
  // `boolean`, so this is unreachable from typed code and exists for untyped
  // callers and stored metadata; it replaces the empty-spread "Unknown
  // component type: undefined" box, which said nothing true about the input.
  if (typeof evaluatedSchema !== 'object') return <>{String(evaluatedSchema)}</>;
  // Handle visibility: if evaluated schema is hidden, render nothing.
  //
  // Reads AFTER the primitive narrowing above (objectui#4548) so the property
  // access is on a known object. Behaviour is unchanged: `_hidden` is only ever
  // set on the object copy built in the memo, so for a string or any other
  // primitive this test was always falsy and fell through to exactly the
  // branches that now precede it.
  if (evaluatedSchema._hidden) return null;

  // Dev-mode validation: log once per schema object, attach visual flag
  // when invalid. Production path returns { valid: true, messages: [] }
  // without doing any work.
  const _validation = __DEV__ ? validateSchemaOnce(schema) : { valid: true, messages: [] };

  debugLog('schema', 'Rendering schema node', { type: evaluatedSchema.type, id: evaluatedSchema.id });
  
  const Component = ComponentRegistry.get(evaluatedSchema.type);

  if (!Component) {
    // If a lazy loader is registered for this type, kick it off — the
    // registry will notify us via subscribe() once the plugin module's
    // top-level register() side-effects have run.
    if (!lazyError && ComponentRegistry.hasLazy(evaluatedSchema.type)) {
      const pending = ComponentRegistry.loadLazy(evaluatedSchema.type);
      if (pending) {
        pending.catch((err: unknown) => {
          setLazyError(err instanceof Error ? err : new Error(String(err)));
        });
        return (
          <div
            className="p-2 text-sm text-muted-foreground animate-pulse"
            role="status"
            aria-live="polite"
            data-lazy-loading={evaluatedSchema.type}
          >
            Loading <code>{evaluatedSchema.type}</code>…
          </div>
        );
      }
    }

    debugLog('schema', 'Component not found in registry', { type: evaluatedSchema.type });
    const errorInfo = ERROR_CODES['OBJUI-001'];
    // objectui#5247 — the lookup above still missed and this node still fails.
    // The suggestion only names the spelling that would have resolved.
    const caseSuggestion = suggestTypeByCase(evaluatedSchema.type);
    return (
      <div className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2" role="alert">
        <p className="font-medium">
          Unknown component type: <strong>{evaluatedSchema.type}</strong>
          {caseSuggestion !== undefined ? (
            <>
              {" — did you mean '"}
              <strong>{caseSuggestion}</strong>
              {"'?"}
            </>
          ) : null}
        </p>
        {lazyError && (
          <p className="text-xs mt-1">Failed to load plugin: {lazyError.message}</p>
        )}
        {(globalThis as any).process?.env?.NODE_ENV !== 'production' && (
          <p className="text-xs mt-1">💡 {errorInfo.suggestion} (OBJUI-001)</p>
        )}
        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(evaluatedSchema, null, 2)}</pre>
      </div>
    );
  }

  // Note: We don't forward the ref to the Component because components in the registry
  // may not support refs. The SchemaRenderer itself can still receive refs for its own use.
  
  // Extract schema metadata properties that should NOT be passed as React props
  const {
    type: _type,
    children: _children,
    body: _body,
    schema: _schema,
    visible: _visible,
    visibleWhen: _visibleWhen,
    visibleOn: _visibleOn,
    visibility: _visibility,
    hidden: _hidden,
    hiddenOn: _hiddenOn,
    disabled: _disabled,
    disabledOn: _disabledOn,
    // stripped: `PageComponentSchema.dataSource` is the spec's per-element data
    // BINDING (`{ object, view, filter, sort, limit }`) — schema metadata, like
    // `visibleWhen` above, not a visual prop. Renderers that consume it read
    // `schema.dataSource` (element:record_picker, list-view); it must not be
    // spread as a React prop, because several data-bound blocks take the
    // injected data-source ADAPTER under that very name. Spreading it shadowed
    // the adapter with a plain `{ object, view }` object, so the first
    // `dataSource.find(…)` threw `dataSource.find is not a function` and the
    // block reported "Couldn't load records" — writing the binding the spec
    // documents BROKE the component (objectstack#5576). An explicit React
    // `dataSource` prop is unaffected: it arrives via `...props`, spread last.
    dataSource: _dataSource,
    _hidden: __hidden,    // stripped: internal visibility flag
    _disabled: __disabled, // stripped: internal disabled flag
    responsiveStyles: _responsiveStyles, // stripped: compiled to scoped CSS, not a DOM prop
    ...componentProps
  } = evaluatedSchema;

  // Dev-build loud diagnostic (objectui#4795, Direction 3): an unevaluated
  // `${…}` about to be placed verbatim in front of a user.
  //
  // Sited HERE, after the metadata destructure, on purpose. `componentProps` is
  // precisely the set of values that leaves this component for the DOM — it is
  // spread as React props below, and the same values are what renderers read as
  // `schema.<key>`. Everything the destructure stripped is schema METADATA:
  // `visible` / `visibleWhen` / `hidden` / `disabled` / … hold raw predicate
  // SOURCE by design (they are evaluated as conditions, never placed), so
  // scanning before the strip would report every correctly-authored predicate
  // in the repo. The strip list is therefore the diagnostic's exclusion list,
  // for free and without a second copy of it to drift.
  //
  // Read-only: it reports what evaluation already produced and changes nothing
  // about what is rendered — no DOM attribute either, so no snapshot moves.
  if (__DEV__) {
    reportUnevaluatedExpressions(
      schema as object,
      evaluatedSchema.type,
      evaluatedSchema.id,
      componentProps,
      evaluatedSchema.properties,
      evaluatedSchema.props
    );
  }

  // SDUI scoped styling (ADR-0065) — computed in the memo hoisted above the
  // early returns; see the doc comment there for why it cannot live here.
  const { scopeClass, scopedCss, mergedClassName, schemaForComponent } = scopedStyling;

  // Extract AriaPropsSchema properties for accessibility
  const ariaProps = resolveAriaProps(evaluatedSchema);

  // Debug-mode enhancements: extra data attributes + perf tracking
  const isDebug = context?.debug || context?.debugFlags?.enabled;
  const debugAttrs: Record<string, string> = {};
  if (isDebug) {
    debugAttrs['data-debug-type'] = evaluatedSchema.type;
    if (evaluatedSchema.id) {
      debugAttrs['data-debug-id'] = evaluatedSchema.id;
    }
  }

  debugTime(`render:${evaluatedSchema.type}:${evaluatedSchema.id ?? 'anon'}`);
  const renderStart = isDebug ? performance.now() : 0;
  const rendered = (
    <SchemaErrorBoundary
      componentType={evaluatedSchema.type}
      resetKey={evaluatedSchema.id ?? null}
    >
      {scopedCss ? (
        <style data-os-scope={scopeClass} dangerouslySetInnerHTML={{ __html: scopedCss }} />
      ) : null}
      {React.createElement(Component, {
        schema: schemaForComponent,
        ...componentProps,  // Spread non-metadata schema properties as props
        // The legacy `props` alias still overrides plain top-level keys, but no
        // longer overrides the canonical `properties` bag: for a key BOTH bags
        // declare, `properties` wins here exactly as it already wins in
        // `readProps()`, so one key has one answer on both channels
        // (objectui#5123, maintainer ruling 2026-08-18).
        ...propsWithoutCanonicalKeys(evaluatedSchema.props, evaluatedSchema.properties),
        ...ariaProps,  // Inject ARIA attributes from AriaPropsSchema
        ...debugAttrs, // Debug-mode data attributes
        disabled: __disabled || undefined,
        className: mergedClassName,
        'data-obj-id': evaluatedSchema.id,
        'data-obj-type': evaluatedSchema.type,
        ...(__DEV__ && !_validation.valid ? { 'data-obj-schema-invalid': 'true' } : {}),
        ...props
      })}
    </SchemaErrorBoundary>
  );
  debugTimeEnd(`render:${evaluatedSchema.type}:${evaluatedSchema.id ?? 'anon'}`);

  // Report render perf to DebugCollector when debug mode is active
  if (isDebug && renderStart) {
    const durationMs = performance.now() - renderStart;
    DebugCollector.getInstance().addPerf({
      type: evaluatedSchema.type,
      id: evaluatedSchema.id,
      durationMs,
      timestamp: Date.now(),
    });
  }

  return rendered;
});
SchemaRenderer.displayName = 'SchemaRenderer';
