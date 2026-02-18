/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AutomationBuilder } from '../AutomationBuilder';
import type { AutomationDefinition } from '../AutomationBuilder';

describe('AutomationBuilder – multi-step actions', () => {
  it('adding multiple actions shows them numbered', () => {
    render(<AutomationBuilder />);

    // Add two actions
    fireEvent.click(screen.getByText('Add Action'));
    fireEvent.click(screen.getByText('Add Action'));

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });

  it('shows execution mode selector when 2+ actions exist', () => {
    const automation: AutomationDefinition = {
      id: 'multi',
      name: 'Multi Step',
      enabled: true,
      trigger: { type: 'record_created', objectName: 'Lead' },
      actions: [
        { type: 'send_email', params: { to: 'a@b.com' } },
        { type: 'update_field', params: { field: 'status', value: 'done' } },
      ],
      createdAt: '2024-01-01T00:00:00Z',
    };

    render(<AutomationBuilder automation={automation} />);

    // Execution mode label should be visible
    expect(screen.getByText('Execution')).toBeInTheDocument();
  });

  it('does not show execution mode selector with only 1 action', () => {
    const automation: AutomationDefinition = {
      id: 'single',
      name: 'Single Step',
      enabled: true,
      trigger: { type: 'record_created', objectName: 'Lead' },
      actions: [{ type: 'send_email', params: {} }],
      createdAt: '2024-01-01T00:00:00Z',
    };

    render(<AutomationBuilder automation={automation} />);

    expect(screen.queryByText('Execution')).not.toBeInTheDocument();
  });

  it('sequential mode shows "Step X" labels', () => {
    const automation: AutomationDefinition = {
      id: 'seq',
      name: 'Sequential',
      enabled: true,
      trigger: { type: 'record_created', objectName: 'Lead' },
      actions: [
        { type: 'send_email', params: {} },
        { type: 'update_field', params: {} },
      ],
      executionMode: 'sequential',
      createdAt: '2024-01-01T00:00:00Z',
    };

    render(<AutomationBuilder automation={automation} />);

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
  });

  it('renders conditionField, conditionOperator, conditionValue fields', () => {
    const automation: AutomationDefinition = {
      id: 'cond',
      name: 'Conditional',
      enabled: true,
      trigger: {
        type: 'record_updated',
        objectName: 'Deal',
        conditionField: 'status',
        conditionOperator: 'equals',
        conditionValue: 'urgent',
      },
      actions: [],
      createdAt: '2024-01-01T00:00:00Z',
    };

    render(<AutomationBuilder automation={automation} />);

    // The conditional trigger section should display the values
    expect(screen.getByText('Conditional Trigger (optional)')).toBeInTheDocument();

    // Check that the conditionValue input renders with the correct value
    const valueInput = screen.getByPlaceholderText('e.g. urgent');
    expect(valueInput).toBeInTheDocument();
    expect(valueInput).toHaveValue('urgent');
  });
});
