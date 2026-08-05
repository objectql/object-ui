/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The record overlay's close affordances speak the session locale —
 * objectstack#5430.
 *
 * `NavigationOverlay` had two hardcoded English accessible names:
 *   - drawer mode: the header `X` button (`aria-label`/`title` = "Close")
 *   - split mode:  the detail panel's `X` button (`aria-label` = "Close panel")
 *
 * Both are icon-only, so the literal WAS the control to a screen reader and to
 * the hover tooltip. They now read `common.close` / `common.closePanel`.
 * `common.close` is deliberately the key the rest of the console already uses
 * for a bare "Close" rather than a new overlay-private one.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import { NavigationOverlay } from '../custom/navigation-overlay';

const record = { _id: 'rec_1', name: 'Acme Corp' };

function renderDrawerIn(language: string) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      <NavigationOverlay
        isOpen
        selectedRecord={record}
        mode="drawer"
        close={() => {}}
        setIsOpen={() => {}}
        title="Acme Corp"
      >
        {(r) => <div>{String(r.name)}</div>}
      </NavigationOverlay>
    </I18nProvider>,
  );
}

function renderSplitIn(language: string) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      <NavigationOverlay
        isOpen
        selectedRecord={record}
        mode="split"
        close={() => {}}
        setIsOpen={() => {}}
        title="Acme Corp"
        mainContent={<div>main</div>}
      >
        {(r) => <div>{String(r.name)}</div>}
      </NavigationOverlay>
    </I18nProvider>,
  );
}

afterEach(() => cleanup());

describe('NavigationOverlay drawer close — accessible name (objectstack#5430)', () => {
  it('still reads English under an en session', () => {
    renderDrawerIn('en');

    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('reads the zh bundle value under a zh session', () => {
    renderDrawerIn('zh');

    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
    // The literal this replaced. Negative direction matters here: the shadcn
    // Sheet ships its own auto-rendered close button, so a re-inlined English
    // name would otherwise hide behind the positive assertion.
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('reads the de bundle value under a de session', () => {
    renderDrawerIn('de');

    expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});

describe('NavigationOverlay split close panel — accessible name (objectstack#5430)', () => {
  it('still reads English under an en session', () => {
    renderSplitIn('en');

    expect(screen.getByRole('button', { name: 'Close panel' })).toBeTruthy();
  });

  it('reads the zh bundle value under a zh session', () => {
    renderSplitIn('zh');

    expect(screen.getByRole('button', { name: '关闭面板' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close panel' })).toBeNull();
  });

  it('reads the ja bundle value under a ja session', () => {
    renderSplitIn('ja');

    expect(screen.getByRole('button', { name: 'パネルを閉じる' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close panel' })).toBeNull();
  });
});
