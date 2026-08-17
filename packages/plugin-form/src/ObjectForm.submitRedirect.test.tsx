/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * What `ObjectForm` DOES with a declared `submitBehavior: { kind: 'redirect' }`
 * (objectui#4989), under the shape objectstack#7496 ruled on 2026-08-11 and
 * objectstack#7657 landed in `@objectstack/spec` (17.0.0 GA).
 *
 * The value-level consequences are pinned in `submitRedirect.test.ts` against the
 * spec's own schema. This file pins the things only the rendered component can
 * show, and each of them is one of the card's defects:
 *
 *   - **defect 2** — an out-of-contract destination is REFUSED VISIBLY. The write
 *     already succeeded, so the submitter sees the confirmation (and the form is
 *     gone, so there is nothing left to resubmit) plus the reason nothing was
 *     navigated to. Silence was the outcome the ruling's consumer half rules out,
 *     and it had a real cost: a still-filled form invites a second submit, which
 *     writes a second record.
 *   - **defect 3** — a SAME-ORIGIN ABSOLUTE url is refused. The old guard
 *     (`isSameOriginUrl`) said yes to it, so this consumer accepted a spelling the
 *     authoring door refuses.
 *   - **defect 5** — `{{record.field_name}}` is substituted from the record the
 *     submit just wrote, URL-escaped.
 *
 * **Defect 4 (mount-blindness) is deliberately NOT fixed** and is escalated on the
 * issue; `submitRedirect.mountBlind.test.tsx` carries that measurement. The
 * navigation here is therefore still `window.location.assign`, and these tests
 * assert the string it is called with — not that a mount was applied.
 *
 * ## Reverse verification — predicted before running, then measured
 *
 * 1. **Restoring `isSameOriginUrl(behavior.url)` around the old assign** (i.e.
 *    putting defect 2 and 3 back): the two refusal tests go RED and they go red in
 *    two DIFFERENT ways, which is the point of keeping them separate. The
 *    same-origin absolute case fails on the assign — the old guard says yes, so it
 *    navigates where the new code refuses. The protocol-relative case fails on the
 *    refusal being ABSENT: the old guard says no, so nothing happens at all, which
 *    is precisely the silence being fixed. The interpolation tests also go red
 *    (the old line assigned `behavior.url` verbatim, braces included).
 * 2. **Deleting only the `toast.error` + `setSubmitted` refusal arm** (keeping the
 *    schema parse, so the destination is simply dropped): the two refusal tests go
 *    RED on the visible-refusal assertions while every in-contract test stays
 *    green. That is the narrow change detector for defect 2 on its own — and note
 *    it reproduces the ORIGINAL bug exactly, which is why "the guard is stricter
 *    now" is not by itself a fix.
 * 3. **Deleting the `encodeURIComponent`**: `escapes an interpolated value into
 *    one segment` goes red here, alongside the unit file's escape block.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/react';
import React from 'react';

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('@object-ui/components', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, toast: { ...actual.toast, success: toastSuccess, error: toastError } };
});

import { ObjectForm } from './ObjectForm';
import { registerAllFields } from '@object-ui/fields';

registerAllFields();

const objectSchema = {
  name: 'o',
  fields: { name: { type: 'text', label: 'Name' } },
};

/** `create` answers the written record — the token scope, id included. */
const makeDS = (created: Record<string, unknown> = {}) => ({
  getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
  create: vi.fn(async (_o: string, d: any) => ({ id: 'r1', ...d, ...created })),
  update: vi.fn(),
  findOne: vi.fn(),
});

const waitInput = (c: HTMLElement, name: string) =>
  waitFor(() => {
    const el = c.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
    if (!el) throw new Error(`${name} not ready`);
    return el;
  });

async function submitWith(
  url: string,
  ds: ReturnType<typeof makeDS>,
  typed = 'Alpha',
  behaviorExtra: Record<string, unknown> = {},
) {
  const view = render(
    <ObjectForm
      schema={{
        type: 'object-form', objectName: 'o', mode: 'create',
        submitBehavior: { kind: 'redirect', url, ...behaviorExtra },
      } as any}
      dataSource={ds as any}
    />,
  );
  fireEvent.change(await waitInput(view.container, 'name'), { target: { value: typed } });
  fireEvent.submit(view.container.querySelector('form') as HTMLFormElement);
  await waitFor(() => expect(ds.create).toHaveBeenCalledTimes(1));
  return view;
}

