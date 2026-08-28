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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DeclaredActionsBar, isViaOverrideRow } from '@object-ui/app-shell';
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
import { useAuth } from '@object-ui/auth';
import { usePermissions } from '@object-ui/permissions';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckSquare,
  Search,
  ArrowUpDown,
  Copy,
  X,
  ExternalLink,
  User as UserIcon,
  Workflow,
  ChevronLeft,
  ChevronRight,
  Send,
  Check,
  Circle,
  Paperclip,
  ShieldAlert,
} from 'lucide-react';
import {
  approvalsApi,
  buildApproverIdentities,
  type ApprovalRequestRow,
  type ApprovalActionRow,
  type ApprovalActionAttachment,
} from '../../services/approvalsApi';
import { useRecordReadability } from './recordReadability';
import { useHiddenFieldsByObject } from './hiddenFields';
import { holdsStudioAccess } from '../../components/studioEntry';

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

/**
 * Status chip. Module scope on purpose: declared inside `ApprovalsInboxPage`
 * it was a brand-new component type on every render, so React unmounted and
 * remounted every badge in the table each time the page re-rendered
 * (`react-hooks/static-components`). The translated label is passed in
 * because `statusLabel` closes over the page's `t`.
 */
function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_CLASSES[status] ?? '')}>
      {label}
    </Badge>
  );
}

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
/** The group(s) a pending approver represents (会签), joined for display. */
function approverGroup(a: string, r: ApprovalRequestRow): string | undefined {
  const gs = r.pending_approver_groups?.[a];
  return gs && gs.length ? gs.join(' / ') : undefined;
}
/**
 * Collapse the pending-approver chips (#2762 P1-2), now keyed by (name, group)
 * so 会签 comprehension is preserved (objectui#2807): the same person filling
 * two *different* groups stays two labeled chips (finance / legal), while a
 * person filling one group twice collapses to a single chip with a count. When
 * no group data is present (non-`per_group`, or an older backend) the key is the
 * name alone, degrading to the plain dedupe + count. First-seen order is kept;
 * the tooltip keeps every underlying id so the raw slots stay inspectable.
 */
function approverChips(
  r: ApprovalRequestRow,
): Array<{ label: string; group?: string; count: number; title: string }> {
  const order: string[] = [];
  const byKey = new Map<string, { label: string; group?: string; count: number; title: string }>();
  for (const a of r.pending_approvers || []) {
    const label = approverDisplay(a, r);
    const group = approverGroup(a, r);
    const key = group ? `${label} ${group}` : label;
    const seen = byKey.get(key);
    if (seen) {
      seen.count += 1;
      if (a && !seen.title.split(', ').includes(a)) seen.title += `, ${a}`;
    } else {
      byKey.set(key, { label, group, count: 1, title: a || label });
      order.push(key);
    }
  }
  return order.map((k) => byKey.get(k)!);
}
/**
 * A request with no human submitter — flow- or system-initiated (#2762 P1-4).
 * These rows have an empty `submitter_id` or a synthetic `flow:` / `system:`
 * actor, and rendering a bare person icon + "—" reads as missing data.
 */
function isSystemSubmitter(r: ApprovalRequestRow): boolean {
  if (r.submitter_name) return false;
  const id = (r.submitter_id || '').trim();
  return !id || id.startsWith('flow:') || id.startsWith('system:');
}
/** Object subtitle: schema label when resolved, else the machine name. */
function objectDisplay(r: ApprovalRequestRow): string {
  return r.object_label || r.object_name;
}
function submittedAt(r: ApprovalRequestRow): string | undefined {
  return r.submitted_at || r.created_at || undefined;
}

/**
 * Hours a pending request has been waiting at instant `now`; null when no
 * timestamp. `now` is a parameter rather than a `Date.now()` read so callers
 * on the render path stay pure (`react-hooks/purity`) — see the `now` state in
 * {@link ApprovalsInboxPage}.
 */
function waitingHours(r: ApprovalRequestRow, now: number): number | null {
  const s = submittedAt(r);
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return (now - t) / 36e5;
}

