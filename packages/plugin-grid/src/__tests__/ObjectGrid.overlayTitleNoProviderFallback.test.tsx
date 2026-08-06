/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectGrid`'s record-detail overlay heading still resolves to ENGLISH, and
 * to the SAME BYTES as before, when no `I18nProvider` is mounted —
 * objectui#3426.
 *
 * This is not a nice-to-have. Routing a literal through `t()` without a working
 * default is exactly how a provider-less consumer breaks, and it breaks in a
 * suite that is not this one: `object-grid` is a public page block, so any host
 * that renders schema without mounting a provider (this package's own tests,
 * the preview gallery, an embedding app) reads whatever the defaults map says.
 * The English defaults live in `GRID_DEFAULT_TRANSLATIONS` (`ObjectGrid.tsx`) —
 * that map is what `createSafeTranslation` falls back to when its `grid.actions`
 * probe comes back unresolved.
 *
 * The byte-identity matters beyond aesthetics: the heading is `Contacts Detail`
 * before the change and `Contacts Detail` after, so e2e specs and host tests
 * that address this chrome by its English name keep addressing it.
 *
 * Direction: this file was GREEN before the change and is GREEN after. It pins
 * the FALLBACK, not the fix — the fix is asserted in
 * `ObjectGrid.overlayTitleI18n.test.tsx`. A missing map entry would have turned
 * it red by rendering the raw key `detail.recordDetailWithLabel`, which is
 * precisely the regression it exists to catch.
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
import { ActionProvider } from '@object-ui/react';
import { ObjectGrid } from '../ObjectGrid';

registerAllFields();

const rows = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

function renderGrid(schemaExtra: Record<string, unknown>) {
  return render(
    <ActionProvider>
      <ObjectGrid
        schema={{
          type: 'object-grid',
          columns: [{ field: 'name', label: 'Name' }],
          data: { provider: 'value', items: rows },
          navigation: { mode: 'drawer' },
          ...schemaExtra,
        } as never}
      />
    </ActionProvider>,
  );
}

async function openOverlay() {
  const cell = await screen.findByText('Alice');
  fireEvent.click(cell);
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
}

afterEach(() => cleanup());

describe('ObjectGrid overlay heading — English fallback with no provider (objectui#3426)', () => {
  it('interpolates the authored label in English, never the raw key', async () => {
    renderGrid({ objectName: 'contacts', label: 'Contacts' });
    await openOverlay();

    expect(screen.getByText('Contacts Detail')).toBeInTheDocument();
    expect(screen.queryByText('detail.recordDetailWithLabel')).toBeNull();
  });

  it('capitalizes objectName in English when no label is authored', async () => {
    renderGrid({ objectName: 'contacts' });
    await openOverlay();

    expect(screen.getByText('Contacts Detail')).toBeInTheDocument();
  });

  it('falls back to the bare English heading when the schema names nothing', async () => {
    renderGrid({});
    await openOverlay();

    expect(screen.getByText('Record Detail')).toBeInTheDocument();
    expect(screen.queryByText('detail.recordDetail')).toBeNull();
  });
});
