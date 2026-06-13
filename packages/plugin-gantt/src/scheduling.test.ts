import { describe, it, expect } from 'vitest';
import { computeCriticalPath, computeProjectReschedule, type SchedulableTask } from './scheduling';

const d = (iso: string) => new Date(iso + 'T00:00:00.000Z');

// A → B → D is the long chain (4+3+5 = 12d); A → C → D is shorter (4+1+5).
// D depends on both B and C, so the critical path is A,B,D.
const diamond: SchedulableTask[] = [
  { id: 'A', start: d('2024-01-01'), end: d('2024-01-05') }, // 4d
  { id: 'B', start: d('2024-01-05'), end: d('2024-01-08'), dependencies: ['A'] }, // 3d
  { id: 'C', start: d('2024-01-05'), end: d('2024-01-06'), dependencies: ['A'] }, // 1d
  { id: 'D', start: d('2024-01-08'), end: d('2024-01-13'), dependencies: ['B', 'C'] }, // 5d
];

describe('computeCriticalPath', () => {
  it('finds the longest dependency chain as critical', () => {
    const { criticalIds, criticalEdges } = computeCriticalPath(diamond);
    expect([...criticalIds].sort()).toEqual(['A', 'B', 'D']);
    expect(criticalIds.has('C')).toBe(false);
    expect(criticalEdges.has('A->B')).toBe(true);
    expect(criticalEdges.has('B->D')).toBe(true);
    // The short leg A→C and C→D are not critical.
    expect(criticalEdges.has('A->C')).toBe(false);
    expect(criticalEdges.has('C->D')).toBe(false);
  });

  it('returns empty for an empty task list', () => {
    const { criticalIds, criticalEdges } = computeCriticalPath([]);
    expect(criticalIds.size).toBe(0);
    expect(criticalEdges.size).toBe(0);
  });

  it('bails (empty) on a dependency cycle', () => {
    const cyclic: SchedulableTask[] = [
      { id: 'X', start: d('2024-01-01'), end: d('2024-01-03'), dependencies: ['Y'] },
      { id: 'Y', start: d('2024-01-03'), end: d('2024-01-05'), dependencies: ['X'] },
    ];
    expect(computeCriticalPath(cyclic).criticalIds.size).toBe(0);
  });

  it('ignores dependencies on unknown ids', () => {
    const tasks: SchedulableTask[] = [
      { id: 'A', start: d('2024-01-01'), end: d('2024-01-05') },
      { id: 'B', start: d('2024-01-05'), end: d('2024-01-08'), dependencies: ['A', 'ghost'] },
    ];
    const { criticalIds } = computeCriticalPath(tasks);
    expect([...criticalIds].sort()).toEqual(['A', 'B']);
  });

  it('treats a single linear chain as fully critical', () => {
    const chain: SchedulableTask[] = [
      { id: 'A', start: d('2024-01-01'), end: d('2024-01-03') },
      { id: 'B', start: d('2024-01-03'), end: d('2024-01-05'), dependencies: ['A'] },
      { id: 'C', start: d('2024-01-05'), end: d('2024-01-07'), dependencies: ['B'] },
    ];
    expect([...computeCriticalPath(chain).criticalIds].sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('computeProjectReschedule', () => {
  it('pushes a successor that overlaps its predecessor (fs)', () => {
    // B starts before A finishes — should shift to A.end, keeping its 2d span.
    const tasks: SchedulableTask[] = [
      { id: 'A', start: d('2024-01-01'), end: d('2024-01-10') },
      { id: 'B', start: d('2024-01-05'), end: d('2024-01-07'), dependencies: ['A'] },
    ];
    const changes = computeProjectReschedule(tasks);
    expect(changes).toHaveLength(1);
    expect(changes[0].id).toBe('B');
    expect(changes[0].start.toISOString()).toBe(d('2024-01-10').toISOString());
    expect(changes[0].end.toISOString()).toBe(d('2024-01-12').toISOString()); // duration preserved (2d)
  });

  it('cascades a shift down a chain', () => {
    const tasks: SchedulableTask[] = [
      { id: 'A', start: d('2024-01-01'), end: d('2024-01-10') },
      { id: 'B', start: d('2024-01-05'), end: d('2024-01-08'), dependencies: ['A'] }, // 3d
      { id: 'C', start: d('2024-01-08'), end: d('2024-01-09'), dependencies: ['B'] }, // 1d
    ];
    const changes = computeProjectReschedule(tasks);
    const byId = Object.fromEntries(changes.map((c) => [c.id, c]));
    expect(byId.B.start.toISOString()).toBe(d('2024-01-10').toISOString());
    expect(byId.B.end.toISOString()).toBe(d('2024-01-13').toISOString());
    // C cascades after the shifted B (Jan 13) keeping its 1d span.
    expect(byId.C.start.toISOString()).toBe(d('2024-01-13').toISOString());
    expect(byId.C.end.toISOString()).toBe(d('2024-01-14').toISOString());
  });

  it('does not move tasks that already satisfy their constraints', () => {
    const tasks: SchedulableTask[] = [
      { id: 'A', start: d('2024-01-01'), end: d('2024-01-05') },
      { id: 'B', start: d('2024-01-06'), end: d('2024-01-08'), dependencies: ['A'] },
    ];
    expect(computeProjectReschedule(tasks)).toEqual([]);
  });

  it('never pulls a task earlier than its current start (顺延 only)', () => {
    // B already starts well after A ends — a gap is fine, leave it.
    const tasks: SchedulableTask[] = [
      { id: 'A', start: d('2024-01-01'), end: d('2024-01-05') },
      { id: 'B', start: d('2024-01-20'), end: d('2024-01-22'), dependencies: ['A'] },
    ];
    expect(computeProjectReschedule(tasks)).toEqual([]);
  });

  it('honors ss / ff link semantics', () => {
    const ss: SchedulableTask[] = [
      { id: 'A', start: d('2024-01-10'), end: d('2024-01-15') },
      { id: 'B', start: d('2024-01-05'), end: d('2024-01-08'), dependencies: [{ id: 'A', type: 'ss' }] },
    ];
    const out = computeProjectReschedule(ss);
    expect(out[0].start.toISOString()).toBe(d('2024-01-10').toISOString()); // start aligns to A.start
    expect(out[0].end.toISOString()).toBe(d('2024-01-13').toISOString()); // 3d preserved
  });

  it('does not move summary (parent) tasks', () => {
    const tasks: SchedulableTask[] = [
      { id: 'P', start: d('2024-01-01'), end: d('2024-01-20') }, // summary (parent of L)
      { id: 'A', start: d('2024-01-01'), end: d('2024-01-10') },
      { id: 'L', start: d('2024-01-02'), end: d('2024-01-04'), parent: 'P', dependencies: ['A'] },
    ];
    const changes = computeProjectReschedule(tasks);
    expect(changes.find((c) => c.id === 'P')).toBeUndefined(); // summary untouched
    expect(changes.find((c) => c.id === 'L')?.start.toISOString()).toBe(d('2024-01-10').toISOString());
  });

  it('returns [] on a cycle', () => {
    const cyclic: SchedulableTask[] = [
      { id: 'X', start: d('2024-01-01'), end: d('2024-01-03'), dependencies: ['Y'] },
      { id: 'Y', start: d('2024-01-03'), end: d('2024-01-05'), dependencies: ['X'] },
    ];
    expect(computeProjectReschedule(cyclic)).toEqual([]);
  });
});
