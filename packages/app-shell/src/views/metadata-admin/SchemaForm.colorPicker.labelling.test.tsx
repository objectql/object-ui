// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#4010, the third call site — the generic `color-picker` widget.
 *
 * `ColorPickerWidget` renders TWO different surfaces from one registry entry,
 * and only one of them can be named the way its host assumes:
 *
 *  - an enum palette → `div[role="radiogroup"]`, a container no `<label for>`
 *    can name;
 *  - a free colour → `<input type="color">`, a labelable element.
 *
 * `MetadataField` writes `<Label htmlFor={id}>` and hands the widget the same
 * `id` BEFORE either branch is chosen — the choice is made inside the widget,
 * from `schema`/`fieldSpec`. So the host cannot publish an IDREF for the group
 * to answer, the way the two curated inspectors' labels now do; teaching it to
 * needs a per-widget `labelling` declaration (the shape `packages/components`'
 * form renderer already has for field widgets, objectui#3961) and is filed as
 * objectui#4871 rather than guessed at here.
 *
 * Until then the group carries its OWN name, like this file's other
 * unassociated groups. Measured on `origin/main` before the change, the enum
 * branch's radiogroup had `aria-label: null`, `aria-labelledby: null` and an
 * accessible name of `''` — anonymous, while the free-colour branch beside it
 * had been self-naming all along.
 *
 * The host's `for` still resolves to nothing at THIS site; that is the residual
 * objectui#4871 carries. This file deliberately does not paper over it by moving
 * the id onto the group, which would make a link-checker happy while naming
 * nobody (pinned below).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SchemaForm } from './SchemaForm';

afterEach(cleanup);

const form = { type: 'simple' as const, sections: [{ label: 'Basics', fields: [{ field: 'colorVariant' }] }] };

/** `detectColorWidget` resolves `colorVariant` to the `color-picker` widget. */
function renderColorField(schema: Record<string, unknown>, value: unknown = 'blue') {
  return render(
    <SchemaForm
      schema={{ type: 'object', properties: { colorVariant: schema } } as never}
      form={form}
      value={{ colorVariant: value }}
      onChange={() => {}}
    />,
  );
}

describe('color-picker (enum branch) — the swatch group is named (objectui#4010)', () => {
  it('announces the field label rather than nothing', () => {
    renderColorField({ type: 'string', title: 'Color Variant', enum: ['default', 'blue', 'teal'] });

    const group = screen.getByRole('radiogroup');
    // Pre-fix: `''`. The swatches inside were named ("Blue"); the group was not.
    expect(group).toHaveAccessibleName('Color Variant');
    // Equal to the visible label — a generic stand-in ("Color") over a field
    // labelled "Color Variant" would fail WCAG 2.5.3 (Label in Name).
    expect(screen.getByText('Color Variant')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'Color Variant' })).toBeInTheDocument();
  });

  it('does NOT take the host id to make the dangling `for` resolve', () => {
    // The refused half-fix. `role="radiogroup"` is not labelable, so an id here
    // would satisfy "the IDREF resolves" while the group stayed unnamed — the
    // shape objectui#4010 was filed to remove, not to relocate.
    renderColorField({ type: 'string', title: 'Color Variant', enum: ['default', 'blue'] });

    const group = screen.getByRole('radiogroup');
    expect(group).not.toHaveAttribute('id');
    expect(group).not.toHaveAttribute('aria-labelledby');
    // The host's own `for` is untouched by this change and still resolves to
    // nothing HERE — a host-side `labelling` declaration is what fixes that
    // (objectui#4871). Documented, not endorsed: this assertion is the tripwire
    // that makes whoever lands #4871 update this file.
    const label = screen.getByText('Color Variant');
    expect(label).toHaveAttribute('for', 'mdf-colorVariant');
    expect(document.getElementById('mdf-colorVariant')).toBeNull();
  });

  it('falls back to the constant only when the host offers no label source', () => {
    // No `title`, so `MetadataField` prettifies the field name. The widget can
    // read neither that computation nor the locale, so it degrades to the same
    // constant its free-colour sibling has always used.
    renderColorField({ type: 'string', enum: ['default', 'blue'] });
    expect(screen.getByRole('radiogroup')).toHaveAccessibleName('Color');
  });
});

describe('color-picker (free-colour branch) — unchanged', () => {
  it('still renders the native picker, named as before', () => {
    // The branch split is where this change lives, so the other side is pinned
    // too: no enum ⇒ no radiogroup, and the labelable input keeps its own name.
    renderColorField({ type: 'string', title: 'Brand Color' }, '#112233');

    expect(screen.queryByRole('radiogroup')).toBeNull();
    const native = document.querySelector('input[type="color"]');
    expect(native).not.toBeNull();
    expect(native).toHaveAttribute('aria-label', 'Color');
  });
});
