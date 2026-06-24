/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MetadataResourceConfig } from './registry';

/**
 * Build the create-mode save body for a new metadata item.
 *
 * Prefers the server's authoritative **create seed** (delivered per type on the
 * `/meta/types` registry entry — the single source of truth in
 * `@objectstack/spec`) over the locally hardcoded `createDefaults`. This is the
 * drift-stop for the recurring "the designer emits a minimal shape the spec
 * rejects, so create→save 422s" family (dashboard `layout`, action `body`):
 * the structural defaults now come from the same place the spec validates
 * against, so they cannot diverge. Falls back to `createDefaults` when the
 * server provides no seed (older server, or canvas-create types whose shape is
 * built interactively).
 *
 * User-supplied draft values always win over the seed's placeholders.
 * `createBuildBody` (dynamic identity, e.g. a view's qualified name) still takes
 * precedence — it incorporates user input the static seed cannot.
 */
export function buildCreateModeBody(
  config: Pick<MetadataResourceConfig, 'createBuildBody' | 'createDefaults'>,
  draft: Record<string, unknown>,
  specCreateSeed: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (config.createBuildBody) {
    return config.createBuildBody(draft) as Record<string, unknown>;
  }
  return { ...(specCreateSeed ?? config.createDefaults ?? {}), ...draft };
}
