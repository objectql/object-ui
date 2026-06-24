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

describe('package-scope D6 guardrail (ADR-0070 — no package-less default)', () => {
  const raw = [
    { manifest: { id: 'app.acme.crm', name: 'CRM', scope: 'project' } },
    { manifest: { id: 'platform.core', name: 'Core', scope: 'system' } },
  ];
  it('never makes the Local sentinel the default scope (a real base sorts first, Local last)', () => {
    const opts = buildPackageScopeOptions(raw);
    expect(opts[0].id).not.toBe(LOCAL_PACKAGE_ID);
    expect(opts[opts.length - 1].id).toBe(LOCAL_PACKAGE_ID);
  });
  it('the create-scope source (writableBaseOptions) excludes the Local sentinel entirely', () => {
    expect(writableBaseOptions(raw).some((o) => o.id === LOCAL_PACKAGE_ID)).toBe(false);
  });
});
