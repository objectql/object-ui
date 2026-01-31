/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Registry } from './Registry';
import type { PluginScope, PluginScopeConfig } from '@object-ui/types';
import { PluginScopeImpl } from './PluginScopeImpl';

export interface PluginDefinition {
  name: string;
  version: string;
  dependencies?: string[];  // Dependencies on other plugins
  peerDependencies?: string[];  // Peer dependencies
  register: (registry: Registry | PluginScope) => void;  // Support both legacy and scoped registration
  onLoad?: () => void | Promise<void>;  // Lifecycle hook: called after registration
  onUnload?: () => void | Promise<void>;  // Lifecycle hook: called before unload
  scopeConfig?: PluginScopeConfig;  // Optional scope configuration
}

export class PluginSystem {
  private plugins = new Map<string, PluginDefinition>();
  private loaded = new Set<string>();
  private scopes = new Map<string, PluginScopeImpl>();

  /**
   * Load a plugin into the system with optional scope isolation
   * @param plugin The plugin definition to load
   * @param registry The component registry to use for registration
   * @param useScope Whether to use scoped loading (default: true for better isolation)
   * @throws Error if dependencies are missing
   */
  async loadPlugin(plugin: PluginDefinition, registry: Registry, useScope: boolean = true): Promise<void> {
    // Check if already loaded
    if (this.loaded.has(plugin.name)) {
      console.warn(`Plugin "${plugin.name}" is already loaded. Skipping.`);
      return;
    }

    // Check dependencies
    for (const dep of plugin.dependencies || []) {
      if (!this.loaded.has(dep)) {
        throw new Error(`Missing dependency: ${dep} required by ${plugin.name}`);
      }
    }

    try {
      if (useScope) {
        // Create scoped environment for plugin
        const scope = new PluginScopeImpl(
          plugin.name,
          plugin.version,
          registry,
          plugin.scopeConfig
        );
        
        // Store scope for cleanup
        this.scopes.set(plugin.name, scope);
        
        // Execute registration with scope
        plugin.register(scope);
      } else {
        // Legacy mode: direct registry access
        plugin.register(registry);
      }

      // Store plugin definition
      this.plugins.set(plugin.name, plugin);

      // Execute lifecycle hook
      await plugin.onLoad?.();

      // Mark as loaded
      this.loaded.add(plugin.name);
    } catch (error) {
      // Clean up on failure
      this.plugins.delete(plugin.name);
      this.scopes.delete(plugin.name);
      throw error;
    }
  }

  /**
   * Unload a plugin from the system
   * @param name The name of the plugin to unload
   * @throws Error if other plugins depend on this plugin
   */
  async unloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin "${name}" is not loaded`);
    }

    // Check if any loaded plugins depend on this one
    for (const [pluginName, pluginDef] of this.plugins.entries()) {
      if (this.loaded.has(pluginName) && pluginDef.dependencies?.includes(name)) {
        throw new Error(`Cannot unload plugin "${name}" - plugin "${pluginName}" depends on it`);
      }
    }

    // Execute lifecycle hook
    await plugin.onUnload?.();

    // Clean up scope if exists
    const scope = this.scopes.get(name);
    if (scope) {
      scope.cleanup();
      this.scopes.delete(name);
    }

    // Remove from loaded set
    this.loaded.delete(name);
    this.plugins.delete(name);
  }

  /**
   * Get the scope for a loaded plugin
   * @param name The name of the plugin
   * @returns The plugin scope or undefined
   */
  getScope(name: string): PluginScope | undefined {
    return this.scopes.get(name);
  }

  /**
   * Check if a plugin is loaded
   * @param name The name of the plugin
   * @returns true if the plugin is loaded
   */
  isLoaded(name: string): boolean {
    return this.loaded.has(name);
  }

  /**
   * Get a loaded plugin definition
   * @param name The name of the plugin
   * @returns The plugin definition or undefined
   */
  getPlugin(name: string): PluginDefinition | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all loaded plugin names
   * @returns Array of loaded plugin names
   */
  getLoadedPlugins(): string[] {
    return Array.from(this.loaded);
  }

  /**
   * Get all plugin definitions
   * @returns Array of all plugin definitions
   */
  getAllPlugins(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }
}
