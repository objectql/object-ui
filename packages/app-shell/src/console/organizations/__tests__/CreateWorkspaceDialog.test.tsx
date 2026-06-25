// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * CreateWorkspaceDialog — enable gate + born-with-env provision flow.
 *
 * Covers the three behaviours the multi-org self-service create flow relies on:
 *   1. enable gate     — when `multiOrgEnabled === false`, submit is blocked
 *                        client-side and never hits the org/env APIs.
 *   2. provision flow  — on success the dialog creates the org, eagerly
 *                        provisions its production environment, THEN signals
 *                        `onCreated` (the caller switches + navigates home).
 *   3. best-effort     — when eager provisioning throws, the user is still
 *                        landed (`onCreated`) so the lazy onboarding gate can
 *                        provision the env on first navigation.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CreateWorkspaceDialog } from '../CreateWorkspaceDialog';
import { provisionProductionEnvironment } from '../provisionEnvironment';

vi.mock('@object-ui/i18n', () => ({
  useObjectTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
  }),
}));

vi.mock('../provisionEnvironment', () => ({
  provisionProductionEnvironment: vi.fn(),
}));

const createOrganization = vi.fn();
const getAuthConfig = vi.fn();
vi.mock('@object-ui/auth', () => ({
  useAuth: () => ({ createOrganization, getAuthConfig }),
}));

const provisionMock = vi.mocked(provisionProductionEnvironment);

const NEW_ORG = { id: 'org-123', name: 'Acme Inc', slug: 'acme-inc' };

beforeEach(() => {
  vi.clearAllMocks();
  getAuthConfig.mockResolvedValue({ features: { multiOrgEnabled: true } });
  createOrganization.mockResolvedValue(NEW_ORG);
  provisionMock.mockResolvedValue({ id: 'env-1', hostname: 'os-abc123.objectstack.app' });
});

/** Let the `getAuthConfig().then(...)` effect settle (sets `multiOrgDisabled`). */
async function settleAuthConfig() {
  await waitFor(() => expect(getAuthConfig).toHaveBeenCalled());
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function fillAndSubmit(name = NEW_ORG.name, slug = NEW_ORG.slug) {
  fireEvent.change(screen.getByTestId('workspace-name-input'), { target: { value: name } });
  fireEvent.change(screen.getByTestId('workspace-slug-input'), { target: { value: slug } });
  const form = screen.getByTestId('create-workspace-dialog').querySelector('form');
  fireEvent.submit(form as HTMLFormElement);
}

describe('CreateWorkspaceDialog', () => {
  it('creates the org, eagerly provisions its production env, then signals onCreated', async () => {
    const onCreated = vi.fn();
    render(<CreateWorkspaceDialog open onOpenChange={() => {}} onCreated={onCreated} />);
    await settleAuthConfig();

    fillAndSubmit();

    await waitFor(() =>
      expect(createOrganization).toHaveBeenCalledWith({ name: 'Acme Inc', slug: 'acme-inc' }),
    );
    await waitFor(() =>
      expect(provisionMock).toHaveBeenCalledWith({ organizationId: 'org-123' }),
    );
    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'org-123' })),
    );

    // The env must be provisioned BEFORE we hand off to the caller's navigation.
    expect(provisionMock.mock.invocationCallOrder[0]).toBeLessThan(
      onCreated.mock.invocationCallOrder[0],
    );
  });

  it('blocks creation when multi-org is disabled, without calling the org/env APIs', async () => {
    getAuthConfig.mockResolvedValue({ features: { multiOrgEnabled: false } });
    render(<CreateWorkspaceDialog open onOpenChange={() => {}} />);
    await settleAuthConfig();

    fillAndSubmit();

    expect(await screen.findByTestId('workspace-create-error')).toBeInTheDocument();
    expect(createOrganization).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('still lands the user (onCreated) when eager provisioning fails — lazy-gate fallback', async () => {
    provisionMock.mockRejectedValue(new Error('cloud unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onCreated = vi.fn();
    render(<CreateWorkspaceDialog open onOpenChange={() => {}} onCreated={onCreated} />);
    await settleAuthConfig();

    fillAndSubmit();

    await waitFor(() =>
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'org-123' })),
    );
    expect(provisionMock).toHaveBeenCalledTimes(1);
    // Provision failure is swallowed — no user-facing error, the lazy gate covers it.
    expect(screen.queryByTestId('workspace-create-error')).toBeNull();
    warn.mockRestore();
  });
});
