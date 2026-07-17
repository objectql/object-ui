/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { isServiceUsable, type DiscoveryServiceInfo } from './index';

describe('isServiceUsable (framework#2462 ADR-0076 D12 honest capabilities)', () => {
  it('returns false for missing service entries', () => {
    expect(isServiceUsable(undefined)).toBe(false);
    expect(isServiceUsable(null)).toBe(false);
  });

  it('returns false when enabled is not strictly true', () => {
    expect(isServiceUsable({ enabled: false })).toBe(false);
    expect(
      isServiceUsable({ enabled: 'yes' as unknown as boolean })
    ).toBe(false);
  });

  it('trusts handlerReady when present, regardless of status', () => {
    const cases: Array<[DiscoveryServiceInfo, boolean]> = [
      // dev stub: enabled but no live handler → NOT usable
      [{ enabled: true, status: 'stub', handlerReady: false }, false],
      // degraded fallback with a real handler (e.g. analytics fallback) → usable
      [{ enabled: true, status: 'degraded', handlerReady: true }, true],
      [{ enabled: true, status: 'available', handlerReady: false }, false],
      [{ enabled: true, handlerReady: true }, true],
    ];
    for (const [svc, expected] of cases) {
      expect(isServiceUsable(svc)).toBe(expected);
    }
  });

  it("falls back to status === 'available' when handlerReady is absent", () => {
    expect(isServiceUsable({ enabled: true, status: 'available' })).toBe(true);
    expect(isServiceUsable({ enabled: true, status: 'registered' })).toBe(false);
    expect(isServiceUsable({ enabled: true, status: 'degraded' })).toBe(false);
    expect(isServiceUsable({ enabled: true, status: 'unavailable' })).toBe(false);
    expect(isServiceUsable({ enabled: true, status: 'stub' })).toBe(false);
  });

  it('returns false for enabled entries with neither handlerReady nor status', () => {
    // pre-D12 servers never send bare { enabled: true } without status;
    // treat unknown shapes conservatively
    expect(isServiceUsable({ enabled: true })).toBe(false);
  });
});
