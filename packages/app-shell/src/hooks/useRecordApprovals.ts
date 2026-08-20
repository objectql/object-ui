/**
 * useRecordApprovals
 *
 * Resolves the approval state for a single record — the READ half only: the
 * status badge, the record lock (`lock_record`), and the request rows the
 * record page's approvals panel renders.
 *
 * Since ADR-0019 an approval is a **flow node** (`type: 'approval'`), not a
 * standalone process: the flow opens the request when it reaches the node,
 * and a decision resumes the run down its `approve` / `reject` edge.
 *
 * ⛔ This hook does NOT decide (objectui#3055). It used to own a second,
 * hand-written decision path — an `approve()` / `reject()` pair plus a
 * CLIENT-side `canDecide` (`pending_approvers.includes(currentUserId)`) — that
 * the record page injected as two hard-coded header buttons. That fork covered
 * two of the nine approval routes: reassign / send-back / request-info had zero
 * entry point on a business record, decision attachments were impossible, and
 * the copy was maintained separately from the approvals list's. Decisions now
 * go through the SAME server-declared `sys_approval_request` actions the
 * approvals list runs (`DeclaredActionsBar`), gated by the server-computed
 * `viewer` block rather than by a second client-side opinion — so a new
 * decision action is metadata, not console code.
 *
 * Talks directly to the framework REST endpoints under
 * `/api/v1/approvals/*`. Fails open: if the approvals plugin is not installed
 * (404 / 501) or the user has no identity, returns inert state so the detail
 * view continues to render normally.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bearerAuthHeaders } from '../utils/authToken.js';
import type { DecisionOutputDef } from '../utils/decisionOutputParams.js';

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
   * Server-computed decision tally of THIS pending node (framework#3266),
   * present only for behaviors that aggregate more than one decision:
   * `unanimous` / `quorum` (`got` / `need` approvals) and `per_group` (satisfied
   * groups, plus `groups[]` detail). `first_response` nodes carry none — one
   * decision finalizes them, so there is nothing to count.
   *
   * The server derives it from the node's own `node_config_json` snapshot
   * (`behavior`, `minApprovals`, the `__approverGroups` slate), so the count
   * the record header shows is the one the engine will enforce. See
   * {@link fetchProgressEnrichment} for why it takes a second request.
   */
  decision_progress?: ApprovalDecisionProgress;
  /**
   * Group membership of each still-pending approver on a `per_group` (会签)
   * node — approver id → the named group(s) the slot fills. Lets a surface that
   * lists pending approvers label each one; absent for other behaviors.
   */
  pending_approver_groups?: Record<string, string[]> | null;
  /** Display names for the ids in `pending_approvers` (id → name). */
  pending_approver_names?: Record<string, string> | null;
  /** Human label of the originating flow (e.g. "Project Budget Approval"). */
  process_label?: string;
  /** Human label of the pending approval step (e.g. "Manager Review"). */
  step_label?: string;
  /** Display name of the submitter (`sys_user.name`), when resolvable. */
  submitter_name?: string;
  /** Owning flow's approval steps for progress display (single reads only). */
  flow_steps?: Array<{ id: string; label: string; state: 'done' | 'current' | 'upcoming' }>;
  /**
   * Server-computed capability of the current viewer (framework#3310), attached
   * by `getRequest`. `is_submitter` gates the record page's remind affordance
   * the same way the Approval Center gates its submitter levers — the server
   * resolved the identity, so the panel never re-derives it client-side.
   */
  viewer?: {
    can_act: boolean;
    is_submitter: boolean;
    can_override?: boolean;
  };
  /** ADR-0044 revision round on this (run, node): absent/1 = first round. */
  round?: number;
}

/**
 * A file attached to a decision action. The server resolves the
 * `sys_approval_action.attachments` file field into rich descriptors, so a
 * consumer has the display name without any `sys_file` lookup; opening one
 * still goes through the signed-URL storage route.
 */
