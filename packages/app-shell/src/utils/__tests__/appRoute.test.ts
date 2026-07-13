import { describe, it, expect } from 'vitest';
import { appRouteSegment, matchAppBySegment, appStudioDesignPath, appStudioSurfacePath, appStudioObjectPath, appStudioRoutePath } from '../appRoute';

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

/**
 * ADR-0080 — app → Studio reverse bridge.
 */
describe('appStudioDesignPath', () => {
  const crm = { name: 'crm', _packageId: 'com.acme.crm' };

  it('resolves an admin viewing a packaged app to its design surface', () => {
    expect(appStudioDesignPath(crm, true)).toBe('/studio/com.acme.crm/data');
  });
  it('URL-encodes the package id', () => {
    expect(appStudioDesignPath({ _packageId: 'com.acme/crm' }, true)).toBe(
      '/studio/com.acme%2Fcrm/data',
    );
  });
  it('returns null for non-admins', () => {
    expect(appStudioDesignPath(crm, false)).toBeNull();
  });
  it('returns null for apps with no owning package (runtime/DB apps)', () => {
    expect(appStudioDesignPath({ name: 'crm' }, true)).toBeNull();
    expect(appStudioDesignPath(undefined, true)).toBeNull();
    expect(appStudioDesignPath(null, true)).toBeNull();
  });
  it('returns null for the DB-authored sys_metadata pseudo-package', () => {
    expect(appStudioDesignPath({ name: 'crm', _packageId: 'sys_metadata' }, true)).toBeNull();
  });
});

/**
 * App → Studio interface deep-link (dashboard design page).
 */
describe('appStudioSurfacePath', () => {
  const crm = { name: 'crm', _packageId: 'com.acme.crm' };

  it('deep-links to the interface surface in the Interfaces pillar', () => {
    expect(appStudioSurfacePath(crm, true, { type: 'dashboard', name: 'executive_dashboard' })).toBe(
      '/studio/com.acme.crm/interfaces?surface=dashboard:executive_dashboard',
    );
  });
  it('URL-encodes the package id and the surface name', () => {
    expect(
      appStudioSurfacePath({ _packageId: 'com.acme/crm' }, true, { type: 'dashboard', name: 'sales dash' }),
    ).toBe('/studio/com.acme%2Fcrm/interfaces?surface=dashboard:sales%20dash');
  });
  it('returns null for non-admins', () => {
    expect(appStudioSurfacePath(crm, false, { type: 'dashboard', name: 'd' })).toBeNull();
  });
  it('returns null when the surface identity is incomplete', () => {
    expect(appStudioSurfacePath(crm, true, { type: 'dashboard', name: '' })).toBeNull();
    expect(appStudioSurfacePath(crm, true, { type: '', name: 'd' })).toBeNull();
    expect(appStudioSurfacePath(crm, true, null)).toBeNull();
  });
  it('returns null for apps with no owning package or the sys_metadata pseudo-package', () => {
    expect(appStudioSurfacePath({ name: 'crm' }, true, { type: 'dashboard', name: 'd' })).toBeNull();
    expect(appStudioSurfacePath({ _packageId: 'sys_metadata' }, true, { type: 'dashboard', name: 'd' })).toBeNull();
  });
});

/**
 * App → Studio object deep-link (Data pillar).
 */
