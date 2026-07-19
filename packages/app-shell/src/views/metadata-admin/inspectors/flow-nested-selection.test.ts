// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  NESTED_NODE_KIND,
  encodeNestedNodeId,
  parseNestedNodeId,
  regionConfigPathOf,
  regionLabelOf,
  type NestedNodePath,
} from './flow-nested-selection';
import { extractRegions, type FlowNode } from '../previews/flow-canvas-layout';

describe('flow-nested-selection — id codec', () => {
  it('exports a stable, distinct selection kind', () => {
    expect(NESTED_NODE_KIND).toBe('nested-node');
  });

  it('round-trips a body / branch / try / catch path', () => {
    const paths: NestedNodePath[] = [
      { containerId: 'each', regionKey: 'body', nodeId: 'charge' },
      { containerId: 'fan', regionKey: 'branch-7', nodeId: 'notify' },
      { containerId: 'guard', regionKey: 'try', nodeId: 'call' },
      { containerId: 'guard', regionKey: 'catch', nodeId: 'rollback' },
    ];
    for (const p of paths) {
      expect(parseNestedNodeId(encodeNestedNodeId(p))).toEqual(p);
    }
  });

  it('rejects a plain (non-nested) id and an unknown region token', () => {
    expect(parseNestedNodeId('plainNode')).toBeNull();
    expect(parseNestedNodeId('c::bogus::n')).toBeNull(); // region not in the closed set
    expect(parseNestedNodeId('c::body')).toBeNull(); // no node segment
    expect(parseNestedNodeId('c::branch-x::n')).toBeNull(); // branch index not numeric
  });

  it('tolerates a `::`-bearing node id (the anchored middle keeps the split deterministic)', () => {
    // A mis-split can only ever mis-name a segment — locateFlowNode matches each
    // against the draft, so a wrong split resolves to "not found", never a write.
    const parsed = parseNestedNodeId('c::body::a::b');
    expect(parsed).toEqual({ containerId: 'c', regionKey: 'body', nodeId: 'a::b' });
  });
});

describe('flow-nested-selection — region config path + label', () => {
  it('maps region keys to their structured config location', () => {
    expect(regionConfigPathOf('body')).toEqual({ kind: 'key', key: 'body' });
    expect(regionConfigPathOf('try')).toEqual({ kind: 'key', key: 'try' });
    expect(regionConfigPathOf('catch')).toEqual({ kind: 'key', key: 'catch' });
    expect(regionConfigPathOf('branch-3')).toEqual({ kind: 'branch', index: 3 });
    expect(regionConfigPathOf('bogus')).toBeNull();
  });

  it('labels regions, reading a parallel branch name (or its 1-based fallback) off the container', () => {
    const parallel = {
      id: 'p',
      type: 'parallel',
      config: { branches: [{ name: 'Slack', nodes: [], edges: [] }, { nodes: [], edges: [] }] },
    };
    expect(regionLabelOf('body')).toBe('Body');
    expect(regionLabelOf('try')).toBe('Try');
    expect(regionLabelOf('catch')).toBe('Catch');
    expect(regionLabelOf('branch-0', parallel)).toBe('Slack'); // authored name
    expect(regionLabelOf('branch-1', parallel)).toBe('Branch 2'); // unnamed → 1-based
    expect(regionLabelOf('branch-5')).toBe('Branch 6'); // no container → fallback
  });

  /**
   * Anti-drift: every region key `extractRegions` can emit must be resolvable by
   * both regionConfigPathOf and regionLabelOf — the codec and the canvas layout
   * must never disagree on the set of region keys.
   */
  it('resolves every key extractRegions emits (loop / parallel / try_catch)', () => {
    const containers: FlowNode[] = [
      { id: 'each', type: 'loop', config: { body: { nodes: [{ id: 'x', type: 'http' }], edges: [] } } },
      {
        id: 'fan',
        type: 'parallel',
        config: {
          branches: [
            { name: 'A', nodes: [{ id: 'a', type: 'http' }], edges: [] },
            { nodes: [{ id: 'b', type: 'http' }], edges: [] },
          ],
        },
      },
      {
        id: 'guard',
        type: 'try_catch',
        config: { try: { nodes: [{ id: 't', type: 'http' }], edges: [] }, catch: { nodes: [{ id: 'c', type: 'http' }], edges: [] } },
      },
    ];
    for (const container of containers) {
      for (const region of extractRegions(container)) {
        expect(regionConfigPathOf(region.key)).not.toBeNull();
        const label = regionLabelOf(region.key, container);
        // extractRegions leaves a loop body header-less; regionLabelOf still
        // names it 'Body' for the breadcrumb. Every other region's label matches.
        expect(label).toBe(region.label ?? 'Body');
      }
    }
  });
});
