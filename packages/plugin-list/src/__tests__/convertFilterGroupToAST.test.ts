import { describe, it, expect } from 'vitest';
import { convertFilterGroupToAST } from '../ListView';
import type { FilterGroup } from '@object-ui/components';

describe('convertFilterGroupToAST', () => {
  it('skips incomplete rows with an empty value (no filter, not `field = ""`)', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'project_type', operator: 'equals', value: '' }],
    } as FilterGroup;
    // Empty value → no condition emitted, so all rows show.
    expect(convertFilterGroupToAST(group)).toEqual([]);
  });

  it.each([undefined, null, '', []])('skips value %p', (value) => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'x', operator: 'equals', value }],
    } as unknown as FilterGroup;
    expect(convertFilterGroupToAST(group)).toEqual([]);
  });

  it('keeps rows with a real value', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'x', operator: 'equals', value: 'foo' }],
    } as FilterGroup;
    expect(convertFilterGroupToAST(group)).toEqual(['x', '=', 'foo']);
  });

  it('keeps isEmpty/isNotEmpty operators even though they carry no value', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [{ field: 'x', operator: 'isEmpty', value: '' }],
    } as FilterGroup;
    expect(convertFilterGroupToAST(group)).toEqual(['x', '=', null]);
  });

  it('drops only the incomplete row in a mixed group', () => {
    const group: FilterGroup = {
      logic: 'and',
      conditions: [
        { field: 'a', operator: 'equals', value: 'foo' },
        { field: 'b', operator: 'equals', value: '' },
      ],
    } as FilterGroup;
    // Single surviving condition unwraps to the bare triplet.
    expect(convertFilterGroupToAST(group)).toEqual(['a', '=', 'foo']);
  });
});