describe('appStudioObjectPath', () => {
  const crm = { name: 'crm', _packageId: 'com.acme.crm' };

  it('deep-links to the object surface in the Data pillar', () => {
    expect(appStudioObjectPath(crm, true, 'showcase_task')).toBe(
      '/studio/com.acme.crm/data?surface=object:showcase_task',
    );
  });
  it('URL-encodes the package id and the object name', () => {
    expect(appStudioObjectPath({ _packageId: 'com.acme/crm' }, true, 'my object')).toBe(
      '/studio/com.acme%2Fcrm/data?surface=object:my%20object',
    );
  });
  it('returns null for non-admins', () => {
    expect(appStudioObjectPath(crm, false, 'account')).toBeNull();
  });
  it('returns null when the object name is missing', () => {
    expect(appStudioObjectPath(crm, true, undefined)).toBeNull();
    expect(appStudioObjectPath(crm, true, '')).toBeNull();
  });
  it('returns null for apps with no owning package or the sys_metadata pseudo-package', () => {
    expect(appStudioObjectPath({ name: 'crm' }, true, 'account')).toBeNull();
    expect(appStudioObjectPath({ _packageId: 'sys_metadata' }, true, 'account')).toBeNull();
  });
});

/**
 * App → Studio route bridge — maps a running-app route to its Studio target:
 * an interface surface (dashboard / page / report) deep-links into the
 * Interfaces pillar; an object record page deep-links that object in the Data
 * pillar; everything else opens the package's Data tab.
 */
describe('appStudioRoutePath', () => {
  const crm = { name: 'crm', _packageId: 'com.acme.crm' };

  it('deep-links a dashboard route to its Interfaces surface', () => {
    expect(appStudioRoutePath(crm, true, { type: 'dashboard', name: 'executive_dashboard' })).toBe(
      '/studio/com.acme.crm/interfaces?surface=dashboard:executive_dashboard',
    );
  });

  it('deep-links a page route to its Interfaces surface (the fix — was the Data tab)', () => {
    expect(appStudioRoutePath(crm, true, { type: 'page', name: 'showcase_crm_workbench' })).toBe(
      '/studio/com.acme.crm/interfaces?surface=page:showcase_crm_workbench',
    );
  });

  it('deep-links a report route to its Interfaces surface', () => {
    expect(appStudioRoutePath(crm, true, { type: 'report', name: 'pipeline_report' })).toBe(
      '/studio/com.acme.crm/interfaces?surface=report:pipeline_report',
    );
  });

  it('deep-links an object route (routeType is the object name) to its Data-pillar surface', () => {
    // The fix: an object records page now opens THAT object, not the generic Data tab.
    expect(appStudioRoutePath(crm, true, { type: 'showcase_task', name: undefined })).toBe(
      '/studio/com.acme.crm/data?surface=object:showcase_task',
    );
    // A record-detail route (name='record') still keys off the object route type.
    expect(appStudioRoutePath(crm, true, { type: 'account', name: 'record' })).toBe(
      '/studio/com.acme.crm/data?surface=object:account',
    );
  });

  it('falls back to the plain Data tab for the app root and the system area', () => {
    // No route type at all (bare /apps/:pkg) → Data tab.
    expect(appStudioRoutePath(crm, true, { type: undefined, name: undefined })).toBe('/studio/com.acme.crm/data');
    // The system settings area is not an object.
    expect(appStudioRoutePath(crm, true, { type: 'system', name: 'members' })).toBe('/studio/com.acme.crm/data');
  });

  it('falls back to the Data tab for an interface list route (no surface name)', () => {
    // e.g. /apps/:pkg/page with no specific page selected.
    expect(appStudioRoutePath(crm, true, { type: 'page', name: undefined })).toBe('/studio/com.acme.crm/data');
  });

  it('returns null for non-admins (bridge hidden), for both surface and Data targets', () => {
    expect(appStudioRoutePath(crm, false, { type: 'page', name: 'showcase_crm_workbench' })).toBeNull();
    expect(appStudioRoutePath(crm, false, { type: 'account', name: undefined })).toBeNull();
  });

  it('returns null when the app has no owning package (runtime/DB apps)', () => {
    expect(appStudioRoutePath({ name: 'crm' }, true, { type: 'page', name: 'p' })).toBeNull();
    expect(appStudioRoutePath({ _packageId: 'sys_metadata' }, true, { type: 'page', name: 'p' })).toBeNull();
  });
});
