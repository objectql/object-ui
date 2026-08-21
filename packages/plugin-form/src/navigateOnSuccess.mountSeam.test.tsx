/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#5034 points 1 and 2 — `navigateOnSuccess` stops being mount-blind,
 * and a refused destination stops being reported as a plain success.
 *
 * This key is consumed by the `else if (!schema.submitHandler)` arm of
 * `ObjectForm` and the trailing `else` of `WizardForm`. Both components already
 * held the injected-navigation seam that PR #5111 landed for
 * `submitBehavior.url` (objectui#4989 defect 4) — the `pendingRedirect` state
 * and `useSubmitRedirectNavigation` are ~440 lines above each of these arms —
 * and this arm was the one call site still going straight to
 * `window.location.assign`. So the change under test is a wiring change, and
 * these tests are about which function ends up receiving the destination.
 *
 * ## What is deliberately NOT touched, and why it is re-measured here
 *
 * WHICH destinations are accepted is `resolveSuccessNavigate`'s answer and
 * objectui#5548 is open on exactly that contract: the same-origin guard admits
 * ABSOLUTE same-origin URLs, the interpolation dialect is single-brace
 * `{id}`/`{recordId}`, and the substituted value is not escaped. None of those
 * are this card's to settle — answering one here would answer a formally open
 * contract question on the maintainer's behalf. The last describe block below
 * re-measures those verdicts, unchanged, so that a future edit to WHO travels
 * cannot quietly widen or narrow WHAT is accepted.
 *
 * ## The arm split, and why it is required rather than cautious
 *
 * `submitBehavior.url` is relative-only (objectstack#7496), so the shared hook
 * is correct to hand the host everything it ever holds. This key is not
 * relative-only — its same-origin guard accepts `https://own-host/record/1`
 * too — and `HostNavigationValue.navigate` declares `to` to be "an
 * already-resolved, application-relative path, never an absolute URL … It is
 * the CALLER's job to have judged the destination". So this call site judges:
 * an app-relative destination goes through the seam, anything else keeps the
 * browser-level `window.location.assign` it has always had. That is the same
 * judgement objectui#5112 made on `thankYouPage.redirectUrl`, whose acceptance
 * set has exactly this shape, and its predicate (`isAppRelativeDestination`) is
 * reused rather than re-derived.
 *
 * ## Reverse verification — direction PREDICTED before running, measured after
 *
 * The file holds 17 cases. Predicted counts, written before either was run:
 *
 * Mutation A, replacing the arm split at both call sites with the pre-change
 * body (a bare `window.location.assign(nav)`), leaving point 2 in place:
 *   - RED, expected — **3**: the 2 cases (one per component) asserting a host
 *     navigate RECEIVED an app-relative destination, plus the 1 mounted-host
 *     placement case. The seam would never be reached.
 *   - GREEN, expected — **14**, and two groups of those are deliberate rather
 *     than incidental: the 2 absent-seam cases and the 2 same-origin-absolute
 *     cases describe behaviour that was already correct and is unchanged by
 *     this card. They are the NEGATIVE CONTROL — without them, an
 *     implementation that also replaced the no-provider fallback, or that
 *     laundered an absolute URL through the host router, would pass this file
 *     just as well. The 8 point-2 cases survive because the refusal note is
 *     independent of the navigation site: mutation A is not a change detector
 *     for them, and counting them as one would overstate this file.
 *
 * Mutation B, dropping the `{ description }` argument from both success toasts
 * and leaving point 1 in place:
 *   - RED, expected — **7**: the 3 "declared but refused" cases per component
 *     (6) plus the cross-component agreement case.
 *   - GREEN, expected — **10**: the 2 "no key declared" cases assert the
 *     ABSENCE of a note and are unaffected by removing it — they exist to make
 *     the distinction the defect is about measurable, not to detect this
 *     mutation — and the 7 point-1 cases plus the verdict table are untouched.
 *
 * The measured outcome of both is recorded in the PR body.
 *
 * ## One property asserted by construction rather than by a case here
 *
 * Unmount-cancellation (the property objectui#5033 bought) reaches this arm
 * because it reuses the same hook — but this key declares no delay, so the arm
 * passes `delayMs: 0` and the observable window between arming and firing is a
 * single macrotask. A test of it would either be a race or would need fake
 * timers, in which case it would be measuring the timer rather than this arm's
 * wiring. It is pinned where it is observable, against a declared delay, in
 * `submitRedirect.timerLifetime.test.tsx`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, toast: { ...actual.toast, success: toastSuccess, error: toastError } };
});

