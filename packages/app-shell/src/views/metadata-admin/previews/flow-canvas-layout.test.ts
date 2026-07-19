// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  isBackEdge,
  rightAnchor,
  backEdgePath,
  backEdgeLabelAnchor,
  bottomAnchor,
  extractRegions,
  NODE_W,
  NODE_H,
  type FlowNode,
  type FlowEdge,
} from './flow-canvas-layout';

describe('isBackEdge', () => {
  it('is true only for type "back"', () => {
    expect(isBackEdge({ type: 'back' })).toBe(true);
    expect(isBackEdge({ type: 'default' })).toBe(false);
    expect(isBackEdge({ type: 'fault' })).toBe(false);
    expect(isBackEdge({})).toBe(false);
  });
});

describe('back-edge geometry', () => {
  it('rightAnchor sits on the node right edge, vertically centered', () => {
    expect(rightAnchor({ x: 100, y: 200 })).toEqual({ x: 100 + NODE_W, y: 200 + NODE_H / 2 });
  });

  it('backEdgePath is a cubic from source to target', () => {
    const from = rightAnchor({ x: 0, y: 300 });
    const to = rightAnchor({ x: 0, y: 0 });
    const d = backEdgePath(from, to);
    expect(d.startsWith(`M ${from.x},${from.y}`)).toBe(true);
    expect(d).toContain(' C ');
    expect(d.trimEnd().endsWith(`${to.x},${to.y}`)).toBe(true);
  });

  it('backEdgeLabelAnchor bows out to the right of the nodes', () => {
    const from = rightAnchor({ x: 0, y: 300 });
    const to = rightAnchor({ x: 0, y: 0 });
    const anchor = backEdgeLabelAnchor(from, to);
    // Apex is to the right of the (shared) node right edge…
    expect(anchor.x).toBeGreaterThan(from.x);
    // …and vertically between the two endpoints.
    expect(anchor.y).toBeCloseTo((from.y + to.y) / 2);
  });

  it('a forward edge anchors at the node bottom (unchanged)', () => {
    expect(bottomAnchor({ x: 10, y: 20 })).toEqual({ x: 10 + NODE_W / 2, y: 20 + NODE_H });
  });
});

describe('computeLayout — back-edges excluded from layering (ADR-0044)', () => {
  const nodes: FlowNode[] = [
    { id: 's', type: 'start' },
    { id: 'a', type: 'approval' },
    { id: 'w', type: 'wait' },
  ];

  it('keeps the back-edge target ABOVE the wait node it loops from', () => {
    const edges: FlowEdge[] = [
      { source: 's', target: 'a' },
      { source: 'a', target: 'w', label: 'revise' },
      { source: 'w', target: 'a', label: 'resubmit', type: 'back' },
    ];
    const pos = computeLayout(nodes, edges);
    const s = pos.get('s')!;
    const a = pos.get('a')!;
    const w = pos.get('w')!;
    // Top-to-bottom: start above approval above the wait point.
    expect(s.y).toBeLessThan(a.y);
    expect(a.y).toBeLessThan(w.y);
  });

  it('an UNMARKED return edge would instead drag the target down', () => {
    // Same graph, but the closing edge is a normal connection: the longest-path
    // relaxation now pushes `a` below `w` (demonstrates why excluding back-edges
    // matters for a readable loop).
    const edges: FlowEdge[] = [
      { source: 's', target: 'a' },
      { source: 'a', target: 'w', label: 'revise' },
      { source: 'w', target: 'a', label: 'resubmit' },
    ];
    const pos = computeLayout(nodes, edges);
    expect(pos.get('a')!.y).toBeGreaterThan(pos.get('w')!.y);
  });
});

describe('extractRegions (#2670 structured containers)', () => {
  const region = (n: string) => ({ nodes: [{ id: n, type: 'http' }], edges: [] });

  it('returns [] for an ordinary node', () => {
    expect(extractRegions({ id: 'x', type: 'create_record' })).toEqual([]);
  });

  it('returns [] for a legacy flat loop (no config.body)', () => {
    expect(extractRegions({ id: 'l', type: 'loop', config: { collection: '{items}' } })).toEqual([]);
    // ...and for an empty body region.
    expect(extractRegions({ id: 'l', type: 'loop', config: { body: { nodes: [], edges: [] } } })).toEqual([]);
  });

  it('extracts a loop body as one unlabeled region', () => {
    const out = extractRegions({ id: 'l', type: 'loop', config: { body: region('send') } });
    expect(out).toHaveLength(1);
    expect(out[0].label).toBeUndefined();
    expect(out[0].key).toBe('body');
    expect(out[0].nodes.map((n) => n.id)).toEqual(['send']);
  });

  it('extracts parallel branches, labeled by name then Branch N', () => {
    const out = extractRegions({
      id: 'p',
      type: 'parallel',
      config: { branches: [{ name: 'notify', ...region('a') }, region('b')] },
    });
    expect(out.map((r) => r.label)).toEqual(['notify', 'Branch 2']);
    expect(out.map((r) => r.key)).toEqual(['branch-0', 'branch-1']);
  });

  it('extracts try + catch, in order, labeled', () => {
    const out = extractRegions({
      id: 't',
      type: 'try_catch',
      config: { try: region('risky'), catch: region('recover') },
    });
    expect(out.map((r) => r.label)).toEqual(['Try', 'Catch']);
    // catch is optional — a try-only container yields just the try region.
    expect(extractRegions({ id: 't', type: 'try_catch', config: { try: region('risky') } }).map((r) => r.label)).toEqual(['Try']);
  });
});
