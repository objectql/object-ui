/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Performance benchmark suite for @object-ui/core.
 *
 * Part of Q1 2026 roadmap §1.4 Test Coverage Improvement.
 *
 * Run with: npx vitest bench packages/core/src/__benchmarks__/
 */

import { bench, describe } from 'vitest';
import { ExpressionEvaluator } from '@object-ui/core';
import { ComponentRegistry } from '@object-ui/core';
import { contrastRatio, meetsContrastLevel, hexToHSL } from '@object-ui/core';

describe('ExpressionEvaluator performance', () => {
  const evaluator = new ExpressionEvaluator({ data: { name: 'Alice', age: 30, active: true } });

  bench('evaluate simple string', () => {
    evaluator.evaluate('Hello ${data.name}');
  });

  bench('evaluate 100 expressions', () => {
    for (let i = 0; i < 100; i++) {
      evaluator.evaluate('Hello ${data.name}');
    }
  });
});

describe('ComponentRegistry performance', () => {
  bench('get registered component', () => {
    ComponentRegistry.get('button');
  });

  bench('has check', () => {
    ComponentRegistry.has('button');
  });
});

describe('Theme utilities performance', () => {
  bench('hexToHSL conversion', () => {
    hexToHSL('#336699');
  });

  bench('contrastRatio calculation', () => {
    contrastRatio('#000000', '#ffffff');
  });

  bench('meetsContrastLevel check', () => {
    meetsContrastLevel('#000000', '#ffffff', 'AA');
  });

  bench('100 contrast checks', () => {
    for (let i = 0; i < 100; i++) {
      meetsContrastLevel('#336699', '#ffffff', 'AA');
    }
  });
});
