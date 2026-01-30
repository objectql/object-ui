/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { VirtualGrid } from './VirtualGrid';

describe('VirtualGrid', () => {
  it('should be exported', () => {
    expect(VirtualGrid).toBeDefined();
    expect(typeof VirtualGrid).toBe('function');
  });
  
  it('should have the correct display name', () => {
    // Verify it's a React component
    expect(VirtualGrid.name).toBe('VirtualGrid');
  });
});

