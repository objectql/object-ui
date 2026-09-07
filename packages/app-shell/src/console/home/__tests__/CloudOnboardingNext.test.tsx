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
vi.mock('@object-ui/auth', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useAuth: () => ({ activeOrganization: { id: 'org_1' } }),
  createAuthenticatedFetch: () => (url: string, init?: any) => fetchImpl(url, init),
}));

import { I18nProvider } from '@object-ui/i18n';
import { CloudOnboardingNext } from '../CloudOnboardingNext';

/**
 * The CTA labels resolve from the locale packs (objectui#2871), so these
 * renders need a real i18n context — without one `t()` returns the raw key and
 * these assertions would pass against nothing. Pinned to `en` with browser
 * detection off so the expectations stay deterministic.
 */
const renderOnboarding = (ui: React.ReactElement) =>
  render(
    <I18nProvider config={{ defaultLanguage: 'en', detectBrowserLanguage: false }}>
      {ui}
    </I18nProvider>,
  );

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
    renderOnboarding(<CloudOnboardingNext {...PROPS} />);

    const create = await screen.findByText('Create your environment');
    expect(create).toBeTruthy();
    expect(screen.queryByText('Open Production')).toBeNull();

    fireEvent.click(create);
    // Deep-links into the create dialog (#844): the environments list consumes
    // `runAction=create_environment` and auto-opens its create action.
    expect(navigateMock).toHaveBeenCalledWith(
      '/apps/cloud_control/sys_environment?runAction=create_environment',
    );
  });

  it('shows "Open Production" once the org has a production env', async () => {
    fetchImpl = async () => summary(true);
    renderOnboarding(<CloudOnboardingNext {...PROPS} />);

    expect(await screen.findByText('Open Production')).toBeTruthy();
    expect(screen.queryByText('Create your environment')).toBeNull();
  });

  it('degrades to the open-production actions when the signal cannot be resolved', async () => {
    fetchImpl = async () => ({ ok: false, status: 500, json: async () => null });
    renderOnboarding(<CloudOnboardingNext {...PROPS} />);

    // Unknown state is fail-safe: it must NEVER strand a real user behind a
    // wrong "create" CTA, so it shows Open Production + Manage environments.
    expect(await screen.findByText('Open Production')).toBeTruthy();
    expect(screen.getByText('Manage environments')).toBeTruthy();
    expect(screen.queryByText('Create your environment')).toBeNull();
  });

  // Strict envelope pins (#3352): the control plane wraps success bodies as
  // `{ success, data }`, so a BARE body is a producer contract violation and
  // must NOT produce a usable summary. It resolves to `unknown` (both actions
  // work) instead of being read field-by-field off the wrong shape.
  it('does NOT read a bare (un-enveloped) body as a usable summary', async () => {
    fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ hasProductionEnv: true }),
    });
    const { container } = renderOnboarding(<CloudOnboardingNext {...PROPS} />);

    await waitFor(() =>
      expect(container.querySelector('[data-onboarding="unknown"]')).toBeTruthy(),
    );
    expect(container.querySelector('[data-onboarding="ready"]')).toBeNull();
  });

  it('never strands a user behind a wrong "create" CTA when the envelope is missing', async () => {
    // The silent-degradation case the strict read exists to kill: an
    // un-enveloped body whose `hasProductionEnv` reads as absent used to
    // resolve to `ready:false` and show "Create your environment" to an org
    // that already HAS a production env.
    fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ hasProductionEnv: false }),
    });
    const { container } = renderOnboarding(<CloudOnboardingNext {...PROPS} />);

    expect(await screen.findByText('Open Production')).toBeTruthy();
    expect(screen.queryByText('Create your environment')).toBeNull();
    expect(container.querySelector('[data-onboarding="unknown"]')).toBeTruthy();
  });

  it('renders a non-CTA skeleton while the signal is still loading', async () => {
    let resolveFetch: (v: any) => void = () => {};
    fetchImpl = () => new Promise((r) => { resolveFetch = r; });
    const { container } = renderOnboarding(<CloudOnboardingNext {...PROPS} />);

    // Before the fetch resolves: no CTA text, just the skeleton placeholder.
    expect(screen.queryByText('Open Production')).toBeNull();
    expect(screen.queryByText('Create your environment')).toBeNull();
    expect(container.querySelector('[data-onboarding="loading"]')).toBeTruthy();

    resolveFetch(summary(true));
    await waitFor(() => expect(screen.getByText('Open Production')).toBeTruthy());
  });
});
