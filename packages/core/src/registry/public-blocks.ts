/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ADR-0080 — the curated PUBLIC block contract (capability ≠ contract).
 *
 * The subset of registered components that form the platform's *contract* and
 * AI-authoring vocabulary: type-checked, api-surface-ratcheted, documented, and
 * offered to the JSX-source authoring surface. The full ~244 registered types
 * remain a rendering *capability* (`getAllConfigs`); only these are the
 * contract (`getPublicConfigs`).
 *
 * Shaped like Salesforce App Builder standard components — small, object-centric
 * — plus a thin layout/content layer and one escape hatch. A component not yet
 * registered is simply skipped (the list is aspirational-safe). Registrations
 * may also opt in individually via `tier: 'public'`.
 *
 * This is a single, reviewable source of truth for the public surface — prefer
 * editing this list over scattering `tier` flags across registration sites.
 */
export const PUBLIC_BLOCKS: readonly string[] = [
  // ── Tier A — object-aware blocks (the contract core) ──────────────────────
  'object-grid',
  'list-view',
  'object-form',
  'embeddable-form',
  'object-master-detail-form',
  'object-kanban',
  'object-calendar',
  'object-gantt',
  'object-timeline',
  'object-map',
  'object-metric',
  'object-chart',
  'dashboard',
  'object-pivot',
  'record:details',
  'record:highlights',
  'record:related_list',
  'record:path',
  // `record:`-prefixed, like its four siblings above. @object-ui/plugin-form
  // registers this one with `skipFallback: true`, so the bare `line_items` key
  // it was listed under here never existed — the block has shipped all along
  // but could never resolve through the contract (objectui#2953 follow-up).
  'record:line_items',
  // Configurable as of objectui#3023 follow-up: these shipped with renderers
  // but no declared `inputs`, so a model could only emit them bare — which is
  // why they sat outside the contract. Their inputs now mirror what the
  // renderers actually read, so they are authorable and belong here.
  //
  // `record:chatter` is deliberately NOT in this list: it is the same renderer
  // as `record:discussion` under a Salesforce-familiar name, kept for schemas
  // already in the wild. Two spellings of one block is ambiguity an authoring
  // model has no way to resolve, so the vocabulary carries the spec's name.
  'record:activity',
  'record:discussion',
  'record:history',
  'record:quick_actions',
  'record:reference_rail',
  'record:alert',
  // ── Tier B — layout / content primitives ──────────────────────────────────
  'flex',
  'grid',
  'stack',
  'card',
  'tabs',
  'accordion',
  'container',
  'page:header',
  'text',
  'image',
  'icon',
  'markdown',
  'element:divider',
  'badge',
  'alert',
  'button',
  // ── Tier C — escape hatch (flagged, second-class) ─────────────────────────
  'html',
];

/** Fast membership set built from {@link PUBLIC_BLOCKS}. */
export const PUBLIC_BLOCK_SET: ReadonlySet<string> = new Set(PUBLIC_BLOCKS);
