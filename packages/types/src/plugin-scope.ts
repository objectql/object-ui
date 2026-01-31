/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Plugin Scope Isolation
 * 
 * Section 3.3: Plugin scope isolation types to prevent conflicts between plugins.
 * Provides scoped component registration, state management, and event bus.
 * 
 * @module plugin-scope
 * @packageDocumentation
 */

/**
 * Plugin Scope Interface
 * 
 * Provides isolated access to the component registry, state management,
 * and event bus for a specific plugin, preventing conflicts between plugins.
 */
export interface PluginScope {
  /**
   * Plugin name
   */
  name: string;
  
  /**
   * Plugin version
   */
  version: string;
  
  /**
   * Register a component in the scoped namespace.
   * Components will be registered as "pluginName:type" to prevent conflicts.
   * 
   * @param type - Component type identifier (e.g., 'table', 'chart')
   * @param component - Component renderer
   * @param meta - Optional component metadata
   * 
   * @example
   * // Plugin 'my-grid' registers a 'table' component
   * // Registered as 'my-grid:table'
   * scope.registerComponent('table', TableComponent, {
   *   label: 'Data Table',
   *   category: 'data'
   * });
   */
  registerComponent(type: string, component: any, meta?: ComponentMeta): void;
  
  /**
   * Get a component from the scoped namespace.
   * First tries scoped lookup (pluginName:type), then falls back to global.
   * 
   * @param type - Component type identifier
   * @returns Component renderer or undefined if not found
   */
  getComponent(type: string): any | undefined;
  
  /**
   * Scoped state management.
   * Each plugin has its own isolated state that won't conflict with others.
   * 
   * @param key - State key unique to this plugin
   * @param initialValue - Initial state value
   * @returns Tuple of [currentValue, setValue]
   * 
   * @example
   * const [config, setConfig] = scope.useState('config', { theme: 'light' });
   */
  useState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void];
  
  /**
   * Get scoped state value without setter.
   * 
   * @param key - State key
   * @returns Current state value or undefined
   */
  getState<T>(key: string): T | undefined;
  
  /**
   * Set scoped state value directly.
   * 
   * @param key - State key
   * @param value - New state value
   */
  setState<T>(key: string, value: T): void;
  
  /**
   * Subscribe to scoped events.
   * Events are namespaced to prevent cross-plugin conflicts.
   * 
   * @param event - Event name (will be prefixed with plugin namespace)
   * @param handler - Event handler function
   * @returns Unsubscribe function
   * 
   * @example
   * const unsubscribe = scope.on('data-updated', (data) => {
   *   console.log('Scoped event received:', data);
   * });
   */
  on(event: string, handler: EventHandler): () => void;
  
  /**
   * Emit a scoped event.
   * Only subscribers within this plugin scope will receive it.
   * 
   * @param event - Event name
   * @param data - Event data
   * 
   * @example
   * scope.emit('data-updated', { rows: 100 });
   */
  emit(event: string, data?: any): void;
  
  /**
   * Emit a global event that all plugins can receive.
   * Use sparingly for cross-plugin communication.
   * 
   * @param event - Event name
   * @param data - Event data
   */
  emitGlobal(event: string, data?: any): void;
  
  /**
   * Subscribe to global events from any plugin.
   * 
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  onGlobal(event: string, handler: EventHandler): () => void;
  
  /**
   * Clean up all plugin resources (state, event listeners, etc.)
   * Called automatically when plugin is unloaded.
   */
  cleanup(): void;
}

/**
 * Component metadata for registration
 */
export interface ComponentMeta {
  label?: string;
  icon?: string;
  category?: string;
  inputs?: ComponentInput[];
  defaultProps?: Record<string, any>;
  defaultChildren?: any[];
  examples?: Record<string, any>;
  isContainer?: boolean;
  resizable?: boolean;
  resizeConstraints?: {
    width?: boolean;
    height?: boolean;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
}

/**
 * Component input definition
 */
export interface ComponentInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object' | 'color' | 'date' | 'code' | 'file' | 'slot';
  label?: string;
  defaultValue?: any;
  required?: boolean;
  enum?: string[] | { label: string; value: any }[];
  description?: string;
  advanced?: boolean;
  inputType?: string;
}

/**
 * Event handler type
 */
export type EventHandler = (data?: any) => void;

/**
 * Plugin scope configuration
 */
export interface PluginScopeConfig {
  /**
   * Whether to enable state isolation (default: true)
   */
  enableStateIsolation?: boolean;
  
  /**
   * Whether to enable event isolation (default: true)
   */
  enableEventIsolation?: boolean;
  
  /**
   * Whether to allow global event access (default: true)
   */
  allowGlobalEvents?: boolean;
  
  /**
   * Maximum state size per plugin in bytes (default: 5MB)
   */
  maxStateSize?: number;
}
