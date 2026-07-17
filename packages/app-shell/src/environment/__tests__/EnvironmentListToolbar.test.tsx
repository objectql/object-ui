/**
 * EnvironmentListToolbar renders the right create affordance per org state.
 * SchemaRenderer is stubbed to surface the action label/variant it would render
 * (the real action:bar + runner are covered elsewhere); we assert the decision,
 * not the rendering of the bar.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@object-ui/react', async (importActual) => ({
  ...(await importActual<any>()),
  SchemaRenderer: ({ schema }: any) => (
    <div data-testid="action-bar">
      {(schema.actions || []).map((a: any) => (
        <button key={a.name} data-variant={a.variant} data-autotrigger={a.autoTrigger ? 'true' : undefined}>{a.label}</button>
      ))}
    </div>
  ),
}));

import { EnvironmentListToolbar } from '../EnvironmentListToolbar';
import type { EnvironmentEntitlementsState } from '../entitlements';

const CREATE = {
  name: 'create_environment', label: 'Create Environment',
  type: 'api', variant: 'primary', locations: ['list_toolbar'],
};
const st = (o: Partial<EnvironmentEntitlementsState>): EnvironmentEntitlementsState =>
  ({ ready: true, hasProductionEnv: true, upgradeUrl: '/settings/billing', source: 'summary', ...o });

describe('EnvironmentListToolbar', () => {
  it('no production env → "Set up your production environment" (primary)', () => {
    render(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ hasProductionEnv: false })} onUpgrade={vi.fn()} />);
    const btn = screen.getByText('Set up your production environment');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-variant')).toBe('primary');
    expect(screen.queryByTestId('environment-add-upgrade')).toBeNull();
  });

  it('has prod + dev allowed (paid) → "Add development environment"', () => {
    render(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ canCreateDevelopmentEnv: true })} onUpgrade={vi.fn()} />);
    expect(screen.getByText('Add development environment')).toBeTruthy();
    expect(screen.queryByTestId('environment-add-upgrade')).toBeNull();
  });

  it('has prod + dev locked (free) → upgrade button, NO create POST affordance', () => {
    const onUpgrade = vi.fn();
    render(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ canCreateDevelopmentEnv: false, plan: 'free' })} onUpgrade={onUpgrade} />);
    // The create action is NOT rendered as a bar button (no POST-then-403).
    expect(screen.queryByText('Create Environment')).toBeNull();
    expect(screen.queryByText('Add development environment')).toBeNull();
    fireEvent.click(screen.getByTestId('environment-add-upgrade'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onUpgrade.mock.calls[0][0]).toMatchObject({ code: 'DEV_ENV_PLAN_LOCKED', cta: { url: '/settings/billing' } });
  });

  it('still resolving (null) → neutral default label, no upgrade button', () => {
    render(<EnvironmentListToolbar actions={[CREATE]} entitlements={null} onUpgrade={vi.fn()} />);
    expect(screen.getByText('Create Environment')).toBeTruthy();
    expect(screen.queryByTestId('environment-add-upgrade')).toBeNull();
  });
});

describe('EnvironmentListToolbar — ?runAction=create_environment deep link (#844)', () => {
  const withRunActionParam = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('runAction', 'create_environment');
    window.history.replaceState(null, '', url);
  };

  it('marks the create action autoTrigger once entitlements resolve, then strips the param', async () => {
    withRunActionParam();
    render(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ hasProductionEnv: false })} onUpgrade={vi.fn()} />);
    const btn = screen.getByText('Set up your production environment');
    // The SchemaRenderer stub surfaces autoTrigger as data-autotrigger.
    expect(btn.getAttribute('data-autotrigger')).toBe('true');
    // Param is consumed exactly once — stripped from the URL.
    await vi.waitFor(() => {
      expect(new URL(window.location.href).searchParams.get('runAction')).toBeNull();
    });
  });

  it('upgrade state: deep link opens the upgrade prompt instead of a create POST', async () => {
    withRunActionParam();
    const onUpgrade = vi.fn();
    render(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ canCreateDevelopmentEnv: false, plan: 'free' })} onUpgrade={onUpgrade} />);
    await vi.waitFor(() => expect(onUpgrade).toHaveBeenCalledTimes(1));
    expect(onUpgrade.mock.calls[0][0]).toMatchObject({ code: 'DEV_ENV_PLAN_LOCKED' });
  });
});
