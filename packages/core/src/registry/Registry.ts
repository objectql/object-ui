/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentInputControlType } from '@object-ui/types';
import type { SchemaNode } from '../types/index.js';
import { PUBLIC_BLOCKS } from './public-blocks.js';

export type ComponentRenderer<T = any> = T;

/**
 * What a registration DECLARES about one authorable prop.
 *
 * This is the declaration the component registrations themselves import, so it
 * is the one an author's manifest is ultimately built from. It is structurally
 * the third copy of `ComponentInput` (the others live in the types package's
 * `base.ts` and `plugin-scope.ts`); the arm vocabulary of `type` is imported
 * from there rather than re-spelled, so the union widening of objectui#3832
 * cannot land on two of the three and drift.
 */
export type ComponentInput = {
  name: string;
  /**
   * Input control type — one coarse kind, or an array of them when the key's
   * contract is a union (objectui#3832). A value passes the manifest gate when
   * ANY declared arm accepts it; a value matching none is still reported. Full
   * semantics: `ComponentInput.type` in the types package's `base.ts`.
   */
  type: ComponentInputControlType | ComponentInputControlType[];
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
  /**
   * How a HOST must associate its own visible label with what this component
   * renders (objectui#3961, extended by objectui#4857). Read by the form
   * renderer; absent ⇒ `'control'`. This closed three-value vocabulary is the
   * single repo-wide answer to "how does a host learn what a widget will
   * render" (maintainer ruling of 2026-08-17, joint with objectui#4871) — no
   * host may keep a local variant of it.
   *
   * - `'control'` — the component's outermost rendered element is a LABELABLE
   *   HTML element (`input` / `textarea` / `select` / `button` / …), so the host
   *   associates its label the plain way: `<label for>` → the id the host handed
   *   down. This is the default and covers every single-control widget.
   * - `'group'` — it is NOT labelable: either a real composite (several inputs
   *   under one container, e.g. `address`) or a single control that is not a
   *   labelable element (a `div[role="button"]` dropzone, e.g. `file`). A
   *   `<label for>` pointing at such an element is inert in HTML — it activates
   *   nothing and contributes no accessible name (`HTMLLabelElement.control` is
   *   `null`) — so the host must instead give its label an `id` and hand the
   *   component `aria-labelledby`, which associates by IDREF and works on any
   *   element. The COMPONENT consumes those keys on its own surface.
   * - `'display'` — the rendered surface is a pure display in EVERY state:
   *   there is no focusable control and the component itself spreads nothing
   *   (computed / system-generated values such as `formula` / `summary` /
   *   `auto_number` / `vector`). The host must not emit a `<label for>` at all
   *   — no labelable element will ever exist for it to reach, in the editable
   *   state as much as the readonly one — and instead wraps the component's
   *   output in the host's own container carrying the field id,
   *   `aria-labelledby`, `aria-describedby` and `role="group"` (the
   *   objectui#4788 channel, driven by this declaration rather than by
   *   `readonly` alone). Unlike `'group'`, the WIDGET is not expected to
   *   consume anything: the host's wrapper is the named surface.
   *
   * This is a DECLARATION, not a guess: the host cannot infer it from the DOM a
   * widget happens to render, and a widget that fails to declare it falls back
   * to the `'control'` path where the dangling/inert `for` is caught by the
   * label-association tests (objectui#3952) instead of silently producing an
   * unlabelled group.
   */
  labelling?: 'control' | 'group' | 'display';
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
 * A CONTRACT-surface entry (ADR-0080), as returned by
 * {@link Registry.getPublicConfigs}.
 *
 * Same shape as {@link ComponentConfig} except `component` is absent while the
 * entry is still a pending `registerLazy` stub: the plugin module has not been
 * imported yet, so there is no renderer to hand out. Consumers render such an
 * entry through `SchemaRenderer`, which triggers the loader and shows a
 * placeholder in the meantime (objectui#2953).
 */
export type PublicComponentConfig<T = any> = ComponentMeta & {
  type: string;
  component?: ComponentRenderer<T>;
  /** True while this entry is a `registerLazy` stub whose loader has not run. */
  lazy?: boolean;
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
   * Bumped whenever the set of KNOWN types changes — a registration, an
   * unregistration, or a new lazy stub. A cheap cache key for consumers that
   * derive something from the whole registry (whitelists, manifests, palettes)
   * and need to rebuild when it grows. Counting types is not a substitute: a
   * registration paired with an unregistration leaves the count untouched.
   */
  private version = 0;

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
    // Bump the version but do NOT notify: the set of KNOWN types grew, so
    // whitelists and manifests must rebuild, but nothing new can render yet —
    // waking every subscriber for each stub at boot would be pure churn.
    this.version++;
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
    this.version++;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('[Registry] listener error', err);
      }
    }
  }

  /**
   * Monotonic counter of changes to the set of known types. Rebuild anything
   * derived from the whole registry when this moves — see {@link getKnownTypes}.
   */
  getVersion(): number {
    return this.version;
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
   * LOADED registrations only — a type that exists solely as a `registerLazy`
   * stub returns `undefined` here, because callers read `.component` off the
   * result and a stub has no renderer until its loader runs. The *contract*
   * question ("is this tag part of the public surface?") must not depend on
   * load order, so {@link getPublicConfigs} resolves lazy stubs separately
   * (objectui#2953). Use {@link hasLazy} / {@link loadLazy} to reach a stub.
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
   * Get all LOADED component types — what can be rendered right now.
   *
   * Pending `registerLazy` stubs are not included; use {@link getKnownTypes}
   * for the question "is this a type this app knows about", which is what a
   * whitelist or manifest wants (objectui#2953).
   *
   * @returns Array of all component type identifiers
   */
  getAllTypes(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Every type the registry can resolve — loaded registrations PLUS pending
   * lazy stubs, deduped. Both the bare and namespaced keys are included, as
   * they are in {@link getAllTypes}.
   *
   * This is the set to build a whitelist or a manifest from. Keying one off
   * `getAllTypes()` instead makes it depend on which plugin chunks happen to
   * have loaded: a lazily-registered block gets rejected as unknown, and
   * whether it does varies by session (objectui#2953).
   */
  getKnownTypes(): string[] {
    return Array.from(new Set([...this.components.keys(), ...this.lazyEntries.keys()]));
  }

  /**
   * Metadata for `type` — from the loaded registration when there is one,
   * otherwise from a pending `registerLazy` stub.
   *
   * Use this when you need to know what a type IS (namespace, container-ness,
   * declared inputs). {@link getConfig} answers a different question — "can I
   * render this right now" — and is deliberately loaded-only, since callers
   * read `.component` off it.
   *
   * A stub carries only what `registerLazy` was given, so `inputs` is usually
   * absent until the chunk loads. Consumers should treat that as "not yet
   * known", not as "declares no props".
   */
  getMeta(type: string, namespace?: string): ComponentMeta | undefined {
    const key = namespace ? `${namespace}:${type}` : type;
    return this.components.get(key) ?? this.lazyEntries.get(key)?.meta;
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
   * Resolve `tag` for the CONTRACT surface: the loaded registration when the
   * component is already in the registry, otherwise the metadata of a pending
   * `registerLazy` stub.
   *
   * A block registered lazily is a first-class member of the contract — the
   * loader is recorded at boot and the plugin chunk is imported on first use —
   * so contract membership must not hinge on whether that import happened to
   * have run yet (objectui#2953).
   */
  private getContractConfig(tag: string): PublicComponentConfig<T> | undefined {
    const loaded = this.components.get(tag);
    if (loaded) return loaded;
    const entry = this.lazyEntries.get(tag);
    if (!entry) return undefined;
    // Mirror registerLazy's key derivation so the canonical `type` matches the
    // one `register()` will store once the loader runs — that keeps the dedupe
    // below stable across the load. `tag` may already carry the namespace
    // (lazyEntries holds both keys; curated tags like `record:details` are
    // themselves colon-shaped), so don't prefix it twice.
    const ns = entry.meta?.namespace;
    const canonical = ns && !tag.startsWith(`${ns}:`) ? `${ns}:${tag}` : tag;
    return { ...entry.meta, type: canonical, lazy: true };
  }

  /**
   * Get the curated PUBLIC-tier component configs (ADR-0080) — those registered
   * with `tier: 'public'`. This is the contract/AI-vocabulary surface, a subset
   * of the full rendering capability returned by {@link getAllConfigs}.
   *
   * Includes blocks that are only lazily registered so far; those come back
   * with `lazy: true` and no `component` (see {@link PublicComponentConfig}).
   */
  getPublicConfigs(): PublicComponentConfig<T>[] {
    // Dedupe by the config's canonical (namespaced) `type` — a component is
    // registered under both a bare and a namespaced key pointing at the same
    // canonical type, and we want one contract entry per component.
    const seenCanonical = new Set<string>();
    const out: PublicComponentConfig<T>[] = [];
    const add = (tag: string, cfg: PublicComponentConfig<T> | undefined): void => {
      if (!cfg || seenCanonical.has(cfg.type)) return;
      seenCanonical.add(cfg.type);
      // The contract surface is keyed by the bare/curated tag authors write,
      // not the namespaced canonical stored on the config.
      out.push({ ...cfg, type: tag });
    };
    // Curated contract list first (stable, reviewable order) …
    for (const tag of PUBLIC_BLOCKS) add(tag, this.getContractConfig(tag));
    // … plus any bare registration that opted in explicitly via `tier: 'public'`.
    for (const [key, cfg] of this.components.entries()) {
      if (cfg.tier === 'public' && !key.includes(':')) add(key, cfg);
    }
    // … and the same opt-in for stubs whose loader has not run yet.
    for (const [key, entry] of this.lazyEntries.entries()) {
      if (entry.meta?.tier === 'public' && !key.includes(':')) add(key, this.getContractConfig(key));
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
