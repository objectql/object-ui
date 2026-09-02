/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#7256 — no Home affordance in the console chrome may name `/home`
 * literally again.
 *
 * ## The defect
 *
 * cloud's control plane lands a signed-in customer on the app declared with
 * `isDefault` (`cloud_control` → its Welcome page). The chrome did not follow:
 * the top-bar logo, both sidebar Home rows and the app-switcher Home entry each
 * hard-coded `/home`, the ENVIRONMENT layer's launcher (ADR-0075). One click on
 * the logo therefore left the control plane's guided welcome for a screen whose
 * "Build an app" / "Start from a template" cards act on an environment the
 * control plane does not have, and whose "Your apps" tiles are the control
 * plane's own internal management apps.
 *
 * The declaration was already there and already read by `/`
 * (`resolveLandingPath`). The chrome just wasn't reading it. That asymmetry is
 * what recurs: each of these four sites is a one-line link target, and typing
 * the literal is one keystroke cheaper than importing the hook.
 *
 * ## ⚠ WHAT THIS FILE CANNOT ASSERT — read before adding a case here
 *
 * A SOURCE SCAN, not a behavioural test. It proves the literal is gone and the
 * hook is imported; it does not prove the hook answers correctly (that is
 * `hooks/__tests__/useHomePath.test.tsx`) nor that the declaration itself is
 * read correctly (`utils/__tests__/homePath.test.ts`). None of the three
 * replaces another.
 *
 * It also deliberately does NOT cover the "this app is gone, go somewhere safe"
 * redirects in `console/AppContent.tsx` / `console/ConsoleShell.tsx`. Those are
 * error-recovery paths, not Home affordances, and retargeting them moves a
 * `/home` expectation that a dozen existing tests pin — a separate change with
 * its own measurement.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');

const read = (rel: string) => readFileSync(path.join(repoRoot, rel), 'utf8');

/**
 * Drop block and line comments before scanning. Doc comments legitimately NAME
 * the launcher path while explaining which screen it is and why the chrome no
 * longer points at it — without this, the rule would forbid documenting its own
 * subject, and the pressure would be to delete the explanation.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** The chrome's Home affordances: file → the expression each must resolve to. */
const AFFORDANCES: ReadonlyArray<{ file: string; site: string; expression: RegExp }> = [
  {
    file: 'packages/app-shell/src/layout/AppHeader.tsx',
    site: 'top-bar brand logo',
    expression: /to=\{homePath\}/,
  },
  {
    file: 'packages/app-shell/src/layout/UnifiedSidebar.tsx',
    site: "sidebar 'Home' row + mobile sheet 'Home' row",
    expression: /url: homePath/,
  },
  {
    file: 'packages/app-shell/src/layout/AppSidebar.tsx',
    site: "app-switcher 'Home' entry",
    expression: /navigate\(homePath\)/,
  },
];

/** `'/home'`, `"/home"` or `` `/home` `` — the literal in any quoting. */
const LAUNCHER_LITERAL = /['"`]\/home['"`]/;

describe('objectui#7256 — chrome Home affordances follow the declared landing', () => {
  it.each(AFFORDANCES)('$site does not hard-code the launcher path', ({ file }) => {
    expect(stripComments(read(file))).not.toMatch(LAUNCHER_LITERAL);
  });

  it.each(AFFORDANCES)('$site reads useHomePath()', ({ file, expression }) => {
    const src = stripComments(read(file));
    expect(src).toMatch(/import \{ useHomePath \} from '\.\.\/hooks\/useHomePath\.js'/);
    expect(src).toMatch(/const homePath = useHomePath\(\)/);
    expect(src).toMatch(expression);
  });

  it("the mobile sheet's Home row follows it too", () => {
    // Its own case: it is the ONLY way out of an app on a phone (no
    // path-separator, no back arrow, and the logo is hidden there), so a stale
    // literal here strands exactly the viewer with the fewest alternatives.
    const src = stripComments(read('packages/app-shell/src/layout/UnifiedSidebar.tsx'));
    expect(src).toMatch(/to=\{homePath\}[^\n]*data-testid="mobile-sidebar-home"/);
  });

  it("apps/console's `/` resolver reads the SAME declaration reader", () => {
    // The whole point is that the post-login landing and the logo cannot name
    // two different homes — which only holds while both read one policy.
    const src = stripComments(read('apps/console/src/components/RootLandingRedirect.tsx'));
    expect(src).toMatch(/resolveDeclaredHomePath/);
    expect(src).toMatch(/HOME_LAUNCHER_PATH/);
    expect(src).not.toMatch(LAUNCHER_LITERAL);
  });
});
