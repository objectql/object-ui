// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * CloudConnectionPanel — the RFC 8628 device-code binding state machine,
 * registered as the SDUI widget `cloud-connection:panel`.
 *
 * This is deliberately the ONLY React in the Cloud Connection surface:
 * the page shell, nav placement and labels ship as metadata WITH the
 * `@objectstack/cloud-connection` plugin (cloud ADR-0008 / console
 * SDUI-first direction). The widget talks to the runtime's same-origin
 * `/api/v1/cloud-connection/*` routes:
 *
 *   status → [Connect] → bind/start → user-code display → bind/poll …
 *          → bound (org / account / since) → [Disconnect] → unbind
 *
 * The runtime credential never reaches the browser — bind/poll persists
 * it server-side and strips it from the response.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Unplug,
} from 'lucide-react';
import { ComponentRegistry } from '@object-ui/core';

const BASE = '/api/v1/cloud-connection';

interface ConnectionView {
  organization_id?: string | null;
  account_email?: string | null;
  bound_at?: string | null;
}
interface StatusData {
  environmentId: string | null;
  bound: boolean;
  connection: ConnectionView | null;
}
interface DeviceCode {
  device_code: string;
  user_code: string;
  verification_uri?: string;
  verification_uri_complete?: string;
  interval: number;
  expires_in: number;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'unbound'; environmentId: string | null }
  | { kind: 'waiting'; code: DeviceCode; environmentId: string }
  | { kind: 'bound'; status: StatusData }
  | { kind: 'error'; message: string };

