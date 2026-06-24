/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * EmbeddableForm Component
 *
 * A standalone embeddable form that can be accessed without authentication.
 * Designed for external data collection use cases (surveys, registrations, etc.).
 *
 * Features:
 * - Renders from ObjectFormSchema or inline field definitions
 * - No authentication required (public access)
 * - URL prefill parameters support (?name=John&email=...)
 * - Configurable branding (logo, colors, title)
 * - Success/thank-you page after submission
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { DataSource, FormField } from '@object-ui/types';
import { Button } from '@object-ui/components';
import { CheckCircle2, Lock, Loader2, ShieldCheck } from 'lucide-react';
import { ObjectForm } from './ObjectForm';

export interface EmbeddableFormTexts {
  submit?: string;
  submitting?: string;
  submitAnother?: string;
  poweredBy?: string;
  secureNotice?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  /** Template string. `{{seconds}}` will be replaced with the remaining seconds. */
  redirecting?: string;
  requiredHint?: string;
  consentLabelDefault?: string;
  consentLink?: string;
  consentRequired?: string;
  rateLimited?: string;
  redirectBlocked?: string;
}

export interface EmbeddableFormConfig {
  /** Unique form ID */
  formId: string;
  /** Object name to create records in */
  objectName: string;
  /** Form title displayed at the top */
  title?: string;
  /** Form description / instructions */
  description?: string;
  /** Fields to include in the form (subset of object fields) */
  fields?: string[];
  /** Custom field definitions for inline forms */
  customFields?: FormField[];
  /** Branding configuration */
  branding?: {
    logo?: string;
    /** Hero cover image rendered above the form card (Airtable-style). */
    coverImage?: string;
    primaryColor?: string;
    backgroundColor?: string;
  };
  /** Thank you page configuration */
  thankYouPage?: {
    title?: string;
    message?: string;
    redirectUrl?: string;
    redirectDelay?: number;
  };
  /** Allow multiple submissions */
  allowMultiple?: boolean;
  /** Localized UI chrome strings (submit label, footer, thank-you defaults). */
  texts?: EmbeddableFormTexts;

  // ── Anti-spam / security ─────────────────────────────────────────────────

  /**
   * Honeypot field name. The form renders an invisible input by this name —
   * humans never see/fill it, bots almost always do. When non-empty on submit
   * we silently accept (showing the thank-you screen) but never call the
   * backend. Set to `false` to disable, omit to use the default `_company_website_2`.
   */
  honeypot?: string | false;

  /**
   * Minimum time (in ms) between mount and submit. Submissions faster than
   * this are silently rejected with a "please review" hint — bots typically
   * submit within milliseconds. Defaults to 1500 ms. Set to 0 to disable.
   */
  minFillTime?: number;

  /**
   * URL prefill whitelist. Only field names in this list will be populated
   * from `?key=value` query string parameters. When `undefined`, **no** URL
   * prefill is applied (secure-by-default). Explicit `prefillParams` prop
   * still bypasses this gate for trusted host-side prefills.
   */
  allowedPrefillFields?: string[];

  /**
   * Hosts that `thankYouPage.redirectUrl` is allowed to point at, in addition
   * to the form's own origin. Cross-origin redirects to anything else are
   * blocked to prevent the form from being weaponised as a phishing relay.
   * @example ['example.com', '*.example.com']
   */
  allowedRedirectHosts?: string[];

  /** GDPR-style consent checkbox shown above the submit button. */
  consent?: {
    /** When true (default), the form cannot be submitted until the box is checked. */
    required?: boolean;
    /** Inline label. Defaults to a localized "I agree to the privacy policy". */
    label?: string;
    /** When set, a link rendered next to the label opens this URL in a new tab. */
    privacyUrl?: string;
  };

  /** Privacy policy URL rendered in the footer (separate from the consent link). */
  privacyPolicyUrl?: string;

  /** Optional anti-spam token (e.g. hCaptcha/Turnstile) attached to the submit payload. */
  captchaToken?: string;
}

export interface EmbeddableFormProps {
  /** Form configuration */
  config: EmbeddableFormConfig;
  /** Data source for creating records */
  dataSource?: DataSource;
  /** URL search parameters for prefilling fields (bypasses the URL whitelist). */
  prefillParams?: Record<string, string>;
  /** Additional CSS class */
  className?: string;
}

