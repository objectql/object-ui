/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectKanban`'s record-detail drawer heading still resolves to ENGLISH, and
 * to the SAME BYTES as before, when no `I18nProvider` is mounted —
 * objectui#3459.
 *
 * This is not a nice-to-have. Routing a literal through `t()` without a working
 * default is exactly how a provider-less consumer breaks, and it breaks in a
 * suite that is not this one: `object-kanban` is a public page block, so any
 * host that renders schema without mounting a provider (this package's own
 * tests, the preview gallery, an embedding app) reads whatever the defaults map
 * says. The English defaults live in `KANBAN_DEFAULT_TRANSLATIONS`
 * (`ObjectKanban.tsx`) — that map is what `createSafeTranslation` falls back to
 * when its `detail.recordDetail` probe comes back unresolved.
 *
 * Direction: this file was GREEN before the change and is GREEN after. It pins
 * the FALLBACK, not the fix — the fix is asserted in
 * `ObjectKanban.overlayTitleI18n.test.tsx`. A missing map entry would have
 * turned it red by rendering the raw key `detail.recordDetailWithLabel`, which
 * is precisely the regression it exists to catch.
 *
 * ── Why this is its own FILE, not a describe block ────────────────────────
 * `createI18n` calls `instance.use(initReactI18next)`, and `initReactI18next`
 * registers that instance as **react-i18next's module-global default**. The
 * registration survives unmount and `cleanup()`. So the moment any test in a
 * file mounts `<I18nProvider config={{ defaultLanguage: 'zh' }}>`, every later
 * "no provider" render in that same file silently resolves against the Chinese
 * instance — a green-looking file that asserts nothing about the fallback.
 *
 * Vitest's `dom` project runs with `isolate: true`, so a file that never mounts
 * a provider gets a genuinely clean global. Keep it that way: **do not import
 * or mount `I18nProvider` here.**
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { registerAllFields } from '@object-ui/fields';
import { ObjectKanban } from './ObjectKanban';

registerAllFields();

const cards = [
  { id: '1', title: 'On the board', status: 'todo' },
  { id: '2', title: 'Second card', status: 'todo' },
];

function renderKanban(schemaExtra: Record<string, unknown>) {
  return render(
    <ObjectKanban
      schema={{
        type: 'object-kanban',
        groupBy: 'status',
        columns: [{ id: 'todo', title: 'To Do' }],
        data: cards,
        ...schemaExtra,
      } as never}
    />,
  );
}

async function openDrawer() {
  const card = await screen.findByText('On the board');
  fireEvent.click(card);
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
}

afterEach(() => cleanup());

describe('ObjectKanban drawer heading — English fallback with no provider (objectui#3459)', () => {
  it('interpolates the capitalized object name in English, never the raw key', async () => {
    renderKanban({ objectName: 'contacts' });
    await openDrawer();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Contacts Detail');
    expect(screen.queryByText('detail.recordDetailWithLabel')).toBeNull();
  });

  it('keeps the underscore-to-space humanization in the fallback path', async () => {
    renderKanban({ objectName: 'support_cases' });
    await openDrawer();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Support cases Detail');
  });
});
