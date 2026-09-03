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
 * The renderer then passed the authored value through untouched — and that
 * pass-through measured the key on all four of its contracts, finding three
 * answers (objectui#7129). `@objectstack/spec` REFUSES `hideEmpty` on a
 * `record:details` section, so on any spec-validated page it never reached the
 * renderer at all; the "author escape hatch" existed only where nothing
 * validated. The maintainer converged the four on the spec's answer
 * (2026-09-01): the declaration is RETIRED and `DetailSection`'s heuristic is
 * the whole contract.
 *
 * These pins hold both halves of that contract:
 *   - the default is the heuristic's, not the renderer's — unchanged, and the
 *     three cases below are exactly the ones #7064 landed;
 *   - an authored `hideEmpty` of EITHER polarity is now INERT. Its describe
 *     block is RESTATED, not deleted (ruling clause 4): the same fixtures and
 *     the same controls now assert the key does nothing, which is what proves
 *     the heuristic survived the retirement intact.
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

describe('record:details — an authored `hideEmpty` is INERT: the key is retired (#7129)', () => {
  /**
   * The fixtures below are #7064's, unchanged, and so are their controls. What
   * moved is the verdict: each now asserts the render the UNAUTHORED heuristic
   * produces, so a reader can see that reintroducing a read of the key would
   * have to break one of them.
   */
  it('`hideEmpty: true` no longer hides an all-empty section — the skeleton renders', () => {
    renderDetails({
      sections: [
        { name: 'deal_terms', label: 'Deal Terms', fields: ['stage', 'amount', 'close_date', 'next_step'], hideEmpty: true },
        // CONTROL, kept from #7064: a sibling section that MUST render, so the
        // presences below are a decision about `hideEmpty` and not an artefact
        // of a render that never happened.
        { name: 'firmographics', label: 'Firmographics', fields: ['industry'] },
      ],
    });

    expect(screen.getByText('Firmographics')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();

    // Under the retired key this section vanished. The heuristic reserves the
    // all-empty case, and it is now the only thing deciding.
    expect(screen.getByText('Deal Terms')).toBeInTheDocument();
    for (const label of ['stage', 'amount', 'close_date', 'next_step']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(emptyPlaceholders()).toHaveLength(4);
  });

  it('`hideEmpty: true` no longer hides the empty rows of a small partly-filled section', () => {
    // 2 fields, 1 empty — below the auto-hide minimum in both threshold
    // variants (4 desktop / 3 mobile), so nothing hides the row any more.
    renderDetails({
      sections: [
        { name: 'summary', label: 'Summary', fields: ['industry', 'stage'], hideEmpty: true },
      ],
    });

    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.getByText('stage')).toBeInTheDocument();
    expect(emptyPlaceholders()).toHaveLength(1);
  });

  it('the three spellings — absent, `true`, `false` — render the SAME section', () => {
    // The retirement stated as one assertion: on a fixture at/above both
    // thresholds (4 fields, 3 empty, 1 filled) the auto-hide heuristic fires
    // and the authored key changes nothing in either direction. Under the old
    // read, `true` and the absent case agreed here while `false` was "not
    // true" — the paradox #7129 dissolved by removing the key.
    const fields = ['industry', 'stage', 'amount', 'close_date'];
    const renderedFor = (section: Record<string, unknown>) => {
      const view = renderDetails({ sections: [{ name: 'deal_terms', label: 'Deal Terms', fields, ...section }] });
      const shown = {
        filled: screen.queryAllByText('Manufacturing').length,
        emptyLabel: screen.queryAllByText('stage').length,
        placeholders: emptyPlaceholders().length,
        toggle: screen.queryAllByRole('button', { name: /empty fields/i }).length,
      };
      view.unmount();
      return shown;
    };

    const absent = renderedFor({});
    // The live control: the fixture really is one the heuristic acts on, so
    // "all three agree" is not three renders that all did nothing.
    expect(absent).toEqual({ filled: 1, emptyLabel: 0, placeholders: 0, toggle: 1 });

    expect(renderedFor({ hideEmpty: true })).toEqual(absent);
    expect(renderedFor({ hideEmpty: false })).toEqual(absent);
  });
});