async function getJson(url: string, init?: RequestInit): Promise<any> {
  const resp = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok && body?.success !== true) {
    const msg = body?.error?.message ?? body?.error?.code ?? body?.error ?? `HTTP ${resp.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body;
}

export function CloudConnectionPanel() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [envIdInput, setEnvIdInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const body = await getJson(`${BASE}/status`);
      const data: StatusData = body?.data ?? { environmentId: null, bound: false, connection: null };
      setPhase(data.bound ? { kind: 'bound', status: data } : { kind: 'unbound', environmentId: data.environmentId });
      if (data.environmentId) setEnvIdInput(data.environmentId);
    } catch (err: any) {
      setPhase({ kind: 'error', message: err?.message ?? String(err) });
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    return stopPolling;
  }, [refreshStatus, stopPolling]);

  const poll = useCallback((code: DeviceCode, environmentId: string, startedAt: number) => {
    const intervalMs = Math.max(code.interval, 2) * 1000;
    const tick = async () => {
      if (Date.now() - startedAt > code.expires_in * 1000) {
        setPhase({ kind: 'error', message: 'The code expired before it was approved. Start again.' });
        return;
      }
      try {
        const body = await getJson(`${BASE}/bind/poll`, {
          method: 'POST',
          body: JSON.stringify({ device_code: code.device_code, environment_id: environmentId }),
        });
        if (body?.data?.pending) {
          pollTimer.current = setTimeout(tick, intervalMs);
          return;
        }
        if (body?.data?.bound || body?.success) {
          await refreshStatus();
          return;
        }
        setPhase({ kind: 'error', message: body?.error?.code ?? 'Binding failed.' });
      } catch (err: any) {
        setPhase({ kind: 'error', message: err?.message ?? String(err) });
      }
    };
    pollTimer.current = setTimeout(tick, intervalMs);
  }, [refreshStatus]);

  const connect = useCallback(async (environmentId: string) => {
    setBusy(true);
    try {
      const body = await getJson(`${BASE}/bind/start`, {
        method: 'POST',
        body: JSON.stringify(environmentId ? { environment_id: environmentId } : {}),
      });
      const code: DeviceCode = body?.data;
      if (!code?.device_code || !code?.user_code) throw new Error('Device code request failed.');
      setPhase({ kind: 'waiting', code, environmentId });
      poll(code, environmentId, Date.now());
    } catch (err: any) {
      setPhase({ kind: 'error', message: err?.message ?? String(err) });
    } finally {
      setBusy(false);
    }
  }, [poll]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await getJson(`${BASE}/unbind`, { method: 'POST', body: '{}' });
      await refreshStatus();
    } catch (err: any) {
      setPhase({ kind: 'error', message: err?.message ?? String(err) });
    } finally {
      setBusy(false);
    }
  }, [refreshStatus]);

  const copyCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — user can select the text */ }
  }, []);

  if (phase.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking connection…
      </div>
    );
  }

  if (phase.kind === 'error') {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" /> {phase.message}
        </div>
        <button
          type="button"
          className="self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          onClick={() => { stopPolling(); void refreshStatus(); }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase.kind === 'waiting') {
    const link = phase.code.verification_uri_complete ?? phase.code.verification_uri;
    return (
      <div className="flex flex-col gap-4 rounded-lg border p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Waiting for approval in the cloud console…
        </div>
        <div className="flex items-center gap-3">
          <code className="rounded-md bg-muted px-4 py-2 text-2xl font-semibold tracking-[0.25em]">
            {phase.code.user_code}
          </code>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => void copyCode(phase.code.user_code)}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" /> {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter this code in the cloud console to approve the connection
          {link ? (
            <>
              {' '}— or{' '}
              <a className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline" href={link} target="_blank" rel="noreferrer">
                open the approval page <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              .
            </>
          ) : '.'}
        </p>
        <button
          type="button"
          className="self-start rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          onClick={() => { stopPolling(); void refreshStatus(); }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (phase.kind === 'bound') {
    const conn = phase.status.connection ?? {};
    return (
      <div className="flex flex-col gap-4 rounded-lg border p-6">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <span className="font-medium">Connected to ObjectStack Cloud</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          {conn.organization_id ? (<><dt className="text-muted-foreground">Organization</dt><dd className="font-mono">{conn.organization_id}</dd></>) : null}
          {conn.account_email ? (<><dt className="text-muted-foreground">Approved by</dt><dd>{conn.account_email}</dd></>) : null}
          {phase.status.environmentId ? (<><dt className="text-muted-foreground">Environment</dt><dd className="font-mono">{phase.status.environmentId}</dd></>) : null}
          {conn.bound_at ? (<><dt className="text-muted-foreground">Since</dt><dd>{new Date(conn.bound_at).toLocaleString()}</dd></>) : null}
        </dl>
        <p className="text-sm text-muted-foreground">
          Your organization's private packages now appear in the Marketplace under “Your organization”.
        </p>
        <button
          type="button"
          disabled={busy}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50"
          onClick={() => void disconnect()}
        >
          <Unplug className="h-3.5 w-3.5" aria-hidden="true" /> Disconnect
        </button>
      </div>
    );
  }

  // unbound
  const needsEnvId = !phase.environmentId;
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        <CloudOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">Not connected</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Connect this runtime to an ObjectStack control plane to browse your
        organization's private packages and install them here. Approval
        happens in the cloud console — no credentials are typed into this page.
      </p>
      {needsEnvId ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-muted-foreground">
            Environment ID (create an environment in the cloud console and paste its id)
          </span>
          <input
            className="w-full max-w-md rounded-md border bg-background px-3 py-2 font-mono text-sm"
            placeholder="e.g. 1764f947-6d1a-4b3e-82e4-9ca733f50a56"
            value={envIdInput}
            onChange={(e) => setEnvIdInput(e.target.value)}
          />
        </label>
      ) : null}
      <button
        type="button"
        disabled={busy || (needsEnvId && !envIdInput.trim())}
        className="inline-flex items-center gap-1.5 self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        onClick={() => void connect((phase.environmentId ?? envIdInput).trim())}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Cloud className="h-4 w-4" aria-hidden="true" />}
        Connect
      </button>
    </div>
  );
}

// SDUI registration: page metadata (shipped by @objectstack/cloud-connection)
// references this widget by type. The renderer passes the component node as
// `schema`; the panel needs no properties today.
ComponentRegistry.register('cloud-connection:panel', () => <CloudConnectionPanel />, {
  namespace: 'app-shell',
  label: 'Cloud Connection Panel',
  category: 'plugin',
  inputs: [],
});
