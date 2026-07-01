/**
 * ObjectUI – Copyright (c) 2024-present ObjectStack Inc.
 * Licensed under MIT.
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseDelimited, parseCSV, parseExcelArrayBuffer, parseClipboardTable,
  inferColumnType, isTypeCompatible, ImportParseError, parseSpreadsheetFile,
  suggestColumnMappings, scoreToConfidence, type MappableField,
} from './importParsers';

describe('parseDelimited', () => {
  it('parses CSV with quotes, escaped quotes and embedded commas/newlines', () => {
    const csv = 'name,note\n"Doe, John","say ""hi""\nthere"\nJane,plain';
    expect(parseCSV(csv)).toEqual([
      ['name', 'note'],
      ['Doe, John', 'say "hi"\nthere'],
      ['Jane', 'plain'],
    ]);
  });

  it('parses TSV when given a tab delimiter', () => {
    expect(parseDelimited('a\tb\n1\t2', '\t')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('drops all-empty rows', () => {
    expect(parseDelimited('a,b\n,\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('inferColumnType', () => {
  it('detects numbers (years stay numeric)', () => {
    expect(inferColumnType(['1', '2.5', '-3', '2020'])).toBe('number');
  });
  it('treats pure 0/1 columns as numbers, not booleans', () => {
    expect(inferColumnType(['0', '1', '1', '0'])).toBe('number');
  });
  it('detects booleans from words', () => {
    expect(inferColumnType(['true', 'false', 'yes', '否'])).toBe('boolean');
  });
  it('detects dates and datetimes', () => {
    expect(inferColumnType(['2024-01-01', '2024-12-31'])).toBe('date');
    expect(inferColumnType(['2024-01-01T08:30', '2024-12-31 09:00'])).toBe('datetime');
  });
  it('falls back to text for mixed or empty columns', () => {
    expect(inferColumnType(['1', 'abc', '2024-01-01'])).toBe('text');
    expect(inferColumnType(['', '  ', undefined])).toBe('text');
  });
  it('ignores blanks when all remaining values agree', () => {
    expect(inferColumnType(['10', '', '20'])).toBe('number');
  });
});

describe('isTypeCompatible', () => {
  it('maps numeric inference to number/currency/percent', () => {
    expect(isTypeCompatible('number', 'currency')).toBe(true);
    expect(isTypeCompatible('number', 'text')).toBe(false);
  });
  it('treats text as compatible with anything', () => {
    expect(isTypeCompatible('text', 'date')).toBe(true);
  });
  it('matches dates against date/datetime fields only', () => {
    expect(isTypeCompatible('date', 'datetime')).toBe(true);
    expect(isTypeCompatible('datetime', 'number')).toBe(false);
  });
});

describe('parseClipboardTable', () => {
  it('parses an HTML table (Excel/Sheets clipboard)', () => {
    const html = '<table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>';
    expect(parseClipboardTable(html, null)).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('falls back to TSV plain text', () => {
    expect(parseClipboardTable(null, 'a\tb\n1\t2')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('returns null when there is no tabular payload', () => {
    expect(parseClipboardTable(null, '')).toBeNull();
    expect(parseClipboardTable(null, null)).toBeNull();
  });
});

describe('parseExcelArrayBuffer', () => {
  it('reads the first sheet into a string grid, formatting dates & numbers', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['name', 'amount', 'when']);
    ws.addRow(['Alice', 100, new Date(Date.UTC(2024, 2, 14))]);
    ws.addRow(['Bob', 42.5, new Date(Date.UTC(2024, 0, 1))]);
    const buf = await wb.xlsx.writeBuffer();

    const grid = await parseExcelArrayBuffer(buf as ArrayBuffer);
    expect(grid[0]).toEqual(['name', 'amount', 'when']);
    expect(grid[1]).toEqual(['Alice', '100', '2024-03-14']);
    expect(grid[2]).toEqual(['Bob', '42.5', '2024-01-01']);
  });
});

describe('parseSpreadsheetFile', () => {
  const makeFile = (name: string, body: BlobPart) => new File([body], name);

  it('rejects legacy .xls with a dedicated code', async () => {
    await expect(parseSpreadsheetFile(makeFile('old.xls', 'x'))).rejects.toThrow(ImportParseError.LegacyXls);
  });
  it('rejects unknown extensions', async () => {
    await expect(parseSpreadsheetFile(makeFile('data.pdf', 'x'))).rejects.toThrow(ImportParseError.Unsupported);
  });
  it('parses a .csv file', async () => {
    const grid = await parseSpreadsheetFile(makeFile('data.csv', 'a,b\n1,2'));
    expect(grid).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('suggestColumnMappings', () => {
  const FIELDS: MappableField[] = [
    { name: 'full_name', label: '姓名', type: 'text' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'phone', label: '手机', type: 'text' },
    { name: 'amount', label: '金额', type: 'currency' },
    { name: 'active', label: '启用', type: 'boolean' },
    { name: 'due_date', label: '截止日期', type: 'date' },
  ];
  const byCol = (s: ReturnType<typeof suggestColumnMappings>) =>
    Object.fromEntries(s.map((x) => [x.columnIndex, x.fieldName]));

  it('matches exact and normalized header names with high confidence', () => {
    const s = suggestColumnMappings(['Full Name', 'email'], FIELDS);
    expect(s[0]).toMatchObject({ fieldName: 'full_name', confidence: 'high' });
    expect(s[1]).toMatchObject({ fieldName: 'email', reason: 'exact', confidence: 'high' });
  });

  it('resolves bilingual synonyms (邮箱→email, 电话→phone)', () => {
    const s = suggestColumnMappings(['邮箱', '电话'], FIELDS);
    expect(byCol(s)).toMatchObject({ 0: 'email', 1: 'phone' });
    expect(s[0].reason).toBe('synonym');
  });

  it('assigns each field to at most one column (global greedy)', () => {
    // Two columns both look like email; only the better one wins the field.
    const s = suggestColumnMappings(['email', 'e-mail address'], FIELDS,
      [['a@x.com', 'b@x.com']]);
    const assigned = s.map((x) => x.fieldName).filter(Boolean);
    expect(assigned).toContain('email');
    expect(new Set(assigned).size).toBe(assigned.length); // no dup field
  });

  it('uses content type to gate a fuzzy match (numeric column → currency)', () => {
    const s = suggestColumnMappings(['金额'], FIELDS, [['1200'], ['3400']]);
    expect(s[0]).toMatchObject({ fieldName: 'amount' });
    expect(s[0].inferredType).toBe('number');
  });

  it('discounts a name match when the content type is incompatible', () => {
    // Header rhymes with a boolean field, but the sampled data is text → no confident map.
    const s = suggestColumnMappings(['active'], [{ name: 'active', label: 'Active', type: 'boolean' }],
      [['some free text'], ['more prose here']]);
    // exact name still wins (exact matches aren't type-gated)…
    expect(s[0].fieldName).toBe('active');
    // …but a merely-fuzzy header with bad type stays unmapped:
    const s2 = suggestColumnMappings(['is_it_on'], [{ name: 'active', label: 'Active', type: 'boolean' }],
      [['free text'], ['prose']]);
    expect(s2[0].fieldName).toBeNull();
  });

  it('leaves an unknown column unmapped', () => {
    const s = suggestColumnMappings(['xyzzy_42'], FIELDS);
    expect(s[0]).toMatchObject({ fieldName: null, confidence: null, reason: 'none' });
  });

  it('scoreToConfidence buckets by threshold', () => {
    expect(scoreToConfidence(1)).toBe('high');
    expect(scoreToConfidence(0.6)).toBe('medium');
    expect(scoreToConfidence(0.3)).toBe('low');
    expect(scoreToConfidence(0)).toBeNull();
  });
});
