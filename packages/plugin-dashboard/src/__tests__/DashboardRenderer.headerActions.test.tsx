/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Dashboard header actions must reach the ActionRunner, whatever their type.
 *
 * The click handler used to allow-list `modal` / `script` only: a `url` action
 * navigated, those two dispatched, and EVERY other declared type — `flow`,
 * `api`, `form`, `navigation` — fell through to a `console.warn` and did
 * nothing at all. A screen flow could not even be launched from a dashboard
 * (framework#3528). The runner owns the type registry, so the renderer no
 * longer second-guesses it.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DashboardComponentSchema } from '@object-ui/types';
import { ActionProvider } from '@object-ui/react';
import { DashboardRenderer } from '../DashboardRenderer';

afterEach(cleanup);

function dashboardWith(actionType: string): DashboardComponentSchema {
  return {
    type: 'dashboard',
    title: 'Ops',
    widgets: [],
    header: {
      actions: [{ label: 'Convert Lead', actionUrl: 'convert_lead_wizard', actionType }],
    },
  } as unknown as DashboardComponentSchema;
}

describe('DashboardRenderer header actions', () => {
  it.each(['flow', 'api', 'form'])('dispatches a %s header action to its handler', async (actionType) => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    render(
      <ActionProvider handlers={{ [actionType]: handler }}>
        <DashboardRenderer schema={dashboardWith(actionType)} />
      </ActionProvider>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /Convert Lead/i }));

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    // The runner resolves the flow/endpoint from the action's own target.
    expect(handler.mock.calls[0][0]).toMatchObject({ type: actionType, target: 'convert_lead_wizard' });
  });

  it('still navigates for a url header action instead of dispatching', async () => {
    const handler = vi.fn();
    const pushState = vi.spyOn(window.history, 'pushState');
    render(
      <ActionProvider handlers={{ url: handler }}>
        <DashboardRenderer schema={dashboardWith('url')} />
      </ActionProvider>,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /Convert Lead/i }));

    await waitFor(() => expect(pushState).toHaveBeenCalled());
    expect(handler).not.toHaveBeenCalled();
    pushState.mockRestore();
  });
});