/** Aging tint: quiet under a day, amber 1–3 days, red beyond 3 days. */
function agingClass(r: ApprovalRequestRow, now: number): string {
  if (r.status !== 'pending') return 'text-muted-foreground';
  const h = waitingHours(r, now);
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

/**
 * SLA position at instant `now`, or null when there is nothing to show — no
 * due date, or one the backend sent in a shape `Date.parse` can't read (which
 * previously rendered as "SLA NaNh left"). Takes `now` for the same purity
 * reason as {@link waitingHours}.
 */
function slaState(dueAt: string | null | undefined, now: number): { overdue: boolean; ms: number } | null {
  if (!dueAt) return null;
  const due = Date.parse(dueAt);
  if (Number.isNaN(due)) return null;
  return { overdue: due < now, ms: Math.abs(now - due) };
}

const PAYLOAD_SYSTEM_KEYS = new Set([
  'id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'organization_id',
]);

function prettifyKey(k: string): string {
  const tokens = k.split('_').filter(Boolean);
  // Drop a trailing `id` token so a resolved lookup key reads as its subject —
  // `owner_id` → "Owner", not the awkward "Owner Id" (#2762 P2). Keep at least
  // one token (a bare `id` is already dropped as a system key upstream).
  if (tokens.length > 1 && tokens[tokens.length - 1].toLowerCase() === 'id') tokens.pop();
  return tokens.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
 *
 * `hiddenKeys` carries the object's `hidden: true` declarations (objectui#5565)
 * and is dropped BEFORE the `max` cut, not after: this card is default UI, so a
 * field the author hid must not occupy one of its slots — and the field that
 * would have been seventh is promoted into the freed slot rather than the card
 * simply rendering one row shorter. That ordering is what makes this a filter
 * rather than a reshuffle; see `ApprovalsInboxPage.hiddenFieldTrim.test.tsx`,
 * which pins both halves.
 *
 * An empty `hiddenKeys` means "nothing known to be hidden" — including the case
 * where the metadata read has not answered — and renders today's card. See
 * `hiddenFields.ts` on why this presentation filter fails open.
 */
function payloadSummary(
  payload: unknown,
  display?: Record<string, string>,
  labels?: Record<string, string>,
  max = 6,
  excludeKey?: string,
  hiddenKeys?: ReadonlySet<string>,
): Array<[string, string]> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (PAYLOAD_SYSTEM_KEYS.has(k)) continue;
    if (hiddenKeys?.has(k)) continue; // author declared `hidden: true` (#5565)
    if (excludeKey && k === excludeKey) continue; // shown as the lead amount
    if (v == null || typeof v === 'object') continue;
    if (String(v).trim() === '') continue;
    const resolved = display?.[k];
    if (!resolved && typeof v === 'string' && OPAQUE_ID_RE.test(v.trim()) && !/^\d+$/.test(v.trim())) {
      continue;
    }
    // Prefer the server-resolved field label (the target object's own label,
    // already localized for a single-locale project) over a title-cased key.
    out.push([labels?.[k] ?? prettifyKey(k), resolved ?? formatPayloadValue(k, v)]);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Amount-like keys worth surfacing in the queue so a reviewer can triage
 * without opening each request (#2762 P1-3). Deliberately narrow — a decision
 * turns on the amount/total/budget, not on every numeric field.
 */
const AMOUNT_KEY_RE = /(amount|total|price|value|cost|sum|budget|salary|fee|revenue|balance|金额|总额|价格|费用|预算|金额)/i;

/**
 * The one decision-relevant numeric field (amount/total/…) of the snapshot,
 * for the inline list display and amount sort. Prefers the server-formatted
 * `payload_display` value (currency, etc.) but always keeps the raw number for
 * ordering. Null when the snapshot has no such field.
 *
 * `hiddenKeys` is the fields THIS request's object declares `hidden: true`, and
 * it is **required** on purpose (objectui#6020). It was optional when
 * objectui#5565 added it, and four of the five call sites simply did not pass
 * it — a filter that lives in the function body but is unpassed at the call
 * site reads exactly like a fixed defect. Required, the compiler asks the one
 * question that matters at every present and future call site: *whose* hidden
 * keys? Pass `NO_HIDDEN_FIELDS` only where the answer is genuinely "nothing
 * known", never to silence the parameter.
 *
 * An empty set means "nothing known to be hidden" — including the case where
 * the metadata read has not answered — and yields today's amount. See
 * `hiddenFields.ts` on why this presentation filter fails open.
 */
function decisionAmountEntry(
  r: ApprovalRequestRow,
  hiddenKeys: ReadonlySet<string>,
): { key: string; label: string; value: number; display: string } | null {
  const payload = r.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    if (PAYLOAD_SYSTEM_KEYS.has(k)) continue;
    if (hiddenKeys.has(k)) continue; // author declared `hidden: true` (#5565)
    if (!AMOUNT_KEY_RE.test(k)) continue;
    const num = typeof v === 'number'
      ? v
      : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
    if (num == null || !Number.isFinite(num)) continue;
    return {
      key: k,
      label: r.payload_labels?.[k] ?? prettifyKey(k),
      value: num,
      display: r.payload_display?.[k] ?? num.toLocaleString(),
    };
  }
  return null;
}

/** The page's scoped translator, as the row cells receive it. */
type Translate = (key: string, defaultValue: string, opts?: Record<string, unknown>) => string;

/*
 * ── Shared row fragments ──────────────────────────────────────────────────
 *
 * Module scope on purpose, for the same reason `StatusBadge` above sits here
 * (objectui#5348). Declared inside `ApprovalsInboxPage` these were a brand-new
 * component *type* on every render, so React unmounted and remounted every
 * row's cells instead of updating them — on a page that re-renders on a 60s
 * clock whether or not anyone is touching it. Two consequences were measured:
 * transient subtree state (focus, hover) was discarded on each tick, and a
 * click whose pointer sequence spanned a re-render was delivered to a
 * detached node and silently swallowed (objectui#5211 hit this and worked
 * around it at the call site).
 *
 * Everything they used to close over is passed in. Do not move them back, and
 * do not add a fourth cell inside the page body:
 * `ApprovalsInboxPage.cellIdentity.test.tsx` pins the DOM-node identity of all
 * three across a clock tick, so a reintroduction fails there. It will NOT fail
 * lint — `react-hooks/static-components` is `error` in this repo but its
 * analysis bails out on this component (measured: an arrow-form inner
 * component injected here and used in JSX produces zero reports).
 */

function RequestCell({ r, tr }: { r: ApprovalRequestRow; tr: Translate }) {
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

/**
 * `href` is `null` for a record this viewer cannot open (objectui#5211) — the
 * readable/unreadable decision and the URL are ONE prop so the two cannot be
 * handed in disagreeing with each other.
 *
 * `hiddenKeys` belongs to THIS row's object (objectui#6020). The queue spans
 * many objects, so it is a per-row prop and not something this cell could
 * resolve for itself — see the page body, which drives it off one lookup.
 */
function RecordCell({ r, href, hiddenKeys }: {
  r: ApprovalRequestRow;
  href: string | null;
  hiddenKeys: ReadonlySet<string>;
}) {
  // Surface the decision-relevant amount inline so a reviewer can triage the
  // queue without opening each request (#2762 P1-3) — minus anything the
  // author declared `hidden: true` (objectui#6020).
  const amount = decisionAmountEntry(r, hiddenKeys);
  // objectui#5211: no link into a record this viewer cannot open. The title
  // still shows — it comes from the request's own payload snapshot, which the
  // approver was already given — it just stops being an anchor.
  const title = r.record_title || formatIdentity(r.record_id);
  return (
    <div className="min-w-0">
      {href === null ? (
        <div className="text-sm truncate max-w-full" title={r.record_id}>{title}</div>
      ) : (
      <Link
        to={href}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 text-sm hover:underline truncate max-w-full"
        title={r.record_id}
      >
        <span className="truncate">{title}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
      </Link>
      )}
      <div className="text-xs text-muted-foreground truncate">
        {objectDisplay(r)}
        {amount && (
          <span className="ml-1.5 font-medium text-foreground" title={`${amount.label}: ${amount.display}`}>
            · {amount.display}
          </span>
        )}
      </div>
    </div>
  );
}

function InlineActions({
  r,
  actionable,
  busy,
  needsInputs,
  tr,
  onApprove,
  onReject,
}: {
  r: ApprovalRequestRow;
  actionable: boolean;
  busy: boolean;
  needsInputs: boolean;
  tr: Translate;
  onApprove: (r: ApprovalRequestRow) => void;
  onReject: (r: ApprovalRequestRow) => void;
}) {
  if (!actionable) return null;
  // #2829: a request whose node declares decision outputs must go through
  // the drawer's dialog (the only place those fields are collected) — render
  // the quick buttons disabled with an explanation instead of hiding them.
  const needsInputsHint = tr(
    'needsDecisionInputs',
    'This approval collects decision outputs — open it to decide.',
  );
  return (
    <div
      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
      title={needsInputs ? needsInputsHint : undefined}
    >
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400"
        disabled={busy || needsInputs}
        onClick={() => onApprove(r)}
        aria-label={needsInputs ? needsInputsHint : tr('approve', 'Approve')}
      >
        <CheckCircle2 className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400"
        disabled={busy || needsInputs}
        onClick={() => onReject(r)}
        aria-label={needsInputs ? needsInputsHint : tr('reject', 'Reject')}
      >
        <XCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ApprovalsInboxPage() {
  const { t, language } = useObjectTranslation();
  const { user } = useAuth();
  const { appName } = useParams<{ appName?: string }>();
  // Deep link (#2678 P1.5): notifications carry `/system/approvals?request=<id>`
  // so landing here opens that request's drawer directly. Consumed once, then
  // stripped from the URL so refresh/back doesn't re-open a dismissed drawer.
  const [searchParams, setSearchParams] = useSearchParams();
  const identities = useMemo(() => buildApproverIdentities(user as any), [user]);

  /**
   * [objectui#5553] May THIS viewer see the drawer's raw payload snapshot?
   *
   * ## What this closes
   *
   * The drawer's "Raw data (JSON)" panel rendered on `payload != null` alone —
   * no principal check of any kind — so every business approver was handed the
   * submitted record's complete raw row: `id`, `created_by`, `updated_by`,
   * `owner_id`, `organization_id`, bare lookup ids, and **the fields the
   * object's metadata declares `hidden: true`**. Reported from a live EHR
   * deployment on 17.1.0, where the app author's `hidden` declaration is a
   * patient-data control and this path silently bypassed it. The app author had
   * no legitimate lever to remove the panel — field `hidden`, view columns, nav,
   * permission sets and env vars are all ineffective against it — so the only
   * remedies in the field were patching `dist` or injecting CSS.
   *
   * ## The signal, and why this one
   *
   * `studio.access` is a declared PLATFORM-scope capability that a tenant org
   * owner does not hold by design (it is one of the framework's
   * `PLATFORM_ADMIN_ONLY_CAPABILITIES`), and it already reaches the browser in
   * `systemPermissions[]` from `GET /api/v1/auth/me/permissions` — the payload
   * `MePermissionsProvider` mounts around every route this page renders under
   * (`AppContent`). Nothing new is served, computed, or made authorable here:
   * `holdsStudioAccess` is reused verbatim from `studioEntry`, which is the
   * console's existing answer to "is this principal a platform operator rather
   * than a business user", so the two surfaces cannot drift into two spellings
   * of one fact. Minting an authorable key for this (`approvals.showRawPayload`
   * or any sibling) would be new public surface and is deliberately NOT done.
   *
   * ## ⛔ Fail CLOSED — inverted from `hasCapabilities`
   *
   * `usePermissions().hasCapabilities` fails OPEN on an unreported answer, and
   * that is right for an action button: the server still refuses the write, and
   * hiding a holder's button is the worse outcome. This panel has the opposite
   * stake — the measured defect IS a non-holder seeing it — so the RAW signal is
   * read instead (`systemPermissions`, whose `undefined`-vs-`[]` distinction
   * objectui#4656 made load-bearing) and every not-a-reported-grant answer
   * denies: no provider, a backend predating ADR-0066 that omits the field, and
   * the resolver's `catch` path that answers 200 with no `systemPermissions` at
   * all. A deployment whose permission layer just failed must not be the one
   * that leaks the snapshot. A reported empty array is a real answer and denies
   * too. The cost of denying wrongly is a platform operator losing a debug
   * affordance, recoverable with a reload; the cost of granting wrongly is the
   * leak this card exists to close.
   *
   * The server-side residual — the payload reaching the client unfiltered in the
   * first place — is a separate defect tracked in the objectstack repo. This
   * gate does not depend on it and does not pretend to fix it.
   */
  const { systemPermissions } = usePermissions();
  const maySeeRawPayload = holdsStudioAccess(systemPermissions);

  const tr = useCallback(
    (key: string, defaultValue: string, opts?: Record<string, unknown>) =>
      String(t(`approvalsInbox.${key}`, { defaultValue, ...opts })),
    [t],
  );

  /**
   * The one clock this page renders against.
   *
   * Every age/SLA figure below used to call `Date.now()` mid-render, which is
   * impure (`react-hooks/purity`): the output depended on when React happened
   * to render, so it disagreed with itself under StrictMode's double render and
   * froze between renders — an inbox left open showed "just now" indefinitely.
   * Holding the instant in state and advancing it on a timer makes render a
   * pure function of props+state *and* makes the countdowns actually tick.
   *
   * A minute is the finest granularity anything here displays ("5m ago",
   * "36h", "3d"), so that is the tick rate.
   */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  /** Localized relative time, e.g. "5m ago" / "5 分钟前". */
  const formatRelative = useCallback((s: string | null | undefined): string => {
    if (!s) return '—';
    const ts = Date.parse(s);
    if (Number.isNaN(ts)) return s;
    const sec = Math.round((now - ts) / 1000);
    if (sec < 45) return tr('justNow', 'just now');
    const min = Math.round(sec / 60);
    if (min < 60) return tr('minutesAgo', '{{count}}m ago', { count: min });
    const hr = Math.round(min / 60);
    if (hr < 24) return tr('hoursAgo', '{{count}}h ago', { count: hr });
    const day = Math.round(hr / 24);
    if (day < 30) return tr('daysAgo', '{{count}}d ago', { count: day });
    try { return new Date(s).toLocaleDateString(language); } catch { return s; }
  }, [tr, language, now]);

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

  /** SLA chip copy for a {@link slaState} result. */
  const slaLabel = useCallback(
    (sla: { overdue: boolean; ms: number }): string =>
      sla.overdue
        ? tr('slaOverdue', 'SLA overdue {{dur}}', { dur: compactDuration(sla.ms) })
        : tr('slaRemaining', 'SLA {{dur}} left', { dur: compactDuration(sla.ms) }),
    [tr],
  );

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

  /**
   * objectui#5211 — an approver can be routed a request about a record they
   * cannot read (approver routing goes by position; record visibility is a
   * separate gate). The link below then dead-ends on the record page's
   * "may have been deleted", so it is suppressed for exactly those rows.
   *
   * One batched list read per distinct object covers the whole page — see
   * `recordReadability.ts` for the cost model, the fail-open rule, and why
   * nothing here says anything about WHY a target is unreadable.
   *
   * `selected` joins the loaded rows because the drawer can be deep-linked
   * (`?request=<id>`) to a request that is not in the current row set.
   */
  const readabilityTargets = useMemo(
    () => (selected ? [...rows, selected] : rows),
    [rows, selected],
  );
  const readability = useRecordReadability(readabilityTargets);

  /**
   * objectui#5565 + objectui#6020 — the fields each object on screen declares
   * `hidden: true`. `hidden` is a UI contract (objectstack#10749: "`hidden:
   * true` stays UI-only; `internal: true` is the serialization primitive"), and
   * every surface below is default UI, so all of them must honour it: the
   * drawer's summary card and lead amount (#5565), and — this is #6020 — the
   * queue rows, the mobile cards, and the amount sort.
   *
   * ⛔ It is keyed BY OBJECT and not a single set. The queue is N rows spanning
   * K objects; threading the open request's set into the rows would apply one
   * object's declarations to every row — hiding fields on rows whose object
   * never declared them, missing fields on rows whose object did, and looking
   * fixed while doing it. Every consumer asks with its OWN `object_name`.
   *
   * Same targets as the readability probe, so the deep-linked drawer's object
   * is covered even when its request is not in the current row set. One cached
   * metadata read per distinct object per mount, empty until it answers — see
   * `hiddenFields.ts` for the cost model and why this fails open.
   */
  const hiddenFieldObjects = useMemo(
    () => readabilityTargets.map((t) => t.object_name),
    [readabilityTargets],
  );
  const hiddenFields = useHiddenFieldsByObject(hiddenFieldObjects);
  const hiddenPayloadKeys = hiddenFields.forObject(selected?.object_name);
  // Approve/reject/reassign/send-back/… are server-declared actions rendered by
  // DeclaredActionsBar (objectui#2697 + framework#3300); their param dialog
  // collects the comment and — since the shared upload-widget renderer (#2700/
  // #2707) plus the declared `attachments` file param (#2698) — file
  // attachments, so the inbox no longer hand-wires a decision composer. `authFetch`
  // stays for opening an attachment's short-lived signed URL.
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);

  /**
   * Open a timeline attachment. Three things the previous version got wrong,
   * all of which made the chip look dead (framework#3266 follow-up):
   *   1. `window.open` ran *after* `await` → not a user gesture → popup blocked.
   *      We open the tab synchronously, up front, then point it at the URL.
   *   2. The signed URL is server-relative (`/api/v1/storage/_local/raw/…`) — it
   *      must resolve against the API origin, not the console origin.
   *   3. Every failure was swallowed silently. Now the user gets a toast.
   */
  const openAttachment = useCallback(async (att: ApprovalActionAttachment) => {
    // Synchronous open keeps the user-gesture, so the browser won't block it.
    const win = window.open('', '_blank', 'noopener');
    try {
      const base = (import.meta.env.VITE_SERVER_URL || '').replace(/\/$/, '');
      const res = await authFetch(`${base}/api/v1/storage/files/${encodeURIComponent(att.id)}/url`);
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const body = await res.json().catch(() => null);
      // Both dialects: the declared `{ success: true, data: { url } }` envelope
      // this route answers as of objectstack#3689, and the bare `{ url }` an
      // older server still sends — the console deploys independently of it.
      const raw = body?.data?.url ?? body?.url;
      if (!raw) throw new Error('NO_URL');
      // Signed URLs from the local adapter are relative; S3/GCS are absolute.
      const url = /^https?:\/\//i.test(raw) ? raw : `${base}${raw}`;
      if (win) win.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } catch {
      win?.close();
      toast.error(tr('attachmentOpenFailed', 'Could not open the attachment — please try again'));
    }
  }, [authFetch, tr]);

  // Search + filters. On the paginated tabs (submitted/all) the free-text
  // query is debounced and pushed to the server; the pending tab keeps
  // instant client-side matching over its (bounded) personal queue.
  const [query, setQuery] = useState('');
  const [serverQuery, setServerQuery] = useState('');
  const [processFilter, setProcessFilter] = useState<string>('all');
  const [objectFilter, setObjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  // Client-side ordering of the visible rows (#2762 P1-3). Default keeps the
  // server's newest-first; the others let a reviewer triage by wait time or by
  // the decision-relevant amount.
  const [sortKey, setSortKey] = useState<'recent' | 'oldest' | 'amount'>('recent');

  // Bulk selection (only meaningful on "pending" tab where the user can act)
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  // Inline decision confirmation targets (row-level quick action / mobile
  // card / keyboard). BOTH decisions confirm before executing (#2762 P0-2):
  // the right-edge icons are small, easy to misclick, and a decision is
  // irreversible — one stray click must never finalize a request.
  const [approveTarget, setApproveTarget] = useState<ApprovalRequestRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ApprovalRequestRow | null>(null);
  const [inlineActing, setInlineActing] = useState<string | null>(null);

  // Thread reply. The secondary decision levers (reassign / request-info /
  // send-back / remind / recall / resubmit) are no longer hand-wired here —
  // they ship as the object's server-declared actions and render through
  // DeclaredActionsBar (objectui#2678 P2-4 + framework#3300). The rich
  // approve/reject composer below stays, because it collects file attachments
  // the generic param dialog can't yet.
  const [reply, setReply] = useState('');
  const [threadBusy, setThreadBusy] = useState(false);

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
  const refreshBadge = useCallback(() => {
    if (!identities.length) return;
    approvalsApi.listRequests({ status: 'pending', approverId: identities })
      .then(res => setMyPendingCount(res.data.length))
      .catch(() => { /* best-effort */ });
  }, [identities]);

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

  /**
   * `onDone` for the pending drawer's declared-action bar. Refreshes the acted
   * request + list, then — on the pending tab — advances to the next waiting
   * item when this one is no longer the current user's to act on (finalized,
   * approved-away in a quorum, reassigned): the Fiori "My Inbox" queue-processing
   * flow the hand-wired composer used to own, now driven generically off the
   * refreshed row rather than a per-action handler. Stays in place otherwise
   * (e.g. remind / request-info leave the item pending and still yours).
   */
  const onDecisionDone = useCallback(async () => {
    if (!selected) return;
    const id = selected.id;
    try {
      const [req, acts] = await Promise.all([
        approvalsApi.getRequest(id),
        approvalsApi.listActions(id),
      ]);
      setSelected(req.data);
      setActions(acts.data);
      void load();
      const pending = new Set(req.data.pending_approvers || []);
      const stillMine = req.data.status === 'pending' && identities.some(x => pending.has(x));
      if (tab === 'pending' && !stillMine) {
        const list = filteredRef.current;
        const idx = list.findIndex(r => r.id === id);
        const next = list[idx + 1] ?? list[idx - 1];
        if (next && next.id !== id) { void openDrawer(next.id); return; }
        closeDrawer();
      }
    } catch {
      void refreshThread(id);
    }
  }, [selected, identities, tab, load, openDrawer, closeDrawer, refreshThread]);

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

  // Participant checks — drive the reply box + the "why disabled" hint (the
  // decision buttons themselves are server-declared and gate via their own
  // `visible` CEL). Prefer the server-computed `viewer` block (framework#3310)
  // so the hint never contradicts the buttons — it already reflects position/
  // team approver resolution, which the client identity heuristic below can't.
  // The heuristic stays as a fallback for a backend that predates `viewer`.
  // framework#3424: a platform/tenant admin may OVERRIDE a stuck request (one
  // routed to an unstaffed position) even holding no slot — `viewer.can_override`
  // mirrors the server's decision authz, so the hint and the approve/reject/
  // reassign buttons (which OR in `can_override`) stay consistent. This is a
  // privileged recovery path, not the retired per-request "act as" composer.
  const canApproveReject = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    if (selected.viewer) return selected.viewer.can_act || !!selected.viewer.can_override;
    const pending = new Set(selected.pending_approvers || []);
    return identities.some(id => pending.has(id));
  }, [selected, identities]);

  const canRecall = useMemo(() => {
    if (!selected || selected.status !== 'pending') return false;
    if (selected.viewer) return selected.viewer.is_submitter;
    return selected.submitter_id === user?.id;
  }, [selected, user?.id]);

  /** ADR-0044: the submitter may resubmit (or abandon) a returned request. */
  const canResubmit = useMemo(() => {
    if (!selected || selected.status !== 'returned') return false;
    if (selected.viewer) return selected.viewer.is_submitter;
    return selected.submitter_id === user?.id;
  }, [selected, user?.id]);


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

  /** Client-side filtered + sorted rows shown in table. */
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = rows.filter(r => {
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
    if (sortKey === 'recent') return matched; // server order is already newest-first
    const sorted = [...matched];
    if (sortKey === 'amount') {
      // Highest amount first; rows without a detectable amount sink to the
      // bottom (keeping their relative newest-first order).
      //
      // objectui#6020: a row whose amount field its object declares
      // `hidden: true` has no amount HERE either, so it sinks with them. An
      // ordering IS a disclosure — it leaks the relative magnitude of a hidden
      // figure to a viewer who never sees the figure — so the queue must not
      // order on a value it declines to render. Each row is asked about its
      // own object; a page spanning several objects gets several answers.
      sorted.sort((a, b) => {
        const av = decisionAmountEntry(a, hiddenFields.forObject(a.object_name))?.value;
        const bv = decisionAmountEntry(b, hiddenFields.forObject(b.object_name))?.value;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return bv - av;
      });
    } else {
      // Oldest first — flip the newest-first submitted timestamp.
      sorted.sort((a, b) => (submittedAt(a) || '').localeCompare(submittedAt(b) || ''));
    }
    return sorted;
  }, [rows, query, processFilter, objectFilter, statusFilter, tab, sortKey, hiddenFields]);
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
   * #2829 / framework#3447: a node that declares decision outputs expects the
   * approver to fill them — only the drawer's declared-action dialog collects
   * them, so the quick paths (inline a/r, hover buttons, bulk) must not decide
   * such a request: a quick approve would silently hand the flow nothing and
   * the next stage's expression approver would resolve an empty slate.
   */
  const needsDecisionInputs = useCallback((r: ApprovalRequestRow): boolean =>
    Array.isArray(r.decision_outputs) && r.decision_outputs.length > 0, []);

  /** Quick-decidable = actionable AND no declared decision outputs (#2829). */
  const quickDecidable = useCallback((r: ApprovalRequestRow): boolean =>
    isActionable(r) && !needsDecisionInputs(r), [isActionable, needsDecisionInputs]);

  /**
   * Rows the user is actually allowed to bulk-act on:
   * status=pending AND one of the user's identities is in pending_approvers
   * AND the node declares no decision outputs (#2829 — those need the drawer
   * dialog; they surface in the bulk bar as skipped).
   */
  const actionableSelectedRows = useMemo(
    () => filteredRows.filter(r => selectedRowIds.has(r.id) && quickDecidable(r)),
    [filteredRows, selectedRowIds, quickDecidable],
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

  /** Confirmed row-level approve (from the shared dialog). */
  const inlineApprove = useCallback(async () => {
    const r = approveTarget;
    if (!r) return;
    const pending = new Set(r.pending_approvers || []);
    const actor = identities.find(i => pending.has(i)) || user?.id || '';
    setInlineActing(r.id);
    setApproveTarget(null);
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
  }, [approveTarget, identities, user?.id, load, refreshBadge, humanizeError, tr]);

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
      if (selectedId || approveTarget || rejectTarget) return; // a sheet/dialog owns the keyboard
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
      } else if (e.key === 'a' && idx >= 0 && list[idx] && quickDecidable(list[idx])) {
        e.preventDefault();
        setApproveTarget(list[idx]);
      } else if (e.key === 'r' && idx >= 0 && list[idx] && quickDecidable(list[idx])) {
        e.preventDefault();
        setRejectTarget(list[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, approveTarget, rejectTarget, tab, openDrawer, toggleRow, quickDecidable]);

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
    setSortKey('recent');
    setFocusIndex(-1);
  };

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
              {/* Triage ordering (#2762 P1-3): newest by default, or by wait
                  time / decision amount. */}
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
                <SelectTrigger className="h-8 w-auto min-w-[120px] text-sm">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue placeholder={tr('sortBy', 'Sort')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">{tr('sortRecent', 'Newest first')}</SelectItem>
                  <SelectItem value="oldest">{tr('sortOldest', 'Oldest first')}</SelectItem>
                  <SelectItem value="amount">{tr('sortAmount', 'Amount (high→low)')}</SelectItem>
                </SelectContent>
              </Select>
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
                        {/* Column widths rebalanced (#2762 P2): the Record is the
                            primary content so it gets the widest share, the
                            Request a moderate one, and Status/Submitted fixed
                            widths so they never crowd — instead of the browser
                            spreading five auto columns evenly and leaving 审批事项
                            over-wide next to a cramped 状态. */}
                        <TableHead className="w-[22%]">{tr('colRequest', 'Request')}</TableHead>
                        <TableHead className="w-[30%]">{tr('colRecord', 'Record')}</TableHead>
                        <TableHead className="w-[16%]">{tr('colRequester', 'Requester')}</TableHead>
                        <TableHead className="w-[110px] min-w-[96px] whitespace-nowrap">{tr('colStatus', 'Status')}</TableHead>
                        <TableHead className="w-[132px]">{tr('colWaiting', 'Submitted')}</TableHead>
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
                          <TableCell><RequestCell r={r} tr={tr} /></TableCell>
                          <TableCell>
                            <RecordCell
                              r={r}
                              href={readability.isUnreadable(r) ? null : recordHref(r)}
                              hiddenKeys={hiddenFields.forObject(r.object_name)}
                            />
                          </TableCell>
                          <TableCell>
                            {isSystemSubmitter(r) ? (
                              // Flow-/system-initiated: name the origin instead of a
                              // bare person icon + "—" (#2762 P1-4).
                              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                <Workflow className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate italic">{tr('flowOrigin', 'Flow-initiated')}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-sm">
                                <UserIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate" title={r.submitter_id || ''}>{submitterDisplay(r)}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell><StatusBadge status={r.status} label={statusLabel(r.status)} /></TableCell>
                          <TableCell
                            className={cn('text-xs whitespace-nowrap', agingClass(r, now))}
                            title={formatDate(submittedAt(r))}
                          >
                            <Clock className="h-3 w-3 inline mr-1" />
                            {formatRelative(submittedAt(r))}
                            {r.status === 'pending' && (() => {
                              const sla = slaState(r.sla_due_at, now);
                              return sla ? (
                                <div className={cn(
                                  'mt-0.5 text-[10px] font-medium',
                                  sla.overdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                                )}>
                                  {slaLabel(sla)}
                                </div>
                              ) : null;
                            })()}
                          </TableCell>
                          <TableCell className="w-20">
                            <InlineActions
                              r={r}
                              actionable={isActionable(r)}
                              busy={inlineActing === r.id}
                              needsInputs={needsDecisionInputs(r)}
                              tr={tr}
                              onApprove={setApproveTarget}
                              onReject={setRejectTarget}
                            />
                          </TableCell>
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
                        <StatusBadge status={r.status} label={statusLabel(r.status)} />
                      </div>
                      <div className="text-sm truncate">
                        {r.record_title || formatIdentity(r.record_id)}
                        <span className="text-muted-foreground text-xs ml-1.5">{objectDisplay(r)}</span>
                        {(() => {
                          // objectui#6020: this row's OWN object decides.
                          const amount = decisionAmountEntry(r, hiddenFields.forObject(r.object_name));
                          return amount ? (
                            <span className="text-xs ml-1.5 font-medium" title={amount.label}>· {amount.display}</span>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {isSystemSubmitter(r) ? (
                          <span className="inline-flex items-center gap-1 truncate italic">
                            <Workflow className="h-3 w-3" />{tr('flowOrigin', 'Flow-initiated')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 truncate">
                            <UserIcon className="h-3 w-3" />{submitterDisplay(r)}
                          </span>
                        )}
                        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', agingClass(r, now))}>
                          <Clock className="h-3 w-3" />{formatRelative(submittedAt(r))}
                        </span>
                      </div>
                      {isActionable(r) && (
                        // #2829: outputs-declaring requests decide only via the
                        // drawer dialog — quick buttons disable with the hint.
                        <div
                          className="flex gap-2 pt-1"
                          onClick={(e) => e.stopPropagation()}
                          title={needsDecisionInputs(r)
                            ? tr('needsDecisionInputs', 'This approval collects decision outputs — open it to decide.')
                            : undefined}
                        >
                          <Button size="sm" className="h-7 flex-1" disabled={inlineActing === r.id || needsDecisionInputs(r)} onClick={() => setApproveTarget(r)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />{tr('approve', 'Approve')}
                          </Button>
                          <Button
                            size="sm" variant="outline" className="h-7 flex-1 border-destructive text-destructive"
                            disabled={inlineActing === r.id || needsDecisionInputs(r)} onClick={() => setRejectTarget(r)}
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

      {/* Shared inline-approve confirmation (#2762 P0-2) */}
      <AlertDialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr('approveOneTitle', 'Approve "{{title}}"?', {
                title: approveTarget ? (approveTarget.record_title || formatIdentity(approveTarget.record_id)) : '',
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr('approveOneBody', 'This approves the request with your identity. To add a comment or attachment, open the request instead.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr('cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void inlineApprove()}>
              {tr('approve', 'Approve')}
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
              {/* "Request N of M" — spelled out so it can't be misread as
                  decision progress (#2762 P1-1). */}
              <span>{tr('positionOf', 'Request {{index}} of {{total}}', { index: drawerIndex + 1, total: filteredRows.length })}</span>
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
                <StatusBadge status={selected.status} label={statusLabel(selected.status)} />
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
                {selected.status === 'pending' && (() => {
                  const sla = slaState(selected.sla_due_at, now);
                  return sla ? (
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      sla.overdue
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                        : 'border-border text-muted-foreground',
                    )}>
                      {slaLabel(sla)}
                    </Badge>
                  ) : null;
                })()}
              </div>

              {/* Business summary card */}
              {(() => {
              // Decision-critical amount leads the card (#2762 P2) — a filled
              // figure at the top instead of a value buried bottom-right in the
              // generic field grid. Excluded from that grid below so it shows once.
              // Both halves of this card read the same snapshot, so both take
              // the same `hidden` trim (objectui#5565) — otherwise a hidden
              // amount-like field would simply move from the field grid to the
              // bold lead figure at the top of the very card being fixed.
              const drawerAmount = decisionAmountEntry(selected, hiddenPayloadKeys);
              const summary = payloadSummary(selected.payload, selected.payload_display, selected.payload_labels, 6, drawerAmount?.key, hiddenPayloadKeys);
              return (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {/* Same suppression as the row (objectui#5211) — the drawer
                          offers the same link to the same record for the same
                          viewer, so fixing only the row would move the dead end
                          one click deeper instead of removing it. */}
                      {readability.isUnreadable(selected) ? (
                        <div className="text-base font-semibold truncate">
                          {selected.record_title || formatIdentity(selected.record_id)}
                        </div>
                      ) : (
                      <Link
                        to={recordHref(selected)}
                        className="text-base font-semibold hover:underline inline-flex items-center gap-1.5"
                      >
                        <span className="truncate">{selected.record_title || formatIdentity(selected.record_id)}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </Link>
                      )}
                      <div className="text-xs text-muted-foreground">{objectDisplay(selected)}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <div className="inline-flex items-center gap-1">
                        {isSystemSubmitter(selected) ? (
                          <>
                            <Workflow className="h-3 w-3" />
                            <span className="italic">{tr('flowOrigin', 'Flow-initiated')}</span>
                          </>
                        ) : (
                          <>
                            <UserIcon className="h-3 w-3" />
                            <span title={selected.submitter_id || ''}>{submitterDisplay(selected)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {drawerAmount && (
                    <div className="border-t pt-3">
                      <div className="text-[11px] text-muted-foreground">{drawerAmount.label}</div>
                      <div className="text-xl font-semibold tabular-nums" title={drawerAmount.display}>
                        {drawerAmount.display}
                      </div>
                    </div>
                  )}
                  {summary.length > 0 && (
                    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-2 text-sm', !drawerAmount && 'border-t pt-3')}>
                      {summary.map(([k, v]) => (
                        <div key={k} className="min-w-0">
                          <div className="text-[11px] text-muted-foreground">{k}</div>
                          <div className="truncate" title={v}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Aggregation progress (#3266): server-computed — "2 of 3
                      approved" for quorum/unanimous, per-group ticks for 会签.
                      Rendered as a segmented bar + per-group state (#2762 P1-1)
                      instead of text alone, with the eligible-approver count
                      spelled out so "0 of 1" can't be misread against the
                      drawer pager's "Request 2 of 3". */}
                  {selected.decision_progress && (() => {
                    const dp = selected.decision_progress;
                    const eligible = (selected.pending_approvers || []).length;
                    return (
                      <div className="border-t pt-3">
                        <div className="flex items-baseline justify-between gap-2 mb-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {dp.behavior === 'per_group'
                              ? tr('progressGroups', 'Sign-off progress — {{got}} of {{need}} groups', {
                                  got: dp.got, need: dp.need,
                                })
                              : tr('progressApprovals', 'Approvals — {{got}} of {{need}}', {
                                  got: dp.got, need: dp.need,
                                })}
                          </span>
                          {dp.behavior !== 'per_group' && selected.status === 'pending' && eligible > 0 && (
                            <span className="text-[11px] text-muted-foreground">
                              {tr('progressEligible', '{{count}} eligible approver(s)', { count: eligible })}
                            </span>
                          )}
                        </div>
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={dp.need}
                          aria-valuenow={Math.min(dp.got, dp.need)}
                          aria-label={tr('progressBar', 'Decision progress')}
                          className="flex gap-1"
                        >
                          {dp.need > 0 && dp.need <= 12 ? (
                            Array.from({ length: dp.need }).map((_, i) => (
                              <div
                                key={i}
                                className={cn(
                                  'h-1.5 flex-1 rounded-full',
                                  i < dp.got ? 'bg-emerald-500' : 'bg-muted',
                                )}
                              />
                            ))
                          ) : (
                            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${dp.need > 0 ? Math.min(100, (dp.got / dp.need) * 100) : 0}%` }}
                              />
                            </div>
                          )}
                        </div>
                        {dp.groups && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {dp.groups.map((g) => (
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
                                {g.satisfied
                                  ? <Check className="h-3 w-3" />
                                  : <Circle className="h-2.5 w-2.5" />}
                                {g.group} {g.got}/{g.need}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {selected.status === 'pending' && (selected.pending_approvers || []).length > 0 && (
                    <div className="border-t pt-3">
                      <div className="text-[11px] text-muted-foreground mb-1">
                        {tr('waitingOn', 'Waiting on')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {approverChips(selected).map((chip, i) => (
                          <Badge key={`${chip.label}-${chip.group ?? ''}-${i}`} variant="outline" className="text-[11px]" title={chip.title}>
                            {chip.label}
                            {chip.group && (
                              // 会签 group this slot represents (objectui#2807).
                              <span className="ml-1 text-muted-foreground">· {chip.group}</span>
                            )}
                            {chip.count > 1 && (
                              <span className="ml-1 text-muted-foreground">×{chip.count}</span>
                            )}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              );
              })()}

              {(selected.flow_steps?.length ?? 0) > 1 && (
                // objectui#5554 — the step strip is a VERTICAL stepper, at
                // every step count. A horizontal row's intrinsic width grows
                // without bound with step count and label length, so a real
                // 6-step flow with ordinary CJK labels measured 1070px inside
                // a 527px drawer: steps 4-6 were reachable only by dragging
                // the drawer's own scrollbar, which pushed the rest of the
                // drawer off-screen. A column caps width at the container at
                // any step count and any label length, so there is no flow
                // length or viewport at which it silently regresses — which
                // is exactly what a count- or measurement-triggered switch
                // would reintroduce. Nothing here may pin intrinsic width:
                // no `shrink-0` on the rows, no `whitespace-nowrap` on the
                // labels, and no horizontal scroller.
                <ol className="flex flex-col px-1" aria-label={tr('stepProgress', 'Approval steps')}>
                  {selected.flow_steps!.map((s, i, steps) => {
                    const next = steps[i + 1];
                    return (
                      <li key={s.id} className="flex items-start gap-2">
                        <div className="flex flex-col items-center self-stretch">
                          <span className={cn(
                            'flex items-center justify-center h-5 w-5 shrink-0 rounded-full text-[10px] font-semibold',
                            s.state === 'done' && 'bg-emerald-500 text-white',
                            s.state === 'current' && 'bg-amber-500 text-white ring-2 ring-amber-200 dark:ring-amber-500/30',
                            s.state === 'upcoming' && 'bg-muted text-muted-foreground border',
                          )}>
                            {s.state === 'done' ? <Check className="h-3 w-3" /> : i + 1}
                          </span>
                          {next && (
                            // Tinted by the step it leads INTO — the same rule
                            // the horizontal connector used, now running down
                            // the rail instead of across it.
                            <div className={cn('w-px flex-1 min-h-3 my-1', next.state === 'done' || next.state === 'current' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border')} />
                          )}
                        </div>
                        <span className={cn(
                          'min-w-0 flex-1 pt-0.5 text-xs break-words',
                          s.state === 'current' ? 'font-medium' : 'text-muted-foreground',
                        )}>{s.label}</span>
                      </li>
                    );
                  })}
                </ol>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-3">{tr('history', 'Activity')}</h3>
                {actions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">{tr('noActions', 'No actions yet.')}</div>
                ) : (
                  <ol className="relative space-y-3 pl-5 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
                    {actions.map((a) => {
                      // objectui#5178 — an admin override does not wear the
                      // ordinary decision's dot. Same rule and same predicate as
                      // the record page's approval panel (both call
                      // `isViaOverrideRow`), so the two timelines cannot drift
                      // on what counts as an override.
                      const viaOverride = isViaOverrideRow(a);
                      const color = viaOverride ? 'bg-amber-500'
                                  : a.action === 'approve' ? 'bg-emerald-500'
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
                            {/* The marker framework#4466 wrote and nothing read
                                (objectui#5178). Only an explicit
                                `via_override: true` earns it. */}
                            {viaOverride && (
                              <Badge
                                variant="outline"
                                className="gap-1 border-amber-500/60 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                                title={tr('viaOverrideHint', 'The actor held no approver slot on this step — admitted by the admin-override path.')}
                                data-testid="via-override-chip"
                              >
                                <ShieldAlert className="h-3 w-3" aria-hidden />
                                {tr('viaOverrideChip', 'Admin override')}
                              </Badge>
                            )}
                            <span
                              className="ml-auto text-muted-foreground text-[10px]"
                              title={formatDate(a.created_at)}
                            >
                              {formatRelative(a.created_at)}
                            </span>
                          </div>
                          {/* Structured reassign hand-off (framework#4365): render
                              "from A to B" from the resolved parties. Legacy rows
                              predate the fields and only carry the old default
                              comment — those keep the comment fallback below. */}
                          {(() => {
                            const ax = a as typeof a & {
                              reassign_from?: string; reassign_to?: string;
                              reassign_from_name?: string; reassign_to_name?: string;
                            };
                            if (a.action !== 'reassign' || (!ax.reassign_from && !ax.reassign_to)) return null;
                            return (
                              <div className="text-muted-foreground mt-0.5">
                                {tr('reassignFromTo', 'from {{from}} to {{to}}', {
                                  from: ax.reassign_from_name ?? formatIdentity(ax.reassign_from),
                                  to: ax.reassign_to_name ?? formatIdentity(ax.reassign_to),
                                })}
                              </div>
                            );
                          })()}
                          {a.comment && (
                            <div className="text-muted-foreground italic mt-0.5">"{a.comment}"</div>
                          )}
                          {Array.isArray(a.attachments) && a.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {a.attachments.map((att, i) => (
                                <button
                                  key={att.id || i}
                                  type="button"
                                  onClick={() => void openAttachment(att)}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                  title={att.name || att.id}
                                >
                                  <Paperclip className="h-3 w-3" />
                                  {att.name
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

              {/* Raw snapshot — a platform-operator debug affordance, never the
                  approver's read path. Gated on `maySeeRawPayload` (see its
                  definition for the defect, the signal, and the fail-CLOSED
                  posture); a business approver gets the structured summary,
                  chain, activity and actions above and nothing else. */}
              {maySeeRawPayload && selected.payload != null && (
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
                    {/* SERVER-DECLARED decision actions (objectui#2678 P2-4 +
                        framework#3300). The inbox hand-wires NOTHING: approve /
                        reject (with comment + file attachments), reassign,
                        send-back, request-info, remind and recall all ship as the
                        object's declared actions and render + execute here through
                        the shared console action runtime. Each action's `visible`
                        CEL gates it (submitter levers on `submitter_id ==
                        ctx.user.id`; approver levers on `status == pending`), its
                        param dialog collects the comment and — via the shared
                        upload-widget renderer (#2700/#2707) — the `attachments`
                        file param (#2698), and its `{id}`-interpolated
                        `type:'api'` target resolves from the selected row. */}
                    <DeclaredActionsBar
                      objectName="sys_approval_request"
                      record={selected}
                      location="record_section"
                      label={tr('declaredActions', 'Actions')}
                      onDone={() => { void onDecisionDone(); }}
                    />
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
                    <div className="flex gap-2 flex-wrap items-center">
                      {/* NOT readability-suppressed (objectui#5211), deliberately:
                          this branch renders only for the SUBMITTER of a returned
                          request, whose whole job here is to edit that record —
                          a different persona from the approver the suppression is
                          for, and one who demonstrably reached the record to
                          submit it. */}
                      <Button asChild size="sm" variant="outline">
                        <Link to={recordHref(selected)}>
                          <ExternalLink className="h-4 w-4 mr-1" />
                          {tr('editRecordBtn', 'Edit record')}
                        </Link>
                      </Button>
                      {/* Resubmit / recall-abandon ship as the object's declared
                          actions (gated to the submitter on a `returned` request)
                          and render + execute here — the resubmit dialog collects
                          the "what changed?" comment. */}
                      <DeclaredActionsBar
                        objectName="sys_approval_request"
                        record={selected}
                        location="record_section"
                        onDone={() => { void refreshThread(selected.id); void load(); }}
                      />
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
