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
import { I18nProvider } from '@object-ui/react';
import { GanttView, type GanttTask, type GanttMarker, type GanttViewMode } from '../src/GanttView';
import { ResourceWorkload } from '../src/ResourceWorkload';
import { ObjectGantt } from '../src/ObjectGantt';
import type { WorkingCalendar } from '../src/scheduling';

/**
 * Simplified Chinese pack for the Gantt chrome. Nested to match i18next's
 * default '.' key separator (so `t('gantt.column.taskName')` resolves). The
 * plugin's own English defaults cover the `en` path, so we only ship `zh` here.
 * With ?lang=zh the WHOLE chart localizes — chrome via these keys, dates via
 * `dateLocale` (driven by the provider language, not the browser locale).
 */
const GANTT_ZH = {
  gantt: {
    column: { taskName: '任务名称', start: '开始', end: '结束' },
    toolbar: {
      prevPeriod: '上一时段', nextPeriod: '下一时段', zoomIn: '放大', zoomOut: '缩小',
      jumpToToday: '跳到今天', today: '今天', showTaskList: '显示任务列表', hideTaskList: '隐藏任务列表',
      viewMode: '时间粒度', enterFullscreen: '进入全屏', exitFullscreen: '退出全屏',
      criticalPath: '高亮关键路径', autoSchedule: '自动排程依赖', exportPng: '导出 PNG',
      exportPdf: '导出 PDF', saveLayout: '保存布局',
      thisWeek: '本周', thisMonth: '本月',
      undo: '撤销', redo: '重做',
    },
    viewMode: { day: '日', week: '周', month: '月', quarter: '季', year: '年' },
    row: { expand: '展开', collapse: '折叠' },
    aria: { taskList: '任务列表' },
    tooltip: { days: '天' },
    menu: {
      view: '查看详情', edit: '行内编辑', delete: '删除',
      addPredecessor: '添加紧前依赖…', addSuccessor: '添加紧后依赖…',
      removeDependency: '移除依赖', noCandidates: '没有可选任务',
    },
    linkType: {
      fs: '完成→开始 (FS)', ss: '开始→开始 (SS)',
      ff: '完成→完成 (FF)', sf: '开始→完成 (SF)',
    },
    conflict: {
      title: '排期冲突',
      body: '此次移动与依赖约束冲突，是否自动顺延受影响的 {count} 个任务？',
      confirm: '自动顺延',
      cancel: '取消保留',
    },
    resource: { header: '资源', peak: '峰值', over: '超载', empty: '没有可分配的任务。' },
    readOnly: '只读',
    readOnlyHint: '此视图已禁用编辑。',
  },
};

const d = (s: string) => new Date(`${s}T00:00:00`);

/** Build a URL preserving current params but overriding one key. */
function withParam(key: string, value: string): string {
  const p = new URLSearchParams(window.location.search);
  p.set(key, value);
  return `?${p.toString()}`;
}

