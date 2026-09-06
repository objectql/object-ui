/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Pins the drawer width a kanban gets when it declares no `navigation`
 * (objectui#6303 — the sibling of `ObjectGantt.navWidthDefault.test.tsx`).
 *
 * `ObjectKanban` used to spell `min(960px, 60vw)` in TWO places: the `navConfig`
 * default (`{ mode: 'drawer', width: 'min(960px, 60vw)' }`) and, further down, a
 * render-site `width={(navigation.width as any) ?? 'min(960px, 60vw)'}`. The
 * second is why taking only the first would have changed nothing — the old
 * width survived by a different route.
 *
 * `width` is `@deprecated [#2578 -> size]` and `resolveOverlayWidth` gives an
 * explicit `width` priority OVER `size`, so spelling it kept the deprecated
 * branch load-bearing on the path most boards take. The default is now
 * `{ mode: 'drawer' }` with no render-site fallback: `resolveOverlayWidth`
 * returns `undefined` and RecordDetailDrawer's own `width` default supplies the
 * identical CSS — a zero-pixel change.
 *
 * Both halves below are load-bearing and fail for different reasons:
 *
 *   half 1 — the kanban must stop injecting a width of its own (it has to hand
 *            `undefined` down, or the drawer's default can never apply). This
 *            half is what catches a re-added `??` fallback at the render site,
 *            which half 2 alone cannot see: the fallback's value is the same
 *            string the drawer default produces;
 *   half 2 — the width the REAL drawer then resolves must still be that value.
 *            Without this half the kanban would follow a moved drawer default
 *            invisibly, which is the regression the indirection introduces.
 *
 * A third case pins the other direction: an AUTHORED `navigation.width` still
 * wins. What #6303 removed is the renderer spelling the deprecated key as its
 * own default — not the key's acceptance as an authored value.
 *
 * All three assert the resolved width VALUE — never a `className`, never "it
 * renders", either of which passes in both worlds.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { ObjectKanbanSchema } from '@object-ui/types';
import { ObjectKanban } from './ObjectKanban';

// Pay the board's lazy chunk at import time, not inside a `findBy` budget
// (AGENTS.md 测试纪律) — every assertion below sits after the Suspense
// boundary, and a card has to be on screen before it can be clicked. The
// specifier must stay byte-identical to the one in `./index`, which is what
// makes the component's own lazy factory resolve immediately.
import './KanbanImpl';

/** The width the kanban's drawer has always resolved to. Must not drift. */
const EXPECTED_WIDTH = 'min(960px, 60vw)';

// Record the props ObjectKanban hands down, then delegate to the REAL drawer so
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

const cards = [{ id: '1', title: 'On the board', status: 'todo' }];

async function openDrawer(navigation?: Record<string, unknown>) {
  render(
    <ObjectKanban
      schema={{
        type: 'object-kanban',
        objectName: 'contacts',
        groupBy: 'status',
        columns: [{ id: 'todo', title: 'To Do' }],
        data: cards,
        ...(navigation ? { navigation } : {}),
      } satisfies ObjectKanbanSchema}
    />,
  );
  const card = await screen.findByText('On the board');
  fireEvent.click(card);
  await waitFor(() => expect(drawerProps).not.toBeNull());
  await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
}

/**
 * The drawer prefers a drag-resized width persisted in localStorage over its
 * prop, which would mask half 2 — and it is keyed by `objectName`, so a value
 * left by any earlier test in the file would be read back here.
 */
function readPanelWidth(): string {
  const panel = document.querySelector('[role="dialog"]') as HTMLElement | null;
  expect(panel, 'drawer panel').not.toBeNull();
  // The drawer applies the resolved width as an inline style on its panel, as
  // BOTH `width` and `max-width`. happy-dom's CSS parser drops the `width`
  // longhand when the value is a `min()` expression but keeps `max-width`, so
  // the surviving declaration is what we read — it is the same resolved
  // string, not a proxy for it.
  return panel!.style.maxWidth;
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

describe('kanban drawer width with no declared `navigation` (objectui#6303)', () => {
  beforeEach(() => {
    drawerProps = null;
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

  it('half 1: the kanban injects no width of its own (so the drawer default applies)', async () => {
    await openDrawer();
    expect(drawerProps.width).toBeUndefined();
  });

  it('half 2: the width the real drawer resolves is still the pinned value', async () => {
    await openDrawer();
    expect(readPanelWidth()).toBe(EXPECTED_WIDTH);
  });

  it('an authored `navigation.width` still reaches the drawer unchanged', async () => {
    await openDrawer({ mode: 'drawer', width: '720px' });
    expect(drawerProps.width).toBe('720px');
    expect(readPanelWidth()).toBe('720px');
  });
});
