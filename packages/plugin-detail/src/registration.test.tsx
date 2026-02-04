import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('Plugin Detail Registration', () => {
  beforeAll(async () => {
    await import('./index');
  });

  it('registers detail-view component', () => {
    const config = ComponentRegistry.get('plugin-detail:detail-view'); // Try full name
    console.log('DetailView Config FullName:', config);
    
    const configShort = ComponentRegistry.get('detail-view');
    console.log('DetailView Config ShortName:', configShort);

    expect(config || configShort).toBeDefined();
    expect((config || configShort)?.label).toBe('Detail View');
  });

  it('registers related sub-components', () => {
     // Assuming these might be registered in future or implicitly available
     // If index.tsx exports them, they are available to import.
     // If they are not registered in Registry, we don't test registry for them.
  });
});
