/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SpecBridge to ObjectGrid — a spec-authored view's declared export formats
 * reach the menu (objectui#4585).
 *
 * This is the card's repro, end to end and in one process: build a spec
 * `ListView` that declares `exportOptions: ['csv', 'xlsx']`, route it through
 * `SpecBridge`, render the resulting node. Before the fix the bridge copied the
 * bare array to the node verbatim, ObjectGrid read `exportOptions.formats` off
 * an array (`undefined`) and fell back to its `['csv', 'json']` default — so the
 * menu offered CSV and JSON: the declared xlsx never appeared and an undeclared
 * json did, silently. The bridge now applies the spec's own parse-time lift
 * (objectstack#8010), so the declared set is what the renderer sees.
 *
 * The two levels are pinned separately on purpose: the bridge's output shape in
 * `@object-ui/react`'s `ListViewExportOptionsLift.test.ts`, and the rendered
 * consequence here. The old bridge pin was green precisely because it asserted
 * a shape it never rendered — this file is the half that could not have been.
 *
 * It lives in plugin-grid because the dependency direction decides:
 * `@object-ui/plugin-grid` depends on `@object-ui/react`, so it can see both
 * `SpecBridge` and `ObjectGrid`; react cannot import the grid without inverting
 * the graph. `ObjectGrid` itself is untouched read-only context here — the
 * server-stream gate below is landed behavior (objectui#2942 / #4535), reused,
 * not modified.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider, SpecBridge } from '@object-ui/react';

registerAllFields();

beforeAll(() => {
  // jsdom has no object-URL plumbing; the download path calls these.
  if (!URL.createObjectURL) (URL as any).createObjectURL = () => 'blob:export';
  if (!URL.revokeObjectURL) (URL as any).revokeObjectURL = () => {};
});

/**
 * `withStream: true` reproduces a server-backed grid — `exportDownload` present
 * — which is the only configuration in which xlsx is deliverable. Without it
 * the client fallback path supports csv and json alone, and a declared xlsx is
 * dropped from the menu by ObjectGrid's own gate.
 */
function makeDataSource(withStream: boolean) {
  const ds: Record<string, unknown> = {
    find: vi.fn(async () => ({ data: [], total: 0, hasMore: false, pageSize: 50 })),
    getObjectSchema: async (name: string) => ({
      name,
      fields: { id: { type: 'text' }, name: { type: 'text' } },
    }),
  };
  if (withStream) {
    ds.exportDownload = vi.fn().mockResolvedValue(new Blob(['ID,Name\n'], { type: 'text/csv' }));
  }
  return ds as any;
}

/** Author a spec ListView, bridge it, render the node the bridge produced. */
function renderBridgedView(exportOptions: unknown, withStream: boolean) {
  const node = new SpecBridge().transformListView({
    name: 'tasks_all',
    label: 'All Tasks',
    columns: [{ field: 'name', label: 'Name' }],
    exportOptions,
  });

  // `objectName` is the host's binding, not the view's — the bridge maps the
  // ListView's own keys. Everything else is the bridge's output, untouched.
  return render(
    <ActionProvider>
      <ObjectGrid schema={{ ...node, objectName: 'task' } as any} dataSource={makeDataSource(withStream)} />
    </ActionProvider>,
  );
}

/** Opens the export popover; the trigger is the only `/^export$/i` button. */
async function openExportMenu() {
  fireEvent.click(await screen.findByRole('button', { name: /^export$/i }));
}

describe('SpecBridge to ObjectGrid — declared export formats (#4585)', () => {
  it('offers the formats a legacy bare array declared, not the renderer default', async () => {
    // The card's repro. Server stream available, so the declared xlsx is
    // deliverable and must appear; json was never declared and must not.
    renderBridgedView(['csv', 'xlsx'], true);
    await openExportMenu();

    expect(await screen.findByRole('button', { name: /export as csv/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /export as xlsx/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export as json/i })).not.toBeInTheDocument();
  });

  it('still lets the server-stream gate drop a declared xlsx when there is no stream', async () => {
    // Same declaration, client fallback only: the gate — landed behavior, not
    // this change — keeps csv and drops xlsx. The lift decides what is
    // DECLARED; the gate decides what is DELIVERABLE. Both halves must hold, or
    // "declared formats now reach the menu" would just mean "the menu stopped
    // filtering".
    renderBridgedView(['csv', 'xlsx'], false);
    await openExportMenu();

    expect(await screen.findByRole('button', { name: /export as csv/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export as xlsx/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export as json/i })).not.toBeInTheDocument();
  });

  it('hides the export button entirely when the view declares an empty array', async () => {
    // `[]` lifts to `{ formats: [] }` verbatim (the spec's transform wraps, it
    // does not default), and ObjectGrid reads that literally: no format is
    // offered, so `exportableFormats.length > 0` fails and the toolbar button
    // is gone. Before the fix the bare `[]` was truthy but unreadable, so the
    // button showed and offered the `['csv', 'json']` default — an export menu
    // built entirely out of formats the view never declared.
    renderBridgedView([], true);

    expect(await screen.findByText('All Tasks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^export$/i })).not.toBeInTheDocument();
  });

  it('leaves a view with no exportOptions without an export button', async () => {
    // Unchanged by this card, pinned so the lift cannot start inventing a
    // declaration where the view made none.
    renderBridgedView(undefined, true);

    expect(await screen.findByText('All Tasks')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^export$/i })).not.toBeInTheDocument();
  });

  it('renders the object form the same way — one shape reaches the menu', async () => {
    // The object spelling was already correct and passes through by reference;
    // this pins that both spellings land on the same rendered menu, which is
    // what "the bridge emits one shape" has to mean downstream.
    renderBridgedView({ formats: ['csv', 'xlsx'] }, true);
    await openExportMenu();

    expect(await screen.findByRole('button', { name: /export as csv/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /export as xlsx/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /export as json/i })).not.toBeInTheDocument();
  });
});
