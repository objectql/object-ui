// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * "Save draft" must refuse a formula that does not parse — objectui#4306.
 *
 * This is the card's literal repro, end to end in the host that owns the
 * button: metadata designer, Data pillar, a formula field, `record.est_hours *`
 * in the formula box. Before the fix that button stayed enabled, the PUT
 * returned 200 with a success toast, and publishing made the malformed
 * expression the live field definition.
 *
 * The inspector-side aggregation is pinned in
 * {@link file://../metadata-admin/inspectors/ObjectFieldInspector.celGate.test.tsx};
 * what this suite adds is the half that only the HOST can prove:
 *
 *  - the count actually reaches the button and disables it, with the same
 *    message the RLS editor already shows;
 *  - the host RESETS its own count when the selection changes or the inspector
 *    unmounts (ruling sub-decision A) — writability must never depend on a
 *    child's teardown running, or closing the panel on a faulty formula leaves
 *    Save wedged shut with no editor on screen to fix it.
 *
 * The engine is stubbed so the verdict is deterministic; the live lint is
 * CelPredicateField.test.tsx's job.
 */

import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const objectDef = {
  name: 'showcase_task',
  label: 'Task',
  fields: [
    { name: 'est_hours', label: 'Est hours', type: 'number' },
    { name: 'total', label: 'Total', type: 'formula' },
  ],
};

const mockClient = {
  list: vi.fn(async () => [{ name: 'showcase_task', label: 'Task' }]),
  listDrafts: vi.fn(async () => []),
  layered: vi.fn(async () => ({ effective: objectDef, code: objectDef })),
  getDraft: vi.fn(async () => null),
};

vi.mock('../metadata-admin/useMetadata', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../metadata-admin/useMetadata')>();
  return {
    ...mod,
    useMetadataClient: () => mockClient,
    useMetadataTypes: () => ({ entries: [] }),
  };
});

vi.mock('./packages-io', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./packages-io')>();
  return { ...mod, fetchPackages: vi.fn(async () => []) };
});

vi.mock('@object-ui/react', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@object-ui/react')>();
  return { ...mod, useAdapter: () => ({}) };
});

import { DataPillar } from './StudioDesignSurface';
import { registerBuiltinInspectors } from '../metadata-admin/inspectors';
import { __setCelFormulaLoader } from '../metadata-admin/celAuthoring';

// The right rail resolves the field inspector through the registry.
registerBuiltinInspectors();

afterEach(() => {
  cleanup();
  __setCelFormulaLoader(undefined);
});

const DANGLING = /[*+\-/&|=<>]\s*$/;

function stubEngine() {
  __setCelFormulaLoader(() =>
    Promise.resolve({
      validateExpression: (_role: string, input: unknown) => {
        const src = typeof input === 'string' ? input : String((input as { source?: string })?.source ?? '');
        return DANGLING.test(src)
          ? { ok: false, errors: [{ message: 'Parse error: expression ends after an operator' }], warnings: [] }
          : { ok: true, errors: [], warnings: [] };
      },
      introspectScope: () => ({ fields: ['est_hours'], roots: ['record'], functions: ['has'] }),
      inferExpressionType: () => 'number' as const,
    }),
  );
}

const saveDraft = () => screen.getByRole('button', { name: /Save draft/i });

/** Open the Data pillar's form tab and select the formula field. */
async function openFormulaField() {
  stubEngine();
  render(
    <MemoryRouter initialEntries={['/studio/com.example.showcase/data']}>
      <DataPillar packageId="com.example.showcase" />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Form' }));
  const card = (await screen.findByText('Total')).closest('.cursor-grab') as HTMLElement;
  fireEvent.click(card);
  const label = await screen.findByText('Formula (CEL)');
  return label.parentElement!.querySelector('[role="combobox"]') as HTMLTextAreaElement;
}

describe('DataPillar — Save draft is gated on the field inspector’s CEL verdict (#4306)', () => {
  it("refuses the card's repro: a dangling operator disables Save draft", async () => {
    const box = await openFormulaField();

    // A valid formula first: this both dirties the draft (so Save is live at
    // all) and pins the must-not-change half — a good formula never blocks.
    fireEvent.change(box, { target: { value: 'record.est_hours * 2' } });
    await waitFor(() => expect(saveDraft()).toBeEnabled(), { timeout: 3000 });

    // Now the card's exact input.
    fireEvent.change(box, { target: { value: 'record.est_hours *' } });
    await waitFor(() => expect(saveDraft()).toBeDisabled(), { timeout: 3000 });
    expect(saveDraft()).toHaveAttribute('title', 'Fix the CEL syntax errors before saving.');
  });

  it('re-enables Save draft once the formula parses again', async () => {
    const box = await openFormulaField();

    fireEvent.change(box, { target: { value: 'record.est_hours *' } });
    await waitFor(() => expect(saveDraft()).toBeDisabled(), { timeout: 3000 });

    fireEvent.change(box, { target: { value: 'record.est_hours * 2' } });
    await waitFor(() => expect(saveDraft()).toBeEnabled(), { timeout: 3000 });
  });

  /**
   * Sub-decision A. Closing the panel unmounts the inspector, so nothing will
   * ever report `0` for it — the host must drop the count on its own or Save
   * stays disabled forever with no editor on screen to fix.
   */
  it('drops the count when the inspector closes, so Save cannot wedge shut', async () => {
    const box = await openFormulaField();

    fireEvent.change(box, { target: { value: 'record.est_hours *' } });
    await waitFor(() => expect(saveDraft()).toBeDisabled(), { timeout: 3000 });

    // Two "Close" buttons dismiss the panel — the rail header's and the
    // inspector shell's own; either clears the selection.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByText('Formula (CEL)')).toBeNull(), { timeout: 3000 });
    await waitFor(() => expect(saveDraft()).toBeEnabled(), { timeout: 3000 });
  });
});
