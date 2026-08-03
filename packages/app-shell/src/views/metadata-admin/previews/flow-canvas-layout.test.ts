// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  computeLayout,
  computeLayoutWithGeometry,
  diagramSize,
  isBackEdge,
  rightAnchor,
  backEdgePath,
  backEdgeLabelAnchor,
  bottomAnchor,
  extractRegions,
  hasManualPosition,
  manualPosition,
  withCanonicalGeometry,
  NODE_W,
  NODE_H,
  V_GAP,
  PADDING,
  type FlowDesignerNode,
  type FlowDesignerEdge,
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
  const nodes: FlowDesignerNode[] = [
    { id: 's', type: 'start' },
    { id: 'a', type: 'approval' },
    { id: 'w', type: 'wait' },
  ];

  it('keeps the back-edge target ABOVE the wait node it loops from', () => {
    const edges: FlowDesignerEdge[] = [
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
    const edges: FlowDesignerEdge[] = [
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

// ── #2670 Phase 2: geometry-aware layered layout ─────────────────────────────

/** heightOf making exactly one node tall — the expanded-container shape. */
const tallOnly = (id: string, h: number) => (n: FlowDesignerNode) => (n.id === id ? h : NODE_H);

describe('computeLayoutWithGeometry — constant-height invariance (the regression lock)', () => {
  const GRAPHS: { name: string; nodes: FlowDesignerNode[]; edges: FlowDesignerEdge[] }[] = [
    {
      name: 'linear chain',
      nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'script' }, { id: 'e', type: 'end' }],
      edges: [{ source: 's', target: 'a' }, { source: 'a', target: 'e' }],
    },
    {
      name: 'diamond branch + join',
      nodes: [
        { id: 's', type: 'start' },
        { id: 'l', type: 'script' },
        { id: 'r', type: 'script' },
        { id: 'j', type: 'end' },
      ],
      edges: [
        { source: 's', target: 'l' },
        { source: 's', target: 'r' },
        { source: 'l', target: 'j' },
        { source: 'r', target: 'j' },
      ],
    },
    {
      name: 'declared back-edge (ADR-0044)',
      nodes: [{ id: 's', type: 'start' }, { id: 'a', type: 'approval' }, { id: 'w', type: 'wait' }],
      edges: [
        { source: 's', target: 'a' },
        { source: 'a', target: 'w', label: 'revise' },
        { source: 'w', target: 'a', label: 'resubmit', type: 'back' },
      ],
    },
    {
      name: 'unreached cycle island (trailing layers)',
      nodes: [
        { id: 's', type: 'start' },
        { id: 'a', type: 'script' },
        { id: 'c1', type: 'script' },
        { id: 'c2', type: 'script' },
      ],
      edges: [
        { source: 's', target: 'a' },
        { source: 'c1', target: 'c2' },
        { source: 'c2', target: 'c1' },
      ],
    },
    {
      name: 'manual position (spec-canonical)',
      nodes: [
        { id: 's', type: 'start' },
        { id: 'pin', type: 'script', position: { x: 400, y: 10 } },
        { id: 'e', type: 'end' },
      ],
      edges: [{ source: 's', target: 'pin' }, { source: 'pin', target: 'e' }],
    },
    {
      name: 'manual position (legacy `ui`, read-compat)',
      nodes: [
        { id: 's', type: 'start' },
        { id: 'pin', type: 'script', ui: { x: 400, y: 10 } },
        { id: 'e', type: 'end' },
      ],
      edges: [{ source: 's', target: 'pin' }, { source: 'pin', target: 'e' }],
    },
  ];

  for (const g of GRAPHS) {
    it(`matches computeLayout + diagramSize on: ${g.name}`, () => {
      const geo = computeLayoutWithGeometry(g.nodes, g.edges);
      expect(geo.positions).toEqual(computeLayout(g.nodes, g.edges));
      expect(geo.size).toEqual(diagramSize(geo.positions));
      for (const n of g.nodes) expect(geo.heights.get(n.id)).toBe(NODE_H);
    });
  }
});

describe('computeLayoutWithGeometry — cumulative variable-height offsets (#2670)', () => {
  const chain: { nodes: FlowDesignerNode[]; edges: FlowDesignerEdge[] } = {
    nodes: [{ id: 's', type: 'start' }, { id: 'c', type: 'loop' }, { id: 'b', type: 'end' }],
    edges: [{ source: 's', target: 'c' }, { source: 'c', target: 'b' }],
  };

  it('pushes the layer below a tall card down by its full height', () => {
    const geo = computeLayoutWithGeometry(chain.nodes, chain.edges, tallOnly('c', 200));
    const s = geo.positions.get('s')!;
    const c = geo.positions.get('c')!;
    const b = geo.positions.get('b')!;
    expect(c.y - s.y).toBe(NODE_H + V_GAP); // layer above the tall card: unchanged pitch
    expect(b.y - c.y).toBe(200 + V_GAP); // layer below: pushed by the tall card
  });

  it('same-layer siblings share y; the row is as tall as its tallest card', () => {
    const nodes: FlowDesignerNode[] = [
      { id: 's', type: 'start' },
      { id: 'l', type: 'loop' },
      { id: 'r', type: 'script' },
      { id: 'j', type: 'end' },
    ];
    const edges: FlowDesignerEdge[] = [
      { source: 's', target: 'l' },
      { source: 's', target: 'r' },
      { source: 'l', target: 'j' },
      { source: 'r', target: 'j' },
    ];
    const geo = computeLayoutWithGeometry(nodes, edges, tallOnly('l', 200));
    expect(geo.positions.get('l')!.y).toBe(geo.positions.get('r')!.y);
    expect(geo.positions.get('j')!.y - geo.positions.get('l')!.y).toBe(200 + V_GAP);
  });

  it('size.height accounts for a tall bottom card', () => {
    const geo = computeLayoutWithGeometry(chain.nodes, chain.edges, tallOnly('b', 200));
    expect(geo.size.height).toBe(geo.positions.get('b')!.y + 200 + PADDING);
  });

  it('a manually-pinned tall node does not push auto rows (accepted-overlap rule)', () => {
    const nodes: FlowDesignerNode[] = [
      { id: 's', type: 'start' },
      { id: 'pin', type: 'loop', position: { x: 400, y: 10 } },
      { id: 'e', type: 'end' },
    ];
    const edges: FlowDesignerEdge[] = [{ source: 's', target: 'pin' }, { source: 'pin', target: 'e' }];
    const tall = computeLayoutWithGeometry(nodes, edges, tallOnly('pin', 300));
    const constant = computeLayoutWithGeometry(nodes, edges);
    expect(tall.positions.get('s')).toEqual(constant.positions.get('s'));
    expect(tall.positions.get('e')).toEqual(constant.positions.get('e'));
    expect(tall.heights.get('pin')).toBe(300); // still reported for rendering/size
  });
});

describe('bottomAnchor with explicit height (#2670)', () => {
  it('anchors at the true bottom of a tall card', () => {
    expect(bottomAnchor({ x: 10, y: 20 }, 200)).toEqual({ x: 10 + NODE_W / 2, y: 220 });
  });
});

// ── objectui#3172: node geometry IS the spec's `FlowNode.position` ───────────

describe('manualPosition — `position` is canonical, `ui` is legacy read-only', () => {
  it('reads the spec-canonical `position`', () => {
    expect(manualPosition({ id: 'n', type: 'script', position: { x: 12, y: 34 } })).toEqual({ x: 12, y: 34 });
  });

  it('falls back to a legacy `ui` so stored flows still open pinned', () => {
    expect(manualPosition({ id: 'n', type: 'script', ui: { x: 12, y: 34 } })).toEqual({ x: 12, y: 34 });
  });

  it('prefers `position` when a legacy node carries both', () => {
    expect(
      manualPosition({ id: 'n', type: 'script', position: { x: 1, y: 2 }, ui: { x: 90, y: 90 } }),
    ).toEqual({ x: 1, y: 2 });
  });

  it('is null unless BOTH coordinates are finite (either spelling)', () => {
    expect(manualPosition({ id: 'n', type: 'script' })).toBeNull();
    expect(manualPosition({ id: 'n', type: 'script', ui: { x: 400 } })).toBeNull();
    expect(manualPosition({ id: 'n', type: 'script', ui: { y: 400 } })).toBeNull();
    expect(manualPosition({ id: 'n', type: 'script', position: { x: NaN, y: 1 } })).toBeNull();
    // A half-position must not shadow a usable legacy one either.
    expect(
      manualPosition({ id: 'n', type: 'script', position: { x: 5 } as never, ui: { x: 7, y: 8 } }),
    ).toEqual({ x: 7, y: 8 });
    expect(hasManualPosition({ id: 'n', type: 'script', ui: { x: 400 } })).toBe(false);
    expect(hasManualPosition({ id: 'n', type: 'script', position: { x: 4, y: 0 } })).toBe(true);
  });

  it('pins a legacy node at exactly the same point as the canonical spelling', () => {
    const edges: FlowDesignerEdge[] = [{ source: 's', target: 'pin' }];
    const legacy = computeLayout(
      [{ id: 's', type: 'start' }, { id: 'pin', type: 'script', ui: { x: 400, y: 10 } }],
      edges,
    );
    const canonical = computeLayout(
      [{ id: 's', type: 'start' }, { id: 'pin', type: 'script', position: { x: 400, y: 10 } }],
      edges,
    );
    expect(legacy.get('pin')).toEqual({ x: 400, y: 10 });
    expect(legacy).toEqual(canonical);
  });
});

describe('withCanonicalGeometry — migrate-on-write (the strict-schema gate)', () => {
  it('lifts a legacy `ui` onto `position` and drops the `ui` key', () => {
    const out = withCanonicalGeometry([{ id: 'n', type: 'script', ui: { x: 7, y: 9 } }]);
    expect(out[0]).toEqual({ id: 'n', type: 'script', position: { x: 7, y: 9 } });
    expect('ui' in out[0]).toBe(false);
  });

  it('keeps an existing `position` and still drops a stale `ui`', () => {
    const out = withCanonicalGeometry([
      { id: 'n', type: 'script', position: { x: 1, y: 2 }, ui: { x: 90, y: 90 } },
    ]);
    expect(out[0].position).toEqual({ x: 1, y: 2 });
    expect('ui' in out[0]).toBe(false);
  });

  it('drops an unusable `ui` without inventing a position', () => {
    const out = withCanonicalGeometry([{ id: 'n', type: 'script', ui: { x: 5 } }]);
    expect(out[0]).toEqual({ id: 'n', type: 'script' });
  });

  it('preserves every other key, including ones the canvas does not understand', () => {
    const out = withCanonicalGeometry([
      {
        id: 'n',
        type: 'http',
        label: 'Call',
        config: { url: 'https://x' },
        connectorConfig: { connectorId: 'c', actionId: 'a' },
        ui: { x: 3, y: 4 },
      },
    ]);
    expect(out[0]).toEqual({
      id: 'n',
      type: 'http',
      label: 'Call',
      config: { url: 'https://x' },
      connectorConfig: { connectorId: 'c', actionId: 'a' },
      position: { x: 3, y: 4 },
    });
  });

  it('returns the SAME array when nothing needs migrating (memo identity)', () => {
    const nodes: FlowDesignerNode[] = [
      { id: 's', type: 'start' },
      { id: 'n', type: 'script', position: { x: 1, y: 2 } },
    ];
    expect(withCanonicalGeometry(nodes)).toBe(nodes);
    // …and it is idempotent: migrating twice is migrating once.
    const once = withCanonicalGeometry([{ id: 'n', type: 'script', ui: { x: 7, y: 9 } }]);
    expect(withCanonicalGeometry(once)).toBe(once);
  });
});
