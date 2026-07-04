// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchFlowRuns, errorText } from './FlowRunsPanel';

const RUN = {
  id: 'run-1',
  status: 'completed',
  startedAt: '2026-06-01T10:00:00Z',
  durationMs: 42,
  steps: [{ nodeId: 'start', nodeType: 'start', status: 'success' }],
};

function mockFetch(impl: (url: string) => Promise<Response> | Response) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => impl(String(url))));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchFlowRuns', () => {
  it('parses the dispatcher envelope ({ data: { runs } })', async () => {
    mockFetch(() => new Response(JSON.stringify({ success: true, data: { runs: [RUN] } }), { status: 200 }));
    const runs = await fetchFlowRuns('escalation_flow');
    expect(runs).toEqual([RUN]);
  });

  it('accepts a bare { runs } payload (older backend)', async () => {
    mockFetch(() => new Response(JSON.stringify({ runs: [RUN] }), { status: 200 }));
    expect(await fetchFlowRuns('escalation_flow')).toEqual([RUN]);
  });

  it('URL-encodes the flow name and requests the automation runs route', async () => {
    let requested = '';
    mockFetch((url) => {
      requested = url;
      return new Response(JSON.stringify({ data: { runs: [] } }), { status: 200 });
    });
    await fetchFlowRuns('my flow/v2');
    expect(requested).toContain('/automation/my%20flow%2Fv2/runs');
  });

  it('returns null (degrade, not throw) on 404/501 and on network failure', async () => {
    mockFetch(() => new Response('not found', { status: 404 }));
    expect(await fetchFlowRuns('missing')).toBeNull();

    mockFetch(() => Promise.reject(new Error('offline')));
    expect(await fetchFlowRuns('missing')).toBeNull();
  });

  it('returns null when the payload has no runs array', async () => {
    mockFetch(() => new Response(JSON.stringify({ data: {} }), { status: 200 }));
    expect(await fetchFlowRuns('empty')).toBeNull();
  });
});

describe('errorText', () => {
  it('reads a plain-string error (the engine run-level shape)', () => {
    // Regression: the engine sends `ExecutionLog.error` as a string; the panel
    // previously read `.message` off it and dropped the failure reason.
    expect(errorText("Node 'guarded_push' failed: catch region failed")).toBe(
      "Node 'guarded_push' failed: catch region failed",
    );
  });

  it('reads a { message } object error (the step-level shape)', () => {
    expect(errorText({ code: 'E_BOOM', message: 'kaboom' })).toBe('kaboom');
  });

  it('is empty for no error / empty string / message-less object', () => {
    expect(errorText(undefined)).toBeUndefined();
    expect(errorText(null)).toBeUndefined();
    expect(errorText('')).toBeUndefined();
    expect(errorText({ code: 'E' })).toBeUndefined();
  });
});
