/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Record Picker FILTER PANEL — select filter inputs carry the schema's options
 * (#3336).
 *
 * #3333 fixed the picker's table CELLS: they now format through the referenced
 * object's schema `fields` map (`fieldsMeta`) plus the shared i18n option
 * translation, so a `select` column renders the authored option label instead
 * of title-casing the raw stored value.
 *
 * The filter panel is the other face of the same widget and was still broken.
 * `LookupField` turns each typed picker column into a `RecordPickerFilterColumn`
 * (`{ field, label, type: 'select' }`) with no `options`, and the panel's select
 * input renders `col.options?.map(...)` — so the dropdown opened EMPTY and the
 * column could not be filtered at all.
 *
 * ## What these cases assert, and in which direction
 *
 * - **The two reproducers (`renderFilterBar` slot + built-in panel DOM) were
 *   RED before the fix**: `options` was `undefined` and the dropdown rendered
 *   zero `option` roles.
 * - **The parity case is the load-bearing one.** It asserts the filter option
 *   label and the table cell for the SAME field are the same translated string,
 *   under an `I18nProvider` that translates `fieldOptions.<obj>.<field>.<value>`.
 *   That is what pins "one source" rather than "two derivations that happen to
 *   agree today" — a second, filter-only derivation reading `meta.options`
 *   directly would satisfy the label assertions but not this one.
 * - **Two cases are deliberate NO-OP pins, green before and after** (called out
 *   individually below): a schema field with no `options` still yields an empty
 *   dropdown (the fix adds no consumer-side leniency — no options synthesised
 *   from the loaded page's raw values), and explicitly authored filter options
 *   keep winning over the schema (including the `in`-operator options
 *   auto-derived from `lookupFilters`). They guard the precedence and the
 *   non-leniency the fix chose, not a defect it repaired.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nProvider } from '@object-ui/i18n';
import { RecordPickerDialog } from './RecordPickerDialog';
import type { RecordPickerFilterBarProps } from './RecordPickerDialog';
import { LookupField } from './LookupField';
import { getCellRenderer } from '../index';

// Radix Select opens on pointer events happy-dom/jsdom do not implement.
beforeAll(() => {
  class MockPointerEvent extends Event {
    button: number;
    ctrlKey: boolean;
    pointerType: string;
    constructor(type: string, props: any = {}) {
      super(type, props);
      this.button = props.button ?? 0;
      this.ctrlKey = props.ctrlKey ?? false;
      this.pointerType = props.pointerType ?? 'mouse';
    }
  }
  (window as any).PointerEvent = MockPointerEvent;
  (HTMLElement.prototype as any).hasPointerCapture = vi.fn();
  (HTMLElement.prototype as any).releasePointerCapture = vi.fn();
  (HTMLElement.prototype as any).scrollIntoView = vi.fn();
});

const projects = [
  { id: 'p1', name: 'Line A retooling', project_phase: 'manufacturing' },
];

/** The referenced object's schema `fields` map, as `getObjectSchema` returns it. */
const projectFields = {
  name: { type: 'text', label: 'Name' },
  project_phase: {
    type: 'select',
    label: 'Project Phase',
    options: [
      { label: '01 Initiation', value: 'initiation' },
      { label: '03 Manufacturing', value: 'manufacturing' },
    ],
  },
  // A select field the metadata author never gave options to.
  risk_level: { type: 'select', label: 'Risk Level' },
};

function makeDataSource() {
  const find = vi.fn(async () => ({ data: projects, total: projects.length }));
  const getObjectSchema = vi.fn(async () => ({
    name: 'projects',
    fields: projectFields,
    highlightFields: ['name', 'project_phase'],
  }));
  return { find, getObjectSchema } as any;
}

const phaseFilterColumn = { field: 'project_phase', label: 'Project Phase', type: 'select' as const };

/**
 * Open the built-in filter panel and return the first select trigger in it.
 *
 * The toggle is reached structurally (first button in the filter bar) rather
 * than by its accessible name: one case below mounts a `zh` I18nProvider, and
 * `initReactI18next` makes that instance the default for provider-less renders
 * afterwards — so a `/filters/i` name match would pass or fail depending on
 * test order, not on the behaviour under test.
 *
 * `findBy…`: the filter bar only exists once the filter columns are resolved,
 * which in the LookupField path waits on the referenced object's schema fetch.
 */
async function openFilterSelect(): Promise<Element> {
  const bar = await screen.findByTestId('record-picker-filter-bar');
  fireEvent.click(bar.querySelector('button')!);
  const panel = await screen.findByTestId('record-picker-filter-panel');
  const trigger = panel.querySelector('[role="combobox"]');
  expect(trigger).toBeTruthy();
  await act(async () => {
    fireEvent.pointerDown(trigger!, { button: 0 });
  });
  return trigger!;
}

describe('RecordPickerDialog filter panel — select options come from the schema (#3336)', () => {
  it('hands the filter bar a select column carrying the schema field options', async () => {
    let captured: RecordPickerFilterBarProps | null = null;
    render(
      <RecordPickerDialog
        open
        onOpenChange={() => {}}
        dataSource={makeDataSource()}
        objectName="projects"
        columns={[{ field: 'project_phase', label: 'Project Phase', type: 'select' }]}
        onSelect={() => {}}
        cellRenderer={getCellRenderer}
        fieldsMeta={projectFields}
        filterColumns={[phaseFilterColumn]}
        renderFilterBar={(p) => {
          captured = p;
          return <div data-testid="external-filter-bar" />;
        }}
      />,
    );

    await waitFor(() => expect(captured).not.toBeNull());
    // Pre-fix this was `undefined` — the panel had nothing to render.
    expect(captured!.filterColumns[0].options).toEqual([
      { label: '01 Initiation', value: 'initiation' },
      { label: '03 Manufacturing', value: 'manufacturing' },
    ]);
  });

  it('renders the schema options in the built-in filter panel dropdown', async () => {
    render(
      <RecordPickerDialog
        open
        onOpenChange={() => {}}
        dataSource={makeDataSource()}
        objectName="projects"
        columns={[
          { field: 'name', label: 'Name', type: 'text' },
          { field: 'project_phase', label: 'Project Phase', type: 'select' },
        ]}
        onSelect={() => {}}
        cellRenderer={getCellRenderer}
        fieldsMeta={projectFields}
        filterColumns={[phaseFilterColumn]}
      />,
    );

    await waitFor(() => expect(screen.getByText('Line A retooling')).toBeInTheDocument());
    await openFilterSelect();

    // Pre-fix: SelectContent was empty, so neither option role existed.
    expect(await screen.findByRole('option', { name: '03 Manufacturing' })).toBeTruthy();
    expect(screen.getByRole('option', { name: '01 Initiation' })).toBeTruthy();
  });

  it('filters on the picked option value', async () => {
    const ds = makeDataSource();
    render(
      <RecordPickerDialog
        open
        onOpenChange={() => {}}
        dataSource={ds}
        objectName="projects"
        columns={[{ field: 'project_phase', label: 'Project Phase', type: 'select' }]}
        onSelect={() => {}}
        cellRenderer={getCellRenderer}
        fieldsMeta={projectFields}
        filterColumns={[phaseFilterColumn]}
      />,
    );

    await waitFor(() => expect(ds.find).toHaveBeenCalled());
    await openFilterSelect();

    const option = await screen.findByRole('option', { name: '03 Manufacturing' });
    await act(async () => {
      fireEvent.click(option);
    });

    await waitFor(() => {
      const lastParams = ds.find.mock.calls[ds.find.mock.calls.length - 1][1];
      expect(lastParams.$filter).toMatchObject({ project_phase: 'manufacturing' });
    });
  });

  /**
   * The load-bearing case: ONE source for both faces of the widget. The filter
   * option label and the table cell for the same field must be the same
   * translated string — a filter-only re-derivation that skipped the shared
   * i18n option path would show the authored English here.
   */
  it('translates filter option labels through the same i18n path as the cells', async () => {
    let captured: RecordPickerFilterBarProps | null = null;
    render(
      <I18nProvider
        config={{
          defaultLanguage: 'zh',
          detectBrowserLanguage: false,
          resources: {
            zh: {
              demo: {
                fields: { projects_zh: { project_phase: '项目阶段' } },
                fieldOptions: {
                  projects_zh: {
                    project_phase: {
                      initiation: '01 立项',
                      manufacturing: '03 制造',
                    },
                  },
                },
              },
            },
          },
        }}
      >
        {/* A dedicated object name: the bundle above stays registered on the
            default i18next instance for later renders, and keying it to
            `projects_zh` keeps it from translating the other cases' options. */}
        <RecordPickerDialog
          open
          onOpenChange={() => {}}
          dataSource={makeDataSource()}
          objectName="projects_zh"
          columns={[{ field: 'project_phase', label: 'Project Phase', type: 'select' }]}
          onSelect={() => {}}
          cellRenderer={getCellRenderer}
          fieldsMeta={projectFields}
          filterColumns={[phaseFilterColumn]}
          renderFilterBar={(p) => {
            captured = p;
            return <div data-testid="external-filter-bar" />;
          }}
        />
      </I18nProvider>,
    );

    // The cell already resolved the translated label after #3333 …
    await waitFor(() => expect(screen.getByText('03 制造')).toBeInTheDocument());
    // … and the filter option for the same field now says exactly the same thing.
    await waitFor(() => expect(captured).not.toBeNull());
    const labels = captured!.filterColumns[0].options?.map(o => o.label);
    expect(labels).toEqual(['01 立项', '03 制造']);
    expect(labels).not.toContain('03 Manufacturing');
  });

  /**
   * NO-OP PIN (green before and after). A select field the author gave no
   * options keeps an empty dropdown: the fix derives options from the schema
   * and adds no consumer-side leniency — it never invents entries from the
   * loaded page's raw stored values, which would hide the metadata gap behind
   * a list that changes per page.
   */
  it('leaves a select filter optionless when the schema field declares none', async () => {
    let captured: RecordPickerFilterBarProps | null = null;
    render(
      <RecordPickerDialog
        open
        onOpenChange={() => {}}
        dataSource={makeDataSource()}
        objectName="projects"
        columns={[{ field: 'name', label: 'Name', type: 'text' }]}
        onSelect={() => {}}
        cellRenderer={getCellRenderer}
        fieldsMeta={projectFields}
        filterColumns={[{ field: 'risk_level', label: 'Risk Level', type: 'select' }]}
        renderFilterBar={(p) => {
          captured = p;
          return <div data-testid="external-filter-bar" />;
        }}
      />,
    );

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured!.filterColumns[0].options).toBeUndefined();
  });

  /**
   * NO-OP PIN (green before and after). Authored filter options are the more
   * specific statement and keep winning — including the `in`-operator options
   * `lookupFilters` auto-derivation builds, which must not be replaced by the
   * schema's full option set (that would widen a deliberately narrowed list).
   */
  it('keeps explicitly authored filter options over the schema ones', async () => {
    let captured: RecordPickerFilterBarProps | null = null;
    render(
      <RecordPickerDialog
        open
        onOpenChange={() => {}}
        dataSource={makeDataSource()}
        objectName="projects"
        onSelect={() => {}}
        cellRenderer={getCellRenderer}
        fieldsMeta={projectFields}
        lookupFilters={[{ field: 'project_phase', operator: 'in', value: ['manufacturing'] }]}
        renderFilterBar={(p) => {
          captured = p;
          return <div data-testid="external-filter-bar" />;
        }}
      />,
    );

    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured!.filterColumns[0].options).toEqual([
      { label: 'manufacturing', value: 'manufacturing' },
    ]);
  });
});

describe('LookupField → picker filter panel wiring (#3336)', () => {
  const lookup = {
    name: 'project',
    label: 'Project',
    type: 'lookup',
    reference_to: 'projects',
    reference_field: 'name',
  } as any;

  it('offers the referenced object schema options in the derived select filter', async () => {
    render(
      <LookupField
        field={lookup}
        value={undefined}
        onChange={vi.fn()}
        readonly={false}
        dataSource={makeDataSource()}
      />,
    );

    // Open the "Browse all records" picker.
    await act(async () => {
      fireEvent.click(await screen.findByTestId('browse-all-records'));
    });
    await waitFor(() => expect(screen.getByTestId('record-picker-dialog')).toBeInTheDocument());

    // `project_phase` reaches the filter bar because it is a typed picker column
    // derived from `highlightFields`; its options come from the same schema.
    await openFilterSelect();
    expect(await screen.findByRole('option', { name: '03 Manufacturing' })).toBeTruthy();
  });
});
