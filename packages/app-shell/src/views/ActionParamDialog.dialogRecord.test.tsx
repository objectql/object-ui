/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3765 — WHICH record an action dialog's per-option `visibleWhen`
 * predicates are evaluated against.
 *
 * objectui#3559 delivered the keys (a field's per-option `visibleWhen` survives
 * inheritance and reaches the control) and `resolveActionParams.optionVisibleWhen`
 * pins that half at the widget level. What was missing was the SUPPLY: the dialog
 * passed no `dependentValues`, so `useCascadingOptions` fell through its chain
 * (`dependentValues ?? ctx.formValues ?? ctx.data ?? {}`) to the host page's
 * record — and the values the user was typing INTO THIS DIALOG could never
 * narrow a sibling param's list, however the author wrote the predicate.
 *
 * **Maintainer ruling, 2026-08-11 — Option B**: the dialog is a small form, so
 * its own in-progress values are that record; the shared evaluator is not
 * modified. This file drives the real `ActionParamDialog` (not a widget wired to
 * look like it) because the wiring IS the change: only a real render can show
 * that a keystroke in one param re-resolves another param's offered options.
 *
 * The ruling's accepted cost is pinned too, in `does not merge the page record`
 * below — a supplied record wins the chain outright, so a predicate naming a row
 * field the dialog has no param for stops resolving here and falls open. That
 * test is what discriminates the ruled B from the unruled C (`{ ...row,
 * ...values }`): under C its first assertion would be a filtered list, not an
 * open one.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SchemaRendererContext } from '@object-ui/react';
import type { ActionParamDef } from '@object-ui/core';
// Module scope, per AGENTS.md §测试纪律: the dialog reaches its widgets through
// `React.lazy(() => import('./widgets/RadioField'))` inside `@object-ui/fields`,
// and a first dynamic import() under a saturated transform pipeline can eat most
// of RTL's 1s `findBy` budget. This barrel STATICALLY re-exports those widget
// modules, so importing it puts them in the ESM cache and the lazy factories
// resolve in a microtask instead of racing the assertions below.
import '@object-ui/fields';
import { ActionParamDialog } from './ActionParamDialog';

const COUNTRY: ActionParamDef = { name: 'country', label: 'Country', type: 'text' };

/** Province options gated on a SIBLING PARAM's value (`country`), not on scope. */
const PROVINCE: ActionParamDef = {
  name: 'province',
  label: 'Province',
  type: 'radio',
  options: [
    { label: 'Zhejiang', value: 'zj', visibleWhen: "record.country == 'cn'" },
    { label: 'Texas', value: 'tx', visibleWhen: "record.country == 'us'" },
  ],
};

function openDialog(params: ActionParamDef[], hostFormValues?: Record<string, unknown>) {
  const resolve = vi.fn();
  const dialog = (
    <ActionParamDialog state={{ open: true, params, resolve }} onOpenChange={() => {}} />
  );
  render(
    hostFormValues
      // The host page's record, expressed the way the evaluator reads it: the
      // context type declares `dataSource` only, and `formValues` is the key
      // `useCascadingOptions` picks off it through an `any` cast.
      ? <SchemaRendererContext.Provider value={{ dataSource: null, formValues: hostFormValues } as never}>
          {dialog}
        </SchemaRendererContext.Provider>
      : dialog,
  );
  return resolve;
}

const typeCountry = (value: string) =>
  fireEvent.change(screen.getByLabelText('Country'), { target: { value } });

