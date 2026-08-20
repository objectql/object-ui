/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#5378 item 1 — `detail-view` resolves its adapter the way its siblings
 * do, and the getting-started guide's own `detail-view` snippet is RENDERED here.
 *
 * ## The split this closes
 *
 * `object-grid` and `object-form` are registered through wrappers that read the
 * adapter from `SchemaRendererContext`. `detail-view` was registered as the RAW
 * `DetailView`, which reads a React `dataSource` PROP. `SchemaRenderer` itself
 * reads only context, so the two wirings were mutually exclusive and a page
 * could satisfy exactly one of them. Measured on `origin/main`, keys held
 * correct in every cell:
 *
 * | wiring                                  | `object-grid` | `detail-view` |
 * |-----------------------------------------|---------------|---------------|
 * | `SchemaRendererProvider dataSource={…}`  | `find` 1      | `findOne` 0   |
 * | `SchemaRenderer dataSource={…}` (prop)   | `find` 0      | `findOne` 1   |
 *
 * Neither cell reported anything. The whole page could therefore be wired
 * "correctly" and still render half of itself as an empty shell.
 *
 * ## What is pinned below
 *
 * The maintainer ruling of 2026-08-20 made the wrapper ADDITIVE — the
 * `dataSource`-prop form stays accepted, no prop is removed — so all three
 * wirings are asserted: context alone (the new one), prop alone (the one that
 * must not break), and both at once, where the explicit prop wins because it is
 * the more specific signal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Module-scope side-effect imports: the registry must hold `detail-view` and the
// field widgets it renders into before the first render (AGENTS.md §测试纪律).
import '@object-ui/components';
import '@object-ui/fields';
import '../index';

const GUIDE = path.resolve(__dirname, '../../../../content/docs/guide/building-crud-app.md');

const TASK_SCHEMA = {
  name: 'task',
  label: 'Task',
  fields: {
    title: { name: 'title', type: 'text', label: 'Title' },
    status: { name: 'status', type: 'text', label: 'Status' },
  },
};

const RECORD = { id: '42', title: 'Write the guide', status: 'Todo' };

/** See the twin helper in `plugin-grid`'s probe — same rule, same reason. */
function guideSchemas(key: string): any[] {
  const src = fs.readFileSync(GUIDE, 'utf8');
  const needle = `type: '${key}'`;
  const out: any[] = [];
  for (let at = src.indexOf(needle); at !== -1; at = src.indexOf(needle, at + 1)) {
    const start = src.lastIndexOf('{', at);
    let depth = 0;
    let end = start;
    for (; end < src.length; end++) {
      if (src[end] === '{') depth++;
      else if (src[end] === '}' && --depth === 0) break;
    }
    out.push(
      new Function(
        'TaskSchema', 'editId', 'taskId', 'activeView', 'searchQuery',
        `return (${src.slice(start, end + 1)});`,
      )(TASK_SCHEMA, '42', '42', 'all', ''),
    );
  }
  return out;
}

function makeAdapter() {
  return {
    find: vi.fn().mockResolvedValue({ data: [RECORD], total: 1 }),
    findOne: vi.fn().mockResolvedValue(RECORD),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue(TASK_SCHEMA),
  };
}

const DETAIL_SNIPPETS = guideSchemas('detail-view');
const SNIPPET = DETAIL_SNIPPETS[0];

beforeEach(() => cleanup());

