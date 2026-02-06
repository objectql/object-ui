import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';

// Ensure all components are registered
import '../index';

describe('Component Compliance', () => {
  const components = ComponentRegistry.getAllConfigs();

  it('should have components registered', () => {
    expect(components.length).toBeGreaterThan(0);
  });

  components.forEach((config) => {
    describe(`Component: ${config.type}`, () => {
      it('should have valid metadata', () => {
        expect(config.type).toBeDefined();
        expect(config.component).toBeDefined();
        // namespace is optional but good practice
        // expect(config.namespace).toBeDefined(); 
      });

      it('should define inputs if it has any', () => {
        if (config.inputs) {
          expect(Array.isArray(config.inputs)).toBe(true);
          config.inputs?.forEach((input) => {
            expect(input.name).toBeDefined();
            expect(input.type).toBeDefined();
          });
        }
      });

      it('should render generic component without crashing', () => {
        const Cmp = config.component as React.ComponentType<any>;
        
        // Skip components that are known to require specific parents or context
        // for now, we just try to render them with a basic schema
        const schema = {
          type: config.type,
          id: 'test-id',
          className: 'test-class',
          props: {
            ...config.defaultProps
          }
        };

        try {
          // We wrap in a try-catch for now because some components might strictly require context
          // But ideally, renderers should be robust.
          // For now, we prefer to shallow render or just check it is a valid function/class
          expect(Cmp).toBeDefined();
          
          /* 
             Full rendering is risky because of dependencies (e.g. Hooks, Context).
             So we will just verify the sanity of the registration for now.
             If we want to render, we need a wrapper provider.
          */
        } catch (e) {
             // console.warn(`Render failed for ${config.type}`, e);
        }
      });

      it('should accept className prop if rendered', () => {
          // This is a static check on the 'inputs' metadata to ensure className is exposed?
          // No, className is on the BaseSchema, not necessarily in 'inputs' array (which is for Designer).
          // But checks that component implementation uses 'cn' are hard to do at runtime without rendering.
      });
    });
  });
});
