/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * The adapter reaches a `kind:'react'` page's blocks, and keeps reaching them
 * when the host swaps it.
 *
 * `ReactKindPage` memoises the injected scope on `[schema, adapter]`, and that
 * `adapter` dependency looks like something to optimise away — it is the one
 * remaining thing that can recompile the page and cost its `useState`
 * (objectui#2954). It cannot go.
 *
 * `ReactRunner` returns the SAME element object while `(code, scope)` are
 * unchanged, and React bails out of re-rendering a child whose element is
 * referentially identical. So the page subtree does not re-render on its own:
 * recompiling is the ONLY way a new adapter reaches the blocks inside the page.
 * Drop the dependency (or read the adapter through a ref to "keep the scope
 * stable") and every block in every react page silently keeps querying through
 * the dead adapter — no error, just stale or failing data.
 *
 * These pin both halves so the tradeoff cannot be quietly re-litigated:
 * a swapped adapter must reach the blocks, and an unchanged one must not
 * disturb them.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, AdapterCtx } from '@object-ui/react';
import '../renderers';

/** The dataSource each render of the stand-in block was handed. */
const seen: unknown[] = [];

const makeAdapter = (id: string) => ({ id, find: async () => [] }) as any;

const SOURCE = `
function Page() {
  const [n, setN] = React.useState(0);
  return (
    <div>
      <button data-testid="counter" onClick={() => setN(n + 1)}>{n}</button>
      <ListView objectName="showcase_project" />
    </div>
  );
}`;

const SCHEMA = { type: 'home', kind: 'react', name: 'adapter_page', source: SOURCE };

// The barrel import moved to module scope (see the `import '../renderers'`
// above): inside the hook its cold transform was billed to `hookTimeout`, which
// is why this carried a raised timeout. The override below still has to run
// AFTER the barrel, and it does — static imports are evaluated before any hook.
// See object-ui/no-dynamic-import-in-test-hook (objectui#3010/#3021).
beforeAll(() => {
  ComponentRegistry.register('list-view', (props: any) => {
    seen.push(props.schema?.dataSource);
    return <div data-testid="list-view-double" />;
  });
});

afterAll(() => {
  ComponentRegistry.unregister('list-view');
});

function Host({ adapter }: { adapter: any }) {
  return (
    <AdapterCtx.Provider value={adapter}>
      <SchemaRenderer schema={SCHEMA} />
    </AdapterCtx.Provider>
  );
}

describe('kind:\'react\' page ↔ adapter identity', () => {
  it('hands blocks the new adapter when the host swaps it', async () => {
    seen.length = 0;
    const first = makeAdapter('first');
    const second = makeAdapter('second');

    const { findByTestId, rerender } = render(<Host adapter={first} />);
    await findByTestId('list-view-double');
    expect(seen.at(-1)).toBe(first);

    rerender(<Host adapter={second} />);

    // Nothing else re-renders the page subtree — ReactRunner hands React the
    // same element object while (code, scope) hold, and React bails out on an
    // identical element reference. Recompiling on the new scope is what carries
    // the adapter in.
    await waitFor(() => expect(seen.at(-1)).toBe(second));
  });

  it('leaves the page alone while the adapter identity holds', async () => {
    seen.length = 0;
    const adapter = makeAdapter('stable');

    const { findByTestId, getByTestId, rerender } = render(<Host adapter={adapter} />);
    const counter = await findByTestId('counter');
    counter.click();
    await waitFor(() => expect(getByTestId('counter').textContent).toBe('1'));

    rerender(<Host adapter={adapter} />);

    // The other half of the tradeoff: the same adapter must not recompile, or
    // the page loses its state on every parent render.
    expect(getByTestId('counter').textContent).toBe('1');
    expect(seen.at(-1)).toBe(adapter);
  });
});