import { HostNavigationProvider } from '@object-ui/react';
import { registerAllFields } from '@object-ui/fields';
import { ObjectForm } from './ObjectForm';
import { WizardForm, NAVIGATE_ON_SUCCESS_REFUSED_NOTE } from './WizardForm';
import { resolveSuccessNavigate } from './successBehavior';

registerAllFields();

/** The mount the framework CLI configures for an embedded deployment. */
const MOUNT = '/_console';

/** Authored app-relative destination — the shape this card is about. */
const RELATIVE_TEMPLATE = '/apps/x/o/record/{id}';
const RELATIVE_RESOLVED = '/apps/x/o/record/r1';

const objectSchema = {
  name: 'o',
  fields: { name: { type: 'text', label: 'Name' } },
};

/**
 * `create` answers the written record. `id: 'r1'` unless `omitId`, which is the
 * "no usable id" refusal cause — one of the two ways `resolveSuccessNavigate`
 * answers null, and the one an author cannot see coming.
 */
const makeDS = (opts: { omitId?: boolean } = {}) => ({
  getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
  create: vi.fn(async (_o: string, d: any) => (opts.omitId ? { ...d } : { id: 'r1', ...d })),
  update: vi.fn(),
  findOne: vi.fn(),
});

const waitInput = (c: HTMLElement, name: string) =>
  waitFor(() => {
    const el = c.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
    if (!el) throw new Error(`${name} not ready`);
    return el;
  });

interface SubmitOptions {
  /** The host's navigate, or `undefined` for a host that wires no seam. */
  navigate?: (to: string, options?: { replace?: boolean }) => void;
  wizard?: boolean;
  successMessage?: string;
}

/**
 * Render one form with (optionally) a declared `navigateOnSuccess`, fill it and
 * submit. Both components go through one helper deliberately: they consume the
 * seam through the same hook, and the risk this file guards is that one of them
 * stops doing so — or does so differently.
 */
async function submitWith(
  navigateOnSuccess: string | undefined,
  ds: ReturnType<typeof makeDS>,
  opts: SubmitOptions = {},
) {
  const { navigate, wizard = false, successMessage } = opts;
  const schema = {
    type: 'object-form',
    objectName: 'o',
    mode: 'create',
    ...(wizard ? { formType: 'wizard', sections: [{ label: 'A', fields: ['name'] }] } : {}),
    ...(navigateOnSuccess === undefined ? {} : { navigateOnSuccess }),
    ...(successMessage === undefined ? {} : { successMessage }),
  } as any;
  const form = wizard
    ? <WizardForm schema={schema} dataSource={ds as any} />
    : <ObjectForm schema={schema} dataSource={ds as any} />;

  const view = render(
    // No provider at all in the absent-seam cases: the default context value is
    // what a router-less host actually sees, and mounting a provider carrying
    // `navigate: undefined` would test a different (and easier) thing.
    navigate ? <HostNavigationProvider value={{ navigate }}>{form}</HostNavigationProvider> : form,
  );
  fireEvent.change(await waitInput(view.container, 'name'), { target: { value: 'Alpha' } });
  fireEvent.submit(view.container.querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(ds.create).toHaveBeenCalledTimes(1));
  return view;
}

let assign: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  assign.mockRestore();
  warnSpy.mockRestore();
});

// ─── Point 1, arm 1: an app-relative destination ───────────────────────────

