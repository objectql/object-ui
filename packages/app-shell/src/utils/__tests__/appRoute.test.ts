import { describe, it, expect } from 'vitest';
import { appRouteSegment, matchAppBySegment } from '../appRoute';

/**
 * ADR-0048 (option A) — package-id route segment.
 */
describe('appRouteSegment', () => {
  it('returns the package id when present', () => {
    expect(appRouteSegment({ name: 'crm', _packageId: 'com.acme.crm' })).toBe('com.acme.crm');
  });
  it('falls back to the app name when no package id', () => {
    expect(appRouteSegment({ name: 'crm' })).toBe('crm');
  });
  it('returns undefined for nullish input', () => {
    expect(appRouteSegment(undefined)).toBeUndefined();
    expect(appRouteSegment(null)).toBeUndefined();
  });
});

describe('matchAppBySegment', () => {
  const crm = { name: 'crm', _packageId: 'com.acme.crm' };
  const hr = { name: 'crm', _packageId: 'com.beta.crm' }; // same display name, different vendor
  const apps = [crm, hr];

  it('matches by package id (disambiguates same-named apps)', () => {
    expect(matchAppBySegment(apps, 'com.acme.crm')).toBe(crm);
    expect(matchAppBySegment(apps, 'com.beta.crm')).toBe(hr);
  });
  it('falls back to matching by name (legacy/alias URL)', () => {
    expect(matchAppBySegment([{ name: 'sales' }], 'sales')).toEqual({ name: 'sales' });
  });
  it('prefers a package-id match over a name match', () => {
    const byName = { name: 'com.acme.crm' }; // pathological: an app literally named like a pkg id
    expect(matchAppBySegment([byName, crm], 'com.acme.crm')).toBe(crm);
  });
  it('returns undefined for missing inputs', () => {
    expect(matchAppBySegment(apps, undefined)).toBeUndefined();
    expect(matchAppBySegment(null, 'com.acme.crm')).toBeUndefined();
  });
});
