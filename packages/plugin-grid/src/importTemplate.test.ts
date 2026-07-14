import { describe, it, expect } from 'vitest';
import { __testables } from './ImportWizard';

const { buildImportTemplateCsv, autoMapColumns } = __testables;

describe('buildImportTemplateCsv', () => {
  it('emits a header row of labels (required marked with *) plus one example row', () => {
    const csv = buildImportTemplateCsv([
      { name: 'name', label: '客户名称', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'amount', label: 'Amount', type: 'number' },
      { name: 'due', label: 'Due', type: 'date' },
      { name: 'active', label: 'Active', type: 'boolean' },
    ]);
    const [header, example] = csv.split('\n');
    expect(header).toBe('客户名称 *,Email,Amount,Due,Active');
    expect(example).toBe(',name@example.com,0,2024-01-31,true');
  });

  it('seeds select example from the first option, preferring the display label over the value', () => {
    // Import coercion accepts value OR label, and the label is what a
    // localized user recognizes (e.g. `准备中` instead of the slug `prepare`).
    const csv = buildImportTemplateCsv([
      { name: 'stage', label: 'Stage', type: 'select', options: [{ label: '准备中', value: 'prepare' }, { label: 'Won', value: 'won' }] },
      { name: 'tier', label: 'Tier', type: 'select', options: ['gold', 'silver'] },
      { name: 'valueOnly', label: 'ValueOnly', type: 'select', options: [{ value: 'v1' }] },
      { name: 'empty', label: 'Empty', type: 'select' },
    ]);
    const example = csv.split('\n')[1];
    expect(example).toBe('准备中,gold,v1,');
  });

  it('escapes labels containing commas per RFC 4180', () => {
    const csv = buildImportTemplateCsv([
      { name: 'n', label: 'Name, Full', type: 'text', required: true },
    ]);
    expect(csv.split('\n')[0]).toBe('"Name, Full *"');
  });

  it('round-trips: a filled-in template (required * header) re-maps to the field', () => {
    const fields = [
      { name: 'name', label: '客户名称', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
    ];
    const header = buildImportTemplateCsv(fields).split('\n')[0].split(',');
    // The `*` required-marker must not defeat auto-mapping on re-import.
    expect(autoMapColumns(header, fields)).toEqual({ 0: 'name', 1: 'email' });
  });
});
