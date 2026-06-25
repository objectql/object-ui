/**
 * provisionEnvironment
 *
 * Eagerly provision a freshly created organization's **production**
 * environment so a self-service "create another workspace" lands the user in a
 * ready console — no onboarding-wizard detour.
 *
 * ObjectStack runs a 1-production-environment-per-organization model: an org's
 * FIRST environment is born as its production env (allowed on every plan,
 * including free). The cloud control plane exposes this as
 * `POST /api/v1/cloud/environments`, which only needs a `displayName`; the org
 * is resolved from `organizationId` (preferred) → the better-auth active org →
 * the actor's first membership.
 *
 * Best-effort by contract: callers swallow failures and fall back to the
 * onboarding gate, which provisions the env lazily on first navigation.
 *
 * @module
 */

import { createAuthenticatedFetch } from '@object-ui/auth';
import { getCloudBase } from '../../runtime-config';

/** The slice of the cloud environments response callers care about. */
export interface ProvisionedEnvironment {
  /** Environment id (control-plane `sys_environment` row). */
  id?: string;
  /** Opaque system hostname, e.g. `os-<shortId>.<rootDomain>` for production. */
  hostname?: string;
}

/**
 * Provision the production environment for a just-created organization.
 *
 * Uses {@link createAuthenticatedFetch} so the request carries the Bearer token
 * and the active-org `X-Tenant-ID` header; `organizationId` is also sent in the
 * body so the target org is unambiguous even before the session active-org
 * switch has propagated.
 *
 * @throws when the control plane responds non-2xx (callers treat this as a
 *   best-effort failure and let the lazy onboarding gate provision instead).
 */
export async function provisionProductionEnvironment(opts: {
  displayName: string;
  organizationId: string;
}): Promise<ProvisionedEnvironment | null> {
  const authFetch = createAuthenticatedFetch();
  const res = await authFetch(`${getCloudBase()}/api/v1/cloud/environments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: opts.displayName,
      organizationId: opts.organizationId,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to provision production environment (status ${res.status})`);
  }
  // The control plane wraps payloads as `{ success, data }`; tolerate both.
  const body = (await res.json().catch(() => ({}))) as
    | { data?: ProvisionedEnvironment }
    | ProvisionedEnvironment;
  if (body && typeof body === 'object' && 'data' in body && body.data) {
    return body.data;
  }
  return (body as ProvisionedEnvironment) ?? null;
}
