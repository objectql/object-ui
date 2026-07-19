// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ResultDialogSpec } from '@object-ui/core';
import { ActionResultDialog } from '../ActionResultDialog';

vi.mock('@object-ui/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@object-ui/i18n')>()),
  useObjectTranslation: () => ({ t: (key: string) => key }),
}));
// jsdom has no canvas; the qrcode path is not under test.
vi.mock('qrcode', () => ({ toCanvas: vi.fn() }));

function open(spec: ResultDialogSpec, data: unknown) {
  render(
    <ActionResultDialog
      state={{ open: true, spec, data }}
      onAcknowledge={() => {}}
    />,
  );
}

describe('ActionResultDialog — unresolved field paths are skipped', () => {
  const spec: ResultDialogSpec = {
    title: 'User Created',
    fields: [
      { path: 'user.email', label: 'Email', format: 'text' },
      { path: 'temporaryPassword', label: 'Temporary Password', format: 'secret' },
    ],
  };

  it('drops a declared field whose path does not resolve in the payload', () => {
    // Admin typed the password themselves — the server never minted one, so
    // the response has no `temporaryPassword` key at all.
    open(spec, { user: { email: 'a@example.com' } });

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('a@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Temporary Password')).not.toBeInTheDocument();
    // No JsonBlock fallback rendering the literal `undefined` either.
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('renders every declared field when all paths resolve', () => {
    open(spec, { user: { email: 'a@example.com' }, temporaryPassword: 'p@ss' });

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Temporary Password')).toBeInTheDocument();
    // Secret renders masked until revealed.
    expect(screen.getByText('••••')).toBeInTheDocument();
  });

  it('still falls back to whole-payload JSON when no fields are declared', () => {
    open({ title: 'Done' }, { anything: 1 });

    expect(screen.getByText(/"anything": 1/)).toBeInTheDocument();
  });
});
