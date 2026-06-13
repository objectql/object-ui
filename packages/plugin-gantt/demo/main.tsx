/**
 * Manual-verification demo for @object-ui/plugin-gantt.
 *
 *   pnpm --dir packages/plugin-gantt exec vite demo --port 5199
 *
 * Default: a project fixture exercising hierarchy, milestones, all four link
 * types and custom markers. Add ?perf=5000 for the performance scenario
 * (N tasks in summary groups with dependency chains + render timing banner).
 * Add ?mode=week|month|quarter to start in another time scale (default: day).
 */
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import '@object-ui/components/style.css';
import { GanttView, type GanttTask, type GanttMarker, type GanttViewMode } from '../src/GanttView';

const d = (s: string) => new Date(`${s}T00:00:00`);

function projectFixture(): GanttTask[] {
  return [
    { id: 'p1', title: 'Discovery', start: d('2026-06-01'), end: d('2026-06-12'), progress: 0, parent: null },
    { id: 't1', title: 'Requirements', start: d('2026-06-01'), end: d('2026-06-09'), progress: 100, parent: 'p1', color: '#0ea5e9' },
    { id: 't2', title: 'Stakeholder interviews', start: d('2026-06-04'), end: d('2026-06-11'), progress: 80, parent: 'p1', color: '#0ea5e9', dependencies: [{ id: 't1', type: 'ss' }] },
    { id: 'm1', title: 'Spec sign-off', start: d('2026-06-12'), end: d('2026-06-12'), progress: 0, parent: 'p1', type: 'milestone', dependencies: ['t2'] },

    { id: 'p2', title: 'Build', start: d('2026-06-12'), end: d('2026-07-22'), progress: 0, parent: null },
    { id: 't3', title: 'API design', start: d('2026-06-12'), end: d('2026-06-19'), progress: 60, parent: 'p2', color: '#8b5cf6', dependencies: ['m1'] },
    { id: 't4', title: 'Backend services', start: d('2026-06-18'), end: d('2026-07-08'), progress: 30, parent: 'p2', color: '#8b5cf6', dependencies: [{ id: 't3', type: 'fs' }] },
    { id: 't5', title: 'Frontend app', start: d('2026-06-22'), end: d('2026-07-15'), progress: 15, parent: 'p2', color: '#8b5cf6', dependencies: ['t3'] },
    { id: 't6', title: 'Integration', start: d('2026-07-10'), end: d('2026-07-22'), progress: 0, parent: 'p2', color: '#8b5cf6', dependencies: ['t4', 't5'] },

    { id: 'p3', title: 'Launch', start: d('2026-07-01'), end: d('2026-08-07'), progress: 0, parent: null },
    { id: 't7', title: 'QA & hardening', start: d('2026-07-20'), end: d('2026-08-05'), progress: 0, parent: 'p3', color: '#f59e0b', dependencies: ['t6'] },
    { id: 't8', title: 'Documentation', start: d('2026-07-01'), end: d('2026-08-01'), progress: 10, parent: 'p3', color: '#f59e0b', dependencies: [{ id: 't7', type: 'sf' }] },
    { id: 'm2', title: 'Release', start: d('2026-08-07'), end: d('2026-08-07'), progress: 0, parent: 'p3', type: 'milestone', dependencies: [{ id: 't7', type: 'ff' }] },
  ];
}

/**
 * Geometry edge cases (?edge=1): backward links of every type, links into
 * summary rows and milestones, and tight adjacent-row hops — the shapes most
 * likely to expose anchor/elbow misalignment.
 */
