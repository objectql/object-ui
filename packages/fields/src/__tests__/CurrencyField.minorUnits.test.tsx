/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4361, second path — `CurrencyField`'s `precision`.
 *
 * `formatAmount` passes the field's `precision` to BOTH `Intl` bounds, and the
 * widget defaulted that precision to a literal `2`. So a JPY field that
 * declared no precision rendered `¥1,234.50` for the same reason
 * `formatCurrency` did, one layer up.
 *
 * The PM ruling on this card (issue #4361, claim comment) splits it in two,
 * and both halves are pinned here:
 *
 *  1. **An explicitly authored `precision` WINS.** It is authored metadata and
 *     this repo's convention is that authored metadata keeps priority. A JPY
 *     field declaring `precision: 2` still renders `¥1,234.50` — whether that
 *     combination should be REJECTED at publish time is a spec question filed
 *     upstream (contract-first), not something the renderer decides by
 *     overriding the author.
 *  2. **An ABSENT `precision` derives from the currency** instead of falling
 *     back to 2.
 *
 * MEASURED, per the ruling's stop condition — is "absent" distinguishable from
 * "authored 2" by the time the renderer sees it? Yes:
 *
 *   - `CurrencyFieldMetadata.precision` is `precision?: number` in
 *     `packages/types/src/field-types.ts` — optional, no default;
 *   - the field-level key is `z.ZodOptional<z.ZodNumber>` in
 *     `@objectstack/spec` (no `.default()`), so a parsed field metadata object
 *     does NOT carry a materialized 2;
 *   - the only `.default(2)` in the spec's currency surface is on
 *     `CurrencyConfigSchema.precision` — a DIFFERENT key on a different object
 *     (the `currencyConfig` block), which this widget never reads; and
 *   - the `?? 2` itself lived in the widget, at `CurrencyField.tsx`.
 *
 * So the renderer holds an `undefined` it can act on, and this half lands.
 *
 * The derived precision is the widget's ONE precision, so it reaches the edit
 * affordances too (`step`, and the blur rounding) — pinned below. Leaving
 * those at 2 would have produced a JPY field that displays whole yen but
 * offers a 0.01 spinner step and rounds typed input to 1234.56 yen.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LocalizationProvider } from '@object-ui/i18n';
import { CurrencyField } from '../widgets/CurrencyField';

/**
 * ICU separates a currency CODE from the amount with U+00A0 (`KWD` + NBSP +
 * `1.500`), while a SYMBOL is flush against it (`¥1,235`). `textContent` is
 * raw, so normalizing keeps these pins about the DIGIT COUNT this card is
 * about rather than about ICU's spacing. Written as an escape, never a pasted
 * byte — a raw NBSP in source is invisible to readers and unfindable by grep.
 */
const normalizeNbsp = (s: string | null) => (s ?? '').replace(/\u00a0/g, ' ');

const renderField = (
  value: number | null,
  field: Record<string, unknown>,
  opts: { readonly?: boolean; locale?: string; tenantCurrency?: string; onChange?: (v: any) => void } = {},
) =>
  render(
    <LocalizationProvider value={{ locale: opts.locale ?? 'en-US', currency: opts.tenantCurrency }}>
      <CurrencyField
        value={value as any}
        onChange={opts.onChange ?? vi.fn()}
        field={{ type: 'currency', ...field } as any}
        readonly={opts.readonly}
      />
    </LocalizationProvider>,
  );

describe('CurrencyField — an ABSENT precision derives from the currency (objectui#4361)', () => {
  it('a JPY field that declares no precision shows no cents', () => {
    const { container } = renderField(1234.5, { currency: 'JPY' }, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('¥1,235');
  });

  it('a KWD field that declares no precision shows all three digits', () => {
    const { container } = renderField(1.5, { currency: 'KWD' }, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('KWD 1.500');
  });

  it('the tenant default currency reaches the derivation too (ADR-0053)', () => {
    const { container } = renderField(1234.5, {}, { readonly: true, tenantCurrency: 'JPY' });
    expect(normalizeNbsp(container.textContent)).toBe('¥1,235');
  });

  it('`currencyConfig.defaultCurrency` reaches it as well', () => {
    const { container } = renderField(
      1.5,
      { currencyConfig: { defaultCurrency: 'KWD' } },
      { readonly: true },
    );
    expect(normalizeNbsp(container.textContent)).toBe('KWD 1.500');
  });
});

describe('CurrencyField — an AUTHORED precision still wins (authored metadata keeps priority)', () => {
  it('a JPY field declaring `precision: 2` keeps its two digits', () => {
    // The renderer does not overrule the author. Whether publish-time
    // validation should reject this combination is the upstream spec question
    // filed alongside this card — deliberately NOT decided here.
    const { container } = renderField(1234.5, { currency: 'JPY', precision: 2 }, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('¥1,234.50');
  });

  it('an authored `precision: 0` on a 2-digit currency still wins', () => {
    // The other direction, so the pin cannot be satisfied by "authored wins
    // only when it asks for MORE digits".
    const { container } = renderField(1234.5, { currency: 'USD', precision: 0 }, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('$1,235');
  });

  it('an authored `precision: 3` on JPY wins', () => {
    const { container } = renderField(1234.5, { currency: 'JPY', precision: 3 }, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('¥1,234.500');
  });
});

describe('CurrencyField — CONTROL: the 2-digit and no-currency cases are unchanged', () => {
  it('a USD field with no declared precision renders exactly as before', () => {
    // Derivation and the old literal agree at 2, which is the whole point of
    // "byte-identical for USD".
    const { container } = renderField(1234.5, { currency: 'USD' }, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('$1,234.50');
  });

  it('a USD field declaring `precision: 2` renders exactly as before', () => {
    const { container } = renderField(1234.56, { currency: 'USD', precision: 2 }, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('$1,234.56');
  });

  it('a field with NO currency keeps the literal 2 — nothing to derive from', () => {
    const { container } = renderField(1234.5, {}, { readonly: true });
    expect(normalizeNbsp(container.textContent)).toBe('1,234.50');
  });

  it('a null value is still the empty marker, not a formatted zero', () => {
    const { container } = renderField(null, { currency: 'JPY' }, { readonly: true });
    expect(container.textContent).not.toContain('¥');
  });
});

describe('CurrencyField — the derived precision is the widget\'s ONE precision', () => {
  it('a JPY field with no declared precision offers a whole-unit spinner step', () => {
    renderField(1234, { currency: 'JPY' });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '1');
  });

  it('a KWD field with no declared precision offers a three-digit step', () => {
    renderField(1, { currency: 'KWD' });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.001');
  });

  it('CONTROL: USD is still 0.01, authored or derived', () => {
    const { unmount } = renderField(1, { currency: 'USD' });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.01');
    unmount();
    renderField(1, { currency: 'JPY', precision: 2 });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.01');
  });

  it('blur rounds a typed amount to the currency\'s own unit', () => {
    const onChange = vi.fn();
    renderField(null, { currency: 'JPY' }, { onChange });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1234.56' } });
    fireEvent.blur(input, { target: { value: '1234.56' } });
    // Before: 1234.56 yen — a sub-unit amount the currency cannot express.
    expect(onChange).toHaveBeenLastCalledWith(1235);
  });

  it('CONTROL: blur on a USD field still rounds to cents', () => {
    const onChange = vi.fn();
    renderField(null, { currency: 'USD' }, { onChange });
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '1234.567' } });
    fireEvent.blur(input, { target: { value: '1234.567' } });
    expect(onChange).toHaveBeenLastCalledWith(1234.57);
  });
});
