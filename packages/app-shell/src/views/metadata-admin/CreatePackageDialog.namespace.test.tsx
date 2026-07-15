// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Wiring guard for the package-namespace field (framework#2694) in the
 * package-switcher "+ new" dialog: it defaults to the id-derived namespace,
 * tracks the id input until the user edits it, and gates submit on a valid
 * `^[a-z][a-z0-9_]{1,19}$` value.
 */
import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CreatePackageDialog } from './PackagesPage';

afterEach(cleanup);

function open() {
  render(<CreatePackageDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
  return {
    id: screen.getByTestId('package-id-input') as HTMLInputElement,
    ns: screen.getByTestId('package-namespace-input') as HTMLInputElement,
    name: screen.getByTestId('package-name-input') as HTMLInputElement,
  };
}

describe('CreatePackageDialog — namespace field', () => {
  it('derives the namespace from the package id and tracks it', () => {
    const { id, ns } = open();
    fireEvent.change(id, { target: { value: 'com.example.leave' } });
    expect(ns.value).toBe('leave');
    // Still tracking: change the id again.
    fireEvent.change(id, { target: { value: 'com.acme.repairs' } });
    expect(ns.value).toBe('repairs');
  });

  it('stops tracking the id once the user edits the namespace', () => {
    const { id, ns } = open();
    fireEvent.change(id, { target: { value: 'com.example.leave' } });
    fireEvent.change(ns, { target: { value: 'hr' } });
    expect(ns.value).toBe('hr');
    // A later id change must NOT clobber the user's namespace.
    fireEvent.change(id, { target: { value: 'com.acme.repairs' } });
    expect(ns.value).toBe('hr');
  });

  it('sanitizes namespace keystrokes to the allowed alphabet', () => {
    const { ns } = open();
    fireEvent.change(ns, { target: { value: 'HR Tickets!' } });
    expect(ns.value).toBe('hrtickets');
  });

  it('disables submit while the namespace is invalid, enables it when valid', () => {
    const { id, ns, name } = open();
    fireEvent.change(id, { target: { value: 'com.example.leave' } });
    fireEvent.change(name, { target: { value: 'Leave' } });
    const submit = screen.getByRole('button', { name: /create package|创建软件包/i });
    expect(submit).toBeEnabled();
    // Single char is below the 2-char minimum → invalid.
    fireEvent.change(ns, { target: { value: 'a' } });
    expect(submit).toBeDisabled();
    fireEvent.change(ns, { target: { value: 'leave' } });
    expect(submit).toBeEnabled();
  });
});
