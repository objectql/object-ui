/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ActionParamDialog (components/custom) — the `select` branch's placeholder
 * fallback is a pack key, not a hardcoded English literal (objectui#4386).
 *
 * The branch rendered `param.placeholder || 'Select...'` behind a file that
 * imported no translation hook at all, so the fallback — which fires whenever
 * an action param of kind `select` declares no `placeholder` of its own, the
 * ordinary case for hand-written action metadata — was English in every locale
 * AND spelled its ellipsis in ASCII, which #3878 converged the ten packs away
 * from.
 *
 * The fix reuses `common.select` (already in all ten packs, already consumed by
 * `packages/fields`' `LookupField` for the same select-trigger job, already in
 * `ellipsis-glyph-3878.test.ts`'s `CONVERGED_KEYS`), so no pack file changed.
 *
 * ## Reverse verification
 *
 * Restoring `|| 'Select...'` turns the zh and en-glyph cases below red — both,
 * because both reach the fallback. The authored-value case stays green either
 * way: it never reaches the fallback, and it is here as the surviving pin that
 * authored metadata keeps priority over the pack word.
 *
 * The two ASCII-negative assertions are the glyph half of the defect on its
 * own: a fix that translated the string but kept `...` would satisfy the zh
 * case and still fail the en one.
 *
 * ── The provider-less fallback is a SEPARATE FILE ─────────────────────────
 * `action-param-dialog-select-placeholder-no-provider.test.tsx`, for the reason
 * `ObjectKanban.overlayTitleNoProviderFallback.test.tsx` documents: `createI18n`
 * registers its instance as react-i18next's module-global default, and that
 * registration survives unmount and `cleanup()`. Once any test in a file mounts
 * a zh provider, every later "no provider" render in the SAME file resolves
 * against the Chinese instance. Measured here first-hand — the case asserted
 * `Select…` and rendered `选择…`. Do not add a provider-less case to this file.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { ActionParamDef } from '@object-ui/core';
import { I18nProvider } from '@object-ui/i18n';
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

const dialog = (over: Partial<ActionParamDef> = {}) => (
  <ActionParamDialog
    params={[selectParam(over)]}
    open
    onSubmit={vi.fn()}
    onCancel={vi.fn()}
  />
);

function renderIn(language: string, over: Partial<ActionParamDef> = {}) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      {dialog(over)}
    </I18nProvider>,
  );
}

describe('custom ActionParamDialog — select placeholder i18n (objectui#4386)', () => {
  it('renders the locale word when the param declared no placeholder (zh)', () => {
    renderIn('zh');

    expect(screen.getByText('选择…')).toBeInTheDocument();
    // The defect verbatim: hardcoded English in an otherwise Chinese dialog.
    expect(screen.queryByText('Select...')).not.toBeInTheDocument();
  });

  it('renders the English pack value — with the typographic ellipsis — under en', () => {
    renderIn('en');

    // U+2026, not `...`: #3878's converged glyph, inherited from the pack.
    expect(screen.getByText('Select…')).toBeInTheDocument();
    expect(screen.queryByText('Select...')).not.toBeInTheDocument();
  });

  it('honours an authored placeholder verbatim, in any locale', () => {
    renderIn('zh', { placeholder: 'Pick an environment' });

    expect(screen.getByText('Pick an environment')).toBeInTheDocument();
    expect(screen.queryByText('选择…')).not.toBeInTheDocument();
  });
});
