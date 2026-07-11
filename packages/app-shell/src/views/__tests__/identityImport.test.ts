// framework#2782 — identity import adapter unit tests (pure logic, no DOM).
import { describe, it, expect, vi } from 'vitest';
import {
  splitIntoBatches,
  resolveIdentityWriteOptions,
  mergeIdentityBatchResults,
  createIdentityImportDataSource,
  collectTemporaryPasswords,
  buildTemporaryPasswordCsv,
  IDENTITY_IMPORT_BATCH_SIZE,
} from '../identityImport';
import type { ImportRecordsResult } from '@object-ui/types';

const okResponse = (rows: Array<Record<string, unknown>>, overrides: Record<string, unknown> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    success: true,
    data: {
      summary: { total: rows.length, created: rows.length, updated: 0, skipped: 0, errors: 0, dryRun: false },
      rows: rows.map((_, i) => ({ row: i + 1, ok: true, action: 'created', id: `u-${i}` })),
      ...overrides,
    },
  }),
});

describe('splitIntoBatches', () => {
  it('splits at the endpoint cap and keeps order', () => {
    const rows = Array.from({ length: 1201 }, (_, i) => i);
    const batches = splitIntoBatches(rows);
    expect(batches.map((b) => b.length)).toEqual([500, 500, 201]);
    expect(batches[1][0]).toBe(500);
    expect(IDENTITY_IMPORT_BATCH_SIZE).toBe(500);
  });

  it('handles fewer rows than one batch', () => {
    expect(splitIntoBatches([1, 2, 3]).length).toBe(1);
  });
});

describe('resolveIdentityWriteOptions', () => {
  it('maps insert and upsert-by-email/phone', () => {
    expect(resolveIdentityWriteOptions({})).toEqual({ mode: 'insert' });
    expect(resolveIdentityWriteOptions({ writeMode: 'upsert', matchFields: ['email'] }))
      .toEqual({ mode: 'upsert', matchBy: 'email' });
    expect(resolveIdentityWriteOptions({ writeMode: 'upsert', matchFields: ['phone_number'] }))
      .toEqual({ mode: 'upsert', matchBy: 'phone' });
  });

  it('rejects update mode and unsupported match fields before any batch is sent', () => {
    expect(() => resolveIdentityWriteOptions({ writeMode: 'update', matchFields: ['email'] })).toThrow(/insert and upsert/);
    expect(() => resolveIdentityWriteOptions({ writeMode: 'upsert', matchFields: ['name'] })).toThrow(/email.*phone_number/);
  });
});

describe('mergeIdentityBatchResults', () => {
  it('renumbers batch-local rows onto the whole file and enriches identity', () => {
    const batch1 = [{ email: 'a@x.co' }, { email: 'b@x.co' }];
    const batch2 = [{ phone_number: '+8613800000000' }];
    const merged = mergeIdentityBatchResults(
      [
        {
          summary: { total: 2, created: 2, updated: 0, skipped: 0, errors: 0, dryRun: false },
          rows: [
            { row: 1, ok: true, action: 'created', id: 'u1' },
            { row: 2, ok: true, action: 'created', id: 'u2', temporaryPassword: 'Pw-Two!234567890' },
          ],
        },
        {
          summary: { total: 1, created: 0, updated: 0, skipped: 0, errors: 1, dryRun: false },
          rows: [{ row: 1, ok: false, action: 'failed', code: 'INVALID_PHONE', error: 'bad phone' }],
        },
      ],
      [batch1, batch2],
      { dryRun: false, writeMode: 'insert' },
    );
    expect(merged.total).toBe(3);
    expect(merged.created).toBe(2);
    expect(merged.errors).toBe(1);
    expect(merged.ok).toBe(2);
    expect(merged.results.map((r) => r.row)).toEqual([1, 2, 3]);
    const withPw = merged.results[1] as any;
    expect(withPw.temporaryPassword).toBe('Pw-Two!234567890');
    expect(withPw.identity).toBe('b@x.co');
    const failed = merged.results[2] as any;
    expect(failed.code).toBe('INVALID_PHONE');
    expect(failed.identity).toBe('+8613800000000');
  });
});

