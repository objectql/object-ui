/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The stacked resizable divider — `custom/resizable.tsx`.
 *
 * `ui/resizable.tsx` is the react-resizable-panels **v3** Shadcn file: its
 * whole stacked-group appearance hangs off `data-[panel-group-direction=vertical]`,
 * an attribute v4 (the installed major) never emits. So in a stacked group the
 * divider kept the base `w-px` and came out a 1px-wide, 16px-tall sliver — its
 * only height being the grip — instead of a full-width hairline, with a 4x16px
 * drag target pinned to the group's left edge and an unrotated grip.
 * `custom/resizable.tsx` re-keys those styles onto `aria-orientation`, which v4
 * does emit on the separator.
 *
 * These tests pin the *class contract* and the attribute it depends on; happy-dom
 * has no Tailwind, so resolved geometry (478x1px rule, 478x4px hit strip, grip at
 * `rotate: 90deg`, and a real off-grip drag moving the split 50 → 75.21) is
 * verified in a browser instead — see the PR.
 *
 * The load-bearing case is the one that reads backwards: `aria-orientation`
 * describes the SEPARATOR, so a `orientation="vertical"` group (stacked panels)
 * has a `aria-orientation="horizontal"` divider. Keying the stacked styles on
 * `aria-[orientation=vertical]` would be the easy, silent way to reintroduce
 * exactly this bug — hence the first test.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../custom/resizable';

afterEach(cleanup);

function renderGroup(orientation: 'horizontal' | 'vertical') {
  const { container } = render(
    <ResizablePanelGroup orientation={orientation}>
      <ResizablePanel defaultSize={50}>one</ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50}>two</ResizablePanel>
    </ResizablePanelGroup>,
  );
  const separator = container.querySelector<HTMLElement>('[role="separator"]');
  if (!separator) throw new Error('no separator rendered');
  return { container, separator };
}

/**
 * Every `aria-[name=value]:`-prefixed utility on the element, as the
 * [attribute, value] pair the variant actually selects on — Tailwind's `aria-[…]`
 * variant prepends `aria-` to the bracketed name, so `aria-[orientation=horizontal]:`
 * compiles to `&[aria-orientation="horizontal"]`.
 */
function ariaVariantsOn(el: HTMLElement): Array<[string, string]> {
  return [...el.classList].flatMap((cls) => {
    const m = /(?:^|:)aria-\[([a-z-]+)=([^\]]+)\]:/.exec(cls);
    return m ? [[`aria-${m[1]}`, m[2]] as [string, string]] : [];
  });
}

describe('custom/resizable — the stacked divider (react-resizable-panels v4)', () => {
  it('gives the stacked divider aria-orientation=horizontal, not vertical', () => {
    // The inversion that makes this bug easy to reintroduce: the group stacks
    // vertically, so the rule between the panels runs horizontally.
    expect(renderGroup('vertical').separator.getAttribute('aria-orientation')).toBe('horizontal');
    expect(renderGroup('horizontal').separator.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('keys the stacked divider on that attribute, so a hairline replaces the sliver', () => {
    const { separator } = renderGroup('vertical');
    const classes = [...separator.classList];

    // The rule: full-width, 1px tall — overriding the base `w-px` that made it a
    // vertical sliver in a stacked group.
    expect(classes).toContain('aria-[orientation=horizontal]:h-px');
    expect(classes).toContain('aria-[orientation=horizontal]:w-full');
    // The `::after` drag target: a strip ALONG the rule, not across it.
    expect(classes).toContain('aria-[orientation=horizontal]:after:h-1');
    expect(classes).toContain('aria-[orientation=horizontal]:after:w-full');
    expect(classes).toContain('aria-[orientation=horizontal]:after:left-0');
    expect(classes).toContain('aria-[orientation=horizontal]:after:translate-x-0');
    expect(classes).toContain('aria-[orientation=horizontal]:after:-translate-y-1/2');
    // The grip crosses the rule only when rotated.
    expect(classes).toContain('[&[aria-orientation=horizontal]>div]:rotate-90');
  });

  it('leaves the side-by-side divider on the base classes', () => {
    const { separator } = renderGroup('horizontal');
    // Same class string either way — nothing above matches, so the base
    // `w-px` / `after:left-1/2` / `after:-translate-x-1/2` styling stands and
    // the grip is not rotated. This is the case that already worked; it must
    // keep working.
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    for (const [attr, value] of ariaVariantsOn(separator)) {
      expect(separator.matches(`[${attr}="${value}"]`)).toBe(false);
    }
  });

  it('only keys on attributes the installed library actually emits', () => {
    // The guard that would have caught the original bug, and catches the next
    // rename: every `aria-[…]` variant the wrapper adds must match the real DOM
    // in the orientation it targets. A variant naming an attribute/value the
    // library never writes is a dead selector — which is exactly what
    // `data-[panel-group-direction=vertical]` became when v4 landed.
    const { separator } = renderGroup('vertical');
    const variants = ariaVariantsOn(separator);

    expect(variants.length).toBeGreaterThan(0);
    for (const [attr, value] of variants) {
      expect(
        separator.matches(`[${attr}="${value}"]`),
        `dead selector: no [${attr}="${value}"] on the rendered separator`,
      ).toBe(true);
    }
  });

  it('documents why the wrapper exists: v4 emits no panel-group-direction', () => {
    // If this ever fails, the library started emitting the v3 attribute again
    // and `ui/resizable.tsx`'s own variants would carry the stacked case — at
    // which point this wrapper is redundant rather than load-bearing.
    const { container } = renderGroup('vertical');
    expect(container.querySelectorAll('[data-panel-group-direction]')).toHaveLength(0);
  });
});
