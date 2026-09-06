/**
 * Pins the drawer width a gantt gets when it declares no `navigation`.
 *
 * ObjectGantt used to hard-code `{ mode: 'drawer', width: 'min(960px, 60vw)' }`
 * as that default. `width` is `@deprecated [#2578 -> size]` and
 * `resolveOverlayWidth` gives an explicit `width` priority OVER `size`, so
 * spelling it kept the deprecated branch load-bearing on the path most gantts
 * take. The default is now `{ mode: 'drawer' }`: `resolveOverlayWidth` returns
 * `undefined` and RecordDetailDrawer's own `width` default supplies the
 * identical CSS — a zero-pixel change.
 *
 * That equivalence was previously pinned by NOTHING: a repo-wide search for
 * `min(960px, 60vw)` returned only producers, zero assertions, and the whole
 * 402-test gantt suite stayed green when the value was changed. Both halves
 * below are load-bearing and fail for different reasons:
 *
 *   half 1 — the gantt must stop injecting a width of its own (it has to hand
 *            `undefined` down, or the drawer's default can never apply);
 *   half 2 — the width the REAL drawer then resolves must still be that value.
 *            Without this half the gantt would follow a moved drawer default
 *            invisibly, which is the regression the indirection introduces.
 *
 * Both assert the resolved width VALUE — never a `className`, never "it
 * renders", either of which passes in both worlds.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObjectGantt } from './ObjectGantt';

/** The width the gantt's drawer has always resolved to. Must not drift. */
const EXPECTED_WIDTH = 'min(960px, 60vw)';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('./GanttView', () => ({
  GanttView: ({ tasks, onTaskClick }: any) => (
    <div data-testid="gantt-view">
      {tasks.map((t: any) => (
        <button key={t.id} data-testid={`gv-view-${t.id}`} onClick={() => onTaskClick?.(t)}>
          {t.title}
        </button>
      ))}
    </div>
  ),
}));

// Record the props ObjectGantt hands down, then delegate to the REAL drawer so
// half 2 measures the actual resolution rather than a stub's idea of it.
let drawerProps: any = null;
vi.mock('@object-ui/plugin-detail', async (importOriginal) => {
  const actual = await importOriginal<any>();
  const Real = actual.RecordDetailDrawer;
  return {
    ...actual,
    RecordDetailDrawer: (props: any) => {
      drawerProps = props;
      return <Real {...props} />;
    },
  };
});

function makeSchema(): any {
  return {
    type: 'gantt',
    objectName: 'tasks',
    gantt: { titleField: 'name', startDateField: 'start_date', endDateField: 'end_date' },
    data: {
      provider: 'value',
      items: [{ id: '1', name: 'Row', start_date: '2024-01-01', end_date: '2024-01-05' }],
    },
  };
}

async function openDrawer() {
  render(<ObjectGantt schema={makeSchema()} />);
  await waitFor(() => expect(screen.getByTestId('gv-view-1')).toBeDefined());
  fireEvent.click(screen.getByTestId('gv-view-1'));
  await waitFor(() => expect(drawerProps).not.toBeNull());
}

