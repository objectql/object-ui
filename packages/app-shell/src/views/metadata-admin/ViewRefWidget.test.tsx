// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WIDGETS } from './widgets';

afterEach(cleanup);

const ViewRef = WIDGETS['view-ref'];

/**
 * ADR-0047 `view-ref` widget — picks `interfaceConfig.sourceView` from the
 * source object's views (context.objectViews) instead of a free-text name the
 * author could mistype. Radix Select portals its option list on open (flaky in
 * jsdom), so these tests cover the parts that render eagerly: the registry
 * wiring, the closed trigger, and graceful degradation with no views.
 */
describe('view-ref widget', () => {
  it('is registered in the WIDGETS map', () => {
    expect(ViewRef).toBeTypeOf('function');
  });

  it('renders a combobox trigger when views are available', () => {
    render(
      <ViewRef
        value="default"
        onChange={() => {}}
        schema={{ type: 'string' }}
        context={{ objectViews: [
          { name: 'default', label: 'All records' },
          { name: 'mine', label: 'My records' },
        ] }}
      />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders (does not crash) when no source object / views are bound', () => {
    render(
      <ViewRef
        value={undefined}
        onChange={() => {}}
        schema={{ type: 'string' }}
        context={{ objectViews: [] }}
      />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('renders with an out-of-catalog value without throwing (stale value survives)', () => {
    render(
      <ViewRef
        value="renamed_view"
        onChange={() => {}}
        schema={{ type: 'string' }}
        context={{ objectViews: [{ name: 'default', label: 'All records' }] }}
      />,
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
