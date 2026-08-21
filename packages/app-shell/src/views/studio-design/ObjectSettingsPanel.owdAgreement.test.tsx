// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * AGREEMENT PIN — the two OWD authoring surfaces must reach the SAME ADR-0090
 * D11 verdict (objectui#5477).
 *
 * `owd-sharing.ts` declares itself "the single home for the pieces they must
 * agree on", but nothing held that claim up: `ObjectSettingsPanel` re-declared
 * `OWD_WIDTH` and the width comparison inline, and no test compared the two
 * surfaces. The copies happened to be equivalent, so the split cost nothing
 * *today* — the hazard was a future D11 refinement landing in the module while
 * the per-object Settings tab, the surface an author actually sets the dial on,
 * silently kept the old rule.
 *
 * Why this is not the tautology it could have been: asserting that the panel
 * CALLS `isExternalWider` would prove nothing about whether the comparison is
 * the same one — a re-inlined copy calls nothing at all, and a call spy stays
 * green when the (internal, external) arguments are swapped. So the assertion
 * here is behavioural, and it runs across the boundary the drift would cross —
 * the two SURFACES:
 *
 *   • `ObjectSettingsPanel`     — the per-object Settings tab, one pair at a time.
 *   • `PackageOwdOverviewPanel` — the package-level overview, N rows at once.
 *
 * Both are driven over the FULL cross-product of the five values their dials
 * offer (unset + the four canonical OWD models — 25 pairs). Each surface's
 * verdict is read off what it RENDERS, never off an internal symbol, and all
 * three legs — surface A, surface B, and `isExternalWider` itself — must agree
 * on every pair. Re-inline a drifted copy into either surface, swap the
 * argument order, or refine D11 in only one place, and this goes red naming
 * the offending pairs.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, within } from '@testing-library/react';
import React from 'react';
import { ObjectSettingsPanel } from './ObjectSettingsPanel';
import { PackageOwdOverviewPanel } from './PackageOwdOverviewPanel';
import { isExternalWider } from './owd-sharing';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Everything an author can actually put on either dial: unset, plus the four
 * canonical OWD models (ADR-0090 D4). `controlled_by_parent` is deliberately
 * included on BOTH axes — it sits off the width ordering, and "off the axis
 * never trips D11" is exactly the kind of edge a re-inlined copy gets wrong.
 */
const OWD_DIAL_VALUES = ['', 'private', 'public_read', 'public_read_write', 'controlled_by_parent'] as const;

const label = (v: string) => v || '(unset)';
const pairLabel = (internal: string, external: string) => `${label(internal)} → ${label(external)}`;

const baseDraft = {
  fields: {
    name: { type: 'text', label: 'Name' },
    status: { type: 'select', label: 'Status' },
  },
};

/** An object body carrying exactly this OWD pair (unset → key absent). */
function bodyFor(internal: string, external: string): Record<string, unknown> {
  const body: Record<string, unknown> = { ...baseDraft };
  if (internal) body.sharingModel = internal;
  if (external) body.externalSharingModel = external;
  return body;
}

/**
 * Surface A's verdict, read off the rendered D11 hint. The branch is encoded
 * twice — amber styling AND the "wider" copy — so both are read and required
 * to agree; a half-updated branch must not be able to read as "calm".
 */
function settingsPanelVerdict(internal: string, external: string): boolean {
  const view = render(
    <ObjectSettingsPanel
      name="leave_request"
      draft={bodyFor(internal, external)}
      onPatch={vi.fn()}
      locale="en-US"
    />,
  );
  const desc = within(view.container).getByTestId('owd-external-desc');
  const styledAsViolation = /amber/.test(desc.className);
  const copyIsViolation = /WIDER than the internal sharing model/.test(desc.textContent ?? '');
  view.unmount();
  if (styledAsViolation !== copyIsViolation) {
    throw new Error(
      `ObjectSettingsPanel half-rendered the D11 branch for ${pairLabel(internal, external)}: ` +
        `amber=${styledAsViolation} copy=${copyIsViolation}`,
    );
  }
  return styledAsViolation;
}

