/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Integration DOM test for #2792: render the real KanbanRenderer (flat-data
 * adapter → lazy KanbanImpl) with an off-column record and assert the
 * "Uncategorized" lane and its card actually appear on screen — the outcome
 * the pure bucketing test can't observe (hook wiring + real render).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { KanbanRenderer } from './index';

const columns = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
];

describe('KanbanRenderer — uncategorized lane (#2792)', () => {
  it('renders an Uncategorized lane holding the off-column card', async () => {
    render(
      <KanbanRenderer
        schema={{
          type: 'kanban',
          groupBy: 'status',
          columns,
          data: [
            { id: '1', title: 'On the board', status: 'todo' },
            { id: '2', title: 'Orphaned card', status: 'done' }, // no 'done' column
          ],
        }}
      />,
    );

    // Lazy KanbanImpl resolves through Suspense.
    expect(await screen.findByText('Orphaned card')).toBeInTheDocument();
    expect(screen.getByText('On the board')).toBeInTheDocument();
    // The fallback lane header is present — the orphan is visible, not dropped.
    expect(screen.getByText('Uncategorized')).toBeInTheDocument();
  });

  it('renders no Uncategorized lane when every record matches a column', async () => {
    render(
      <KanbanRenderer
        schema={{
          type: 'kanban',
          groupBy: 'status',
          columns,
          data: [{ id: '1', title: 'Matches', status: 'in_progress' }],
        }}
      />,
    );

    expect(await screen.findByText('Matches')).toBeInTheDocument();
    expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument();
  });
});