let assign: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  assign = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
});

afterEach(() => {
  assign.mockRestore();
});

describe('ObjectForm redirect — an in-contract destination is followed', () => {
  it('navigates to a ruled relative path', async () => {
    const ds = makeDS();
    await submitWith('/apps/x/done', ds);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/apps/x/done'));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('substitutes the id of the record the write answered (defect 5)', async () => {
    const ds = makeDS();
    await submitWith('/thanks?ref={{record.id}}', ds);
    // `r1` came off the create response, not from what the user typed.
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/thanks?ref=r1'));
  });

  it('substitutes a value the user typed when the server echoes nothing for it', async () => {
    const ds = makeDS();
    await submitWith('/thanks?n={{record.name}}', ds, 'Alpha');
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/thanks?n=Alpha'));
  });

  it('escapes an interpolated value into one segment', async () => {
    // A server-side slug carrying a slash and a space must not become extra path
    // structure — a token is a VALUE in the path.
    const ds = makeDS({ slug: 'a/b c' });
    await submitWith('/t/{{record.slug}}', ds);
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/t/a%2Fb%20c'));
  });

  it('keeps the declared delay: nothing is assigned until it elapses', async () => {
    const ds = makeDS();
    // `delayMs` semantics are unchanged by objectui#4989 — the pause is still a
    // pause, and the destination is still reached when it ends. Measured with real
    // timers because the submit path is a chain of awaited promises: faking timers
    // around it makes the pre-delay observation race the resolution rather than
    // the delay, which is how the first draft of this test passed for the wrong
    // reason (a schema with no `delayMs` at all, i.e. a zero timer).
    await submitWith('/apps/x/done', ds, 'Alpha', { delayMs: 10_000 });
    expect(assign).not.toHaveBeenCalled();
  });

  it('reaches the destination once a (short) declared delay ends', async () => {
    const ds = makeDS();
    await submitWith('/apps/x/done', ds, 'Alpha', { delayMs: 5 });
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/apps/x/done'));
  });
});

describe('ObjectForm redirect — an out-of-contract destination is refused, not dropped', () => {
  it('refuses a SAME-ORIGIN absolute url and says so on screen (defects 2 + 3)', async () => {
    const ds = makeDS();
    // The old guard resolved this against `window.location.href` and compared
    // origins, so it answered TRUE and this form navigated to it. The contract
    // refuses the spelling outright.
    const { container } = await submitWith(`${window.location.origin}/thanks`, ds);

    // Refused: nowhere was navigated to.
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(assign).not.toHaveBeenCalled();

    // And the refusal is the spec's own author-facing prescription, on screen —
    // not only a toast that scrolls away, and emphatically not silence.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('RELATIVE path only');
    expect(alert.textContent).toContain('#7496');
    expect(vi.mocked(toastError).mock.calls[0][0]).toContain('RELATIVE path only');

    // The write SUCCEEDED, so the submitter is told that too — refusing the
    // destination must not read as "your submission failed".
    expect(screen.getByText('Thanks!')).toBeTruthy();
    expect(screen.getByText('Created')).toBeTruthy();

    // …and the still-filled form is GONE, so the duplicate-record move the old
    // silence invited is not available.
    expect(container.querySelector('input[name="name"]')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(ds.create).toHaveBeenCalledTimes(1);
  });

  it('refuses a protocol-relative destination — the leading slash is not enough', async () => {
    const ds = makeDS();
    // The old guard said NO to this one, and then did nothing whatsoever: this is
    // defect 2's silence in its purest form.
    await submitWith('//example.com/thanks', ds);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('protocol-relative');
    expect(assign).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledTimes(1);
    // Confirmed, once.
    expect(ds.create).toHaveBeenCalledTimes(1);
  });

  it('does not toast success as well — one outcome, one message', async () => {
    const ds = makeDS();
    await submitWith('//example.com/thanks', ds);
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
