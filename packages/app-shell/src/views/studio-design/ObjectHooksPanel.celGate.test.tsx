// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The object hooks panel owns its OWN per-hook Save (it writes the hook
 * directly with `client.save('hook', …, { mode: 'draft' })` — the object's Save
 * draft does not cover hooks), so it must refuse to write a guard whose CEL
 * does not parse — objectui#4527 phase 2.
 *
 * Of the four panel hosts the #4547 census surfaced, this is the only one that
 * owns a Save button; the other three write through the Data pillar's draft and
 * report upward instead. So this suite is the end-to-end proof for the
 * hook branch of the default-inspector family: HookDefaultInspector's verdict
 * has to reach a real disabled button, not just a callback.
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

const hook = {
  name: 'guard_hook',
  label: 'Guard',
  object: 'invoice',
  events: ['beforeInsert'],
  handler: 'guard_fn',
};

const mockClient = {
  list: vi.fn(async () => [hook]),
  listDrafts: vi.fn(async () => []),
  getDraft: vi.fn(async () => null),
  // The curated hook editor resolves the bound object's field catalog through
  // `useObjectFields` -> `client.get`.
  get: vi.fn(async () => null),
  save: vi.fn(async () => ({})),
};

vi.mock('../metadata-admin/useMetadata', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../metadata-admin/useMetadata')>();
  return { ...mod, useMetadataClient: () => mockClient };
});

import { ObjectHooksPanel } from './ObjectHooksPanel';
import { registerBuiltinInspectors } from '../metadata-admin/inspectors';
import { __setCelFormulaLoader } from '../metadata-admin/celAuthoring';

// The panel resolves the curated hook editor through the default registry.
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

const saveButton = () => screen.getByRole('button', { name: /Save/i });

/** Open the panel, select the hook, and switch its guard into raw CEL mode. */
async function openGuard() {
  render(<ObjectHooksPanel objectName="invoice" packageId="com.example.showcase" />);
  fireEvent.click(await screen.findByText('Guard'));
  fireEvent.click(await screen.findByText('Expression'));
  return screen.getAllByRole('combobox').find((el) => el.tagName === 'TEXTAREA') as HTMLTextAreaElement;
}

describe('ObjectHooksPanel — its own Save refuses a guard that does not parse (#4527)', () => {
  it('disables Save while the hook guard is malformed', async () => {
    const box = await openGuard();

    // A valid guard first: dirties the draft (so Save is live at all) and pins
    // the must-not-change half — a good guard never blocks.
    fireEvent.change(box, { target: { value: "record.status == 'open'" } });
    await waitFor(() => expect(saveButton()).toBeEnabled(), { timeout: 4000 });

    fireEvent.change(box, { target: { value: 'record.status ==' } });
    await waitFor(() => expect(saveButton()).toBeDisabled(), { timeout: 4000 });
  });

  it('re-enables Save once the guard parses again', async () => {
    const box = await openGuard();

    fireEvent.change(box, { target: { value: 'record.status ==' } });
    await waitFor(() => expect(saveButton()).toBeDisabled(), { timeout: 4000 });

    fireEvent.change(box, { target: { value: "record.status == 'open'" } });
    await waitFor(() => expect(saveButton()).toBeEnabled(), { timeout: 4000 });
  });

  it('never writes the malformed hook', async () => {
    const box = await openGuard();
    fireEvent.change(box, { target: { value: 'record.status ==' } });
    await waitFor(() => expect(saveButton()).toBeDisabled(), { timeout: 4000 });

    fireEvent.click(saveButton());
    expect(mockClient.save).not.toHaveBeenCalled();
  });
});
