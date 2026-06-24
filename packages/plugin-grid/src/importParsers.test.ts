/**
 * ObjectUI – Copyright (c) 2024-present ObjectStack Inc.
 * Licensed under MIT.
 */
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  parseDelimited, parseCSV, parseExcelArrayBuffer, parseClipboardTable,
  inferColumnType, isTypeCompatible, ImportParseError, parseSpreadsheetFile,
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
