import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutomationRunHistory } from '../AutomationRunHistory';
import type { AutomationRun } from '../AutomationRunHistory';

describe('AutomationRunHistory', () => {
  it('should render empty state', () => {
    render(<AutomationRunHistory />);

    expect(screen.getByText('Automation Run History')).toBeInTheDocument();
    expect(screen.getByText('No automation runs yet')).toBeInTheDocument();
  });

  it('should render runs', () => {
    const runs: AutomationRun[] = [
      {
        id: 'run-1',
        automationId: 'auto-1',
        automationName: 'Email on Lead Create',
        status: 'success',
        startedAt: '2024-06-01T10:00:00Z',
        completedAt: '2024-06-01T10:00:05Z',
        triggerEvent: 'Lead created: Acme Corp',
      },
      {
        id: 'run-2',
        automationId: 'auto-1',
        automationName: 'Email on Lead Create',
        status: 'failure',
        startedAt: '2024-06-01T11:00:00Z',
        completedAt: '2024-06-01T11:00:02Z',
        triggerEvent: 'Lead created: Broken Inc',
        error: 'SMTP connection failed',
      },
    ];

    render(<AutomationRunHistory runs={runs} />);

    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('SMTP connection failed')).toBeInTheDocument();
    expect(screen.getAllByText('Email on Lead Create')).toHaveLength(2);
  });

  it('should show run count badge', () => {
    const runs: AutomationRun[] = [
      {
        id: 'run-1',
        automationId: 'auto-1',
        automationName: 'Test',
        status: 'running',
        startedAt: '2024-06-01T10:00:00Z',
      },
    ];

    render(<AutomationRunHistory runs={runs} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });
});
