// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Regression: InspectorSelectField must accept an option whose value is
 * the empty string (a "— None —" choice). Radix `<Select.Item value="">`
 * throws on render; the field bridges "" through an internal sentinel.
 * This is exactly what the object field "Group" selector relies on once
 * field groups exist, so a regression here crashes the whole inspector.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InspectorSelectField } from './_shared';

afterEach(cleanup);

const OPTIONS = [
  { value: '', label: '— No group —' },
  { value: 'profile', label: 'Profile' },
  { value: 'meta', label: 'Metadata' },
];

describe('InspectorSelectField — empty-value option', () => {
  it('renders with an empty-string option without throwing', () => {
    expect(() =>
      render(
        <InspectorSelectField label="Group" value="" options={OPTIONS} onCommit={vi.fn()} />,
      ),
    ).not.toThrow();
    expect(screen.getByText('Group')).toBeInTheDocument();
  });

  it('shows the selected non-empty option label on the trigger', () => {
    render(
      <InspectorSelectField label="Group" value="profile" options={OPTIONS} onCommit={vi.fn()} />,
    );
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('displays the empty-valued option label when value is "" (round-trips through the sentinel)', () => {
    render(
      <InspectorSelectField
        label="Group"
        value=""
        options={OPTIONS}
        onCommit={vi.fn()}
        placeholder="Pick one"
      />,
    );
    // value "" matches the "— No group —" option (both bridged to the
    // sentinel), so the trigger surfaces that label rather than the
    // placeholder — confirming the "" ⇄ none round-trip works.
    expect(screen.getByText('— No group —')).toBeInTheDocument();
    expect(screen.queryByText('Pick one')).not.toBeInTheDocument();
  });
});
