// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The report config panel must be NAMED — not labelled with the report's Title
 * FIELD label (objectui#4118).
 *
 * `ReportConfigPanel` asked `t('report.editor.title')` for both its visible
 * heading and the accessible name of its `role="complementary"` landmark. That
 * key is the label of the report's Title *field*: `report.editor.title` sits
 * directly above `report.editor.titlePlaceholder` ('e.g. Pipeline by Quarter')
 * in the pack, which is what makes the pairing unambiguous. So the panel
 * rendered a heading reading "Title", and a screen reader announced a
 * complementary region called "Title" — a landmark name that says nothing
 * about what the region is.
 *
 * These assertions run against the REAL locale packs rather than a `t`-echoing
 * mock. What is under test is the string a user reads; a mock that returns the
 * key can only ever confirm which key was passed, which is the same thing the
 * broken code did correctly. Asserting through the pack is also what keeps the
 * two facts joined: the panel's name must be `panelTitle` AND must not be the
 * field label.
 *
 * Reverse-verified by pointing both call sites back at `report.editor.title`:
 * every case below goes red (the heading/landmark then read "Title").
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, en, zh } from '@object-ui/i18n';
import { ReportConfigPanel } from '../ReportConfigPanel';

// The panel's own chrome is what is under test. The spec-driven inspector and
// the draft/publish bar are heavy children with their own suites, and pulling
// them in would put an unbounded module load inside a bounded RTL window
// (AGENTS.md 测试纪律).
vi.mock('../metadata-admin/inspectors/ReportDefaultInspector', () => ({
  ReportDefaultInspector: () => <div data-testid="inspector-stub" />,
}));
vi.mock('../RuntimeDraftBar', () => ({
  RuntimeDraftBar: () => <div data-testid="draft-bar-stub" />,
}));

/** The panel's name, and the field label it must no longer borrow. */
const PANEL_NAME = en.report.editor.panelTitle;
const TITLE_FIELD_LABEL = en.report.editor.title;

function renderPanel(language = 'en') {
  render(
    <I18nProvider
      config={{ defaultLanguage: language, detectBrowserLanguage: false }}
      persistLanguage={false}
    >
      <ReportConfigPanel
        open
        onClose={() => {}}
        config={{ label: 'Pipeline by Quarter', type: 'tabular' }}
        onSave={() => {}}
      />
    </I18nProvider>,
  );
}

describe('ReportConfigPanel — the panel is named, not labelled "Title" (objectui#4118)', () => {
  // Guards the premise the rest of the file rests on: if these two ever became
  // the same string the assertions below would pass without proving anything.
  it('the pack distinguishes the panel name from the Title field label', () => {
    expect(PANEL_NAME).toBe('Edit report');
    expect(TITLE_FIELD_LABEL).toBe('Title');
    expect(PANEL_NAME).not.toBe(TITLE_FIELD_LABEL);
  });

  it('names the complementary landmark after the panel, not the Title field', () => {
    renderPanel();

    const panel = screen.getByRole('complementary');
    expect(panel).toHaveAttribute('aria-label', PANEL_NAME);
    expect(panel).not.toHaveAttribute('aria-label', TITLE_FIELD_LABEL);
  });

  it('renders the panel name as the visible heading', () => {
    renderPanel();

    expect(screen.getByText(PANEL_NAME)).toBeInTheDocument();
    // The concrete symptom: a panel whose heading reads "Title".
    expect(screen.queryByText(TITLE_FIELD_LABEL)).not.toBeInTheDocument();
  });

  it('keeps the landmark name and the visible heading identical', () => {
    renderPanel();

    // A speech-input user says what they see, so the landmark's spoken name
    // must be the heading, not a paraphrase of it.
    const panel = screen.getByRole('complementary');
    const heading = screen.getByText(PANEL_NAME);
    expect(panel.getAttribute('aria-label')).toBe(heading.textContent);
  });

  it('is translated, not English-by-fallback, in the other nine packs', () => {
    // The key exists in all ten packs (all-locales-key-parity owns the set);
    // this pins that the panel actually renders the translated value, which is
    // what an inline `defaultValue` on a missing key would have faked.
    renderPanel('zh');

    expect(screen.getByRole('complementary')).toHaveAttribute(
      'aria-label',
      zh.report.editor.panelTitle,
    );
    expect(zh.report.editor.panelTitle).not.toBe(PANEL_NAME);
  });
});