describe.each([
  ['ObjectForm', false],
  ['WizardForm', true],
] as const)('objectui#5034 point 1 — %s navigateOnSuccess, app-relative', (_name, wizard) => {
  it('hands the destination to the host instead of navigating the browser', async () => {
    const navigate = vi.fn();
    await submitWith(RELATIVE_TEMPLATE, makeDS(), { navigate, wizard });

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(RELATIVE_RESOLVED));
    // The whole defect: `window.location.assign('/apps/x/o/record/r1')` resolves
    // against the ORIGIN root, so under a mounted host it left the application.
    // It must not happen at all when a host offered to place the path itself.
    expect(assign).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
    // Landing on the record is still the confirmation — no toast on this path.
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('NEGATIVE CONTROL: falls back to window.location.assign when no host wired a seam', async () => {
    await submitWith(RELATIVE_TEMPLATE, makeDS(), { wizard });

    // Byte-for-byte the previous behaviour. "Absent seam is not a degraded
    // mode" — a host with no router has no basename, so origin-rooted
    // resolution is already correct there. Without this case, an implementation
    // that replaced the fallback too would pass the case above just as well.
    await waitFor(() => expect(assign).toHaveBeenCalledWith(RELATIVE_RESOLVED));
    expect(assign).toHaveBeenCalledTimes(1);
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe('objectui#5034 point 1 — a mounted host places the destination inside its mount', () => {
  it('hands over a path the host can still place', async () => {
    // A STUB host navigate that joins its mount, standing in for a router with a
    // basename: this asserts the seam's consequence at this layer (the renderer
    // hands over a path a host can still place), not React Router's behaviour,
    // which is pinned against a real router in the app-shell bridge's own test.
    const visited: string[] = [];
    const navigate = (to: string) => visited.push(new URL(`.${to}`, `https://h${MOUNT}/`).pathname);

    await submitWith(RELATIVE_TEMPLATE, makeDS(), { navigate });

    await waitFor(() => expect(visited).toEqual([`${MOUNT}${RELATIVE_RESOLVED}`]));
    // The counterfactual, measured rather than asserted in prose: the same
    // string through a browser-level navigation resolves at the origin root and
    // leaves the application.
    expect(new URL(RELATIVE_RESOLVED, `https://h${MOUNT}/`).pathname).toBe(RELATIVE_RESOLVED);
  });
});

// ─── Point 1, arm 2: a same-origin ABSOLUTE destination ────────────────────

describe.each([
  ['ObjectForm', false],
  ['WizardForm', true],
] as const)('objectui#5034 point 1 — %s navigateOnSuccess, same-origin absolute', (_name, wizard) => {
  it('keeps browser-level navigation even when a host supplied a navigate', async () => {
    const navigate = vi.fn();
    const absolute = `${window.location.origin}/apps/x/o/record/{id}`;
    const resolved = `${window.location.origin}${RELATIVE_RESOLVED}`;

    await submitWith(absolute, makeDS(), { navigate, wizard });

    // The seam's declared input is an application-relative path, and it is the
    // caller's job to have judged that. Handing over a full address would mean
    // this package rewriting the author's address into a path a mounted router
    // then places at a DIFFERENT one. An author who spelled the whole address
    // asked for that address.
    await waitFor(() => expect(assign).toHaveBeenCalledWith(resolved));
    expect(navigate).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledTimes(1);
  });
});

// ─── Point 2: a refused destination is no longer a plain success ───────────

describe.each([
  ['ObjectForm', false],
  ['WizardForm', true],
] as const)('objectui#5034 point 2 — %s, a DECLARED navigateOnSuccess that is refused', (_name, wizard) => {
  it('says so on the success toast when the record carries no usable id', async () => {
    await submitWith(RELATIVE_TEMPLATE, makeDS({ omitId: true }), { wizard });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    // The write SUCCEEDED — this is still a success, not an error and not a
    // blocking panel. What is added is the single fact that was missing.
    expect(toastSuccess).toHaveBeenCalledWith(
      'Created',
      { description: NAVIGATE_ON_SUCCESS_REFUSED_NOTE },
    );
    expect(toastError).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    // The diagnosable detail — the template the author actually wrote — reaches
    // the author without putting a possibly-stale rule in user-visible copy.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('`navigateOnSuccess` was declared but produced no destination:'),
      RELATIVE_TEMPLATE,
    );
  });

  it('says so when the destination fails the same-origin guard', async () => {
    const offOrigin = 'https://evil.example.com/record/{id}';
    await submitWith(offOrigin, makeDS(), { wizard });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith(
      'Created',
      { description: NAVIGATE_ON_SUCCESS_REFUSED_NOTE },
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it('keeps the authored successMessage as the toast, and adds the note to it', async () => {
    await submitWith(RELATIVE_TEMPLATE, makeDS({ omitId: true }), {
      wizard,
      successMessage: 'Thanks!',
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    // The note rides on the declared message rather than replacing it: the
    // author's copy is still what the submitter reads first.
    expect(toastSuccess).toHaveBeenCalledWith(
      'Thanks!',
      { description: NAVIGATE_ON_SUCCESS_REFUSED_NOTE },
    );
  });

  it('THE DISTINCTION: a form declaring NO navigateOnSuccess gets no note', async () => {
    await submitWith(undefined, makeDS(), { wizard });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    // This is the defect restated as a measurement. Before this card both cases
    // produced exactly `toast.success('Created')`, so "the declared navigation
    // was refused" and "no navigation was ever declared" were indistinguishable
    // to the submitter. Asserting the ABSENCE of the note here is what makes the
    // presence of it above mean something.
    expect(toastSuccess).toHaveBeenCalledWith('Created');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('objectui#5034 point 2 — the two forms tell the submitter the same thing', () => {
  it('emits one identical note from both components', async () => {
    await submitWith(RELATIVE_TEMPLATE, makeDS({ omitId: true }), { wizard: false });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    const fromObjectForm = toastSuccess.mock.calls[0];

    toastSuccess.mockClear();
    await submitWith(RELATIVE_TEMPLATE, makeDS({ omitId: true }), { wizard: true });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    const fromWizardForm = toastSuccess.mock.calls[0];

    // Single-sourced constant, pinned as an observable rather than trusted: a
    // wizard and a flat form must not tell a submitter two different things
    // about one refusal.
    expect(fromObjectForm).toEqual(fromWizardForm);
    expect(fromObjectForm[1]).toEqual({ description: NAVIGATE_ON_SUCCESS_REFUSED_NOTE });
  });
});

// ─── The acceptance set this card does not touch (objectui#5548) ───────────

describe('objectui#5034 — `resolveSuccessNavigate` verdicts are unchanged', () => {
  it('answers exactly what it answered before the arm split', () => {
    // Restated next to the arm split so an edit that widens or narrows WHICH
    // destinations are accepted cannot pass as an edit to WHO travels. Each line
    // here is a shape objectui#5548 is open on; none is this card's to change.
    const origin = window.location.origin;

    // Relative, interpolated from `id` — the ordinary case.
    expect(resolveSuccessNavigate('/r/{id}', { id: 'r1' })).toBe('/r/r1');
    // The single-brace `{recordId}` dialect, and the `recordId` / `_id` fallbacks.
    expect(resolveSuccessNavigate('/r/{recordId}', { recordId: 'r2' })).toBe('/r/r2');
    expect(resolveSuccessNavigate('/r/{id}', { _id: 'r3' })).toBe('/r/r3');
    // A same-origin ABSOLUTE url is still ACCEPTED — it is only navigated
    // differently. This is the line that would move if #5548 ruled convergence.
    expect(resolveSuccessNavigate('{id}', { id: `${origin}/r` })).toBe(`${origin}/r`);
    expect(resolveSuccessNavigate(`${origin}/r/{id}`, { id: 'r1' })).toBe(`${origin}/r/r1`);
    // Cross-origin is refused by the same-origin guard.
    expect(resolveSuccessNavigate('https://evil.example.com/r/{id}', { id: 'r1' })).toBeNull();
    // No template, and no usable id, are both refusals.
    expect(resolveSuccessNavigate(undefined, { id: 'r1' })).toBeNull();
    expect(resolveSuccessNavigate('/r/{id}', {})).toBeNull();
    expect(resolveSuccessNavigate('/r/{id}', { id: '' })).toBeNull();
    // The interpolated value is still NOT escaped. Pinned as a fact rather than
    // fixed: it is one of the three shapes #5548 exists to rule on, and quietly
    // escaping it here would answer that question in a PR that claims not to.
    expect(resolveSuccessNavigate('/r/{id}', { id: 'a/b c' })).toBe('/r/a/b c');
  });
});
