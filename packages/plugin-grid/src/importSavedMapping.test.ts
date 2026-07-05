import { describe, it, expect } from 'vitest';
import { __testables } from './ImportWizard';

const { assembleImportRequest } = __testables;

// When a named mapping is active the server owns rename + transforms + write
// semantics, so the request carries `mappingName` and OMITS the inline
// writeMode/matchFields/coercion flags (mutually exclusive per the server
// contract, framework #2611).
describe('assembleImportRequest — named mapping branch', () => {
  const rows = [{ 'Full Name': 'Ada', Channel: 'Web' }];

  it('emits mappingName + rows and drops writeMode/matchFields', () => {
    const req = assembleImportRequest(rows, {
      writeMode: 'upsert', matchFields: ['email'],
      createMissingOptions: true, runAutomations: true, skipBlankMatchKey: true,
      mappingName: 'inquiry_feed',
    });
    expect(req).toEqual({
      format: 'json',
      rows,
      mappingName: 'inquiry_feed',
      runAutomations: true,
    });
    expect(req).not.toHaveProperty('writeMode');
    expect(req).not.toHaveProperty('matchFields');
    expect(req).not.toHaveProperty('createMissingOptions');
  });

  it('carries dryRun through the named-mapping branch', () => {
    const req = assembleImportRequest(rows, {
      writeMode: 'insert', matchFields: [],
      createMissingOptions: false, runAutomations: false, skipBlankMatchKey: false,
      mappingName: 'inquiry_feed', dryRun: true,
    });
    expect(req.dryRun).toBe(true);
    expect(req.mappingName).toBe('inquiry_feed');
  });

  it('without mappingName, keeps the existing inline-mapping payload shape', () => {
    const req = assembleImportRequest(rows, {
      writeMode: 'upsert', matchFields: ['email'],
      createMissingOptions: false, runAutomations: false, skipBlankMatchKey: false,
    });
    expect(req.mappingName).toBeUndefined();
    expect(req.writeMode).toBe('upsert');
    expect(req.matchFields).toEqual(['email']);
  });
});