describe('ActionParamDialog — the dialog IS the record for its option predicates (objectui#3765)', () => {
  it("narrows a param's options against a value typed into a SIBLING param", async () => {
    openDialog([COUNTRY, PROVINCE]);
    // Nothing typed yet: `record.country` is unresolvable, which fails OPEN, so
    // both provinces are offered. (The pre-#3765 dialog was stuck here forever —
    // typing had no way to reach the predicate.)
    expect(await screen.findByTestId('radio-option-zj')).toBeInTheDocument();
    expect(screen.getByTestId('radio-option-tx')).toBeInTheDocument();

    typeCountry('cn');

    // The keystroke re-resolved a DIFFERENT param's offered set: `zj` survives
    // its predicate, `tx` does not. This assertion is the whole issue.
    await waitFor(() => expect(screen.queryByTestId('radio-option-tx')).not.toBeInTheDocument());
    expect(screen.getByTestId('radio-option-zj')).toBeInTheDocument();

    // …and it tracks the value, rather than latching on the first one seen.
    typeCountry('us');
    await waitFor(() => expect(screen.queryByTestId('radio-option-zj')).not.toBeInTheDocument());
    expect(screen.getByTestId('radio-option-tx')).toBeInTheDocument();
  });

  it('empties a select whose every option the in-progress values exclude', async () => {
    // The `select` widget's counterpart: when the dialog's own values exclude
    // the whole list there is no dropdown to offer, so the widget renders its
    // legible empty state (objectui#3231) keyed on the param name.
    openDialog([
      COUNTRY,
      {
        name: 'region',
        label: 'Region',
        type: 'select',
        options: [{ label: 'Zhejiang', value: 'zj', visibleWhen: "record.country == 'cn'" }],
      },
    ]);
    expect(await screen.findByRole('combobox')).toBeInTheDocument();

    typeCountry('us');

    await waitFor(() => expect(screen.getByTestId('select-empty-region')).toBeInTheDocument());
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('keeps an option whose predicate names a key NO param carries: fails OPEN', async () => {
    // The safety direction, unchanged by the wiring and pinned separately from
    // the cases above because it is the one that decides how bad a mistake here
    // can be. An unresolvable predicate offers the option (the user can still
    // complete the action, and a wrong value earns a server rejection that
    // carries a message) instead of hiding it (an empty control with nothing
    // pointing at the predicate). Same direction the param-level `visible` gate
    // rules on this surface — objectui#4640.
    openDialog([
      COUNTRY,
      {
        name: 'province',
        label: 'Province',
        type: 'radio',
        options: [{ label: 'Zhejiang', value: 'zj', visibleWhen: "record.owner_id == 'u1'" }],
      },
    ]);
    expect(await screen.findByTestId('radio-option-zj')).toBeInTheDocument();
    typeCountry('cn');
    // Still unresolvable after a keystroke — `owner_id` is not a param — so the
    // option stays offered rather than vanishing as the user types.
    await waitFor(() => expect(screen.getByLabelText('Country')).toHaveValue('cn'));
    expect(screen.getByTestId('radio-option-zj')).toBeInTheDocument();
  });

  it('does not merge the page record: the dialog record WINS, and an empty one falls open', async () => {
    // Option B's ruled cost, asserted rather than left for a reader to discover.
    // The host page says `country: 'us'`; the dialog says nothing yet. Because a
    // supplied `dependentValues` wins `useCascadingOptions`' chain outright, the
    // page's value does NOT reach the predicate — the list falls open instead of
    // narrowing to Texas.
    //
    // Under the unruled option C (`{ ...pageRecord, ...dialogValues }`) this
    // first assertion would read the other way: `tx` only. So this case is the
    // executable difference between the two readings, and re-deciding the scope
    // ruling has to come through here.
    openDialog([COUNTRY, PROVINCE], { country: 'us' });
    expect(await screen.findByTestId('radio-option-zj')).toBeInTheDocument();
    expect(screen.getByTestId('radio-option-tx')).toBeInTheDocument();

    // And once the dialog HAS a value it is the only one that counts: `cn` wins
    // over the page's `us`, in the same direction a form field's own value wins
    // over anything ambient.
    typeCountry('cn');
    await waitFor(() => expect(screen.queryByTestId('radio-option-tx')).not.toBeInTheDocument());
    expect(screen.getByTestId('radio-option-zj')).toBeInTheDocument();
  });
});
