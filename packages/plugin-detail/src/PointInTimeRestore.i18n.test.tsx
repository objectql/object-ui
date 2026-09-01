/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `PointInTimeRestore` speaks the session locale — objectui#7163.
 *
 * Unlike its sibling `RecordComments`, this file used **no translation hook at
 * all** (0 references), so every string in it — the card title, the empty
 * state, the field-count line, the preview panel, the restore confirmation and
 * all three buttons — rendered English in every session. It is therefore swept
 * WHOLE here rather than having only its timestamps converted: objectui#7142
 * wired one string into an otherwise untranslated component and shipped a zh
 * card reading `"Activity(0)No activity recorded"`, and objectui#7149 is what
 * finishing that afterwards cost. Ten keys are new; `detail.cancel`,
 * `detail.activityEmptyValue` and `detail.emptyValue` are reused rather than
 * forked, and the four relative-time keys were already present in all ten packs.
 *
 * The relative-time branches are the load-bearing zh/ar assertions for the same
 * reason as the sibling suite: each `en` pack value is byte-identical to the
 * literal it replaced, so an `en`-only test is green before the fix too. The
 * ten NEW keys are different — those literals had no pack value at all, so
 * their provider-less leg (`DETAIL_DEFAULT_TRANSLATIONS`) is a real assertion
 * rather than a tautology: before this change there was no English to fall back
 * TO, and a raw key would have rendered.
 *
 * `{{count}}` and `{{when}}` are spelled with no inner spaces — the one
 * spelling BOTH paths resolve (i18next on the provider path,
 * `interpolateFallback` on the provider-less one — objectui#3512 / #6219). The
 * provider-less leg is asserted because that is where a wrong spelling renders
 * a raw `{{when}}` silently. No inline `defaultValue` anywhere (objectui#3517).
 *
 * The field-count pair is selected by a **static ternary over two literal
 * keys**, never `t(KEYS[n])` — objectui#7149 measured that a key visible only
 * as a map value has no call site the i18n scanners can resolve and reads as
 * unreferenced.
 */

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nProvider } from '@object-ui/i18n';
import { PointInTimeRestore, type RevisionEntry } from './PointInTimeRestore';

afterEach(() => cleanup());

const MIN = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function revisions(): RevisionEntry[] {
  return [
    {
      id: 'r1',
      timestamp: ago(5 * MIN),
      user: 'Grace',
      changes: [
        { field: 'stage', oldValue: null, newValue: 'won' },
        { field: 'amount', oldValue: 10, newValue: 20 },
      ],
      snapshot: { stage: 'won', owner: null },
    },
    {
      id: 'r2',
      timestamp: ago(3 * 60 * MIN),
      user: 'Alan',
      changes: [{ field: 'name', oldValue: 'a', newValue: 'b' }],
    },
  ];
}

function renderIn(language: string, props: Partial<React.ComponentProps<typeof PointInTimeRestore>> = {}) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      <PointInTimeRestore recordId="rec_1" revisions={revisions()} {...props} />
    </I18nProvider>,
  );
}

const EN = {
  title: 'Revision History',
  empty: 'No revisions recorded',
  preview: 'Revision Preview',
  snapshot: 'Record state at this point',
  restoreBtn: 'Restore to this point',
  confirmBtn: 'Confirm Restore',
  cancelBtn: 'Cancel',
  emptyValue: '(empty)',
  minutes: '5m ago',
  hours: '3h ago',
  twoFields: '2 fields changed',
  oneField: '1 field changed',
  confirm: 'This will restore the record to its state at 5m ago. Continue?',
};
const ZH = {
  title: '修订历史',
  empty: '暂无修订记录',
  preview: '修订预览',
  snapshot: '此时间点的记录状态',
  restoreBtn: '恢复到此时间点',
  confirmBtn: '确认恢复',
  cancelBtn: '取消',
  emptyValue: '(空)',
  minutes: '5分钟前',
  hours: '3小时前',
  twoFields: '已更改 2 个字段',
  oneField: '已更改 1 个字段',
  confirm: '这会将记录恢复到 5分钟前 时的状态。是否继续?',
};
const AR = {
  title: 'سجل المراجعات',
  empty: 'لا توجد مراجعات مسجلة',
  restoreBtn: 'الاستعادة إلى هذه النقطة',
};