describe('guide/building-crud-app.md — the `detail-view` snippet actually renders', () => {
  it('publishes exactly one detail snippet', () => {
    expect(DETAIL_SNIPPETS).toHaveLength(1);
  });

  it('loads the record under the PROVIDER wiring — the convergence', async () => {
    // This is the cell that was `findOne` 0 before the wrapper existed.
    const adapter = makeAdapter();
    const { container } = render(
      <SchemaRendererProvider dataSource={adapter as any}>
        <SchemaRenderer schema={SNIPPET} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => expect(adapter.findOne).toHaveBeenCalledTimes(1));
    expect(adapter.findOne.mock.calls[0].slice(0, 2)).toEqual(['task', '42']);
    await waitFor(() => expect(container.textContent).toContain('Write the guide'));
  });

  it('still loads it under the PROP wiring — the ruling kept that form accepted', async () => {
    const adapter = makeAdapter();
    const { container } = render(<SchemaRenderer schema={SNIPPET} dataSource={adapter as any} />);

    await waitFor(() => expect(adapter.findOne).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.textContent).toContain('Write the guide'));
  });

  it('lets the explicit prop win when both are present', async () => {
    const ambient = makeAdapter();
    const explicit = makeAdapter();
    render(
      <SchemaRendererProvider dataSource={ambient as any}>
        <SchemaRenderer schema={SNIPPET} dataSource={explicit as any} />
      </SchemaRendererProvider>,
    );

    await waitFor(() => expect(explicit.findOne).toHaveBeenCalledTimes(1));
    expect(ambient.findOne).not.toHaveBeenCalled();
  });

  it('sources the record id from `resourceId` — `recordId` loads nothing here', async () => {
    // objectui#5377's correction, pinned so it cannot be lost again: the
    // `recordId` → `resourceId` rename is right ONLY for this block.
    // `object-form` genuinely reads `recordId`, and a blanket rename across the
    // guide's five snippets would have broken the form instead.
    const asItWas = { ...SNIPPET, recordId: SNIPPET.resourceId };
    delete asItWas.resourceId;

    const adapter = makeAdapter();
    render(
      <SchemaRendererProvider dataSource={adapter as any}>
        <SchemaRenderer schema={asItWas} />
      </SchemaRendererProvider>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(adapter.findOne).not.toHaveBeenCalled();
  });

  it('names the object with `objectName` — `object` loads nothing', async () => {
    const asItWas = { ...SNIPPET, object: SNIPPET.objectName };
    delete asItWas.objectName;

    const adapter = makeAdapter();
    render(
      <SchemaRendererProvider dataSource={adapter as any}>
        <SchemaRenderer schema={asItWas} />
      </SchemaRendererProvider>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(adapter.findOne).not.toHaveBeenCalled();
  });

  it('carries no `data` — on this block `data` MEANS "already loaded, do not fetch"', async () => {
    // Why the guide's `data: { objectSchema: TaskSchema }` had to go from this
    // snippet and not merely be re-spelled: `DetailView` returns early on any
    // `schema.data`, so the object's METADATA was being installed as the record
    // and `findOne` never ran. Inert on `object-grid`, load-bearing here — which
    // is why each snippet was judged on its own rather than swept.
    expect(SNIPPET.data).toBeUndefined();

    const adapter = makeAdapter();
    render(
      <SchemaRendererProvider dataSource={adapter as any}>
        <SchemaRenderer schema={{ ...SNIPPET, data: { objectSchema: TASK_SCHEMA } }} />
      </SchemaRendererProvider>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(adapter.findOne).not.toHaveBeenCalled();
  });
});

describe('detail-view — a block that resolves no adapter says so (objectui#5378 item 2)', () => {
  it('reports "No data source resolved" instead of rendering nothing at all', async () => {
    const { findByTestId } = render(<SchemaRenderer schema={SNIPPET} />);
    const panel = await findByTestId('detail-view-no-data-source');
    expect(panel).toHaveAttribute('role', 'alert');
    expect(panel.textContent).toContain('detail-view');
    expect(panel.textContent).toContain('task');
    expect(panel.textContent).toContain('SchemaRendererProvider');
  });

  it('stays silent for an inline record, which needs no adapter', async () => {
    const { queryByTestId, container } = render(
      <SchemaRenderer
        schema={{ type: 'detail-view', objectName: 'task', resourceId: '42', data: RECORD } as any}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain('Write the guide'));
    expect(queryByTestId('detail-view-no-data-source')).toBeNull();
  });

  it('stays silent for an `api`-sourced record, which fetches without an adapter', async () => {
    const { queryByTestId } = render(
      <SchemaRenderer
        schema={{ type: 'detail-view', objectName: 'task', resourceId: '42', api: '/api/task' } as any}
      />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId('detail-view-no-data-source')).toBeNull();
  });
});
