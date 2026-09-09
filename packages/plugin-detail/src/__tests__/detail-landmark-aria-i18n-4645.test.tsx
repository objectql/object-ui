/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The two remaining English landmark names on a record detail speak the
 * session locale — objectui#4645.
 *
 * `HeaderHighlight`'s `<section aria-label="Record highlights">` and
 * `RecordActivityTimeline`'s `<section aria-label="Discussion">` were the last
 * purely-ASCII accessible names on a record detail page, measured English in
 * zh-CN, ja-JP **and** es-ES — in es-ES sitting among 30+ correctly-Spanish
 * siblings (`Copiar ID de registro`, `Filtrar actividad`, `Alternar barra
 * lateral`). Both sections carry no visible label of their own, so the
 * `aria-label` IS the landmark as far as assistive tech is concerned — the
 * argument objectui#4024 made for the dialog `Close` label, and #5956 made for
 * `record:path`'s own container name (`detail.pathLabel`, which this change
 * copies).
 *
 * Keys: `detail.discussion` already existed in all ten packs (the DetailView
 * tab reads it). `detail.highlightsLabel` is new and is the ONLY key this
 * change mints — added to all ten packs and mirrored byte-identically into
 * `DETAIL_DEFAULT_TRANSLATIONS`, which `defaults-maps-mirror-en-pack` enforces.
 *
 * ── Direction of these assertions ─────────────────────────────────────────
 * The `en` cases were GREEN before AND after: they pin that routing the names
 * through `t()` did not change what an English session hears. The zh / ja / es
 * cases were RED — both names read English in every locale, which is the whole
 * defect. The provider-less fallback is NOT asserted here: mounting an
 * `I18nProvider` installs a module-level i18next instance, so a no-provider
 * assertion in this file would read whichever instance a sibling test left
 * behind. It is covered instead by
 * `app-shell/src/__tests__/defaults-maps-mirror-en-pack.test.tsx`, which pins
 * every row of `DETAIL_DEFAULT_TRANSLATIONS` against the `en` pack.
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { HighlightField } from '@object-ui/types';
import { I18nProvider } from '@object-ui/i18n';
import { HeaderHighlight } from '../HeaderHighlight';
import { RecordActivityTimeline } from '../RecordActivityTimeline';

function renderIn(language: string, node: React.ReactNode) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      {node}
    </I18nProvider>,
  );
}

const highlights = (
  <HeaderHighlight
    fields={[{ name: 'owner', label: 'Owner' }] satisfies HighlightField[]}
    data={{ owner: 'Alice' }}
  />
);

const timeline = <RecordActivityTimeline items={[]} />;

/** The accessible name of the one `<section>` each render puts on screen. */
const sectionLabel = (container: HTMLElement) =>
  container.querySelector('section')?.getAttribute('aria-label') ?? null;

afterEach(() => cleanup());

describe('record-detail landmark names (objectui#4645)', () => {
  describe('HeaderHighlight — the highlights strip', () => {
    it('still reads English under an en session', () => {
      const { container } = renderIn('en', highlights);
      expect(sectionLabel(container)).toBe('Record highlights');
    });

    /**
     * Each value is the locale's OWN `detail.highlightFields` phrase ("Key
     * Fields" — this section is that strip) carrying the locale's own
     * record-possessive as `detail.pathLabel` already spells it. Derived from
     * two shipped rows rather than invented, so a reviewer can check them
     * against the pack instead of against a dictionary.
     */
    it.each([
      ['zh', '记录关键字段'],
      ['ja', 'レコードの主要フィールド'],
      ['es', 'Campos clave del registro'],
      ['de', 'Schlüsselfelder des Datensatzes'],
      ['fr', "Champs clés de l'enregistrement"],
      ['ko', '레코드 주요 필드'],
      ['pt', 'Campos principais do registro'],
      ['ru', 'Ключевые поля записи'],
      ['ar', 'الحقول الرئيسية للسجل'],
    ])('reads the %s pack value', (language, expected) => {
      const { container } = renderIn(language, highlights);
      expect(sectionLabel(container)).toBe(expected);
    });
  });

  describe('RecordActivityTimeline — the discussion landmark', () => {
    it('still reads English under an en session', () => {
      const { container } = renderIn('en', timeline);
      expect(sectionLabel(container)).toBe('Discussion');
    });

    it.each([
      ['zh', '讨论'],
      ['ja', 'ディスカッション'],
      ['es', 'Discusión'],
      ['de', 'Diskussion'],
      ['fr', 'Discussion'],
      ['ko', '토론'],
      ['pt', 'Discussão'],
      ['ru', 'Обсуждение'],
      ['ar', 'المناقشة'],
    ])('reads the %s pack value', (language, expected) => {
      const { container } = renderIn(language, timeline);
      expect(sectionLabel(container)).toBe(expected);
    });
  });
});