/* ─────────────────────────────────────────────────────────────────────────────
 * objectui#7307 — this file's `/api/v1/security/explain` escape, served here.
 *
 * Nothing below asks for a security verdict, yet every run opened a REAL TCP
 * connection to `http://localhost:3000`. Traced with a stack probe on the
 * network-escape guard's attribution point (measured, not inferred):
 *
 *   RecordDetailDrawer (the drawer this file opens)
 *     -> DetailView            packages/plugin-detail/src/DetailView.tsx:290,296
 *       -> useRecordEditable   packages/plugin-detail/src/useRecordEditable.ts:76
 *         -> `const doFetch = apiFetch ?? fetch`      <- the escape
 *           POST /api/v1/security/explain  (twice per open: edit, then delete)
 *
 * The hook reads the host's AUTHENTICATED `apiFetch` off
 * `SchemaRendererContext` and, with no host supplying one, degrades to the
 * GLOBAL `fetch` by design — a standalone embed must keep rendering rather than
 * crash. Under happy-dom that global is a real HTTP client and the document URL
 * defaults to `http://localhost:3000`, so the relative path resolved to a live
 * request. The read is best-effort (a network or parse failure leaves the
 * record editable — fail open), which is why the cases below stayed green while
 * the request always failed.
 *
 * Answered from a RECORDING double — the shape objectui#5225 settled on, carried
 * by `packages/plugin-report/src/__tests__/DatasetReportRenderer.test.tsx` and
 * by this batch's sibling
 * `packages/plugin-calendar/src/ObjectCalendar.navWidthDefault.test.tsx`.
 * Deliberately NOT a blanket network stub: it records every URL it is handed
 * and `afterEach` fails on any URL that is not the explain route, so an escape
 * to somewhere else reds here instead of vanishing into that `catch`.
 *
 * What it answers, and why that changes no assertion here: the permissive
 * verdict, in the two response shapes the two explain hooks read —
 * `{ record: { visible } }` for a single `recordId`, and
 * `{ records: [{ recordId, visible }] }` for a batched `recordIds`. Only the
 * FIRST is reached from this file (every call measured above comes from
 * `useRecordEditable`); the batched branch is kept so this router stays
 * byte-identical to its siblings rather than forking per file.
 * `useRecordEditable` initialises `allowed` to `true` and its failure path
 * leaves it there, so `true` and the absent verdict the failing request
 * produced are the same value at every read site. The drawer's width —
 * everything this file asserts — is not derived from the verdict at all.
 * ─────────────────────────────────────────────────────────────────────────── */

const EXPLAIN_ROUTE = '/api/v1/security/explain';

/** Every URL this render handed the global `fetch`, in request order. */
let explainCalls: string[] = [];

/** Serve `POST /api/v1/security/explain` permissively; record everything. */
function installExplainDouble() {
  explainCalls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init?: unknown) => {
      const url = String(
        input && typeof input === 'object' && 'url' in input ? (input as { url: unknown }).url : input,
      );
      explainCalls.push(url);
      if (url !== EXPLAIN_ROUTE) return { ok: false, status: 404, json: async () => ({}) };
      let body: { recordId?: unknown; recordIds?: unknown } = {};
      try {
        body = JSON.parse(String((init as { body?: unknown } | undefined)?.body ?? '{}'));
      } catch {
        /* a non-JSON body is not a request this route can answer */
      }
      const recordIds = Array.isArray(body.recordIds) ? body.recordIds : null;
      return {
        ok: true,
        status: 200,
        json: async () =>
          recordIds
            ? { records: recordIds.map((recordId) => ({ recordId, visible: true })) }
            : { record: { visible: true } },
      };
    }),
  );
}

describe('gantt drawer width with no declared `navigation`', () => {
  beforeEach(() => {
    drawerProps = null;
    // Cross-test leakage guard: the drawer prefers a drag-resized width
    // persisted in localStorage over its prop, which would mask half 2.
    try { window.localStorage.clear(); } catch { /* ignore */ }
    installExplainDouble();
  });
  afterEach(() => {
  // The double is a router, not a sink: an escape to any OTHER endpoint fails
  // here instead of vanishing into the hook's best-effort `catch`.
  expect(explainCalls.filter((url) => url !== EXPLAIN_ROUTE)).toEqual([]);
  // Unmount BEFORE restoring the real `fetch`. Vitest runs `afterEach` hooks in
  // reverse registration order, so this file's teardown runs before the root
  // setup's RTL cleanup: unstubbing first would leave the tree mounted with the
  // real global back in place, and a verdict effect settling in that window
  // escapes again (objectui#7439).
  cleanup();
  vi.unstubAllGlobals();
  });

  it('half 1: the gantt injects no width of its own (so the drawer default applies)', async () => {
    await openDrawer();
    expect(drawerProps.width).toBeUndefined();
  });

  it('half 2: the width the real drawer resolves is still the pinned value', async () => {
    await openDrawer();
    // The drawer applies the resolved width as an inline style on its panel,
    // as BOTH `width` and `max-width`. happy-dom's CSS parser drops the
    // `width` longhand when the value is a `min()` expression but keeps
    // `max-width`, so the surviving declaration is what we read — it is the
    // same resolved string, not a proxy for it.
    const panel = document.querySelector('[role="dialog"]') as HTMLElement | null;
    expect(panel, 'drawer panel').not.toBeNull();
    expect(panel!.style.maxWidth).toBe(EXPECTED_WIDTH);
  });
});
