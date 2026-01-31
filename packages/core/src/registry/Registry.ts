/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SchemaNode } from '../types';

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
  namespace?: string; // Component namespace (e.g., 'ui', 'plugin-grid', 'field')
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

export class Registry<T = any> {
  private components = new Map<string, ComponentConfig<T>>();

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
        `Please provide a namespace in the meta parameter.`
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
    if (meta?.namespace) {
      this.components.set(type, {
        type: fullType, // Keep reference to namespaced type
        component,
        ...meta
      });
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
