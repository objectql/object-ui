// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  persistRuntimeMetadata,
  publishRuntimeMetadata,
  createRuntimeMetadata,
  readRuntimeDraft,
  discardRuntimeDraft,
  unwrapDraftBody,
  recordPageName,
  recordPageEnvelope,
  viewEnvelope,
  deriveViewKey,
} from './runtime-metadata-persistence';

/**
 * ADR-0034 seam tests.
 *
 * The seam is metadata-only: every call routes to the `MetadataClient`
 * draft/publish API (`sys_*` tables retired). Saves stage a per-item draft;
 * publish promotes it.
 */

function makeMetadataClient() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
    reset: vi.fn().mockResolvedValue(undefined),
  };
}

describe('runtime-metadata-persistence seam (ADR-0034)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persistRuntimeMetadata → save(type, name, body, { mode: "draft" })', async () => {
    const metadataClient = makeMetadataClient();
    const body = { title: 'Pipeline' };

    await persistRuntimeMetadata('report', 'my_report', body, { metadataClient });

    expect(metadataClient.save).toHaveBeenCalledTimes(1);
    expect(metadataClient.save).toHaveBeenCalledWith('report', 'my_report', body, {
      mode: 'draft',
    });
  });

  it('persistRuntimeMetadata works for view / dashboard / page too', async () => {
    const metadataClient = makeMetadataClient();

    await persistRuntimeMetadata('view', 'my_view', { columns: ['name'] }, { metadataClient });
    await persistRuntimeMetadata('dashboard', 'my_dash', { widgets: [] }, { metadataClient });
    await persistRuntimeMetadata('page', 'invoice_record', { regions: [] }, { metadataClient });

    expect(metadataClient.save).toHaveBeenCalledWith('view', 'my_view', { columns: ['name'] }, {
      mode: 'draft',
    });
    expect(metadataClient.save).toHaveBeenCalledWith('dashboard', 'my_dash', { widgets: [] }, {
      mode: 'draft',
    });
    expect(metadataClient.save).toHaveBeenCalledWith('page', 'invoice_record', { regions: [] }, {
      mode: 'draft',
    });
  });

  describe('record page helpers (#1541)', () => {
    it('recordPageName prefers an existing name, else mints <object>_record', () => {
      expect(recordPageName('invoice')).toBe('invoice_record');
      expect(recordPageName('invoice', 'custom_invoice_page')).toBe('custom_invoice_page');
      expect(recordPageName('invoice', null)).toBe('invoice_record');
    });

    it('recordPageEnvelope sets the record-page identity fields the resolver matches on', () => {
      const env = recordPageEnvelope('invoice', { type: 'page', title: 'Invoice', regions: [{ name: 'main' }] });
      expect(env).toMatchObject({
        type: 'page',
        name: 'invoice_record',
        object: 'invoice',
        pageType: 'record',
        kind: 'full',
        title: 'Invoice',
        regions: [{ name: 'main' }],
      });
    });

    it('recordPageEnvelope keeps an explicit/existing page name', () => {
      expect(recordPageEnvelope('invoice', { name: 'inv_v2' }).name).toBe('inv_v2');
      expect(recordPageEnvelope('invoice', {}, 'inv_v3').name).toBe('inv_v3');
    });

    it('a page draft round-trips through the seam', async () => {
      const metadataClient = makeMetadataClient();
      metadataClient.get.mockResolvedValue({ type: 'page', name: 'invoice_record', item: { regions: [{ name: 'x' }] } });
      const draft = await readRuntimeDraft('page', 'invoice_record', { metadataClient });
      expect(metadataClient.get).toHaveBeenCalledWith('page', 'invoice_record', { state: 'draft' });
      expect(draft).toEqual({ regions: [{ name: 'x' }] });
      await publishRuntimeMetadata('page', 'invoice_record', { metadataClient });
      expect(metadataClient.publish).toHaveBeenCalledWith('page', 'invoice_record');
    });
  });

  it('createRuntimeMetadata → save draft and returns the name', async () => {
    const metadataClient = makeMetadataClient();
    const body = { id: 'view_123', columns: ['name'] };

    const id = await createRuntimeMetadata('view', 'view_123', body, { metadataClient });

    expect(metadataClient.save).toHaveBeenCalledWith('view', 'view_123', body, {
      mode: 'draft',
    });
    expect(id).toBe('view_123');
  });

  it('createRuntimeMetadata throws on an empty name (no malformed PUT) — #2767', async () => {
    const metadataClient = makeMetadataClient();
    await expect(
      createRuntimeMetadata('view', '', { columns: [] }, { metadataClient }),
    ).rejects.toThrow(/name must be non-empty/);
    await expect(
      createRuntimeMetadata('view', '   ', { columns: [] }, { metadataClient }),
    ).rejects.toThrow(/name must be non-empty/);
    // The guard fires BEFORE any server call.
    expect(metadataClient.save).not.toHaveBeenCalled();
  });

  it('publishRuntimeMetadata → publish(type, name)', async () => {
    const metadataClient = makeMetadataClient();

    await publishRuntimeMetadata('report', 'my_report', { metadataClient });

    expect(metadataClient.publish).toHaveBeenCalledWith('report', 'my_report');
  });

  it('readRuntimeDraft → unwraps get(type, name, { state: "draft" })', async () => {
    const metadataClient = makeMetadataClient();
    metadataClient.get.mockResolvedValue({
      type: 'view',
      name: 'my_view',
      item: { columns: ['name', 'stage'] },
    });

    const draft = await readRuntimeDraft('view', 'my_view', { metadataClient });

    expect(metadataClient.get).toHaveBeenCalledWith('view', 'my_view', { state: 'draft' });
    expect(draft).toEqual({ columns: ['name', 'stage'] });
  });

  it('readRuntimeDraft → null when no draft is pending', async () => {
    const metadataClient = makeMetadataClient();
    metadataClient.get.mockResolvedValue(null);

    const draft = await readRuntimeDraft('view', 'my_view', { metadataClient });

    expect(draft).toBeNull();
  });

  it('discardRuntimeDraft → reset(type, name, { state: "draft" })', async () => {
    const metadataClient = makeMetadataClient();

    await discardRuntimeDraft('report', 'my_report', { metadataClient });

    expect(metadataClient.reset).toHaveBeenCalledWith('report', 'my_report', {
      state: 'draft',
    });
  });

  describe('viewEnvelope / deriveViewKey (#2767 canonical identity)', () => {
    it('deriveViewKey prefers an explicit machine name', () => {
      expect(deriveViewKey({ name: 'my_grid', label: 'Anything' })).toBe('my_grid');
    });

    it('deriveViewKey reduces an over-qualified name to its <key> half', () => {
      expect(deriveViewKey({ name: 'crm_task.my_grid' })).toBe('my_grid');
    });

    it('deriveViewKey slugifies the label when no name is given', () => {
      expect(deriveViewKey({ label: 'High Priority' })).toBe('high_priority');
    });

    it('deriveViewKey falls back to a unique `<type>_…` key for CJK labels', () => {
      // slugify('看板') === '' → last-resort key, prefixed by the view type.
      const key = deriveViewKey({ label: '看板', type: 'kanban' });
      expect(key).toMatch(/^kanban_[a-z0-9]+$/);
    });

    it('viewEnvelope emits a canonical ViewItem with a qualified name', () => {
      const env = viewEnvelope(
        'crm_task',
        { type: 'grid', label: 'My Grid', columns: ['name', 'stage'] },
        { name: 'my_grid', label: 'My Grid' },
      );
      expect(env).toEqual({
        name: 'crm_task.my_grid',
        object: 'crm_task',
        viewKind: 'list',
        label: 'My Grid',
        config: {
          type: 'grid',
          columns: ['name', 'stage'],
          data: { provider: 'object', object: 'crm_task' },
        },
      });
    });

    it('viewEnvelope keeps `name`/`label` at the top level only (not in config)', () => {
      const env = viewEnvelope('acct', { type: 'grid', name: 'x', label: 'X', columns: [] }, { name: 'x', label: 'X' });
      expect(env.config).not.toHaveProperty('name');
      expect(env.config).not.toHaveProperty('label');
    });

    it('viewEnvelope preserves an existing config.data while stamping the object', () => {
      const env = viewEnvelope(
        'acct',
        { type: 'grid', columns: [], data: { pageSize: 25 } },
        { name: 'big', label: 'Big' },
      );
      expect(env.config.data).toEqual({ provider: 'object', pageSize: 25, object: 'acct' });
    });

    it('viewEnvelope falls back to slugify(label) when no name is supplied', () => {
      const env = viewEnvelope('acct', { type: 'grid', columns: [] }, { label: 'Overdue Tasks' });
      expect(env.name).toBe('acct.overdue_tasks');
    });

    it('a view envelope round-trips through createRuntimeMetadata with matching identity', async () => {
      const metadataClient = makeMetadataClient();
      const env = viewEnvelope('acct', { type: 'grid', columns: ['name'] }, { name: 'mine', label: 'Mine' });
      const id = await createRuntimeMetadata('view', env.name, env, { metadataClient });
      // Row key (URL segment), returned id, and body.name are the SAME value.
      expect(id).toBe('acct.mine');
      expect(metadataClient.save).toHaveBeenCalledWith('view', 'acct.mine', env, { mode: 'draft' });
      expect(env.name).toBe('acct.mine');
    });
  });

  describe('unwrapDraftBody', () => {
    it('unwraps the { type, name, item } envelope', () => {
      expect(unwrapDraftBody({ type: 'view', name: 'v', item: { a: 1 } })).toEqual({
        a: 1,
      });
    });

    it('returns a bare body as-is', () => {
      expect(unwrapDraftBody({ a: 1 })).toEqual({ a: 1 });
    });

    it('returns null for an empty envelope item', () => {
      expect(unwrapDraftBody({ type: 'view', name: 'v', item: {} })).toBeNull();
    });

    it('returns null for null / non-object / empty', () => {
      expect(unwrapDraftBody(null)).toBeNull();
      expect(unwrapDraftBody(undefined)).toBeNull();
      expect(unwrapDraftBody('x')).toBeNull();
      expect(unwrapDraftBody({})).toBeNull();
    });
  });
});
