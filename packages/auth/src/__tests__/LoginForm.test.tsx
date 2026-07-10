/**
 * Tests for LoginForm — specifically the server-gated "Sign in with SSO"
 * button. The button must only render when the server's `/auth/config`
 * reports `features.sso`, mirroring how social providers are gated. Otherwise
 * a self-hosted / local deployment (where `@better-auth/sso` isn't wired)
 * shows a button whose `/sign-in/sso` route 404s, surfacing the misleading
 * "No SSO provider is configured for this email domain." only at click time.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { LoginForm } from '../LoginForm';
import type { AuthClient, AuthPublicConfig } from '../types';

const SSO_BUTTON = { name: 'Sign in with SSO' } as const;

function createMockClient(
  config: AuthPublicConfig,
  overrides: Partial<AuthClient> = {},
): AuthClient {
  return {
    signIn: vi.fn().mockResolvedValue({
      user: { id: '1', name: 'Test User', email: 'test@test.com' },
      session: { token: 'tok123' },
    }),
    signUp: vi.fn().mockResolvedValue({ user: { id: '2' }, session: null, requiresVerification: false }),
    signOut: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn().mockResolvedValue(null),
    forgotPassword: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    updateUser: vi.fn().mockResolvedValue({ id: '1', name: 'Updated', email: 'test@test.com' }),
    getConfig: vi.fn().mockResolvedValue(config),
    ...overrides,
  } as unknown as AuthClient;
}

function renderLogin(client: AuthClient) {
  return render(
    <AuthProvider authUrl="/api/auth" client={client}>
      <LoginForm />
    </AuthProvider>,
  );
}

describe('LoginForm — server-gated SSO button', () => {
  it('hides the SSO button when the server does not report features.sso', async () => {
    renderLogin(createMockClient({ features: { sso: false } }));

    // Email/password form is always present…
    await screen.findByLabelText('Email');
    // …but the SSO button must not render.
    expect(screen.queryByRole('button', SSO_BUTTON)).toBeNull();
  });

  it('hides the SSO button when features is absent entirely (older server)', async () => {
    renderLogin(createMockClient({}));

    await screen.findByLabelText('Email');
    expect(screen.queryByRole('button', SSO_BUTTON)).toBeNull();
  });

  it('shows the SSO button only when the server reports features.sso = true', async () => {
    renderLogin(createMockClient({ features: { sso: true } }));

    await waitFor(() => {
      expect(screen.getByRole('button', SSO_BUTTON)).toBeTruthy();
    });
  });

  it('keeps the button hidden when the config fetch fails (SSO is an enhancement)', async () => {
    renderLogin(
      createMockClient({}, { getConfig: vi.fn().mockRejectedValue(new Error('boom')) }),
    );

    await screen.findByLabelText('Email');
    expect(screen.queryByRole('button', SSO_BUTTON)).toBeNull();
  });
});

describe('LoginForm — SSO-only (enforced) mode', () => {
  const BREAK_GLASS = { name: 'Use a password instead' } as const;

  it('hides the password form + sign-up and shows a break-glass link when features.ssoEnforced', async () => {
    renderLogin(createMockClient({ features: { sso: true, ssoEnforced: true } }));

    // The break-glass link appears (federated buttons are the path)…
    await screen.findByRole('button', BREAK_GLASS);
    // …the local password form is hidden…
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByLabelText('Password')).toBeNull();
    // …and the sign-up link is hidden (no self-registration under enforced).
    expect(screen.queryByText('Sign up')).toBeNull();
  });

  it('treats emailPassword.enabled === false as enforced (belt-and-suspenders)', async () => {
    renderLogin(createMockClient({ emailPassword: { enabled: false } }));

    await screen.findByRole('button', BREAK_GLASS);
    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('reveals the password form when the break-glass link is clicked', async () => {
    renderLogin(createMockClient({ features: { ssoEnforced: true } }));

    fireEvent.click(await screen.findByRole('button', BREAK_GLASS));

    // Password form now visible, plus a way back to SSO-only.
    await screen.findByLabelText('Email');
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to single sign-on' })).toBeTruthy();
  });

  it('shows the password form normally when not enforced', async () => {
    renderLogin(createMockClient({ features: { ssoEnforced: false } }));

    await screen.findByLabelText('Email');
    expect(screen.queryByRole('button', BREAK_GLASS)).toBeNull();
  });
});

// framework#2780 — the phone-OTP sign-in mode is gated by
// `features.phoneNumberOtp` (phoneNumber plugin + deliverable SMS service),
// exactly like the SSO button: never render an entry point whose
// verification code can never arrive.
describe('LoginForm — server-gated phone-OTP sign-in', () => {
  const OTP_LINK = { name: 'Sign in with verification code' } as const;

  it('hides the phone-OTP link when the server does not report features.phoneNumberOtp', async () => {
    renderLogin(createMockClient({ features: { phoneNumber: true, phoneNumberOtp: false } }));
    await screen.findByLabelText('Email');
    expect(screen.queryByRole('button', OTP_LINK)).toBeNull();
  });

  it('shows the phone-OTP link when the server reports features.phoneNumberOtp = true', async () => {
    renderLogin(createMockClient({ features: { phoneNumber: true, phoneNumberOtp: true } }));
    await waitFor(() => {
      expect(screen.getByRole('button', OTP_LINK)).toBeTruthy();
    });
  });

  it('switches to the phone form, sends the OTP, verifies, and calls back', async () => {
    const sendPhoneOtp = vi.fn().mockResolvedValue(undefined);
    const signInWithPhoneOtp = vi.fn().mockResolvedValue({
      user: { id: 'u1', name: '13800000000', email: 'u-x@placeholder.invalid' },
      session: { token: 'tok-otp' },
    });
    const client = createMockClient(
      { features: { phoneNumber: true, phoneNumberOtp: true } },
      { sendPhoneOtp, signInWithPhoneOtp },
    );
    renderLogin(client);

    fireEvent.click(await screen.findByRole('button', OTP_LINK));

    const phoneInput = await screen.findByLabelText('Phone number');
    fireEvent.change(phoneInput, { target: { value: '+8613800000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get code' }));
    await waitFor(() => expect(sendPhoneOtp).toHaveBeenCalledWith('+8613800000000'));

    // The resend button now counts down (mirrors the server-side cooldown).
    await screen.findByRole('button', { name: /Resend in \d+s/ });

    fireEvent.change(screen.getByLabelText('Verification code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() =>
      expect(signInWithPhoneOtp).toHaveBeenCalledWith('+8613800000000', '123456'),
    );
  });

  it('surfaces the cooldown 429 message from send-otp instead of crashing', async () => {
    const err = Object.assign(
      new Error('Too many verification codes requested for this phone number. Retry in 60s.'),
      { status: 429, code: 'TOO_MANY_REQUESTS' },
    );
    const client = createMockClient(
      { features: { phoneNumberOtp: true } },
      { sendPhoneOtp: vi.fn().mockRejectedValue(err) },
    );
    renderLogin(client);

    fireEvent.click(await screen.findByRole('button', OTP_LINK));
    fireEvent.change(await screen.findByLabelText('Phone number'), { target: { value: '+8613800000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Get code' }));

    await screen.findByText(/Retry in 60s/);
  });

  it('switches back to the password form', async () => {
    renderLogin(createMockClient({ features: { phoneNumberOtp: true } }));
    fireEvent.click(await screen.findByRole('button', OTP_LINK));
    await screen.findByLabelText('Phone number');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with password instead' }));
    await screen.findByLabelText('Email');
  });
});
