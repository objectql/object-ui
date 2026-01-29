/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectAgGridRenderer } from './index';
import type { DataSource } from '@object-ui/types';

describe('ObjectAgGridRenderer', () => {
  let mockDataSource: DataSource;

  beforeEach(() => {
    mockDataSource = {
      find: vi.fn().mockResolvedValue({
        data: [
          { id: '1', name: 'Test 1', email: 'test1@example.com' },
          { id: '2', name: 'Test 2', email: 'test2@example.com' }
        ],
        total: 2,
        page: 1,
        pageSize: 10,
        hasMore: false
      }),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      bulk: vi.fn(),
      getObjectSchema: vi.fn().mockResolvedValue({
        name: 'contacts',
        label: 'Contacts',
        fields: {
          name: {
            name: 'name',
            label: 'Name',
            type: 'text',
            sortable: true,
            filterable: true
          },
          email: {
            name: 'email',
            label: 'Email',
            type: 'email',
            sortable: true,
            filterable: true
          }
        }
      })
    } as any;
  });

  it('should be defined', () => {
    expect(ObjectAgGridRenderer).toBeDefined();
  });

  it('should accept schema with objectName and dataSource', () => {
    const schema = {
      type: 'object-aggrid',
      objectName: 'contacts',
      dataSource: mockDataSource
    };

    expect(() => {
      ObjectAgGridRenderer({ schema });
    }).not.toThrow();
  });

  it('should accept optional pagination settings', () => {
    const schema = {
      type: 'object-aggrid',
      objectName: 'contacts',
      dataSource: mockDataSource,
      pagination: true,
      pageSize: 20
    };

    expect(() => {
      ObjectAgGridRenderer({ schema });
    }).not.toThrow();
  });

  it('should accept optional filters and sorting', () => {
    const schema = {
      type: 'object-aggrid',
      objectName: 'contacts',
      dataSource: mockDataSource,
      filters: { status: 'active' },
      sort: { name: 'asc' as const }
    };

    expect(() => {
      ObjectAgGridRenderer({ schema });
    }).not.toThrow();
  });
});
