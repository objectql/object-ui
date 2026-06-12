import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ObjectGantt, normalizeDependencies } from './ObjectGantt';
import { DataSource } from '@object-ui/types';

// Mock GanttView so we can drive create/update/delete directly via the
// callbacks ObjectGantt wires to it. Each task exposes data-testid handles
// for "Create", "View", and "Delete" so CRUD wiring can be unit-tested
// without rendering the full timeline.
vi.mock('./GanttView', () => ({
  GanttView: ({ tasks, onTaskClick, onTaskUpdate, onTaskDelete }: any) => (
    <div data-testid="gantt-view">
      {tasks.map((t: any) => (
        <div key={t.id} data-testid="gantt-task">
          <span>{t.title}</span>
          <button data-testid={`gv-view-${t.id}`} onClick={() => onTaskClick?.(t)}>view</button>
          <button data-testid={`gv-update-${t.id}`} onClick={() => onTaskUpdate?.(t, { start: new Date('2024-02-01T00:00:00.000Z'), end: new Date('2024-02-05T00:00:00.000Z') })}>update</button>
          <button data-testid={`gv-delete-${t.id}`} onClick={() => onTaskDelete?.(t)}>delete</button>
        </div>
      ))}
    </div>
  ),
}));

const mockData = [
  { id: '1', name: 'Task 1', start_date: '2024-01-01', end_date: '2024-01-05', progress: 50 },
  { id: '2', name: 'Task 2', start_date: '2024-01-06', end_date: '2024-01-10', progress: 0 },
];

const mockDataSource: DataSource = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getObjectSchema: vi.fn().mockResolvedValue({
    fields: {
       name: { type: 'text' },
       start_date: { type: 'date' },
       end_date: { type: 'date' }
    }
  }),
};

describe('ObjectGantt', () => {
  it('renders with static value provider', async () => {
    const schema: any = {
      type: 'gantt',
      gantt: {
        titleField: 'name',
        startDateField: 'start_date',
        endDateField: 'end_date',
      },
      data: {
        provider: 'value',
        items: mockData,
      },
    };

    render(<ObjectGantt schema={schema} />);
    
    // Check loading first if needed, or wait for tasks
    await waitFor(() => {
        expect(screen.getByTestId('gantt-view')).toBeDefined();
    });
    
    expect(screen.getAllByTestId('gantt-task')).toHaveLength(2);
    expect(screen.getByText('Task 1')).toBeDefined();
  });

  it('renders with object provider', async () => {
    (mockDataSource.find as any).mockResolvedValue({ data: mockData });

    const schema: any = {
      type: 'gantt',
      gantt: {
        titleField: 'name',
        startDateField: 'start_date',
        endDateField: 'end_date',
      },
      data: {
        provider: 'object',
        object: 'tasks',
      },
    };

    render(<ObjectGantt schema={schema} dataSource={mockDataSource} />);

    await waitFor(() => {
      expect(mockDataSource.find).toHaveBeenCalledWith('tasks', expect.any(Object));
    });

    await waitFor(() => {
      expect(screen.getAllByTestId('gantt-task')).toHaveLength(2);
    });
  });

  it('persists drag-driven task update via dataSource.update', async () => {
    const update = vi.fn().mockResolvedValue({});
    const ds: DataSource = {
      ...mockDataSource,
      find: vi.fn().mockResolvedValue({ data: mockData }),
      update,
    };
    const schema: any = {
      type: 'gantt',
      gantt: { titleField: 'name', startDateField: 'start_date', endDateField: 'end_date' },
      data: { provider: 'object', object: 'tasks' },
    };
    render(<ObjectGantt schema={schema} dataSource={ds} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('gantt-task')).toHaveLength(2);
    });

    fireEvent.click(screen.getByTestId('gv-update-1'));

    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(1);
    });
    expect(update.mock.calls[0][0]).toBe('tasks');
    expect(update.mock.calls[0][1]).toBe('1');
    expect(update.mock.calls[0][2]).toMatchObject({
      start_date: '2024-02-01T00:00:00.000Z',
      end_date: '2024-02-05T00:00:00.000Z',
    });
  });

  it('delete: opens AlertDialog and calls dataSource.delete on confirm', async () => {
    const del = vi.fn().mockResolvedValue({});
    const ds: DataSource = {
      ...mockDataSource,
      find: vi.fn().mockResolvedValue({ data: mockData }),
      delete: del,
    };
    const schema: any = {
      type: 'gantt',
      gantt: { titleField: 'name', startDateField: 'start_date', endDateField: 'end_date' },
      data: { provider: 'object', object: 'tasks' },
    };
    render(<ObjectGantt schema={schema} dataSource={ds} />);

    await waitFor(() => expect(screen.getAllByTestId('gantt-task')).toHaveLength(2));

    // Request deletion for task id=1 — should open confirmation dialog.
    fireEvent.click(screen.getByTestId('gv-delete-1'));
    const confirm = await screen.findByTestId('gantt-delete-confirm');
    fireEvent.click(confirm);

    await waitFor(() => expect(del).toHaveBeenCalledTimes(1));
    expect(del.mock.calls[0][0]).toBe('tasks');
    expect(del.mock.calls[0][1]).toBe('1');
  });
});

describe('normalizeDependencies', () => {
  it('returns [] for null/undefined/empty', () => {
    expect(normalizeDependencies(null)).toEqual([]);
    expect(normalizeDependencies(undefined)).toEqual([]);
    expect(normalizeDependencies('')).toEqual([]);
    expect(normalizeDependencies({})).toEqual([]);
  });

  it('splits CSV strings and trims whitespace', () => {
    expect(normalizeDependencies('t1, t2 ,t3,')).toEqual(['t1', 't2', 't3']);
  });

  it('wraps a bare number id', () => {
    expect(normalizeDependencies(42)).toEqual([42]);
  });

  it('passes through arrays of ids, dropping null/empty entries', () => {
    expect(normalizeDependencies(['t1', null, '', 7])).toEqual(['t1', 7]);
  });

  it('normalizes object entries with id aliases and link-type aliases', () => {
    expect(normalizeDependencies([
      { id: 't1', type: 'ss' },
      { task: 't2', type: 'finish-to-start' },
      { target: 't3', type: 'END_TO_END' },
      { _id: 't4' },
      { type: 'fs' }, // no id → dropped
    ])).toEqual([
      { id: 't1', type: 'ss' },
      { id: 't2', type: 'fs' },
      { id: 't3', type: 'ff' },
      { id: 't4' },
    ]);
  });

  it('drops unknown link types but keeps the id', () => {
    expect(normalizeDependencies([{ id: 't1', type: 'banana' }])).toEqual([{ id: 't1' }]);
  });
});