/** Hardened default caps applied to text-shaped customFields when the spec
 *  doesn't already define one. Mirrors Airtable/Tally defaults. */
const DEFAULT_MAX_LENGTH: Record<string, number> = {
  text: 200,
  email: 254, // RFC 5321
  url: 2048,
  phone: 32,
  textarea: 5000,
  markdown: 5000,
  html: 5000,
};

const DEFAULT_HONEYPOT_NAME = '_company_website_2';
const DEFAULT_MIN_FILL_MS = 1500;

/** Same-origin or explicit-host allowlist guard for thank-you redirects.
 *  Exported for unit-testing; treat as internal API. */
export function isRedirectUrlSafe(rawUrl: string, allowedHosts: string[] = []): boolean {
  try {
    const url = new URL(rawUrl, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    if (typeof window !== 'undefined' && url.origin === window.location.origin) return true;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return allowedHosts.some((pattern) => {
      if (pattern === url.host) return true;
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1); // ".example.com"
        return url.host.endsWith(suffix) && url.host.length > suffix.length;
      }
      return false;
    });
  } catch {
    return false;
  }
}

/** Apply default max-length caps to a custom-field list (non-destructive).
 *  Exported for unit-testing; treat as internal API. */
export function applyDefaultMaxLengths(fields: FormField[] | undefined): FormField[] | undefined {
  if (!fields) return fields;
  return fields.map((f) => {
    const t = String((f as any).type || '').toLowerCase();
    const cap = DEFAULT_MAX_LENGTH[t];
    if (!cap) return f;
    const existing = (f as any).maxLength ?? (f as any).max_length;
    if (existing) return f;
    return { ...f, maxLength: cap } as FormField;
  });
}

/**
 * EmbeddableForm — Standalone form for external data collection.
 *
 * Can be rendered at a public URL (e.g., `/forms/:formId`) without auth.
 * Submissions create records in the specified object via DataSource.
 */
