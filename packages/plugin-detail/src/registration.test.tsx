import { describe, it, expect, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('Plugin Detail Registration', () => {
  beforeAll(async () => {
    await import('./index');
  }, 15000); // Increase timeout to 15 seconds for async import

  it('registers detail-view component', () => {
    // We must use getConfig to retrieve the metadata (label, category, etc.)
    // .get() only returns the React Component.
    const config = ComponentRegistry.getConfig('detail-view');
    
    expect(config).toBeDefined();
    expect(config?.label).toBe('Detail View');
    expect(config?.category).toBe('Views');
  });
});
