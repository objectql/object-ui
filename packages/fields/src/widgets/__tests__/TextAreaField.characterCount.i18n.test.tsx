/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `TextAreaField`'s character counter announces itself in the session locale —
 * objectui#3406.
 *
 * The counter block is rendered only when the field declares `maxLength`, and
 * what a sighted user sees (`{n}/{max}`) is digits, so nothing about this was
 * visible on screen. The block carries `aria-live="polite"`, and its accessible
 * name was the English literal `Character count: ${n} of ${max}` — so a zh/ja/ar
 * session had an English sentence read out on every keystroke, and only screen
 * reader users could perceive it.
 *
 * Unlike objectui#3404 (keys existed, this path did not consume them), no
 * `characterCount` key existed in any of the ten packs. `fields.textarea.characterCount`
 * is new here, in all ten, with `{{count}}` / `{{max}}`.
 *
 * ## What the cases assert, and why in this shape
 *
 * - **`en` is a NO-OP pin, not a defect reproducer.** The default in
 *   `FIELD_DEFAULTS` is byte-identical to the literal it replaced, so the
 *   English case was green before this change too. It is here to prove the
 *   swap did not alter English rendering — only a positive assertion sees that
 *   direction. Its exact expected string is repeated verbatim in
 *   `TextAreaField.characterCount.no-provider.test.tsx`; together the two pin
 *   pack-default equality across a boundary the packages cannot import across.
 * - **Non-`en` positive AND English-literal negative, together.** A re-inlined
 *   literal sitting next to a translated sibling still satisfies a
 *   positive-only assertion.
 * - **`ja` carries the load-bearing ORDER check.** Its translation puts the cap
 *   BEFORE the count ("of {{max}} characters, {{count}}"). An implementation
 *   that assembled the sentence from parts in code — "label + count + separator +
 *   max" — cannot produce that order, so it passes a zh-only check by luck and
 *   fails here. This is the case that justifies one interpolated key over a
 *   per-part assembly.
 * - **`ru` and `ar` are the plural-resolution check.** `count` is not an
 *   ordinary interpolation variable to i18next: passing it activates plural
 *   lookup (`key_one` / `key_few` / `key_many` / …) BEFORE the base key. Both
 *   packs declare the base key only, and both languages have multi-form plural
 *   rules, so these two prove the base-key fallback actually resolves rather
 *   than leaving the user with a raw key. `{{count}}` is the spelling this
 *   repo already uses for counts (`table.selected`, `lookup.recordCount`), and
 *   this pins that it keeps working for a pack with no plural forms declared.
 * - **Recompute-on-input.** The name is derived per render. Pinned so a future
 *   memo cannot freeze it at the mount-time length while the visible digits
 *   move on.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider } from '@object-ui/i18n';

import { TextAreaField } from '../TextAreaField';
import type { FieldMetadata } from '@object-ui/types';

const textareaField = (extra: Record<string, unknown> = {}) =>
  ({ name: 'notes', type: 'textarea', ...extra }) as unknown as FieldMetadata;

function renderIn(language: string, element: React.ReactElement) {
  return render(
    <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
      {element}
    </I18nProvider>,
  );
}

/**
 * The counter is queried by its live-region role rather than by its own text:
 * the wrapper `div` has the same `textContent` as the counter (the textarea
 * contributes none), so a text query matches two nodes. Reading the element
 * this way also keeps `aria-live` itself under assertion — the attribute is
 * the reason this string is spoken at all.
 */
const counter = () => document.querySelector('[aria-live="polite"]');
const counterLabel = () => counter()?.getAttribute('aria-label');

describe('TextAreaField character counter is translated (objectui#3406)', () => {
  it('renders the English sentence under an en provider', () => {
    renderIn(
      'en',
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    // Byte-identical to the literal this replaced, so `en` is a no-op change.
    expect(counterLabel()).toBe('Character count: 5 of 200');
    expect(counter()).toHaveTextContent('5/200');
  });

  it('renders the sentence in Chinese under a zh provider', () => {
    renderIn(
      'zh',
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    expect(counterLabel()).toBe('已输入 5 个字符，最多 200 个');
    // The literal, asserted absent — a re-inlined one would still satisfy a
    // positive-only check on a sibling case.
    expect(counterLabel()).not.toMatch(/character count/i);
    // The digits stay language-independent; only the accessible name moved.
    expect(counter()).toHaveTextContent('5/200');
  });

  it('renders the sentence in Japanese, with the cap interpolated BEFORE the count', () => {
    renderIn(
      'ja',
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    // `{{max}}` precedes `{{count}}` in this pack. Code-side concatenation
    // cannot produce this order — that is the point of the assertion.
    expect(counterLabel()).toBe('文字数: 200 文字中 5 文字');
    expect(counterLabel()!.indexOf('200')).toBeLessThan(counterLabel()!.indexOf('5'));
    expect(counterLabel()).not.toMatch(/character count/i);
  });

  it('resolves the base key under ru, whose plural rules i18next consults first', () => {
    renderIn(
      'ru',
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    expect(counterLabel()).toBe('Количество символов: 5 из 200');
    // The failure this guards: plural lookup missing and no base-key fallback
    // would surface the raw key instead of a sentence.
    expect(counterLabel()).not.toContain('fields.textarea');
  });

  it('resolves the base key under ar as well', () => {
    renderIn(
      'ar',
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    expect(counterLabel()).toBe('عدد الأحرف: 5 من 200');
    expect(counterLabel()).not.toContain('fields.textarea');
  });

  it('recomputes the spoken count as the user types', () => {
    // Derived per render, not memoized at mount. A frozen name would keep
    // announcing "5" while the visible digits read 11.
    const Host = () => {
      const [v, setV] = React.useState('hello');
      return <TextAreaField value={v} onChange={setV} field={textareaField({ maxLength: 200 })} />;
    };
    renderIn('zh', <Host />);
    expect(counterLabel()).toBe('已输入 5 个字符，最多 200 个');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello world' } });

    expect(counterLabel()).toBe('已输入 11 个字符，最多 200 个');
    expect(counter()).toHaveTextContent('11/200');
  });

  it('keeps reading the legacy snake_case max_length spelling', () => {
    // The dual-read predates this change (framework#1878 §3). Keying the
    // sentence must not narrow which spelling reaches it.
    renderIn(
      'zh',
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ max_length: 80 })} />,
    );

    expect(counterLabel()).toBe('已输入 5 个字符，最多 80 个');
  });

  it('renders no counter at all when the field declares no maxLength', () => {
    // The block is `{maxLength && …}`. Translating it must not make it
    // unconditional — an always-present live region would announce on every
    // keystroke in every long-text field in the app.
    renderIn('zh', <TextAreaField value="hello" onChange={vi.fn()} field={textareaField()} />);

    expect(counter()).toBeNull();
  });

  it('renders no counter in the readonly branch', () => {
    // The translation hook had to move ABOVE the readonly early return
    // (rules-of-hooks). This pins that the hoist changed nothing a user sees
    // on that branch.
    renderIn(
      'zh',
      <TextAreaField
        value="hello"
        onChange={vi.fn()}
        readonly
        field={textareaField({ maxLength: 200 })}
      />,
    );

    expect(counter()).toBeNull();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

// The provider-LESS leg lives in `TextAreaField.characterCount.no-provider.test.tsx`.
// It cannot share this file: mounting `I18nProvider` installs its instance as
// react-i18next's GLOBAL default, so after any case above there is no "no
// provider" state left in this module graph to observe (measured in
// objectui#3404 — see that file's header).
