/**
 * Approvals REST helper.
 *
 * Thin fetch wrapper around the framework's approval endpoints
 * (`/api/v1/approvals/*`). Auth mirrors the rest of the console: the stored
 * Bearer token when present, plus cookies. Cookie-only auth silently lost
 * the approvals surface on split-origin deployments (custom-domain console ↔
 * API, or a dev console pointed at a remote backend) where the SameSite
 * cookie never flows — every other console call already sends the Bearer.
 *
 * Mirrors the shape exposed by `@objectstack/plugin-approvals` /
 * `packages/rest/src/rest-server.ts`.
 */
import { TokenStorage } from '@object-ui/auth';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
const API_BASE = `${SERVER_URL}/api/v1`;

export interface ApprovalProcessRow {
  id: string;
  name: string;
  object_name: string;
  status: 'active' | 'inactive' | string;
  definition: unknown;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ApprovalRequestRow {
  id: string;
  process_name: string;
  object_name: string;
  record_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'recalled' | 'returned' | string;
  current_step?: string | null;
  current_step_index?: number | null;
  pending_approvers?: string[] | null;
  submitter_id?: string | null;
  submitted_at?: string;
  created_at?: string;
  completed_at?: string | null;
  payload?: Record<string, unknown> | null;
  // Display enrichment, resolved server-side (plugin-approvals).
  /** Human label of the originating flow (e.g. "Project Budget Approval"). */
  process_label?: string;
  /** Human label of the approval step (e.g. "Manager Review"). */
  step_label?: string;
  /** Display name of the target record, when resolvable. */
  record_title?: string;
  /** Display name of the submitter (`sys_user.name`), when resolvable. */
  submitter_name?: string;
  /** Schema label of the target object (e.g. "Project"). */
  object_label?: string;
  /** Display names for user-id entries in `pending_approvers` (id → name). */
  pending_approver_names?: Record<string, string>;
  /** Display values for lookup fields in `payload` (field key → record title). */
  payload_display?: Record<string, string>;
  /** SLA deadline (`created_at + escalation.timeoutHours`), display-only. */
  sla_due_at?: string;
  /** Owning flow's approval steps for progress display (single reads only). */
  flow_steps?: Array<{ id: string; label: string; state: 'done' | 'current' | 'upcoming' }>;
  /**
   * Server-computed aggregation progress (#3266) for pending multi-approver
   * requests: unanimous/quorum = approvals got/need; per_group = satisfied
   * groups got/need plus per-group detail. Absent for first_response.
   */
  decision_progress?: {
    behavior: 'unanimous' | 'quorum' | 'per_group';
    got: number;
    need: number;
    groups?: Array<{ group: string; got: number; need: number; satisfied: boolean }>;
  };
  /** ADR-0044 revision round on this (run, node): absent/1 = first round. */
  round?: number;
}

export interface ApprovalActionRow {
  id: string;
  request_id: string;
  step_index?: number | null;
  step_name?: string | null;
  actor_id?: string | null;
  action: 'submit' | 'approve' | 'reject' | 'recall' | string;
  comment?: string | null;
  /** File references attached to this action (decision attachments, #3266). */
  attachments?: string[] | null;
  created_at?: string;
  /** Display name of the actor, resolved server-side. */
  actor_name?: string;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const token = TokenStorage.get();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });
  let payload: any = null;
  try { payload = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const code = payload?.code ?? `HTTP_${res.status}`;
    const msg = payload?.message ?? payload?.error ?? res.statusText;
    const err = new Error(`${code}: ${msg}`) as Error & { code?: string; status?: number; details?: unknown };
    err.code = code;
    err.status = res.status;
    err.details = payload;
    throw err;
  }
  return payload as T;
}

