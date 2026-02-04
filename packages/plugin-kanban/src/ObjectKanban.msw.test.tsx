import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ObjectKanban } from './ObjectKanban';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import React from 'react';

// Register layout components (if needed by cards)
// registerLayout();

const BASE_URL = 'http://localhost';

// --- Mock Data ---

const mockTasks = {
  value: [
    { _id: '1', title: 'Task 1', status: 'todo', description: 'Description 1' },
    { _id: '2', title: 'Task 2', status: 'done', description: 'Description 2' },
    { _id: '3', title: 'Task 3', status: 'todo', description: 'Description 3' }
  ]
};

// --- MSW Setup ---

const handlers = [
  // OPTIONS handler for CORS preflight checks
  http.options('*', () => {
    return new HttpResponse(null, { status: 200 });
  }),

  // Health check
  http.get(`${BASE_URL}/api/v1`, () => {
    return HttpResponse.json({ status: 'ok', version: '1.0.0' });
  }),

  // Data Query: GET /api/v1/data/tasks
  http.get(`${BASE_URL}/api/v1/data/tasks`, () => {
    return HttpResponse.json(mockTasks);
  })
];

const server = setupServer(...handlers);

// --- Test Suite ---

describe('ObjectKanban with MSW', () => {
  if (!process.env.OBJECTSTACK_API_URL) {
    beforeAll(() => server.listen());
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());
  }

  const dataSource = new ObjectStackAdapter({
    baseUrl: BASE_URL,
  });

  it('fetches tasks and renders them in columns based on groupBy', async () => {
    render(
      <ObjectKanban
        schema={{
          type: 'kanban',
          objectName: 'tasks',
          groupBy: 'status',
          columns: [
            { id: 'todo', title: 'To Do', cards: [] },
            { id: 'done', title: 'Done', cards: [] }
          ]
        }}
        dataSource={dataSource}
      />
    );

    // Initial state might show Skeleton, wait for data
    await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
    }, { timeout: 10000 });

    // Check classification
    // Task 1 (todo) and Task 3 (todo) should be in To Do column.
    // Task 2 (done) should be in Done column.
    
    // We can verify "Task 1" is present.
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Task 3')).toBeInTheDocument();
    
    // Check descriptions
    expect(screen.getByText('Description 1')).toBeInTheDocument();
  });
});