function edgeFixture(): GanttTask[] {
  return [
    { id: 's1', title: 'Group A', start: d('2026-06-01'), end: d('2026-06-20'), progress: 0, parent: null },
    { id: 'a1', title: 'Early', start: d('2026-06-01'), end: d('2026-06-06'), progress: 50, parent: 's1' },
    { id: 'a2', title: 'Late fs←back', start: d('2026-06-10'), end: d('2026-06-16'), progress: 0, parent: 's1', dependencies: [{ id: 'a3', type: 'fs' }] },
    { id: 'a3', title: 'Mid', start: d('2026-06-04'), end: d('2026-06-08'), progress: 20, parent: 's1', dependencies: [{ id: 'a1', type: 'ss' }] },
    { id: 'a4', title: 'Backward ss', start: d('2026-06-02'), end: d('2026-06-07'), progress: 0, parent: 's1', dependencies: [{ id: 'a2', type: 'ss' }] },

    { id: 's2', title: 'Group B', start: d('2026-06-05'), end: d('2026-06-25'), progress: 0, parent: null },
    { id: 'b1', title: 'Backward ff', start: d('2026-06-05'), end: d('2026-06-09'), progress: 0, parent: 's2', dependencies: [{ id: 'a2', type: 'ff' }] },
    { id: 'b2', title: 'Backward sf', start: d('2026-06-18'), end: d('2026-06-25'), progress: 0, parent: 's2', dependencies: [{ id: 'b1', type: 'sf' }] },
    { id: 'm3', title: 'Gate', start: d('2026-06-12'), end: d('2026-06-12'), progress: 0, parent: 's2', type: 'milestone', dependencies: ['b1'] },
    { id: 'm4', title: 'Ship', start: d('2026-06-20'), end: d('2026-06-20'), progress: 0, parent: 's2', type: 'milestone', dependencies: [{ id: 'm3', type: 'fs' }] },

    // Links touching summary rows (rollup brackets) — y anchor must hit the bracket.
    { id: 's3', title: 'Group C (after A)', start: d('2026-06-21'), end: d('2026-06-28'), progress: 0, parent: null, dependencies: [{ id: 's1', type: 'fs' }] },
    { id: 'c1', title: 'Adjacent hop', start: d('2026-06-21'), end: d('2026-06-24'), progress: 0, parent: 's3' },
    { id: 'c2', title: 'Next row', start: d('2026-06-24'), end: d('2026-06-28'), progress: 0, parent: 's3', dependencies: ['c1'] },
  ];
}

function perfFixture(n: number): GanttTask[] {
  const tasks: GanttTask[] = [];
  const groupSize = 10;
  const base = d('2026-01-05').getTime();
  const DAY = 86_400_000;
  for (let i = 0; i < n; i++) {
    const group = Math.floor(i / groupSize);
    const inGroup = i % groupSize;
    if (inGroup === 0) {
      tasks.push({
        id: `g${group}`,
        title: `Workstream ${group + 1}`,
        start: new Date(base),
        end: new Date(base),
        progress: 0,
        parent: null,
      });
      continue;
    }
    const start = base + (group % 40) * 7 * DAY + inGroup * 2 * DAY;
    tasks.push({
      id: `task${i}`,
      title: `Task ${i}`,
      start: new Date(start),
      end: new Date(start + (3 + (i % 5)) * DAY),
      progress: (i * 13) % 101,
      parent: `g${group}`,
      color: ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981'][group % 4],
      dependencies: inGroup > 1 ? [`task${i - 1}`] : undefined,
    });
  }
  return tasks;
}

const markers: GanttMarker[] = [
  { date: d('2026-06-22'), label: 'Sprint 2' },
  { date: d('2026-07-25'), label: 'Code freeze', color: '#ef4444' },
];

function App() {
  const params = new URLSearchParams(window.location.search);
  const perf = Number(params.get('perf') || 0);
  const edge = params.has('edge');
  const t0 = React.useMemo(() => performance.now(), []);
  const [tasks, setTasks] = React.useState<GanttTask[]>(() =>
    perf > 0 ? perfFixture(perf) : edge ? edgeFixture() : projectFixture()
  );
  const [renderMs, setRenderMs] = React.useState<number | null>(null);
  React.useEffect(() => {
    const ms = performance.now() - t0;
    setRenderMs(ms);
    // eslint-disable-next-line no-console
    console.log(`[gantt-demo] initial render of ${tasks.length} tasks: ${ms.toFixed(1)}ms`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (id: GanttTask['id'], changes: Partial<GanttTask>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...changes } : t)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        data-testid="demo-banner"
        style={{ padding: '6px 12px', fontSize: 12, borderBottom: '1px solid hsl(var(--border))', display: 'flex', gap: 16 }}
      >
        <strong>Gantt demo</strong>
        <span>{tasks.length} tasks</span>
        {renderMs != null && <span data-testid="demo-render-ms">initial render: {renderMs.toFixed(1)}ms</span>}
        <a href="?">project fixture</a>
        <a href="?perf=5000&mode=week">perf: 5000 tasks</a>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <GanttView
          tasks={tasks}
          viewMode={(params.get('mode') as GanttViewMode) || 'day'}
          markers={markers}
          inlineEdit
          onTaskClick={(t) => console.log('[gantt-demo] click', t.id)}
          onTaskUpdate={(t, changes) => patch(t.id, changes)}
          onTaskDelete={(t) => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
          onDependencyCreate={(source, target, type) =>
            patch(target.id, {
              dependencies: [...(target.dependencies ?? []), { id: source.id, type }],
            })
          }
          onTaskReorder={(task, before) =>
            setTasks((prev) => {
              const next = prev.filter((t) => t.id !== task.id);
              next.splice(next.findIndex((t) => t.id === before.id), 0, task);
              return next;
            })
          }
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
