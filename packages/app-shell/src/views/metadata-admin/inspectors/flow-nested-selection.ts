// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-nested-selection — the selection contract for a node that lives INSIDE a
 * structured control-flow region (ADR-0031 `loop.body` / `parallel.branches[]` /
 * `try_catch.try`/`catch`) on the flow designer canvas (#2670 Phase 3).
 *
 * Phase 2 (#2680) made a container's regions render inline on the canvas, but a
 * nested node was read-only. To route a nested node to the shared
 * schema-driven inspector we need a selection that survives the flat
 * `MetadataSelection { kind, id }` channel yet still names a *path* into the
 * draft: `{ containerId, regionKey, nodeId }`.
 *
 * The id is encoded as `containerId::regionKey::nodeId`. Parsing anchors the
 * middle segment to the CLOSED set of real region keys (`body` / `try` /
 * `catch` / `branch-N`) so an ambiguous id (a `::`-bearing node id) still parses
 * deterministically; and because the caller (`locateFlowNode`, Phase 3 C2)
 * matches every segment EXACTLY against the draft, a mis-parse can only ever
 * resolve to "not found → empty shell", never to a wrong write. Selection is
 * never persisted (a deep link stores navigation, not flow content), so this
 * codec is not a backward-compat contract.
 */

/** The `MetadataSelection.kind` for a node nested inside a container region. */
export const NESTED_NODE_KIND = 'nested-node';

/** A node addressed by its container, region, and own id — decoded from a selection. */
export interface NestedNodePath {
  /** The structured container node (`loop` / `parallel` / `try_catch`) id. */
  containerId: string;
  /** Region key within the container: `body` / `try` / `catch` / `branch-N`. */
  regionKey: string;
  /** The nested node's own id, within that region's sub-graph. */
  nodeId: string;
}

/**
 * Where a region lives in its container's `config`. A *structured* path (rather
 * than a flat string path) so the write-back (Phase 3 C2) can rebuild the
 * container with explicit spreads — a generic `setAtPath` through a region path
 * would objectify the `config.branches` array.
 */
export type RegionConfigPath =
  | { kind: 'branch'; index: number }
  | { kind: 'key'; key: 'body' | 'try' | 'catch' };

/** Anchored to the closed set of region keys `extractRegions` can emit. */
const NESTED_ID_RE = /^(.+?)::(body|try|catch|branch-\d+)::(.+)$/;
const BRANCH_KEY_RE = /^branch-(\d+)$/;

/** Encode a nested-node path into a flat selection id. */
export function encodeNestedNodeId(path: NestedNodePath): string {
  return `${path.containerId}::${path.regionKey}::${path.nodeId}`;
}

/** Decode a selection id into a nested-node path, or null when it is not one. */
export function parseNestedNodeId(id: string): NestedNodePath | null {
  const m = NESTED_ID_RE.exec(id);
  if (!m) return null;
  return { containerId: m[1], regionKey: m[2], nodeId: m[3] };
}

/**
 * Resolve a region key to its structured location in `container.config`, or null
 * for an unrecognized key. Mirrors `extractRegions`: `body` → `config.body`,
 * `try`/`catch` → `config.try`/`config.catch`, `branch-N` → `config.branches[N]`.
 */
export function regionConfigPathOf(regionKey: string): RegionConfigPath | null {
  if (regionKey === 'body' || regionKey === 'try' || regionKey === 'catch') {
    return { kind: 'key', key: regionKey };
  }
  const m = BRANCH_KEY_RE.exec(regionKey);
  if (m) return { kind: 'branch', index: Number(m[1]) };
  return null;
}

/**
 * Human label for a region — for the inspector breadcrumb. Mirrors
 * `extractRegions`' header labels: `Body` / `Try` / `Catch`, and for a parallel
 * branch the authored `name` or the 1-based `Branch N` fallback (read from the
 * container so the label matches what the canvas header shows).
 */
export function regionLabelOf(regionKey: string, container?: { config?: unknown } | null): string {
  if (regionKey === 'body') return 'Body';
  if (regionKey === 'try') return 'Try';
  if (regionKey === 'catch') return 'Catch';
  const m = BRANCH_KEY_RE.exec(regionKey);
  if (m) {
    const index = Number(m[1]);
    const cfg = container && typeof container.config === 'object' && container.config
      ? (container.config as Record<string, unknown>)
      : {};
    const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
    const branch = branches[index];
    const name = branch && typeof branch === 'object' ? (branch as { name?: unknown }).name : undefined;
    return typeof name === 'string' && name ? name : `Branch ${index + 1}`;
  }
  return regionKey;
}
