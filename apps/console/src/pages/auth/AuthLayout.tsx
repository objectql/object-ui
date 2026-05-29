/**
 * AuthLayout — shared shell for every unauthenticated Console surface
 * (login, register, forgot-password, reset-password, verify-email, setup,
 * oauth/consent, auth/device, accept-invitation).
 *
 *   ┌─────────────────────────────────────────┐
 *   │               ◇ ObjectOS                 │
 *   │          ┌─────────────────┐             │
 *   │          │  centred form   │             │
 *   │          └─────────────────┘             │
 *   │     (faint dot-grid + soft brand glow)    │
 *   └─────────────────────────────────────────┘
 *
 * Content-first, refined-centred layout: a near-neutral canvas with a faint
 * dot-grid and a single soft brand glow for depth, a restrained product
 * wordmark above the card (server-driven product name, default "ObjectOS",
 * so operators can rebrand), and the form itself rendered by each page.
 *
 * A small host pill is still shown when the page renders on what looks like a
 * tenant subdomain so a user bouncing through an SSO redirect can tell which
 * workspace they're signing in to. It is suppressed on local/loopback hosts,
 * which carry no tenant meaning.
 *
 * Mirrors `framework/apps/account/src/components/auth/auth-shell.tsx` so the
 * Console-hosted auth pages stay visually aligned with the legacy Account SPA.
 */

import { useEffect, type ReactNode } from 'react';
import { useObjectTranslation } from '@object-ui/i18n';
import { cn } from '@object-ui/components';
import { getProductName } from '@object-ui/app-shell';

export interface AuthLayoutProps {
  children: ReactNode;
  /** Optional max-width on the form container (default `sm`). */
  formWidth?: 'sm' | 'md';
}

function isCanonicalCloudHost(host: string): boolean {
  const bare = host.split(':')[0]!.toLowerCase();
  return /^cloud\./.test(bare);
}

/**
 * Local dev / loopback hosts carry no tenant meaning, so the host pill
 * (which exists to disambiguate the SSO workspace) is just noise there.
 */
function isLocalHost(host: string): boolean {
  const bare = host.split(':')[0]!.toLowerCase();
  return bare === 'localhost' || bare === '127.0.0.1' || bare === '[::1]' || bare.endsWith('.local');
}

function currentHost(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.host || null;
}

/**
 * Restrained brand mark shown above the auth card — a layered "stack" glyph
 * on the indigo→violet brand gradient plus the product wordmark.
 *
 * The product name is server-driven (runtime-config `branding.productName`,
 * default "ObjectOS") so downstream operators can rebrand the auth surface
 * without code changes. We never hard-code a vendor name here.
 */
function BrandMark() {
  const productName = getProductName();
  return (
    <div className="flex items-center justify-center gap-2.5 select-none">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-violet-500/30">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2 2 7l10 5 10-5-10-5Z" />
          <path d="m2 17 10 5 10-5" />
          <path d="m2 12 10 5 10-5" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight text-foreground">{productName}</span>
    </div>
  );
}

export function AuthLayout({ children, formWidth = 'sm' }: AuthLayoutProps) {
  const { t } = useObjectTranslation();
  const widthCls = formWidth === 'md' ? 'max-w-md' : 'max-w-sm';

  const host = currentHost();
  const showHostPill = !!host && !isCanonicalCloudHost(host) && !isLocalHost(host);

  useEffect(() => {
    if (typeof document === 'undefined' || !host) return;
    const original = document.title;
    if (showHostPill) document.title = host;
    return () => {
      document.title = original;
    };
  }, [host, showHostPill]);

  return (
    <div className="relative flex min-h-svh w-full items-center justify-center overflow-hidden bg-background p-6">
      {/* Refined depth: a faint dot-grid fading toward the edges, plus a single
          soft indigo→violet glow behind the card. Kept very low-opacity so the
          canvas reads as calm and neutral, not a marketing wash. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.25] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]"
          style={{
            backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-indigo-500/10 to-violet-500/10 blur-3xl dark:from-indigo-500/10 dark:to-violet-600/10" />
      </div>

      <div className={cn('flex w-full flex-col gap-5', widthCls)}>
        <BrandMark />
        {showHostPill ? (
          <div className="flex justify-center">
            <span
              className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
              title={t('auth.shell.tenantHostHint', {
                defaultValue: 'You are signing in to this workspace',
              })}
            >
              {host}
            </span>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