export interface ApprovalActionAttachmentLite {
  id: string;
  name?: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

/**
 * One `sys_approval_action` row — a submit/approve/reject/… event on a
 * request's thread, as `GET /approvals/requests/:id/actions` sends it.
 * The approval timeline the Approval Center draws is made of these; the
 * record page's approval panel reads the same rows (objectui#3461).
 */
export interface ApprovalActionLite {
  id: string;
  request_id: string;
  step_index?: number | null;
  step_name?: string | null;
  actor_id?: string | null;
  /** Display name of the actor, resolved server-side. */
  actor_name?: string;
  action: 'submit' | 'approve' | 'reject' | 'recall' | string;
  comment?: string | null;
  attachments?: ApprovalActionAttachmentLite[] | null;
  created_at?: string;
  /** Structured reassign hand-off parties (framework#4365), reassign rows only. */
  reassign_from?: string;
  reassign_to?: string;
  reassign_from_name?: string;
  reassign_to_name?: string;
  /**
   * Whether the actor was admitted to this action ONLY by the privileged
   * admin-override path (framework#3424) — they held no slot in the request's
   * pending-approver slate (framework#4466).
   *
   * The server has written this since framework#4466 and `rowFromAction` puts
   * it on the wire, but no console surface declared or read it, so every
   * timeline rendered an override byte-for-byte like an ordinary approval —
   * objectui#5178, the unlanded half of framework#4466's own *Expected*.
   *
   * Tri-state, mirroring the column: `true` = override, `false` = checked and
   * NOT an override, `undefined` = a row written before the column existed.
   * Read it through {@link isViaOverrideRow}, which marks only an explicit
   * `true` — "not recorded" is not the same claim as "not an override".
   */
  via_override?: boolean;
}

/**
 * Decision aggregation progress of a pending approval node — the `2 of 3` the
 * approver needs in order to know whether their own decision closes the step.
 * Mirrors the framework's `decision_progress` enrichment verbatim.
 */
export interface ApprovalDecisionProgress {
  behavior: 'unanimous' | 'quorum' | 'per_group';
  /** Approvals recorded — satisfied GROUPS when `behavior` is `per_group`. */
  got: number;
  /** Approvals required — total GROUPS when `behavior` is `per_group`. */
  need: number;
  /** Per-group tally, `per_group` only. */
  groups?: Array<{ group: string; got: number; need: number; satisfied: boolean }>;
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
  /**
   * Every approval request on the record, newest first — one per approval
   * node the flow has reached (and per ADR-0044 revision round), so a
   * multi-level flow accumulates several. The record page's approval panel
   * renders them all (objectui#3461); `pendingRequest` / `latestRequest`
   * remain the derived single-row reads the status badge and the decision
   * bar's record consume.
   */
  requests: ApprovalRequestLite[];
  /**
   * The one still-`pending` request, enriched by `getRequest` — so it carries
   * the server-computed `viewer` block the declared decision actions gate on
   * (objectui#3055) as well as the `decision_progress` tally.
   */
  pendingRequest: ApprovalRequestLite | null;
  latestRequest: ApprovalRequestLite | null;
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

/**
 * Pull the pending request's single-read enrichment and fold it onto the row.
 *
 * `decision_progress` (and the `pending_approver_groups` that ride with it) are
 * attached by the framework's `getRequest` ONLY — `listRequests` deliberately
 * skips them, because each one costs a `sys_approval_action` tally per row and
 * a list read may return hundreds. So `GET /approvals/requests?object=…` — the
 * call this hook makes — never carries the quorum data, and the record header
 * had nothing to render even though the node's config had it all along
 * (objectstack#4478: `minApprovals: 2` over a 3-approver slate showed no
 * progress at all). One extra request for the ONE pending row is the shape the
 * server contract asks for.
 *
 * Best-effort and non-fatal: a failure, or a payload that isn't the row we
 * asked for, leaves the list row exactly as it came. Never invent a tally —
 * a wrong "1 of 2" is worse than none.
 */
async function fetchProgressEnrichment(
  request: ApprovalRequestLite,
): Promise<ApprovalRequestLite> {
  try {
    // `getRequest` answers with the row itself, not `{ data: row }`.
    const row = await fetchJson<ApprovalRequestLite>(
      `/approvals/requests/${encodeURIComponent(request.id)}`,
    );
    if (!row || row.id !== request.id) return request;
    return { ...request, ...row };
  } catch {
    return request;
  }
}

/**
 * Read a request's action thread (`sys_approval_action`) — who decided what,
 * when, with which comment/attachments. Same rows the Approval Center's
 * timeline draws; the record page's approval panel merges them across the
 * record's requests (objectui#3461). Empty array on any shape mismatch.
 */
export async function listApprovalActions(requestId: string): Promise<ApprovalActionLite[]> {
  const out = await fetchJson<{ data: ApprovalActionLite[] }>(
    `/approvals/requests/${encodeURIComponent(requestId)}/actions`,
  );
  return Array.isArray(out?.data) ? out.data : [];
}

/**
 * Submitter nudge — notifies the pending approvers (throttled server-side,
 * 429/THROTTLED when sent too recently). `notified` is how many were pinged.
 */
export async function remindApprovalRequest(
  requestId: string,
): Promise<{ notified?: number }> {
  const out = await fetchJson<{ notified?: number }>(
    `/approvals/requests/${encodeURIComponent(requestId)}/remind`,
    { method: 'POST', body: JSON.stringify({}) },
  );
  return out ?? {};
}

/**
 * ⛔ No `currentUserId` parameter (objectui#3055). It existed only to feed the
 * retired client-side `canDecide`; every remaining question about the viewer —
 * may they act, are they the submitter, may they override — is answered by the
 * server on the row itself (`viewer`, framework#3310 / #3424). A surface that
 * still needs the signed-in id for a pre-`viewer` fallback (the panel's remind)
 * reads it from `useAuth()` where it renders.
 */
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
      const rows = reqResp?.data ?? [];
      // Only the pending row can have a live tally, and only it drives the
      // header — so exactly one follow-up read, never one per row.
      const pending = rows.find((r) => r.status === 'pending');
      const full = pending ? await fetchProgressEnrichment(pending) : null;
      setRequests(full ? rows.map((r) => (r === pending ? full : r)) : rows);
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

  const sortedRequests = useMemo(
    () =>
      [...requests].sort((a, b) => {
        const at = a.submitted_at || a.completed_at || '';
        const bt = b.submitted_at || b.completed_at || '';
        return bt.localeCompare(at);
      }),
    [requests],
  );

  const latestRequest = sortedRequests[0] ?? null;

  // ⛔ No `canDecide` / `approve` / `reject` here (objectui#3055). Whether the
  // viewer may act is the SERVER's answer (`pendingRequest.viewer`), read by
  // the declared actions' own `visible` gate; recording the decision is the
  // declared `type:'api'` action's POST. A client-side second opinion on the
  // same question is what let the record page and the approvals list disagree.

  return {
    loading,
    available,
    requests: sortedRequests,
    pendingRequest,
    latestRequest,
    refresh,
  };
}
