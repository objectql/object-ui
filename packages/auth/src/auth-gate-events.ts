/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0069 — client side of the authentication-policy session gate.
 *
 * The ObjectStack backend returns `403 { error: { code: 'MFA_REQUIRED' |
 * 'PASSWORD_EXPIRED', message } }` from protected endpoints when a logged-in
 * user must remediate. The authenticated fetch wrapper detects this on EVERY
 * API response and emits it here; `AuthProvider` subscribes and raises a
 * full-screen remediation overlay. Decoupling via a tiny module-level emitter
 * keeps the plain fetch wrapper free of React.
 */

/** A triggered auth-policy gate the user must clear before continuing. */
export interface AuthGateInfo {
  /** Stable machine code, e.g. `MFA_REQUIRED` / `PASSWORD_EXPIRED`. */
  code: 'MFA_REQUIRED' | 'PASSWORD_EXPIRED' | string;
  /** Human-facing message from the server (may be empty). */
  message: string;
}

type Listener = (gate: AuthGateInfo) => void;
const listeners = new Set<Listener>();

export const authGateEvents = {
  /** Broadcast a gate to all subscribers (the active AuthProvider). */
  emit(gate: AuthGateInfo): void {
    for (const l of Array.from(listeners)) {
      try { l(gate); } catch { /* a listener throwing must not break others */ }
    }
  },
  /** Subscribe; returns an unsubscribe fn. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/**
 * Returns the gate when `status`/`body` is a recognised auth-policy block,
 * else null. Tolerant of non-gate 403s (permission denials etc.).
 */
export function detectAuthGate(status: number, body: unknown): AuthGateInfo | null {
  if (status !== 403 || !body || typeof body !== 'object') return null;
  const err = (body as Record<string, unknown>).error;
  if (!err || typeof err !== 'object') return null;
  const code = (err as Record<string, unknown>).code;
  if (code === 'MFA_REQUIRED' || code === 'PASSWORD_EXPIRED') {
    const message = (err as Record<string, unknown>).message;
    return { code, message: typeof message === 'string' ? message : '' };
  }
  return null;
}
