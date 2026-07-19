/**
 * Approvals Inbox
 *
 * Front-end for `@objectstack/plugin-approvals` (M11.C15 / ADR-0019).
 *
 * Tabs:
 *   • My Pending      — requests where the signed-in user is in
 *                       `pending_approvers` (matched by id, email, or
 *                       `role:<name>` for each assigned role).
 *   • Submitted by me — requests where `submitter_id` is the user.
 *   • All             — every request (any status).
 *
 * Business-first information architecture: rows lead with the flow's display
 * label and the target record's title (server-enriched `process_label` /
 * `record_title` / `submitter_name`), not machine names and opaque ids. The
 * side sheet shows a structured summary of the record snapshot, the action
 * timeline, and Approve / Reject / Recall (enabled based on actor + status,
 * with the reason inline when disabled).
 *
 * Keyboard: j/k move row focus · Enter opens · x toggles selection ·
 * a approves · r rejects (with confirm). Disabled while a dialog is open or
 * an input is focused.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CommentAttachment, type Attachment } from '@object-ui/plugin-detail';
import { createObjectStackUploadAdapter } from '@object-ui/providers';
import { createAuthenticatedFetch } from '@object-ui/auth';
import {
  Button,
  Badge,
  Card,
  CardContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Textarea,
  Label,
  Skeleton,
  Empty,
  EmptyTitle,
  EmptyDescription,
  Alert,
  AlertDescription,
  Separator,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Input,
  Checkbox,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@object-ui/components';
import { toast } from 'sonner';
import { useAuth, useIsWorkspaceAdmin } from '@object-ui/auth';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  CheckCircle2,
  XCircle,
  Undo2,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckSquare,
  Search,
  Copy,
  X,
  ExternalLink,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  BellRing,
  HelpCircle,
  Send,
  Check,
  CornerUpLeft,
  Paperclip,
} from 'lucide-react';
import {
  approvalsApi,
  buildApproverIdentities,
  type ApprovalRequestRow,
  type ApprovalActionRow,
} from '../../services/approvalsApi';

type TabKey = 'pending' | 'submitted' | 'all';

/** Server page size for the paginated tabs (submitted / all). */
const PAGE_SIZE = 50;

/**
 * Semantic status colors (green = approved, amber = waiting, red = rejected,
 * slate = recalled, violet = returned for revision) — variant-based Badge
 * colors read as monochrome chrome, not as state.
 */
const STATUS_CLASSES: Record<string, string> = {
  pending:  'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400',
  rejected: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400',
  recalled: 'border-border bg-muted text-muted-foreground',
  returned: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-400',
};

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

/**
 * Render an actor/approver identifier in a friendly form.
 *  - emails → shown as-is
 *  - `role:<name>` → shown as "Role: name"
 *  - opaque 16+ char IDs → truncated middle (e.g. `5aF9BX3J…wTk`)
 */
function formatIdentity(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.includes('@')) return id;
  if (id.startsWith('role:')) return `Role: ${id.slice(5)}`;
  if (id.length > 14) return `${id.slice(0, 6)}…${id.slice(-4)}`;
  return id;
}

/** `manager_review` → "Manager Review" (display fallback for legacy rows). */
function prettifyMachineName(raw: string | null | undefined): string {
  if (!raw) return '—';
  const base = String(raw).replace(/^flow:/, '').trim();
  return base.split(/[_\-\s]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || '—';
}

function processLabel(r: ApprovalRequestRow): string {
  return r.process_label || prettifyMachineName(r.process_name);
}
function stepLabel(r: ApprovalRequestRow): string | null {
  if (r.step_label) return r.step_label;
  return r.current_step ? prettifyMachineName(r.current_step) : null;
}
function submitterDisplay(r: ApprovalRequestRow): string {
  return r.submitter_name || formatIdentity(r.submitter_id);
}
/** Approver chip text: server-resolved display name, else readable identity. */
function approverDisplay(a: string, r: ApprovalRequestRow): string {
  return r.pending_approver_names?.[a] || formatIdentity(a);
}
/** Object subtitle: schema label when resolved, else the machine name. */
function objectDisplay(r: ApprovalRequestRow): string {
  return r.object_label || r.object_name;
}
function submittedAt(r: ApprovalRequestRow): string | undefined {
  return r.submitted_at || r.created_at || undefined;
}

/** Hours a pending request has been waiting; null when no timestamp. */
function waitingHours(r: ApprovalRequestRow): number | null {
  const s = submittedAt(r);
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / 36e5;
}

/** Aging tint: quiet under a day, amber 1–3 days, red beyond 3 days. */
function agingClass(r: ApprovalRequestRow): string {
  if (r.status !== 'pending') return 'text-muted-foreground';
  const h = waitingHours(r);
  if (h == null) return 'text-muted-foreground';
  if (h > 72) return 'text-red-600 dark:text-red-400 font-medium';
  if (h > 24) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

/** Compact duration for SLA chips: "36h" under 2 days, else "3d". */
function compactDuration(ms: number): string {
  const h = Math.max(1, Math.round(Math.abs(ms) / 36e5));
  return h < 48 ? `${h}h` : `${Math.round(h / 24)}d`;
}

const PAYLOAD_SYSTEM_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'organization_id',
]);

function prettifyKey(k: string): string {
  return k.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatPayloadValue(key: string, v: unknown): string {
  if (typeof v === 'boolean') return v ? '✓' : '—';
  if (typeof v === 'number') {
    // Epoch-ms timestamps read as dates; everything else as a localized number.
    if (v > 1e12 && /(_at$|_date$|^date_|_time$)/.test(key)) {
      try { return new Date(v).toLocaleDateString(); } catch { /* fall through */ }
    }
    return v.toLocaleString();
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(s)) {
    try { return new Date(s).toLocaleString(); } catch { /* fall through */ }
  }
  return s;
}

/** Opaque foreign-key shape: long unbroken alphanumeric token, not a number. */
const OPAQUE_ID_RE = /^[A-Za-z0-9_-]{15,}$/;

/**
 * First N scalar business fields of the record snapshot, for the summary
 * card. Lookup foreign keys render their server-resolved record title
 * (`payload_display`); an unresolved opaque id is dropped rather than shown —
 * a business reader gets nothing from `dpOfPMy7cbeEL1jk`.
 */
function payloadSummary(
  payload: unknown,
  display?: Record<string, string>,
  max = 6,
): Array<[string, string]> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (PAYLOAD_SYSTEM_KEYS.has(k)) continue;
    if (v == null || typeof v === 'object') continue;
    if (String(v).trim() === '') continue;
    const resolved = display?.[k];
    if (!resolved && typeof v === 'string' && OPAQUE_ID_RE.test(v.trim()) && !/^\d+$/.test(v.trim())) {
      continue;
    }
    out.push([prettifyKey(k), resolved ?? formatPayloadValue(k, v)]);
    if (out.length >= max) break;
  }
  return out;
}

