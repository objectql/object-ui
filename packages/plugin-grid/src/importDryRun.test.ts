import { describe, it, expect } from 'vitest';
import { __testables } from './ImportWizard';

const { assembleImportRequest } = __testables;

const rows = [{ name: 'Acme' }, { name: 'Beta' }];
const baseOpts = {
  writeMode: 'insert' as const,
  matchFields: [] as string[],
  createMissingOptions: false,
  runAutomations: false,
  skipBlankMatchKey: false,
};

describe('assembleImportRequest', () => {
  it('omits dryRun on a real import request', () => {
    const req = assembleImportRequest(rows, baseOpts);
    expect(req).not.toHaveProperty('dryRun');
    expect(req.format).toBe('json');
    expect(req.rows).toBe(rows);
    expect(req.writeMode).toBe('insert');
  });

  it('sets dryRun:true when validating, keeping the rest of the payload identical', () => {
    const live = assembleImportRequest(rows, baseOpts);
    const dry = assembleImportRequest(rows, { ...baseOpts, dryRun: true });
    expect(dry.dryRun).toBe(true);
    // dryRun is the ONLY difference — the pre-check validates the exact payload.
    expect({ ...dry, dryRun: undefined }).toEqual({ ...live, dryRun: undefined });
  });

  it('drops matchFields for insert mode but sends them for update/upsert', () => {
    const insert = assembleImportRequest(rows, { ...baseOpts, writeMode: 'insert', matchFields: ['name'] });
    expect(insert).not.toHaveProperty('matchFields');

    const upsert = assembleImportRequest(rows, { ...baseOpts, writeMode: 'upsert', matchFields: ['name'] });
    expect(upsert.matchFields).toEqual(['name']);

    const update = assembleImportRequest(rows, { ...baseOpts, writeMode: 'update', matchFields: ['email'] });
    expect(update.matchFields).toEqual(['email']);
  });

  it('threads coercion options through verbatim', () => {
    const req = assembleImportRequest(rows, {
      ...baseOpts,
      createMissingOptions: true,
      runAutomations: true,
      skipBlankMatchKey: true,
    });
    expect(req.createMissingOptions).toBe(true);
    expect(req.runAutomations).toBe(true);
    expect(req.skipBlankMatchKey).toBe(true);
  });
});