export const EmbeddableForm: React.FC<EmbeddableFormProps> = ({
  config,
  dataSource,
  prefillParams,
  className,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentAccepted, setConsentAccepted] = useState<boolean>(
    !(config.consent?.required ?? !!config.consent),
  );
  const [consentError, setConsentError] = useState<string | null>(null);

  const honeypotRef = useRef<HTMLInputElement | null>(null);
  // Seeded lazily by the mount effect below — Date.now() is impure and must not
  // run during render. The effect always overwrites this before any submit.
  const mountedAtRef = useRef<number>(0);
  useEffect(() => {
    // Reset the mount timestamp whenever the form returns from the thank-you
    // screen so anti-bot timing measures the next interaction, not the first.
    if (!submitted) mountedAtRef.current = Date.now();
  }, [submitted]);

  const honeypotName = config.honeypot === false ? null : config.honeypot || DEFAULT_HONEYPOT_NAME;
  const minFillTime = config.minFillTime ?? DEFAULT_MIN_FILL_MS;

  // Apply hardened default max-length caps before the form ever sees the spec.
  const safeCustomFields = useMemo(
    () => applyDefaultMaxLengths(config.customFields),
    [config.customFields],
  );

  // When config provides a `fields: string[]` list (the public-form path),
  // ObjectForm needs `dataSource.getObjectSchema()` to render the inputs. We
  // pass a read-only wrapper that exposes schema lookup but neutralises any
  // mutating ops so EmbeddableForm's security gates remain the *only* path
  // to the backend (no double-write, no bypassed consent/honeypot checks).
  const formDataSource = useMemo(() => {
    if (!dataSource) return undefined;
    if (safeCustomFields && safeCustomFields.length > 0) return undefined;
    if (!config.fields || config.fields.length === 0) return undefined;
    const stub = async (_name: string, data: Record<string, unknown>) => data;
    return {
      ...dataSource,
      create: stub,
      update: (_n: string, _id: string, data: Record<string, unknown>) => Promise.resolve(data),
      delete: () => Promise.reject(new Error('Not permitted on public form')),
    } as typeof dataSource;
  }, [dataSource, safeCustomFields, config.fields]);

  // Build initial data — URL prefill is gated by an explicit field whitelist.
  const initialData = useMemo(() => {
    const data: Record<string, string> = {};
    // Explicit prefillParams (set programmatically by the host) bypass the
    // URL whitelist — they're trusted by definition.
    if (prefillParams) {
      for (const [key, value] of Object.entries(prefillParams)) {
        data[key] = value;
      }
    }
    if (typeof window !== 'undefined' && config.allowedPrefillFields?.length) {
      const allowed = new Set(config.allowedPrefillFields);
      const urlParams = new URLSearchParams(window.location.search);
      urlParams.forEach((value, key) => {
        if (allowed.has(key) && !(key in data)) {
          data[key] = value;
        }
      });
    }
    return Object.keys(data).length > 0 ? data : undefined;
  }, [prefillParams, config.allowedPrefillFields]);

  const handleSubmit = useCallback(
    async (formData: Record<string, any>) => {
      // 0. Consent gate
      if (config.consent?.required && !consentAccepted) {
        setConsentError(config.texts?.consentRequired ?? 'Please accept the privacy policy to continue.');
        return;
      }
      setConsentError(null);

      // 1. Honeypot — silently accept and fake success without calling backend
      if (honeypotName && honeypotRef.current?.value) {
        setSubmitted(true);
        return;
      }

      // 2. Min-fill-time — softly reject (shows the "review your answers" hint)
      if (minFillTime > 0 && Date.now() - mountedAtRef.current < minFillTime) {
        setError(config.texts?.rateLimited ?? 'Please take a moment to review your answers before submitting.');
        return;
      }

      // Strip the honeypot from the outgoing payload defensively, even if the
      // current ObjectForm shouldn't carry it.
      const payload: Record<string, any> = { ...formData };
      if (honeypotName) delete payload[honeypotName];
      if (config.captchaToken) payload._captcha = config.captchaToken;

      setSubmitting(true);
      setError(null);

      try {
        if (dataSource) {
          await dataSource.create(config.objectName, payload);
        }
        setSubmitted(true);

        // Handle redirect after delay — guarded against open-redirect abuse
        const rawRedirect = config.thankYouPage?.redirectUrl;
        if (rawRedirect) {
          if (isRedirectUrlSafe(rawRedirect, config.allowedRedirectHosts)) {
            const delay = config.thankYouPage?.redirectDelay ?? 3000;
            setTimeout(() => {
              window.location.href = rawRedirect;
            }, delay);
          } else {
            // eslint-disable-next-line no-console
            console.warn('[EmbeddableForm] Blocked unsafe redirect target:', rawRedirect);
            setError(config.texts?.redirectBlocked ?? null);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit form. Please try again.');
      } finally {
        setSubmitting(false);
      }
    },
    [dataSource, config, consentAccepted, honeypotName, minFillTime],
  );

  const handleReset = useCallback(() => {
    setSubmitted(false);
    setError(null);
  }, []);

  // Branding styles
  const brandingStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    if (config.branding?.backgroundColor) {
      style.backgroundColor = config.branding.backgroundColor;
    }
    return style;
  }, [config.branding]);

  // Thank you page
  if (submitted) {
    const thankYou = config.thankYouPage;
    const texts = config.texts ?? {};
    const redirectSeconds = Math.ceil((thankYou?.redirectDelay ?? 3000) / 1000);
    const redirectingText = (texts.redirecting ?? 'Redirecting in {{seconds}} seconds…').replace(
      '{{seconds}}',
      String(redirectSeconds),
    );
    return (
      <div
        className={`min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-muted/40 via-background to-background ${className || ''}`}
        style={brandingStyle}
      >
        <div className="max-w-md w-full bg-card border rounded-xl shadow-sm p-8 text-center space-y-4">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {thankYou?.title || texts.thankYouTitle || 'Thank You!'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {thankYou?.message || texts.thankYouMessage || 'Your submission has been received successfully.'}
          </p>
          {config.allowMultiple && (
            <Button variant="outline" size="sm" onClick={handleReset} className="mt-2">
              {texts.submitAnother ?? 'Submit Another Response'}
            </Button>
          )}
          {thankYou?.redirectUrl && (
            <p className="text-xs text-muted-foreground">{redirectingText}</p>
          )}
        </div>
      </div>
    );
  }

  const texts = config.texts ?? {};
  const consentRequired = !!config.consent?.required;
  const consentId = `${config.formId}-consent`;
  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-muted/40 via-background to-background ${className || ''}`}
      style={brandingStyle}
    >
      <div className="max-w-2xl w-full bg-card border rounded-xl shadow-sm overflow-hidden">
        {/* Optional Airtable-style cover banner */}
        {config.branding?.coverImage && (
          <div
            className="h-28 sm:h-32 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(config.branding.coverImage)})` }}
            role="presentation"
          />
        )}

        {/* Header */}
        <div
          className="px-6 sm:px-8 pt-7 pb-5 border-b bg-muted/20"
          style={config.branding?.primaryColor ? { borderBottomColor: config.branding.primaryColor } : undefined}
        >
          {config.branding?.logo && (
            <img src={config.branding.logo} alt="" className="h-8 mb-4" />
          )}
          {config.title && (
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {config.title}
            </h1>
          )}
          {config.description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {config.description}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground/70 mt-3" aria-hidden="true">
            {texts.requiredHint ?? '* Required field'}
          </p>
        </div>

        {/* Form body */}
        <div className="relative px-6 sm:px-8 py-6">
          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive"
            >
              {error}
            </div>
          )}
          <ObjectForm
            schema={{
              type: 'object-form',
              objectName: config.objectName,
              mode: 'create',
              fields: config.fields,
              customFields: safeCustomFields,
              initialData,
              onSuccess: handleSubmit,
              submitText: submitting
                ? texts.submitting ?? 'Submitting...'
                : texts.submit ?? 'Submit',
            }}
            dataSource={formDataSource}
            // NOTE: when `formDataSource` is provided (the public-form
            // `fields: string[]` path) it is a read-only wrapper whose
            // `create/update/delete` are neutralised — ObjectForm can fetch
            // the object schema to render inputs, but only EmbeddableForm's
            // own `handleSubmit` (above) ever talks to the real backend, so
            // consent / honeypot / min-fill / redirect gates always run.
          />

          {/* Honeypot — visually & a11y hidden, off-screen, no autofocus */}
          {honeypotName && (
            <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
              <label htmlFor={`${config.formId}-${honeypotName}`}>Do not fill this field</label>
              <input
                ref={honeypotRef}
                id={`${config.formId}-${honeypotName}`}
                type="text"
                name={honeypotName}
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </div>
          )}

          {/* GDPR-style consent checkbox */}
          {config.consent && (
            <div className="mt-4">
              <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  id={consentId}
                  checked={consentAccepted}
                  onChange={(e) => {
                    setConsentAccepted(e.target.checked);
                    if (e.target.checked) setConsentError(null);
                  }}
                  aria-required={consentRequired || undefined}
                  aria-invalid={consentError ? 'true' : undefined}
                  aria-describedby={consentError ? `${consentId}-error` : undefined}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <span className="leading-relaxed">
                  {config.consent.label ?? texts.consentLabelDefault ?? 'I agree to the privacy policy.'}
                  {consentRequired && (
                    <span aria-hidden="true" className="text-destructive ml-0.5">*</span>
                  )}
                  {config.consent.privacyUrl && (
                    <>
                      {' '}
                      <a
                        href={config.consent.privacyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary hover:opacity-80"
                      >
                        {texts.consentLink ?? 'Privacy policy'}
                      </a>
                    </>
                  )}
                </span>
              </label>
              {consentError && (
                <p
                  id={`${consentId}-error`}
                  role="alert"
                  className="mt-1.5 text-xs text-destructive"
                >
                  {consentError}
                </p>
              )}
            </div>
          )}

          {submitting && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>{texts.submitting ?? 'Submitting…'}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span>
              {texts.secureNotice ??
                'Your information is transmitted securely and only used to respond to your request.'}
            </span>
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground/80">
            {config.privacyPolicyUrl && (
              <a
                href={config.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline hover:text-foreground"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {texts.consentLink ?? 'Privacy policy'}
              </a>
            )}
            <span>{texts.poweredBy ?? 'Powered by ObjectStack'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmbeddableForm;
