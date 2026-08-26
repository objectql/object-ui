/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The default `fieldGroups` detail page renders its section HEADINGS — the
 * synth → renderer seam (objectui#6241).
 *
 * ## The gap this closes
 *
 * `buildDefaultPageSchema` synthesizes one detail section per declared
 * `fieldGroups` entry, and app-shell's `RecordDetailView` renders that output
 * as the default record page for every object that declares `fieldGroups` and
 * has no assigned page — i.e. every tenant that never authored one. Two suites
 * already sit on either side of that seam and NEITHER spans it:
 *
 * - `synth/__tests__/buildDefaultPageSchema.test.ts` asserts the synthesizer's
 *   RETURN VALUE. It never renders, so it cannot see the heading reaching (or
 *   failing to reach) the screen.
 * - the `record:details` renderer suites (e.g. `recordDetailsBodySource`)
 *   render HAND-AUTHORED section fixtures. They never consume synthesizer
 *   output, so they stay green while the synthesized page breaks.
 *
 * Measured on `9ea4cdee3`: with the consumer's read of the heading the
 * synthesizer emits removed, the whole `packages/plugin-detail/` suite —
 * 109 files / 1031 tests — still passed. The break is tenant-visible on a
 * default page path and produced zero test signal. This file is the pin that
 * makes it produce one; it has been observed RED in exactly that state (and
 * also with the PRODUCER's heading emptied instead, which is the same seam
 * broken from the other end).
 *
 * ## ⛔ What this file must never assert
 *
 * NOT the synthesizer's return value, and NOT a key spelling. objectui#6190 /
 * objectstack#11661 are deciding whether the section heading slot converges on
 * one spelling; this pin is deliberately INDEPENDENT of that outcome and must
 * stay so. So the expectation is the **rendered heading TEXT** — the label the
 * author declared on `fieldGroups[].label` — which is invariant under whichever
 * way that convergence rules. Nothing below may read `sections[i].title` or
 * `sections[i].label`; a future edit that reaches for either has re-encoded the
 * open question into this pin and should be rejected.
 *
 * The failure mode is worth naming precisely, because it is NOT a blank: when
 * the declared label stops reaching the renderer, the heading falls back to the
 * group's internal KEY (`_sections.<key>.label` misses, and the i18n fallback
 * is the key itself). A tenant sees `basic_info` where `Basic Information`
 * belongs — which is why the key assertion below is part of the pin.
 */

import * as React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { RecordContextProvider, SchemaRenderer } from '@object-ui/react';
// Module-scope side-effect imports: the registry must hold the page/record
// renderers and the field widgets they render into BEFORE the first render
// (AGENTS.md 测试纪律 — a lazily resolved registry entry races the assertion).
import '@object-ui/components';
import '@object-ui/fields';
import '../index';
import { buildDefaultPageSchema } from '../synth/buildDefaultPageSchema';

const OBJECT_NAME = 'crm_account';

/** What the AUTHOR declared — the only source of the expected heading text. */
const DECLARED_GROUPS = [
  { key: 'basic_info', label: 'Basic Information' },
  { key: 'financials', label: 'Financial Details' },
];

/**
 * An object declaring `fieldGroups` and NOTHING that would route around the
 * synthesizer: no page assignment (the caller below never provides one) and no
 * `sections` override.
 *
 * `highlightFields` is declared on purpose. Left undeclared, the synthesizer's
 * heuristic strip claims up to four fields and hands them to `record:details`
 * as `hideFields`, which would empty the very sections this file measures. One
 * declared, UNGROUPED highlight keeps the strip populated and every grouped
 * field in the body where it belongs.
 */
const objectDef = {
  name: OBJECT_NAME,
  label: 'Account',
  highlightFields: ['website'],
  fieldGroups: DECLARED_GROUPS,
  fields: {
    name: { label: 'Account Name', type: 'text' },
    website: { label: 'Website', type: 'url' },
    industry: { label: 'Industry', type: 'text', group: 'basic_info' },
    phone: { label: 'Phone', type: 'text', group: 'basic_info' },
    credit_terms: { label: 'Credit Terms', type: 'text', group: 'financials' },
  },
};

const RECORD = {
  id: 'A1',
  name: 'Acme Corporation',
  website: 'https://acme.test',
  industry: 'Manufacturing',
  phone: '555-0100',
  credit_terms: 'Net 30',
};

/** Collect every node of `type` in a page schema tree. */
function collectNodes(node: any, type: string, out: any[] = []): any[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const entry of node) collectNodes(entry, type, out);
    return out;
  }
  if (node.type === type) out.push(node);
  for (const value of Object.values(node)) collectNodes(value, type, out);
  return out;
}

/**
 * Render the default record detail page the way a tenant with no assigned page
 * gets it: the REAL `buildDefaultPageSchema` output, dispatched through the
 * REAL registry, inside the record context app-shell's `RecordDetailView`
 * provides. Returns the rendered `record:details` block so assertions are
 * scoped to the synthesized body rather than to page chrome that happens to
 * carry similar text.
 */
function renderDefaultPage(): HTMLElement {
  const page = buildDefaultPageSchema(objectDef as any);

  // Harness guard, not the pin: if the default page ever stops carrying a
  // single `record:details` node, every assertion below would go red for a
  // reason that has nothing to do with headings. Fail here instead, loudly.
  expect(
    collectNodes(page, 'record:details'),
    'the default page must carry exactly one `record:details` node',
  ).toHaveLength(1);

  const { container } = render(
    <RecordContextProvider
      objectName={OBJECT_NAME}
      recordId="A1"
      data={RECORD}
      objectSchema={objectDef}
    >
      <SchemaRenderer schema={page} />
    </RecordContextProvider>,
  );

  const block = container.querySelector<HTMLElement>('[data-obj-type="record:details"]');
  expect(block, 'the synthesized `record:details` node must render its own block').not.toBeNull();
  return block as HTMLElement;
}

afterEach(cleanup);

describe('default `fieldGroups` detail page — synthesized section headings reach the DOM (#6241)', () => {
  it('renders the declared heading text of every group inside the details block', () => {
    const block = renderDefaultPage();

    for (const group of DECLARED_GROUPS) {
      expect(within(block).getByText(group.label)).toBeInTheDocument();
    }
  });

  it('reads in declared order, each heading followed by its own group members', () => {
    const block = renderDefaultPage();

    // Heading, then that group's field labels, then the next heading. Asserted
    // on rendered text order, so it pins BOTH that each heading is on screen
    // and that it heads the group it was declared for — a heading rendered
    // without its members, or the groups collapsed into one, breaks this.
    const expectedReadingOrder = [
      'Basic Information', 'Industry', 'Phone',
      'Financial Details', 'Credit Terms',
    ];
    const text = block.textContent ?? '';
    const positions = expectedReadingOrder.map((needle) => text.indexOf(needle));

    expect(
      expectedReadingOrder.filter((_, i) => positions[i] < 0),
      'every heading and group member must be on screen',
    ).toEqual([]);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('never surfaces a group\'s internal key in place of its declared heading', () => {
    // The observed shape of the break, not a hypothetical one: when the
    // declared label stops reaching the renderer, the i18n section-label
    // lookup falls back to the group key and the tenant reads `basic_info`
    // as a section heading.
    const block = renderDefaultPage();

    for (const group of DECLARED_GROUPS) {
      expect(within(block).queryByText(group.key)).not.toBeInTheDocument();
    }
  });
});
