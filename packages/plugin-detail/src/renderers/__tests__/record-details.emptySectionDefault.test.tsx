/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `record:details` — who owns the empty-section default (objectui#7064).
 *
 * `RecordDetailsRenderer` used to map every authored section with
 * `hideEmpty: s.hideEmpty ?? true`. That forced default overrode the one case
 * `DetailSection`'s own heuristic explicitly reserves:
 *
 *   "If a section is entirely empty (e.g., loading state, brand-new record),
 *    do NOT auto-hide — the labels themselves are useful as a structural
 *    skeleton."
 *
 * With the force in place an all-empty section took `DetailSection`'s
 * all-fields-hidden early return instead, so a hand-created record lost whole
 * sections and collapsed to a two-row body, and every application had to
 * hand-write `hideEmpty: false` per section to stop looking broken — per-app
 * tax for a platform concern (maintainer ruling 2026-08-31).
 *
 * The renderer now passes the authored value through untouched. These pins
 * hold both halves of that contract:
 *   - the UNAUTHORED default is the heuristic's, not the renderer's;
 *   - an AUTHORED value keeps its exact former meaning.
 *
 * Deliberately no i18n provider: `fieldLabel` falls back to the value the
 * renderer hands it, which for the spec's bare-string section fields is the
 * field NAME. So the "labels" a skeleton shows here read as field names — the
 * same DOM nodes a translated app fills with translated labels.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { RecordContextProvider } from '@object-ui/react';
import { RecordDetailsRenderer } from '../record-details';

/**
 * No `name` / `title` / `subject` / `display_name` key anywhere: the renderer
 * drops the page-H1 title field from the body (`titleCandidates`), which would
 * make an absence assertion below pass for the wrong reason.
 */
const objectSchema = {
  fields: {
    industry: { type: 'text', label: 'Industry' },
    stage: { type: 'text', label: 'Stage' },
    amount: { type: 'text', label: 'Amount' },
    close_date: { type: 'text', label: 'Close Date' },
    next_step: { type: 'text', label: 'Next Step' },
  },
};

/** A hand-created sparse record: one filled field, everything else unwritten. */
const sparseData = { industry: 'Manufacturing' };

const renderDetails = (schema: Record<string, unknown>, data: Record<string, unknown> = sparseData) =>
  render(
    <RecordContextProvider
      objectName="crm_opportunity"
      recordId="O1"
      data={data}
      objectSchema={objectSchema}
    >
      <RecordDetailsRenderer schema={schema as any} />
    </RecordContextProvider>,
  );

/** The empty-value placeholder `DetailSection` draws for a field with no value. */
const emptyPlaceholders = () => screen.queryAllByTitle('No value');

describe('record:details — the UNAUTHORED empty-section default is DetailSection\'s heuristic (#7064)', () => {
  it('an ALL-empty section renders its skeleton: heading, every field label, an empty placeholder each', () => {
    renderDetails({
      sections: [
        { name: 'deal_terms', label: 'Deal Terms', fields: ['stage', 'amount', 'close_date', 'next_step'] },
      ],
    });

    // The heading survives — the whole section used to disappear here.
    expect(screen.getByText('Deal Terms')).toBeInTheDocument();

    // Every field keeps its row, so the record reads as a structure waiting to
    // be filled rather than as a blank page.
    for (const label of ['stage', 'amount', 'close_date', 'next_step']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(emptyPlaceholders()).toHaveLength(4);
  });

  it('a SMALL partly-empty section (below the auto-hide threshold) now shows its empty row', () => {
    // 2 fields, 1 empty: under DetailSection's minimum field count in both the
    // desktop (4) and mobile (3) variant, so the auto-hide heuristic never
    // fires and the empty row is shown. Under the old forced default this row
    // was hidden. This is the second half of the user-visible behaviour change
    // the changeset names — it is not limited to all-empty sections.
    renderDetails({
      sections: [
        { name: 'summary', label: 'Summary', fields: ['industry', 'stage'] },
      ],
    });

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.getByText('stage')).toBeInTheDocument();
    expect(emptyPlaceholders()).toHaveLength(1);
  });

  it('the label-graveyard guard is INTACT: a large mostly-empty section still auto-hides', () => {
    // 4 fields, 3 empty, 1 filled — at/above both threshold variants
    // (min fields 4/3, empty ratio 25%/20%) with at least one filled row, so
    // `shouldAutoHideEmpty` still fires exactly as before. Flipping the
    // unauthored default did NOT turn populated pages into label graveyards;
    // it only stopped overriding the all-empty case the heuristic reserves.
    renderDetails({
      sections: [
        {
          name: 'deal_terms',
          label: 'Deal Terms',
          fields: ['industry', 'stage', 'amount', 'close_date'],
        },
      ],
    });

    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.queryByText('stage')).not.toBeInTheDocument();
    expect(emptyPlaceholders()).toHaveLength(0);
    // …and the user-facing escape hatch is offered for the rows it hid.
    expect(screen.getByRole('button', { name: /empty fields/i })).toBeInTheDocument();
  });
});

describe('record:details — an AUTHORED `hideEmpty` keeps its exact former meaning (#7064)', () => {
  it('`hideEmpty: true` still hides an all-empty section entirely', () => {
    renderDetails({
      sections: [
        { name: 'deal_terms', label: 'Deal Terms', fields: ['stage', 'amount', 'close_date', 'next_step'], hideEmpty: true },
        // CONTROL: a sibling section that MUST render, so the absences below
        // are a decision by `hideEmpty` and not a render that never happened.
        { name: 'firmographics', label: 'Firmographics', fields: ['industry'] },
      ],
    });

    expect(screen.getByText('Firmographics')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();

    expect(screen.queryByText('Deal Terms')).not.toBeInTheDocument();
    expect(screen.queryByText('stage')).not.toBeInTheDocument();
    expect(emptyPlaceholders()).toHaveLength(0);
  });

  it('`hideEmpty: true` still hides the empty rows of a partly-filled section', () => {
    renderDetails({
      sections: [
        { name: 'summary', label: 'Summary', fields: ['industry', 'stage'], hideEmpty: true },
      ],
    });

    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.queryByText('stage')).not.toBeInTheDocument();
    expect(emptyPlaceholders()).toHaveLength(0);
  });

  it('`hideEmpty: false` shows the empty rows the heuristic would not have hidden anyway', () => {
    renderDetails({
      sections: [
        { name: 'summary', label: 'Summary', fields: ['industry', 'stage'], hideEmpty: false },
      ],
    });

    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.getByText('stage')).toBeInTheDocument();
    expect(emptyPlaceholders()).toHaveLength(1);
  });

  it('MEASURED, not endorsed: `hideEmpty: false` is "not true", NOT an override of the auto-hide heuristic', () => {
    // `DetailSection` computes `shouldAutoHideEmpty` from `!section.hideEmpty`,
    // so an authored `false` is indistinguishable from an unauthored section
    // and the heuristic still hides empty rows once the thresholds are met.
    // This is PRE-EXISTING and is NOT changed by #7064 — under the old forced
    // default the same fixture took the same path, because `?? true` preserved
    // an authored `false` too. Pinned so a future reader can see that the flip
    // left this precedence exactly where it found it; whether `false` SHOULD
    // become a hard override is a separate contract question.
    renderDetails({
      sections: [
        {
          name: 'deal_terms',
          label: 'Deal Terms',
          fields: ['industry', 'stage', 'amount', 'close_date'],
          hideEmpty: false,
        },
      ],
    });

    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.queryByText('stage')).not.toBeInTheDocument();
    expect(emptyPlaceholders()).toHaveLength(0);
  });
});
