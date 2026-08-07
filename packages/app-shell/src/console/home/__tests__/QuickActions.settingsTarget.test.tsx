// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `QuickActions` — "System Settings" card target (objectui#3611).
 *
 * ## This one is DORMANT, and the test says so on purpose
 *
 * Unlike the other three sites #3611 fixes, no user can reach this card today:
 * `QuickActions` has zero JSX call sites repo-wide. It is exported from
 * `console/home/index.ts` and rendered by nobody (`HomePage` builds its own
 * tiles). So there is no user-visible behavior change here and nothing to
 * verify through a mounted page.
 *
 * It was fixed anyway, in the same pass, for one reason: the day someone
 * remounts this component on `/home`, the dead link comes back with it. This
 * file is the guard that makes that reappearance impossible — it renders the
 * component DIRECTLY (the honest scope for dormant code) rather than pretending
 * a route reaches it.
 *
 * ## The target
 *
 * Same root cause as its three live siblings: `AppContent` mounts the system
 * hub only on `isSystemRoute`, so a bare `/apps/setup` is the "No Apps
 * Configured" empty state's own URL on a zero-app deployment. The card's
 * sibling ("Manage Objects") already spelled `/apps/setup/system/...`, which is
 * what made this one the odd entry out.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

import { QuickActions } from '../QuickActions';

/** Reports where a card's navigate() actually put the router. */
function Landing() {
  const { pathname } = useLocation();
  return <div data-testid="landing">{pathname}</div>;
}

function renderQuickActions() {
  render(
    <MemoryRouter initialEntries={['/home']}>
      <QuickActions />
      <Routes>
        <Route path="*" element={<Landing />} />
      </Routes>
    </MemoryRouter>,
  );
}

const SYSTEM_HUB = '/apps/setup/system';

describe('QuickActions system-settings card (objectui#3611, dormant)', () => {
  it('DORMANCY PRECONDITION: nothing renders this component, so the fix is a guard, not a user-visible change', async () => {
    // Recorded as an assertion rather than prose so it goes red the day the
    // component is remounted — at which point the pin below stops being a
    // guard and becomes a live-path test, and this file should be re-read.
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const here = path.dirname(fileURLToPath(import.meta.url));
    // .../src/console/home/__tests__ -> .../src
    const srcRoot = path.resolve(here, '../../..');

    const callSites: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.tsx$/.test(entry.name) && !/\.(test|spec)\.tsx$/.test(entry.name)) {
          if (/<QuickActions\b/.test(readFileSync(full, 'utf8'))) callSites.push(full);
        }
      }
    };
    if (statSync(srcRoot).isDirectory()) walk(srcRoot);

    expect(callSites).toEqual([]);
  });

  it('the System Settings card targets the system hub, not the bare setup URL', async () => {
    const user = userEvent.setup();
    renderQuickActions();

    await user.click(screen.getByTestId('quick-action-system-settings'));

    expect(screen.getByTestId('landing')).toHaveTextContent(SYSTEM_HUB);
  });

  it('REGRESSION: the sibling card that was already hub-scoped is unchanged', async () => {
    const user = userEvent.setup();
    renderQuickActions();

    await user.click(screen.getByTestId('quick-action-manage-objects'));

    expect(screen.getByTestId('landing')).toHaveTextContent(`${SYSTEM_HUB}/metadata/object`);
  });
});
