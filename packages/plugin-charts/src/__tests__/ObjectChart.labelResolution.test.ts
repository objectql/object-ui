/**
 * Tests for ObjectChart groupBy value→label resolution.
 *
 * Verifies that resolveGroupByLabels():
 * - Maps select field values to their option labels
 * - Handles string-only options (value === label)
 * - Falls back to humanizeLabel() when no options match
 * - Resolves lookup field IDs to referenced record names
 * - Gracefully handles missing metadata or dataSource errors
 * - Falls back to humanizeLabel() for unknown field types
 */

import { describe, it, expect, vi } from 'vitest';
import { resolveGroupByLabels, humanizeLabel } from '../ObjectChart';

describe('humanizeLabel', () => {
  it('should convert snake_case to Title Case', () => {
    expect(humanizeLabel('closed_won')).toBe('Closed Won');
  });

  it('should convert kebab-case to Title Case', () => {
    expect(humanizeLabel('high-priority')).toBe('High Priority');
  });

  it('should handle single word', () => {
    expect(humanizeLabel('active')).toBe('Active');
  });

  it('should handle empty string', () => {
    expect(humanizeLabel('')).toBe('');
  });
});

describe('resolveGroupByLabels', () => {
  // ---- select fields ----

  it('should map select field values to option labels', async () => {
    const data = [
      { stage: 'closed_won', amount: 500 },
      { stage: 'prospecting', amount: 200 },
      { stage: 'closed_lost', amount: 100 },
    ];

    const objectSchema = {
      fields: {
        stage: {
          type: 'select',
          options: [
            { value: 'prospecting', label: 'Prospecting' },
            { value: 'closed_won', label: 'Closed Won' },
            { value: 'closed_lost', label: 'Closed Lost' },
          ],
        },
      },
    };

    const result = await resolveGroupByLabels(data, 'stage', objectSchema);

    expect(result).toEqual([
      { stage: 'Closed Won', amount: 500 },
      { stage: 'Prospecting', amount: 200 },
      { stage: 'Closed Lost', amount: 100 },
    ]);
  });

  it('should handle string-only options where value equals label', async () => {
    const data = [
      { lead_source: 'Web', count: 10 },
      { lead_source: 'Phone', count: 5 },
    ];

    const objectSchema = {
      fields: {
        lead_source: {
          type: 'select',
          options: ['Web', 'Phone', 'Partner'],
        },
      },
    };

    const result = await resolveGroupByLabels(data, 'lead_source', objectSchema);

    expect(result).toEqual([
      { lead_source: 'Web', count: 10 },
      { lead_source: 'Phone', count: 5 },
    ]);
  });

  it('should humanize unmatched select values', async () => {
    const data = [
      { status: 'not_yet_started', count: 3 },
    ];

    const objectSchema = {
      fields: {
        status: {
          type: 'select',
          options: [
            { value: 'active', label: 'Active' },
          ],
        },
      },
    };

    const result = await resolveGroupByLabels(data, 'status', objectSchema);

    expect(result[0].status).toBe('Not Yet Started');
  });

  it('should humanize values when select field has empty options', async () => {
    const data = [
      { status: 'in_progress', count: 1 },
    ];

    const objectSchema = {
      fields: {
        status: {
          type: 'select',
          options: [],
        },
      },
    };

    const result = await resolveGroupByLabels(data, 'status', objectSchema);
    expect(result[0].status).toBe('In Progress');
  });

  // ---- lookup fields ----

  it('should resolve lookup field IDs to record names', async () => {
    const data = [
      { account: '1', amount: 500 },
      { account: '2', amount: 300 },
    ];

    const objectSchema = {
      fields: {
        account: {
          type: 'lookup',
          reference_to: 'accounts',
        },
      },
    };

    const mockFind = vi.fn().mockResolvedValue([
      { id: '1', name: 'Acme Corp' },
      { id: '2', name: 'Globex Inc' },
    ]);

    const dataSource = { find: mockFind };

    const result = await resolveGroupByLabels(data, 'account', objectSchema, dataSource);

    expect(result).toEqual([
      { account: 'Acme Corp', amount: 500 },
      { account: 'Globex Inc', amount: 300 },
    ]);

    expect(mockFind).toHaveBeenCalledWith('accounts', {
      $filter: { id: { $in: ['1', '2'] } },
      $top: 2,
    });
  });

  it('should use display_field from metadata for lookup label', async () => {
    const data = [
      { project: 'p1', hours: 40 },
    ];

    const objectSchema = {
      fields: {
        project: {
          type: 'lookup',
          reference_to: 'projects',
          display_field: 'title',
        },
      },
    };

    const mockFind = vi.fn().mockResolvedValue([
      { id: 'p1', title: 'Website Redesign', name: 'PRJ-001' },
    ]);

    const result = await resolveGroupByLabels(data, 'project', objectSchema, { find: mockFind });

    expect(result[0].project).toBe('Website Redesign');
  });

  it('should use id_field from metadata for lookup query', async () => {
    const data = [
      { owner: 'uid_42', count: 5 },
    ];

    const objectSchema = {
      fields: {
        owner: {
          type: 'lookup',
          reference_to: 'users',
          id_field: 'uid',
        },
      },
    };

    const mockFind = vi.fn().mockResolvedValue([
      { uid: 'uid_42', name: 'Jane Doe' },
    ]);

    const result = await resolveGroupByLabels(data, 'owner', objectSchema, { find: mockFind });

    expect(result[0].owner).toBe('Jane Doe');
    expect(mockFind).toHaveBeenCalledWith('users', {
      $filter: { uid: { $in: ['uid_42'] } },
      $top: 1,
    });
  });

  it('should handle lookup with reference property (ObjectStack convention)', async () => {
    const data = [
      { customer: '10', total: 100 },
    ];

    const objectSchema = {
      fields: {
        customer: {
          type: 'master_detail',
          reference: 'customers',
        },
      },
    };

    const mockFind = vi.fn().mockResolvedValue([
      { id: '10', name: 'Big Client' },
    ]);

    const result = await resolveGroupByLabels(data, 'customer', objectSchema, { find: mockFind });

    expect(result[0].customer).toBe('Big Client');
  });

  it('should keep raw values when lookup fetch fails', async () => {
    const data = [
      { account: '1', amount: 500 },
    ];

    const objectSchema = {
      fields: {
        account: {
          type: 'lookup',
          reference_to: 'accounts',
        },
      },
    };

    const dataSource = {
      find: vi.fn().mockRejectedValue(new Error('Network error')),
    };

    const result = await resolveGroupByLabels(data, 'account', objectSchema, dataSource);

    // Should gracefully return original data
    expect(result[0].account).toBe('1');
  });

  it('should keep raw values when no dataSource is available for lookup', async () => {
    const data = [
      { account: '1', amount: 500 },
    ];

    const objectSchema = {
      fields: {
        account: {
          type: 'lookup',
          reference_to: 'accounts',
        },
      },
    };

    const result = await resolveGroupByLabels(data, 'account', objectSchema);

    expect(result[0].account).toBe('1');
  });

  // ---- fallback / edge cases ----

  it('should humanize values when no field metadata exists', async () => {
    const data = [
      { category: 'high_priority', count: 5 },
    ];

    const objectSchema = { fields: {} };

    const result = await resolveGroupByLabels(data, 'category', objectSchema);

    expect(result[0].category).toBe('High Priority');
  });

  it('should humanize values for unknown field types', async () => {
    const data = [
      { region: 'north_america', revenue: 1000 },
    ];

    const objectSchema = {
      fields: {
        region: { type: 'text' },
      },
    };

    const result = await resolveGroupByLabels(data, 'region', objectSchema);

    expect(result[0].region).toBe('North America');
  });

  it('should return empty array for empty data', async () => {
    const result = await resolveGroupByLabels([], 'stage', { fields: {} });
    expect(result).toEqual([]);
  });

  it('should return data as-is when groupByField is empty', async () => {
    const data = [{ stage: 'a', count: 1 }];
    const result = await resolveGroupByLabels(data, '', { fields: {} });
    expect(result).toEqual(data);
  });

  it('should handle null objectSchema gracefully', async () => {
    const data = [{ stage: 'closed_won', count: 1 }];
    const result = await resolveGroupByLabels(data, 'stage', null);
    expect(result[0].stage).toBe('Closed Won');
  });
});
