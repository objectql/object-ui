/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectstack#5159 ratchet — the FilterBuilder's `FilterGroup` must never
 * reach a persisted view `filter` again.
 *
 * The bug: the runtime list toolbar handed `onFilterChange`'s payload straight
 * to `persistViewPatch({ filter })`. That payload is the builder's grouped
 * dialect (`{ id, logic, conditions }`); `ListViewSchema.filter` declares
 * `z.array(ViewFilterRuleSchema)`. Every `Filter → Add filter → save` came back
 * 422 `invalid_union` — and because objectstack#5014 flattens union errors to a
 * bare "Invalid input" that never names `filter`, it lived on `main` unnoticed.
 *
 * `viewFilterFold.test.ts` pins what the fold PRODUCES. This pins that the
 * persist path still GOES THROUGH it: a shape assertion on the transform is
 * worth nothing if a future edit routes a raw group around it. The two together
 * close the issue's replay matrix at the persist-call boundary — variant ① (the
 * captured `FilterGroup`) is unreachable, variant ③ (declared keys only) is
 * what the PUT carries.
 *
 * If this fails: do not re-add `persistViewPatch(…, { filter })`. Route the
 * group through `persistViewFilter` (ObjectView) / `foldFilterGroupToSpecRules`
 * (`./viewFilterFold`), which folds to `ViewFilterRule[]` and refuses — out
 * loud — the shapes that cannot fold losslessly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const objectViewPath = path.join(here, 'ObjectView.tsx');
const widgetsPath = path.join(here, 'metadata-admin/widgets.tsx');

const objectViewSrc = readFileSync(objectViewPath, 'utf8');
const widgetsSrc = readFileSync(widgetsPath, 'utf8');

/**
 * Every `persistViewPatch(…, { filter … })` in the file — the call that shipped
 * the group. Exactly ONE is legitimate: the one inside `persistViewFilter`,
 * whose value is the fold's output. Any other is the bug returning.
 */
const FILTER_PERSIST_CALLS = /persistViewPatch\s*\([^;]*?\{\s*filter\s*(?::\s*([A-Za-z0-9_.]+))?/gs;

describe('objectstack#5159 ratchet — no raw FilterGroup on the view persist path', () => {
    it('the ratchet is reading real source, not an empty string', () => {
        expect(objectViewSrc.length).toBeGreaterThan(10_000);
        expect(widgetsSrc.length).toBeGreaterThan(10_000);
        // Sanity: the guarded symbol still exists under these names.
        expect(objectViewSrc).toContain('persistViewPatch');
    });

    it('the only `filter` patch ObjectView persists is the FOLD’s output', () => {
        // `m[1]` is undefined for the shorthand `{ filter }` — the exact form
        // the bug shipped — so it can never satisfy the expectation below.
        const values = [...objectViewSrc.matchAll(FILTER_PERSIST_CALLS)].map((m) => m[1] ?? '{ filter } shorthand');
        // Exactly one such call, and it writes the folded rules — never the raw
        // `filter` argument the toolbar handed in.
        expect(values, 'a `persistViewPatch(…, { filter })` call appeared that does not write the fold’s output')
            .toEqual(['folded.rules']);
    });

    it('every toolbar filter change routes through the fold', () => {
        // Look at the code immediately following each `onFilterChange` binding:
        // it must reach `persistViewFilter`, not `persistViewPatch`.
        const sites = [...objectViewSrc.matchAll(/onFilterChange[=:]/g)];
        expect(sites.length, 'expected the list-toolbar onFilterChange handlers to be found')
            .toBeGreaterThanOrEqual(2);
        for (const site of sites) {
            // Window = this handler only. It ends where the NEXT `onXxx`
            // binding starts, so the sibling handlers (which legitimately call
            // `persistViewPatch` for sort / hiddenFields / columnState) stay
            // out of the assertion.
            const rest = objectViewSrc.slice(site.index! + 1, site.index! + 401);
            const next = rest.search(/\bon[A-Z]\w*\s*[=:]/);
            const body = next === -1 ? rest : rest.slice(0, next);
            expect(body, `this onFilterChange bypasses the fold:\n${body}`).toContain('persistViewFilter');
            expect(body, `this onFilterChange persists a raw group:\n${body}`).not.toContain('persistViewPatch');
        }
    });

    it('ObjectView imports the shared fold rather than re-deriving one', () => {
        expect(objectViewSrc).toMatch(/import\s*\{[^}]*foldFilterGroupToSpecRules[^}]*\}\s*from\s*'\.\/viewFilterFold'/);
    });

    it('the Studio inspector folds through the SAME module — one dialect, not two', () => {
        expect(widgetsSrc).toMatch(/import\s*\{[^}]*foldFilterGroupToSpecRules[^}]*\}\s*from\s*'\.\.\/viewFilterFold'/);
        // The local operator table it used to carry is gone: a second table is
        // how the runtime toolbar ended up with no fold at all. (Matched on the
        // DECLARATION so the comment explaining the removal doesn't trip it.)
        expect(widgetsSrc).not.toMatch(/const\s+FB_TO_SPEC\b/);
    });

    it('the refusal reaches the user — both fold call sites surface it, none swallow it', () => {
        for (const [name, src] of [['ObjectView.tsx', objectViewSrc], ['widgets.tsx', widgetsSrc]] as const) {
            expect(src, `${name} calls the fold`).toContain('foldFilterGroupToSpecRules');
            expect(src, `${name} surfaces the refusal as a toast`).toMatch(
                /toast\.error\(\s*tr?\(\s*FILTER_FOLD_REFUSAL_KEYS/,
            );
        }
    });
});