describe('PointInTimeRestore — locale resolution (objectui#7163)', () => {
  it('renders its whole chrome from the zh pack under a zh session', () => {
    renderIn('zh', { onRestore: () => {} });

    expect(screen.getByText(ZH.title)).toBeTruthy();
    expect(screen.getByText(ZH.minutes)).toBeTruthy();
    expect(screen.getByText(ZH.hours)).toBeTruthy();
    expect(screen.getByText(ZH.twoFields)).toBeTruthy();
    expect(screen.getByText(ZH.oneField)).toBeTruthy();
  });

  it('leaves no English chrome behind in a zh session', () => {
    // The defect. A partial conversion passes the assertion above and fails this.
    renderIn('zh', { onRestore: () => {} });

    for (const en of [EN.title, EN.minutes, EN.hours, EN.twoFields, EN.oneField]) {
      expect(screen.queryByText(en)).toBeNull();
    }
  });

  it('translates the selected-revision preview panel and its restore flow in zh', () => {
    renderIn('zh', { onRestore: () => {} });

    fireEvent.click(screen.getByText('Grace'));

    expect(screen.getByText(ZH.preview)).toBeTruthy();
    expect(screen.getByText(ZH.snapshot)).toBeTruthy();
    // `oldValue: null` and the null snapshot entry — both reuse existing keys.
    expect(screen.getAllByText(ZH.emptyValue).length).toBeGreaterThan(0);
    expect(screen.queryByText(EN.emptyValue)).toBeNull();

    const restore = screen.getByText(ZH.restoreBtn);
    expect(restore).toBeTruthy();
    fireEvent.click(restore);

    // The confirmation is ONE key with a `{{when}}` hole, not an assembled
    // sentence — the interpolated value is the localized relative time.
    expect(screen.getByText(ZH.confirm)).toBeTruthy();
    expect(screen.getByText(ZH.confirmBtn)).toBeTruthy();
    expect(screen.getByText(ZH.cancelBtn)).toBeTruthy();
    expect(screen.queryByText(EN.confirm)).toBeNull();
  });

  it('translates the empty state in zh', () => {
    render(
      <I18nProvider config={{ defaultLanguage: 'zh', detectBrowserLanguage: false }}>
        <PointInTimeRestore recordId="rec_1" revisions={[]} />
      </I18nProvider>,
    );

    expect(screen.getByText(ZH.empty)).toBeTruthy();
    expect(screen.queryByText(EN.empty)).toBeNull();
  });

  it('reads the ar pack under an ar session', () => {
    renderIn('ar', { onRestore: () => {} });

    expect(screen.getByText(AR.title)).toBeTruthy();
    fireEvent.click(screen.getByText('Grace'));
    expect(screen.getByText(AR.restoreBtn)).toBeTruthy();
    expect(screen.queryByText(EN.title)).toBeNull();
    expect(screen.queryByText(EN.restoreBtn)).toBeNull();
  });

  it('translates the ar empty state', () => {
    render(
      <I18nProvider config={{ defaultLanguage: 'ar', detectBrowserLanguage: false }}>
        <PointInTimeRestore recordId="rec_1" revisions={[]} />
      </I18nProvider>,
    );

    expect(screen.getByText(AR.empty)).toBeTruthy();
    expect(screen.queryByText(EN.empty)).toBeNull();
  });

  it('still reads English under an en session', () => {
    // For the four relative-time keys this is green by construction (their `en`
    // values are byte-identical to the old literals). For the ten NEW keys it
    // is a real copy assertion: it pins that the pack rows say exactly what the
    // literals said.
    renderIn('en', { onRestore: () => {} });

    expect(screen.getByText(EN.title)).toBeTruthy();
    expect(screen.getByText(EN.minutes)).toBeTruthy();
    expect(screen.getByText(EN.twoFields)).toBeTruthy();
    expect(screen.getByText(EN.oneField)).toBeTruthy();

    fireEvent.click(screen.getByText('Grace'));
    expect(screen.getByText(EN.preview)).toBeTruthy();
    expect(screen.getByText(EN.snapshot)).toBeTruthy();
    fireEvent.click(screen.getByText(EN.restoreBtn));
    expect(screen.getByText(EN.confirm)).toBeTruthy();
  });

  it('falls back to the English defaults map with no provider mounted', () => {
    // Before this change the file had no hook, so there was no defaults map
    // entry to fall back to at all — a raw key would render here.
    render(<PointInTimeRestore recordId="rec_1" revisions={revisions()} onRestore={() => {}} />);

    expect(screen.getByText(EN.title)).toBeTruthy();
    expect(screen.getByText(EN.minutes)).toBeTruthy();
    expect(screen.getByText(EN.twoFields)).toBeTruthy();

    fireEvent.click(screen.getByText('Grace'));
    expect(screen.getByText(EN.preview)).toBeTruthy();
    fireEvent.click(screen.getByText(EN.restoreBtn));
    // `{{when}}` filled by `interpolateFallback`, not left raw.
    expect(screen.getByText(EN.confirm)).toBeTruthy();
    expect(screen.getByText(EN.cancelBtn)).toBeTruthy();
  });

  it('never renders a raw key or a raw interpolation hole, provider or not', () => {
    const KEYS = [
      'detail.revisionHistory', 'detail.noRevisions', 'detail.revisionFieldsChanged',
      'detail.revisionFieldsChangedOne', 'detail.revisionPreview', 'detail.revisionSnapshot',
      'detail.restoreConfirm', 'detail.restoring', 'detail.confirmRestore',
      'detail.restoreToPoint', 'detail.cancel', 'detail.emptyValue',
      'detail.activityEmptyValue', 'detail.justNow', 'detail.minutesAgo', 'detail.hoursAgo',
    ];

    for (const mount of [() => renderIn('zh', { onRestore: () => {} }),
                         () => render(<PointInTimeRestore recordId="rec_1" revisions={revisions()} onRestore={() => {}} />)]) {
      mount();
      fireEvent.click(screen.getByText('Grace'));
      fireEvent.click(screen.getByText(screen.queryByText(ZH.restoreBtn) ? ZH.restoreBtn : EN.restoreBtn));
      for (const k of KEYS) expect(screen.queryByText(k)).toBeNull();
      expect(screen.queryByText(/\{\{(count|when)\}\}/)).toBeNull();
      cleanup();
    }
  });
});
