/**
 * useTenancyPosture — the deployment's tenancy posture (framework ADR-0105 D1),
 * read from the public auth config's `features.tenancyPosture`.
 *
 * Under `group` posture the active organization is only the WRITE target —
 * reads span every organization the member belongs to (the server enforces
 * `organization_id IN accessible_org_ids`; the client never filters for
 * security). Components use this hook to key the group-only affordances:
 * write-context labeling on the org switcher, the create-form target-org
 * badge, and org attribution columns in default list views.
 *
 * Returns `undefined` until the config resolves, and stays `undefined` when
 * the server doesn't report a posture (older server) or reports an
 * unrecognized value — so every group affordance fails toward today's
 * rendering. The auth client caches the config fetch behind one promise, so
 * concurrent mounts share a single request.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@object-ui/auth';
import type { TenancyPosture } from '@object-ui/auth';

const POSTURES: readonly TenancyPosture[] = ['single', 'group', 'isolated'];

export function useTenancyPosture(): TenancyPosture | undefined {
  const { getAuthConfig } = useAuth();
  const [posture, setPosture] = useState<TenancyPosture | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getAuthConfig?.()
      .then((cfg) => {
        if (cancelled) return;
        const reported = cfg?.features?.tenancyPosture;
        if (reported && (POSTURES as readonly string[]).includes(reported)) {
          setPosture(reported);
        }
      })
      .catch(() => {
        /* config unavailable — leave undefined, group affordances stay off */
      });
    return () => {
      cancelled = true;
    };
  }, [getAuthConfig]);

  return posture;
}
