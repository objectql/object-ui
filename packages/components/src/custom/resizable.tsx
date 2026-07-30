/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import {
  ResizableHandle as ShadcnResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '../ui/resizable';

/**
 * Orientation-correct `ResizableHandle`.
 *
 * `ui/resizable.tsx` (a no-touch Shadcn-sync file, AGENTS.md #7) is from the
 * `react-resizable-panels` **v3** generation: every one of its stacked-group
 * styles is keyed on `data-[panel-group-direction=vertical]`. v4 — the
 * installed major — never emits that attribute. The only data attributes it
 * puts in the DOM are `data-group`, `data-panel`, `data-separator`,
 * `data-disabled` and `data-testid`, so all seven variants plus the grip's
 * `[&[data-panel-group-direction=vertical]>div]:rotate-90` are dead selectors.
 *
 * The visible consequence: in a **stacked** group the divider kept the base
 * `w-px` and rendered as a 1px-wide, 16px-tall sliver (its whole height came
 * from the grip) instead of a full-width 1px-tall rule, and the grip never
 * rotated. Measured in a browser before this wrapper existed: 1×16px, with a
 * 4×16px `::after` hit area pinned to the group's left edge.
 *
 * What v4 *does* emit on the separator is `aria-orientation`, so that is what
 * these variants key on — matching upstream Shadcn, which has since been
 * regenerated for v4 the same way.
 *
 * ⚠️ The attribute value is the **inverse** of the group's `orientation`, and
 * deliberately so: `aria-orientation` describes the separator, not the group.
 * A `orientation="vertical"` group stacks its panels, so the divider between
 * them is a *horizontal* line — hence `aria-orientation="horizontal"`.
 *
 *   group orientation="horizontal" → panels side-by-side → separator aria-orientation="vertical"   (base classes)
 *   group orientation="vertical"   → panels stacked      → separator aria-orientation="horizontal" (these classes)
 *
 * Each variant below is the live counterpart of a dead `data-[…]` one still
 * carried by the base class string. They win on specificity: an attribute
 * selector scores above the bare utility class it overrides, which is the same
 * mechanism upstream relies on within its single file.
 */
const HORIZONTAL_SEPARATOR_CLASSES = [
  // The rule itself: a full-width hairline instead of a 1px-wide sliver.
  'aria-[orientation=horizontal]:h-px',
  'aria-[orientation=horizontal]:w-full',
  // The `::after` drag hit area: a 4px strip along the rule, not across it.
  'aria-[orientation=horizontal]:after:left-0',
  'aria-[orientation=horizontal]:after:h-1',
  'aria-[orientation=horizontal]:after:w-full',
  'aria-[orientation=horizontal]:after:translate-x-0',
  'aria-[orientation=horizontal]:after:-translate-y-1/2',
  // The grip glyph reads as a drag affordance only when it crosses the rule.
  '[&[aria-orientation=horizontal]>div]:rotate-90',
].join(' ');

export type ResizableHandleProps = React.ComponentProps<typeof ShadcnResizableHandle>;

const ResizableHandle = ({ className, ...props }: ResizableHandleProps) => (
  <ShadcnResizableHandle className={cn(HORIZONTAL_SEPARATOR_CLASSES, className)} {...props} />
);

/**
 * `ResizablePanelGroup` and `ResizablePanel` need no wrapping and are
 * re-exported as-is: the group's `flex-direction` comes from an inline style
 * the library writes itself (`row` / `column` from `orientation`), so its own
 * dead `data-[panel-group-direction=vertical]:flex-col` is inert but harmless.
 * They pass through here purely so callers have one import site for the trio.
 *
 * These are the *only* public `Resizable*` exports — `ui/index.ts` deliberately
 * does not re-export `./resizable`, so no consumer can reach the unpatched
 * handle through `@object-ui/components` and silently lose the stacked case.
 */
export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
