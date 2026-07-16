/**
 * useRecordApprovals
 *
 * Resolves the approval state for a single record so the detail-view header
 * can surface a status badge and — when the current user is a pending
 * approver — "Approve" / "Reject" actions.
 *
 * Since ADR-0019 an approval is a **flow node** (`type: 'approval'`), not a
 * standalone process: the flow opens the request when it reaches the node,
 * and a decision resumes the run down its `approve` / `reject` edge. There is
 * therefore no manual "submit" or "recall" from the record header — those
 * endpoints were removed. This hook reads the record's requests and lets a
 * pending approver record a decision.
 *
 * Talks directly to the framework REST endpoints under
 * `/api/v1/approvals/*`. Fails open: if the approvals plugin is not installed
 * (404 / 501) or the user has no identity, returns inert state so the detail
 * view continues to render normally.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bearerAuthHeaders } from '../utils/authToken';

export interface ApprovalRequestLite {
  id: string;
  process_name: string;
  object_name: string;
  record_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'recalled' | string;
  submitter_id?: string | null;
  current_step?: string | null;
  pending_approvers?: string[] | null;
  submitted_at?: string;
  completed_at?: string | null;
}

interface UseRecordApprovalsResult {
  loading: boolean;
  available: boolean;
  pendingRequest: ApprovalRequestLite | null;
  latestRequest: ApprovalRequestLite | null;
  /** The current user is among the pending approvers and may record a decision. */
  canDecide: boolean;
  approve: (input?: { comment?: string }) => Promise<ApprovalRequestLite | undefined>;
  reject: (input?: { comment?: string }) => Promise<ApprovalRequestLite | undefined>;
  refresh: () => Promise<void>;
}

function apiBase() {
  const url = (import.meta as any).env?.VITE_SERVER_URL || '';
  return `${String(url).replace(/\/$/, '')}/api/v1`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      // Bearer too — cookie-only auth loses this surface on split-origin
      // deployments where the SameSite cookie doesn't flow (#2548).
      ...bearerAuthHeaders(),
      ...(init?.headers || {}),
    },
    ...init,
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err: any = new Error(payload?.error || `HTTP ${res.status}`);
    err.code = payload?.code ?? `HTTP_${res.status}`;
    err.status = res.status;
    throw err;
  }
  return payload as T;
}

export function useRecordApprovals(
  objectName: string | undefined,
  recordId: string | undefined,
  currentUserId?: string | null,
): UseRecordApprovalsResult {
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const [requests, setRequests] = useState<ApprovalRequestLite[]>([]);
  const unavailableRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!objectName || !recordId) return;
    if (unavailableRef.current) return;
    setLoading(true);
    try {
      const reqResp = await fetchJson<{ data: ApprovalRequestLite[] }>(
        `/approvals/requests?object=${encodeURIComponent(objectName)}&recordId=${encodeURIComponent(recordId)}`,
      );
      setRequests(reqResp?.data ?? []);
      setAvailable(true);
    } catch (err: any) {
      if (err?.status === 404 || err?.status === 501) {
        unavailableRef.current = true;
        setAvailable(false);
      }
      // Other errors are transient — silently keep last state.
    } finally {
      setLoading(false);
    }
  }, [objectName, recordId]);

  useEffect(() => {
    if (!objectName || !recordId) {
      setRequests([]);
      return;
    }
    refresh();
  }, [objectName, recordId, refresh]);

  const pendingRequest = useMemo(
    () => requests.find((r) => r.status === 'pending') ?? null,
    [requests],
  );

  const latestRequest = useMemo(() => {
    if (requests.length === 0) return null;
    const sorted = [...requests].sort((a, b) => {
      const at = a.submitted_at || a.completed_at || '';
      const bt = b.submitted_at || b.completed_at || '';
      return bt.localeCompare(at);
    });
    return sorted[0] ?? null;
  }, [requests]);

  const canDecide = !!pendingRequest && !!currentUserId
    && (pendingRequest.pending_approvers ?? []).includes(currentUserId);

  const decide = useCallback(
    async (decision: 'approve' | 'reject', input?: { comment?: string }) => {
      if (!pendingRequest) throw new Error('No pending request');
      const out = await fetchJson<{ request?: ApprovalRequestLite }>(
        `/approvals/requests/${encodeURIComponent(pendingRequest.id)}/${decision}`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...(currentUserId ? { actorId: currentUserId } : {}),
            ...(input?.comment ? { comment: input.comment } : {}),
          }),
        },
      );
      await refresh();
      return out?.request;
    },
    [pendingRequest, currentUserId, refresh],
  );

  const approve = useCallback((input?: { comment?: string }) => decide('approve', input), [decide]);
  const reject = useCallback((input?: { comment?: string }) => decide('reject', input), [decide]);

  return {
    loading,
    available,
    pendingRequest,
    latestRequest,
    canDecide,
    approve,
    reject,
    refresh,
  };
}
