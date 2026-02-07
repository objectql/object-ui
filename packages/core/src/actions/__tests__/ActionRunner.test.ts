/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ActionRunner,
  executeAction,
  type ActionDef,
  type ActionContext,
  type ActionResult,
} from '../ActionRunner';

describe('ActionRunner', () => {
  let runner: ActionRunner;
  let context: ActionContext;

  beforeEach(() => {
    context = {
      data: { id: 1, name: 'Test' },
      record: { id: 1, status: 'active' },
      user: { id: 'u1', role: 'admin' },
    };
    runner = new ActionRunner(context);
  });

  // ==========================================================================
  // Basic execution
  // ==========================================================================

  describe('basic execution', () => {
    it('should execute an onClick callback', async () => {
      const onClick = vi.fn();
      const result = await runner.execute({ onClick });
      expect(result.success).toBe(true);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('should handle async onClick', async () => {
      const onClick = vi.fn().mockResolvedValue(undefined);
      const result = await runner.execute({ onClick });
      expect(result.success).toBe(true);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('should catch errors and return failure', async () => {
      const onClick = vi.fn().mockRejectedValue(new Error('boom'));
      const result = await runner.execute({ onClick });
      expect(result.success).toBe(false);
      expect(result.error).toBe('boom');
    });
  });

  // ==========================================================================
  // Conditions and disabled
  // ==========================================================================

  describe('conditions', () => {
    it('should skip action when condition evaluates to false', async () => {
      const onClick = vi.fn();
      const result = await runner.execute({
        condition: '${record.status === "inactive"}',
        onClick,
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Action condition not met');
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should execute action when condition evaluates to true', async () => {
      const onClick = vi.fn();
      const result = await runner.execute({
        condition: '${record.status === "active"}',
        onClick,
      });
      expect(result.success).toBe(true);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('should skip action when disabled is true (boolean)', async () => {
      const onClick = vi.fn();
      const result = await runner.execute({ disabled: true, onClick });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Action is disabled');
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should skip action when disabled expression evaluates to true', async () => {
      const onClick = vi.fn();
      const result = await runner.execute({
        disabled: '${user.role === "admin"}',
        onClick,
      });
      expect(result.success).toBe(false);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Confirmation
  // ==========================================================================

  describe('confirmation', () => {
    it('should show confirmation and proceed when accepted', async () => {
      const confirmHandler = vi.fn().mockResolvedValue(true);
      runner.setConfirmHandler(confirmHandler);

      const onClick = vi.fn();
      const result = await runner.execute({
        confirmText: 'Are you sure?',
        onClick,
      });

      expect(confirmHandler).toHaveBeenCalledWith('Are you sure?', undefined);
      expect(result.success).toBe(true);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('should cancel when confirmation is rejected', async () => {
      const confirmHandler = vi.fn().mockResolvedValue(false);
      runner.setConfirmHandler(confirmHandler);

      const onClick = vi.fn();
      const result = await runner.execute({
        confirmText: 'Are you sure?',
        onClick,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Action cancelled by user');
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should support structured confirmation', async () => {
      const confirmHandler = vi.fn().mockResolvedValue(true);
      runner.setConfirmHandler(confirmHandler);

      await runner.execute({
        confirm: {
          title: 'Delete',
          message: 'Delete this item?',
          confirmText: 'Yes, delete',
          cancelText: 'Cancel',
        },
        onClick: vi.fn(),
      });

      expect(confirmHandler).toHaveBeenCalledWith('Delete this item?', {
        title: 'Delete',
        confirmText: 'Yes, delete',
        cancelText: 'Cancel',
      });
    });
  });

  // ==========================================================================
  // Custom handlers
  // ==========================================================================

  describe('custom handlers', () => {
    it('should dispatch to registered custom handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true, data: 42 });
      runner.registerHandler('my-action', handler);

      const action: ActionDef = { type: 'my-action', params: { foo: 'bar' } };
      const result = await runner.execute(action);

      expect(handler).toHaveBeenCalledWith(action, context);
      expect(result.success).toBe(true);
      expect(result.data).toBe(42);
    });

    it('should allow unregistering a handler', async () => {
      const handler = vi.fn().mockResolvedValue({ success: true });
      runner.registerHandler('temp', handler);
      runner.unregisterHandler('temp');

      const result = await runner.execute({ type: 'temp', onClick: vi.fn() });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Script action type
  // ==========================================================================

  describe('script action type', () => {
    it('should evaluate script expression', async () => {
      const result = await runner.execute({
        type: 'script',
        execute: 'record.id + 100',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe(101);
    });

    it('should evaluate script with string target fallback', async () => {
      const result = await runner.execute({
        type: 'script',
        target: 'data.name',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe('Test');
    });

    it('should fail when no script provided', async () => {
      const result = await runner.execute({ type: 'script' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No script provided');
    });

    it('should return data as undefined for expressions referencing missing vars', async () => {
      const result = await runner.execute({
        type: 'script',
        execute: 'data.nonExistent',
      });
      // ExpressionEvaluator returns undefined for missing properties (doesn't throw)
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  // ==========================================================================
  // URL action type
  // ==========================================================================

  describe('url action type', () => {
    it('should return redirect for relative URL', async () => {
      const result = await runner.execute({
        type: 'url',
        target: '/dashboard',
      });
      expect(result.success).toBe(true);
      expect(result.redirect).toBe('/dashboard');
    });

    it('should use navigation handler when provided', async () => {
      const navHandler = vi.fn();
      runner.setNavigationHandler(navHandler);

      const result = await runner.execute({
        type: 'url',
        target: '/dashboard',
      });

      expect(result.success).toBe(true);
      expect(navHandler).toHaveBeenCalledWith('/dashboard', {
        external: false,
        newTab: false,
      });
    });

    it('should detect external URLs', async () => {
      const navHandler = vi.fn();
      runner.setNavigationHandler(navHandler);

      await runner.execute({
        type: 'url',
        target: 'https://example.com',
      });

      expect(navHandler).toHaveBeenCalledWith('https://example.com', {
        external: true,
        newTab: true,
      });
    });

    it('should reject javascript: URLs', async () => {
      const result = await runner.execute({
        type: 'url',
        target: 'javascript:alert(1)',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should fail when no URL provided', async () => {
      const result = await runner.execute({ type: 'url' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No URL provided');
    });
  });

  // ==========================================================================
  // Modal action type
  // ==========================================================================

  describe('modal action type', () => {
    it('should return modal schema when no handler registered', async () => {
      const modalSchema = { type: 'dialog', title: 'Edit' };
      const result = await runner.execute({
        type: 'modal',
        modal: modalSchema,
      });
      expect(result.success).toBe(true);
      expect(result.modal).toEqual(modalSchema);
    });

    it('should delegate to modal handler when provided', async () => {
      const modalHandler = vi.fn().mockResolvedValue({ success: true, data: { saved: true } });
      runner.setModalHandler(modalHandler);

      const modalSchema = { type: 'form', fields: [] };
      const result = await runner.execute({
        type: 'modal',
        modal: modalSchema,
      });

      expect(modalHandler).toHaveBeenCalledWith(modalSchema, context);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ saved: true });
    });

    it('should use target as modal schema fallback', async () => {
      const result = await runner.execute({
        type: 'modal',
        target: 'edit_form',
      });
      expect(result.success).toBe(true);
      expect(result.modal).toBe('edit_form');
    });

    it('should fail when no modal schema/target provided', async () => {
      const result = await runner.execute({ type: 'modal' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No modal schema');
    });
  });

  // ==========================================================================
  // Flow action type
  // ==========================================================================

  describe('flow action type', () => {
    it('should delegate to registered flow handler', async () => {
      const flowHandler = vi.fn().mockResolvedValue({ success: true, data: 'flow_started' });
      runner.registerHandler('flow', flowHandler);

      const action: ActionDef = { type: 'flow', target: 'approval_flow' };
      const result = await runner.execute(action);

      expect(flowHandler).toHaveBeenCalledWith(action, context);
      expect(result.success).toBe(true);
    });

    it('should fail when no flow handler registered', async () => {
      const result = await runner.execute({ type: 'flow', target: 'my_flow' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Flow handler not registered');
    });

    it('should fail when no flow target provided', async () => {
      const result = await runner.execute({ type: 'flow' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No flow target');
    });
  });

  // ==========================================================================
  // API action type
  // ==========================================================================

  describe('api action type', () => {
    it('should call fetch with simple string endpoint', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ id: 1 }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await runner.execute({
        type: 'api',
        api: '/api/records',
        method: 'GET',
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/records', expect.objectContaining({
        method: 'GET',
      }));
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1 });
    });

    it('should use endpoint field as alias', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ ok: true }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await runner.execute({
        type: 'api',
        endpoint: '/api/v2/records',
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/v2/records', expect.any(Object));
      expect(result.success).toBe(true);
    });

    it('should support complex API config', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({ done: true }) };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await runner.execute({
        type: 'api',
        api: {
          url: '/api/records',
          method: 'PUT',
          headers: { Authorization: 'Bearer xyz' },
          body: { name: 'Updated' },
          queryParams: { include: 'details' },
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/records?include=details',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({ Authorization: 'Bearer xyz' }),
          body: JSON.stringify({ name: 'Updated' }),
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should handle HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await runner.execute({
        type: 'api',
        api: '/api/missing',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await runner.execute({
        type: 'api',
        api: '/api/records',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should fail when no endpoint provided', async () => {
      const result = await runner.execute({ type: 'api' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No API endpoint');
    });
  });

  // ==========================================================================
  // Navigation action type
  // ==========================================================================

  describe('navigation action type', () => {
    it('should return redirect for internal navigation', async () => {
      const result = await runner.execute({
        type: 'navigation',
        navigate: { to: '/records/1' },
      });
      expect(result.success).toBe(true);
      expect(result.redirect).toBe('/records/1');
    });

    it('should use navigation handler when provided', async () => {
      const navHandler = vi.fn();
      runner.setNavigationHandler(navHandler);

      await runner.execute({
        type: 'navigation',
        navigate: { to: '/records/1', replace: true },
      });

      expect(navHandler).toHaveBeenCalledWith('/records/1', expect.objectContaining({
        replace: true,
      }));
    });

    it('should reject invalid URLs', async () => {
      const result = await runner.execute({
        type: 'navigation',
        navigate: { to: 'data:text/html,...' },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });
  });

  // ==========================================================================
  // Post-execution: toast, refreshAfter
  // ==========================================================================

  describe('post-execution', () => {
    it('should emit success toast', async () => {
      const toastHandler = vi.fn();
      runner.setToastHandler(toastHandler);

      await runner.execute({
        onClick: vi.fn(),
        successMessage: 'Saved!',
      });

      expect(toastHandler).toHaveBeenCalledWith('Saved!', { type: 'success', duration: undefined });
    });

    it('should emit error toast on failure', async () => {
      const toastHandler = vi.fn();
      runner.setToastHandler(toastHandler);

      await runner.execute({
        onClick: vi.fn().mockRejectedValue(new Error('fail')),
        errorMessage: 'Custom error',
      });

      expect(toastHandler).toHaveBeenCalledWith('Custom error', { type: 'error', duration: undefined });
    });

    it('should suppress toast when showOnSuccess is false', async () => {
      const toastHandler = vi.fn();
      runner.setToastHandler(toastHandler);

      await runner.execute({
        onClick: vi.fn(),
        toast: { showOnSuccess: false },
      });

      expect(toastHandler).not.toHaveBeenCalled();
    });

    it('should set reload when refreshAfter is true', async () => {
      const toastHandler = vi.fn();
      runner.setToastHandler(toastHandler);

      const result = await runner.execute({
        onClick: vi.fn(),
        refreshAfter: true,
        toast: { showOnSuccess: false },
      });

      expect(result.reload).toBe(true);
    });
  });

  // ==========================================================================
  // Action chaining
  // ==========================================================================

  describe('chaining', () => {
    it('should execute chained actions sequentially', async () => {
      const order: number[] = [];
      const handler1 = vi.fn(async () => { order.push(1); return { success: true }; });
      const handler2 = vi.fn(async () => { order.push(2); return { success: true }; });
      runner.registerHandler('step1', handler1);
      runner.registerHandler('step2', handler2);

      const result = await runner.execute({
        onClick: vi.fn(),
        chain: [
          { type: 'step1' },
          { type: 'step2' },
        ],
      });

      expect(result.success).toBe(true);
      expect(order).toEqual([1, 2]);
    });

    it('should stop sequential chain on failure', async () => {
      const handler1 = vi.fn().mockResolvedValue({ success: false, error: 'step1 fail' });
      const handler2 = vi.fn().mockResolvedValue({ success: true });
      runner.registerHandler('step1', handler1);
      runner.registerHandler('step2', handler2);

      const result = await runner.execute({
        onClick: vi.fn(),
        chain: [
          { type: 'step1' },
          { type: 'step2' },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('step1 fail');
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should execute chained actions in parallel', async () => {
      const handler1 = vi.fn().mockResolvedValue({ success: true });
      const handler2 = vi.fn().mockResolvedValue({ success: true });
      runner.registerHandler('a', handler1);
      runner.registerHandler('b', handler2);

      const result = await runner.execute({
        onClick: vi.fn(),
        chain: [{ type: 'a' }, { type: 'b' }],
        chainMode: 'parallel',
      });

      expect(result.success).toBe(true);
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });
  });

  // ==========================================================================
  // onSuccess / onFailure callbacks
  // ==========================================================================

  describe('callbacks', () => {
    it('should execute onSuccess callback after success', async () => {
      const successHandler = vi.fn().mockResolvedValue({ success: true });
      runner.registerHandler('notify', successHandler);

      await runner.execute({
        onClick: vi.fn(),
        onSuccess: { type: 'notify', params: { msg: 'ok' } },
        toast: { showOnSuccess: false },
      });

      expect(successHandler).toHaveBeenCalledOnce();
    });

    it('should execute onFailure callback after failure', async () => {
      const failureHandler = vi.fn().mockResolvedValue({ success: true });
      runner.registerHandler('log-error', failureHandler);

      await runner.execute({
        onClick: vi.fn().mockRejectedValue(new Error('fail')),
        onFailure: { type: 'log-error' },
        toast: { showOnError: false },
      });

      expect(failureHandler).toHaveBeenCalledOnce();
    });

    it('should support array of onSuccess callbacks', async () => {
      const h1 = vi.fn().mockResolvedValue({ success: true });
      const h2 = vi.fn().mockResolvedValue({ success: true });
      runner.registerHandler('cb1', h1);
      runner.registerHandler('cb2', h2);

      await runner.execute({
        onClick: vi.fn(),
        onSuccess: [{ type: 'cb1' }, { type: 'cb2' }],
        toast: { showOnSuccess: false },
      });

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });
  });

  // ==========================================================================
  // executeChain
  // ==========================================================================

  describe('executeChain', () => {
    it('should return success for empty chain', async () => {
      const result = await runner.executeChain([]);
      expect(result.success).toBe(true);
    });

    it('should execute single action chain', async () => {
      const onClick = vi.fn();
      const result = await runner.executeChain([{ onClick }]);
      expect(result.success).toBe(true);
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  // ==========================================================================
  // Context management
  // ==========================================================================

  describe('context', () => {
    it('should update context', () => {
      runner.updateContext({ record: { id: 2, status: 'closed' } });
      const ctx = runner.getContext();
      expect(ctx.record?.id).toBe(2);
    });

    it('should expose evaluator', () => {
      const ev = runner.getEvaluator();
      expect(ev).toBeDefined();
      expect(ev.evaluate('${data.name}')).toBe('Test');
    });
  });

  // ==========================================================================
  // executeAction convenience function
  // ==========================================================================

  describe('executeAction', () => {
    it('should execute an action with the convenience function', async () => {
      const result = await executeAction(
        { type: 'script', execute: '1 + 2' },
        { data: {} },
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
    });
  });
});
