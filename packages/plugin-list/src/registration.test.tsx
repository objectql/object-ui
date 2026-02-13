import { describe, it, expect } from 'vitest';
import { ListView } from './index';

describe('Plugin List Registration', () => {
  it('exports ListView component', () => {
    expect(ListView).toBeDefined();
  });
});
