/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `LayoutRenderer` renders `AppAction.items` from the DECLARED element type and
 * nothing else (objectui#6854, maintainer ruling of 2026-09-05, option B2).
 *
 * `AppAction.items` is `AppMenuItem[]` — `type` / `label` / `icon` / `path` /
 * `href` / `children` / `badge` / `hidden` — and the zod mirror parses it with
 * the legacy eight-member `MenuItemSchema`, which drops anything else in
 * silence. This map used to reach two keys that are on neither list through
 * `as any`: `onClick` and `shortcut`.
 *
 * Deleting them is what makes `AppActionSchema.onClick`'s refusal message true
 * again. It tells an author "no renderer reads this key, so nothing could ever
 * run it", and until this ruling one did — the three-layer contradiction the
 * card was filed for (`?: never` on the type, "nobody reads it" from the
 * validator, a renderer reading it).
 *
 * These assertions author BOTH undeclared keys anyway — exactly what a host
 * bypassing the validator would hand in, which the card's Zone-2 census found
 * none of in this repo — and require the renderer to ignore both. Re-adding
 * either read turns one of them red.
 *
 * ⛔ NOT a ruling that `shortcut` must stay unrendered for ever: whether it
 * should become AUTHORABLE on `AppAction.items` is its own contract card. This
 * pins the contract as it stands, not the answer to that question.
 *
 * The `packages/types` half of the same claim — that the refusal message still
 * makes it — is pinned in
 * `packages/types/src/__tests__/app-action-onclick-refusal-6854.test.ts`.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppComponentSchema } from '@object-ui/types';

// Static, module-scope import: `LayoutRenderer` pulls `@object-ui/components`
// in for the dropdown primitives, and that cost must not land inside a test's
// timeout budget (AGENTS.md 测试纪律).
import { LayoutRenderer } from '../LayoutRenderer';

afterEach(() => cleanup());

const SHORTCUT = 'Ctrl+P';

/**
 * A user action whose items carry the two keys the declared type does not have.
 * `label` and `type: 'separator'` ARE declared on `AppMenuItem`, so they are the
 * control: they must keep rendering, or this file would pass by rendering
 * nothing at all.
 */
function appWith(onClick: () => void): AppComponentSchema {
  return {
    type: 'app',
    name: 'pin_app',
    title: 'Pin App',
    layout: 'header',
    actions: [
      {
        type: 'user',
        label: 'Ada Lovelace',
        description: 'ada@example.com',
        items: [
          // `onClick` / `shortcut` are NOT on `AppMenuItem`; authored here on
          // purpose, through the same cast the renderer used to read them with.
          { label: 'Profile', onClick, shortcut: SHORTCUT } as never,
          { type: 'separator' },
          { label: 'Sign out' },
        ],
      },
    ],
  } as AppComponentSchema;
}

async function openUserMenu(app: AppComponentSchema) {
  const user = userEvent.setup();
  render(
    <LayoutRenderer app={app}>
      <div>page body</div>
    </LayoutRenderer>,
  );
  // The trigger is the avatar button; with no `avatar` URL the Radix fallback
  // renders the label's initials, which is the stable accessible name here.
  await user.click(screen.getByRole('button', { name: 'AD' }));
  return user;
}

describe('LayoutRenderer renders AppAction.items without reading onClick or shortcut (objectui#6854)', () => {
  it('renders the declared `label` of each item — the control for the two negatives below', async () => {
    await openUserMenu(appWith(vi.fn()));
    expect(await screen.findByText('Profile')).toBeTruthy();
    expect(screen.getByText('Sign out')).toBeTruthy();
  });

  it('still renders the declared `type: "separator"` item as a separator', async () => {
    await openUserMenu(appWith(vi.fn()));
    await screen.findByText('Profile');
    // Two separators: the one above the group, plus the authored divider item.
    expect(screen.getAllByRole('separator').length).toBeGreaterThanOrEqual(2);
  });

  it('never invokes an authored `onClick` — the key the refusal message says no renderer reads', async () => {
    const onClick = vi.fn();
    const user = await openUserMenu(appWith(onClick));
    await user.click(await screen.findByText('Profile'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('never puts an authored `shortcut` into the DOM', async () => {
    await openUserMenu(appWith(vi.fn()));
    await screen.findByText('Profile');
    expect(screen.queryByText(SHORTCUT)).toBeNull();
    expect(document.body.textContent).not.toContain(SHORTCUT);
  });
});
