/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectstack#3821 — a rejected write is user-facing copy, not server
 * diagnostics.
 *
 * The form used to render `error.message` verbatim, so a sharing/RLS denial
 * surfaced in the dialog and the toast as
 * `FORBIDDEN: insufficient privileges to update showcase_private_note
 * pi-TgoJ4_DM55Fqz` — untranslated, and leaking the object's machine name and
 * the record id to whoever hit it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ComponentRegistry } from '@object-ui/core';
// Registers the renderers at module scope, NOT inside a `beforeAll` — there the
// cold transform is billed to `hookTimeout`, which is why this carried a raised
// timeout. See object-ui/no-dynamic-import-in-test-hook (objectui#3010/#3021).
import '../renderers';

const SCHEMA = {
  type: 'form',
  fields: [{ name: 'title', label: 'Title', type: 'text' }],
  submitText: 'Save',
} as any;

function forbiddenError() {
  const err: any = new Error(
    'FORBIDDEN: insufficient privileges to update showcase_private_note pi-TgoJ4_DM55Fqz',
  );
  err.code = 'FORBIDDEN';
  err.status = 403;
  return err;
}

function renderForm(onAction: () => Promise<unknown>) {
  const Form = ComponentRegistry.get('form')!;
  // `onAction` is a PROP on the renderer, not part of the schema.
  return render(<Form schema={SCHEMA} onAction={onAction} />);
}

describe('form write errors are user-facing copy', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('shows a permission message instead of the raw FORBIDDEN text', async () => {
    renderForm(async () => { throw forbiddenError(); });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    const alert = await screen.findByText(/permission to save/i);
    expect(alert).toBeInTheDocument();
  });

  it('never leaks the object machine name or the record id', async () => {
    const { container } = renderForm(async () => { throw forbiddenError(); });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    await screen.findByText(/permission to save/i);
    expect(container.textContent).not.toMatch(/showcase_private_note/);
    expect(container.textContent).not.toMatch(/pi-TgoJ4_DM55Fqz/);
    expect(container.textContent).not.toMatch(/FORBIDDEN/);
  });

  it('keeps the server text for non-permission failures — it is the useful part', async () => {
    renderForm(async () => { throw new Error('Title must be unique'); });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/title must be unique/i)).toBeInTheDocument();
  });

  it('falls back to a generic localized message when the error carries no text', async () => {
    renderForm(async () => { throw {}; });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/could not save/i)).toBeInTheDocument();
  });
});
