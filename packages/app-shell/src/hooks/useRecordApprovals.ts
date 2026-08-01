/**
 * useRecordApprovals
 *
 * Resolves the approval state for a single record so the detail view can show
 * its status band, honour the record lock, and mirror the request's declared
 * decision actions onto the record header.
 *
 * Since ADR-0019 an approval is a **flow node** (`type: 'approval'`), not a
 * standalone process: the flow opens the request when it reaches the node,
 * and a decision resumes the run down its `approve` / `reject` edge.
 *
 * **This hook does not decide.** It used to expose `approve` / `reject` plus a
 * client-side `canDecide` (`pending_approvers.includes(currentUserId)`) that the
 * record header wired to two hand-written buttons. That was a second, poorer
 * implementation of what `sys_approval_request` already declares as object
 * metadata — five of its nine actions had no entry point, decisions carried no
 * attachments, the copy drifted from the Approval Center's, and a group
 * approver (position / team / department) saw no decision buttons at all,
 * because a client-side membership test can never match the slots the server
 * resolved. The header now renders those declared actions against
 * {@link UseRecordApprovalsResult.liveRequest}, gated by the same
 * server-computed `viewer` block the Approval Center uses (objectui#3055). What
 * remains here is *state*: the badge, the lock, and the request those actions
 * run against.
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
  /**
   * Server-computed capability for the CURRENT viewer (framework#3310 /
   * framework#3424), attached by the approvals service to every request it
   * returns. This is the authority on who may act — the same resolution the
   * service authorizes a decision with, so a position / team / department
   * approver resolves correctly where a client-side `pending_approvers`
   * membership test cannot (objectui#3055).
   *
   * The request's declared actions gate their `visible` CEL on it. Absent on a
   * backend that predates the block, where those predicates then fail closed.
   */
  viewer?: {
    /** The caller holds a pending approver slot on this request. */
    can_act: boolean;
    /** The caller submitted this request. */
    is_submitter: boolean;
    /** The caller is an admin who may override a stuck pending request. */
    can_override?: boolean;
  } | null;
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
  /** The request that locks this record and drives the "in approval" band. */
  pendingRequest: ApprovalRequestLite | null;
  /**
   * The request the record header's declared actions run against: the open
   * one, whether it is `pending` (an approver decides, the submitter recalls or
   * nudges) or `returned` (ADR-0044 — the submitter reworks the record right
   * here and resubmits, which is precisely why the record page must offer it
   * and not only the Approval Center).
   */
  liveRequest: ApprovalRequestLite | null;
  latestRequest: ApprovalRequestLite | null;
  refresh: () => Promise<void>;
}

/** Statuses on which a request still has actions to offer someone. */
const LIVE_STATUSES = new Set(['pending', 'returned']);

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

  // Prefer the pending one when both exist (a record can carry a finished
  // earlier round plus a live one); `returned` is the ADR-0044 rework window.
  const liveRequest = useMemo(
    () => pendingRequest ?? requests.find((r) => LIVE_STATUSES.has(r.status)) ?? null,
    [pendingRequest, requests],
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

  return {
    loading,
    available,
    pendingRequest,
    liveRequest,
    latestRequest,
    refresh,
  };
}
