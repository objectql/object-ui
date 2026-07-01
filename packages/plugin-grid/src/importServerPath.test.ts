import { describe, it, expect } from 'vitest';
import { __testables } from './ImportWizard';

const { isUnsupportedImport, buildFailedRowsCsv } = __testables;

describe('isUnsupportedImport', () => {
  it('matches the adapter UNSUPPORTED_OPERATION code', () => {
    expect(isUnsupportedImport({ code: 'UNSUPPORTED_OPERATION' })).toBe(true);
  });

  it('matches the "does not support data.import" message', () => {
    expect(isUnsupportedImport(new Error('The connected @objectstack/client does not support data.import().'))).toBe(true);
  });

  it('matches a "importRecords is not a function" message', () => {
    expect(isUnsupportedImport(new Error('dataSource.importRecords is not a function'))).toBe(true);
  });

  it('does NOT match a genuine server/validation error', () => {
    expect(isUnsupportedImport(new Error('Row 3: value out of range'))).toBe(false);
    expect(isUnsupportedImport({ code: 'VALIDATION_ERROR' })).toBe(false);
    expect(isUnsupportedImport(null)).toBe(false);
    expect(isUnsupportedImport(undefined)).toBe(false);
  });
});

describe('buildFailedRowsCsv', () => {
  const headers = ['Name', 'Owner', 'Amount'];
  // Only columns 0 and 2 are mapped (Owner is dropped).
  const mapping: Record<number, string> = { 0: 'name', 2: 'amount' };
  const rows = [
    ['Acme', 'alice', '100'],   // row 1
    ['Beta', 'bob', 'oops'],    // row 2 (fails)
    ['Gamma', 'carol', '300'],  // row 3
  ];

  it('emits only the mapped columns plus an _error column, keyed by 1-based row number', () => {
    const errorsByRow = new Map<number, string>([[2, 'amount: not a number']]);
    const csv = buildFailedRowsCsv(headers, rows, mapping, errorsByRow);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Amount,_error');
    // Only the failed row 2 is exported, with its mapped columns (Owner dropped).
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('Beta,oops,amount: not a number');
  });

  it('escapes commas, quotes and newlines per RFC 4180', () => {
    const csvRows = [['a,b', 'x', 'has "quote"']];
    const errorsByRow = new Map<number, string>([[1, 'bad, value']]);
    const csv = buildFailedRowsCsv(headers, csvRows, { 0: 'name', 2: 'note' }, errorsByRow);
    const lines = csv.split('\n');
    expect(lines[1]).toBe('"a,b","has ""quote""","bad, value"');
  });

  it('skips error rows whose source row is missing', () => {
    const errorsByRow = new Map<number, string>([[99, 'ghost row']]);
    const csv = buildFailedRowsCsv(headers, rows, mapping, errorsByRow);
    // header only — no data line for the non-existent row
    expect(csv.split('\n')).toHaveLength(1);
  });
});
