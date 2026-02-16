import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutomationBuilder } from '../AutomationBuilder';
import type { AutomationDefinition } from '../AutomationBuilder';

describe('AutomationBuilder', () => {
  it('should render with default state', () => {
    render(<AutomationBuilder />);

    expect(screen.getByText('Trigger')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Automation name')).toBeInTheDocument();
  });

  it('should render with provided automation', () => {
    const automation: AutomationDefinition = {
      id: 'auto-1',
      name: 'Test Automation',
      description: 'A test',
      enabled: true,
      trigger: { type: 'record_created', objectName: 'Lead' },
      actions: [{ type: 'send_email', params: { to: 'test@example.com' } }],
      createdAt: '2024-01-01T00:00:00Z',
    };

    render(<AutomationBuilder automation={automation} />);

    expect(screen.getByDisplayValue('Test Automation')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test')).toBeInTheDocument();
    expect(screen.getByText('Action 1')).toBeInTheDocument();
  });

  it('should add an action', () => {
    render(<AutomationBuilder />);

    fireEvent.click(screen.getByText('Add Action'));

    expect(screen.getByText('Action 1')).toBeInTheDocument();
  });

  it('should call onSave when save is clicked', () => {
    const onSave = vi.fn();
    render(<AutomationBuilder onSave={onSave} />);

    fireEvent.click(screen.getByText('Save Automation'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toHaveProperty('trigger');
    expect(onSave.mock.calls[0][0]).toHaveProperty('actions');
  });

  it('should call onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<AutomationBuilder onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should show schedule input for scheduled trigger', () => {
    const automation: AutomationDefinition = {
      id: 'auto-2',
      name: 'Scheduled',
      enabled: true,
      trigger: { type: 'scheduled', schedule: '0 9 * * 1-5' },
      actions: [],
      createdAt: '2024-01-01T00:00:00Z',
    };

    render(<AutomationBuilder automation={automation} />);

    expect(screen.getByPlaceholderText('e.g. 0 9 * * 1-5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0 9 * * 1-5')).toBeInTheDocument();
  });
});
