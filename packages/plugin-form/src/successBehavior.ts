/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Declarative post-success behaviors shared by ObjectForm + WizardForm. A
 * metadata-only form (authored as JSON) cannot pass an `onSuccess` function, so
 * these let it declare what happens after a create/update: a custom toast
 * (`successMessage`), navigate to the new record (`navigateOnSuccess`), or reset
 * for another entry (`resetOnSuccess`).
 *
 * Kept dependency-free on purpose: importing the redirect guard from
 * EmbeddableForm would create a cycle (EmbeddableForm → ObjectForm → WizardForm
 * → here), so the same-origin check is inlined.
 */

export type { SubmitBehavior } from '@object-ui/types';

/**
 * Same-origin guard for declarative navigation (relative or absolute URLs).
 *
 * **Scope note (objectui#4989).** This guard used to gate `submitBehavior:
 * { kind: 'redirect' }` too. It no longer does: objectstack#7496 ruled that key
 * RELATIVE-ONLY, and `submitRedirect.ts` gets that verdict from the spec's own
 * `FormViewSchema`. Relative-only is strictly stronger than same-origin — a
 * rooted relative path is same-origin by construction — so keeping this call in
 * that arm as defence-in-depth would add no defence, while its converse (it says
 * yes to `https://own-host/thanks`) was exactly the defect: this consumer
 * accepted a spelling the authoring door now refuses, which is how a rejected
 * spelling stays alive in a corpus.
 *
 * It survives because {@link resolveSuccessNavigate} still needs it. That serves
 * `navigateOnSuccess` — a DIFFERENT declared key with its own `{id}` /
 * `{recordId}` dialect, no relative-only ruling, and its own contract question
 * still open. Deleting the guard would silently widen that key.
 */
export function isSameOriginUrl(rawUrl: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const url = new URL(rawUrl, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Resolve a `navigateOnSuccess` template into a safe URL: interpolate
 * `{id}` / `{recordId}` from the created/updated record and same-origin-guard it.
 * Returns null when there's no template, no usable id, or the URL fails the
 * guard — callers then fall back to a toast.
 */
export function resolveSuccessNavigate(
  template: string | undefined,
  record: any,
): string | null {
  if (!template) return null;
  const id = record?.id ?? record?.recordId ?? record?._id;
  if (id == null || id === '') return null;
  const url = template.replace(/\{(?:id|recordId)\}/g, String(id));
  return isSameOriginUrl(url) ? url : null;
}
