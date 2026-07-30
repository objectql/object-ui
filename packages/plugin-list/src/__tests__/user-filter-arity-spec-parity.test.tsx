/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * User-filter control arity ↔ spec vocabulary parity + behavior (#2941).
 *
 * `UserFilterFieldSchema.type` (`ui/view.zod.ts`) names both `select` and
 * `multi-select`, so `select` necessarily means single-choice. The dropdown
 * filter used to render accumulating checkboxes for every control type — a
 * single-choice filter silently accepted many values, and the emitted
 * condition looked plausible (`['status', 'in', [a, b]]`) while contradicting
 * the authored contract.
 *
 * Contract under test:
 * - parity: `FILTER_CONTROL_ARITY` maps exactly the spec's vocabulary;
 * - authored `type: 'select'` renders radios and replaces the pick;
 * - authored `type: 'multi-select'` (and an omitted, inferred type) keeps
 *   accumulating checkboxes;
 * - restored/default selections for a single-choice control clamp to one.
 */
import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserFilterFieldSchema } from '@objectstack/spec/ui';
import { UserFilters, FILTER_CONTROL_ARITY } from '../UserFilters';

const objectDef = {
  name: 'tasks',
  fields: {
    status: {
      type: 'select',
      label: 'Status',
      options: [
        { label: 'To Do', value: 'todo' },
        { label: 'Doing', value: 'doing' },
        { label: 'Done', value: 'done' },
      ],
    },
  },
};

/** The spec's control-type vocabulary, read through the `.optional()` wrapper. */
function specControlTypes(): string[] {
  const typeSchema = (UserFilterFieldSchema as unknown as { shape?: Record<string, unknown> })
    .shape?.type as { def?: { innerType?: { options?: readonly string[] } } } | undefined;
  const options = typeSchema?.def?.innerType?.options;
  return Array.isArray(options) ? [...options] : [];
}

describe('FILTER_CONTROL_ARITY covers the spec user-filter control vocabulary', () => {
  const specNames = specControlTypes();

  it('reads a non-empty enum from the spec', () => {
    expect(specNames, 'could not read UserFilterFieldSchema.shape.type options from the spec').not.toEqual([]);
  });

  it('declares an arity for every control type the spec accepts', () => {
    const undeclared = specNames.filter((name) => !(name in FILTER_CONTROL_ARITY));
    expect(
      undeclared,
      'these pass schema validation with no declared selection arity — add them to FILTER_CONTROL_ARITY',
    ).toEqual([]);
  });

  it('does not declare control types the spec rejects', () => {
    const extra = Object.keys(FILTER_CONTROL_ARITY).filter((name) => !specNames.includes(name));
    expect(
      extra,
      'these are renderer-local dialect — promote them into @objectstack/spec instead',
    ).toEqual([]);
  });
});

describe("filter type 'select' is single-choice", () => {
  it('renders radios and replaces the pick instead of accumulating', () => {
    const onFilterChange = vi.fn();
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status', type: 'select' }] } as any}
        objectDef={objectDef}
        data={[]}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByTestId('filter-badge-status'));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

    fireEvent.click(screen.getByText('To Do'));
    expect(onFilterChange).toHaveBeenLastCalledWith([['status', 'in', ['todo']]]);

    // Picking a second option REPLACES the first — never two values at once.
    fireEvent.click(screen.getByText('Done'));
    expect(onFilterChange).toHaveBeenLastCalledWith([['status', 'in', ['done']]]);
  });

  it("authored 'multi-select' keeps accumulating checkboxes", () => {
    const onFilterChange = vi.fn();
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status', type: 'multi-select' }] } as any}
        objectDef={objectDef}
        data={[]}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.click(screen.getByTestId('filter-badge-status'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);

    fireEvent.click(screen.getByText('To Do'));
    fireEvent.click(screen.getByText('Done'));
    expect(onFilterChange).toHaveBeenLastCalledWith([['status', 'in', ['todo', 'done']]]);
  });

  it('an omitted (inferred) type keeps the historical multi-check UX', () => {
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status' }] } as any}
        objectDef={objectDef}
        data={[]}
        onFilterChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId('filter-badge-status'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('clamps a multi-value restored selection to one value', () => {
    const onFilterChange = vi.fn();
    render(
      <UserFilters
        config={{ element: 'dropdown', fields: [{ field: 'status', type: 'select' }] } as any}
        objectDef={objectDef}
        data={[]}
        onFilterChange={onFilterChange}
        initialSelections={{ status: ['todo', 'done'] }}
      />,
    );

    expect(onFilterChange).toHaveBeenLastCalledWith([['status', 'in', ['todo']]]);
  });
});
