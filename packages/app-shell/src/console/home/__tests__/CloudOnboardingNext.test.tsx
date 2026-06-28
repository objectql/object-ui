// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * CloudOnboardingNext resolves `hasProductionEnv` from the entitlements summary
 * and shows the right primary next-step: "Create your environment" when the org
 * has none, "Open Production" once it does, and a graceful both-actions fallback
 * when the signal can't be resolved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const navigateMock = vi.fn();
let fetchImpl: (url: string, init?: any) => Promise<any>;

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));
vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ activeOrganization: { id: 'org_1' } }),
  createAuthenticatedFetch: () => (url: string, init?: any) => fetchImpl(url, init),
}));

import { CloudOnboardingNext } from '../CloudOnboardingNext';

function summary(hasProductionEnv: boolean) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: { hasProductionEnv } }),
  };
}

const PROPS = {
  properties: {
    openProductionUrl: '/api/v1/cloud/environments/production/sso-open',
    environmentsRoute: '/apps/cloud_control/sys_environment',
  },
};

describe('CloudOnboardingNext', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('shows "Create your environment" when the org has no production env', async () => {
    fetchImpl = async () => summary(false);
    render(<CloudOnboardingNext {...PROPS} />);

    const create = await screen.findByText('Create your environment');
    expect(create).toBeTruthy();
    expect(screen.queryByText('Open Production')).toBeNull();

    fireEvent.click(create);
    expect(navigateMock).toHaveBeenCalledWith('/apps/cloud_control/sys_environment');
  });

  it('shows "Open Production" once the org has a production env', async () => {
    fetchImpl = async () => summary(true);
    render(<CloudOnboardingNext {...PROPS} />);

    expect(await screen.findByText('Open Production')).toBeTruthy();
    expect(screen.queryByText('Create your environment')).toBeNull();
  });

  it('degrades to the open-production actions when the signal cannot be resolved', async () => {
    fetchImpl = async () => ({ ok: false, status: 500, json: async () => null });
    render(<CloudOnboardingNext {...PROPS} />);

    // Unknown state is fail-safe: it must NEVER strand a real user behind a
    // wrong "create" CTA, so it shows Open Production + Manage environments.
    expect(await screen.findByText('Open Production')).toBeTruthy();
    expect(screen.getByText('Manage environments')).toBeTruthy();
    expect(screen.queryByText('Create your environment')).toBeNull();
  });

  it('renders a non-CTA skeleton while the signal is still loading', async () => {
    let resolveFetch: (v: any) => void = () => {};
    fetchImpl = () => new Promise((r) => { resolveFetch = r; });
    const { container } = render(<CloudOnboardingNext {...PROPS} />);

    // Before the fetch resolves: no CTA text, just the skeleton placeholder.
    expect(screen.queryByText('Open Production')).toBeNull();
    expect(screen.queryByText('Create your environment')).toBeNull();
    expect(container.querySelector('[data-onboarding="loading"]')).toBeTruthy();

    resolveFetch(summary(true));
    await waitFor(() => expect(screen.getByText('Open Production')).toBeTruthy());
  });
});
