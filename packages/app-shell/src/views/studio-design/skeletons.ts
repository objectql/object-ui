/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Minimal-valid draft skeletons for the Studio's INLINE "New X" creators
// (Data → object, Automations → flow, Interfaces → app, Access → permission).
//
// These bypass the metadata-admin registry, so `createConformance.test.ts`'s
// registry-driven gate does NOT cover them — a future edit to one of these
// shapes could make its "New" button a silent dead-end (create→save 422s). They
// live here, pure and exported, so BOTH the pillars and the conformance gate
// consume the SAME source: the test can't drift from what the designer emits.
//
// Label strings are parameters (the pillars pass localized `t(...)` values); the
// gate passes any placeholder — the labels don't affect spec validity.

export function buildObjectSkeleton(name: string, label: string, nameFieldLabel: string): Record<string, unknown> {
  return {
    name,
    label,
    fields: { name: { type: 'text', label: nameFieldLabel } },
  };
}

export function buildFlowSkeleton(name: string, label: string, startLabel: string, endLabel: string): Record<string, unknown> {
  return {
    name,
    label,
    type: 'autolaunched',
    nodes: [
      { id: 'start', type: 'start', label: startLabel },
      { id: 'end', type: 'end', label: endLabel },
    ],
    edges: [{ id: 'e1', source: 'start', target: 'end' }],
  };
}

export function buildAppSkeleton(name: string, label: string): Record<string, unknown> {
  return { name, label, active: true, navigation: [] };
}

export function buildPermissionSkeleton(name: string, label: string): Record<string, unknown> {
  return { name, label, objects: {}, fields: {} };
}
