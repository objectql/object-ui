/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * objectui#5378 + objectui#5377 — the getting-started guide's own `object-grid`
 * snippets are RENDERED here, not read.
 *
 * `content/docs/guide/building-crud-app.md` is the first-run CRUD walkthrough,
 * and three independent axes each took it from "works" to "renders nothing":
 *
 *  1. **registration** — its `setup.ts` loaded `@object-ui/components` and
 *     `@object-ui/fields` only, so `object-grid` resolved to the registry's
 *     "Unknown component type" panel.
 *  2. **wiring** (#5378) — it passed `dataSource` as a PROP on `SchemaRenderer`,
 *     which never becomes context; this block reads the adapter from
 *     `SchemaRendererProvider`. Measured `find` **0**.
 *  3. **keys** (#5377) — it named the object with `object`, and this block
 *     declares `objectName` (`GRID_QUERY_INPUTS`, `required: true`). Measured
 *     `find` **0** even under the right wiring.
 *
 * Every intermediate state passes a diff review and renders nothing, which is
 * why this file evaluates the guide's literals instead of asserting about their
 * text: the schema objects below are the ones the published page hands a reader.
 * The `find` **0 → 1** contrast for each axis is pinned so a future edit that
 * reintroduces one fails here rather than on a reader's screen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Module-scope side-effect imports: the registry must hold every key the
// guide's snippets name before the first render (AGENTS.md §测试纪律 — a
// `beforeAll` import is bounded by `hookTimeout` and would race the loader).
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
    priority: { name: 'priority', type: 'text', label: 'Priority' },
    assignee: { name: 'assignee', type: 'text', label: 'Assignee' },
    due_date: { name: 'due_date', type: 'date', label: 'Due Date' },
  },
};

const ROW = { id: '42', title: 'Write the guide', status: 'Todo', priority: 'High' };

/**
 * Every schema literal the guide publishes for `type: '<key>'`, evaluated.
 *
 * Reading the literals out of the page is the point: a transcription kept in
 * this file would drift from the page silently, and the whole failure mode here
 * is that nothing tells you when the page stops working.
 *
 * The guide's literals close over exactly the identifiers bound below (its
 * `TaskSchema` import and the `useState` values of Steps 6 and 7), and carry no
 * TypeScript syntax inside the object, so `Function` is enough to evaluate one.
 */
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
    const literal = src.slice(start, end + 1);
    out.push(
      new Function(
        'TaskSchema', 'editId', 'taskId', 'activeView', 'searchQuery',
        `return (${literal});`,
      )(TASK_SCHEMA, '42', '42', 'all', ''),
    );
  }
  return out;
}

function makeAdapter() {
  return {
    find: vi.fn().mockResolvedValue({ data: [ROW], total: 1 }),
    findOne: vi.fn().mockResolvedValue(ROW),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getObjectSchema: vi.fn().mockResolvedValue(TASK_SCHEMA),
  };
}

const GRID_SNIPPETS = guideSchemas('object-grid');

beforeEach(() => cleanup());

