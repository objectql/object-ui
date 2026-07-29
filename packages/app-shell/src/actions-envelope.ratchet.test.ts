/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectstack#3913 ratchet — every `/api/v1/actions` caller goes through
 * `interpretActionResponse`.
 *
 * The bug this guards: the `/actions` response wraps TWICE (the route's own
 * `{success, data}` inside the dispatcher's), and a failure has three shapes
 * only one of which `res.ok` catches. Two copies of that rule existed — the
 * shared console runtime and RecordDetailView's — and they drifted: one learned
 * to inspect the inner envelope, the other did not. The one that did not was
 * the console's MAIN action path, so a failed action fired a green "completed"
 * toast on every list and page surface while the real error was swallowed.
 * `marketplaceApi.installPackage` had the same hole and could report a package
 * as installed when it was not.
 *
 * Reading the envelope by hand is the anti-pattern, not any particular way of
 * reading it wrong: four hand-rolled copies produced three different bugs
 * (missed inner failure, a `{message}` object handed to `toast.error()` as a
 * React child → React #31, and `redirectUrl` read one level too shallow so it
 * never fired). One helper, one rule.
 *
 * If this fails: don't hand-roll the check. Import `interpretActionResponse`
 * from `utils/actionResponse` — or, better, call the action through
 * `@objectstack/client`, which folds every shape into `{ success, data?, error? }`.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appShellSrc = here;

/** The helper that owns the rule — exempt from its own guard. */
const OWNER = path.join(appShellSrc, 'utils', 'actionResponse.ts');

/** Files allowed to name the route without going through the helper. */
const EXEMPT = new Set<string>([
    OWNER,
    // The cloud marketplace install posts to a *cloud* origin's action route
    // and consumes `InstallResponse`, not `ActionResult`. It still has to
    // honour the envelope, and does — covered by its own tests — but it is not
    // an ActionRunner handler, so it does not use this helper.
    path.join(appShellSrc, 'console', 'marketplace', 'marketplaceApi.ts'),
]);

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
}

/** A source file that POSTs to the action route. */
const ROUTE = /\/api\/v1\/actions\//;

/**
 * Comments name the route freely while explaining the routing rules (e.g.
 * ConsoleShell's note on why `modal` stays client-side). Only CODE counts.
 */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('objectstack#3913 ratchet — /actions callers use interpretActionResponse', () => {
    const callers = walk(appShellSrc)
        .filter((f) => !EXEMPT.has(f) && ROUTE.test(stripComments(readFileSync(f, 'utf8'))));

    const offenders = callers
        .filter((f) => !readFileSync(f, 'utf8').includes('interpretActionResponse'))
        .map((f) => path.relative(appShellSrc, f));

    it('no app-shell file interprets an /actions response by hand', () => {
        expect(offenders).toEqual([]);
    });

    it('still guards something — the known callers are present', () => {
        // A ratchet that matches nothing passes vacuously forever. Pin that the
        // two handlers it exists for are actually being scanned.
        expect(callers.map((f) => path.relative(appShellSrc, f))).toEqual(
            expect.arrayContaining([
                path.join('hooks', 'useConsoleActionRuntime.tsx'),
                path.join('views', 'RecordDetailView.tsx'),
            ]),
        );
    });
});
