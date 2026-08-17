/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#4989 **defect 4 — mount-blindness — is NOT fixed**, and this file is
 * the measurement that says so out loud.
 *
 * The card filed five defects against how `packages/plugin-form` consumes
 * `submitBehavior: { kind: 'redirect' }`. Four are contract mechanics and are
 * fixed (`submitRedirect.ts`, plus the two rendered-component files): a
 * relative-only verdict taken from the spec's own schema, `{{record.field}}`
 * interpolation with URL-escaping, and a loud refusal in place of the silent
 * drop. Defect 4 asked something different — that a ruled in-app path such as
 * `/thanks` resolve INSIDE a host mounted at a sub-path — and that one cannot be
 * answered without learning the host's mount, which no mechanism available to
 * this package supplies without changing its published contract. It is escalated
 * on the issue rather than guessed at.
 *
 * A test asserting today's resolution could be misread as blessing it, so state
 * the direction plainly: **the second expectation below is the defect**. It is
 * pinned because an unpinned known defect becomes folklore — the next reader
 * finds a package that consumes the ruled key correctly in every other respect
 * and has no way to tell that this one leg was measured, weighed and deliberately
 * left open. When defect 4 is decided and implemented, this file is expected to
 * be REPLACED (not merely re-spelled) by one asserting the mount is applied.
 *
 * Why it is a bare URL-resolution test and not a rendered one: jsdom and
 * happy-dom do not navigate, so a rendered test can only observe that
 * `window.location.assign` was called with a string — which is what the two
 * component test files already do. The fact that makes that string WRONG under a
 * mount is a property of URL resolution, so it is measured where it lives. That
 * is the same idiom `apps/console`'s `FormPage.redirect.test.tsx` uses for the
 * counterfactual half of its own fix (PR #4992).
 */

import { describe, expect, it } from 'vitest';
import { resolveSubmitRedirect } from './submitRedirect';

/** The mount the framework CLI configures for an embedded deployment. */
const MOUNT = '/_console';

describe('objectui#4989 defect 4 — still open, measured here', () => {
  it('resolves an accepted path against the ORIGIN root, ignoring the mount', () => {
    const verdict = resolveSubmitRedirect('/thanks', {});
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;

    const baseEl = document.createElement('base');
    baseEl.setAttribute('href', `${MOUNT}/`);
    document.head.appendChild(baseEl);
    try {
      // The host advertises its mount in the document, and the accepted value is
      // a ruled in-app path…
      expect(document.baseURI).toContain(`${MOUNT}/`);
      expect(verdict.url).toBe('/thanks');

      // …and this is the defect: a rooted path resolves against the ORIGIN, so
      // `window.location.assign(verdict.url)` leaves the mounted app. The leading
      // `/` is what does it — the mount in `<base href>` is not consulted at all.
      expect(new URL(verdict.url, document.baseURI).pathname).toBe('/thanks');
      expect(new URL(verdict.url, document.baseURI).pathname).not.toBe(`${MOUNT}/thanks`);

      // For contrast, the same string resolved app-relatively DOES land inside
      // the mount. Recorded as one of the mechanisms weighed in the escalation —
      // NOT as the chosen answer, and deliberately not wired up here: picking it
      // would decide, unilaterally, how a published renderer discovers its mount.
      expect(new URL(`.${verdict.url}`, document.baseURI).pathname).toBe(`${MOUNT}/thanks`);
    } finally {
      baseEl.remove();
    }
  });

  it('is unaffected by the interpolation half — the token resolves, the mount still does not', () => {
    const verdict = resolveSubmitRedirect('/t/{{record.slug}}', { slug: 'a b' });
    expect(verdict).toEqual({ ok: true, url: '/t/a%20b' });

    const baseEl = document.createElement('base');
    baseEl.setAttribute('href', `${MOUNT}/`);
    document.head.appendChild(baseEl);
    try {
      // Escaping is done and correct; the destination is still outside the mount.
      expect(new URL(verdict.ok ? verdict.url : '', document.baseURI).pathname).toBe('/t/a%20b');
    } finally {
      baseEl.remove();
    }
  });

  it('has nothing to resolve wrongly when the host is NOT mounted', () => {
    // No `<base href>`: the origin root IS the app root, so today's browser-level
    // navigation is already correct. This is the half of defect 4 that is not a
    // defect, and it is why the escalation is about mounted hosts specifically.
    const verdict = resolveSubmitRedirect('/thanks', {});
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) return;
    expect(new URL(verdict.url, document.baseURI).pathname).toBe('/thanks');
  });
});
