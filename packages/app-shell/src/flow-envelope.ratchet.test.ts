/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * #2958 ratchet — every flow `trigger` / `resume` caller goes through
 * `interpretFlowResponse`.
 *
 * The sibling of `actions-envelope.ratchet.test.ts`, for the same reason. The
 * rule for reading an `AutomationResult` lived in THREE hand-rolled copies —
 * the flow handlers in `useConsoleActionRuntime` and `RecordDetailView`, and
 * `FlowRunner`'s resume — and only the resume copy was complete. The two launch
 * copies validated the transport envelope and then treated everything else as
 * terminal success, so a run that failed on its first node was reported as a
 * completed one: no dialog, a green "completed successfully" toast, a refresh,
 * and the real error swallowed. One copy also passed the error value through
 * raw, where a nested `{code, message}` reaches `toast.error()` as a React child
 * and crashes the page (React #31).
 *
 * If this fails: don't hand-roll the check. Import `interpretFlowResponse` from
 * `utils/flowResponse` — it classifies transport failure / flow failure /
 * screen pause / terminal success, and guarantees a string error.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appShellSrc = here;

/** The helper that owns the rule — exempt from its own guard. */
const OWNER = path.join(appShellSrc, 'utils', 'flowResponse.ts');

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist' || entry === '__tests__') continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
}

/**
 * Comments name routes freely while explaining them. Only CODE counts.
 */
function stripComments(src: string): string {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * A file that LAUNCHES or RESUMES a flow run — i.e. one that receives an
 * `AutomationResult` to interpret.
 *
 * Deliberately narrower than "names the automation route": most automation
 * callers READ the registry (`/connectors`, `/actions`, `/_status`, `/runs` for
 * the observability panel) and get back a list, not a run result. Those have no
 * envelope rule to get wrong.
 */
function runsAFlow(src: string): boolean {
    const code = stripComments(src);
    if (!/\/api\/v1\/automation\//.test(code)) return false;
    return /\/trigger[`'"]/.test(code) || /\/resume[`'"]/.test(code);
}

describe('#2958 ratchet — flow trigger/resume callers use interpretFlowResponse', () => {
    const callers = walk(appShellSrc)
        .filter((f) => f !== OWNER && runsAFlow(readFileSync(f, 'utf8')));

    const offenders = callers
        .filter((f) => !readFileSync(f, 'utf8').includes('interpretFlowResponse'))
        .map((f) => path.relative(appShellSrc, f));

    it('no app-shell file interprets a flow run result by hand', () => {
        expect(offenders).toEqual([]);
    });

    it('still guards something — the three known callers are present', () => {
        // A ratchet that matches nothing passes vacuously forever. Pin that the
        // copies it exists for are actually being scanned.
        expect(callers.map((f) => path.relative(appShellSrc, f))).toEqual(
            expect.arrayContaining([
                path.join('hooks', 'useConsoleActionRuntime.tsx'),
                path.join('views', 'RecordDetailView.tsx'),
                path.join('views', 'FlowRunner.tsx'),
            ]),
        );
    });
});