function projectFixture(): GanttTask[] {
  return [
    { id: 'p1', title: 'Discovery', start: d('2026-06-01'), end: d('2026-06-12'), progress: 0, parent: null },
    { id: 't1', title: 'Requirements', start: d('2026-06-01'), end: d('2026-06-09'), progress: 100, parent: 'p1', color: '#0ea5e9', baselineStart: d('2026-06-01'), baselineEnd: d('2026-06-06') },
    { id: 't2', title: 'Stakeholder interviews', start: d('2026-06-04'), end: d('2026-06-11'), progress: 80, parent: 'p1', color: '#0ea5e9', dependencies: [{ id: 't1', type: 'ss' }] },
    { id: 'm1', title: 'Spec sign-off', start: d('2026-06-12'), end: d('2026-06-12'), progress: 0, parent: 'p1', type: 'milestone', dependencies: ['t2'] },

    { id: 'p2', title: 'Build', start: d('2026-06-12'), end: d('2026-07-22'), progress: 0, parent: null },
    { id: 't3', title: 'API design', start: d('2026-06-12'), end: d('2026-06-19'), progress: 60, parent: 'p2', color: '#8b5cf6', dependencies: ['m1'] },
    { id: 't4', title: 'Backend services', start: d('2026-06-18'), end: d('2026-07-08'), progress: 30, parent: 'p2', color: '#8b5cf6', dependencies: [{ id: 't3', type: 'fs' }], baselineStart: d('2026-06-16'), baselineEnd: d('2026-07-02'), fields: [{ label: 'Owner', value: 'Priya N.' }, { label: 'Status', value: 'In Progress' }, { label: 'Effort', value: '15 days' }] },
    { id: 't5', title: 'Frontend app', start: d('2026-06-22'), end: d('2026-07-15'), progress: 15, parent: 'p2', color: '#8b5cf6', dependencies: ['t3'], baselineStart: d('2026-06-22'), baselineEnd: d('2026-07-10') },
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

/**
 * 制造排班 4 层树 (?mfg=1) — mirrors 3.4.1 树状结构 (左侧任务列表区):
 *   一级 项目      → type:'group'  无条 (pure header, expand/collapse)
 *   二级 产品      → type:'group'  无条
 *   三级 排产计划   → summary (has children) 有时间条 · 全部甘特图操作
 *   四级 派工单     → task leaf     子任务条 (查看/跳转)
 * The two `group` levels render NO timeline bar; only 排产计划 + 派工单 carry bars.
 */
function manufacturingFixture(): GanttTask[] {
  const PLAN = '#0d9488'; // 排产计划 bar color
  const WORK = '#5eead4'; // 派工单 child color
  return [
    // 一级: 项目 (无条)
    { id: 'prj-A', title: '项目A（导管架制造）', start: d('2026-06-01'), end: d('2026-06-30'), progress: 0, parent: null, type: 'group' },

    // 二级: 产品 (无条)
    { id: 'prod-A1', title: '产品A-1（XX项目导管架）', start: d('2026-06-01'), end: d('2026-06-30'), progress: 0, parent: 'prj-A', type: 'group' },

    // 三级: 排产计划 (有时间条) — children drive its rollup range
    { id: 'plan-1', title: '将军柱组焊（排产计划）', start: d('2026-06-03'), end: d('2026-06-10'), progress: 0, parent: 'prod-A1', color: PLAN },
    { id: 'wo-001', title: 'WO001 张三（派工单）', start: d('2026-06-03'), end: d('2026-06-06'), progress: 100, parent: 'plan-1', color: WORK },
    { id: 'wo-002', title: 'WO002 李四（派工单）', start: d('2026-06-06'), end: d('2026-06-10'), progress: 40, parent: 'plan-1', color: WORK, dependencies: [{ id: 'wo-001', type: 'fs' }] },

    { id: 'plan-2', title: '主腿管接长（排产计划）', start: d('2026-06-08'), end: d('2026-06-14'), progress: 0, parent: 'prod-A1', color: PLAN },
    { id: 'wo-003', title: 'WO003 王五（派工单）', start: d('2026-06-08'), end: d('2026-06-14'), progress: 20, parent: 'plan-2', color: WORK },

    // 二级: 第二个产品 (无条)
    { id: 'prod-A2', title: '产品A-2（YY项目导管架）', start: d('2026-06-12'), end: d('2026-06-30'), progress: 0, parent: 'prj-A', type: 'group' },
    { id: 'plan-3', title: '分段预制（排产计划）', start: d('2026-06-12'), end: d('2026-06-20'), progress: 0, parent: 'prod-A2', color: PLAN },
    { id: 'wo-004', title: 'WO004 赵六（派工单）', start: d('2026-06-12'), end: d('2026-06-20'), progress: 10, parent: 'plan-3', color: WORK },
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

// Round-robin owner/status so ?group=owner|status has something to bucket by.
const OWNERS = ['Priya N.', 'Sam K.', 'Lee W.'];
const STATUSES = ['Todo', 'In Progress', 'Done'];

/** Attach owner/status to leaf tasks so the Group-by demo has fields to group. */
function decorateForGrouping(tasks: GanttTask[]): GanttTask[] {
  let i = 0;
  return tasks.map((t) => ({
    ...t,
    data: { ...(t.data ?? {}), owner: OWNERS[i % OWNERS.length], status: STATUSES[i++ % STATUSES.length] },
  }));
}

/**
 * Quick-filter (快速筛选) demo (?quickfilter=1). Drives the real ObjectGantt with
 * an in-memory mock data source modeled on the 排产计划 (production-scheduling)
 * list: select dimensions (状态 / 派工类别) resolve options from the schema, and
 * lookup dimensions (项目 / 产品) pull their full option domain from referenced
 * objects. Selecting a filter narrows the bars AND the timeline auto-zooms to
 * the remaining interval (auto-zoom is free — GanttView re-derives the range).
 */
const PLAN_RECORDS = [
  { id: 'r1', name: '下料-01', start: '2026-06-01', end: '2026-06-04', status: 'todo', dispatch_type: '生产派工单', project: { id: 'pA', name: '项目A' }, product: { id: 'gX', name: '产品X' }, owner: '张三' },
  { id: 'r2', name: '焊接-02', start: '2026-06-05', end: '2026-06-10', status: 'doing', dispatch_type: '生产派工单', project: { id: 'pA', name: '项目A' }, product: { id: 'gX', name: '产品X' }, owner: '张三' },
  { id: 'r3', name: '质检-03', start: '2026-06-11', end: '2026-06-13', status: 'todo', dispatch_type: '质检派工单', project: { id: 'pA', name: '项目A' }, product: { id: 'gY', name: '产品Y' }, owner: '李四' },
  { id: 'r4', name: '装配-04', start: '2026-06-20', end: '2026-06-28', status: 'pushed', dispatch_type: '生产派工单', project: { id: 'pB', name: '项目B' }, product: { id: 'gY', name: '产品Y' }, owner: '王五' },
  { id: 'r5', name: '设备点检-05', start: '2026-07-01', end: '2026-07-03', status: 'doing', dispatch_type: '设备设施派工单', project: { id: 'pB', name: '项目B' }, product: { id: 'gX', name: '产品X' }, owner: '王五' },
  { id: 'r6', name: '返修-06', start: '2026-07-08', end: '2026-07-12', status: 'done', dispatch_type: '零星派工单', project: { id: 'pB', name: '项目B' }, product: { id: 'gY', name: '产品Y' }, owner: '李四' },
  { id: 'r7', name: '总装-07', start: '2026-07-15', end: '2026-07-25', status: 'todo', dispatch_type: '生产派工单', project: { id: 'pA', name: '项目A' }, product: { id: 'gX', name: '产品X' }, owner: '张三' },
  { id: 'r8', name: '终检-08', start: '2026-07-28', end: '2026-07-31', status: 'todo', dispatch_type: '质检派工单', project: { id: 'pB', name: '项目B' }, product: { id: 'gX', name: '产品X' }, owner: '李四' },
];

const PLAN_SCHEMA_FIELDS = {
  name: { type: 'text', label: '名称' },
  start: { type: 'date', label: '开始' },
  end: { type: 'date', label: '结束' },
  status: {
    type: 'select',
    label: '状态',
    options: [
      { value: 'todo', label: '待开始' },
      { value: 'pushed', label: '已下推' },
      { value: 'doing', label: '进行中' },
      { value: 'done', label: '已完成' },
    ],
  },
  dispatch_type: {
    type: 'select',
    label: '派工类别',
    options: [
      { value: '生产派工单', label: '生产派工单' },
      { value: '质检派工单', label: '质检派工单' },
      { value: '设备设施派工单', label: '设备设施派工单' },
      { value: '零星派工单', label: '零星派工单' },
    ],
  },
  project: { type: 'lookup', label: '项目', reference_to: 'project' },
  product: { type: 'lookup', label: '产品', reference_to: 'product' },
  owner: { type: 'text', label: '管理责任人' },
};

const REFERENCE_RECORDS: Record<string, Array<{ id: string; name: string }>> = {
  project: [
    { id: 'pA', name: '项目A' },
    { id: 'pB', name: '项目B' },
    { id: 'pC', name: '项目C（暂无任务）' },
  ],
  product: [
    { id: 'gX', name: '产品X' },
    { id: 'gY', name: '产品Y' },
    { id: 'gZ', name: '产品Z（暂无任务）' },
  ],
};

const planDataSource = {
  find: (resource: string) =>
    Promise.resolve({ data: REFERENCE_RECORDS[resource] ?? PLAN_RECORDS }),
  findOne: () => Promise.resolve(null),
  create: () => Promise.resolve({}),
  update: () => Promise.resolve({}),
  delete: () => Promise.resolve(undefined),
  getObjectSchema: () => Promise.resolve({ fields: PLAN_SCHEMA_FIELDS }),
} as any;

const planSchema = {
  type: 'gantt',
  objectName: 'production_plan',
  startDateField: 'start',
  endDateField: 'end',
  titleField: 'name',
  progressField: undefined,
  quickFilters: [
    { field: 'project', label: '项目' },
    { field: 'product', label: '产品' },
    { field: 'status', label: '状态' },
    { field: 'dispatch_type', label: '派工类别' },
    { field: 'owner', label: '管理责任人' },
  ],
  // autoZoomToFilter defaults to true → timeline rescales to the filtered span.
} as any;

function QuickFilterDemo() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        data-testid="demo-banner"
        style={{ padding: '6px 12px', fontSize: 12, borderBottom: '1px solid hsl(var(--border))', display: 'flex', gap: 16 }}
      >
        <strong>Gantt demo · 快速筛选</strong>
        <a href="?">project fixture</a>
        <a href="?quickfilter=1">quick filter</a>
      </div>
      <div style={{ flex: 1, minHeight: 0 }} data-testid="quickfilter-host">
        <ObjectGantt schema={planSchema} dataSource={planDataSource} />
      </div>
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('quickfilter') === '1') return <QuickFilterDemo />;
  const perf = Number(params.get('perf') || 0);
  const edge = params.has('edge');
  const mfg = params.has('mfg');
  const workingCalendar: WorkingCalendar | undefined =
    params.get('cal') === '1' ? { skipWeekends: true } : undefined;
  const showBaselines = params.get('baselines') !== '0';
  const readOnly = params.get('readonly') === '1';
  // ?mobilereadonly=1 — force read-only on narrow viewports (移动端只读缩略).
  const mobileReadOnly = params.get('mobilereadonly') === '1';
  // ?group=owner|status — dynamic Group by (动态 Group by). Buckets leaf tasks
  // under one synthesized summary row per distinct value.
  const groupField = params.get('group');
  const groupBy = React.useMemo(() => {
    if (groupField !== 'owner' && groupField !== 'status') return undefined;
    return (task: GanttTask) => {
      const v = (task.data ?? {})[groupField];
      if (v == null || v === '') return null;
      return { key: String(v), label: String(v) };
    };
  }, [groupField]);
  // ?resource=owner|status — Resource / Workload view (资源/工作负载视图). Swaps
  // the Gantt grid for a per-resource load histogram bucketed by the field.
  const resourceField = params.get('resource');
  const resourceMode = resourceField === 'owner' || resourceField === 'status';
  const assignee = React.useMemo(() => {
    const field = resourceMode ? (resourceField as string) : 'owner';
    return (task: GanttTask) => {
      const v = (task.data ?? {})[field];
      if (v == null || v === '') return null;
      return { key: String(v), label: String(v) };
    };
  }, [resourceMode, resourceField]);
  const t0 = React.useMemo(() => performance.now(), []);
  const [tasks, setTasks] = React.useState<GanttTask[]>(() => {
    const base = perf > 0 ? perfFixture(perf) : edge ? edgeFixture() : mfg ? manufacturingFixture() : projectFixture();
    return groupField || resourceMode ? decorateForGrouping(base) : base;
  });
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

  // Expose the live task array for browser verification scripts (working-day
  // boundary checks need the actual Date objects, not just bar geometry).
  React.useEffect(() => {
    (window as unknown as { __ganttTasks?: GanttTask[] }).__ganttTasks = tasks;
  }, [tasks]);

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
        <a href="?mfg=1&lang=zh&mode=day">制造排班 (4层树)</a>
        <a href="?cal=1">working calendar</a>
        <a href="?baselines=0">no baselines</a>
        <a href="?readonly=1">read-only</a>
        <a href="?perf=5000&mode=week">perf: 5000 tasks</a>
        <a href="?group=owner">group: owner</a>
        <a href="?group=status">group: status</a>
        <a href="?resource=owner">resource: owner</a>
        <a href="?resource=status">resource: status</a>
        <a href="?quickfilter=1">quick filter</a>
        <span style={{ marginLeft: 'auto' }}>
          {/* Language toggle: chrome + dates localize together. */}
          <a href={withParam('lang', 'en')}>English</a>
          {' · '}
          <a href={withParam('lang', 'zh')}>中文</a>
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {resourceMode ? (
          <ResourceWorkload
            tasks={tasks}
            assignee={assignee}
            viewMode={(params.get('mode') as GanttViewMode) || 'day'}
            unassignedLabel="未分配"
          />
        ) : (
        <GanttView
          tasks={tasks}
          // Only force the granularity when ?mode= is given; otherwise let a
          // persisted layout (保存布局) restore it on reload.
          viewMode={params.get('mode') ? (params.get('mode') as GanttViewMode) : undefined}
          markers={markers}
          autoSchedule
          rescheduleOnConflict
          criticalPathDefault={params.get('critical') === '1'}
          workingCalendar={workingCalendar}
          showBaselines={showBaselines}
          readOnly={readOnly}
          mobileReadOnly={mobileReadOnly}
          groupBy={groupBy}
          ungroupedLabel="未分组"
          persistLayoutKey="demo-project"
          onLayoutChange={(l) => console.log('[gantt-demo] layout saved', l)}
          inlineEdit
          onTaskClick={(t) => console.log('[gantt-demo] click', t.id)}
          onTaskUpdate={(t, changes) => patch(t.id, changes)}
          onTaskDelete={(t) => setTasks((prev) => prev.filter((x) => x.id !== t.id))}
          onDependencyCreate={(source, target, type) =>
            patch(target.id, {
              dependencies: [
                ...(target.dependencies ?? []).filter(
                  (d) => String(typeof d === 'object' ? d.id : d) !== String(source.id),
                ),
                { id: source.id, type },
              ],
            })
          }
          onDependencyDelete={(source, target) =>
            patch(target.id, {
              dependencies: (target.dependencies ?? []).filter(
                (d) => String(typeof d === 'object' ? d.id : d) !== String(source.id),
              ),
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
        )}
      </div>
    </div>
  );
}

// Drive the whole chart's language from ?lang (default English). The provider
// supplies the zh chrome bundle; GanttView's `dateLocale` then localizes the
// calendar/tooltips to the SAME language, so the demo is never half-translated.
const lang = new URLSearchParams(window.location.search).get('lang') === 'zh' ? 'zh' : 'en';
createRoot(document.getElementById('root')!).render(
  <I18nProvider config={{ defaultLanguage: lang, detectBrowserLanguage: false, resources: { zh: GANTT_ZH } }}>
    <App />
  </I18nProvider>
);
