/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/core - Window Function Tests
 * 
 * Tests for ObjectStack Spec v0.7.1 window function support
 */

import { describe, it, expect } from 'vitest';
import { QueryASTBuilder } from '../query-ast';
import type { WindowNode, WindowFunction } from '@object-ui/types';

describe('QueryASTBuilder - Window Functions', () => {
  const builder = new QueryASTBuilder();

  describe('buildWindow', () => {
    it('should build a simple row_number window function', () => {
      const config = {
        function: 'row_number' as WindowFunction,
        alias: 'row_num',
        partitionBy: ['department'],
        orderBy: [{ field: 'salary', direction: 'desc' as const }],
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'row_number',
        alias: 'row_num',
      });

      expect(result.partitionBy).toHaveLength(1);
      expect(result.partitionBy![0]).toMatchObject({
        type: 'field',
        name: 'department',
      });

      expect(result.orderBy).toHaveLength(1);
      expect(result.orderBy![0]).toMatchObject({
        field: { type: 'field', name: 'salary' },
        direction: 'desc',
      });
    });

    it('should build a rank window function with multiple partition fields', () => {
      const config = {
        function: 'rank' as WindowFunction,
        alias: 'rank_val',
        partitionBy: ['department', 'location'],
        orderBy: [
          { field: 'performance_score', direction: 'desc' as const },
          { field: 'tenure_years', direction: 'desc' as const },
        ],
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'rank',
        alias: 'rank_val',
      });

      expect(result.partitionBy).toHaveLength(2);
      expect(result.orderBy).toHaveLength(2);
    });

    it('should build a lag window function with offset and default value', () => {
      const config = {
        function: 'lag' as WindowFunction,
        field: 'revenue',
        alias: 'prev_month_revenue',
        partitionBy: ['product_id'],
        orderBy: [{ field: 'month', direction: 'asc' as const }],
        offset: 1,
        defaultValue: 0,
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'lag',
        alias: 'prev_month_revenue',
        offset: 1,
      });

      expect(result.field).toMatchObject({
        type: 'field',
        name: 'revenue',
      });

      expect(result.defaultValue).toMatchObject({
        type: 'literal',
        value: 0,
        data_type: 'number',
      });
    });

    it('should build a lead window function', () => {
      const config = {
        function: 'lead' as WindowFunction,
        field: 'sales',
        alias: 'next_day_sales',
        orderBy: [{ field: 'date', direction: 'asc' as const }],
        offset: 1,
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'lead',
        alias: 'next_day_sales',
        offset: 1,
      });
    });

    it('should build aggregate window functions (sum, avg, count)', () => {
      const sumConfig = {
        function: 'sum' as WindowFunction,
        field: 'amount',
        alias: 'running_total',
        orderBy: [{ field: 'date', direction: 'asc' as const }],
        frame: {
          unit: 'rows' as const,
          start: 'unbounded_preceding' as const,
          end: 'current_row' as const,
        },
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(sumConfig);

      expect(result).toMatchObject({
        type: 'window',
        function: 'sum',
        alias: 'running_total',
      });

      expect(result.field).toMatchObject({
        type: 'field',
        name: 'amount',
      });

      expect(result.frame).toEqual({
        unit: 'rows',
        start: 'unbounded_preceding',
        end: 'current_row',
      });
    });

    it('should build first_value window function', () => {
      const config = {
        function: 'first_value' as WindowFunction,
        field: 'price',
        alias: 'first_price',
        partitionBy: ['product_category'],
        orderBy: [{ field: 'created_at', direction: 'asc' as const }],
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'first_value',
        alias: 'first_price',
      });
    });

    it('should build last_value window function', () => {
      const config = {
        function: 'last_value' as WindowFunction,
        field: 'status',
        alias: 'latest_status',
        partitionBy: ['customer_id'],
        orderBy: [{ field: 'updated_at', direction: 'desc' as const }],
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'last_value',
        alias: 'latest_status',
      });
    });

    it('should handle window function without partition by', () => {
      const config = {
        function: 'row_number' as WindowFunction,
        alias: 'global_row_num',
        orderBy: [{ field: 'created_at', direction: 'asc' as const }],
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result.partitionBy).toBeUndefined();
      expect(result.orderBy).toBeDefined();
    });

    it('should handle window function with frame specification', () => {
      const config = {
        function: 'avg' as WindowFunction,
        field: 'temperature',
        alias: 'moving_avg_3days',
        orderBy: [{ field: 'date', direction: 'asc' as const }],
        frame: {
          unit: 'rows' as const,
          start: { type: 'preceding' as const, offset: 2 },
          end: 'current_row' as const,
        },
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result.frame).toEqual({
        unit: 'rows',
        start: { type: 'preceding', offset: 2 },
        end: 'current_row',
      });
    });

    it('should build dense_rank window function', () => {
      const config = {
        function: 'dense_rank' as WindowFunction,
        alias: 'dense_rank_val',
        partitionBy: ['team'],
        orderBy: [{ field: 'score', direction: 'desc' as const }],
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'dense_rank',
        alias: 'dense_rank_val',
      });
    });

    it('should build percent_rank window function', () => {
      const config = {
        function: 'percent_rank' as WindowFunction,
        alias: 'percentile',
        partitionBy: ['class'],
        orderBy: [{ field: 'exam_score', direction: 'desc' as const }],
      };

      // @ts-expect-error - testing private method
      const result: WindowNode = builder.buildWindow(config);

      expect(result).toMatchObject({
        type: 'window',
        function: 'percent_rank',
        alias: 'percentile',
      });
    });
  });
});
