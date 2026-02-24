/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebugPanel } from '../DebugPanel';

describe('DebugPanel', () => {
  it('should render nothing when open is false', () => {
    const { container } = render(
      <DebugPanel open={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render the panel when open is true', () => {
    render(<DebugPanel open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('debug-panel')).toBeInTheDocument();
    expect(screen.getByText('🛠 Debug Panel')).toBeInTheDocument();
  });

  it('should render built-in tabs', () => {
    render(<DebugPanel open={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('debug-tab-schema')).toBeInTheDocument();
    expect(screen.getByTestId('debug-tab-data')).toBeInTheDocument();
    expect(screen.getByTestId('debug-tab-registry')).toBeInTheDocument();
    expect(screen.getByTestId('debug-tab-flags')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<DebugPanel open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('debug-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should switch tabs on click', () => {
    render(
      <DebugPanel
        open={true}
        onClose={vi.fn()}
        schema={{ type: 'text', content: 'Hello' }}
        dataContext={{ name: 'Test' }}
      />,
    );
    // Default tab is Schema
    expect(screen.getByTestId('debug-tab-schema')).toHaveAttribute('aria-selected', 'true');

    // Click Data tab
    fireEvent.click(screen.getByTestId('debug-tab-data'));
    expect(screen.getByTestId('debug-tab-data')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('debug-tab-schema')).toHaveAttribute('aria-selected', 'false');
  });

  it('should display schema JSON in Schema tab', () => {
    const testSchema = { type: 'button', content: 'Click' };
    render(<DebugPanel open={true} onClose={vi.fn()} schema={testSchema} />);
    const content = screen.getByTestId('debug-panel-content');
    expect(content.textContent).toContain('"type": "button"');
  });

  it('should display data JSON in Data tab', () => {
    render(
      <DebugPanel
        open={true}
        onClose={vi.fn()}
        dataContext={{ user: 'Alice' }}
      />,
    );
    fireEvent.click(screen.getByTestId('debug-tab-data'));
    const content = screen.getByTestId('debug-panel-content');
    expect(content.textContent).toContain('"user": "Alice"');
  });

  it('should display debug flags in Flags tab', () => {
    render(
      <DebugPanel
        open={true}
        onClose={vi.fn()}
        flags={{ enabled: true, schema: true }}
      />,
    );
    fireEvent.click(screen.getByTestId('debug-tab-flags'));
    const content = screen.getByTestId('debug-panel-content');
    expect(content.textContent).toContain('"enabled": true');
    expect(content.textContent).toContain('"schema": true');
  });

  it('should render extra tabs from plugins', () => {
    const extraTab = {
      id: 'custom',
      label: 'Custom',
      render: () => <div data-testid="custom-content">Custom Content</div>,
    };
    render(<DebugPanel open={true} onClose={vi.fn()} extraTabs={[extraTab]} />);
    expect(screen.getByTestId('debug-tab-custom')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('debug-tab-custom'));
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<DebugPanel open={true} onClose={vi.fn()} />);
    const panel = screen.getByTestId('debug-panel');
    expect(panel).toHaveAttribute('role', 'dialog');
    expect(panel).toHaveAttribute('aria-label', 'Developer Debug Panel');
  });
});
