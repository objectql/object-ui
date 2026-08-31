/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4795 Direction 1 — the same contract as
 * `packages/react/src/__tests__/SchemaRenderer.bindableTextKeys.test.tsx`, but
 * driven through the REAL production renderers with no stand-in for the
 * read-back half.
 *
 * That companion file pins the memo against probes, because `@object-ui/react`
 * by design does not depend on `@object-ui/components`. It can therefore prove
 * the value was EVALUATED, and only assert the read-back against a mirror of
 * the real read points. This file closes that gap: `statistic`, `card` and
 * `button` here are the shipped renderers, so a passing assertion below means
 * the evaluated value actually reached the DOM — which is the whole of what
 * objectui#4795 measured as missing ("evaluated AND read back").
 *
 * ## Why this file contains no renderer-specific fix to guard
 *
 * It guards the OPPOSITE. The ruling's implementation caution was that these
 * read-back sites must be "converged on evaluated values, not patched per
 * component" — and none of `data-display/statistic.tsx`, `layout/card.tsx` or
 * `form/button.tsx` is touched by this card. They already read the right place;
 * the single memo leg upstream now writes an evaluated value there. So these
 * assertions passing while those three files are untouched IS the convergence
 * claim, stated as a measurement rather than as a promise.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// Module scope, not a hook — the cold transform would otherwise be billed to
// `hookTimeout` (object-ui/no-dynamic-import-in-test-hook, objectui#3010).
import '../renderers';

const DATA = { total: 99, caption: 'Active users', note: '+20.1% from last month' };

const renderNode = (schema: any) =>
  render(
    <SchemaRendererProvider dataSource={DATA}>
      <SchemaRenderer schema={schema} />
    </SchemaRendererProvider>,
  );

describe('objectui#4795 — declared text keys are evaluated AND read back, through real renderers', () => {
  it('`statistic` binds label / value / description', () => {
    renderNode({
      type: 'statistic',
      label: '${data.caption}',
      value: '${data.total}',
      description: '${data.note}',
    });
    expect(screen.getByText('Active users')).toBeTruthy();
    expect(screen.getByText('99')).toBeTruthy();
    expect(screen.getByText('+20.1% from last month')).toBeTruthy();
    // The defect, stated in the negative: the literal source must be gone.
    expect(screen.queryByText('${data.total}')).toBeNull();
  });

  it('`statistic` interpolates inside surrounding text', () => {
    renderNode({ type: 'statistic', value: 'Total: ${data.total}' });
    expect(screen.getByText('Total: 99')).toBeTruthy();
  });

  it('`card` binds title / description', () => {
    renderNode({ type: 'card', title: '${data.caption}', description: '${data.note}' });
    expect(screen.getByText('Active users')).toBeTruthy();
    expect(screen.getByText('+20.1% from last month')).toBeTruthy();
  });

  it('`button` binds label', () => {
    renderNode({ type: 'button', label: 'Refresh ${data.total}' });
    expect(screen.getByText('Refresh 99')).toBeTruthy();
  });
});

describe('objectui#4795 — the undeclared half stays inert, through real renderers', () => {
  /**
   * `basic/text.tsx` renders `schema.content || schema.value`, so `text.value`
   * IS a top-level read-back site — and `text` has no row in the spec's
   * carriage map, so the memo must not evaluate it. This assertion therefore
   * pins a KNOWN, reported gap rather than a desired behaviour: the literal on
   * screen is what an author writing the form the expressions guide teaches
   * gets today, and closing it is a spec-side row (objectstack), not a
   * renderer-side inference here. If a row is ever added upstream, this is the
   * test that will go red and say so.
   */
  it('`text.value` is still not evaluated — no spec row (reported upstream)', () => {
    renderNode({ type: 'text', value: '${data.total}' });
    expect(screen.getByText('${data.total}')).toBeTruthy();
  });

  it('a key outside the component\'s declared row stays inert (`card.value`)', () => {
    const { container } = renderNode({ type: 'card', title: 'Fixed', value: '${data.total}' });
    // `card` declares title/description only; `value` is neither evaluated nor
    // read back, so nothing from it reaches the DOM text.
    expect(container.textContent).toContain('Fixed');
    expect(container.textContent).not.toContain('99');
  });
});
