/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#7638 — `ObjectCalendar`'s record-page URL follows the RECORD SOURCE.
 *
 * ## The divergence this closes, which THIS component proves was accidental
 *
 * On a single click this calendar used to resolve two receivers two different
 * ways: the detail drawer's `objectName` through the objectui#6939
 * record-source ladder, and the navigation URL through the bare top-level
 * `schema.objectName`. Two receivers, one gesture, two different objects —
 * which is the evidence that the divergence was a copy, not a design.
 *
 * The same `schemaObjectName` that keys this calendar's record query and its
 * `$expand` derivation now also builds the URL, so all three agree by
 * construction rather than by coincidence.
 *
 * ## What is asserted, and why not a spy on the resolver
 *
 * The observable is the URL a click actually navigates to, so every case drives
 * a real event click through the real `new_window` branch and reads
 * `window.open`'s first argument. Asserting `resolveRecordSourceObjectName` was
 * CALLED would pass equally well with its result discarded.
 *
 * `new_window` is the mode under test because it is the branch that builds the
 * URL in-process — the overlay modes open the drawer and build none, and the
 * `page` branch delegates to an `onNavigate` this call site never passes.
 *
 * ## The lit control
 *
 * The first case carries no `data` block, so rung three IS its record source
 * and `/appointments/record/e1` is both the old answer and the new one. It is
 * the instrument check and it must read NON-ZERO: a `window.open` that never
 * fires would make every "did not navigate to the decoy" assertion below
 * vacuously true, and this file would be a dark instrument reporting green.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectCalendar } from '../ObjectCalendar';

/** The object the rows really came from — what the URL must name. */
const RECORD_SOURCE = 'clinic_visit';
/** The top-level key, rung three — the decoy the URL must stop naming. */
const DECOY = 'appointments';

/**
 * One event on TODAY, so it lands in the default month view without the test
 * having to drive the calendar's navigation controls first.
 */
const TODAY = new Date();
const ROWS = [{ id: 'e1', name: 'Follow-up', starts_at: TODAY.toISOString() }];

function renderCalendar(schema: Record<string, unknown>) {
  return render(
    <ObjectCalendar
      schema={
        {
          type: 'object-calendar',
          calendar: { startDateField: 'starts_at', titleField: 'name' },
          navigation: { mode: 'new_window' },
          ...schema,
        } as never
      }
      data={ROWS as never}
    />,
  );
}

/** Click the event and hand back the URL `window.open` was given. */
async function clickEventAndReadUrl(
  open: ReturnType<typeof vi.spyOn>,
): Promise<string | undefined> {
  const event = await screen.findByText('Follow-up');
  fireEvent.click(event);
  await waitFor(() => expect(open).toHaveBeenCalled());
  return open.mock.calls[0]?.[0] as string | undefined;
}

let open: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  open = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ObjectCalendar navigation URL follows the record source (objectui#7638)', () => {
  it('LIT CONTROL: with no `data` block, rung three IS the record source and still builds the URL', async () => {
    renderCalendar({ objectName: DECOY });

    // Reads non-zero, or every assertion below is vacuous.
    expect(await clickEventAndReadUrl(open)).toBe(`/${DECOY}/record/e1`);
    expect(open).toHaveBeenCalledWith(`/${DECOY}/record/e1`, '_blank');
  });

  it('navigates to the object the ROWS came from, not the top-level key', async () => {
    renderCalendar({
      objectName: DECOY,
      data: { provider: 'object', object: RECORD_SOURCE },
    });

    const url = await clickEventAndReadUrl(open);
    expect(url).toBe(`/${RECORD_SOURCE}/record/e1`);
    // The whole finding in one line: before objectui#7638 this was the answer,
    // while the drawer on the very same click resolved `clinic_visit`.
    expect(url).not.toBe(`/${DECOY}/record/e1`);
  });

  it('builds a routed URL for a data-only block, which previously had no name to use', async () => {
    // No top-level `objectName` at all, so `schema.objectName` was `undefined`
    // and the hook took its `/${encodedId}` leg — an unrouted path that paints
    // a blank page.
    renderCalendar({ data: { provider: 'object', object: RECORD_SOURCE } });

    const url = await clickEventAndReadUrl(open);
    expect(url).toBe(`/${RECORD_SOURCE}/record/e1`);
    expect(url).not.toBe('/e1');
  });

  it('keeps the `?? schema.objectName` tail for the OFF-CONTRACT `{ provider: "object" }`', async () => {
    // `ViewDataSchema` declares `object` REQUIRED on the `object` provider, so
    // this shape is off-contract and the shared reader returns `undefined` for
    // it rather than coercing. The site keeps its own tail, so this conversion
    // changes nothing this component navigates to today.
    renderCalendar({ objectName: DECOY, data: { provider: 'object' } });

    expect(await clickEventAndReadUrl(open)).toBe(`/${DECOY}/record/e1`);
  });
});
