/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Widget System
 *
 * Manages dynamic widget loading, lifecycle, and registry integration.
 * Supports three loading strategies: npm, remote, and inline.
 *
 * @module widget
 * @packageDocumentation
 */

import type {
  WidgetManifest,
  WidgetSource,
  LoadedWidget,
  WidgetProperty,
} from '@object-ui/types';
import { Registry } from '../registry/Registry.js';

// ---------------------------------------------------------------------------
// Widget Validator
// ---------------------------------------------------------------------------

/**
 * Validate widget property values against the manifest definition.
 */
export function validateWidgetProps(
  manifest: WidgetManifest,
  props: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const properties = manifest.properties || [];

  for (const prop of properties) {
    const value = props[prop.name];

    // Required check
    if (prop.required && (value === undefined || value === null || value === '')) {
      errors.push(`Property "${prop.label || prop.name}" is required`);
      continue;
    }

    // Type check (basic)
    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      const expectedType = prop.type;

      // Map widget property types to JS types
      const typeMap: Record<string, string[]> = {
        string: ['string'],
        number: ['number'],
        boolean: ['boolean'],
        object: ['object'],
        array: ['array'],
        enum: ['string', 'number'],
        color: ['string'],
        date: ['string', 'object'],
        code: ['string'],
        file: ['string', 'object'],
        slot: ['object'],
        expression: ['string'],
      };

      const allowedTypes = typeMap[expectedType] || ['string'];
      if (!allowedTypes.includes(actualType)) {
        errors.push(
          `Property "${prop.label || prop.name}" expected type ${expectedType}, got ${actualType}`
        );
      }
    }

    // Enum validation
    if (prop.type === 'enum' && prop.enum && value !== undefined) {
      const enumValues = prop.enum.map((e) =>
        typeof e === 'string' ? e : e.value
      );
      if (!enumValues.includes(value as string)) {
        errors.push(
          `Property "${prop.label || prop.name}" must be one of: ${enumValues.join(', ')}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Apply default values from the manifest to the provided props.
 */
export function applyWidgetDefaults(
  manifest: WidgetManifest,
  props: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...props };
  const properties = manifest.properties || [];

  for (const prop of properties) {
    if (result[prop.name] === undefined && prop.defaultValue !== undefined) {
      result[prop.name] = prop.defaultValue;
    }
  }

  // Also apply manifest-level defaults
  if (manifest.defaultProps) {
    for (const [key, value] of Object.entries(manifest.defaultProps)) {
      if (result[key] === undefined) {
        result[key] = value;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Widget Loader
// ---------------------------------------------------------------------------

/**
 * Load a widget component based on its implementation source.
 */
export async function loadWidget(source: WidgetSource): Promise<any> {
  switch (source.type) {
    case 'npm':
      return loadNpmWidget(source);
    case 'remote':
      return loadRemoteWidget(source);
    case 'inline':
      return loadInlineWidget(source);
    default:
      throw new Error(`Unknown widget implementation type: ${(source as any).type}`);
  }
}

/**
 * Load a widget from an npm package.
 * Requires the package to be installed in the project.
 */
async function loadNpmWidget(source: { package: string; export?: string }): Promise<any> {
  try {
    // Dynamic import from the installed package
    const module = await import(/* @vite-ignore */ source.package);
    const exportName = source.export || 'default';
    const component = module[exportName] || module.default;
    if (!component) {
      throw new Error(`Export "${exportName}" not found in package "${source.package}"`);
    }
    return component;
  } catch (error) {
    throw new Error(
      `Failed to load npm widget "${source.package}": ${(error as Error).message}`
    );
  }
}

/**
 * Load a widget from a remote URL (Module Federation or CDN).
 */
async function loadRemoteWidget(source: {
  url: string;
  module?: string;
  scope?: string;
  integrity?: string;
}): Promise<any> {
  try {
    // Standard ESM dynamic import from URL
    const module = await import(/* @vite-ignore */ source.url);
    return module.default || module;
  } catch (error) {
    throw new Error(
      `Failed to load remote widget from "${source.url}": ${(error as Error).message}`
    );
  }
}

/**
 * Load an inline widget from code string.
 * NOTE: Inline widgets are a limited feature for simple components.
 * For security, we only support pre-compiled function references.
 */
async function loadInlineWidget(source: { code: string }): Promise<any> {
  // For security (Rule #6: no eval), inline widgets return a placeholder.
  // In a real implementation, this would be handled by a sandboxed renderer.
  throw new Error(
    'Inline widget loading is not supported for security reasons. ' +
    'Use npm or remote implementation instead.'
  );
}

// ---------------------------------------------------------------------------
// Widget Registry
// ---------------------------------------------------------------------------

/**
 * WidgetRegistry — manages widget manifests and loaded components.
 *
 * Works alongside the ComponentRegistry to register dynamically loaded widgets.
 */
export class WidgetRegistry {
  private manifests = new Map<string, WidgetManifest>();
  private loaded = new Map<string, LoadedWidget>();
  private componentRegistry: Registry;

  constructor(componentRegistry: Registry) {
    this.componentRegistry = componentRegistry;
  }

  /**
   * Register a widget manifest.
   */
  registerManifest(manifest: WidgetManifest): void {
    this.manifests.set(manifest.name, manifest);
  }

  /**
   * Register multiple widget manifests (e.g., from a catalog).
   */
  registerCatalog(widgets: WidgetManifest[]): void {
    for (const manifest of widgets) {
      this.registerManifest(manifest);
    }
  }

  /**
   * Get a widget manifest by name.
   */
  getManifest(name: string): WidgetManifest | undefined {
    return this.manifests.get(name);
  }

  /**
   * Get all registered manifests.
   */
  getAllManifests(): WidgetManifest[] {
    return Array.from(this.manifests.values());
  }

  /**
   * Get manifests filtered by category.
   */
  getByCategory(category: string): WidgetManifest[] {
    return this.getAllManifests().filter((m) => m.category === category);
  }

  /**
   * Search manifests by name, label, or tags.
   */
  search(query: string): WidgetManifest[] {
    const lower = query.toLowerCase();
    return this.getAllManifests().filter(
      (m) =>
        m.name.toLowerCase().includes(lower) ||
        m.label.toLowerCase().includes(lower) ||
        m.description?.toLowerCase().includes(lower) ||
        m.tags?.some((t) => t.toLowerCase().includes(lower))
    );
  }

  /**
   * Load and resolve a widget component.
   * Caches the loaded component for subsequent calls.
   */
  async load(name: string): Promise<LoadedWidget> {
    // Return cached if already loaded
    const cached = this.loaded.get(name);
    if (cached && cached.status === 'loaded') {
      return cached;
    }

    const manifest = this.manifests.get(name);
    if (!manifest) {
      const errorWidget: LoadedWidget = {
        manifest: { name, label: name, implementation: { type: 'npm', package: '' } },
        component: null,
        status: 'error',
        error: `Widget "${name}" not found in registry`,
      };
      this.loaded.set(name, errorWidget);
      return errorWidget;
    }

    // Mark as loading
    const loadingWidget: LoadedWidget = {
      manifest,
      component: null,
      status: 'loading',
    };
    this.loaded.set(name, loadingWidget);

    try {
      const component = await loadWidget(manifest.implementation);
      const loadedWidget: LoadedWidget = {
        manifest,
        component,
        status: 'loaded',
      };
      this.loaded.set(name, loadedWidget);

      // Register in the ComponentRegistry
      this.componentRegistry.register(name, component, {
        namespace: 'widget',
        label: manifest.label,
        icon: manifest.icon,
        category: manifest.category || 'widgets',
        inputs: manifest.properties?.map((p) => ({
          name: p.name,
          type: p.type as any,
          label: p.label,
          defaultValue: p.defaultValue,
          required: p.required,
          description: p.description,
          enum: p.enum as any,
          advanced: p.advanced,
        })),
        isContainer: manifest.isContainer,
        defaultProps: manifest.defaultProps,
      });

      return loadedWidget;
    } catch (error) {
      const errorWidget: LoadedWidget = {
        manifest,
        component: null,
        status: 'error',
        error: (error as Error).message,
      };
      this.loaded.set(name, errorWidget);
      return errorWidget;
    }
  }

  /**
   * Load all registered widgets.
   */
  async loadAll(): Promise<Map<string, LoadedWidget>> {
    const names = Array.from(this.manifests.keys());
    await Promise.allSettled(names.map((name) => this.load(name)));
    return this.loaded;
  }

  /**
   * Get loading status of a widget.
   */
  getStatus(name: string): 'loading' | 'loaded' | 'error' | 'not-registered' {
    const widget = this.loaded.get(name);
    if (!widget) {
      return this.manifests.has(name) ? 'loading' : 'not-registered';
    }
    return widget.status;
  }

  /**
   * Unregister a widget.
   */
  unregister(name: string): void {
    this.manifests.delete(name);
    this.loaded.delete(name);
  }
}
