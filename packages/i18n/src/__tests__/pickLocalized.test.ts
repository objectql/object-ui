import { describe, it, expect } from 'vitest';
import { pickLocalized } from '../pickLocalized';

describe('pickLocalized', () => {
  it('passes plain strings through', () => {
    expect(pickLocalized('Pricing', 'zh-CN')).toBe('Pricing');
  });
  it('picks the exact language key', () => {
    expect(pickLocalized({ en: 'Pricing', 'zh-CN': '定价' }, 'zh-CN')).toBe('定价');
  });
  it('falls back from region to base language (zh-CN -> zh)', () => {
    expect(pickLocalized({ en: 'Pricing', zh: '定价' }, 'zh-CN')).toBe('定价');
  });
  it('upgrades from base language to a region-qualified key (zh -> zh-CN)', () => {
    expect(pickLocalized({ en: 'Pricing', 'zh-CN': '定价' }, 'zh')).toBe('定价');
    expect(pickLocalized({ en: 'Pricing', 'ja-JP': '価格' }, 'ja')).toBe('価格');
    // exact/base keys still win over the regional upgrade
    expect(pickLocalized({ zh: '基础', 'zh-CN': '区域' }, 'zh')).toBe('基础');
  });
  it('falls back to default then en then first', () => {
    expect(pickLocalized({ default: 'D', en: 'E' }, 'fr')).toBe('D');
    expect(pickLocalized({ en: 'E', ja: 'J' }, 'fr')).toBe('E');
    expect(pickLocalized({ ja: 'J' }, 'fr')).toBe('J');
  });
  it('handles null/undefined and missing language', () => {
    expect(pickLocalized(null, 'zh')).toBe('');
    expect(pickLocalized(undefined, 'zh')).toBe('');
    expect(pickLocalized({ en: 'E' }, undefined)).toBe('E');
  });
});
