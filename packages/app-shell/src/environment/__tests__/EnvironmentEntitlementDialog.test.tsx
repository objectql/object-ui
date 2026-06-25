/**
 * EnvironmentEntitlementDialog renders the friendly upgrade/limit dialog and a
 * CTA that lands on the (control-plane-resolved) upgrade URL.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EnvironmentEntitlementDialog, resolveCtaHref } from '../EnvironmentEntitlementDialog';

describe('resolveCtaHref', () => {
  it('passes absolute urls through (new tab); mailto is not a new tab', () => {
    expect(resolveCtaHref('https://x.com/p', '')).toEqual({ href: 'https://x.com/p', external: true });
    expect(resolveCtaHref('mailto:a@b.com', 'https://api')).toEqual({ href: 'mailto:a@b.com', external: false });
  });
  it('prefixes a relative url with the api base (dev split origin → new tab)', () => {
    expect(resolveCtaHref('/settings/billing', 'https://cp.example.com'))
      .toEqual({ href: 'https://cp.example.com/settings/billing', external: true });
  });
  it('keeps a relative url same-origin when no api base (prod)', () => {
    expect(resolveCtaHref('/settings/billing', '')).toEqual({ href: '/settings/billing', external: false });
  });
});

describe('EnvironmentEntitlementDialog', () => {
  it('renders the spec + a CTA anchor to the resolved url and closes on click', async () => {
    const onOpenChange = vi.fn();
    render(
      <EnvironmentEntitlementDialog
        apiBase=""
        onOpenChange={onOpenChange}
        state={{
          open: true,
          spec: {
            code: 'DEV_ENV_PLAN_LOCKED',
            title: 'Development environments are a paid feature',
            message: 'Upgrade to add them.',
            cta: { label: 'Upgrade plan', url: '/settings/billing' },
          },
        }}
      />,
    );
    expect(await screen.findByText('Development environments are a paid feature')).toBeTruthy();
    const cta = screen.getByTestId('entitlement-cta-primary');
    expect(cta.getAttribute('href')).toBe('/settings/billing');
    fireEvent.click(cta);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders nothing when closed', () => {
    render(<EnvironmentEntitlementDialog apiBase="" onOpenChange={vi.fn()} state={{ open: false }} />);
    expect(screen.queryByText('Development environments are a paid feature')).toBeNull();
  });
});