/** Row id for the overview's one-object-per-pair fixture package. */
const rowName = (internal: string, external: string) =>
  `owd_${internal || 'unset'}__${external || 'unset'}`;

/** A metadata client serving one object per (internal, external) pair. */
function makeClient(objects: Record<string, Record<string, unknown>>) {
  return {
    list: async (type: string) =>
      type === 'object' ? Object.keys(objects).map((name) => ({ name, label: name })) : [],
    listDrafts: async () => [],
    layered: async (_type: string, name: string) => ({ effective: objects[name] ?? {}, code: null }),
    getDraft: async () => null,
    save: async () => ({}),
  } as unknown as React.ComponentProps<typeof PackageOwdOverviewPanel>['client'];
}

/**
 * Surface B's verdicts for every pair, in ONE render: the overview flags a row
 * by rendering `owd-error-<name>` beside its external dial, so presence of that
 * node IS the row's verdict.
 */
async function overviewVerdicts(): Promise<(internal: string, external: string) => boolean> {
  const objects: Record<string, Record<string, unknown>> = {};
  for (const internal of OWD_DIAL_VALUES) {
    for (const external of OWD_DIAL_VALUES) {
      objects[rowName(internal, external)] = bodyFor(internal, external);
    }
  }
  const view = render(
    <PackageOwdOverviewPanel
      client={makeClient(objects)}
      packageId="com.example.owd_agreement_pin"
      locale="en-US"
    />,
  );
  const scope = within(view.container);
  // The table is filled from an async load; wait for the last row to exist.
  await scope.findByTestId(`owd-row-${rowName('controlled_by_parent', 'controlled_by_parent')}`);
  const flagged = new Set(
    Array.from(view.container.querySelectorAll('[data-testid^="owd-error-"]')).map((el) =>
      (el.getAttribute('data-testid') ?? '').replace('owd-error-', ''),
    ),
  );
  // Every pair must have produced a row — otherwise "not flagged" would be
  // indistinguishable from "never rendered", and the sweep would go vacuous.
  for (const internal of OWD_DIAL_VALUES) {
    for (const external of OWD_DIAL_VALUES) {
      scope.getByTestId(`owd-row-${rowName(internal, external)}`);
    }
  }
  return (internal, external) => flagged.has(rowName(internal, external));
}

describe('OWD D11 — the two authoring surfaces agree (objectui#5477)', () => {
  it('flags exactly the same (internal, external) pairs on both surfaces and in owd-sharing', async () => {
    const overview = await overviewVerdicts();

    const disagreements: string[] = [];
    const violations: string[] = [];
    for (const internal of OWD_DIAL_VALUES) {
      for (const external of OWD_DIAL_VALUES) {
        const settings = settingsPanelVerdict(internal, external);
        const overviewSaysWider = overview(internal, external);
        const shared = isExternalWider(internal || undefined, external || undefined);
        if (settings) violations.push(pairLabel(internal, external));
        if (settings !== overviewSaysWider || settings !== shared) {
          disagreements.push(
            `${pairLabel(internal, external)}: ObjectSettingsPanel=${settings} ` +
              `PackageOwdOverviewPanel=${overviewSaysWider} isExternalWider=${shared}`,
          );
        }
      }
    }

    expect(disagreements).toEqual([]);

    // Non-vacuity anchor. Three-way agreement alone would still pass if every
    // leg went silently false (a broken render flags nothing, a broken helper
    // returns nothing) — so pin WHICH pairs the shared axis calls a violation:
    // private < public_read < public_read_write, and nothing involving unset or
    // the off-axis `controlled_by_parent`.
    expect(violations).toEqual([
      'private → public_read',
      'private → public_read_write',
      'public_read → public_read_write',
    ]);
    expect(violations.length).toBeLessThan(OWD_DIAL_VALUES.length ** 2);
  });
});
