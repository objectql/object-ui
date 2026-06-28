/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '../types/index.js';
import { PUBLIC_BLOCKS } from './public-blocks.js';

export type ComponentRenderer<T = any> = T;

export type ComponentInput = {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'color' | 'date' | 'code' | 'file' | 'slot';
  label?: string;
  defaultValue?: any;
  required?: boolean;
  enum?: string[] | { label: string; value: any }[];
  description?: string;
  advanced?: boolean;
  inputType?: string;
};

export type ComponentMeta = {
  label?: string; // Display name in designer
  icon?: string; // Icon name or svg string
  category?: string; // Grouping category
  /**
   * Public contract tier (ADR-0080). `'public'` = part of the curated,
   * type-checked, AI-facing block set (gets a strengthened contract, the
   * JSX type surface, the api-surface ratchet, and customer docs). Undefined
   * or `'internal'` = rendering capability only, not part of the contract.
   */
  tier?: 'public' | 'internal';
  namespace?: string; // Component namespace (e.g., 'ui', 'plugin-grid', 'field')
  /**
   * When true, prevents the component from being registered with a non-namespaced fallback.
   * Use this when a component should only be accessible via its full namespaced key.
   * This avoids conflicts with other components that share the same base name.
   * 
   * @example
   * // Register as 'view:form' only, don't overwrite 'form'
   * registry.register('form', FormView, { namespace: 'view', skipFallback: true });
   */
  skipFallback?: boolean;
  inputs?: ComponentInput[];
  defaultProps?: Record<string, any>; // Default props when dropped
  defaultChildren?: SchemaNode[]; // Default children when dropped
  examples?: Record<string, any>; // Example configurations
  isContainer?: boolean; // Whether the component can have children
  resizable?: boolean; // Whether the component can be resized in the designer
  resizeConstraints?: {
    width?: boolean;
    height?: boolean;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
};

export type ComponentConfig<T = any> = ComponentMeta & {
  type: string;
  component: ComponentRenderer<T>;
};

/**
 * Lazy loader function used by `Registry.registerLazy`. The loader is invoked
 * the first time a missing component type is requested through `getAsync`/the
 * SchemaRenderer fallback path, and is expected to perform a dynamic
 * `import()` of a plugin module whose top-level side-effects call
 * `register()` for that type.
 */
export type LazyComponentLoader = () => Promise<unknown>;

type LazyEntry = {
  loader: LazyComponentLoader;
  meta?: ComponentMeta;
  /** Pending import promise — reused when multiple consumers race. */
  pending?: Promise<unknown>;
};

export class Registry<T = any> {
  private components = new Map<string, ComponentConfig<T>>();
  private lazyEntries = new Map<string, LazyEntry>();
  /**
   * Notifies subscribers that the registry has changed (new components
   * registered). Used by SchemaRenderer to re-render after a lazy plugin
   * load completes.
   */
  private listeners = new Set<() => void>();

  /**
   * Register a component with optional namespace support.
   * If namespace is provided in meta, the component will be registered as "namespace:type".
   * 
   * @param type - Component type identifier
   * @param component - Component renderer
   * @param meta - Component metadata (including optional namespace)
   * 
   * @example
   * // Register with namespace
   * registry.register('button', ButtonComponent, { namespace: 'ui' });
   * // Accessible as 'ui:button' or 'button' (fallback)
   * 
   * @example
   * // Register without namespace (backward compatible)
   * registry.register('button', ButtonComponent);
   * // Accessible as 'button'
   */
  register(type: string, component: ComponentRenderer<T>, meta?: ComponentMeta) {
    const fullType = meta?.namespace ? `${meta.namespace}:${type}` : type;
    
    // Warn if registering without namespace (deprecated pattern)
    if (!meta?.namespace) {
      console.warn(
        `Registering component "${type}" without a namespace is deprecated. ` +
        `Please provide a namespace in the meta parameter.\n\n` +
        `  Migration:\n` +
        `  // Before (deprecated):\n` +
        `  registry.register('${type}', MyComponent);\n\n` +
        `  // After:\n` +
        `  registry.register('${type}', MyComponent, { namespace: 'my-plugin' });\n\n` +
        `  See: https://github.com/objectstack-ai/objectui/blob/main/MIGRATION_GUIDE.md`
      );
    }
    
    if (this.components.has(fullType)) {
      // console.warn(`Component type "${fullType}" is already registered. Overwriting.`);
    }
    
    this.components.set(fullType, {
      type: fullType,
      component,
      ...meta
    });
    
    // Also register without namespace for backward compatibility
    // This allows "button" to work even when registered as "ui:button"
    // Note: If multiple namespaced components share the same short name,
    // the last registration wins for non-namespaced lookups
    // Skip this if skipFallback is true to avoid overwriting other components
    if (meta?.namespace && !meta?.skipFallback) {
      // Collision guard: a bare-name fallback that overwrites a DIFFERENT
      // component is almost always an accident (e.g. plugin 'view:grid' silently
      // clobbering the layout 'grid'). Warn so it surfaces instead of 404-ing at
      // render time. Pass `skipFallback: true` when a namespaced-only alias is
      // intended.
      const existing = this.components.get(type);
      if (existing && existing.component !== component && existing.type !== fullType) {
        console.warn(
          `Component "${type}" bare-name fallback is being overwritten by "${fullType}". ` +
          `If this is intentional keep going; otherwise register "${fullType}" with ` +
          `{ skipFallback: true } so it doesn't claim the bare "${type}" key.`,
        );
      }
      this.components.set(type, {
        type: fullType, // Keep reference to namespaced type
        component,
        ...meta
      });
    }

    // A real component is now available — clear any matching lazy stub so we
    // don't keep holding the loader reference, and notify subscribers.
    this.lazyEntries.delete(fullType);
    this.lazyEntries.delete(type);
    this.notify();
  }

  /**
   * Remove a previously registered component. Mirrors {@link register} by
   * clearing both the namespaced key and the bare-name fallback (when the
   * fallback still points at this registration), plus any matching lazy stub.
   * Notifies subscribers only when something was actually removed.
   *
   * Mainly used by tests that install a stub renderer and need to restore the
   * prior registry state on teardown, since the registry is a process-level
   * singleton shared across test files.
   */
  unregister(type: string, namespace?: string): boolean {
    const fullType = namespace ? `${namespace}:${type}` : type;
    const removed = this.components.delete(fullType);
    // Only drop the bare fallback if it still resolves to this registration.
    if (namespace) {
      const bare = this.components.get(type);
      if (bare && bare.type === fullType) this.components.delete(type);
    }
    this.lazyEntries.delete(fullType);
    this.lazyEntries.delete(type);
    if (removed) this.notify();
    return removed;
  }

  /**
   * Register a lazy-loaded component. The `loader` is a function returning a
   * dynamic `import()` whose target module performs `register()` calls for
   * the given `type` as a top-level side effect.
   *
   * The loader will be invoked the first time `loadLazy(type)` is called (or
   * the first time the SchemaRenderer encounters an unknown component that
   * matches a registered lazy type). Subsequent registrations are idempotent.
   *
   * @example
   * ComponentRegistry.registerLazy('object-map', () => import('@object-ui/plugin-map'), { namespace: 'plugin-map' });
   */
  registerLazy(type: string, loader: LazyComponentLoader, meta?: ComponentMeta) {
    const fullType = meta?.namespace ? `${meta.namespace}:${type}` : type;
    const entry: LazyEntry = { loader, meta };
    this.lazyEntries.set(fullType, entry);
    if (meta?.namespace && !meta?.skipFallback) {
      this.lazyEntries.set(type, entry);
    }
  }

  /**
   * Returns true if `type` (or its namespaced form) has a registered lazy
   * loader awaiting first use.
   */
  hasLazy(type: string, namespace?: string): boolean {
    if (namespace) return this.lazyEntries.has(`${namespace}:${type}`);
    return this.lazyEntries.has(type);
  }

  /**
   * Trigger the lazy loader for `type`, if any. Resolves once the loader
   * completes (whether or not the loaded module actually registered the
   * expected type — caller should re-check the registry afterwards).
   * Returns `undefined` if no lazy entry matches.
   */
  loadLazy(type: string, namespace?: string): Promise<unknown> | undefined {
    const key = namespace ? `${namespace}:${type}` : type;
    const entry = this.lazyEntries.get(key);
    if (!entry) return undefined;
    if (!entry.pending) {
      entry.pending = entry.loader().catch((err) => {
        // Allow retries on failure by clearing the cached promise.
        entry.pending = undefined;
        throw err;
      });
    }
    return entry.pending;
  }

  /**
   * Subscribe to registry changes (component registrations). Returns an
   * unsubscribe function. Used by React renderers to re-render when a
   * lazy-loaded plugin finishes registering its components.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[Registry] listener error', err);
      }
    }
  }

  /**
   * Get a component by type. Supports both namespaced and non-namespaced lookups.
   * 
   * @param type - Component type (e.g., 'button' or 'ui:button')
   * @param namespace - Optional namespace for lookup priority
   * @returns Component renderer or undefined
   * 
   * @example
   * // Direct lookup
   * registry.get('ui:button') // Gets ui:button
   * 
   * @example
   * // Fallback lookup
   * registry.get('button') // Gets first registered button
   * 
   * @example
   * // Namespaced lookup with priority
   * registry.get('button', 'ui') // Tries 'ui:button' first, then 'button'
   */
  get(type: string, namespace?: string): ComponentRenderer<T> | undefined {
    // If namespace is explicitly provided, ONLY look in that namespace (no fallback)
    if (namespace) {
      const namespacedType = `${namespace}:${type}`;
      return this.components.get(namespacedType)?.component;
    }
    
    // When no namespace provided, use backward compatibility lookup
    return this.components.get(type)?.component;
  }

  /**
   * Get component configuration by type with namespace support.
   * 
   * @param type - Component type (e.g., 'button' or 'ui:button')
   * @param namespace - Optional namespace for lookup priority
   * @returns Component configuration or undefined
   */
  getConfig(type: string, namespace?: string): ComponentConfig<T> | undefined {
    // If namespace is explicitly provided, ONLY look in that namespace (no fallback)
    if (namespace) {
      const namespacedType = `${namespace}:${type}`;
      return this.components.get(namespacedType);
    }
    
    // When no namespace provided, use backward compatibility lookup
    return this.components.get(type);
  }

  /**
   * Check if a component type is registered.
   * 
   * @param type - Component type (e.g., 'button' or 'ui:button')
   * @param namespace - Optional namespace for lookup
   * @returns True if component is registered
   */
  has(type: string, namespace?: string): boolean {
    // If namespace is explicitly provided, ONLY look in that namespace (no fallback)
    if (namespace) {
      const namespacedType = `${namespace}:${type}`;
      return this.components.has(namespacedType);
    }
    // When no namespace provided, use backward compatibility lookup
    return this.components.has(type);
  }
  
  /**
   * Get all registered component types.
   * 
   * @returns Array of all component type identifiers
   */
  getAllTypes(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get all registered component configurations.
   * 
   * @returns Array of all component configurations
   */
  getAllConfigs(): ComponentConfig<T>[] {
    return Array.from(this.components.values());
  }

  /**
   * Get the curated PUBLIC-tier component configs (ADR-0080) — those registered
   * with `tier: 'public'`. This is the contract/AI-vocabulary surface, a subset
   * of the full rendering capability returned by {@link getAllConfigs}.
   */
  getPublicConfigs(): ComponentConfig<T>[] {
    // Dedupe by the config's canonical (namespaced) `type` — a component is
    // registered under both a bare and a namespaced key pointing at the same
    // canonical type, and we want one contract entry per component.
    const seenCanonical = new Set<string>();
    const out: ComponentConfig<T>[] = [];
    const add = (tag: string, cfg: ComponentConfig<T> | undefined): void => {
      if (!cfg || seenCanonical.has(cfg.type)) return;
      seenCanonical.add(cfg.type);
      // The contract surface is keyed by the bare/curated tag authors write,
      // not the namespaced canonical stored on the config.
      out.push({ ...cfg, type: tag });
    };
    // Curated contract list first (stable, reviewable order) …
    for (const tag of PUBLIC_BLOCKS) add(tag, this.getConfig(tag));
    // … plus any bare registration that opted in explicitly via `tier: 'public'`.
    for (const [key, cfg] of this.components.entries()) {
      if (cfg.tier === 'public' && !key.includes(':')) add(key, cfg);
    }
    return out;
  }
  
  /**
   * Get all components in a specific namespace.
   * 
   * @param namespace - Namespace to filter by
   * @returns Array of component configurations in the namespace
   */
  getNamespaceComponents(namespace: string): ComponentConfig<T>[] {
    return Array.from(this.components.values()).filter(
      config => config.namespace === namespace
    );
  }
}

export const ComponentRegistry = new Registry<any>();
