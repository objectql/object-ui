/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { createLazyPlugin, preloadPlugin } from '../LazyPluginLoader';

describe('createLazyPlugin', () => {
  it('should create a lazy-loaded component', async () => {
    const TestComponent = () => <div>Test Component</div>;
    
    const LazyComponent = createLazyPlugin(
      () => Promise.resolve({ default: TestComponent })
    );
    
    render(<LazyComponent />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });
  });

  it('should show custom fallback while loading', async () => {
    const TestComponent = () => <div>Test Component</div>;
    
    const LazyComponent = createLazyPlugin(
      () => new Promise<{ default: React.ComponentType }>((resolve) => {
        setTimeout(() => resolve({ default: TestComponent }), 100);
      }),
      { fallback: <div>Loading...</div> }
    );
    
    render(<LazyComponent />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });
  });

  it('should pass props to the lazy component', async () => {
    interface TestProps {
      message: string;
    }
    
    const TestComponent = ({ message }: TestProps) => <div>{message}</div>;
    
    const LazyComponent = createLazyPlugin<TestProps>(
      () => Promise.resolve({ default: TestComponent })
    );
    
    render(<LazyComponent message="Hello World" />);
    
    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
  });

  it('should handle loading errors gracefully', async () => {
    // Mock console.error to avoid noise in test output
    const originalError = console.error;
    console.error = vi.fn();

    const LazyComponent = createLazyPlugin<any>(
      () => Promise.reject(new Error('Load error'))
    );
    
    expect(() => render(<LazyComponent />)).not.toThrow();
    
    // Restore console.error
    console.error = originalError;
  });

  it('should preload a plugin without rendering', async () => {
    const TestComponent = () => <div>Preloaded</div>;
    const importFn = vi.fn(() => Promise.resolve({ default: TestComponent }));

    const result = await preloadPlugin(importFn);

    expect(importFn).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ default: TestComponent });
  });

  it('should render errorFallback when component fails to load', async () => {
    const originalError = console.error;
    console.error = vi.fn();

    const ErrorFallback = ({ error, retry }: { error: Error; retry: () => void }) => (
      <div>
        <span>Error: {error.message}</span>
        <button onClick={retry}>Retry</button>
      </div>
    );

    const LazyComponent = createLazyPlugin(
      () => Promise.reject(new Error('chunk failed')),
      { retries: 0, errorFallback: ErrorFallback }
    );

    render(<LazyComponent />);

    await waitFor(() => {
      expect(screen.getByText('Error: chunk failed')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    console.error = originalError;
  });

  it('should not retry when retries=0', async () => {
    const originalError = console.error;
    console.error = vi.fn();

    const importFn = vi.fn(() => Promise.reject(new Error('fail')));

    const ErrorFallback = ({ error }: { error: Error; retry: () => void }) => (
      <div>Error: {error.message}</div>
    );

    const LazyComponent = createLazyPlugin(importFn, {
      retries: 0,
      errorFallback: ErrorFallback,
    });

    render(<LazyComponent />);

    await waitFor(() => {
      expect(screen.getByText('Error: fail')).toBeInTheDocument();
    });

    // Called only once — no retries
    expect(importFn).toHaveBeenCalledTimes(1);

    console.error = originalError;
  });

  it('should retry on failure then succeed', async () => {
    const originalError = console.error;
    console.error = vi.fn();

    const TestComponent = () => <div>Success after retry</div>;

    let callCount = 0;
    const importFn = vi.fn(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.reject(new Error('transient error'));
      }
      return Promise.resolve({ default: TestComponent as React.ComponentType });
    });

    const LazyComponent = createLazyPlugin(importFn, {
      retries: 3,
      retryDelay: 10,
    });

    render(<LazyComponent />);

    await waitFor(() => {
      expect(screen.getByText('Success after retry')).toBeInTheDocument();
    }, { timeout: 5000 });

    // First call + 2 retries (fails) + 1 success = called 3 times
    expect(importFn).toHaveBeenCalledTimes(3);

    console.error = originalError;
  });
});