describe('createIdentityImportDataSource', () => {
  const makeAdapter = (fetchImpl: ReturnType<typeof vi.fn>, policy: 'none' | 'invite' | 'temporary' = 'none') =>
    createIdentityImportDataSource({
      base: { find: 'passthrough-marker', createImportJob: () => {}, undoImportJob: () => {} },
      authFetch: fetchImpl as any,
      baseUrl: 'http://srv',
      getPasswordPolicy: () => policy,
    }) as any;

  it('POSTs batches to the identity endpoint with the selected policy', async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({ email: `u${i}@x.co` }));
    const fetchImpl = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      return okResponse(body.rows) as any;
    });
    const ds = makeAdapter(fetchImpl, 'temporary');
    const res: ImportRecordsResult = await ds.importRecords('sys_user', { format: 'json', rows });

    expect(fetchImpl).toHaveBeenCalledTimes(2); // 500 + 1
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://srv/api/v1/auth/admin/import-users');
    const body = JSON.parse(init.body);
    expect(body.passwordPolicy).toBe('temporary');
    expect(body.mode).toBe('insert');
    expect(body.rows.length).toBe(500);
    expect(res.total).toBe(501);
    expect(res.results.length).toBe(501);
    expect(res.results[500].row).toBe(501); // renumbered across batches
  });

  it('passes dryRun and upsert options through', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: any) => okResponse(JSON.parse(init.body).rows) as any);
    const ds = makeAdapter(fetchImpl);
    await ds.importRecords('sys_user', {
      format: 'json',
      rows: [{ email: 'a@x.co' }],
      dryRun: true,
      writeMode: 'upsert',
      matchFields: ['email'],
    });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.dryRun).toBe(true);
    expect(body.mode).toBe('upsert');
    expect(body.matchBy).toBe('email');
  });

  it('aborts remaining batches on a request-level failure and surfaces the server message', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ success: false, error: { code: 'EMAIL_SERVICE_REQUIRED', message: 'needs email service' } }),
    }) as any);
    const ds = makeAdapter(fetchImpl, 'invite');
    const rows = Array.from({ length: 1000 }, (_, i) => ({ email: `u${i}@x.co` }));
    await expect(ds.importRecords('sys_user', { format: 'json', rows })).rejects.toThrow('needs email service');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // no second batch
  });

  it('hides the async-job and undo surfaces the wizard feature-detects', () => {
    const ds = makeAdapter(vi.fn());
    expect(ds.createImportJob).toBeUndefined();
    expect(ds.undoImportJob).toBeUndefined();
    expect(ds.cancelImportJob).toBeUndefined();
    expect(ds.find).toBe('passthrough-marker'); // reads pass through
  });
});

describe('temporary password reveal helpers', () => {
  const result = {
    object: 'sys_user', dryRun: false, writeMode: 'insert',
    total: 2, ok: 2, errors: 0, created: 2, updated: 0, skipped: 0,
    results: [
      { row: 1, ok: true, action: 'created', identity: 'a@x.co', temporaryPassword: 'Aa1!aaaaaaaaaaaa' },
      { row: 2, ok: true, action: 'created' },
    ],
  } as unknown as ImportRecordsResult;

  it('collects only rows that carry a password', () => {
    const entries = collectTemporaryPasswords(result);
    expect(entries).toEqual([{ row: 1, identity: 'a@x.co', temporaryPassword: 'Aa1!aaaaaaaaaaaa' }]);
    expect(collectTemporaryPasswords(undefined)).toEqual([]);
  });

  it('builds a CSV with escaping', () => {
    const csv = buildTemporaryPasswordCsv([
      { row: 1, identity: 'a@x.co', temporaryPassword: 'p,w"1' },
    ]);
    expect(csv.split('\n')[0]).toBe('row,identity,temporary_password');
    expect(csv).toContain('"p,w""1"');
  });
});
