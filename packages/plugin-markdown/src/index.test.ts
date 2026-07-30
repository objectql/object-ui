/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
// Imports all renderers to register them. Module scope, NOT awaited inside a
// `beforeAll` — there the cold transform of the renderer graph is billed to the
// hook, against `hookTimeout`. That is what made the sibling plugin-kanban test
// blow its raised 15s budget at 15021ms under full parallel load
// (objectui#3010); this file's timed portion was already at 5.83s of the same
// 15s. The import phase has no test/hook timeout, so no raised timeout is
// needed. See AGENTS.md §9 (test discipline).
import './index';

describe('Plugin Markdown', () => {
  describe('markdown component', () => {
    it('should be registered in ComponentRegistry', () => {
      const markdownRenderer = ComponentRegistry.get('markdown');
      expect(markdownRenderer).toBeDefined();
    });

    it('should have proper metadata', () => {
      const config = ComponentRegistry.getConfig('markdown');
      expect(config).toBeDefined();
      expect(config?.label).toBe('Markdown');
      expect(config?.category).toBe('plugin');
      expect(config?.inputs).toBeDefined();
      expect(config?.defaultProps).toBeDefined();
    });

    it('should have expected inputs', () => {
      const config = ComponentRegistry.getConfig('markdown');
      const inputNames = config?.inputs?.map((input: any) => input.name) || [];
      
      expect(inputNames).toContain('content');
      expect(inputNames).toContain('className');
    });

    it('should have content as required input', () => {
      const config = ComponentRegistry.getConfig('markdown');
      const contentInput = config?.inputs?.find((input: any) => input.name === 'content');
      
      expect(contentInput).toBeDefined();
      expect(contentInput?.required).toBe(true);
      expect(contentInput?.type).toBe('string');
      expect(contentInput?.inputType).toBe('textarea');
    });

    it('should have sensible default props', () => {
      const config = ComponentRegistry.getConfig('markdown');
      const defaults = config?.defaultProps;
      
      expect(defaults).toBeDefined();
      expect(defaults?.content).toBeDefined();
      expect(typeof defaults?.content).toBe('string');
      expect(defaults?.content.length).toBeGreaterThan(0);
      // Verify it contains markdown syntax
      expect(defaults?.content).toContain('#');
    });
  });
});
