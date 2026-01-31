/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Plugin Scope Integration Tests
 * Section 3.3: Test scoped plugin system to ensure isolation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Registry } from '../Registry';
import { PluginSystem } from '../PluginSystem';
import type { PluginScope } from '@object-ui/types';

describe('Plugin Scope Integration', () => {
  let registry: Registry;
  let pluginSystem: PluginSystem;

  beforeEach(() => {
    registry = new Registry();
    pluginSystem = new PluginSystem();
  });

  describe('Component Registration Isolation', () => {
    it('should isolate component registrations between plugins', async () => {
      const MockTableA = () => 'Table A';
      const MockTableB = () => 'Table B';

      const pluginA = {
        name: 'plugin-a',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.registerComponent('table', MockTableA);
        },
      };

      const pluginB = {
        name: 'plugin-b',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.registerComponent('table', MockTableB);
        },
      };

      await pluginSystem.loadPlugin(pluginA, registry, true);
      await pluginSystem.loadPlugin(pluginB, registry, true);

      // Both plugins should have their own namespaced component
      const tableA = registry.getConfig('plugin-a:table');
      const tableB = registry.getConfig('plugin-b:table');

      expect(tableA).toBeDefined();
      expect(tableB).toBeDefined();
      expect(tableA?.component).toBe(MockTableA);
      expect(tableB?.component).toBe(MockTableB);
    });

    it('should allow scoped component to access global components', async () => {
      const GlobalButton = () => 'Global Button';
      const MockGrid = () => 'Grid';

      // Register a global component
      registry.register('button', GlobalButton);

      const plugin = {
        name: 'plugin-grid',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.registerComponent('grid', MockGrid);
          
          // Plugin should be able to access global components
          const button = scope.getComponent('button');
          expect(button).toBe(GlobalButton);
        },
      };

      await pluginSystem.loadPlugin(plugin, registry, true);
    });
  });

  describe('State Management Isolation', () => {
    it('should isolate state between plugins', async () => {
      let stateA: any;
      let stateB: any;

      const pluginA = {
        name: 'plugin-a',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          const [config, setConfig] = scope.useState('config', { theme: 'dark' });
          stateA = config;
          setConfig({ theme: 'light' });
        },
      };

      const pluginB = {
        name: 'plugin-b',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          const [config, setConfig] = scope.useState('config', { theme: 'auto' });
          stateB = config;
        },
      };

      await pluginSystem.loadPlugin(pluginA, registry, true);
      await pluginSystem.loadPlugin(pluginB, registry, true);

      // State should be isolated
      const scopeA = pluginSystem.getScope('plugin-a');
      const scopeB = pluginSystem.getScope('plugin-b');

      expect(scopeA?.getState('config')).toEqual({ theme: 'light' });
      expect(scopeB?.getState('config')).toEqual({ theme: 'auto' });
    });

    it('should enforce state size limits', async () => {
      const plugin = {
        name: 'plugin-heavy',
        version: '1.0.0',
        scopeConfig: {
          maxStateSize: 100, // Very small limit for testing
        },
        register: (scope: PluginScope) => {
          // This should throw due to size limit
          expect(() => {
            scope.setState('largeData', {
              data: 'x'.repeat(1000), // Much larger than 100 bytes
            });
          }).toThrow(/exceeded maximum state size/);
        },
      };

      await pluginSystem.loadPlugin(plugin, registry, true);
    });
  });

  describe('Event Bus Isolation', () => {
    it('should isolate events between plugins', async () => {
      const eventsA: any[] = [];
      const eventsB: any[] = [];

      const pluginA = {
        name: 'plugin-a',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.on('data-updated', (data) => {
            eventsA.push(data);
          });
          
          scope.emit('data-updated', { source: 'A' });
        },
      };

      const pluginB = {
        name: 'plugin-b',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.on('data-updated', (data) => {
            eventsB.push(data);
          });
          
          scope.emit('data-updated', { source: 'B' });
        },
      };

      await pluginSystem.loadPlugin(pluginA, registry, true);
      await pluginSystem.loadPlugin(pluginB, registry, true);

      // Events should be isolated - plugin A should only see its own events
      expect(eventsA).toHaveLength(1);
      expect(eventsA[0]).toEqual({ source: 'A' });
      
      expect(eventsB).toHaveLength(1);
      expect(eventsB[0]).toEqual({ source: 'B' });
    });

    it('should support global events for cross-plugin communication', async () => {
      const globalEvents: any[] = [];

      const pluginA = {
        name: 'plugin-a',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.onGlobal('app-ready', (data) => {
            globalEvents.push({ plugin: 'A', data });
          });
        },
      };

      const pluginB = {
        name: 'plugin-b',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.onGlobal('app-ready', (data) => {
            globalEvents.push({ plugin: 'B', data });
          });
          
          // Emit global event
          scope.emitGlobal('app-ready', { status: 'ready' });
        },
      };

      await pluginSystem.loadPlugin(pluginA, registry, true);
      await pluginSystem.loadPlugin(pluginB, registry, true);

      // Both plugins should receive the global event
      expect(globalEvents).toHaveLength(2);
      expect(globalEvents[0]).toEqual({ plugin: 'A', data: { status: 'ready' } });
      expect(globalEvents[1]).toEqual({ plugin: 'B', data: { status: 'ready' } });
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should cleanup plugin resources on unload', async () => {
      const plugin = {
        name: 'plugin-temp',
        version: '1.0.0',
        register: (scope: PluginScope) => {
          scope.setState('data', { value: 123 });
          scope.registerComponent('temp', () => 'Temp');
        },
      };

      await pluginSystem.loadPlugin(plugin, registry, true);
      
      const scope = pluginSystem.getScope('plugin-temp');
      expect(scope?.getState('data')).toEqual({ value: 123 });

      await pluginSystem.unloadPlugin('plugin-temp');

      // Scope should be cleaned up
      expect(pluginSystem.getScope('plugin-temp')).toBeUndefined();
    });

    it('should call lifecycle hooks', async () => {
      let loadCalled = false;
      let unloadCalled = false;

      const plugin = {
        name: 'plugin-lifecycle',
        version: '1.0.0',
        register: () => {},
        onLoad: async () => {
          loadCalled = true;
        },
        onUnload: async () => {
          unloadCalled = true;
        },
      };

      await pluginSystem.loadPlugin(plugin, registry, true);
      expect(loadCalled).toBe(true);

      await pluginSystem.unloadPlugin('plugin-lifecycle');
      expect(unloadCalled).toBe(true);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should support legacy plugins without scopes', async () => {
      const MockComponent = () => 'Legacy';

      const legacyPlugin = {
        name: 'legacy-plugin',
        version: '1.0.0',
        register: (reg: Registry) => {
          reg.register('legacy', MockComponent);
        },
      };

      // Load without scope
      await pluginSystem.loadPlugin(legacyPlugin, registry, false);

      // Component should be registered directly
      const component = registry.getConfig('legacy');
      expect(component?.component).toBe(MockComponent);
    });
  });
});
