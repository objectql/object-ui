// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, expect, it } from 'vitest';
import {
  buildPackageScopeOptions,
  writableBaseOptions,
  isLocalScope,
  LOCAL_PACKAGE_ID,
} from './package-scope';

describe('package-scope (ADR-0070)', () => {
  const raw = [
    { item: { manifest: { id: 'app.acme.crm', name: 'CRM', scope: 'project' } } },
    { item: { manifest: { id: 'platform.core', name: 'Core', scope: 'system' } } },
    { manifest: { id: 'app.acme.hr', name: 'HR', scope: 'project' } },
  ];

  it('buildPackageScopeOptions filters system/cloud and appends the Local sentinel last', () => {
    const ids = buildPackageScopeOptions(raw).map((o) => o.id);
    expect(ids).toContain('app.acme.crm');
    expect(ids).toContain('app.acme.hr');
    expect(ids).not.toContain('platform.core'); // system scope filtered out
    expect(ids[ids.length - 1]).toBe(LOCAL_PACKAGE_ID);
  });

  it('writableBaseOptions excludes the Local sentinel AND code/installed packages', () => {
    const ids = writableBaseOptions(raw).map((o) => o.id);
    expect(ids).toEqual(['app.acme.crm', 'app.acme.hr']); // sorted by name, no Local, no system
    expect(ids).not.toContain(LOCAL_PACKAGE_ID);
  });

  it('writableBaseOptions is empty when only code/installed packages exist', () => {
    expect(writableBaseOptions([{ manifest: { id: 'platform.core', scope: 'system' } }])).toEqual([]);
    expect(writableBaseOptions(null)).toEqual([]);
  });

  it('isLocalScope treats null / undefined / the sentinel as local, real bases as not', () => {
    expect(isLocalScope(null)).toBe(true);
    expect(isLocalScope(undefined)).toBe(true);
    expect(isLocalScope(LOCAL_PACKAGE_ID)).toBe(true);
    expect(isLocalScope('app.acme.crm')).toBe(false);
  });
});
