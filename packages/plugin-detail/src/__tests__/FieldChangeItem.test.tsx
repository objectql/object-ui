/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FieldChangeItem } from '../FieldChangeItem';
import type { FieldChangeEntry } from '@object-ui/types';

describe('FieldChangeItem', () => {
  it('should render field label with old and new display values', () => {
    const change: FieldChangeEntry = {
      field: 'status',
      fieldLabel: 'Status',
      oldDisplayValue: 'Open',
      newDisplayValue: 'Closed',
    };
    render(<FieldChangeItem change={change} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
  });

  it('should derive field label from field name when fieldLabel is not set', () => {
    const change: FieldChangeEntry = {
      field: 'first_name',
      oldValue: 'John',
      newValue: 'Jane',
    };
    render(<FieldChangeItem change={change} />);
    expect(screen.getByText('First name')).toBeInTheDocument();
  });

  it('should use raw values when display values are not set', () => {
    const change: FieldChangeEntry = {
      field: 'priority',
      fieldLabel: 'Priority',
      oldValue: 'low',
      newValue: 'high',
    };
    render(<FieldChangeItem change={change} />);
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('should show (empty) when value is null/undefined', () => {
    const change: FieldChangeEntry = {
      field: 'notes',
      fieldLabel: 'Notes',
      newValue: 'Some text',
    };
    render(<FieldChangeItem change={change} />);
    expect(screen.getByText('(empty)')).toBeInTheDocument();
    expect(screen.getByText('Some text')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const change: FieldChangeEntry = {
      field: 'name',
      fieldLabel: 'Name',
      oldValue: 'A',
      newValue: 'B',
    };
    const { container } = render(<FieldChangeItem change={change} className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