export const approvalsApi = {
  listProcesses(params: { object?: string; activeOnly?: boolean } = {}) {
    const qs = new URLSearchParams();
    if (params.object) qs.set('object', params.object);
    if (params.activeOnly) qs.set('activeOnly', 'true');
    const q = qs.toString();
    return call<{ data: ApprovalProcessRow[] }>(`/approvals/processes${q ? `?${q}` : ''}`);
  },

  listRequests(params: {
    status?: string;
    object?: string;
    recordId?: string;
    /**
     * One identity or a list. The server matches a request when ANY identity
     * is a pending approver, so the caller resolves "my pending approvals"
     * in a single request (comma-separated) instead of one per identity.
     */
    approverId?: string | string[];
    submitterId?: string;
    /** Free-text search, matched server-side (incl. record titles via the payload snapshot). */
    q?: string;
    /** Page window; when `limit` is set the response carries `total`. */
    limit?: number;
    offset?: number;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.object) qs.set('object', params.object);
    if (params.recordId) qs.set('recordId', params.recordId);
    const approver = Array.isArray(params.approverId)
      ? params.approverId.filter(Boolean).join(',')
      : params.approverId;
    if (approver) qs.set('approverId', approver);
    if (params.submitterId) qs.set('submitterId', params.submitterId);
    if (params.q?.trim()) qs.set('q', params.q.trim());
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return call<{ data: ApprovalRequestRow[]; total?: number }>(`/approvals/requests${q ? `?${q}` : ''}`);
  },

  async getRequest(id: string) {
    // Server returns the row directly (not `{data: row}`). Normalize.
    const row = await call<ApprovalRequestRow>(`/approvals/requests/${encodeURIComponent(id)}`);
    return { data: row };
  },

  listActions(requestId: string) {
    return call<{ data: ApprovalActionRow[] }>(
      `/approvals/requests/${encodeURIComponent(requestId)}/actions`,
    );
  },

  async approve(id: string, body: { actorId?: string; actor_id?: string; comment?: string; attachments?: string[] }) {
    // Server returns `{request, finalized}`. Normalize to `{data, finalized}`.
    const out = await call<{ request: ApprovalRequestRow; finalized: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, finalized: out.finalized };
  },

  async reject(id: string, body: { actorId?: string; actor_id?: string; comment?: string; attachments?: string[] }) {
    const out = await call<{ request: ApprovalRequestRow; finalized: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, finalized: out.finalized };
  },

  async recall(id: string, body: { actorId?: string; actor_id?: string; comment?: string }) {
    // Server returns `{request, runId, resumed}` — a recall always finalizes.
    const out = await call<{ request: ApprovalRequestRow; resumed?: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/recall`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, finalized: true };
  },

  /** Hand a pending-approver slot to someone else (server: slot holder only). */
  async reassign(id: string, body: { actor_id?: string; to: string; comment?: string }) {
    const out = await call<{ request: ApprovalRequestRow }>(
      `/approvals/requests/${encodeURIComponent(id)}/reassign`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request };
  },

  /** Submitter nudge — notifies pending approvers (throttled server-side). */
  async remind(id: string, body: { actor_id?: string; comment?: string } = {}) {
    const out = await call<{ request: ApprovalRequestRow; notified: number }>(
      `/approvals/requests/${encodeURIComponent(id)}/remind`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, notified: out.notified };
  },

  /** Approver asks the submitter for more info; the request stays pending. */
  async requestInfo(id: string, body: { actor_id?: string; comment: string }) {
    const out = await call<{ request: ApprovalRequestRow }>(
      `/approvals/requests/${encodeURIComponent(id)}/request-info`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request };
  },

  /**
   * Send back for revision (ADR-0044): the request finalizes `returned`, the
   * record unlocks, and the flow parks at a wait point until the submitter
   * resubmits. Past the node's `maxRevisions` budget the server auto-rejects
   * (`autoRejected: true`).
   */
  async sendBack(id: string, body: { actor_id?: string; comment?: string }) {
    const out = await call<{ request: ApprovalRequestRow; resumed?: boolean; autoRejected?: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/revise`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, autoRejected: out.autoRejected === true };
  },

  /**
   * Resubmit a returned request after rework (ADR-0044, submitter only): the
   * flow re-enters the approval node and opens the next round's request.
   */
  async resubmit(id: string, body: { actor_id?: string; comment?: string } = {}) {
    const out = await call<{ request: ApprovalRequestRow; resumed?: boolean }>(
      `/approvals/requests/${encodeURIComponent(id)}/resubmit`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request, resumed: out.resumed === true };
  },

  /** Free-form reply on the request thread (submitter or pending approver). */
  async comment(id: string, body: { actor_id?: string; comment: string; attachments?: string[] }) {
    const out = await call<{ request: ApprovalRequestRow }>(
      `/approvals/requests/${encodeURIComponent(id)}/comment`,
      { method: 'POST', body: JSON.stringify(body) },
    );
    return { data: out.request };
  },

  async submit(body: {
    object: string;
    recordId: string;
    processName?: string;
    submitterId?: string;
    comment?: string;
    payload?: Record<string, unknown>;
  }) {
    return call<ApprovalRequestRow>(`/approvals/requests`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

/**
 * Build the list of approver identifiers that should match the
 * signed-in user. Used to filter "My Pending" and to decide whether
 * Approve/Reject buttons are enabled.
 */
export function buildApproverIdentities(user: {
  id?: string;
  email?: string;
  /** Multi-role shape (some auth providers). */
  roles?: string[];
  /**
   * Single-role shape — better-auth sessions carry `role` as one string
   * (possibly comma-separated for multiple roles), never a `roles` array.
   * Both shapes must resolve, or role-addressed approvals (`role:<r>` in
   * `pending_approvers`) silently vanish from "My Pending".
   */
  role?: string;
} | null | undefined): string[] {
  if (!user) return [];
  const ids = new Set<string>();
  if (user.id) ids.add(user.id);
  if (user.email) ids.add(user.email);
  const roleList = [
    ...(user.roles || []),
    ...(typeof user.role === 'string' ? user.role.split(',') : []),
  ];
  for (const role of roleList) {
    const r = String(role).trim();
    if (r) ids.add(`role:${r}`);
  }
  return Array.from(ids);
}
