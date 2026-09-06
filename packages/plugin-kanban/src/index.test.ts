/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
// Import all renderers to register them. This was a `beforeAll(async () => {
// await import('./index') }, 15000)` — the cold transform of the renderer graph
// was billed to a hook, so it needed its timeout raised to 15s, and under full
// parallel load it blew even that (observed: 15021ms, reported as 8 skipped tests
// rather than a failed assertion). A static import puts the same cost in the
// file's import phase, which no test or hook timeout applies to — so the raised
// timeout is no longer needed at all.
import './index';

describe('Plugin Kanban', () => {
  describe('kanban component', () => {
    it('should be registered in ComponentRegistry', () => {
      const kanbanRenderer = ComponentRegistry.get('kanban-ui');
      expect(kanbanRenderer).toBeDefined();
    });

    it('should have proper metadata', () => {
      const config = ComponentRegistry.getConfig('kanban-ui');
      expect(config).toBeDefined();
      expect(config?.label).toBe('Kanban Board');
      expect(config?.icon).toBe('LayoutDashboard');
      expect(config?.category).toBe('plugin');
      expect(config?.inputs).toBeDefined();
      expect(config?.defaultProps).toBeDefined();
    });

    it('should have expected inputs', () => {
      const config = ComponentRegistry.getConfig('kanban-ui');
      const inputNames = config?.inputs?.map((input: any) => input.name) || [];
      
      expect(inputNames).toContain('columns');
      expect(inputNames).toContain('onCardMove');
      expect(inputNames).toContain('className');
    });

    it('should have columns as required input', () => {
      const config = ComponentRegistry.getConfig('kanban-ui');
      const columnsInput = config?.inputs?.find((input: any) => input.name === 'columns');
      
      expect(columnsInput).toBeDefined();
      expect(columnsInput?.required).toBe(true);
      expect(columnsInput?.type).toBe('array');
      expect(columnsInput?.description).toBeDefined();
    });

    it('should have onCardMove as code input', () => {
      const config = ComponentRegistry.getConfig('kanban-ui');
      const onCardMoveInput = config?.inputs?.find((input: any) => input.name === 'onCardMove');
      
      expect(onCardMoveInput).toBeDefined();
      expect(onCardMoveInput?.type).toBe('code');
      expect(onCardMoveInput?.description).toBeDefined();
    });

    it('should have sensible default props', () => {
      const config = ComponentRegistry.getConfig('kanban-ui');
      const defaults = config?.defaultProps;
      
      expect(defaults).toBeDefined();
      expect(defaults?.columns).toBeDefined();
      expect(Array.isArray(defaults?.columns)).toBe(true);
      expect(defaults?.columns.length).toBeGreaterThan(0);
      expect(defaults?.className).toBe('w-full');
    });

    it('should have default columns with proper structure', () => {
      const config = ComponentRegistry.getConfig('kanban-ui');
      const defaults = config?.defaultProps;
      const columns = defaults?.columns || [];
      
      // Verify at least 3 columns exist (todo, in-progress, done)
      expect(columns.length).toBeGreaterThanOrEqual(3);
      
      // Verify each column has required properties
      columns.forEach((column: any) => {
        expect(column.id).toBeDefined();
        expect(column.title).toBeDefined();
        expect(column.cards).toBeDefined();
        expect(Array.isArray(column.cards)).toBe(true);
      });
      
      // Verify at least one column has cards
      const hasCards = columns.some((column: any) => column.cards.length > 0);
      expect(hasCards).toBe(true);
    });

    it('should have cards with proper structure', () => {
      const config = ComponentRegistry.getConfig('kanban-ui');
      const defaults = config?.defaultProps;
      const columns = defaults?.columns || [];
      
      // Find a column with cards
      const columnWithCards = columns.find((column: any) => column.cards.length > 0);
      expect(columnWithCards).toBeDefined();
      
      const card = columnWithCards.cards[0];
      expect(card.id).toBeDefined();
      expect(card.title).toBeDefined();
      expect(card.description).toBeDefined();
      expect(card.badges).toBeDefined();
      expect(Array.isArray(card.badges)).toBe(true);
    });
  });
});
