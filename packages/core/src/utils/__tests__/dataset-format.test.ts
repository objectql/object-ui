import { describe, it, expect } from 'vitest';
import {
  formatMeasure,
  formatDimensionValue,
  buildDatasetFieldHelpers,
  type DatasetResultField,
} from '../dataset-format';

describe('formatMeasure', () => {
  it('renders null as an em dash and passes non-numbers through', () => {
    expect(formatMeasure(null)).toBe('—');
    expect(formatMeasure(undefined)).toBe('—');
    expect(formatMeasure('n/a')).toBe('n/a');
  });

  it('formats a plain number with no currency and no misleading $', () => {
    expect(formatMeasure(1234, '0,0')).toBe('1,234');
    // No format hint → integers render verbatim (the documented plain path).
    expect(formatMeasure(1234)).toBe('1234');
    expect(formatMeasure(1234, '0,0')).not.toContain('$');
  });

  it('uses the declared currency via Intl (CNY → ¥ family, never bare/wrong)', () => {
    const out = formatMeasure(1234, '0,0', 'CNY');
    expect(out).toMatch(/[¥￥]|CN¥/);
    expect(out).toContain('1,234');
  });

  it('honors a legacy $ literal in the format string when there is no currency', () => {
    expect(formatMeasure(1000, '$0,0')).toBe('$1,000');
  });

  it('applies percent and decimal hints', () => {
    // Whole-percent storage (magnitude ≥ 1) passes through unchanged.
    expect(formatMeasure(50, '0%')).toBe('50%');
    expect(formatMeasure(12.5, '0.0')).toBe('12.5');
  });

  it('scales fraction-stored percents to display magnitude (×100), matching the list cell', () => {
    // Percent fields store a FRACTION (0.75 ⇒ 75%); the list-view cell renderer
    // multiplies by 100, so the dataset measure formatter must too — otherwise a
    // metric card shows "0.6%" for an avg of 0.608 instead of "60.8%" (the bug).
    expect(formatMeasure(0.75, '0%')).toBe('75%');
    expect(formatMeasure(0.608_333_333, '0.0%')).toBe('60.8%');
    // Boundary: exactly 0 and exactly 1 (100% stored as 1.0) — 1.0 passes
    // through, mirroring the list renderer's strict `< 1` heuristic so the two
    // surfaces stay in lockstep (a known shared limitation, not a new one).
    expect(formatMeasure(0, '0%')).toBe('0%');
    expect(formatMeasure(1, '0%')).toBe('1%');
  });

  it('falls back to plain formatting for an unknown currency code', () => {
    expect(formatMeasure(1234, '0,0', 'NOTACODE')).toBe('1,234');
  });
});

describe('formatDimensionValue', () => {
  it('tidies nulls and integers, leaves strings intact', () => {
    expect(formatDimensionValue(null)).toBe('—');
    expect(formatDimensionValue(42)).toBe('42');
    expect(formatDimensionValue('Backlog')).toBe('Backlog');
  });
});

describe('buildDatasetFieldHelpers', () => {
  const fields: DatasetResultField[] = [
    { name: 'status', type: 'string', label: 'Stage' },
    { name: 'amount', type: 'number', label: 'Amount', format: '0,0', currency: 'USD' },
  ];

  it('headerLabel: field label → i18n fieldLabel → raw name', () => {
    const fieldLabel = (_o: string, _f: string, fb: string) => `i18n:${fb}`;
    const { headerLabel } = buildDatasetFieldHelpers(fields, 'deal', fieldLabel);
    // i18n hook wraps the field label fallback.
    expect(headerLabel('status')).toBe('i18n:Stage');
    // unknown field → raw name flows through the i18n layer.
    expect(headerLabel('missing')).toBe('i18n:missing');
  });

  it('headerLabel falls back to field label when no object/fieldLabel given', () => {
    const { headerLabel } = buildDatasetFieldHelpers(fields, undefined);
    expect(headerLabel('amount')).toBe('Amount');
    expect(headerLabel('missing')).toBe('missing');
  });

  it('measureField exposes format/currency', () => {
    const { measureField } = buildDatasetFieldHelpers(fields, 'deal');
    expect(measureField('amount')?.format).toBe('0,0');
    expect(measureField('amount')?.currency).toBe('USD');
    expect(measureField('nope')).toBeUndefined();
  });
});
