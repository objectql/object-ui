/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3559, end to end: a field's per-option `visibleWhen` narrows the
 * option list a dialog param actually renders.
 *
 * The unit half lives in `resolveActionParams.test.ts` (the resolved param keeps
 * the keys, and `resolveVisibleOptions()` filters on them). What that cannot show
 * is the CONSUMER half — whether the control the dialog builds evaluates the
 * predicate at all, or merely receives it. So this file drives the real widget
 * with the real field object, wired the way `ActionParamDialog` wires it:
 *
 *   field metadata → `resolveActionParams()` → `paramToField()` → `<SelectField>`
 *
 * `ActionParamDialog` renders `field={paramToField(param)}` and `id={param.name}`
 * through `getLazyFieldWidget(field.type)`; `SelectField` is what that resolves
 * to for a `select` param. It is imported here at MODULE scope rather than through
 * the lazy registry on purpose (AGENTS.md §测试纪律): a first dynamic `import()`
 * under a saturated transform pipeline can eat most of RTL's 1s budget, and the
 * assertions below are synchronous effects.
 *
 * Deliberately NOT passed: `dependentValues`. The dialog does not pass it either —
 * it keeps the in-progress param values in local state — so the predicate `record`
 * a dialog option sees is whatever `SchemaRendererContext` supplies (the page's
 * `formValues` / `data`), never the dialog's own values. The predicates exercised
 * here are therefore the ones that work in a dialog today: scope-relative
 * (`current_user`), the role-gating case ADR-0058 opens. RECORD-relative
 * predicates in a dialog are measured, not asserted, in the last test — see the
 * note there.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PredicateScopeProvider } from '@object-ui/react';
import { SelectField } from '@object-ui/fields';
import { resolveActionParams, type ResolveActionParamsContext } from './resolveActionParams';
import { paramToField } from './paramToField';

/** An object whose `tier` field gates one option on the viewer's positions. */
const accountCtx = (
  options: Array<Record<string, unknown> | string>,
): ResolveActionParamsContext => ({
  objectName: 'account',
  objects: [{ name: 'account', fields: { tier: { type: 'select', label: 'Tier', options } } }],
  fieldLabel: (_o, _f, fallback) => fallback,
});

const ROLE_GATED = [
  { label: 'Standard', value: 'standard' },
  { label: 'Admin only', value: 'admin_only', visibleWhen: "'admin' in current_user.positions" },
];

/**
 * Render the `tier` param exactly as `ActionParamDialog` renders a select param:
 * resolve it from the field, adapt it with `paramToField()`, hand the result to
 * the widget as `field` with `id={param.name}`.
 */
function renderInheritedSelect(
  options: Array<Record<string, unknown> | string>,
  positions: string[],
  value?: string,
) {
  const onChange = vi.fn();
  const param = resolveActionParams([{ field: 'tier' }], accountCtx(options))[0];
  const field = paramToField(param);
  // Same props the dialog passes a non-boolean param's widget. The cast is the
  // dialog's own seam: `paramToField()` returns `Record< string, unknown >`-shaped
  // field metadata and the widget is reached through a lazy `any` component there.
  const props = { id: param.name, value: value ?? null, onChange, field } as unknown as
    React.ComponentProps<typeof SelectField>;
  render(
    <PredicateScopeProvider scope={{ current_user: { positions } }}>
      <SelectField {...props} />
    </PredicateScopeProvider>,
  );
  return { onChange, field };
}

describe('field-inherited option predicates reach the dialog control (objectui#3559)', () => {
  it('drops a role-gated option for a viewer who fails the predicate', () => {
    // Every option gated → the offered set is empty, and the widget says so
    // instead of rendering a dropdown of options the predicate excluded.
    renderInheritedSelect(
      [{ label: 'Admin only', value: 'admin_only', visibleWhen: "'admin' in current_user.positions" }],
      ['sales'],
    );
    expect(screen.getByTestId('select-empty-tier')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('offers the same list to a viewer who satisfies it', () => {
    renderInheritedSelect(
      [{ label: 'Admin only', value: 'admin_only', visibleWhen: "'admin' in current_user.positions" }],
      ['admin'],
    );
    expect(screen.queryByTestId('select-empty-tier')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('clears a pre-filled value the predicate hides (per-option, not whole-list)', () => {
    // The per-option proof: `standard` survives (so the list is not gated as a
    // whole — a combobox is still offered) while `admin_only` is not offered, so
    // the widget's cascade-clear drops the seeded value.
    const { onChange } = renderInheritedSelect(ROLE_GATED, ['sales'], 'admin_only');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('keeps that value for a viewer the predicate admits', () => {
    const { onChange } = renderInheritedSelect(ROLE_GATED, ['admin'], 'admin_only');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves an unpredicated inherited list fully offered', () => {
    const { onChange, field } = renderInheritedSelect(
      [{ label: 'Standard', value: 'standard' }, 'won'],
      [],
      'standard',
    );
    expect(field.options).toEqual([
      { label: 'Standard', value: 'standard' },
      { label: 'won', value: 'won' },
    ]);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('MEASURES a record-relative predicate with no record in context: fails OPEN', () => {
    // Not a claim about correct behaviour — a recorded measurement, because the
    // fix delivers the keys and the widget honours them, but WHICH record a
    // dialog evaluates them against is a separate question this PR does not
    // settle.
    //
    // Measured, not assumed (the prediction going in was the opposite): with no
    // `dependentValues` — the dialog passes none, it keeps param values in local
    // state — and no `SchemaRendererContext` above, `record` is `{}`, and
    // `record.country == 'cn'` is UNRESOLVABLE rather than false. Per
    // `resolveVisibleOptions()`'s documented fail-open default the option is
    // therefore KEPT, not hidden. Same list against a populated record filters
    // as expected (`{ country: 'us' }` → `[]`), which is what the object form
    // gets and what a dialog mounted under a page picks up from that page's
    // `formValues`/`data`.
    //
    // So the residual gap is narrow and safe-by-default: a dialog cannot narrow
    // an inherited list against its OWN in-progress params, and unresolvable
    // predicates offer everything rather than hiding everything. Reported
    // separately; nothing here should be read as endorsing it.
    renderInheritedSelect(
      [{ label: 'Zhejiang', value: 'zj', visibleWhen: "record.country == 'cn'" }],
      ['admin'],
    );
    expect(screen.queryByTestId('select-empty-tier')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
