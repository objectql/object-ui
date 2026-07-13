/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * ADR-0057 P3c — pure state helper for the Studio Interfaces pillar's folded
 * center tabs (`[canvas | properties]`, shown when the chat dock occupies the
 * right side). Kept dependency-free so the auto-switch rule is unit-testable
 * without React.
 */

export type StudioCenterTab = 'canvas' | 'properties';

/**
 * The auto-switch rule for the folded center tabs — driven by whether an
 * inspector TARGET exists (a canvas block selection, or a nav item selected in
 * nav-edit mode):
 *
 *  - target APPEARS (edge, not level): jump to Properties — clicking a block is
 *    an intent to edit it, and with the panel folded the properties are no
 *    longer visible beside the canvas.
 *  - target CLEARS: return to Canvas — nothing left to inspect.
 *  - steady state: keep the user's current choice. This is the "never fight
 *    the user" rule (mirrors useCollapsibleChatsList): someone who flipped back
 *    to Canvas while a selection is still live must not be yanked to
 *    Properties on every render.
 *
 * Pure + exported for tests.
 */
export function nextCenterTab(
  current: StudioCenterTab,
  hadTarget: boolean,
  hasTarget: boolean,
): StudioCenterTab {
  if (!hadTarget && hasTarget) return 'properties';
  if (hadTarget && !hasTarget) return 'canvas';
  return current;
}
