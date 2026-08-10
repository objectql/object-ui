/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4163 part 1 — the anti-drift pin for the inline per-locale label
 * rule, and the guard that makes objectui#4163's second dispatch ruling
 * ("the layout sites use the spec's OWN label resolver — do not hand-roll a
 * resolution that can drift from it") safe where it could not be followed
 * literally.
 *
 * ## Why two resolvers exist at all
 *
 * `@objectstack/spec` 17.0.0-rc.6 widened `I18nLabel` from `string` to
 * `string | Record<string, string>` and shipped `resolveI18nLabel(label,
 * locale)` as the producer's rule for reading one. #4163 resolves that
 * vocabulary at thirteen sites, and they do NOT all reach for the same
 * function:
 *
 *  - `@object-ui/layout` and `@object-ui/app-shell` call the spec's
 *    `resolveI18nLabel` directly;
 *  - `@object-ui/plugin-list`, `@object-ui/plugin-dashboard` and
 *    `@object-ui/plugin-designer` call objectui's `pickLocalized`, because
 *    those components sit inside objectui's i18n tree and already hold the live
 *    UI language — and `pickLocalized` answers `''` on a miss, which is what a
 *    text node wants, where the spec's answers `undefined`.
 *
 * Two functions over ONE vocabulary is exactly the drift the ruling names. The
 * harm is not a crash: it is the same authored map rendering one locale on the
 * runtime dashboard and a different one in the designer's preview of that same
 * dashboard, with every type and every other test still green. Nothing else in
 * either repo compares them, so this file is the comparison.
 *
 * ## What is asserted
 *
 * The six limbs of the rule, in order — exact tag, base language, a regional
 * key sharing the base, `default`, `en`, then any entry — plus the pass-through
 * and empty-map edges, each asserted on BOTH functions from one table. A limb
 * that changes on one side and not the other fails here rather than in a
 * screenshot.
 *
 * The ONE deliberate difference is normalized explicitly rather than hidden:
 * the spec's resolver reports a miss as `undefined` (so a caller's `?? name`
 * fallback chain can proceed), `pickLocalized` reports it as `''` (so a text
 * node renders nothing). `specForRender` states that conversion in one place;
 * if the two ever disagree about anything else, the table row fails.
 */

import { describe, it, expect } from 'vitest';
import { resolveI18nLabel } from '@objectstack/spec/ui';
import { pickLocalized } from '@object-ui/i18n';

/**
 * The spec resolver's answer, in the spelling a render site needs.
 *
 * This `?? ''` is the whole of the permitted difference — see the header. It is
 * written here, once, so that every other disagreement is a failure.
 */
function specForRender(label: unknown, locale: string | undefined): string {
  return resolveI18nLabel(label as never, locale) ?? '';
}

/** `[what the author wrote, the viewer's locale, the string both must produce]` */
const TABLE: ReadonlyArray<readonly [unknown, string | undefined, string]> = [
  // Pass-through: a plain string is not a map and never becomes one.
  ['Pipeline', 'zh-CN', 'Pipeline'],
  ['Pipeline', undefined, 'Pipeline'],
  // An authored empty string is a label the author wrote, not a miss.
  ['', 'en', ''],

  // Limb 1 — the exact BCP-47 tag wins.
  [{ en: 'Sales', 'zh-CN': '销售' }, 'zh-CN', '销售'],
  [{ en: 'Sales', 'zh-CN': '销售' }, 'en', 'Sales'],
  // …including when the tag arrives padded, which both sides trim.
  [{ en: 'Sales', 'zh-CN': '销售' }, ' zh-CN ', '销售'],

  // Limb 2 — the base language, when the author wrote the bare code.
  [{ en: 'Sales', zh: '销售' }, 'zh-CN', '销售'],
  // …and it outranks limb 3, so a bare key beats a regional sibling.
  [{ zh: '基础', 'zh-CN': '区域' }, 'zh', '基础'],

  // Limb 3 — a regional key sharing the base, when neither exact nor base hit.
  [{ en: 'Sales', 'zh-CN': '销售' }, 'zh', '销售'],
  [{ en: 'Sales', 'zh-CN': '销售' }, 'zh-TW', '销售'],
  [{ 'pt-BR': 'Vendas' }, 'pt-PT', 'Vendas'],

  // Limb 4 — `default` outranks `en`.
  [{ default: 'Default', en: 'English' }, 'fr', 'Default'],

  // Limb 5 — `en`, the platform's source language.
  [{ en: 'Sales', ja: '営業' }, 'fr', 'Sales'],
  // …which is also what "no locale known" resolves to.
  [{ en: 'Sales', 'zh-CN': '销售' }, undefined, 'Sales'],

  // Limb 6 — any entry, rather than nothing, when the map names none of the above.
  [{ ja: '営業' }, 'fr', '営業'],

  // A map with no usable entry is a miss on both sides (see `specForRender`).
  [{}, 'en', ''],
];

describe('inline per-locale label resolution agrees across both resolvers (#4163)', () => {
  it.each(TABLE)(
    'resolves %j at locale %j to %j identically',
    (label, locale, expected) => {
      expect(pickLocalized(label, locale)).toBe(expected);
      expect(specForRender(label, locale)).toBe(expected);
    },
  );

  it('reports a miss in each side\'s own documented spelling', () => {
    // The permitted difference, pinned in BOTH directions so that neither side
    // "fixing" it to match the other passes silently: `app-shell`'s
    // `?? param.name` fallback chain depends on the spec's `undefined`, and the
    // plugin text nodes depend on `pickLocalized`'s `''`.
    expect(resolveI18nLabel({} as never, 'en')).toBeUndefined();
    expect(pickLocalized({}, 'en')).toBe('');
    expect(resolveI18nLabel(undefined, 'en')).toBeUndefined();
    expect(pickLocalized(undefined, 'en')).toBe('');
  });

  it('neither resolver ever hands a text node the stringified object', () => {
    // The harm #4163 exists for, stated once over the whole table rather than
    // per site — a resolver that started returning the map would satisfy no
    // assertion above but would also fail none of them for an untabled input.
    for (const [label, locale] of TABLE) {
      expect(pickLocalized(label, locale)).not.toBe('[object Object]');
      expect(specForRender(label, locale)).not.toBe('[object Object]');
    }
  });
});
