/**
 * Tests for useActionEngine hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActionEngine } from '../useActionEngine';

describe('useActionEngine', () => {
  const sampleActions = [
    {
      name: 'mark_complete',
      type: 'script',
      target: 'true',
      locations: ['list_toolbar', 'record_header'],
      bulkEnabled: true,
    },
    {
      name: 'delete_record',
      type: 'api',
      endpoint: '/api/delete',
      locations: ['record_more'],
    },
    {
      name: 'view_details',
      type: 'url',
      target: '/details',
      locations: ['list_item'],
    },
    {
      name: 'global_search',
      type: 'script',
      target: 'true',
      locations: ['global_nav'],
      shortcut: 'ctrl+k',
    },
  ];

  describe('getActionsForLocation', () => {
    it('returns actions for list_toolbar', () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      const actions = result.current.getActionsForLocation('list_toolbar');
      expect(actions.length).toBe(1);
      expect(actions[0].name).toBe('mark_complete');
    });

    it('returns actions for record_header', () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      const actions = result.current.getActionsForLocation('record_header');
      expect(actions.length).toBe(1);
      expect(actions[0].name).toBe('mark_complete');
    });

    it('returns actions for record_more', () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      const actions = result.current.getActionsForLocation('record_more');
      expect(actions.length).toBe(1);
      expect(actions[0].name).toBe('delete_record');
    });

    it('returns empty array for location with no actions', () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      const actions = result.current.getActionsForLocation('record_related');
      expect(actions.length).toBe(0);
    });
  });

  describe('getBulkActions', () => {
    // Deliberately INVERTED. `sampleActions` still carries the stale
    // `bulkEnabled: true` — spec 17 retired the key as a `retiredKey()`
    // tombstone, so metadata like this no longer parses at all, and harvesting
    // it here made a dead registration option look load-bearing. Same posture
    // as plugin-grid's "ignores a stale bulkEnabled flag on an object action".
    // The engine's bulk mechanics keep their coverage in ActionEngine.test.ts,
    // where a HOST passes `{ bulkEnabled: true }` to `registerAction`
    // explicitly — which is still supported.
    it('does not harvest the retired bulkEnabled key from metadata', () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      expect(result.current.getBulkActions()).toEqual([]);
    });
  });

  describe('executeAction', () => {
    it('executes a registered action by name', async () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      let actionResult: any;
      await act(async () => {
        actionResult = await result.current.executeAction('mark_complete');
      });

      expect(actionResult.success).toBe(true);
    });

    it('returns error for unregistered action', async () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      let actionResult: any;
      await act(async () => {
        actionResult = await result.current.executeAction('nonexistent');
      });

      expect(actionResult.success).toBe(false);
      expect(actionResult.error).toContain('not found');
    });
  });

  describe('handleShortcut', () => {
    // Deliberately INVERTED, for the same reason as getBulkActions above:
    // `sampleActions` still declares the stale `shortcut: 'ctrl+k'`, which
    // spec 17 retired. Its tombstone is explicit that nothing ever consumed it
    // ("no keydown listener feeds ActionEngine.getShortcuts(), and objectui's
    // keyboard stack is hand-registered and never consults action metadata"),
    // so harvesting it only kept a dead path looking alive. A host that wants
    // a shortcut still passes one to `registerAction` explicitly.
    it('does not harvest the retired shortcut key from metadata', async () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      let shortcutResult: any;
      await act(async () => {
        shortcutResult = await result.current.handleShortcut('ctrl+k');
      });

      expect(shortcutResult).toBeNull();
    });

    it('returns null for unregistered shortcut', async () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: sampleActions }),
      );

      let shortcutResult: any;
      await act(async () => {
        shortcutResult = await result.current.handleShortcut('ctrl+z');
      });

      expect(shortcutResult).toBeNull();
    });
  });

  describe('defaults', () => {
    it('works with no options', () => {
      const { result } = renderHook(() => useActionEngine());

      expect(result.current.engine).toBeDefined();
      expect(typeof result.current.getActionsForLocation).toBe('function');
      expect(typeof result.current.getBulkActions).toBe('function');
      expect(typeof result.current.executeAction).toBe('function');
      expect(typeof result.current.handleShortcut).toBe('function');
    });

    it('works with empty actions array', () => {
      const { result } = renderHook(() =>
        useActionEngine({ actions: [] }),
      );

      const actions = result.current.getActionsForLocation('list_toolbar');
      expect(actions).toEqual([]);
    });
  });
});
