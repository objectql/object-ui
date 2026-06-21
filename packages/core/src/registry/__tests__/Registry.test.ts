/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Registry } from '../Registry';

describe('Registry', () => {
  let registry: Registry;
  let consoleWarnSpy: any;

  beforeEach(() => {
    registry = new Registry();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('Basic Registration', () => {
    it('should register a component without namespace', () => {
      const component = () => 'test';
      registry.register('button', component);
      
      expect(registry.has('button')).toBe(true);
      expect(registry.get('button')).toBe(component);
    });

    it('should warn when registering without namespace', () => {
      const component = () => 'test';
      registry.register('button', component);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registering component "button" without a namespace is deprecated')
      );
    });

    it('should register a component with namespace', () => {
      const component = () => 'test';
      registry.register('button', component, { namespace: 'ui' });
      
      expect(registry.has('button', 'ui')).toBe(true);
      expect(registry.get('button', 'ui')).toBe(component);
    });

    it('should not warn when registering with namespace', () => {
      const component = () => 'test';
      registry.register('button', component, { namespace: 'ui' });
      
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('Namespaced Registration', () => {
    it('should register components with the same name in different namespaces', () => {
      const gridComponent1 = () => 'grid1';
      const gridComponent2 = () => 'grid2';
      
      registry.register('grid', gridComponent1, { namespace: 'plugin-grid' });
      registry.register('grid', gridComponent2, { namespace: 'plugin-view' });
      
      expect(registry.get('grid', 'plugin-grid')).toBe(gridComponent1);
      expect(registry.get('grid', 'plugin-view')).toBe(gridComponent2);
    });

    it('should store full type as namespace:type', () => {
      const component = () => 'test';
      registry.register('button', component, { namespace: 'ui' });
      
      const config = registry.getConfig('button', 'ui');
      expect(config?.type).toBe('ui:button');
    });

    it('should preserve namespace in component config', () => {
      const component = () => 'test';
      registry.register('button', component, { 
        namespace: 'ui',
        label: 'Button',
        category: 'form'
      });
      
      const config = registry.getConfig('button', 'ui');
      expect(config?.namespace).toBe('ui');
      expect(config?.label).toBe('Button');
      expect(config?.category).toBe('form');
    });
  });

  describe('Namespace Lookup with Fallback', () => {
    it('should not fallback when namespace is explicitly specified', () => {
      const component = () => 'test';
      registry.register('button', component);
      
      // When no namespace is specified, should find it
      expect(registry.get('button')).toBe(component);
      
      // When namespace is specified but component isn't in that namespace, should return undefined
      expect(registry.get('button', 'ui')).toBeUndefined();
    });

    it('should prefer namespaced component over non-namespaced', () => {
      const component1 = () => 'non-namespaced';
      const component2 = () => 'namespaced';
      
      registry.register('button', component1);
      registry.register('button', component2, { namespace: 'ui' });
      
      // When searching with namespace, should get namespaced version
      expect(registry.get('button', 'ui')).toBe(component2);
      
      // When searching without namespace, should get the latest registered (namespaced one due to backward compatibility)
      expect(registry.get('button')).toBe(component2);
    });

    it('should return undefined when component not found in any namespace', () => {
      expect(registry.get('nonexistent', 'ui')).toBeUndefined();
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has() method', () => {
    it('should check existence with namespace', () => {
      const component = () => 'test';
      registry.register('button', component, { namespace: 'ui' });
      
      expect(registry.has('button', 'ui')).toBe(true);
      // Due to backward compatibility, non-namespaced lookup also works
      expect(registry.has('button')).toBe(true);
      // Other namespaces should return false
      expect(registry.has('button', 'other')).toBe(false);
    });

    it('should fallback to non-namespaced check only when no namespace provided', () => {
      const component = () => 'test';
      registry.register('button', component);
      
      expect(registry.has('button')).toBe(true);
      // When namespace is explicitly requested, should not find non-namespaced component
      expect(registry.has('button', 'ui')).toBe(false);
    });
  });

  describe('getConfig() method', () => {
    it('should get config with namespace', () => {
      const component = () => 'test';
      registry.register('button', component, { 
        namespace: 'ui',
        label: 'Button' 
      });
      
      const config = registry.getConfig('button', 'ui');
      expect(config).toBeDefined();
      expect(config?.component).toBe(component);
      expect(config?.label).toBe('Button');
    });

    it('should not fallback when namespace is explicitly provided', () => {
      const component = () => 'test';
      registry.register('button', component, { label: 'Button' });
      
      // When no namespace is provided, should find it
      const config1 = registry.getConfig('button');
      expect(config1).toBeDefined();
      
      // When namespace is provided but component isn't in that namespace, should return undefined
      const config2 = registry.getConfig('button', 'ui');
      expect(config2).toBeUndefined();
    });
  });

  describe('getAllTypes() and getAllConfigs()', () => {
    it('should return all registered types including namespaced ones', () => {
      registry.register('button', () => 'b1');
      registry.register('input', () => 'i1', { namespace: 'ui' });
      registry.register('grid', () => 'g1', { namespace: 'plugin-grid' });
      
      const types = registry.getAllTypes();
      // Due to backward compatibility, namespaced components are stored under both keys
      expect(types).toContain('button');
      expect(types).toContain('ui:input');
      expect(types).toContain('input'); // backward compat
      expect(types).toContain('plugin-grid:grid');
      expect(types).toContain('grid'); // backward compat
    });

    it('should return all configs', () => {
      registry.register('button', () => 'b1', { label: 'Button' });
      registry.register('input', () => 'i1', { 
        namespace: 'ui',
        label: 'Input' 
      });
      
      const configs = registry.getAllConfigs();
      // Due to backward compatibility, namespaced components are stored twice
      expect(configs.length).toBeGreaterThanOrEqual(2);
      expect(configs.map(c => c.type)).toContain('button');
      expect(configs.map(c => c.type)).toContain('ui:input');
    });
  });

  describe('Conflict Prevention', () => {
    it('should allow same type name in different namespaces', () => {
      const grid1 = () => 'grid-plugin-1';
      const grid2 = () => 'grid-plugin-2';
      
      registry.register('grid', grid1, { namespace: 'plugin-grid' });
      registry.register('grid', grid2, { namespace: 'plugin-view' });
      
      expect(registry.get('grid', 'plugin-grid')).toBe(grid1);
      expect(registry.get('grid', 'plugin-view')).toBe(grid2);
    });

    it('should handle complex namespace names', () => {
      const component = () => 'test';
      registry.register('table', component, { namespace: 'plugin-advanced-grid' });
      
      expect(registry.get('table', 'plugin-advanced-grid')).toBe(component);
      expect(registry.getConfig('table', 'plugin-advanced-grid')?.type).toBe('plugin-advanced-grid:table');
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing non-namespaced code', () => {
      const component = () => 'test';
      
      // Old-style registration
      registry.register('button', component);
      
      // Old-style retrieval should still work
      expect(registry.get('button')).toBe(component);
      expect(registry.has('button')).toBe(true);
      expect(registry.getConfig('button')).toBeDefined();
    });

    it('should support mixed namespaced and non-namespaced registrations', () => {
      const oldButton = () => 'old';
      const newButton = () => 'new';
      
      registry.register('button-old', oldButton);
      registry.register('button-new', newButton, { namespace: 'ui' });
      
      expect(registry.get('button-old')).toBe(oldButton);
      expect(registry.get('button-new', 'ui')).toBe(newButton);
    });
    
    it('should allow non-namespaced lookup of namespaced components', () => {
      const component = () => 'test';
      
      // Register with namespace
      registry.register('button', component, { namespace: 'ui' });
      
      // Should be findable both ways for backward compatibility
      expect(registry.get('button')).toBe(component);
      expect(registry.get('button', 'ui')).toBe(component);
      
      // The full type should be namespaced
      const config = registry.getConfig('button');
      expect(config?.type).toBe('ui:button');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty namespace string', () => {
      const component = () => 'test';
      registry.register('button', component, { namespace: '' });
      
      // Empty namespace should be treated as no namespace
      expect(registry.get('button')).toBe(component);
    });

    it('should handle namespace with special characters', () => {
      const component = () => 'test';
      registry.register('button', component, { namespace: 'plugin-my-custom' });
      
      expect(registry.get('button', 'plugin-my-custom')).toBe(component);
    });

    it('should handle undefined meta', () => {
      const component = () => 'test';
      registry.register('button', component, undefined);
      
      expect(registry.get('button')).toBe(component);
    });
  });

  describe('skipFallback / bare-name collisions', () => {
    it('skipFallback prevents a namespaced registration from claiming the bare name', () => {
      const layout = () => 'layout-grid';
      const objectGrid = () => 'object-grid';
      // Layout component owns the bare `grid` key.
      registry.register('grid', layout, { namespace: 'layout' });
      // A view-namespaced alias registered WITHOUT skipFallback would clobber it;
      // WITH skipFallback it only registers `view:grid` and leaves bare `grid`.
      registry.register('grid', objectGrid, { namespace: 'view', skipFallback: true });

      expect(registry.get('grid')).toBe(layout);          // bare unchanged
      expect(registry.get('grid', 'view')).toBe(objectGrid); // namespaced still available
    });

    it('warns when a namespaced registration overwrites a DIFFERENT bare component', () => {
      const layout = () => 'layout-grid';
      const objectGrid = () => 'object-grid';
      registry.register('grid', layout, { namespace: 'layout' });
      registry.register('grid', objectGrid, { namespace: 'view' }); // no skipFallback → clobbers + warns

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(registry.get('grid')).toBe(objectGrid); // last-wins (documented behaviour)
    });

    it('does not warn when re-registering the same component under its namespace', () => {
      const same = () => 'same';
      registry.register('thing', same, { namespace: 'a' });
      consoleWarnSpy.mockClear();
      registry.register('thing', same, { namespace: 'a' });
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  // Regression guard for the dev-console collision warnings. The real packages
  // register a form-input/display/view/plugin component under a bare name AND a
  // `field:`/`view:`/`plugin-markdown:` namespaced renderer that shares the same
  // short name. The bare key must stay with the DISPLAY/UI/view owner (forms
  // reach the field widget via the explicit `field:<type>` lookup), and no
  // collision warning must fire. Each case below mirrors the registration order
  // and skipFallback flags used by the shipping code.
  describe('bare-name ownership for field vs display/view/plugin collisions', () => {
    // [bareName, sequence in registration order]. The LAST entry whose
    // skipFallback is falsy owns the bare key; `owner` asserts the intended one.
    const CASES: Array<{
      name: string;
      owner: string; // namespace expected to own the bare key
      seq: Array<{ ns: string; skipFallback?: boolean }>;
    }> = [
      // @object-ui/components registers `ui:*` first (owns bare), then
      // @object-ui/fields registers `field:*` with skipFallback.
      { name: 'textarea', owner: 'ui', seq: [{ ns: 'ui' }, { ns: 'field', skipFallback: true }] },
      { name: 'select', owner: 'ui', seq: [{ ns: 'ui' }, { ns: 'field', skipFallback: true }] },
      { name: 'email', owner: 'ui', seq: [{ ns: 'ui' }, { ns: 'field', skipFallback: true }] },
      { name: 'password', owner: 'ui', seq: [{ ns: 'ui' }, { ns: 'field', skipFallback: true }] },
      { name: 'slider', owner: 'ui', seq: [{ ns: 'ui' }, { ns: 'field', skipFallback: true }] },
      // The bullet-list display primitive owns bare `list`; the data ListView is
      // a namespaced-only `view:list` alias.
      { name: 'list', owner: 'ui', seq: [{ ns: 'ui' }, { ns: 'view', skipFallback: true }] },
      // The markdown editor field registers first (skipFallback), then the
      // markdown DISPLAY plugin claims the bare key.
      { name: 'markdown', owner: 'plugin-markdown', seq: [{ ns: 'field', skipFallback: true }, { ns: 'plugin-markdown' }] },
    ];

    for (const { name, owner, seq } of CASES) {
      it(`bare "${name}" resolves to the "${owner}" owner with no collision warning`, () => {
        const components: Record<string, () => string> = {};
        for (const { ns, skipFallback } of seq) {
          const component = () => `${ns}:${name}`;
          components[ns] = component;
          registry.register(name, component, { namespace: ns, skipFallback });
        }

        // Bare key resolves to the intended display/view/plugin owner.
        expect(registry.get(name)).toBe(components[owner]);
        // Every namespaced renderer remains reachable via its explicit key —
        // this is the lookup forms use (`field:<type>`), so they are unaffected.
        for (const { ns } of seq) {
          expect(registry.get(name, ns)).toBe(components[ns]);
        }
        // No "bare-name fallback is being overwritten" warning.
        const collisionWarned = consoleWarnSpy.mock.calls.some((args: unknown[]) =>
          typeof args[0] === 'string' && args[0].includes('bare-name fallback is being overwritten'),
        );
        expect(collisionWarned).toBe(false);
      });
    }

    it('still warns if a field renderer drops skipFallback and clobbers the bare display key', () => {
      const display = () => 'ui:textarea';
      const field = () => 'field:textarea';
      registry.register('textarea', display, { namespace: 'ui' });
      // Simulate the bug this fix prevents: field:* without skipFallback.
      registry.register('textarea', field, { namespace: 'field' });
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(registry.get('textarea')).toBe(field); // bare clobbered (the regression)
    });
  });
});
