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

import { spliceArray } from './_shared';

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

// ── C2: node location + write-back ─────────────────────────────────────────

/** A flow node, loose enough for both draft.nodes and a region sub-graph. */
export interface FlowNodeLike {
  id: string;
  type?: string;
  label?: string;
  description?: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
}

/**
 * A resolved node together with how to write it back — the single abstraction
 * the inspector edits through, so it never branches on top-level vs nested.
 */
export interface NodeLocation {
  /** The resolved node (a member of draft.nodes, or of a region sub-graph). */
  node: FlowNodeLike;
  /** True when the node lives inside a container region (not draft.nodes). */
  nested: boolean;
  /**
   * The node id whose graph scope applies. A nested node runs in its container's
   * OUTER scope (ADR-0031), so the anchor is the container id, not the node's.
   */
  scopeAnchorId: string;
  /** The enclosing container node — only when nested. */
  container?: FlowNodeLike;
  /** Human region label for the inspector breadcrumb — only when nested. */
  regionLabel?: string;
  /**
   * Produce the draft patch that writes `next` back in place (or removes it with
   * `null`). Returns null when the location is STALE — the draft changed under a
   * deep link — so the caller no-ops instead of writing to the wrong node.
   * `next` is a plain object (what `setAtPath` returns), not a strict node.
   */
  write: (next: Record<string, unknown> | null) => Record<string, unknown> | null;
}

function asNodeArray(v: unknown): FlowNodeLike[] {
  return Array.isArray(v) ? (v as FlowNodeLike[]) : [];
}

function configOf(node: FlowNodeLike): Record<string, unknown> {
  const c = node.config;
  return c && typeof c === 'object' && !Array.isArray(c) ? (c as Record<string, unknown>) : {};
}

/** A region object (`{ nodes, edges, name? }`) with a usable `nodes` array, or null. */
function asRegion(v: unknown): (Record<string, unknown> & { nodes: FlowNodeLike[] }) | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const r = v as Record<string, unknown>;
  if (!Array.isArray(r.nodes)) return null;
  return r as Record<string, unknown> & { nodes: FlowNodeLike[] };
}

/** Resolve a region object out of a container's config by its structured path. */
function regionFromConfig(cfg: Record<string, unknown>, rp: RegionConfigPath) {
  if (rp.kind === 'key') return asRegion(cfg[rp.key]);
  const branches = Array.isArray(cfg.branches) ? cfg.branches : [];
  return asRegion(branches[rp.index]);
}

/**
 * Rebuild a container with one nested node replaced (or removed) — using
 * EXPLICIT SPREADS, never a generic setAtPath through the region path. A path
 * walk would objectify the `config.branches` array (turn `[…]` into `{0:…}`) and
 * mis-prune; spliceArray keeps every array an array and preserves sibling keys
 * (`region.edges`, `branch.name`).
 */
function writeNestedNode(
  nodes: FlowNodeLike[],
  containerIdx: number,
  container: FlowNodeLike,
  rp: RegionConfigPath,
  nodeIdx: number,
  next: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const cfg = configOf(container);
  const region = regionFromConfig(cfg, rp);
  if (!region || nodeIdx < 0 || nodeIdx >= region.nodes.length) return null;
  const nextRegion = { ...region, nodes: spliceArray(region.nodes, nodeIdx, next) };
  const nextCfg: Record<string, unknown> =
    rp.kind === 'key'
      ? { ...cfg, [rp.key]: nextRegion }
      : { ...cfg, branches: spliceArray(Array.isArray(cfg.branches) ? (cfg.branches as unknown[]) : [], rp.index, nextRegion) };
  const nextContainer = { ...container, config: nextCfg };
  return { nodes: spliceArray(nodes, containerIdx, nextContainer) };
}

/**
 * Resolve a selection (top-level `node` or a `NESTED_NODE_KIND` deep path) to a
 * {@link NodeLocation}, or null when it cannot be found (unparseable id, missing
 * container / region / node — a stale deep link). The caller renders an
 * empty-state for null; a non-null location's `write` may still return null if
 * the draft shifts between resolve and commit.
 */
export function locateFlowNode(
  draft: Record<string, unknown>,
  selection: { kind: string; id: string },
): NodeLocation | null {
  const nodes = asNodeArray(draft.nodes);

  if (selection.kind === NESTED_NODE_KIND) {
    const path = parseNestedNodeId(selection.id);
    const rp = path ? regionConfigPathOf(path.regionKey) : null;
    if (!path || !rp) return null;
    const containerIdx = nodes.findIndex((n) => n?.id === path.containerId);
    const container = containerIdx >= 0 ? nodes[containerIdx] : null;
    if (!container) return null;
    const region = regionFromConfig(configOf(container), rp);
    const nodeIdx = region ? region.nodes.findIndex((n) => n?.id === path.nodeId) : -1;
    const node = region && nodeIdx >= 0 ? region.nodes[nodeIdx] : null;
    if (!node) return null;
    return {
      node,
      nested: true,
      scopeAnchorId: container.id,
      container,
      regionLabel: regionLabelOf(path.regionKey, container),
      write: (next) => writeNestedNode(nodes, containerIdx, container, rp, nodeIdx, next),
    };
  }

  const index = nodes.findIndex((n) => n?.id === selection.id);
  const node = index >= 0 ? nodes[index] : null;
  if (!node) return null;
  return {
    node,
    nested: false,
    scopeAnchorId: node.id,
    write: (next) => ({ nodes: spliceArray(nodes, index, next) }),
  };
}
