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
import { usePredicateScope } from './hooks/useExpression.js';
import { usePageVariables } from './hooks/usePageVariables.js';
import { resolveKeyedI18nLabel } from './utils/i18n.js';
import { reportUnevaluatedExpressions } from './utils/unevaluatedExpression.js';

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
    const evaluator = new ExpressionEvaluator({
      ...predicateScope,
      current_user: (predicateScope as any)?.user,
      data: dataSource,
      page: pageVariables,
    });
    // Shallow copy
    const newSchema = { ...schema };

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
    if (
      newSchema.properties &&
      typeof newSchema.properties === 'object' &&
      !Array.isArray(newSchema.properties)
    ) {
      const newProperties: Record<string, any> = { ...newSchema.properties };
      for (const [key, val] of Object.entries(newProperties)) {
        newProperties[key] = evaluator.evaluate(val as any);
      }
      newSchema.properties = newProperties;
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

    // Evaluate visibility: visible / visibleWhen / visibleOn / visibility / hidden / hiddenOn
    const shouldHide = (() => {
      if (newSchema.visible !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visible);
      }
      // `visibleWhen` is the single canonical conditional-visibility predicate
      // across every layer since ADR-0089 (show-when-truthy). The spec folds the
      // deprecated `visibleOn` (view) / `visibility` (page) aliases into it at
      // parse, so it is checked FIRST; the aliases below remain as a defensive
      // read for any raw / un-normalized metadata reaching the renderer.
      if (newSchema.visibleWhen !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visibleWhen);
      }
      // @deprecated ADR-0089 → `visibleWhen`.
      if (newSchema.visibleOn !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visibleOn);
      }
      // @deprecated ADR-0089 → `visibleWhen` (was PageNodeSchema.visibility,
      // an ExpressionInput) — show-when-truthy, same semantics as `visibleOn`.
      if (newSchema.visibility !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visibility);
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
        return evaluator.evaluateCondition(newSchema.hidden);
      }
      if (hasDeclaredPredicate(newSchema.hiddenOn)) {
        return evaluator.evaluateCondition(newSchema.hiddenOn);
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
    const isDisabled = (() => {
      if (hasDeclaredPredicate(newSchema.disabled)) {
        return evaluator.evaluateCondition(newSchema.disabled);
      }
      if (hasDeclaredPredicate(newSchema.disabledOn)) {
        return evaluator.evaluateCondition(newSchema.disabledOn);
      }
      return false;
    })();

    if (isDisabled) {
      newSchema._disabled = true;
    }

    return newSchema;
  }, [schema, dataSource, predicateScope, pageVariables]);

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
    return (
      <div className="p-4 border border-red-500 rounded text-red-500 bg-red-50 my-2" role="alert">
        <p className="font-medium">Unknown component type: <strong>{evaluatedSchema.type}</strong></p>
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

  // SDUI scoped styling (ADR-0065): a node's `responsiveStyles` compiles to
  // id-scoped CSS injected as a <style> tag, and a scope class is appended to
  // the node's className. Build-independent, collision-free, responsive-correct.
  const hasScopedStyles = hasResponsiveStyles(_responsiveStyles);
  const scopeClass = hasScopedStyles ? scopeClassFor(evaluatedSchema.id ?? autoStyleId) : '';
  const scopedCss = hasScopedStyles ? compileScopedStyles(`.${scopeClass}`, _responsiveStyles) : '';
  const mergedClassName = scopeClass
    ? [evaluatedSchema.className, scopeClass].filter(Boolean).join(' ')
    : evaluatedSchema.className;
  // Some renderers read `schema.className` directly (e.g. element:text) while
  // others read the `className` prop (e.g. flex/container). Set both so the
  // scope class lands regardless of which channel a renderer honours.
  const schemaForComponent = scopeClass
    ? { ...evaluatedSchema, className: mergedClassName }
    : evaluatedSchema;

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
