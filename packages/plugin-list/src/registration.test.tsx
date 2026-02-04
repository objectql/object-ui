import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';
import { ListView } from './index';

describe('Plugin List Registration', () => {
  it('exports ListView component', () => {
    expect(ListView).toBeDefined();
  });
});
