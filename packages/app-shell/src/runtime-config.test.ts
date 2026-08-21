// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * runtime-config commercial-feature parsing (cloud ADR-0011/0012).
 *
 * `customDomain` / `sso` are paid flags: they must default OFF and only turn on
 * when the server explicitly grants them, so an older/vanilla runtime that
 * omits them never surfaces a paid affordance.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { initRuntimeConfig, getRuntimeConfig, getPlatformStage, isAiStudioEnabled, isMarketplaceEnabled, resetRuntimeConfigForTesting } from './runtime-config.js';

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

/**
 * Platform stage drives the top-bar preview/beta badge. It must default to
 * `'preview'` so the whole platform reads as preview before/without any server
 * signal, only leave preview when the server sends a recognised stage, and
 * never blank out on a malformed payload.
 */
function mockBranding(branding: Record<string, unknown>) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        json: async () => ({ branding }),
    })) as any);
}

/**
 * `isAiStudioEnabled()` — the AI-authoring gate's ONE spelling (objectui#5577).
 *
 * `features.aiStudio` used to be read inline at two call sites with two
 * different spellings (`ChatDock` un-chained, `HomePage` optional-chained), and
 * the fail-open doctrine was written down only on the `marketplace` sibling. The
 * accessor is where the doctrine now lives, so these cases pin the doctrine
 * itself rather than either call site's transcription of it:
 *
 *  - fails OPEN on every unanswered question (before init, key absent, fetch
 *    failed) — withholding a working capability on no answer is the worse
 *    direction, and the server refuses the write regardless;
 *  - only the literal `false` closes it;
 *  - the snapshot the accessor reads always carries `features`, which is why an
 *    absent flag is a DEFAULT here and never a TypeError.
 */
describe('runtime-config isAiStudioEnabled (objectui#5577)', () => {
    it('fails OPEN before init — a runtime that never answered keeps the capability', () => {
        resetRuntimeConfigForTesting();
        expect(isAiStudioEnabled()).toBe(true);
    });

    it('honours an explicit false from the server', async () => {
        mockConfig({ aiStudio: false });
        await initRuntimeConfig();
        expect(isAiStudioEnabled()).toBe(false);
    });

    it('stays enabled when the server explicitly says true', async () => {
        mockConfig({ aiStudio: true });
        await initRuntimeConfig();
        expect(isAiStudioEnabled()).toBe(true);
    });

    it('fails OPEN when the runtime omits the aiStudio key entirely', async () => {
        mockConfig({ marketplace: true }); // no aiStudio key at all
        await initRuntimeConfig();
        expect(isAiStudioEnabled()).toBe(true);
    });

    it('fails OPEN when the config fetch itself fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new Error('network down');
        }) as any);
        await initRuntimeConfig();
        expect(isAiStudioEnabled()).toBe(true);
    });

    it('closes only on the literal false, never on a falsy look-alike', async () => {
        // `!== false` is the doctrine, not `=== true`: a runtime that sends a
        // string or a 0 has not said "disabled", so the capability stays.
        mockConfig({ aiStudio: 'false' });
        await initRuntimeConfig();
        expect(isAiStudioEnabled()).toBe(true);
    });

    it('agrees with its marketplace sibling on the fail-open direction', () => {
        // One doctrine, one spelling. If these two ever diverge, the accessor
        // that changed has left the doctrine its docblock claims to carry.
        resetRuntimeConfigForTesting();
        expect(isAiStudioEnabled()).toBe(isMarketplaceEnabled());
        expect(isAiStudioEnabled()).toBe(true);
    });

    /**
     * The reachability leg of objectui#5577: the accessor reads the module's own
     * singleton, and EVERY writer of that singleton constructs `features` as an
     * object (the initial `{...defaults}`, `applyUpdate`'s spread, and the test
     * reset). There is no exported setter, so no caller can install a partial
     * snapshot through the module's API — which is what makes an absent flag a
     * default rather than the TypeError the un-chained inline read would have
     * produced. Driven through the real fetch path, not asserted from the source.
     */
    it('never hands out a snapshot missing `features`, whatever the server sends', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({ branding: { productName: 'Acme' } }), // no `features` key
        })) as any);
        await initRuntimeConfig();
        expect(getRuntimeConfig().features).toBeDefined();
        expect(getRuntimeConfig().branding.productName).toBe('Acme');
        expect(isAiStudioEnabled()).toBe(true);
    });
});

describe('runtime-config platform stage', () => {
    it('defaults to preview before init (badge shows out of the box)', () => {
        resetRuntimeConfigForTesting();
        expect(getPlatformStage()).toBe('preview');
    });

    it('honours an explicit stage from the server (e.g. GA hides the badge)', async () => {
        mockBranding({ stage: 'ga' });
        await initRuntimeConfig();
        expect(getPlatformStage()).toBe('ga');
    });

    it('keeps the preview default when branding omits the stage', async () => {
        mockBranding({ productName: 'Acme' });
        await initRuntimeConfig();
        expect(getRuntimeConfig().branding.productName).toBe('Acme');
        expect(getPlatformStage()).toBe('preview');
    });

    it('ignores an unrecognised stage rather than blanking the badge', async () => {
        mockBranding({ stage: 'nonsense' });
        await initRuntimeConfig();
        expect(getPlatformStage()).toBe('preview');
    });
});
