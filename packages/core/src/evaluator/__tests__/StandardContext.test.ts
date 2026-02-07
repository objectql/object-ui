/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { buildStandardContext } from '../StandardContext';

describe('StandardContext', () => {
  describe('buildStandardContext', () => {
    it('should provide default empty namespaces', () => {
      const ctx = buildStandardContext();
      
      expect(ctx.data).toEqual({});
      expect(ctx.record).toEqual({});
      expect(ctx.form).toEqual({});
      expect(ctx.user).toEqual({});
      expect(ctx.page).toEqual({});
      expect(ctx.params).toEqual({});
      expect(ctx.env).toEqual({});
    });

    it('should set data and record as aliases', () => {
      const ctx = buildStandardContext({
        data: { name: 'Alice', id: '1' },
      });

      expect(ctx.data.name).toBe('Alice');
      expect(ctx.record.name).toBe('Alice');
      // They reference the same object
      expect(ctx.data).toBe(ctx.record);
    });

    it('should default form to data when not provided', () => {
      const ctx = buildStandardContext({
        data: { status: 'active' },
      });

      expect(ctx.form.status).toBe('active');
    });

    it('should allow separate form data', () => {
      const ctx = buildStandardContext({
        data: { id: '1' },
        form: { status: 'draft', name: 'Test' },
      });

      expect(ctx.data.id).toBe('1');
      expect(ctx.form.status).toBe('draft');
      expect(ctx.form.name).toBe('Test');
    });

    it('should include user context', () => {
      const ctx = buildStandardContext({
        user: { id: 'u1', name: 'Admin', roles: ['admin'] },
      });

      expect(ctx.user.id).toBe('u1');
      expect(ctx.user.name).toBe('Admin');
      expect(ctx.user.roles).toEqual(['admin']);
    });

    it('should include page context', () => {
      const ctx = buildStandardContext({
        page: { title: 'Dashboard', type: 'home', objectName: 'accounts' },
      });

      expect(ctx.page.title).toBe('Dashboard');
      expect(ctx.page.type).toBe('home');
    });

    it('should include params and env', () => {
      const ctx = buildStandardContext({
        params: { orderId: '123' },
        env: { mode: 'development', baseUrl: '/api' },
      });

      expect(ctx.params.orderId).toBe('123');
      expect(ctx.env.mode).toBe('development');
    });

    it('should include index and parent', () => {
      const ctx = buildStandardContext({
        data: { lineItem: 'Widget' },
        index: 3,
        parent: { orderId: 'O-100' },
      });

      expect(ctx.index).toBe(3);
      expect(ctx.parent).toEqual({ orderId: 'O-100' });
    });

    it('should merge extra custom variables at top level', () => {
      const ctx = buildStandardContext({
        data: { name: 'Test' },
        extra: { customFlag: true, appVersion: '2.0' },
      });

      expect(ctx.data.name).toBe('Test');
      expect((ctx as any).customFlag).toBe(true);
      expect((ctx as any).appVersion).toBe('2.0');
    });
  });
});
