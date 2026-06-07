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
