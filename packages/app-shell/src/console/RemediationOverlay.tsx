/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState } from 'react';
import { useAuth } from '@object-ui/auth';
import { Button, Input, Label } from '@object-ui/components';
import { toCanvas } from 'qrcode';

/**
 * ADR-0069 — full-screen remediation overlay.
 *
 * When the backend blocks a logged-in user with `403 PASSWORD_EXPIRED` /
 * `MFA_REQUIRED`, the API fetch interceptor raises `remediationRequired` on the
 * auth context. This overlay guides the user through the fix (change the
 * expired password, or enrol an authenticator) instead of leaving them staring
 * at failing requests. On success it reloads so the app re-fetches cleanly.
 */
export function RemediationOverlay() {
  const { remediationRequired } = useAuth();
  if (!remediationRequired) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
        {remediationRequired.code === 'PASSWORD_EXPIRED' ? (
          <ExpiredPasswordForm message={remediationRequired.message} />
        ) : (
          <MfaEnrollForm message={remediationRequired.message} />
        )}
      </div>
    </div>
  );
}

function SignOutLink() {
  const { signOut } = useAuth();
  return (
    <button
      type="button"
      onClick={() => { void signOut(); }}
      className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      Sign out instead
    </button>
  );
}

function ExpiredPasswordForm({ message }: { message: string }) {
  const { changePassword, setRemediationRequired } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next !== confirm) { setError('New passwords do not match.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      setRemediationRequired(null);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Your password has expired</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {message || 'Please set a new password to continue.'}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="rem-cur">Current password</Label>
        <Input id="rem-cur" type="password" autoComplete="current-password" value={current}
          onChange={(e) => setCurrent(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rem-new">New password</Label>
        <Input id="rem-new" type="password" autoComplete="new-password" value={next}
          onChange={(e) => setNext(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="rem-conf">Confirm new password</Label>
        <Input id="rem-conf" type="password" autoComplete="new-password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Updating…' : 'Change password & continue'}
      </Button>
      <SignOutLink />
    </form>
  );
}

function TotpQr({ uri }: { uri: string }) {
  const [error, setError] = useState<string | null>(null);
  const ref = (node: HTMLCanvasElement | null) => {
    if (!node || !uri) return;
    toCanvas(node, uri, { width: 184, margin: 1 }, (err) => { if (err) setError(err.message); });
  };
  return (
    <div className="flex justify-center rounded-md border bg-white p-3">
      {error ? <span className="text-sm text-destructive">{error}</span> : <canvas ref={ref} />}
    </div>
  );
}

function MfaEnrollForm({ message }: { message: string }) {
  const { enrollTotp, verifyTotp, setRemediationRequired } = useAuth();
  const [step, setStep] = useState<'password' | 'verify'>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const { totpURI, backupCodes: codes } = await enrollTotp(password);
      setTotpUri(totpURI);
      setBackupCodes(codes ?? []);
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start enrollment.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await verifyTotp(code.trim());
      setRemediationRequired(null);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Try again.');
      setBusy(false);
    }
  };

  if (step === 'password') {
    return (
      <form onSubmit={start} className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Set up two-factor authentication</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {message || 'Your organization requires an authenticator app to continue.'}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rem-pw">Confirm your password</Label>
          <Input id="rem-pw" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Preparing…' : 'Continue'}
        </Button>
        <SignOutLink />
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Scan with your authenticator</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Scan this QR code with Google Authenticator, 1Password, Authy, etc., then enter the 6-digit code.
        </p>
      </div>
      {totpUri ? <TotpQr uri={totpUri} /> : null}
      {backupCodes.length > 0 ? (
        <details className="rounded-md border bg-muted/40 p-3 text-xs">
          <summary className="cursor-pointer font-medium">Save your backup codes</summary>
          <p className="mt-1 text-muted-foreground">Store these somewhere safe — each can be used once if you lose your device.</p>
          <div className="mt-2 grid grid-cols-2 gap-1 font-mono">
            {backupCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
        </details>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="rem-code">6-digit code</Label>
        <Input id="rem-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
          placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Verifying…' : 'Verify & continue'}
      </Button>
      <SignOutLink />
    </form>
  );
}
