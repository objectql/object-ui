/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4468 — every date branch threads the ACTIVE locale.
 *
 * ── The measured split ───────────────────────────────────────────────────
 * On a `zh` console the same task row rendered `逾期 6 天` in one column and
 * `In 3 days` in the next, and the datetime column read `8/11/2026 12:00 am`.
 * Not a missing translation: the field labels around it were fully Chinese.
 *
 * The cause is that the date renderers had TWO locale channels and only one
 * of them followed the user's language:
 *
 *   - the OVERDUE phrase resolves through `useFieldTranslate()` → the ACTIVE
 *     UI language → `逾期 6 天`;
 *   - every `Intl` branch (relative past, relative future, the >±7d absolute
 *     fallback) took its tag from `useLocalization().locale` — the TENANT's
 *     regional default (ADR-0053), which is `undefined` on any workspace that
 *     has not configured one. `Intl` with `undefined` reads the MACHINE's
 *     locale, so those branches rendered en-US next to the Chinese one;
 *   - `DateTimeCellRenderer` passed no tag at all, hence `8/11/2026 12:00 am`.
 *
 * The one resolver is `useDisplayLocale()` (tenant locale → active UI
 * language → `'en'`), which `@object-ui/i18n` already owns and whose own
 * docstring claimed `DateCellRenderer` "already formats from this channel" —
 * it did not. `'zh'` is a valid BCP-47 tag, so there is no `'zh'`→`zh-CN`
 * mapping anywhere: `useDisplayLocale()` IS the single mapping point.
 *
 * ── Directions ───────────────────────────────────────────────────────────
 * Reverting the renderers to `origin/main` and keeping this file turns every
 * `zh session` case RED and leaves every `en session` case GREEN. The `en`
 * cases are green on BOTH sides on purpose — that is the must-not-change
 * half: the English output has to be byte-identical after the change, since
 * `'en'` and the CI machine's `en-US` agree on all of these forms.
 *
 * `已逾期`/`Overdue Nd` is likewise green on both sides: it never used the
 * broken channel, and this file pins that the fix did not disturb it.
 */

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider, LocalizationProvider } from '@object-ui/i18n';
import { DateCellRenderer, DateTimeCellRenderer } from '../index';
import { DateField } from '../widgets/DateField';
import { DateTimeField } from '../widgets/DateTimeField';
import { FormulaField } from '../widgets/FormulaField';
import { GridField } from '../widgets/GridField';

/**
 * `n` days from today, pinned to local noon so a run that starts near
 * midnight can never land the value on the neighbouring day.
 */
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/**
 * A fixed instant, built from LOCAL parts so the rendered day/time is the
 * same in every timezone the suite might run in. This is the exact value
 * shape the card captured: `8/11/2026 12:00 am` on an en machine.
 */
const FIXED_INSTANT = new Date(2026, 7, 11, 0, 0, 0).toISOString();

/**
 * A session: the UI language the user picked, plus the tenant's regional
 * default (usually absent — the state the card was measured in).
 *
 * `persistLanguage={false}` keeps each case on its own language instead of
 * inheriting whatever the previous one wrote to `localStorage`.
 */
function renderSession(
  language: string,
  node: React.ReactNode,
  tenantLocale?: string,
) {
  return render(
    <I18nProvider
      config={{ defaultLanguage: language, detectBrowserLanguage: false }}
      persistLanguage={false}
    >
      <LocalizationProvider value={{ locale: tenantLocale }}>{node}</LocalizationProvider>
    </I18nProvider>,
  );
}

const dateField = (name: string) => ({ type: 'date', name }) as any;

afterEach(() => cleanup());

