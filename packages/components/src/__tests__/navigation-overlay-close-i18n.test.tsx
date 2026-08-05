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
        isOverlay
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
        isOverlay
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

/**
 * Addressing the drawer's close button: by `title`, NOT by role+name.
 *
 * The shadcn `Sheet` primitive auto-renders a close button of its own, whose
 * only accessible name is a hardcoded English `sr-only` span
 * (`packages/components/src/ui/sheet.tsx:80` — an upstream No-Touch zone,
 * AGENTS.md #7). `NavigationOverlay` CSS-hides it with
 * `[&>button:last-of-type]:hidden`, so a real browser drops it from the
 * accessibility tree — but jsdom does not apply Tailwind, so RTL still sees it
 * and `getByRole('button', { name: 'Close' })` matches two elements under `en`.
 *
 * Ours is the only close carrying a `title`, so that is the precise handle. The
 * primitive's own untranslated label is a separate, out-of-scope finding.
 */
describe('NavigationOverlay drawer close — accessible name (objectstack#5430)', () => {
  it('still reads English under an en session', () => {
    renderDrawerIn('en');

    expect(screen.getByTitle('Close').getAttribute('aria-label')).toBe('Close');
  });

  it('reads the zh bundle value under a zh session', () => {
    renderDrawerIn('zh');

    expect(screen.getByTitle('关闭').getAttribute('aria-label')).toBe('关闭');
    expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
    // The literal this replaced, scoped to OUR button via `title` so the
    // primitive's hidden English one cannot mask a re-inlined string here.
    expect(screen.queryByTitle('Close')).toBeNull();
  });

  it('reads the de bundle value under a de session', () => {
    renderDrawerIn('de');

    expect(screen.getByTitle('Schließen').getAttribute('aria-label')).toBe('Schließen');
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeTruthy();
    expect(screen.queryByTitle('Close')).toBeNull();
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
