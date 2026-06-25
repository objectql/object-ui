/**
 * provisionEnvironment
 *
 * Eagerly ensure a freshly created organization has its **production**
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
 * Idempotent + best-effort by contract:
 *   - Some control planes auto-provision the production env on org create (the
 *     `auto-default-environment` plugin). This call then races that plugin and
 *     the loser gets a 403 `PRODUCTION_ENV_LIMIT` / 409 — which is SUCCESS for
 *     us (the org is already born-with-env), not a failure.
 *   - On a genuine failure (5xx / network) the caller swallows the error and
 *     the onboarding gate provisions the env lazily on first navigation.
 *
 * @module
 */

import { createAuthenticatedFetch } from '@object-ui/auth';
import { getCloudBase } from '../../runtime-config';

/** Result of ensuring the org's production environment exists. */
export interface ProvisionedEnvironment {
  /** Environment id (control-plane `sys_environment` row), when this call minted it. */
  id?: string;
  /** Opaque system hostname, e.g. `os-<shortId>.<rootDomain>` for production. */
  hostname?: string;
  /**
   * True when the org already had its production env (the control plane
   * provisioned it on create). The born-with-env contract is still satisfied.
   */
  alreadyProvisioned?: boolean;
}

/**
 * Ensure the production environment exists for a just-created organization.
 *
 * Uses {@link createAuthenticatedFetch} so the request carries the Bearer token
 * and the active-org `X-Tenant-ID` header; `organizationId` is also sent in the
 * body so the target org is unambiguous even before the session active-org
 * switch has propagated. The env is named `Production` to match the
 * born-with-env convention used by the signup org.
 *
 * @throws on a genuine control-plane failure (5xx / network). A 403/409
 *   "already has its production env" is NOT an error — it resolves to
 *   `{ alreadyProvisioned: true }`.
 */
export async function provisionProductionEnvironment(opts: {
  organizationId: string;
  displayName?: string;
}): Promise<ProvisionedEnvironment> {
  const authFetch = createAuthenticatedFetch();
  const res = await authFetch(`${getCloudBase()}/api/v1/cloud/environments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: opts.displayName ?? 'Production',
      organizationId: opts.organizationId,
    }),
  });
  if (!res.ok) {
    // 403 PRODUCTION_ENV_LIMIT / 409 ⇒ the org already owns its (one) production
    // env — born-with-env is satisfied, so this is success, not a failure.
    if (res.status === 403 || res.status === 409) {
      return { alreadyProvisioned: true };
    }
    throw new Error(`Failed to provision production environment (status ${res.status})`);
  }
  // The control plane wraps payloads as `{ success, data }`; tolerate both.
  const body = (await res.json().catch(() => ({}))) as
    | { data?: ProvisionedEnvironment }
    | ProvisionedEnvironment;
  if (body && typeof body === 'object' && 'data' in body && body.data) {
    return body.data;
  }
  return (body as ProvisionedEnvironment) ?? {};
}