describe('guide/building-crud-app.md — every `object-grid` snippet actually renders', () => {
  it('publishes the three snippets this file is about', () => {
    // A guide that lost a snippet would otherwise make this whole file vacuous:
    // zero snippets means zero assertions and a green run.
    expect(GRID_SNIPPETS).toHaveLength(3);
  });

  it.each(GRID_SNIPPETS.map((schema, i) => [i + 1, schema] as const))(
    'snippet %i queries `task` under the provider wiring and paints the row',
    async (_i, schema) => {
      const adapter = makeAdapter();
      const { container } = render(
        <SchemaRendererProvider dataSource={adapter as any}>
          <SchemaRenderer schema={schema} />
        </SchemaRendererProvider>,
      );

      await waitFor(() => expect(adapter.find).toHaveBeenCalledTimes(1));
      expect(adapter.find.mock.calls[0][0]).toBe('task');
      await waitFor(() => expect(container.textContent).toContain('Write the guide'));
    },
  );

  it('names the object with the key this block declares — `object` fetches nothing', async () => {
    // The #5377 axis, pinned as a contrast rather than described. Same snippet,
    // same wiring, one key re-spelled the way the page used to spell it.
    const [first] = GRID_SNIPPETS;
    const asItWas = { ...first, object: first.objectName };
    delete asItWas.objectName;

    const adapter = makeAdapter();
    const { container } = render(
      <SchemaRendererProvider dataSource={adapter as any}>
        <SchemaRenderer schema={asItWas} />
      </SchemaRendererProvider>,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(adapter.find).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('Write the guide');
  });

  it('resolves the adapter from EITHER wiring now, and the prop wins over context', async () => {
    // The #5378 axis, as it stands AFTER the convergence. It used to be a hard
    // split: `SchemaRenderer` reads only context, and this block's
    // `useSchemaContext()` THREW without a provider, so the guide's prop wiring
    // painted «Component "object-grid" failed to render» and `find` was 0.
    //
    // Both wirings resolve now. The prop wins because it is the more specific
    // signal — written on this one placement, against a provider that applies to
    // every descendant. That precedence is not new (the adapter already reached
    // `ObjectGrid` through `{...props}`, spread last, whenever a provider
    // existed); it is now stated instead of being an accident of spread order.
    const [first] = GRID_SNIPPETS;

    const propOnly = makeAdapter();
    const { unmount } = render(<SchemaRenderer schema={first} dataSource={propOnly as any} />);
    await waitFor(() => expect(propOnly.find).toHaveBeenCalledTimes(1));
    unmount();

    const ambient = makeAdapter();
    const explicit = makeAdapter();
    render(
      <SchemaRendererProvider dataSource={ambient as any}>
        <SchemaRenderer schema={first} dataSource={explicit as any} />
      </SchemaRendererProvider>,
    );
    await waitFor(() => expect(explicit.find).toHaveBeenCalledTimes(1));
    expect(ambient.find).not.toHaveBeenCalled();
  });

  it('the page injects the adapter once, above the blocks, and on no block itself', () => {
    const src = fs.readFileSync(GUIDE, 'utf8');
    expect(src).toContain('<SchemaRendererProvider dataSource={dataSource}>');
    // AGENTS.md commandment #1 is the injection pattern; a `dataSource` written
    // on a `SchemaRenderer` in this page is the wiring #5378 measured as dead.
    // `\s` after the name is what keeps `<SchemaRendererProvider …>` out of the set.
    const calls = src.match(/<SchemaRenderer\s[\s\S]*?\/>/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((c) => /\bdataSource=/.test(c))).toEqual([]);
  });
});

describe('object-grid — a block that resolves no adapter says so (objectui#5378 item 2)', () => {
  it('reports "No data source resolved" instead of an empty grid', async () => {
    const { findByTestId } = render(
      <SchemaRenderer schema={{ type: 'object-grid', objectName: 'task' } as any} />,
    );
    const panel = await findByTestId('object-grid-no-data-source');
    expect(panel).toHaveAttribute('role', 'alert');
    // The message has to be an ADDRESS, not a symptom: it names the block, the
    // object it was about to read, and the ancestor that injects the adapter.
    expect(panel.textContent).toContain('object-grid');
    expect(panel.textContent).toContain('task');
    expect(panel.textContent).toContain('SchemaRendererProvider');
  });

  it('stays silent for inline rows, which need no adapter', async () => {
    const { queryByTestId, container } = render(
      <SchemaRenderer
        schema={{
          type: 'object-grid',
          objectName: 'task',
          data: { provider: 'value', items: [ROW] },
        } as any}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain('Write the guide'));
    expect(queryByTestId('object-grid-no-data-source')).toBeNull();
  });

  it('stays silent when a HOST owns the fetch and hands the window down as a prop', async () => {
    // `plugin-list`'s ListView renders this block through `SchemaRenderer` with
    // `data` as a REACT prop. An empty first window is a host still fetching —
    // presence of the prop is the signal, never its truthiness.
    const { queryByTestId } = render(
      <SchemaRenderer schema={{ type: 'object-grid', objectName: 'task' } as any} data={[]} />,
    );
    await new Promise((r) => setTimeout(r, 50));
    expect(queryByTestId('object-grid-no-data-source')).toBeNull();
  });
});
