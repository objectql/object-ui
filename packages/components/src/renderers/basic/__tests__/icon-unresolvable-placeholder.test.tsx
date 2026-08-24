/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `ui:icon` — an unresolvable glyph renders a VISIBLE placeholder, never
 * nothing (objectui#5631, maintainer ruling 2026-08-22 comment 5380754137:
 * "an unresolvable icon renders a visible placeholder instead of `null`,
 * **regardless** of the key question").
 *
 * ## What this file pins, and what it deliberately does not
 *
 * It pins the END OF THE SILENCE — item 3 of the ruling, which is unconditional
 * and independent of which schema key names the glyph. It does NOT pin
 * `schema.icon` as the glyph key (item 1): that migration is blocked on a
 * measured corpus, and the PR body carries the reading. So every case below
 * still authors `name`, exactly as the renderer still reads it.
 *
 * ## Why the warning is asserted through an explicit spy
 *
 * Vitest 4 runs with `silent: 'passed-only'`, so `console.warn` output from a
 * PASSING test is discarded — it never reaches stderr for a human to notice.
 * Observing the warning by eye is therefore not available here, and a test
 * that "checked" it by reading output would check nothing. `vi.spyOn` captures
 * the call regardless of what the reporter prints. That property is not
 * incidental: an unread `console.warn` is half of why objectui#5631 stayed
 * invisible, so the warning is pinned as behaviour rather than trusted.
 *
 * ## Why the assertions are on the RENDERED RESULT, not on `!== null`
 *
 * The pre-fix branch returned `null`. A test asserting `container.firstChild`
 * is non-null would pass against a placeholder that rendered an empty
 * `<span/>` — invisible to a human and attribute-clean to the DOM-leak sweep,
 * i.e. the same defect wearing a different shape. Each case below resolves
 * something a person or a gate could actually see: a real `svg` host, the
 * authored box (`className`/size) still applied to it, an accessible name, and
 * the marker attribute.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SchemaRenderer } from '@object-ui/react';
// Registers `ui:icon` at module scope, not in a hook
// (object-ui/no-dynamic-import-in-test-hook, objectui#3010).
import '../../../renderers';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderIcon(schema: Record<string, unknown>) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = render(<SchemaRenderer schema={{ type: 'icon', ...schema } as never} />);
  return { container, warn };
}

/** The marker the placeholder branch puts on its host, for gates and for this file. */
const MARKER = '[data-objectui-icon-unresolved]';

describe('ui:icon — unresolvable glyph', () => {
  it('renders a visible SVG placeholder instead of nothing', () => {
    const { container } = renderIcon({ name: 'definitely-not-a-lucide-icon' });

    const placeholder = container.querySelector(MARKER);
    expect(placeholder).not.toBeNull();
    // The host is a real SVG, the same element kind a resolved glyph renders,
    // so the gap occupies the layout slot the icon would have occupied.
    expect(placeholder?.tagName.toLowerCase()).toBe('svg');
    expect(placeholder?.getAttribute('data-objectui-icon-unresolved')).toBe(
      'definitely-not-a-lucide-icon',
    );
  });

  it('names the unresolved icon in its accessible name', () => {
    renderIcon({ name: 'definitely-not-a-lucide-icon' });

    // `role="img"` + `aria-label`: the placeholder is perceivable, and it says
    // WHICH icon failed rather than being an anonymous box.
    expect(
      screen.getByRole('img', { name: 'Unresolved icon: definitely-not-a-lucide-icon' }),
    ).toBeTruthy();
  });

  it('warns, naming the identity-key collision that is objectui#5631', () => {
    const { warn } = renderIcon({ name: 'save_icon' });

    // Not a pinned call COUNT: React invokes the render function more than
    // once here (measured: two calls for one `render`), and pinning the number
    // would make this file fail on a StrictMode change rather than on the
    // behaviour it is about. What matters is that the warning happens and what
    // it says.
    expect(warn).toHaveBeenCalled();
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('save_icon');
    expect(message).toContain('objectui#5631');
    // The warning must say why an ordinary authored identity lands here — the
    // reader of this warning is an author who wrote `name: 'save_icon'` and is
    // looking at a placeholder.
    expect(message).toContain('identity key');
  });

  it('keeps the authored box: className and size still reach the placeholder', () => {
    const { container } = renderIcon({
      name: 'definitely-not-a-lucide-icon',
      className: 'text-red-500',
      size: 48,
    });

    const placeholder = container.querySelector(MARKER) as SVGElement | null;
    expect(placeholder).not.toBeNull();
    // Without this the placeholder would collapse to lucide's default box and
    // the gap would not sit where the author put the icon.
    expect(placeholder?.getAttribute('class')).toContain('text-red-500');
    expect(placeholder?.getAttribute('style')).toContain('48px');
  });

  it('renders the placeholder — not a thrown error — when `name` is absent entirely', () => {
    // Pre-fix this reached `toPascalCase(undefined)` and threw on
    // `undefined.split`, which the SchemaErrorBoundary then swallowed: a THIRD
    // way for this renderer to fail without saying so. `name` is typed
    // `string` on `IconSchema`, but it arrives from authored JSON.
    const { container, warn } = renderIcon({ id: 'no_name_node' });

    const placeholder = container.querySelector(MARKER);
    expect(placeholder).not.toBeNull();
    expect(placeholder?.getAttribute('data-objectui-icon-unresolved')).toBe('(none)');
    expect(String(warn.mock.calls[0]?.[0])).toContain('an absent icon name');
  });
});

describe('ui:icon — resolvable glyph is untouched by objectui#5631', () => {
  it('renders the real lucide glyph with no placeholder and no warning', () => {
    const { container, warn } = renderIcon({ name: 'check', className: 'text-green-500' });

    expect(container.querySelector(MARKER)).toBeNull();
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('class')).toContain('text-green-500');
    expect(warn).not.toHaveBeenCalled();
  });

  it('still resolves the kebab-case and renamed-icon paths', () => {
    // `home` -> `Home` -> mapped to `House`: the `iconNameMap` hop, which the
    // placeholder branch must not have short-circuited.
    const { container, warn } = renderIcon({ name: 'home' });

    expect(container.querySelector(MARKER)).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the placeholder glyph itself resolves (objectui#5622 mechanism)', () => {
  it('is imported by name, so it cannot silently become another `null`', async () => {
    // The failure this guards: lucide retires a spelling by dropping it from
    // the runtime `icons` record while KEEPING the deprecated named export.
    // A placeholder looked up in that record could therefore resolve to
    // `undefined` and render nothing — objectui#5631 again, one level up.
    // Measured on lucide-react 1.31.0: `CircleHelp` and `HelpCircle` are both
    // ABSENT from the record while both resolve as named exports, so this is
    // not a hypothetical hazard.
    const lucide = await import('lucide-react');

    expect(typeof (lucide as Record<string, unknown>).SquareDashed).not.toBe('undefined');
    // The record-based lookup this file's renderer uses for AUTHORED names is
    // exactly what the placeholder must not depend on. Pinned so that a future
    // edit swapping the named import for `icons[...]` has to face this case.
    expect(
      Object.prototype.hasOwnProperty.call(lucide.icons, 'CircleHelp')
        || Object.prototype.hasOwnProperty.call(lucide.icons, 'HelpCircle'),
    ).toBe(false);
  });
});
