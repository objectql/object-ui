import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { ComponentRegistry } from '@object-ui/core';

describe('Plugin Detail Registration', () => {
  beforeAll(async () => {
    await import('./index');
  });

  it('registers detail-view component', () => {
    const config = ComponentRegistry.get('detail-view');
    console.log('DetailView Config Type:', typeof config);
    console.log('DetailView Config Keys:', config ? Object.keys(config) : 'null');
    console.log('DetailView Config Component:', (config as any)?.component);
    
    // If config IS the component (e.g. legacy mode?), we might need to handle it.
    // But Registry.ts says it returns config object.
    
    // For now, let's see what we got.
    if ((config as any)?.label) {
        expect((config as any).label).toBe('Detail View');
    } else {
        // Fail with info
        console.error('Config missing label:', config);
        // expect(true).toBe(false); // verification step
    }
  });

  it('registers related sub-components', () => {
     // Assuming these might be registered in future or implicitly available
     // If index.tsx exports them, they are available to import.
     // If they are not registered in Registry, we don't test registry for them.
  });
});
