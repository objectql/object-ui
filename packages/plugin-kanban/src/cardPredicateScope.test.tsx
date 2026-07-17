/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Kanban card conditional formatting must bind the HOST PREDICATE SCOPE
 * alongside the card (ADR-0058 / #1583 parity with grid rows): a
 * `features.*` / `current_user.*` condition authored once has to reach the
 * identical verdict on grid rows and kanban cards. Before this suite, kanban
 * evaluated cards without the ambient scope, so such a condition silently
 * never matched here while working on the grid.
 */

import { describe, it, expect, afterEach } from 'vitest';
import * as React from 'react';
import { render, cleanup } from '@testing-library/react';
import { PredicateScopeProvider } from '@object-ui/react';
import { KanbanEnhanced } from './KanbanEnhanced';
import KanbanBoard from './KanbanImpl';

// happy-dom may lack ResizeObserver (KanbanBoard's container-aware column
// sizing) — a no-op polyfill keeps the static render working.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = NoopResizeObserver;
}

const HOT_BG = 'rgb(254, 226, 226)';
const columns = [{ id: 'todo', title: 'Todo', cards: [{ id: 'c1', title: 'Card One' }] }];
// A features-gated spec rule — resolves ONLY when the host predicate scope is
// bound alongside the card.
const featureRules = [
  { condition: 'features.urgentHighlight && record.id == "c1"', style: { backgroundColor: HOT_BG } },
] as any;

/** The first element carrying the given inline background, if any. */
function findByBg(container: HTMLElement, bg: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).find(
    (el) => el.style && el.style.backgroundColor === bg,
  );
}

afterEach(cleanup);

describe('kanban card conditional formatting · host predicate scope (ADR-0058)', () => {
  it('KanbanEnhanced binds the ambient predicate scope alongside the card', () => {
    const { container } = render(
      <PredicateScopeProvider scope={{ features: { urgentHighlight: true } }}>
        <KanbanEnhanced columns={columns} conditionalFormatting={featureRules} />
      </PredicateScopeProvider>,
    );
    expect(findByBg(container, HOT_BG)).toBeTruthy();
  });

  it('KanbanBoard (impl) binds the ambient predicate scope alongside the card', () => {
    const { container } = render(
      <PredicateScopeProvider scope={{ features: { urgentHighlight: true } }}>
        <KanbanBoard columns={columns} conditionalFormatting={featureRules} />
      </PredicateScopeProvider>,
    );
    expect(findByBg(container, HOT_BG)).toBeTruthy();
  });

  it('a scope-gated condition fails SOFT (no style) outside the provider', () => {
    const { container } = render(
      <KanbanEnhanced columns={columns} conditionalFormatting={featureRules} />,
    );
    expect(findByBg(container, HOT_BG)).toBeUndefined();
  });

  it('bare-field conditions keep working without any provider (row spread)', () => {
    const bareRules = [{ condition: 'id == "c1"', style: { backgroundColor: HOT_BG } }] as any;
    const { container } = render(
      <KanbanEnhanced columns={columns} conditionalFormatting={bareRules} />,
    );
    expect(findByBg(container, HOT_BG)).toBeTruthy();
  });
});
