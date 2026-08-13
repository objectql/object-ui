// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The Data pillar's "Save draft" must refuse an object whose VALIDATION RULE
 * guard does not parse — objectui#4527 phase 2.
 *
 * #4536 gated this same button on the field inspector's CEL verdict
 * ({@link file://./DataPillar.celGate.test.tsx}). The pillar hosts three more
 * CEL-bearing surfaces that write through the very same draft and were left
 * ungated: the validations panel (rule guards), the actions panel (an action's
 * visible/disabled predicates) and the settings panel. None of them owns a Save
 * — their own headers say the Data pillar's Save draft owns the write — so the
 * pillar holds a SECOND stamped count for the panel family and folds it into
 * the same button.
 *
 * The stamp is the panel TAB: only one panel is mounted at a time, so leaving
 * the tab unmounts the reporter and it can never retract its last verdict.
 * Deriving the count against the live tab is what stops a fault authored under
 * "Rules" from wedging Save shut while the author is looking at "Fields".
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const objectDef = {
  name: 'showcase_task',
  label: 'Task',
  fields: [{ name: 'status', label: 'Status', type: 'text' }],
  validations: [
    {
      type: 'script',
      name: 'rule_a',
      label: 'Rule A',
      message: 'nope',
      severity: 'error',
      active: true,
    },
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

registerBuiltinInspectors();

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
      introspectScope: () => ({ fields: ['status'], roots: ['record'], functions: ['has'] }),
      inferExpressionType: () => 'boolean' as const,
    }),
  );
}

beforeEach(stubEngine);
afterEach(() => {
  cleanup();
  __setCelFormulaLoader(undefined);
});

const saveDraft = () => screen.getByRole('button', { name: /Save draft/i });

/** Open the pillar's Rules tab and put the selected rule's guard into raw CEL. */
async function openRuleGuard() {
  render(
    <MemoryRouter initialEntries={['/studio/com.example.showcase/data']}>
      <DataPillar packageId="com.example.showcase" />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Validations' }));
  fireEvent.click(await screen.findByText('Expression'));
  return screen.getAllByRole('combobox').find((el) => el.tagName === 'TEXTAREA') as HTMLTextAreaElement;
}

describe('DataPillar — Save draft is gated on the validations panel’s CEL verdict (#4527)', () => {
  it('refuses a rule guard that does not parse', async () => {
    const box = await openRuleGuard();

    // A valid guard first — dirties the draft and pins that a good guard never
    // blocks.
    fireEvent.change(box, { target: { value: "record.status == 'open'" } });
    await waitFor(() => expect(saveDraft()).toBeEnabled(), { timeout: 4000 });

    fireEvent.change(box, { target: { value: 'record.status ==' } });
    await waitFor(() => expect(saveDraft()).toBeDisabled(), { timeout: 4000 });
    expect(saveDraft()).toHaveAttribute('title', 'Fix the CEL syntax errors before saving.');
  });

  it('re-enables Save draft once the guard parses again', async () => {
    const box = await openRuleGuard();

    fireEvent.change(box, { target: { value: 'record.status ==' } });
    await waitFor(() => expect(saveDraft()).toBeDisabled(), { timeout: 4000 });

    fireEvent.change(box, { target: { value: "record.status == 'open'" } });
    await waitFor(() => expect(saveDraft()).toBeEnabled(), { timeout: 4000 });
  });

  /**
   * The tab stamp. Leaving Rules unmounts the panel, so it can never report
   * `0`; without deriving the count against the live tab, Save would stay
   * wedged shut on a surface with no CEL editor on screen at all.
   */
  it('expires the panel count when the author leaves the Rules tab', async () => {
    const box = await openRuleGuard();

    fireEvent.change(box, { target: { value: 'record.status ==' } });
    await waitFor(() => expect(saveDraft()).toBeDisabled(), { timeout: 4000 });

    fireEvent.click(screen.getByRole('button', { name: 'Form' }));
    await waitFor(() => expect(saveDraft()).toBeEnabled(), { timeout: 4000 });
  });
});
