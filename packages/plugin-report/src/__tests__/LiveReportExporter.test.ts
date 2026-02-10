/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DataSource, ReportSchema } from '@object-ui/types';
import {
  exportWithLiveData,
  exportExcelWithFormulas,
  createScheduleTrigger,
} from '../LiveReportExporter';

// Mock downloadFile via the DOM APIs used internally
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();

  // Mock DOM APIs
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(document, 'createElement').mockReturnValue({
    href: '',
    download: '',
    click: mockClick,
  } as any);
  vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild);
  vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild);
});

function createMockDataSource(data: any[] = []): DataSource {
  return {
    find: vi.fn().mockResolvedValue({ data, total: data.length }),
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(true),
    getObjectSchema: vi.fn().mockResolvedValue({}),
  };
}

const sampleReport: ReportSchema = {
  type: 'report',
  title: 'Sales Report',
  fields: [
    { name: 'product', label: 'Product', type: 'string' },
    { name: 'amount', label: 'Amount', type: 'number', aggregation: 'sum' },
    { name: 'count', label: 'Count', type: 'number', aggregation: 'count' },
  ],
};

const sampleData = [
  { product: 'Widget A', amount: 100, count: 5 },
  { product: 'Widget B', amount: 200, count: 10 },
  { product: 'Widget C', amount: 300, count: 15 },
];

describe('exportWithLiveData', () => {
  it('should fetch data from DataSource and export', async () => {
    const ds = createMockDataSource(sampleData);

    const result = await exportWithLiveData(sampleReport, {
      dataSource: ds,
      resource: 'orders',
      format: 'csv',
    });

    expect(ds.find).toHaveBeenCalledWith('orders', undefined);
    expect(result.success).toBe(true);
    expect(result.recordCount).toBe(3);
    expect(result.format).toBe('csv');
  });

  it('should pass query params to DataSource', async () => {
    const ds = createMockDataSource([]);
    const params = { filter: { status: 'active' }, limit: 50 };

    await exportWithLiveData(sampleReport, {
      dataSource: ds,
      resource: 'products',
      queryParams: params,
      format: 'json',
    });

    expect(ds.find).toHaveBeenCalledWith('products', params);
  });

  it('should default to PDF format', async () => {
    const ds = createMockDataSource(sampleData);

    // Mock window.open for PDF export
    vi.spyOn(window, 'open').mockReturnValue(null);

    const result = await exportWithLiveData(sampleReport, {
      dataSource: ds,
      resource: 'orders',
    });

    expect(result.format).toBe('pdf');
    expect(result.success).toBe(true);
  });

  it('should return error result on DataSource failure', async () => {
    const ds = createMockDataSource();
    (ds.find as any).mockRejectedValue(new Error('Network error'));

    const result = await exportWithLiveData(sampleReport, {
      dataSource: ds,
      resource: 'orders',
      format: 'csv',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network error');
    expect(result.recordCount).toBe(0);
  });
});

describe('exportExcelWithFormulas', () => {
  it('should export with default columns from report fields', () => {
    exportExcelWithFormulas(sampleReport, sampleData);

    expect(mockClick).toHaveBeenCalled();
  });

  it('should export with custom columns', () => {
    exportExcelWithFormulas(sampleReport, sampleData, {
      columns: [
        { name: 'product', header: 'Product Name' },
        { name: 'amount', header: 'Amount ($)', numberFormat: '#,##0.00' },
      ],
    });

    expect(mockClick).toHaveBeenCalled();
  });

  it('should include formula cells', () => {
    exportExcelWithFormulas(sampleReport, sampleData, {
      columns: [
        { name: 'amount', header: 'Amount' },
        { name: 'total', header: 'Running Total', formula: '=SUM(A2:A{ROW})' },
      ],
    });

    expect(mockClick).toHaveBeenCalled();
  });

  it('should include aggregation row when enabled', () => {
    exportExcelWithFormulas(sampleReport, sampleData, {
      includeAggregationRow: true,
    });

    expect(mockClick).toHaveBeenCalled();
  });

  it('should use custom filename', () => {
    exportExcelWithFormulas(sampleReport, sampleData, {
      filename: 'custom-report.tsv',
    });

    expect(mockClick).toHaveBeenCalled();
  });
});

describe('createScheduleTrigger', () => {
  it('should create a trigger function', () => {
    const ds = createMockDataSource(sampleData);
    const onComplete = vi.fn();

    const trigger = createScheduleTrigger(
      { ...sampleReport, schedule: { enabled: true, formats: ['csv', 'json'] } },
      ds,
      'orders',
      onComplete,
    );

    expect(typeof trigger).toBe('function');
  });

  it('should export all scheduled formats when triggered', async () => {
    const ds = createMockDataSource(sampleData);
    const onComplete = vi.fn();

    const report: ReportSchema = {
      ...sampleReport,
      schedule: { enabled: true, formats: ['csv', 'json'] },
    };

    const trigger = createScheduleTrigger(report, ds, 'orders', onComplete);
    const results = await trigger();

    expect(results).toHaveLength(2);
    expect(results[0].format).toBe('csv');
    expect(results[1].format).toBe('json');
    expect(onComplete).toHaveBeenCalledWith(report, report.schedule);
  });

  it('should return empty results when schedule is disabled', async () => {
    const ds = createMockDataSource(sampleData);
    const onComplete = vi.fn();

    const trigger = createScheduleTrigger(
      { ...sampleReport, schedule: { enabled: false } },
      ds,
      'orders',
      onComplete,
    );

    const results = await trigger();
    expect(results).toHaveLength(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should default to PDF when no formats specified', async () => {
    const ds = createMockDataSource(sampleData);
    const onComplete = vi.fn();

    // Mock window.open for PDF export
    vi.spyOn(window, 'open').mockReturnValue(null);

    const trigger = createScheduleTrigger(
      { ...sampleReport, schedule: { enabled: true } },
      ds,
      'orders',
      onComplete,
    );

    const results = await trigger();
    expect(results).toHaveLength(1);
    expect(results[0].format).toBe('pdf');
  });
});
