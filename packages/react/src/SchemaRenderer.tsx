/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { forwardRef, useContext, useMemo, useEffect, useReducer, useState, Component } from 'react';
import {
  SchemaNode,
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
} from '@object-ui/core';
import { SchemaRendererContext } from './context/SchemaRendererContext';
import { usePredicateScope } from './hooks/useExpression';
import { resolveI18nLabel } from './utils/i18n';

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
        // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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
    aria['aria-label'] = resolveI18nLabel(schema.ariaLabel);
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
          <button
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

export const SchemaRenderer = forwardRef<any, { schema: SchemaNode } & Record<string, any>>(({ schema, ...props }, _ref) => {
  const context = useContext(SchemaRendererContext);
  const dataSource = context?.dataSource || {};
  // Ambient host scope (user / app / features), fed by app-shell's
  // ExpressionProvider. Threaded into `visible`/expression evaluation so
  // component predicates can gate on the signed-in user & deployment flags.
  const predicateScope = usePredicateScope();

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

  // Evaluate schema expressions against the data source
  const evaluatedSchema = useMemo(() => {
    if (!schema || typeof schema === 'string') return schema;

    // `data` (record/datasource) plus the ambient host scope. `current_user`
    // is aliased to `user` so both `user.email` and `current_user.email`
    // resolve in component `visible`/`visibleOn` expressions.
    const evaluator = new ExpressionEvaluator({
      ...predicateScope,
      current_user: (predicateScope as any)?.user,
      data: dataSource,
    });
    // Shallow copy
    const newSchema = { ...schema };

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

    // Evaluate visibility: visible / visibleOn / hidden / hiddenOn
    const shouldHide = (() => {
      if (newSchema.visible !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visible);
      }
      if (newSchema.visibleOn !== undefined) {
        return !evaluator.evaluateCondition(newSchema.visibleOn);
      }
      if (newSchema.hidden !== undefined) {
        return evaluator.evaluateCondition(newSchema.hidden);
      }
      if (newSchema.hiddenOn !== undefined) {
        return evaluator.evaluateCondition(newSchema.hiddenOn);
      }
      return false;
    })();

    if (shouldHide) {
      newSchema._hidden = true;
    }

    // Evaluate disabled: disabled / disabledOn
    const isDisabled = (() => {
      if (newSchema.disabled !== undefined) {
        return evaluator.evaluateCondition(newSchema.disabled);
      }
      if (newSchema.disabledOn !== undefined) {
        return evaluator.evaluateCondition(newSchema.disabledOn);
      }
      return false;
    })();

    if (isDisabled) {
      newSchema._disabled = true;
    }

    return newSchema;
  }, [schema, dataSource, predicateScope]);

  if (!evaluatedSchema) return null;
  // Handle visibility: if evaluated schema is hidden, render nothing
  if (evaluatedSchema?._hidden) return null;
  // If schema is just a string, render it as text
  if (typeof evaluatedSchema === 'string') return <>{evaluatedSchema}</>;

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
    visibleOn: _visibleOn,
    hidden: _hidden,
    hiddenOn: _hiddenOn,
    disabled: _disabled,
    disabledOn: _disabledOn,
    _hidden: __hidden,    // stripped: internal visibility flag
    _disabled: __disabled, // stripped: internal disabled flag
    ...componentProps
  } = evaluatedSchema;

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
      {React.createElement(Component, {
        schema: evaluatedSchema,
        ...componentProps,  // Spread non-metadata schema properties as props
        ...(evaluatedSchema.props || {}),  // Override with explicit props if provided
        ...ariaProps,  // Inject ARIA attributes from AriaPropsSchema
        ...debugAttrs, // Debug-mode data attributes
        disabled: __disabled || undefined,
        className: evaluatedSchema.className,
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
