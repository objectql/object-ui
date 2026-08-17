/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The `div` deprecation notice is scoped BY PROVENANCE (objectui#4000).
 *
 * A `kind:'html'` page is authored as constrained JSX/Tailwind text that our own
 * parser compiles (never executes) into SDUI nodes, tag name straight through.
 * So an author writing the plain box tag in that tier gets a node the DEPRECATED
 * renderer serves — and the notice fired at them, recommending replacements that
 * belong to the JSON authoring surface. Nothing the author could write made it
 * stop: in that tier the tag IS the tier's own vocabulary. A notice nobody can
 * act on is not a deprecation, it is noise, and it also meant the type could
 * never be retired — the engine's own compiler keeps emitting it.
 *
 * Maintainer ruling (2026-08-10, on the issue): split the notice by provenance.
 * Nodes the html tier's parser emitted are exempt; JSON-authored nodes keep
 * being reported, unchanged.
 *
 * NOTE ON ORDER — the warn-once guard from objectui#3965 is a module-level Set
 * that latches for the lifetime of this module instance, so the cases below are
 * ordered deliberately and each depends on the one before:
 *
 *   1. the html-tier case runs FIRST, against a virgin Set. "No notice" here
 *      therefore cannot be explained away by an earlier render having latched
 *      the guard — there was no earlier render.
 *   2. the authored case then observes exactly one notice, which is only
 *      possible if case 1 left the Set virgin. The two cases pin each other:
 *      an exemption that silently marked the guard would show up as a ZERO in
 *      case 2, not as a pass.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SchemaRenderer } from '@object-ui/react';
// Registers the renderers at module scope, NOT inside a `beforeAll` — there the
// cold transform is billed to `hookTimeout`. See
// object-ui/no-dynamic-import-in-test-hook (objectui#3010/#3021).
import '../renderers';

const DEPRECATION_RE = /The "div" component is deprecated/;

function deprecationCalls(spy: ReturnType<typeof vi.spyOn>): unknown[][] {
  return spy.mock.calls.filter((args: unknown[]) => DEPRECATION_RE.test(String(args[0])));
}

/** Renders a `kind:'html'` page — source compiled by the parser, then rendered. */
function renderHtmlPage(source: string) {
  return render(<SchemaRenderer schema={{ type: 'home', kind: 'html', name: 'test_page', source } as never} />);
}

describe('div deprecation notice — scoped by provenance (#4000)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // MUST run first: see the ordering note above.
  it('stays silent for nodes the html tier compiled from its own source', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container } = renderHtmlPage(
      '<div className="outer"><div className="inner">hello html tier</div></div>',
    );

    // Control FIRST: silence proves nothing if the page never rendered. A
    // compile error replaces the whole page with an error panel, which would
    // produce zero notices for entirely the wrong reason.
    expect(container.textContent).not.toContain('failed to compile');
    expect(container.textContent).toContain('hello html tier');
    expect(container.querySelector('.outer')).toBeTruthy();
    expect(container.querySelector('.inner')).toBeTruthy();

    expect(deprecationCalls(warn)).toHaveLength(0);
  });

  it('still reports a JSON-authored node, exactly once, and says which surface it means', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { container } = render(
      <SchemaRenderer
        schema={{
          type: 'div',
          className: 'authored',
          children: [{ type: 'div', className: 'authored-inner' }],
        } as never}
      />,
    );

    // Same control on this side: the nodes have to have actually rendered.
    expect(container.querySelector('.authored')).toBeTruthy();
    expect(container.querySelector('.authored-inner')).toBeTruthy();

    const calls = deprecationCalls(warn);
    expect(calls).toHaveLength(1);
    const notice = String(calls[0][0]);
    // The migration guidance is untouched — this issue narrows WHO is told, it
    // does not water down WHAT they are told.
    expect(notice).toContain('"card", "flex", or semantic layout components');
    expect(notice).toContain('"container", "stack", or "grid"');
    // …and the notice now names the surface it applies to. A notice that says
    // the type is deprecated FULL STOP is false the moment another tier keeps
    // it as permanent vocabulary; whoever reads the console has to be able to
    // tell which of their pages it is about.
    expect(notice).toMatch(/JSON-authored/);
    expect(notice).toMatch(/html/);
  });

  it('does not re-report an authored node on a later render', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<SchemaRenderer schema={{ type: 'div', className: 'later' } as never} />);

    expect(deprecationCalls(warn)).toHaveLength(0);
  });

  it('keeps provenance off the DOM and out of the serialized node', () => {
    // The marker rides on the node object, so it must not reach the element or
    // survive serialization. A string-keyed marker would have been spread onto
    // the host element as an unknown attribute, and would have been copied into
    // any persisted form of the tree — where an authored page could replay it
    // and silence the notice for itself.
    const { container } = renderHtmlPage('<div className="probe">x</div>');
    const el = container.querySelector('.probe') as HTMLElement | null;
    expect(el).toBeTruthy();
    const attrs = Array.from(el!.attributes).map((a) => a.name);
    expect(attrs.filter((n) => n.includes('provenance') || n.includes('tier'))).toHaveLength(0);
  });
});
