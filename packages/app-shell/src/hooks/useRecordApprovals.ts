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
import type { DecisionOutputDef } from '../utils/decisionOutputParams';

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
  /**
   * Whether THIS pending node locks the record from edits (objectui#2902).
   * The approval node's `lockRecord` policy, surfaced by the server from the
   * same `node_config_json` snapshot its record-lock `beforeUpdate` hook reads
   * — so the badge we render and the rule the server applies agree.
   *
   * `undefined` on a pre-framework#3814 backend, which never sent the flag.
   * Callers must fail CLOSED there (treat as locked): offering an edit the
   * server then rejects with `RECORD_LOCKED` is worse than hiding one it would
   * have allowed. See {@link recordLockedByApproval}.
   */
  lock_record?: boolean;
  /**
   * Structured data THIS pending node asks the approver to submit with their
   * decision (framework#3447 P2) — the flow reads it back as
   * `vars.<nodeId>.<key>`, typically to route the next node's approvers.
   *
   * `decision_output_defs` carries the typed declaration (`type` /`multiple`),
   * `decision_outputs` the bare key list a pre-typed backend sends; both are
   * absent on a backend that predates the feature. The record header collects
   * them exactly like the Approval Center does — a decision that silently
   * skipped them left the next node reading a missing key (objectui#2955).
   */
  decision_outputs?: string[] | null;
  decision_output_defs?: DecisionOutputDef[] | null;
}

/**
 * Does an open approval request lock its record from edits?
 *
 * A pending request is NOT the same thing as a locked record: an approval node
 * may declare `lockRecord: false`, and the server then lets the record be
 * edited while that node waits (a single-approver step where the approver is
 * meant to fill in the missing detail is the motivating case). Treating "has a
 * pending request" as "locked" mislabels those nodes and hides an edit the
 * server would have accepted — objectui#2902.
 *
 * Fails closed on both unknowns: no request at all is not a lock, but a request
 * from a backend too old to report the policy is.
 */
export function recordLockedByApproval(request: ApprovalRequestLite | null | undefined): boolean {
  if (!request) return false;
  return request.lock_record !== false;
}

interface UseRecordApprovalsResult {
  loading: boolean;
  available: boolean;
  pendingRequest: ApprovalRequestLite | null;
  latestRequest: ApprovalRequestLite | null;
  /** The current user is among the pending approvers and may record a decision. */
  canDecide: boolean;
  approve: (input?: DecisionInput) => Promise<ApprovalRequestLite | undefined>;
  reject: (input?: DecisionInput) => Promise<ApprovalRequestLite | undefined>;
  refresh: () => Promise<void>;
}

/**
 * What an approver submits with a decision: the free-text comment, plus the
 * node's declared decision outputs keyed by their declared `key` (objectui#2955).
 */
export interface DecisionInput {
  comment?: string;
  outputs?: Record<string, any>;
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
    async (decision: 'approve' | 'reject', input?: DecisionInput) => {
      if (!pendingRequest) throw new Error('No pending request');
      const outputs = input?.outputs && Object.keys(input.outputs).length > 0 ? input.outputs : undefined;
      const out = await fetchJson<{ request?: ApprovalRequestLite }>(
        `/approvals/requests/${encodeURIComponent(pendingRequest.id)}/${decision}`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...(currentUserId ? { actorId: currentUserId } : {}),
            ...(input?.comment ? { comment: input.comment } : {}),
            // The node's declared decision outputs, under the same nested key
            // the Approval Center's `type:'api'` decide actions post
            // (objectui#2955). Omitted entirely when nothing was collected, so
            // a node without `decisionOutputs` posts the body it always did.
            ...(outputs ? { outputs } : {}),
          }),
        },
      );
      await refresh();
      return out?.request;
    },
    [pendingRequest, currentUserId, refresh],
  );

  const approve = useCallback((input?: DecisionInput) => decide('approve', input), [decide]);
  const reject = useCallback((input?: DecisionInput) => decide('reject', input), [decide]);

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
