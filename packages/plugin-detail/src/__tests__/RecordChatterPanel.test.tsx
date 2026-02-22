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
import { RecordChatterPanel } from '../RecordChatterPanel';
import type { FeedItem } from '@object-ui/types';

const mockItems: FeedItem[] = [
  {
    id: '1',
    type: 'comment',
    actor: 'Alice',
    body: 'Hello from chatter',
    createdAt: '2026-02-20T10:00:00Z',
  },
  {
    id: '2',
    type: 'field_change',
    actor: 'Bob',
    createdAt: '2026-02-20T11:00:00Z',
    fieldChanges: [
      { field: 'priority', fieldLabel: 'Priority', oldValue: 'low', newValue: 'high' },
    ],
  },
];

describe('RecordChatterPanel', () => {
  describe('sidebar mode (right)', () => {
    it('should render Discussion header in sidebar mode', () => {
      render(
        <RecordChatterPanel config={{ position: 'right' }} items={mockItems} />,
      );
      expect(screen.getByText('Discussion')).toBeInTheDocument();
    });

    it('should render activity items', () => {
      render(
        <RecordChatterPanel config={{ position: 'right' }} items={mockItems} />,
      );
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Hello from chatter')).toBeInTheDocument();
    });

    it('should collapse when close button is clicked', () => {
      render(
        <RecordChatterPanel
          config={{ position: 'right', collapsible: true }}
          items={mockItems}
        />,
      );
      // Initially expanded (not defaultCollapsed)
      expect(screen.getByText('Discussion')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Close discussion panel'));
      // Now collapsed — show expand button
      expect(screen.getByLabelText('Open discussion panel')).toBeInTheDocument();
    });

    it('should start collapsed when defaultCollapsed is true', () => {
      render(
        <RecordChatterPanel
          config={{ position: 'right', collapsible: true, defaultCollapsed: true }}
          items={mockItems}
        />,
      );
      expect(screen.getByLabelText('Open discussion panel')).toBeInTheDocument();
      expect(screen.queryByText('Discussion')).not.toBeInTheDocument();
    });

    it('should expand from collapsed state', () => {
      render(
        <RecordChatterPanel
          config={{ position: 'right', collapsible: true, defaultCollapsed: true }}
          items={mockItems}
        />,
      );
      fireEvent.click(screen.getByLabelText('Open discussion panel'));
      expect(screen.getByText('Discussion')).toBeInTheDocument();
    });
  });

  describe('inline mode (bottom)', () => {
    it('should render timeline in inline mode', () => {
      render(
        <RecordChatterPanel
          config={{ position: 'bottom', collapsible: false }}
          items={mockItems}
        />,
      );
      expect(screen.getByText('Activity')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('should show/hide discussion toggle in inline collapsible mode', () => {
      render(
        <RecordChatterPanel
          config={{ position: 'bottom', collapsible: true, defaultCollapsed: true }}
          items={mockItems}
        />,
      );
      expect(screen.getByLabelText('Show discussion')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Show discussion'));
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  describe('default config', () => {
    it('should default to right position', () => {
      render(<RecordChatterPanel items={mockItems} />);
      expect(screen.getByText('Discussion')).toBeInTheDocument();
    });

    it('should pass feed config to embedded timeline', () => {
      render(
        <RecordChatterPanel
          config={{ feed: { showFilterToggle: false } }}
          items={mockItems}
        />,
      );
      expect(screen.queryByLabelText('Filter activity')).not.toBeInTheDocument();
    });
  });
});
