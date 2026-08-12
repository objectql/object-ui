/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ActionParamDialog`'s select placeholder still resolves to ENGLISH, and to
 * the same word the pack ships, when no `I18nProvider` is mounted —
 * objectui#4386.
 *
 * Routing a literal through `t()` without a working default is exactly how a
 * provider-less consumer breaks, and this dialog has provider-less consumers:
 * embedded hosts render it without a provider, and this package's own
 * `action-param-dialog-aria-required` / `action-param-dialog-label-association`
 * suites mount it bare. The English default lives in the defaults map handed to
 * `createSafeTranslation` in `action-param-dialog.tsx`, and it is byte-identical
 * to `en`'s `common.select`. Without that entry this render would show the raw
 * key `common.select`, which is precisely the regression this file catches.
 *
 * ── Measured reverse-verification direction ──────────────────────────────
 * This file is RED before the fix and GREEN after. That is worth writing down
 * because the obvious expectation for a no-provider FALLBACK pin is the other
 * one — green both sides, since the English bytes are supposed to be unchanged
 * — and it was the expectation this file was drafted with. It is wrong here for
 * a reason specific to #4386: the literal being replaced was `Select...`, so
 * the English bytes did NOT survive the fix unchanged. The ellipsis moved from
 * ASCII to U+2026, and `getByText('Select…')` is what goes red on the revert.
 *
 * So the two assertions below fail on genuinely different mutations, and only
 * the first is exercised by reverting the fix:
 *   - `getByText('Select…')` — red on the revert, on the GLYPH half.
 *   - `queryByText('common.select')` — the defaults-map pin proper. Reverting
 *     the fix does not move it (the pre-fix literal is not a raw key either);
 *     it goes red only if the defaults entry is dropped or misspelled, which is
 *     the regression this file exists to catch long after #4386. Measured by
 *     emptying the defaults map: the placeholder then renders the literal text
 *     `common.select` and this assertion fails.
 *
 * The translation half of the fix is asserted in
 * `action-param-dialog-select-placeholder-i18n.test.tsx`.
 *
 * ── Why this is its own FILE, not a describe block ────────────────────────
 * `createI18n` calls `instance.use(initReactI18next)`, which registers that
 * instance as react-i18next's module-global default, and the registration
 * survives unmount and `cleanup()`. So the moment any test in a file mounts
 * `<I18nProvider config={{ defaultLanguage: 'zh' }}>`, every later "no provider"
 * render in that same file silently resolves against the Chinese instance.
 * Measured on this very case while writing it: the assertion expected `Select…`
 * and the dialog rendered `选择…`. Same trap, same remedy, as
 * `ObjectKanban.overlayTitleNoProviderFallback.test.tsx`.
 *
 * Vitest's `dom` project runs with `isolate: true`, so a file that never mounts
 * a provider gets a genuinely clean global. Keep it that way: **do not import
 * or mount `I18nProvider` here.**
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ActionParamDef } from '@object-ui/core';
import { ActionParamDialog } from '../custom/action-param-dialog';

afterEach(cleanup);

const selectParam = (over: Partial<ActionParamDef> = {}): ActionParamDef =>
  ({
    name: 'env',
    label: 'Environment',
    type: 'select',
    options: [
      { label: 'Production', value: 'prod' },
      { label: 'Staging', value: 'stage' },
    ],
    ...over,
  }) as ActionParamDef;

describe('custom ActionParamDialog — select placeholder, no I18nProvider (objectui#4386)', () => {
  it('renders the English pack word from the defaults map, never the raw key', () => {
    render(
      <ActionParamDialog
        params={[selectParam()]}
        open
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Select…')).toBeInTheDocument();
    // The failure mode a missing defaults entry produces.
    expect(screen.queryByText('common.select')).not.toBeInTheDocument();
    // The ellipsis half of #4386 survives on this path too.
    expect(screen.queryByText('Select...')).not.toBeInTheDocument();
  });

  it('still honours an authored placeholder with no provider', () => {
    render(
      <ActionParamDialog
        params={[selectParam({ placeholder: 'Pick an environment' })]}
        open
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Pick an environment')).toBeInTheDocument();
    expect(screen.queryByText('Select…')).not.toBeInTheDocument();
  });
});
