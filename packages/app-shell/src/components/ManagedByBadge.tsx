import { ShieldAlert, Settings2, Lock, Archive } from 'lucide-react';
import {
  Badge,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  cn,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { isSystemWritable, type ManagedByBucket } from '../utils/crudAffordances';

/**
 * ManagedByBadge — replaces the verbose, full-width `ManagedByBanner` with
 * a compact badge that sits next to the page title.
 *
 * Rationale (see internal RFC, "platform-managed UX"):
 *   - Salesforce / ServiceNow / Workday / SAP Fiori never plaster a banner
 *     explaining their internal architecture across every list/detail
 *     page. Instead they hide the affordance (the New button), and surface
 *     a short *contextual* hint only when the user might otherwise be
 *     confused (typically the empty state or a tooltip).
 *   - The previous banner exposed engine-internal terminology ("platform
 *     engine", "audit / monitoring surface") to every end user and repeated
 *     itself on three pages (list + detail + form) for the same record.
 *
 * The badge follows the same taxonomy declared by
 * `@objectstack/spec/data/object.zod.ts` → `ObjectSchemaBase.managedBy`:
 *   - `platform`     — User-owned business data. **Renders nothing.**
 *   - `config`       — Admin-authored configuration.
 *   - `system`       — Engine-managed schema. A `system` object that opens writes
 *                      via `userActions` (ADR-0103) is platform-defined,
 *                      admin/user-writable DATA and gets the distinct
 *                      writable-system copy; a locked one reads engine-owned.
 *   - `engine-owned` — Runtime rows a platform service owns end to end (ADR-0103);
 *                      the explicit read-only monitoring surface.
 *   - `append-only`  — Immutable audit log.
 *   - `better-auth`  — Identity tables owned by better-auth driver.
 *
 * Forms still disable inputs and the toolbar still hides New/Import/Delete
 * via `resolveCrudAffordances()`. This badge purely *labels* the bucket so
 * users understand at a glance why those affordances are missing — the
 * detailed explanation lives in the tooltip.
 *
 * Empty-state guidance for `system`-bucket lists is rendered separately by
 * `ObjectView` via `resolveManagedByEmptyState()`.
 */

type Bucket = ManagedByBucket;

/**
 * Subset of `userActions` (ADR-0103) the badge needs to tell an engine-owned
 * `system` object apart from an admin/user-writable one. Mirrors the shared
 * `resolveCrudAffordances` inputs; `edit`/`delete` accept the #2614 object form.
 */
export interface ManagedByUserActions {
  create?: boolean;
  edit?: boolean | { enabled?: boolean };
  delete?: boolean | { enabled?: boolean };
}

export interface ManagedByBadgeProps {
  /** The `managedBy` flag from the object schema. */
  managedBy?: string;
  /**
   * The object's `userActions` (ADR-0103). When a `system`-bucket object opens
   * any write here, the badge switches from the engine-owned "read-only
   * monitoring surface" copy to the admin/user-writable variant.
   */
  userActions?: ManagedByUserActions | null;
  /** Optional override for the human-readable system name shown in the tooltip. */
  label?: string;
  /** Optional extra classes. */
  className?: string;
}

interface Variant {
  icon: typeof ShieldAlert;
  /** Key under the `managedByBadge.*` locale namespace. */
  i18nKey: string;
  /** English fallbacks when the locale bundle misses a key. */
  short: string;
  title: string;
  body: (display: string) => string;
  /** Tailwind classes for the badge surface. */
  tone: string;
}

/** Variant keys: the non-platform buckets plus the ADR-0103 writable-system split. */
type VariantKey = Exclude<Bucket, 'platform'> | 'system-writable';

const VARIANTS: Record<VariantKey, Variant> = {
  config: {
    icon: Settings2,
    i18nKey: 'config',
    short: 'Admin config',
    title: 'Administrator configuration',
    body: () =>
      'These rows define how the platform behaves at runtime. Author them here; the runtime data they produce lives in a separate table.',
    tone: 'border-sky-300/60 bg-sky-50 text-sky-900 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-950/40 dark:text-sky-100',
  },
  system: {
    icon: Lock,
    i18nKey: 'system',
    short: 'System-managed',
    title: 'Managed by the platform',
    body: () =>
      'Rows here are created automatically when actions run on the source record. The list below is a read-only monitoring surface — row-level actions (Approve, Recall, Resend, …) live on each row.',
    tone: 'border-slate-300/60 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-500/40 dark:bg-slate-950/40 dark:text-slate-100',
  },
  // ADR-0103 — the explicit engine-owned bucket: rows a platform service owns end
  // to end (jobs, automation runs, approval runtime rows, the metadata store, …).
  // To a user this reads identically to a locked `system` object ("the platform
  // manages this, read-only"), so it deliberately REUSES the `system` copy/i18n key
  // — zero translation churn, consistent UX; the self-documentation is at the
  // schema level. (Same object shape as `system`; the distinct bucket value is the
  // point, not distinct user-facing copy.)
  'engine-owned': {
    icon: Lock,
    i18nKey: 'system',
    short: 'System-managed',
    title: 'Managed by the platform',
    body: () =>
      'Rows here are created automatically when actions run on the source record. The list below is a read-only monitoring surface — row-level actions (Approve, Recall, Resend, …) live on each row.',
    tone: 'border-slate-300/60 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-500/40 dark:bg-slate-950/40 dark:text-slate-100',
  },
  // ADR-0103 — a `system`-bucket object that opened writes via `userActions`:
  // platform-defined schema, but admin/user-writable DATA (e.g. Notification
  // Preferences, delegated RBAC assignments). Resolved in the component when the
  // bucket is `system` and any write is opted in, so the copy no longer claims a
  // "read-only monitoring surface".
  'system-writable': {
    icon: Settings2,
    i18nKey: 'systemWritable',
    short: 'Platform schema',
    title: 'Platform-defined, admin-writable',
    body: () =>
      "This object's schema is defined by the platform, but its rows are yours to create and edit here. Who may write is governed by delegated administration and record-level security, not by this badge.",
    tone: 'border-slate-300/60 bg-slate-50 text-slate-900 hover:bg-slate-100 dark:border-slate-500/40 dark:bg-slate-950/40 dark:text-slate-100',
  },
  'append-only': {
    icon: Archive,
    i18nKey: 'appendOnly',
    short: 'Read-only · Audit log',
    title: 'Read-only historical record',
    body: () =>
      "Immutable audit log. Rows cannot be created, edited, or deleted from the UI — they're written by the platform when events occur. Use Export to download for compliance review.",
    tone: 'border-zinc-300/60 bg-zinc-50 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-500/40 dark:bg-zinc-950/40 dark:text-zinc-100',
  },
  'better-auth': {
    icon: ShieldAlert,
    i18nKey: 'betterAuth',
    short: 'Identity',
    title: 'Managed by the identity provider',
    body: (display) =>
      `This object's schema is owned by ${display}. Direct edits bypass password hashing, session validation, two-factor checks, and audit hooks. Manage these records through your authentication provider's sign-in, invitation, and security flows instead.`,
    tone: 'border-amber-300/60 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100',
  },
};

export function ManagedByBadge({ managedBy, userActions, label, className }: ManagedByBadgeProps) {
  const { t } = useObjectTranslation();
  if (!managedBy || managedBy === 'platform') return null;
  // ADR-0103 — a `system` object that opened any write is admin/user-writable
  // data, not an engine-owned monitoring surface: pick the writable variant/copy.
  const systemWritable = isSystemWritable({ managedBy, userActions });
  const variantKey: VariantKey = systemWritable ? 'system-writable' : (managedBy as VariantKey);
  const variant = VARIANTS[variantKey];
  if (!variant) return null;
  const Icon = variant.icon;
  const display = label ?? 'better-auth';
  const short = t(`managedByBadge.${variant.i18nKey}.short`, { defaultValue: variant.short });
  const title = t(`managedByBadge.${variant.i18nKey}.title`, { defaultValue: variant.title });
  const body = t(`managedByBadge.${variant.i18nKey}.body`, {
    defaultValue: variant.body(display),
    provider: display,
  });
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            data-testid="managed-by-badge"
            data-bucket={managedBy}
            className={cn(
              'gap-1 font-normal text-[11px] leading-none py-0.5 px-1.5 cursor-help',
              variant.tone,
              className,
            )}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            <span>{short}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-muted-foreground">{body}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ManagedByBadge;
