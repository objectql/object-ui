/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerServiceWorker } from '../serviceWorker';

describe('registerServiceWorker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when navigator is undefined', async () => {
    const origNavigator = globalThis.navigator;
    // @ts-ignore
    Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
    const result = await registerServiceWorker();
    expect(result).toBeNull();
    Object.defineProperty(globalThis, 'navigator', { value: origNavigator, writable: true, configurable: true });
  });

  it('returns null when serviceWorker is not in navigator', async () => {
    const origSW = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    // @ts-ignore  
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, writable: true, configurable: true });
    const result = await registerServiceWorker();
    expect(result).toBeNull();
    if (origSW) {
      Object.defineProperty(navigator, 'serviceWorker', origSW);
    }
  });

  it('handles registration errors', async () => {
    const onError = vi.fn();
    const origSW = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockRejectedValue(new Error('SW failed')),
        controller: null,
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker({ onError });
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(onError.mock.calls[0][0].message).toBe('SW failed');

    if (origSW) {
      Object.defineProperty(navigator, 'serviceWorker', origSW);
    }
  });

  it('handles non-Error registration errors', async () => {
    const onError = vi.fn();

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockRejectedValue('string error'),
        controller: null,
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker({ onError });
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('registers service worker with defaults', async () => {
    const mockRegistration = {
      installing: null,
      onupdatefound: null as any,
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        controller: null,
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker();
    expect(result).toBe(mockRegistration);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/service-worker.js', { scope: '/' });
  });

  it('registers service worker with custom config', async () => {
    const mockRegistration = {
      installing: null,
      onupdatefound: null as any,
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        controller: null,
      },
      writable: true,
      configurable: true,
    });

    const result = await registerServiceWorker({ url: '/sw.js', scope: '/app/' });
    expect(result).toBe(mockRegistration);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js', { scope: '/app/' });
  });
});
