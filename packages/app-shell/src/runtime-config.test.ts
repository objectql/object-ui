// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * runtime-config commercial-feature parsing (cloud ADR-0011/0012).
 *
 * `customDomain` / `sso` are paid flags: they must default OFF and only turn on
 * when the server explicitly grants them, so an older/vanilla runtime that
 * omits them never surfaces a paid affordance.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { initRuntimeConfig, getRuntimeConfig, resetRuntimeConfigForTesting } from './runtime-config.js';

function mockConfig(features: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ features }),
    })) as any);
}

afterEach(() => {
    resetRuntimeConfigForTesting();
    vi.unstubAllGlobals();
});

describe('runtime-config commercial features', () => {
    it('defaults customDomain/sso OFF before init', () => {
        resetRuntimeConfigForTesting();
        expect(getRuntimeConfig().features.customDomain).toBe(false);
        expect(getRuntimeConfig().features.sso).toBe(false);
    });

    it('grants customDomain/sso only when the server says true', async () => {
        mockConfig({ customDomain: true, sso: false });
        await initRuntimeConfig();
        expect(getRuntimeConfig().features.customDomain).toBe(true);
        expect(getRuntimeConfig().features.sso).toBe(false);
    });

    it('business-tier grants both', async () => {
        mockConfig({ customDomain: true, sso: true });
        await initRuntimeConfig();
        expect(getRuntimeConfig().features.customDomain).toBe(true);
        expect(getRuntimeConfig().features.sso).toBe(true);
    });

    it('older runtime omitting the flags keeps them OFF (no paid surface leak)', async () => {
        mockConfig({ aiStudio: true }); // no customDomain/sso keys at all
        await initRuntimeConfig();
        expect(getRuntimeConfig().features.customDomain).toBe(false);
        expect(getRuntimeConfig().features.sso).toBe(false);
        // sanity: existing flags still parse
        expect(getRuntimeConfig().features.aiStudio).toBe(true);
    });
});
