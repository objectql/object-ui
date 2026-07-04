/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0053 wrong-context authoring surfaced instead of silently dropped
 * (#2219): `userFilters` / `quickFilters` on an object list view are
 * suppressed by ObjectView — the author must get a console warning, once
 * per object/view.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    warnSuppressedListNav,
    resetSuppressedListNavWarnings,
} from '../warnSuppressedListNav';

const USER_FILTERS = { element: 'dropdown', fields: [{ field: 'status' }] };

describe('warnSuppressedListNav (#2219)', () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        resetSuppressedListNavWarnings();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warn.mockRestore();
    });

    it('warns when the view def carries userFilters', () => {
        const hit = warnSuppressedListNav('showcase_task', 'showcase_task.tabular',
            { userFilters: USER_FILTERS }, {});
        expect(hit).toBe(true);
        expect(warn).toHaveBeenCalledTimes(1);
        const msg = warn.mock.calls[0][0] as string;
        expect(msg).toContain('showcase_task.tabular');
        expect(msg).toContain('userFilters');
        expect(msg).toContain('ADR-0053');
    });

    it('warns when only the base list schema carries quickFilters', () => {
        const hit = warnSuppressedListNav('showcase_task', 'all',
            {}, { quickFilters: [{ field: 'status' }] });
        expect(hit).toBe(true);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('quickFilters');
    });

    it('warns only once per object/view across re-renders', () => {
        warnSuppressedListNav('showcase_task', 'tabular', { userFilters: USER_FILTERS }, {});
        warnSuppressedListNav('showcase_task', 'tabular', { userFilters: USER_FILTERS }, {});
        expect(warn).toHaveBeenCalledTimes(1);
        // A different view still gets its own warning.
        warnSuppressedListNav('showcase_task', 'board', { userFilters: USER_FILTERS }, {});
        expect(warn).toHaveBeenCalledTimes(2);
    });

    it('stays silent for a clean view', () => {
        const hit = warnSuppressedListNav('showcase_task', 'grid', { filter: [] }, {});
        expect(hit).toBe(false);
        expect(warn).not.toHaveBeenCalled();
    });
});
