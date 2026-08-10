/**
 * EnvironmentListToolbar renders the right create affordance per org state.
 * SchemaRenderer is stubbed to surface the action label/variant it would render
 * (the real action:bar + runner are covered elsewhere); we assert the decision,
 * not the rendering of the bar.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

const CREATE_LOADING = 'environment-create-cta-loading';

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

import { I18nProvider } from '@object-ui/i18n';
import { EnvironmentListToolbar } from '../EnvironmentListToolbar';
import type { EnvironmentEntitlementsState } from '../entitlements';

/**
 * The state-aware CTA labels resolve from the locale packs (objectui#2871),
 * so these renders need a real i18n context — asserting the English strings
 * without one would only be asserting the raw key. Pinned to `en` and
 * `detectBrowserLanguage: false` so the expectations stay deterministic.
 */
const renderToolbar = (ui: React.ReactElement) =>
  render(
    <I18nProvider config={{ defaultLanguage: 'en', detectBrowserLanguage: false }}>
      {ui}
    </I18nProvider>,
  );

const CREATE = {
  name: 'create_environment', label: 'Create Environment',
  type: 'api', variant: 'primary', locations: ['list_toolbar'],
};
const st = (o: Partial<EnvironmentEntitlementsState>): EnvironmentEntitlementsState =>
  ({ ready: true, hasProductionEnv: true, upgradeUrl: '/settings/billing', source: 'summary', ...o });

/**
 * The settled-but-no-signal state: the entitlements endpoint was unusable AND
 * the row derivation threw, so `useEnvironmentEntitlements` reports a resolved
 * object that carries nothing. Distinct from `null` (still in flight).
 */
const UNRESOLVED: EnvironmentEntitlementsState = {
  ready: false, hasProductionEnv: false, upgradeUrl: '/settings/billing', source: 'unknown',
};

describe('EnvironmentListToolbar', () => {
  it('no production env → "Set up your production environment" (primary)', () => {
    renderToolbar(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ hasProductionEnv: false })} onUpgrade={vi.fn()} />);
    const btn = screen.getByText('Set up your production environment');
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('data-variant')).toBe('primary');
    expect(screen.queryByTestId('environment-add-upgrade')).toBeNull();
  });

  it('has prod + dev allowed (paid) → "Add development environment"', () => {
    renderToolbar(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ canCreateDevelopmentEnv: true })} onUpgrade={vi.fn()} />);
    expect(screen.getByText('Add development environment')).toBeTruthy();
    expect(screen.queryByTestId('environment-add-upgrade')).toBeNull();
  });

  it('has prod + dev locked (free) → upgrade button, NO create POST affordance', () => {
    const onUpgrade = vi.fn();
    renderToolbar(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ canCreateDevelopmentEnv: false, plan: 'free' })} onUpgrade={onUpgrade} />);
    // The create action is NOT rendered as a bar button (no POST-then-403).
    expect(screen.queryByText('Create Environment')).toBeNull();
    expect(screen.queryByText('Add development environment')).toBeNull();
    fireEvent.click(screen.getByTestId('environment-add-upgrade'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
    expect(onUpgrade.mock.calls[0][0]).toMatchObject({ code: 'DEV_ENV_PLAN_LOCKED', cta: { url: '/settings/billing' } });
  });
});

/**
 * cloud#1049 ruling A (objectui#3482): while entitlements are in flight the
 * create button must render NO text — the metadata label used to show and then
 * get overwritten by the state-aware one, which the user saw as the button
 * changing its wording mid-load.
 */
describe('EnvironmentListToolbar — loading state (objectui#3482)', () => {
  it('still resolving (null) → skeleton, no label of any kind, no upgrade button', () => {
    renderToolbar(<EnvironmentListToolbar actions={[CREATE]} entitlements={null} onUpgrade={vi.fn()} />);
    expect(screen.getByTestId(CREATE_LOADING)).toBeTruthy();
    // The metadata label is the one that used to flash here.
    expect(screen.queryByText('Create Environment')).toBeNull();
    // …and no state-aware label is guessed at either — the bar isn't rendered.
    expect(screen.queryByTestId('action-bar')).toBeNull();
    expect(screen.queryByTestId('environment-add-upgrade')).toBeNull();
  });

  it('non-create toolbar actions still render while resolving (they never re-label)', () => {
    const REFRESH = { name: 'refresh_all', label: 'Refresh', type: 'api', locations: ['list_toolbar'] };
    renderToolbar(
      <EnvironmentListToolbar actions={[CREATE, REFRESH]} entitlements={null} onUpgrade={vi.fn()} />,
    );
    expect(screen.getByText('Refresh')).toBeTruthy();
    expect(screen.getByTestId(CREATE_LOADING)).toBeTruthy();
    expect(screen.queryByText('Create Environment')).toBeNull();
  });

  it('no create action in the toolbar → nothing can jump, so no skeleton', () => {
    const REFRESH = { name: 'refresh_all', label: 'Refresh', type: 'api', locations: ['list_toolbar'] };
    renderToolbar(<EnvironmentListToolbar actions={[REFRESH]} entitlements={null} onUpgrade={vi.fn()} />);
    expect(screen.getByText('Refresh')).toBeTruthy();
    expect(screen.queryByTestId(CREATE_LOADING)).toBeNull();
  });

  it('settled with NO usable signal (ready:false) → metadata label, skeleton gone', () => {
    // The skeleton must never be terminal: when both entitlement signals fail
    // the user still needs a working create button, and the producer's neutral
    // wording is the only honest text for an unknown state.
    renderToolbar(<EnvironmentListToolbar actions={[CREATE]} entitlements={UNRESOLVED} onUpgrade={vi.fn()} />);
    expect(screen.getByText('Create Environment')).toBeTruthy();
    expect(screen.queryByTestId(CREATE_LOADING)).toBeNull();
    expect(screen.queryByTestId('environment-add-upgrade')).toBeNull();
  });

  it('resolving → resolved: the metadata label never appears in any render output', () => {
    // The reported flash, as a transition on one mounted tree. Asserted in `en`
    // because the mechanism is locale-independent (metadata label overwritten by
    // `environment.setUpProduction`); it was reported against the zh console,
    // whose key is covered by the all-locales key-parity test.
    const tree = (entitlements: EnvironmentEntitlementsState | null) => (
      <I18nProvider config={{ defaultLanguage: 'en', detectBrowserLanguage: false }}>
        <EnvironmentListToolbar actions={[CREATE]} entitlements={entitlements} onUpgrade={vi.fn()} />
      </I18nProvider>
    );

    const { rerender, container } = render(tree(null));
    // Intermediate render output carries no button text at all.
    expect(container.textContent).toBe('');
    expect(screen.getByTestId(CREATE_LOADING)).toBeTruthy();

    rerender(tree(st({ hasProductionEnv: false })));
    expect(screen.getByText('Set up your production environment')).toBeTruthy();
    expect(screen.queryByTestId(CREATE_LOADING)).toBeNull();
    // The metadata label never appeared — not before, not after.
    expect(container.textContent).not.toContain(CREATE.label);
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
    renderToolbar(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ hasProductionEnv: false })} onUpgrade={vi.fn()} />);
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
    renderToolbar(<EnvironmentListToolbar actions={[CREATE]} entitlements={st({ canCreateDevelopmentEnv: false, plan: 'free' })} onUpgrade={onUpgrade} />);
    await vi.waitFor(() => expect(onUpgrade).toHaveBeenCalledTimes(1));
    expect(onUpgrade.mock.calls[0][0]).toMatchObject({ code: 'DEV_ENV_PLAN_LOCKED' });
  });
});
