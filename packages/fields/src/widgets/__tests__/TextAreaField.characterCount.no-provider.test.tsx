/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `TextAreaField`'s character counter with NO `I18nProvider` mounted
 * (objectui#3406) — standalone/embedded hosts, and most of this package's own
 * bare-render tests.
 *
 * ## Why this leg constrains the implementation
 *
 * Routing an accessible name through i18n must not turn it into a raw key
 * where nothing is configured — for a screen-reader-only string that failure
 * is invisible to everyone who could report it. Bare `useObjectTranslation()`
 * with no provider returns the key verbatim AND drops interpolation, which is
 * strictly worse than the English literal being replaced (measured on the
 * pre-change tree in objectui#3404, same hook, same package). So the widget
 * consumes `useFieldTranslation()` — `createSafeTranslation` plus English
 * defaults, which does its own `{{k}}` substitution.
 *
 * The expected sentence below is repeated verbatim in the `en`-provider case
 * of `TextAreaField.characterCount.i18n.test.tsx`. `packages/i18n` cannot
 * import `packages/fields` (the dependency runs the other way), so this pair of
 * literals is what pins pack and code default to the same bytes — and both to
 * the literal that existed before this change.
 *
 * ## Why a separate FILE and not another `describe`
 *
 * Mounting `I18nProvider` calls `initReactI18next`, which installs that
 * instance as react-i18next's GLOBAL default. After any sibling case has done
 * so there is no "no provider" state left in the module graph, and these
 * assertions would read that leaked instance instead of the fallback — green
 * for the wrong reason. Measured in objectui#3404: cases written inside the
 * provider file stayed GREEN under a reverse check that correctly reddened a
 * separate file. vitest's per-file isolation is what makes the observation
 * honest. Same split, same reason as
 * `FullscreenFieldEditor.no-provider.test.tsx` and
 * `TagsField.placeholder.no-provider.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import { TextAreaField } from '../TextAreaField';
import type { FieldMetadata } from '@object-ui/types';

const textareaField = (extra: Record<string, unknown> = {}) =>
  ({ name: 'notes', type: 'textarea', ...extra }) as unknown as FieldMetadata;

const counter = () => document.querySelector('[aria-live="polite"]');
const counterLabel = () => counter()?.getAttribute('aria-label');

describe('character counter — English fallback survives with no i18n configured (objectui#3406)', () => {
  it('renders the English default, not a raw key', () => {
    render(
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    // Byte-identical to the literal this change replaced.
    expect(counterLabel()).toBe('Character count: 5 of 200');
    // The measured failure mode, stated directly — a key reaching a user.
    expect(counterLabel()).not.toMatch(/fields\.textarea/);
  });

  it('substitutes BOTH placeholders in the fallback path', () => {
    // `createSafeTranslation`'s fallback runs its own `{{k}}` replacement.
    // Bare `useObjectTranslation` would leave the sentence unsubstituted
    // (in fact would not return a sentence at all).
    render(
      <TextAreaField value="hi" onChange={vi.fn()} field={textareaField({ maxLength: 40 })} />,
    );

    expect(counterLabel()).toBe('Character count: 2 of 40');
    expect(counterLabel()).not.toContain('{{');
  });

  it('announces zero for an empty value rather than a hole in the sentence', () => {
    // `0` is falsy, so an interpolation that guarded on truthiness would drop
    // it and speak "Character count:  of 40" — the one input length where the
    // substitution can fail on its own.
    //
    // Deliberately `''` and not `undefined`: `FieldWidgetComponentProps`
    // declares `value: T`, non-optional. The widget's `value || ''` guard
    // predates this change and covers a JS host that ignores the type; pinning
    // an out-of-contract shape here would be the lenient-consumer move
    // AGENTS.md #0.1 rules out, and is not what this issue is about.
    render(<TextAreaField value="" onChange={vi.fn()} field={textareaField({ maxLength: 40 })} />);

    expect(counterLabel()).toBe('Character count: 0 of 40');
  });

  it('keeps the live region — the attribute is why this string is spoken', () => {
    // This change is key-ing only. `aria-live="polite"` and the per-keystroke
    // recompute are a BEHAVIOUR question, filed separately and deliberately
    // untouched here; pin the attribute so "fixing" it silently is a red.
    render(
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    expect(counter()).toHaveAttribute('aria-live', 'polite');
  });

  it('the code-shipped default carries no CJK (Commandment #-1)', () => {
    // With no provider mounted, whatever renders here came from CODE
    // (FIELD_DEFAULTS). Escaped ranges on purpose: a literal CJK class would
    // itself violate the commandment this asserts (same shape as
    // `FullscreenFieldEditor.no-provider.test.tsx`).
    render(
      <TextAreaField value="hello" onChange={vi.fn()} field={textareaField({ maxLength: 200 })} />,
    );

    expect(counterLabel()).not.toMatch(/[\u3000-\u30ff\u4e00-\u9fff]/);
  });
});
