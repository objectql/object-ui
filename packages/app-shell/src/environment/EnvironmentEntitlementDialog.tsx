/**
 * EnvironmentEntitlementDialog — a friendly upgrade / limit dialog shown instead
 * of a raw red error toast when an environment-create is gated by plan or
 * capacity (DEV_ENV_PLAN_LOCKED / DEV_ENV_LIMIT / PRODUCTION_ENV_LIMIT).
 *
 * Driven by a single {@link EntitlementDialogSpec}, opened from two places:
 *   • proactively, from the env-list toolbar (a free-plan org clicking
 *     "Add environment" — see EnvironmentListToolbar), and
 *   • reactively, from the action runtime's apiHandler when the create POST
 *     comes back with an entitlement 403 (the safety net).
 *
 * The CTA renders as an anchor (not an SPA navigation) so a control-plane URL
 * like `/settings/billing` always lands on the real page regardless of the
 * console's own router. Relative URLs resolve against the control-plane origin
 * (`apiBase`); absolute / mailto URLs are used as-is.
 */

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  Button,
} from '@object-ui/components';
import type { EntitlementCta, EntitlementDialogSpec } from './entitlements';

export interface EntitlementDialogState {
  open: boolean;
  spec?: EntitlementDialogSpec;
}

/** Resolve a CTA URL to a concrete href + whether it should open in a new tab. */
export function resolveCtaHref(url: string, apiBase: string): { href: string; external: boolean } {
  if (/^https?:\/\//i.test(url) || url.startsWith('mailto:')) {
    return { href: url, external: !url.startsWith('mailto:') };
  }
  const base = (apiBase || '').replace(/\/+$/, '');
  // A control-plane-relative path: prefix the API origin when we have one (dev:
  // split SPA + backend). Empty base → same-origin relative (prod).
  return { href: `${base}${url}`, external: Boolean(base) };
}

function CtaButton({
  cta,
  apiBase,
  primary,
  onNavigate,
}: {
  cta: EntitlementCta;
  apiBase: string;
  primary: boolean;
  onNavigate: () => void;
}) {
  const { href, external } = resolveCtaHref(cta.url, apiBase);
  return (
    <Button asChild variant={primary ? 'default' : 'outline'} size="sm">
      <a
        href={href}
        onClick={onNavigate}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        data-testid={`entitlement-cta-${primary ? 'primary' : 'secondary'}`}
      >
        {cta.label}
      </a>
    </Button>
  );
}

interface Props {
  state: EntitlementDialogState;
  /** Control-plane origin used to resolve relative CTA URLs. */
  apiBase: string;
  onOpenChange: (open: boolean) => void;
}

export function EnvironmentEntitlementDialog({ state, apiBase, onOpenChange }: Props) {
  const spec = state.spec;
  return (
    <AlertDialog open={state.open} onOpenChange={(open) => { if (!open) onOpenChange(false); }}>
      <AlertDialogContent data-testid="environment-entitlement-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{spec?.title}</AlertDialogTitle>
          <AlertDialogDescription>{spec?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Close</AlertDialogCancel>
          {spec?.secondaryCta && (
            <CtaButton cta={spec.secondaryCta} apiBase={apiBase} primary={false} onNavigate={() => onOpenChange(false)} />
          )}
          {spec?.cta && (
            <CtaButton cta={spec.cta} apiBase={apiBase} primary onNavigate={() => onOpenChange(false)} />
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
