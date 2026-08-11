/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `record:details` — what chooses the detail body (objectui#3818).
 *
 * The positive control for the `layout` retirement. `record:details` published
 * `layout: enum ['auto','custom']` describing itself as the body selector
 * ("auto uses the object highlightFields; custom uses explicit sections"), but
 * the renderer's only read tested `'inline'` | `'compact'` — values the schema
 * never permitted — so both legal values took the same branch and the key
 * selected nothing. @objectstack/spec 17.0.0 removed it (objectstack#6946,
 * ADR-0087 D2) and objectui#3818 removes the input and the dead branch here.
 *
 * Deleting a selector is only safe if the REAL selector is pinned, so this
 * file pins the contract that was doing the work all along and is now the
 * documented one: **what you author decides the body.** `sections` renders the
 * explicit groups (the old `custom`); omitting it falls back to the flat body
 * (the old `auto`). Both directions, because the failure this guards is a body
 * that silently comes up wrong — or blank — with no diagnostic anywhere.
 *
 * WHY THERE IS NO "authoring `layout` changes nothing" ASSERTION HERE. It
 * would be vacuous, and the measurement that says so is worth recording: the
 * deleted branch fed `synthesized.layout`, and `DetailView` never reads
 * `layout` at all (no read site in the file, and it does not spread the schema
 * onward). So the branch was dead TWICE — retired vocabulary AND ignored
 * consumer — and restoring it changes no rendered output. A DOM-equality pin
 * would therefore stay green through the exact regression it appears to guard.
 * The read point is pinned where it can actually go red: the source-text and
 * published-surface assertions in `recordDetailsInputs.spec-parity.test.ts`.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { RecordContextProvider } from '@object-ui/react';
import { RecordDetailsRenderer } from '../renderers/record-details';

/**
 * No `name` / `title` / `display_name` in the data on purpose: the renderer
 * drops the page-H1 title field from the body (`titleCandidates`), and a
 * fixture that tripped that would make an absence assertion below pass for the
 * wrong reason.
 */
const objectSchema = {
  fields: {
    phone: { type: 'text', label: 'Phone' },
    email: { type: 'text', label: 'Email' },
    industry: { type: 'text', label: 'Industry' },
  },
};

const data = {
  phone: '555-0100',
  email: 'ops@acme.test',
  industry: 'Manufacturing',
};

const renderDetails = (schema: Record<string, unknown>) =>
  render(
    <RecordContextProvider
      objectName="crm_account"
      recordId="A1"
      data={data}
      objectSchema={objectSchema}
    >
      <RecordDetailsRenderer schema={schema as any} />
    </RecordContextProvider>,
  );

describe('record:details — `sections` presence decides the body (#3818)', () => {
  it('renders the authored groups when `sections` is present (the old `custom`)', () => {
    renderDetails({
      sections: [
        { name: 'contact_info', label: 'Contact Info', fields: ['phone', 'email'] },
      ],
    });

    // The group heading and its fields are on screen...
    expect(screen.getByText('Contact Info')).toBeInTheDocument();
    expect(screen.getByText('555-0100')).toBeInTheDocument();
    expect(screen.getByText('ops@acme.test')).toBeInTheDocument();

    // ...and a field OUTSIDE every section is not, which is the half that
    // matters: once `sections` is authored it is the ONLY source of the body.
    // `industry` is present in both the object schema and the data, so its
    // absence is a decision by `sections`, not missing input.
    expect(screen.queryByText('Manufacturing')).not.toBeInTheDocument();
  });

  it('falls back to the flat field body when `sections` is absent (the old `auto`)', () => {
    renderDetails({ fields: ['industry'] });

    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    // No section chrome: the flat arm is a single unlabelled group, so the
    // heading from the other direction must not appear.
    expect(screen.queryByText('Contact Info')).not.toBeInTheDocument();
  });

  it('an empty `sections` array is not "sections authored" — the flat body still wins', () => {
    // The boundary between the two arms. `DetailView` gates the section arm on
    // `sections.length > 0` and the flat arm on `!sections?.length`, so the
    // empty array must behave as absence rather than blanking the body — the
    // blank-page failure mode this block exists to keep closed.
    renderDetails({ sections: [], fields: ['industry'] });

    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
  });
});