export function ApprovalsInboxPage() {
  const { t, language } = useObjectTranslation();
  const { user } = useAuth();
  const isAdmin = useIsWorkspaceAdmin();
  const { appName } = useParams<{ appName?: string }>();
  // Deep link (#2678 P1.5): notifications carry `/system/approvals?request=<id>`
  // so landing here opens that request's drawer directly. Consumed once, then
  // stripped from the URL so refresh/back doesn't re-open a dismissed drawer.
  const [searchParams, setSearchParams] = useSearchParams();
  const identities = useMemo(() => buildApproverIdentities(user as any), [user]);

  const tr = useCallback(
    (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
      String(t(`approvalsInbox.${key}`, { defaultValue, ...opts })),
    [t],
  );

  /** Localized relative time, e.g. "5m ago" / "5 分钟前". */
  const formatRelative = useCallback((s: string | null | undefined): string => {
    if (!s) return '—';
    const ts = Date.parse(s);
    if (Number.isNaN(ts)) return s;
    const sec = Math.round((Date.now() - ts) / 1000);
    if (sec < 45) return tr('justNow', 'just now');
    const min = Math.round(sec / 60);
    if (min < 60) return tr('minutesAgo', '{{count}}m ago', { count: min });
    const hr = Math.round(min / 60);
    if (hr < 24) return tr('hoursAgo', '{{count}}h ago', { count: hr });
    const day = Math.round(hr / 24);
    if (day < 30) return tr('daysAgo', '{{count}}d ago', { count: day });
    try { return new Date(s).toLocaleDateString(language); } catch { return s; }
  }, [tr, language]);

  const statusLabel = useCallback((status: string): string => {
    switch (status) {
      case 'pending': return tr('statusPending', 'Pending');
      case 'approved': return tr('statusApproved', 'Approved');
      case 'rejected': return tr('statusRejected', 'Rejected');
      case 'recalled': return tr('statusRecalled', 'Recalled');
      case 'returned': return tr('statusReturned', 'Returned for revision');
      default: return status;
    }
  }, [tr]);

  /** Map raw API errors to business-readable toasts (no `HTTP_404: Not found`). */
  const humanizeError = useCallback((err: any, fallback: string): string => {
    const code = err?.code ?? '';
    const status = err?.status ?? 0;
    if (code === 'NOT_IMPLEMENTED' || status === 501) {
      return tr('recallUnavailable', 'Recall is not available on this deployment.');
    }
    if (code === 'THROTTLED' || status === 429) {
      return tr('remindThrottled', 'A reminder was sent recently — try again later.');
    }
    if (status === 404) return tr('requestGone', 'This request no longer exists. Refresh the list.');
    if (code === 'FORBIDDEN' || status === 403) return tr('notAllowed', 'You are not allowed to perform this action.');
    if (code === 'INVALID_STATE' || status === 409) return tr('alreadyDecided', 'This request was already decided. Refresh the list.');
    return err?.message || fallback;
  }, [tr]);

  function StatusBadge({ status }: { status: string }) {
    return (
      <Badge variant="outline" className={cn('font-medium', STATUS_CLASSES[status] ?? '')}>
        {statusLabel(status)}
      </Badge>
    );
  }

  const recordHref = useCallback((r: ApprovalRequestRow): string => {
    const app = appName || 'setup';
    return `/apps/${app}/${encodeURIComponent(r.object_name)}/record/${encodeURIComponent(r.record_id)}`;
  }, [appName]);

  const [tab, setTab] = useState<TabKey>('pending');
  const [rows, setRows] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Unwindowed total on the paginated tabs (null = unpaginated tab). */
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** "My pending" count, independent of the active tab (badge + bell parity). */
  const [myPendingCount, setMyPendingCount] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApprovalRequestRow | null>(null);
  const [actions, setActions] = useState<ApprovalActionRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [actorOverride, setActorOverride] = useState('');
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | 'recall' | null>(null);
  // Decision attachments (#3266): files staged in the composer, sent as
  // `attachments: fileId[]` with the next approve/reject. Uploads go through
  // the same presigned-storage adapter as RecordAttachmentsPanel.
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);
  const uploadAdapter = useMemo(
    () => createObjectStackUploadAdapter({
      baseUrl: (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, ''),
      scope: 'attachments',
      fetchImpl: authFetch,
    }),
    [authFetch],
  );
  const handleAttachmentUpload = useCallback(async (files: FileList) => {
    setAttachmentError(null);
    for (const file of Array.from(files)) {
      try {
        const result = await uploadAdapter.upload(file);
        const fileId = String((result.meta as { fileId?: string } | undefined)?.fileId ?? '');
        if (!fileId) throw new Error('upload returned no fileId');
        setPendingAttachments(prev => [...prev, {
          id: fileId, name: result.name, size: result.size, type: result.mimeType, url: result.url,
        }]);
      } catch (err) {
        setAttachmentError((err as Error)?.message ?? String(err));
      }
    }
  }, [uploadAdapter]);
  const handleAttachmentRemove = useCallback((attachmentId: string) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, []);
  // Resolve attachment fileIds → sys_file display names for the timeline chips
  // (#2678 P1.5). Best-effort, cached per id; unresolved ids fall back to a
  // generic "Attachment" label.
  const [attachmentNames, setAttachmentNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const ids = new Set<string>();
    for (const a of actions) for (const id of (a.attachments ?? [])) {
      if (id && attachmentNames[id] === undefined) ids.add(id);
    }
    if (!ids.size) return;
    const base = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
    let cancelled = false;
    void (async () => {
      const resolved: Record<string, string> = {};
      await Promise.all(Array.from(ids).map(async (id) => {
        try {
          const res = await authFetch(`${base}/api/v1/data/sys_file/${encodeURIComponent(id)}`);
          if (!res.ok) { resolved[id] = ''; return; }
          const body = await res.json().catch(() => null);
          resolved[id] = String(body?.record?.name ?? body?.data?.name ?? body?.name ?? '');
        } catch { resolved[id] = ''; }
      }));
      if (!cancelled) setAttachmentNames(prev => ({ ...prev, ...resolved }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed off actions; attachmentNames is the cache being filled
  }, [actions, authFetch]);

  /** Open an action's attachment via a short-lived signed URL (Bearer-authed fetch). */
  const openAttachment = useCallback(async (fileId: string) => {
    try {
      const base = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
      const res = await authFetch(`${base}/api/v1/storage/files/${encodeURIComponent(fileId)}/url`);
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const body = await res.json().catch(() => null);
      const url = body?.data?.url ?? body?.url;
      if (url) window.open(url, '_blank', 'noopener');
    } catch {
      /* open failed — non-fatal; the chip stays visible */
    }
  }, [authFetch]);

  // Search + filters. On the paginated tabs (submitted/all) the free-text
  // query is debounced and pushed to the server; the pending tab keeps
  // instant client-side matching over its (bounded) personal queue.
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [processFilter, setProcessFilter] = useState<string>('all');
  const [objectFilter, setObjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Bulk selection (only meaningful on "pending" tab where the user can act)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  // Inline reject confirmation target (row-level quick action / keyboard)
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequestRow | null>(null);
  const [inlineActing, setInlineActing] = useState<string | null>(null);

  // Thread interactions (reassign / request-info / reply / remind)
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState('');
  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [requestInfoText, setRequestInfoText] = useState('');
  // Send back for revision (ADR-0044) — a flow movement, unlike request-info.
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackText, setSendBackText] = useState('');
  const [resubmitting, setResubmitting] = useState(false);
  const [reply, setReply] = useState('');
  const [threadBusy, setThreadBusy] = useState(false);
  const [userOptions, setUserOptions] = useState<Array<{ name: string; email: string }>>([]);

  // Keyboard row focus
  const [focusIndex, setFocusIndex] = useState<number>(-1);

  useEffect(() => {
    if (tab === 'pending') return;
    const t = window.setTimeout(() => setServerQuery(query), 350);
    return () => window.clearTimeout(t);
  }, [query, tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let requests: ApprovalRequestRow[] = [];
      if (tab === 'pending') {
        // ONE request with every identity — the server matches ANY of them.
        requests = identities.length
          ? (await approvalsApi.listRequests({ status: 'pending', approverId: identities })).data
          : [];
        setMyPendingCount(requests.length);
        setTotal(null);
      } else {
        const pageParams = {
          q: serverQuery || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          limit: PAGE_SIZE,
          offset: 0,
        };
        if (tab === 'submitted') {
          const submitterId = user?.id;
          if (submitterId) {
            const res = await approvalsApi.listRequests({ submitterId, ...pageParams });
            requests = res.data;
            setTotal(res.total ?? res.data.length);
          } else {
            requests = [];
            setTotal(0);
          }
        } else {
          const res = await approvalsApi.listRequests(pageParams);
          requests = res.data;
          setTotal(res.total ?? res.data.length);
        }
        // Keep the badge honest while browsing other tabs.
        if (identities.length) {
          approvalsApi.listRequests({ status: 'pending', approverId: identities })
            .then(res => setMyPendingCount(res.data.length))
            .catch(() => { /* badge refresh is best-effort */ });
        }
      }
      // Newest first — submitted_at falls back to created_at for legacy rows.
      requests.sort((a, b) => (submittedAt(b) || '').localeCompare(submittedAt(a) || ''));
      setRows(requests);
    } catch (err: any) {
      setError(err?.message || String(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [tab, identities, user?.id, serverQuery, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  /** Append the next server page (paginated tabs only). */
  const loadMore = useCallback(async () => {
    if (tab === 'pending' || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await approvalsApi.listRequests({
        submitterId: tab === 'submitted' ? user?.id ?? undefined : undefined,
        q: serverQuery || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: PAGE_SIZE,
        offset: rows.length,
      });
      setRows(prev => {
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...res.data.filter(r => !seen.has(r.id))];
      });
      if (res.total != null) setTotal(res.total);
    } catch (err: any) {
      toast.error(humanizeError(err, tr('loadFailed', 'Failed to load request')));
    } finally {
      setLoadingMore(false);
    }
  }, [tab, loadingMore, user?.id, serverQuery, statusFilter, rows.length, humanizeError, tr]);

  const openDrawer = useCallback(async (id: string) => {
    setSelectedId(id);
    setDrawerLoading(true);
    setComment('');
    setActorOverride('');
    setPendingAttachments([]);
    setAttachmentError(null);
    try {
      const [req, acts] = await Promise.all([
        approvalsApi.getRequest(id),
        approvalsApi.listActions(id),
      ]);
      setSelected(req.data);
      setActions(acts.data);
    } catch (err: any) {
      toast.error(humanizeError(err, tr('loadFailed', 'Failed to load request')));
      setSelected(null);
      setActions([]);
    } finally {
      setDrawerLoading(false);
    }
  }, [humanizeError, tr]);

  const closeDrawer = () => {
    setSelectedId(null);
    setSelected(null);
    setActions([]);
    setComment('');
    setActorOverride('');
    setPendingAttachments([]);
    setAttachmentError(null);
  };

  // Consume the notification deep link once (see useSearchParams above).
  useEffect(() => {
    const target = searchParams.get('request');
    if (!target) return;
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('request'); return next; }, { replace: true });
    void openDrawer(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per deep link, not per openDrawer identity
  }, [searchParams]);

  /**
   * Pick the actor id to send with approve/reject.
   *   1. Manual override (admin-only textbox), useful when acting as a role
   *      like `role:sales_manager`.
   *   2. First identity that intersects `pending_approvers`.
   *   3. User id fallback.
   */
  const resolveActor = useCallback((req: ApprovalRequestRow | null): string => {
    if (actorOverride.trim()) return actorOverride.trim();
    if (!req) return user?.id || '';
    const pending = new Set(req.pending_approvers || []);
    for (const id of identities) if (pending.has(id)) return id;
    return user?.id || '';
  }, [actorOverride, identities, user?.id]);

  const refreshBadge = useCallback(() => {
    if (!identities.length) return;
    approvalsApi.listRequests({ status: 'pending', approverId: identities })
      .then(res => setMyPendingCount(res.data.length))
      .catch(() => { /* best-effort */ });
  }, [identities]);

  const doAction = useCallback(async (kind: 'approve' | 'reject' | 'recall') => {
    if (!selected) return;
    const actor = kind === 'recall' ? (user?.id || resolveActor(selected)) : resolveActor(selected);
    if (!actor) {
      toast.error(tr('noActor', 'Cannot determine the acting identity'));
      return;
    }
    setSubmitting(kind);
    try {
      const body = {
        actor_id: actor,
        comment: comment.trim() || undefined,
        // Decision attachments (#3266) ride approve/reject only — recall has no composer.
        ...(kind !== 'recall' && pendingAttachments.length
          ? { attachments: pendingAttachments.map(a => a.id) }
          : {}),
      };
      const fn = kind === 'approve' ? approvalsApi.approve
              : kind === 'reject'  ? approvalsApi.reject
              : approvalsApi.recall;
      const res = await fn(selected.id, body);
      toast.success(
        kind === 'approve'
          ? (res.finalized ? tr('approvedFinal', 'Approved') : tr('approvedWaiting', 'Approved — waiting on the remaining approvers'))
          : kind === 'reject' ? tr('rejectedToast', 'Rejected')
          : tr('recalledToast', 'Request recalled'),
      );
      setComment('');
      setPendingAttachments([]);
      setAttachmentError(null);
      // Queue processing (Fiori "My Inbox" pattern): a decision on the
      // pending tab advances straight to the next waiting item instead of
      // parking on the finished one. Recall keeps the drawer for review.
      if (kind !== 'recall' && tab === 'pending') {
        const list = filteredRef.current;
        const idx = list.findIndex(r => r.id === selected.id);
        const next = list[idx + 1] ?? list[idx - 1];
        void load();
        if (next && next.id !== selected.id) void openDrawer(next.id);
        else closeDrawer();
        return;
      }
      // Refresh drawer + list.
      const [req, acts] = await Promise.all([
        approvalsApi.getRequest(selected.id),
        approvalsApi.listActions(selected.id),
      ]);
      setSelected(req.data);
      setActions(acts.data);
      void load();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setSubmitting(null);
    }
  }, [selected, resolveActor, comment, pendingAttachments, load, user?.id, humanizeError, tr, tab, openDrawer]);

  /** Refresh the open drawer + list after a thread interaction. */
  const refreshThread = useCallback(async (id: string) => {
    const [req, acts] = await Promise.all([
      approvalsApi.getRequest(id),
      approvalsApi.listActions(id),
    ]);
    setSelected(req.data);
    setActions(acts.data);
    void load();
  }, [load]);

  const doReassign = useCallback(async () => {
    if (!selected || !reassignTo.trim()) return;
    setThreadBusy(true);
    try {
      await approvalsApi.reassign(selected.id, {
        actor_id: resolveActor(selected), to: reassignTo.trim(), comment: comment.trim() || undefined,
      });
      toast.success(tr('reassignSuccess', 'Handed to {{to}}', { to: reassignTo.trim() }));
      setReassignOpen(false);
      setReassignTo('');
      setComment('');
      await refreshThread(selected.id);
      refreshBadge();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setThreadBusy(false);
    }
  }, [selected, reassignTo, comment, resolveActor, refreshThread, refreshBadge, humanizeError, tr]);

  const doRemind = useCallback(async () => {
    if (!selected) return;
    setThreadBusy(true);
    try {
      const res = await approvalsApi.remind(selected.id, { actor_id: user?.id });
      toast.success(tr('remindSuccess', 'Reminder sent to {{count}} approver(s)', { count: res.notified }));
      await refreshThread(selected.id);
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setThreadBusy(false);
    }
  }, [selected, user?.id, refreshThread, humanizeError, tr]);

  const doRequestInfo = useCallback(async () => {
    if (!selected || !requestInfoText.trim()) return;
    setThreadBusy(true);
    try {
      await approvalsApi.requestInfo(selected.id, {
        actor_id: resolveActor(selected), comment: requestInfoText.trim(),
      });
      toast.success(tr('requestInfoSent', 'Sent back to the requester for more information'));
      setRequestInfoOpen(false);
      setRequestInfoText('');
      await refreshThread(selected.id);
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setThreadBusy(false);
    }
  }, [selected, requestInfoText, resolveActor, refreshThread, humanizeError, tr]);

  /**
   * Send back for revision (ADR-0044): finalizes this round as `returned`,
   * unlocks the record, and parks the flow until the submitter resubmits.
   * Past the node's revision budget the server auto-rejects instead.
   */
  const doSendBack = useCallback(async () => {
    if (!selected) return;
    setThreadBusy(true);
    try {
      const res = await approvalsApi.sendBack(selected.id, {
        actor_id: resolveActor(selected), comment: sendBackText.trim() || undefined,
      });
      toast.success(res.autoRejected
        ? tr('sendBackAutoRejected', 'Revision limit reached — the request was auto-rejected')
        : tr('sendBackSuccess', 'Sent back for revision — the requester can now edit and resubmit'));
      setSendBackOpen(false);
      setSendBackText('');
      await refreshThread(selected.id);
      refreshBadge();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setThreadBusy(false);
    }
  }, [selected, sendBackText, resolveActor, refreshThread, refreshBadge, humanizeError, tr]);

  /**
   * Resubmit after rework (ADR-0044, submitter): the flow re-enters the
   * approval node and opens the next round's request.
   */
  const doResubmit = useCallback(async () => {
    if (!selected) return;
    setResubmitting(true);
    try {
      await approvalsApi.resubmit(selected.id, {
        actor_id: user?.id, comment: comment.trim() || undefined,
      });
      toast.success(tr('resubmitSuccess', 'Resubmitted — a new approval round has opened'));
      setComment('');
      await refreshThread(selected.id);
      refreshBadge();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setResubmitting(false);
    }
  }, [selected, comment, user?.id, refreshThread, refreshBadge, humanizeError, tr]);

  const doReply = useCallback(async () => {
    if (!selected || !reply.trim()) return;
    setThreadBusy(true);
    try {
      await approvalsApi.comment(selected.id, { actor_id: user?.id, comment: reply.trim() });
      setReply('');
      await refreshThread(selected.id);
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setThreadBusy(false);
    }
  }, [selected, reply, user?.id, refreshThread, humanizeError, tr]);

  /** Lazy user directory for the reassign picker (name + email datalist). */
  const loadUserOptions = useCallback(async () => {
    if (userOptions.length) return;
    try {
      const base = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
      const res = await fetch(`${base}/api/v1/data/sys_user?limit=100`, { credentials: 'include' });
      const j = await res.json();
      setUserOptions(((j.records || []) as any[])
        .filter(u => u.email && u.name && u.id !== user?.id)
        .map(u => ({ name: String(u.name), email: String(u.email) })));
    } catch { /* picker degrades to free text */ }
  }, [userOptions.length, user?.id]);

  const canApproveReject = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    const pending = new Set(selected.pending_approvers || []);
    return identities.some(id => pending.has(id)) || actorOverride.trim().length > 0;
  }, [selected, identities, actorOverride]);

  const canRecall = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    return selected.submitter_id === user?.id || actorOverride.trim().length > 0;
  }, [selected, user?.id, actorOverride]);

  /** ADR-0044: the submitter may resubmit (or abandon) a returned request. */
  const canResubmit = useMemo(() => {
    if (!selected || selected.status !== 'returned') return false;
    return selected.submitter_id === user?.id || actorOverride.trim().length > 0;
  }, [selected, user?.id, actorOverride]);


  /** Unique process labels present in current rows (for filter dropdown). */
  const processOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(processLabel(r));
    return Array.from(set).sort();
  }, [rows]);

  /** Unique object names present in current rows (for filter dropdown). */
  const objectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.object_name) set.add(r.object_name);
    return Array.from(set).sort();
  }, [rows]);

  /** Client-side filtered rows shown in table. */
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      if (processFilter !== 'all' && processLabel(r) !== processFilter) return false;
      if (objectFilter !== 'all' && r.object_name !== objectFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      // Paginated tabs: the server already applied the free-text query
      // (incl. record titles via the payload snapshot) — re-filtering here
      // against a narrower client haystack would drop valid matches.
      if (tab !== 'pending') return true;
      if (!q) return true;
      const hay = [
        r.process_name, r.process_label, r.step_label, r.object_name,
        r.record_id, r.record_title, r.submitter_id, r.submitter_name,
        ...(r.pending_approvers || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, processFilter, objectFilter, statusFilter, tab]);
  /** Position of the open request within the visible list (drawer prev/next). */
  const drawerIndex = useMemo(
    () => (selectedId ? filteredRows.findIndex(r => r.id === selectedId) : -1),
    [filteredRows, selectedId],
  );

  // Reset selection when underlying filtered list changes (avoid acting on hidden rows).
  useEffect(() => {
    if (selectedRowIds.size === 0) return;
    const visible = new Set(filteredRows.map(r => r.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of selectedRowIds) {
      if (visible.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setSelectedRowIds(next);
  }, [filteredRows, selectedRowIds]);

  // Clamp keyboard focus to the visible list.
  useEffect(() => {
    if (focusIndex >= filteredRows.length) setFocusIndex(filteredRows.length - 1);
  }, [filteredRows.length, focusIndex]);

  const isActionable = useCallback((r: ApprovalRequestRow): boolean => {
    if (r.status !== 'pending') return false;
    const idSet = new Set(identities);
    return (r.pending_approvers || []).some(a => idSet.has(a));
  }, [identities]);

  /**
   * Rows the user is actually allowed to bulk-act on:
   * status=pending AND one of the user's identities is in pending_approvers.
   */
  const actionableSelectedRows = useMemo(
    () => filteredRows.filter(r => selectedRowIds.has(r.id) && isActionable(r)),
    [filteredRows, selectedRowIds, isActionable],
  );

  const allFilteredSelectable = filteredRows.filter(r => r.status === 'pending');
  const allSelected =
    allFilteredSelectable.length > 0 &&
    allFilteredSelectable.every(r => selectedRowIds.has(r.id));

  const toggleAll = useCallback(() => {
    setSelectedRowIds(prev => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const r of allFilteredSelectable) next.add(r.id);
      return next;
    });
  }, [allSelected, allFilteredSelectable]);

  const toggleRow = useCallback((id: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /**
   * Bulk approve / reject the actionable selection. Runs sequentially for
   * clear progress; failures are reported per record, not just as a count.
   */
  const runBulk = useCallback(async (kind: 'approve' | 'reject') => {
    const targets = actionableSelectedRows;
    if (targets.length === 0) return;
    setBulkRunning(true);
    let ok = 0;
    const failures: string[] = [];
    for (const r of targets) {
      const pending = new Set(r.pending_approvers || []);
      const actor = identities.find(i => pending.has(i)) || user?.id || '';
      try {
        const fn = kind === 'approve' ? approvalsApi.approve : approvalsApi.reject;
        await fn(r.id, { actor_id: actor });
        ok++;
      } catch {
        failures.push(r.record_title || formatIdentity(r.record_id));
      }
    }
    setBulkRunning(false);
    setSelectedRowIds(new Set());
    if (failures.length === 0) {
      toast.success(kind === 'approve'
        ? tr('bulkApproved', 'Approved {{count}} requests', { count: ok })
        : tr('bulkRejected', 'Rejected {{count}} requests', { count: ok }));
    } else {
      const shown = failures.slice(0, 3).join(', ');
      toast.error(tr('bulkPartial', '{{ok}} succeeded, {{fail}} failed: {{which}}', {
        ok, fail: failures.length, which: shown + (failures.length > 3 ? '…' : ''),
      }));
    }
    void load();
    refreshBadge();
  }, [actionableSelectedRows, identities, user?.id, load, refreshBadge, tr]);

  /** Row-level quick approve (hover button / `a` key). */
  const inlineApprove = useCallback(async (r: ApprovalRequestRow) => {
    if (!isActionable(r) || inlineActing) return;
    const pending = new Set(r.pending_approvers || []);
    const actor = identities.find(i => pending.has(i)) || user?.id || '';
    setInlineActing(r.id);
    try {
      const res = await approvalsApi.approve(r.id, { actor_id: actor });
      toast.success(res.finalized
        ? tr('inlineApproved', 'Approved "{{title}}"', { title: r.record_title || formatIdentity(r.record_id) })
        : tr('approvedWaiting', 'Approved — waiting on the remaining approvers'));
      void load();
      refreshBadge();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setInlineActing(null);
    }
  }, [isActionable, inlineActing, identities, user?.id, load, refreshBadge, humanizeError, tr]);

  /** Confirmed row-level reject (from the shared dialog). */
  const inlineReject = useCallback(async () => {
    const r = rejectTarget;
    if (!r) return;
    const pending = new Set(r.pending_approvers || []);
    const actor = identities.find(i => pending.has(i)) || user?.id || '';
    setInlineActing(r.id);
    setRejectTarget(null);
    try {
      await approvalsApi.reject(r.id, { actor_id: actor });
      toast.success(tr('inlineRejected', 'Rejected "{{title}}"', { title: r.record_title || formatIdentity(r.record_id) }));
      void load();
      refreshBadge();
    } catch (err: any) {
      toast.error(humanizeError(err, tr('actionFailed', 'Action failed')));
    } finally {
      setInlineActing(null);
    }
  }, [rejectTarget, identities, user?.id, load, refreshBadge, humanizeError, tr]);

  // ── Keyboard flow: j/k move · Enter open · x select · a approve · r reject ──
  const filteredRef = useRef(filteredRows);
  filteredRef.current = filteredRows;
  const focusRef = useRef(focusIndex);
  focusRef.current = focusIndex;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedId || rejectTarget) return; // a sheet/dialog owns the keyboard
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      const list = filteredRef.current;
      if (!list.length) return;
      const idx = focusRef.current;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIndex(Math.min(idx + 1, list.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIndex(Math.max(idx - 1, 0));
      } else if (e.key === 'Enter' && idx >= 0 && list[idx]) {
        e.preventDefault();
        void openDrawer(list[idx].id);
      } else if ((e.key === 'x' || e.key === ' ') && idx >= 0 && list[idx] && tab === 'pending') {
        e.preventDefault();
        toggleRow(list[idx].id);
      } else if (e.key === 'a' && idx >= 0 && list[idx]) {
        e.preventDefault();
        void inlineApprove(list[idx]);
      } else if (e.key === 'r' && idx >= 0 && list[idx] && isActionable(list[idx])) {
        e.preventDefault();
        setRejectTarget(list[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, rejectTarget, tab, openDrawer, toggleRow, inlineApprove, isActionable]);

  // Drawer keyboard: ←/→ walk the visible list without going back to it.
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (document.querySelector('[role="alertdialog"]')) return;
      const list = filteredRef.current;
      const idx = list.findIndex(r => r.id === selectedId);
      if (idx < 0) return;
      const target = e.key === 'ArrowLeft' ? list[idx - 1] : list[idx + 1];
      if (target) { e.preventDefault(); void openDrawer(target.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, openDrawer]);

  const hasFilters = !!query || processFilter !== 'all' || objectFilter !== 'all' || statusFilter !== 'all';

  const onTabChange = (v: string) => {
    setTab(v as TabKey);
    setStatusFilter('all');
    setProcessFilter('all');
    setObjectFilter('all');
    setQuery('');
    setFocusIndex(-1);
  };

  // ── Shared row fragments ─────────────────────────────────────────

  function RequestCell({ r }: { r: ApprovalRequestRow }) {
    return (
      <div className="min-w-0">
        <div className="font-medium truncate">{processLabel(r)}</div>
        <div className="text-xs text-muted-foreground truncate">
          {stepLabel(r) || '—'}
          {(r.round ?? 1) > 1 && (
            <span className="ml-1.5 text-violet-600 dark:text-violet-400">
              {tr('roundChip', 'Round {{n}}', { n: r.round })}
            </span>
          )}
        </div>
      </div>
    );
  }

  function RecordCell({ r }: { r: ApprovalRequestRow }) {
    return (
      <div className="min-w-0">
        <Link
          to={recordHref(r)}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-sm hover:underline truncate max-w-full"
          title={r.record_id}
        >
          <span className="truncate">{r.record_title || formatIdentity(r.record_id)}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Link>
        <div className="text-xs text-muted-foreground truncate">{objectDisplay(r)}</div>
      </div>
    );
  }

  function InlineActions({ r }: { r: ApprovalRequestRow }) {
    if (!isActionable(r)) return null;
    const busy = inlineActing === r.id;
    return (
      <div
        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400"
          disabled={busy}
          onClick={() => void inlineApprove(r)}
          aria-label={tr('approve', 'Approve')}
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400"
          disabled={busy}
          onClick={() => setRejectTarget(r)}
          aria-label={tr('reject', 'Reject')}
        >
          <XCircle className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 max-w-6xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <CheckSquare className="h-6 w-6" />
            {tr('title', 'Approvals Inbox')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {tr('subtitle', 'Review and act on approval requests.')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="self-start sm:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {tr('refresh', 'Refresh')}
        </Button>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="pending">
            {tr('tabMyPending', 'My Pending')}
            {myPendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">{myPendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="submitted">{tr('tabSubmitted', 'Submitted by me')}</TabsTrigger>
          <TabsTrigger value="all">{tr('tabAll', 'All')}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {/* Toolbar: search + filters */}
          {!loading && (rows.length > 0 || (tab !== 'pending' && (serverQuery || statusFilter !== 'all'))) && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr('searchPlaceholder', 'Search record, process, requester…')}
                  className="pl-8 h-8 text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={tr('clearSearch', 'Clear search')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {tab !== 'pending' && (
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[130px] text-sm">
                    <SelectValue placeholder={tr('statusFilter', 'Status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr('allStatuses', 'All statuses')}</SelectItem>
                    <SelectItem value="pending">{statusLabel('pending')}</SelectItem>
                    <SelectItem value="approved">{statusLabel('approved')}</SelectItem>
                    <SelectItem value="rejected">{statusLabel('rejected')}</SelectItem>
                    <SelectItem value="recalled">{statusLabel('recalled')}</SelectItem>
                    <SelectItem value="returned">{statusLabel('returned')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {processOptions.length > 1 && (
                <Select value={processFilter} onValueChange={setProcessFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm">
                    <SelectValue placeholder={tr('processFilter', 'Process')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr('allProcesses', 'All processes')}</SelectItem>
                    {processOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {objectOptions.length > 1 && (
                <Select value={objectFilter} onValueChange={setObjectFilter}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] text-sm">
                    <SelectValue placeholder={tr('objectFilter', 'Object')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr('allObjects', 'All objects')}</SelectItem>
                    {objectOptions.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {hasFilters && (
                <span className="text-xs text-muted-foreground">
                  {tr('filterCount', '{{shown}} of {{total}}', { shown: filteredRows.length, total: rows.length })}
                </span>
              )}
            </div>
          )}

          {/* Bulk action bar (visible when ≥1 row selected on pending tab) */}
          {tab === 'pending' && selectedRowIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border bg-accent/30 text-sm">
              <span>
                <strong>{selectedRowIds.size}</strong> {tr('selected', 'selected')}
                {actionableSelectedRows.length !== selectedRowIds.size && (
                  <span className="text-muted-foreground ml-1">
                    {tr('actionableCount', '({{count}} actionable)', { count: actionableSelectedRows.length })}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={bulkRunning || actionableSelectedRows.length === 0}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      {tr('approveN', 'Approve {{count}}', { count: actionableSelectedRows.length || '' })}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {tr('bulkApproveTitle', 'Approve {{count}} requests?', { count: actionableSelectedRows.length })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {tr('bulkApproveBody', 'Each request is approved with your identity and its flow continues down the approve branch.')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => runBulk('approve')}>
                        {tr('approveN', 'Approve {{count}}', { count: actionableSelectedRows.length })}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={bulkRunning || actionableSelectedRows.length === 0}
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      {tr('rejectN', 'Reject {{count}}', { count: actionableSelectedRows.length || '' })}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {tr('bulkRejectTitle', 'Reject {{count}} requests?', { count: actionableSelectedRows.length })}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {tr('bulkRejectBody', 'This rejects the selected requests and notifies their submitters.')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => runBulk('reject')}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {tr('rejectN', 'Reject {{count}}', { count: actionableSelectedRows.length })}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedRowIds(new Set())}
                  disabled={bulkRunning}
                >
                  {tr('clear', 'Clear')}
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center min-h-[240px] rounded-md border border-dashed">
              <Empty>
                <EmptyTitle>{tr('emptyTitle', 'No requests')}</EmptyTitle>
                <EmptyDescription>
                  {tab === 'pending'
                    ? tr('emptyPending', "You're all caught up — nothing is waiting on you.")
                    : tr('emptyOther', 'Nothing here yet.')}
                </EmptyDescription>
                {tab === 'pending' && (
                  <Button variant="link" size="sm" className="mt-1" onClick={() => onTabChange('all')}>
                    {tr('emptyViewAll', 'Browse all requests')}
                  </Button>
                )}
              </Empty>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex items-center justify-center min-h-[160px] rounded-md border border-dashed text-sm text-muted-foreground">
              {tr('noMatches', 'No matches for current filters.')}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <Card className="hidden md:block">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {tab === 'pending' && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={toggleAll}
                              aria-label={tr('selectAll', 'Select all')}
                              disabled={allFilteredSelectable.length === 0}
                            />
                          </TableHead>
                        )}
                        <TableHead>{tr('colRequest', 'Request')}</TableHead>
                        <TableHead>{tr('colRecord', 'Record')}</TableHead>
                        <TableHead>{tr('colRequester', 'Requester')}</TableHead>
                        <TableHead>{tr('colStatus', 'Status')}</TableHead>
                        <TableHead>{tr('colWaiting', 'Submitted')}</TableHead>
                        <TableHead className="w-20" aria-label={tr('colActions', 'Actions')} />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r, i) => (
                        <TableRow
                          key={r.id}
                          className={cn(
                            'group cursor-pointer hover:bg-accent/50',
                            focusIndex === i && 'ring-2 ring-inset ring-ring bg-accent/30',
                          )}
                          onClick={() => { setFocusIndex(i); void openDrawer(r.id); }}
                        >
                          {tab === 'pending' && (
                            <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedRowIds.has(r.id)}
                                onCheckedChange={() => toggleRow(r.id)}
                                disabled={r.status !== 'pending'}
                                aria-label={tr('selectRow', 'Select request')}
                              />
                            </TableCell>
                          )}
                          <TableCell><RequestCell r={r} /></TableCell>
                          <TableCell><RecordCell r={r} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate" title={r.submitter_id || ''}>{submitterDisplay(r)}</span>
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell
                            className={cn('text-xs whitespace-nowrap', agingClass(r))}
                            title={formatDate(submittedAt(r))}
                          >
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatRelative(submittedAt(r))}
                            {r.status === 'pending' && r.sla_due_at && (
                              <div className={cn(
                                'mt-0.5 text-[10px] font-medium',
                                Date.parse(r.sla_due_at) < Date.now() ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                              )}>
                                {Date.parse(r.sla_due_at) < Date.now()
                                  ? tr('slaOverdue', 'SLA overdue {{dur}}', { dur: compactDuration(Date.now() - Date.parse(r.sla_due_at)) })
                                  : tr('slaRemaining', 'SLA {{dur}} left', { dur: compactDuration(Date.parse(r.sla_due_at) - Date.now()) })}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="w-20"><InlineActions r={r} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filteredRows.map((r) => (
                  <Card key={r.id} className="cursor-pointer active:bg-accent/50" onClick={() => void openDrawer(r.id)}>
                    <CardContent className="p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-sm truncate">{processLabel(r)}</div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-sm truncate">
                        {r.record_title || formatIdentity(r.record_id)}
                        <span className="text-muted-foreground text-xs ml-1.5">{objectDisplay(r)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 truncate">
                          <UserIcon className="h-3 w-3" />{submitterDisplay(r)}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', agingClass(r))}>
                          <Clock className="h-3 w-3" />{formatRelative(submittedAt(r))}
                        </span>
                      </div>
                      {isActionable(r) && (
                        <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" className="h-7 flex-1" disabled={inlineActing === r.id} onClick={() => void inlineApprove(r)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{tr('approve', 'Approve')}
                          </Button>
                          <Button
                            size="sm" variant="outline" className="h-7 flex-1 border-destructive text-destructive"
                            disabled={inlineActing === r.id} onClick={() => setRejectTarget(r)}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />{tr('reject', 'Reject')}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {tab !== 'pending' && total != null && (
                <div className="flex items-center justify-center gap-3 py-1">
                  <span className="text-xs text-muted-foreground">
                    {tr('loadedOf', 'Loaded {{loaded}} of {{total}}', { loaded: rows.length, total })}
                  </span>
                  {rows.length < total && (
                    <Button size="sm" variant="outline" disabled={loadingMore} onClick={() => void loadMore()}>
                      {loadingMore ? tr('loadingMore', 'Loading…') : tr('loadMore', 'Load more')}
                    </Button>
                  )}
                </div>
              )}

              <div className="hidden md:block text-[11px] text-muted-foreground">
                {tr('keyboardHint', 'Keyboard: j/k move · Enter open · x select · a approve · r reject')}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Reassign dialog */}
      <AlertDialog open={reassignOpen} onOpenChange={(open) => { if (!open) { setReassignOpen(false); setReassignTo(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('reassignTitle', 'Hand this approval to someone else?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('reassignBody', 'Your approver slot moves to the person you pick — they are notified and can act immediately.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="reassign-to" className="text-xs">{tr('reassignTo', 'New approver')}</Label>
            <Input
              id="reassign-to"
              list="reassign-user-options"
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              placeholder={tr('reassignToPlaceholder', 'Pick a user or type an email / role:<name>')}
              className="mt-1"
            />
            <datalist id="reassign-user-options">
              {userOptions.map(u => (
                <option key={u.email} value={u.email}>{u.name}</option>
              ))}
            </datalist>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={!reassignTo.trim() || threadBusy} onClick={() => void doReassign()}>
              {tr('reassignBtn', 'Reassign')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request-info dialog */}
      <AlertDialog open={requestInfoOpen} onOpenChange={(open) => { if (!open) { setRequestInfoOpen(false); setRequestInfoText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('requestInfoTitle', 'Ask the requester for more information?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('requestInfoBody', 'The request stays pending; the requester is notified and can reply on the thread.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={requestInfoText}
            onChange={(e) => setRequestInfoText(e.target.value)}
            rows={3}
            placeholder={tr('requestInfoPlaceholder', 'What do you need from the requester?')}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={!requestInfoText.trim() || threadBusy} onClick={() => void doRequestInfo()}>
              {tr('requestInfoBtn', 'Request info')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send back for revision dialog (ADR-0044) */}
      <AlertDialog open={sendBackOpen} onOpenChange={(open) => { if (!open) { setSendBackOpen(false); setSendBackText(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr('sendBackTitle', 'Send this request back for revision?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tr('sendBackBody', 'This round ends and the record unlocks so the requester can fix the data. When they resubmit, a fresh approval round opens for all approvers.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={sendBackText}
            onChange={(e) => setSendBackText(e.target.value)}
            rows={3}
            placeholder={tr('sendBackPlaceholder', 'What needs to be fixed before this can be approved?')}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={threadBusy} onClick={() => void doSendBack()}>
              {tr('sendBackBtn', 'Send back')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shared inline-reject confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr('rejectOneTitle', 'Reject "{{title}}"?', {
                title: rejectTarget ? (rejectTarget.record_title || formatIdentity(rejectTarget.record_id)) : '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr('rejectOneBody', 'This rejects the request and notifies the submitter.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void inlineReject()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tr('reject', 'Reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!selectedId} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selected ? processLabel(selected) : tr('drawerTitle', 'Approval Request')}
            </SheetTitle>
            <SheetDescription>
              {selected ? (stepLabel(selected) || objectDisplay(selected)) : ''}
            </SheetDescription>
          </SheetHeader>

          {selected && drawerIndex >= 0 && filteredRows.length > 1 && (
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <Button
                variant="ghost" size="sm" className="h-7 px-2"
                disabled={drawerIndex <= 0}
                onClick={() => { const prev = filteredRows[drawerIndex - 1]; if (prev) void openDrawer(prev.id); }}
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" />
                {tr('prevRequest', 'Previous')}
              </Button>
              <span>{tr('positionOf', '{{index}} of {{total}}', { index: drawerIndex + 1, total: filteredRows.length })}</span>
              <Button
                variant="ghost" size="sm" className="h-7 px-2"
                disabled={drawerIndex >= filteredRows.length - 1}
                onClick={() => { const next = filteredRows[drawerIndex + 1]; if (next) void openDrawer(next.id); }}
              >
                {tr('nextRequest', 'Next')}
                <ChevronRight className="h-4 w-4 ml-0.5" />
              </Button>
            </div>
          )}

          {drawerLoading ? (
            <div className="space-y-2 mt-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : selected ? (
            <div className="space-y-4 mt-6">
              {/* Status strip */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={selected.status} />
                {(selected.round ?? 1) > 1 && (
                  <Badge variant="outline" className="text-[10px] border-violet-200 text-violet-700 dark:border-violet-500/30 dark:text-violet-400">
                    {tr('roundChip', 'Round {{n}}', { n: selected.round })}
                  </Badge>
                )}
                <span className="inline-flex items-center gap-1" title={formatDate(submittedAt(selected))}>
                  <Clock className="h-3 w-3" />
                  {tr('submittedAgo', 'Submitted {{when}}', { when: formatRelative(submittedAt(selected)) })}
                </span>
                {selected.completed_at && (
                  <span>· {tr('completedAt', 'Completed {{when}}', { when: formatRelative(selected.completed_at) })}</span>
                )}
                {selected.status === 'pending' && selected.sla_due_at && (
                  <Badge variant="outline" className={cn(
                    'text-[10px]',
                    Date.parse(selected.sla_due_at) < Date.now()
                      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                      : 'border-border text-muted-foreground',
                  )}>
                    {Date.parse(selected.sla_due_at) < Date.now()
                      ? tr('slaOverdue', 'SLA overdue {{dur}}', { dur: compactDuration(Date.now() - Date.parse(selected.sla_due_at)) })
                      : tr('slaRemaining', 'SLA {{dur}} left', { dur: compactDuration(Date.parse(selected.sla_due_at) - Date.now()) })}
                  </Badge>
                )}
              </div>

              {/* Business summary card */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={recordHref(selected)}
                        className="text-base font-semibold hover:underline inline-flex items-center gap-1.5"
                      >
                        <span className="truncate">{selected.record_title || formatIdentity(selected.record_id)}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                      <div className="text-xs text-muted-foreground">{objectDisplay(selected)}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div className="inline-flex items-center gap-1">
                        <UserIcon className="h-3 w-3" />
                        <span title={selected.submitter_id || ''}>{submitterDisplay(selected)}</span>
                      </div>
                    </div>
                  </div>
                  {payloadSummary(selected.payload, selected.payload_display).length > 0 && (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm border-t pt-3">
                      {payloadSummary(selected.payload, selected.payload_display).map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <div className="text-[11px] text-muted-foreground">{k}</div>
                          <div className="truncate" title={v}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Aggregation progress (#3266): server-computed — "2 of 3
                      approved" for quorum/unanimous, per-group ticks for 会签. */}
                  {selected.decision_progress && (
                    <div className="border-t pt-3">
                      <div className="text-[11px] text-muted-foreground mb-1">
                        {selected.decision_progress.behavior === 'per_group'
                          ? tr('progressGroups', 'Sign-off progress — {{got}} of {{need}} groups', {
                              got: selected.decision_progress.got, need: selected.decision_progress.need,
                            })
                          : tr('progressApprovals', 'Approvals — {{got}} of {{need}}', {
                              got: selected.decision_progress.got, need: selected.decision_progress.need,
                            })}
                      </div>
                      {selected.decision_progress.groups && (
                        <div className="flex flex-wrap gap-1">
                          {selected.decision_progress.groups.map((g) => (
                            <Badge
                              key={g.group}
                              variant="outline"
                              className={cn(
                                'text-[11px] gap-1',
                                g.satisfied
                                  ? 'border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400'
                                  : 'text-muted-foreground',
                              )}
                              title={`${g.got}/${g.need}`}
                            >
                              {g.satisfied ? <Check className="h-3 w-3" /> : null}
                              {g.group} {g.got}/{g.need}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {selected.status === 'pending' && (selected.pending_approvers || []).length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-[11px] text-muted-foreground mb-1">
                        {tr('waitingOn', 'Waiting on')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(selected.pending_approvers || []).map((a, i) => (
                          <Badge key={i} variant="outline" className="text-[11px]" title={a}>
                            {approverDisplay(a, selected)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(selected.flow_steps?.length ?? 0) > 1 && (
                <div className="flex items-center px-1" aria-label={tr('stepProgress', 'Approval steps')}>
                  {selected.flow_steps!.map((s, i) => (
                    <Fragment key={s.id}>
                      {i > 0 && <div className={cn('h-px flex-1 mx-2', s.state === 'done' || s.state === 'current' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border')} />}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn(
                          'flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-semibold',
                          s.state === 'done' && 'bg-emerald-500 text-white',
                          s.state === 'current' && 'bg-amber-500 text-white ring-2 ring-amber-200 dark:ring-amber-500/30',
                          s.state === 'upcoming' && 'bg-muted text-muted-foreground border',
                        )}>
                          {s.state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
                        </span>
                        <span className={cn(
                          'text-xs',
                          s.state === 'current' ? 'font-medium' : 'text-muted-foreground',
                        )}>{s.label}</span>
                      </div>
                    </Fragment>
                  ))}
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-3">{tr('history', 'Activity')}</h3>
                {actions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{tr('noActions', 'No actions yet.')}</div>
                ) : (
                  <ol className="relative space-y-3 pl-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
                    {actions.map((a) => {
                      const color = a.action === 'approve' ? 'bg-emerald-500'
                                  : a.action === 'reject'  ? 'bg-destructive'
                                  : a.action === 'submit'  ? 'bg-blue-500'
                                  : a.action === 'reassign' ? 'bg-indigo-500'
                                  : a.action === 'remind' ? 'bg-amber-500'
                                  : a.action === 'request_info' ? 'bg-amber-500'
                                  : a.action === 'comment' ? 'bg-slate-400'
                                  : a.action === 'escalate' ? 'bg-red-500'
                                  : a.action === 'revise' ? 'bg-violet-500'
                                  : a.action === 'resubmit' ? 'bg-blue-500'
                                  : 'bg-muted-foreground';
                      const actorName = a.actor_id === 'system:sla'
                        ? tr('systemSlaActor', 'System (SLA)')
                        : a.actor_name
                          ?? (a.actor_id && a.actor_id === selected.submitter_id
                            ? submitterDisplay(selected)
                            : formatIdentity(a.actor_id));
                      const actionText = a.action === 'submit' ? tr('actSubmit', 'Submitted')
                        : a.action === 'approve' ? tr('actApprove', 'Approved')
                        : a.action === 'reject' ? tr('actReject', 'Rejected')
                        : a.action === 'recall' ? tr('actRecall', 'Recalled')
                        : a.action === 'reassign' ? tr('actReassign', 'Reassigned')
                        : a.action === 'remind' ? tr('actRemind', 'Reminder sent')
                        : a.action === 'request_info' ? tr('actRequestInfo', 'Requested more info')
                        : a.action === 'comment' ? tr('actComment', 'Commented')
                        : a.action === 'escalate' ? tr('actEscalate', 'SLA escalated')
                        : a.action === 'revise' ? tr('actRevise', 'Sent back for revision')
                        : a.action === 'resubmit' ? tr('actResubmit', 'Resubmitted')
                        : a.action;
                      return (
                        <li key={a.id} className="relative text-xs">
                          <span
                            className={`absolute -left-[18px] top-1 h-3 w-3 rounded-full ring-2 ring-background ${color}`}
                            aria-hidden
                          />
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="font-medium">{actionText}</span>
                            <span className="text-muted-foreground">·</span>
                            <span title={a.actor_id || ''}>{actorName}</span>
                            <span
                              className="ml-auto text-muted-foreground text-[10px]"
                              title={formatDate(a.created_at)}
                            >
                              {formatRelative(a.created_at)}
                            </span>
                          </div>
                          {a.comment && (
                            <div className="text-muted-foreground italic mt-0.5">"{a.comment}"</div>
                          )}
                          {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {a.attachments.map((fileId, i) => (
                                <button
                                  key={fileId}
                                  type="button"
                                  onClick={() => void openAttachment(fileId)}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                  title={fileId}
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {attachmentNames[fileId]
                                    || `${tr('attachmentChip', 'Attachment')}${a.attachments!.length > 1 ? ` ${i + 1}` : ''}`}
                                </button>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {selected.status === 'pending' && (canApproveReject || canRecall) && (
                  <div className="flex items-center gap-2 mt-3">
                    <Input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && reply.trim()) { e.preventDefault(); void doReply(); } }}
                      placeholder={tr('replyPlaceholder', 'Reply on this request…')}
                      className="h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" className="h-8 px-2 shrink-0" disabled={!reply.trim() || threadBusy} onClick={() => void doReply()}>
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Raw snapshot, collapsed by default — for debugging, not the read path */}
              {selected.payload != null && (
                <details className="group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                    {tr('rawData', 'Raw data (JSON)')}
                  </summary>
                  <div className="mt-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(JSON.stringify(selected.payload, null, 2));
                            toast.success(tr('copied', 'Copied'));
                          } catch {
                            toast.error(tr('copyFailed', 'Copy failed'));
                          }
                        }}
                        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <Copy className="h-3 w-3" />
                        {tr('copy', 'Copy')}
                      </button>
                    </div>
                    <pre className="text-[11px] bg-muted/50 rounded p-2 overflow-auto max-h-48 mt-1">
                      {JSON.stringify(selected.payload, null, 2)}
                    </pre>
                  </div>
                </details>
              )}

              {selected.status === 'pending' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    {isAdmin && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                          {tr('overrideActor', 'Act as another identity (admin)')}
                        </summary>
                        <div className="mt-2">
                          <Label htmlFor="actor-override" className="text-xs">
                            {tr('actor', 'Actor')}
                          </Label>
                          <input
                            id="actor-override"
                            type="text"
                            value={actorOverride}
                            onChange={(e) => setActorOverride(e.target.value)}
                            placeholder={`${tr('auto', 'Auto')}: ${resolveActor(selected) || '—'}`}
                            className="w-full mt-1 px-3 py-2 text-sm border rounded-md bg-background"
                          />
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {tr('overrideHint', 'e.g. role:sales_manager. Leave blank to use the auto-detected identity.')}
                          </div>
                        </div>
                      </details>
                    )}
                    <div>
                      <Label htmlFor="comment" className="text-xs">{tr('comment', 'Comment (optional)')}</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {[
                          tr('quickPhrase1', 'Approved — meets requirements.'),
                          tr('quickPhrase2', 'Approved with conditions — please monitor execution.'),
                          tr('quickPhrase3', 'Please add supporting material and resubmit.'),
                        ].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setComment(p)}
                            className="text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        className="mt-1"
                      />
                      {/* Decision attachments (#3266) — staged files ride the next approve/reject. */}
                      <CommentAttachment
                        className="mt-2"
                        attachments={pendingAttachments}
                        onUpload={handleAttachmentUpload}
                        onRemove={handleAttachmentRemove}
                      />
                      {attachmentError && (
                        <div className="text-xs text-destructive mt-1">{attachmentError}</div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => doAction('approve')}
                        disabled={!canApproveReject || submitting !== null}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {submitting === 'approve' ? tr('approving', 'Approving…') : tr('approve', 'Approve')}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canApproveReject || submitting !== null}
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {submitting === 'reject' ? tr('rejecting', 'Rejecting…') : tr('reject', 'Reject')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{tr('rejectTitle', 'Reject this request?')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {tr('rejectBody', 'This marks the request as rejected and notifies the submitter.')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => doAction('reject')}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {tr('reject', 'Reject')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {canApproveReject && (
                        <>
                          <Button
                            size="sm" variant="outline" disabled={submitting !== null || threadBusy}
                            className="border-violet-300 text-violet-700 hover:bg-violet-50 dark:text-violet-400"
                            onClick={() => setSendBackOpen(true)}
                          >
                            <CornerUpLeft className="h-4 w-4 mr-1" />
                            {tr('sendBackBtn', 'Send back')}
                          </Button>
                          <Button
                            size="sm" variant="outline" disabled={submitting !== null || threadBusy}
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:text-amber-400"
                            onClick={() => setRequestInfoOpen(true)}
                          >
                            <HelpCircle className="h-4 w-4 mr-1" />
                            {tr('requestInfoBtn', 'Request info')}
                          </Button>
                          <Button
                            size="sm" variant="outline" disabled={submitting !== null || threadBusy}
                            onClick={() => { void loadUserOptions(); setReassignOpen(true); }}
                          >
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            {tr('reassignBtn', 'Reassign')}
                          </Button>
                        </>
                      )}
                      {canRecall && (
                        <Button size="sm" variant="outline" disabled={threadBusy} onClick={() => void doRemind()}>
                          <BellRing className="h-4 w-4 mr-1" />
                          {tr('remindBtn', 'Send reminder')}
                        </Button>
                      )}
                      {canRecall && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" disabled={submitting !== null}>
                              <Undo2 className="h-4 w-4 mr-1" />
                              {submitting === 'recall' ? tr('recalling', 'Recalling…') : tr('recall', 'Recall')}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{tr('recallTitle', 'Recall this request?')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {tr('recallBody', 'This withdraws your request. Approvers can no longer act on it, and the record is unlocked.')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => doAction('recall')}>
                                {tr('recall', 'Recall')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    {!canApproveReject && (
                      <div className="text-xs text-muted-foreground">
                        {canRecall
                          ? tr('whyDisabledSubmitter', 'You submitted this request, so you can recall it — but only the assigned approvers can approve or reject.')
                          : tr('whyDisabled', 'Only the assigned approvers can act on this request. It is waiting on: {{who}}.', {
                              who: (selected.pending_approvers || []).map(a => approverDisplay(a, selected)).join(', ') || '—',
                            })}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ADR-0044 revision window: the request came back to the
                  submitter — the record is unlocked for rework; resubmitting
                  opens the next approval round, recalling abandons it. */}
              {canResubmit && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="text-xs text-muted-foreground">
                      {tr('returnedHint', 'An approver sent this back to you. The record is unlocked — fix the data, then resubmit to start a new approval round.')}
                    </div>
                    <div>
                      <Label htmlFor="resubmit-comment" className="text-xs">{tr('comment', 'Comment (optional)')}</Label>
                      <Textarea
                        id="resubmit-comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        className="mt-1"
                        placeholder={tr('resubmitPlaceholder', 'What did you change?')}
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button asChild size="sm" variant="outline">
                        <Link to={recordHref(selected)}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          {tr('editRecordBtn', 'Edit record')}
                        </Link>
                      </Button>
                      <Button size="sm" disabled={resubmitting} onClick={() => void doResubmit()}>
                        <RefreshCw className={cn('h-4 w-4 mr-1', resubmitting && 'animate-spin')} />
                        {resubmitting ? tr('resubmitting', 'Resubmitting…') : tr('resubmitBtn', 'Resubmit')}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={resubmitting}>
                            <Undo2 className="h-4 w-4 mr-1" />
                            {tr('recall', 'Recall')}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{tr('abandonTitle', 'Abandon this revision?')}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {tr('abandonBody', 'This withdraws the request instead of resubmitting it. The approval ends here.')}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => doAction('recall')}>
                              {tr('recall', 'Recall')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
