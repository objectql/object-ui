import { describe, it, expect } from 'vitest';
import { __testables } from './ImportWizard';
import type { ImportJobResultsInfo } from '@object-ui/types';

const { isUnsupportedImportJob, jobResultToImportResult } = __testables;

describe('isUnsupportedImportJob', () => {
  it('matches the adapter UNSUPPORTED_OPERATION code', () => {
    expect(isUnsupportedImportJob({ code: 'UNSUPPORTED_OPERATION' })).toBe(true);
  });

  it('matches a "createImportJob is not a function" message', () => {
    expect(isUnsupportedImportJob(new Error('dataSource.createImportJob is not a function'))).toBe(true);
  });

  it('matches a 404 / missing import/jobs route (older server)', () => {
    expect(isUnsupportedImportJob(new Error('POST /data/task/import/jobs 404 Not Found'))).toBe(true);
    expect(isUnsupportedImportJob(new Error('Request failed with status 404'))).toBe(true);
  });

  it('does NOT match a genuine server/validation error', () => {
    expect(isUnsupportedImportJob(new Error('Row 3: value out of range'))).toBe(false);
    expect(isUnsupportedImportJob({ code: 'PAYLOAD_TOO_LARGE' })).toBe(false);
    expect(isUnsupportedImportJob(null)).toBe(false);
    expect(isUnsupportedImportJob(undefined)).toBe(false);
  });
});

describe('jobResultToImportResult', () => {
  const base: ImportJobResultsInfo = {
    jobId: 'imp_1',
    object: 'task',
    status: 'succeeded',
    total: 5,
    processed: 5,
    created: 3,
    updated: 1,
    skipped: 0,
    errors: 1,
    percentComplete: 100,
    resultsTruncated: false,
    results: [
      { row: 1, ok: true, action: 'created', id: 'a' },
      { row: 2, ok: true, action: 'created', id: 'b' },
      { row: 3, ok: true, action: 'created', id: 'c' },
      { row: 4, ok: true, action: 'updated', id: 'd' },
      { row: 5, ok: false, action: 'failed', field: 'amount', error: 'not a number', code: 'COERCE' },
    ],
  };

  it('maps job counters onto the wizard ImportResult shape (created+updated = imported)', () => {
    const r = jobResultToImportResult(base);
    expect(r.totalRows).toBe(5);
    expect(r.importedRows).toBe(4); // created 3 + updated 1
    expect(r.createdRows).toBe(3);
    expect(r.updatedRows).toBe(1);
    expect(r.skippedRows).toBe(1); // skipped 0 + errors 1
    expect(r.resultsTruncated).toBe(false);
  });

  it('projects only failed rows into the errors list, preferring error over code', () => {
    const r = jobResultToImportResult(base);
    expect(r.errors).toEqual([{ row: 5, field: 'amount', message: 'not a number' }]);
  });

  it('carries the resultsTruncated flag through when the server capped the report', () => {
    const r = jobResultToImportResult({ ...base, resultsTruncated: true, results: [] });
    expect(r.resultsTruncated).toBe(true);
    expect(r.errors).toEqual([]);
  });
});