describe('zh session — every date branch renders Chinese (objectui#4468)', () => {
  it('future-relative: the branch the card caught as "In 3 days"', () => {
    renderSession('zh', <DateCellRenderer value={daysFromNow(3)} field={dateField('end_date')} />);
    expect(screen.getByText('3天后')).toBeInTheDocument();
    expect(screen.queryByText('In 3 days')).not.toBeInTheDocument();
  });

  it('past-relative, non-due: the branch the card caught as "6 days ago"', () => {
    renderSession('zh', <DateCellRenderer value={daysFromNow(-6)} field={dateField('start_date')} />);
    expect(screen.getByText('6天前')).toBeInTheDocument();
    expect(screen.queryByText('6 days ago')).not.toBeInTheDocument();
  });

  it('near-today: today / tomorrow / yesterday', () => {
    renderSession('zh', <DateCellRenderer value={daysFromNow(0)} field={dateField('start_date')} />);
    expect(screen.getByText('今天')).toBeInTheDocument();
    cleanup();

    renderSession('zh', <DateCellRenderer value={daysFromNow(1)} field={dateField('start_date')} />);
    expect(screen.getByText('明天')).toBeInTheDocument();
    cleanup();

    renderSession('zh', <DateCellRenderer value={daysFromNow(-1)} field={dateField('start_date')} />);
    expect(screen.getByText('昨天')).toBeInTheDocument();
  });

  it('absolute fallback beyond the ±7-day window', () => {
    const value = daysFromNow(30);
    // The formatter drops the year when it is the current one, so the
    // expectation is built the same way rather than hardcoding a month that
    // depends on the day this suite runs.
    const d = new Date(value);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    const expected = d.toLocaleDateString('zh', {
      year: sameYear ? undefined : 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const enForm = d.toLocaleDateString('en', {
      year: sameYear ? undefined : 'numeric',
      month: 'short',
      day: 'numeric',
    });

    renderSession('zh', <DateCellRenderer value={value} field={dateField('start_date')} />);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText(enForm)).not.toBeInTheDocument();
  });

  it('absolute datetime: the branch the card caught as "8/11/2026 12:00 am"', () => {
    const { container } = renderSession(
      'zh',
      <DateTimeCellRenderer value={FIXED_INSTANT} field={{ type: 'datetime', name: 'created_at' } as any} />,
    );
    expect(container.textContent).toContain('2026/8/11');
    expect(container.textContent).toContain('上午12:00');
    expect(container.textContent).not.toContain('8/11/2026');
    expect(container.textContent).not.toContain('12:00 am');
  });

  it('read-only DateField / DateTimeField widgets', () => {
    const { container } = renderSession(
      'zh',
      <DateField value={FIXED_INSTANT} onChange={() => {}} field={dateField('start_date')} readonly />,
    );
    expect(container.textContent).toContain('2026/8/11');
    cleanup();

    const dt = renderSession(
      'zh',
      <DateTimeField
        value={FIXED_INSTANT}
        onChange={() => {}}
        field={{ type: 'datetime', name: 'created_at' } as any}
        readonly
      />,
    );
    expect(dt.container.textContent).toContain('2026/8/11');
  });

  /**
   * The sub-grid (`GridField`) read-only face. Its cases live here rather than
   * beside the rest of `widgets/GridField.test.tsx`: mounting an `I18nProvider`
   * in that file changes what its later PROVIDER-LESS renders resolve, and one
   * of them asserts a translated `aria-label`.
   */
  it('the sub-grid read-only table', () => {
    const temporalField = {
      columns: [
        { field: 'merchant', label: 'Merchant', type: 'text' as const },
        { field: 'incurred_on', label: 'Incurred On', type: 'date' as const },
      ],
    } as any;
    renderSession(
      'zh',
      <GridField
        value={[{ merchant: 'Chipotle', incurred_on: '2026-06-17T00:00:00.000Z' }]}
        onChange={() => {}}
        field={temporalField}
        readonly
      />,
    );
    const table = screen.getByTestId('line-items-readonly');
    expect(table.textContent).toContain('2026/6/17');
    expect(table.textContent).not.toContain('6/17/2026');
  });

  it('a formula field returning a date', () => {
    const { container } = renderSession(
      'zh',
      <FormulaField
        value={FIXED_INSTANT}
        onChange={() => {}}
        field={{ type: 'formula', name: 'computed_on', return_type: 'date' } as any}
      />,
    );
    expect(container.textContent).toContain('2026/8/11');
    expect(container.textContent).not.toContain('8/11/2026');
  });
});

describe('en session — output is byte-identical (must-not-change)', () => {
  it('future-relative', () => {
    renderSession('en', <DateCellRenderer value={daysFromNow(3)} field={dateField('end_date')} />);
    expect(screen.getByText('In 3 days')).toBeInTheDocument();
  });

  it('past-relative, non-due', () => {
    renderSession('en', <DateCellRenderer value={daysFromNow(-6)} field={dateField('start_date')} />);
    expect(screen.getByText('6 days ago')).toBeInTheDocument();
  });

  it('near-today', () => {
    renderSession('en', <DateCellRenderer value={daysFromNow(0)} field={dateField('start_date')} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    cleanup();

    renderSession('en', <DateCellRenderer value={daysFromNow(1)} field={dateField('start_date')} />);
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    cleanup();

    renderSession('en', <DateCellRenderer value={daysFromNow(-1)} field={dateField('start_date')} />);
    expect(screen.getByText('Yesterday')).toBeInTheDocument();
  });

  it('absolute datetime', () => {
    const { container } = renderSession(
      'en',
      <DateTimeCellRenderer value={FIXED_INSTANT} field={{ type: 'datetime', name: 'created_at' } as any} />,
    );
    expect(container.textContent).toContain('8/11/2026');
    expect(container.textContent).toContain('12:00 am');
  });

  it('read-only DateField', () => {
    const { container } = renderSession(
      'en',
      <DateField value={FIXED_INSTANT} onChange={() => {}} field={dateField('start_date')} readonly />,
    );
    expect(container.textContent).toContain('8/11/2026');
  });
});

describe('the already-localized overdue branch is undisturbed (green both sides)', () => {
  it('resolves through the translate fn, not through Intl — zh', () => {
    renderSession('zh', <DateCellRenderer value={daysFromNow(-6)} field={dateField('due_date')} />);
    const el = screen.getByText('逾期 6 天');
    expect(el).toBeInTheDocument();
    expect(el.className).toMatch(/text-red-600/);
  });

  it('resolves through the translate fn, not through Intl — en', () => {
    renderSession('en', <DateCellRenderer value={daysFromNow(-6)} field={dateField('due_date')} />);
    expect(screen.getByText('Overdue 6d')).toBeInTheDocument();
  });
});

describe('channel precedence is unchanged (green both sides)', () => {
  /**
   * `useDisplayLocale()` puts the TENANT locale above the UI language: an org
   * that configured `en` means it, even for a user reading Chinese chrome.
   * This is the one case the old code got right, and it must survive.
   */
  it('an explicit tenant locale outranks the active UI language', () => {
    renderSession('zh', <DateCellRenderer value={daysFromNow(3)} field={dateField('end_date')} />, 'en');
    expect(screen.getByText('In 3 days')).toBeInTheDocument();
    expect(screen.queryByText('3天后')).not.toBeInTheDocument();
  });

  /**
   * The third step of the precedence — the provider-less `'en'` last resort —
   * is pinned in `DateCellRenderer.test.tsx`, deliberately NOT here.
   *
   * It cannot be measured in this file: `useObjectTranslation()` outside a
   * provider reports `i18n.language` from react-i18next's GLOBAL instance, and
   * every `I18nProvider` mounted above leaves that global on the language it
   * was given. So a provider-less render placed after these cases resolves
   * `'zh'` — which is the state react-i18next is in, not the fallback under
   * test. Written here it would assert a fact about test ordering.
   *
   * `DateCellRenderer.test.tsx` mounts no provider at all, so its
   * `6 days ago` / `Overdue 6d` / `Tomorrow` cases ARE that pin, and they hold
   * for the real reason.
   */
});
