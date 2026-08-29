/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6237 — the ruled INTERIM diagnostic for an authored
 * `FormSection.visibleWhen` on a layout arm that cannot yet honour it.
 *
 * ## What was ruled, and what this file does and does not pin
 *
 * Maintainer ruling, 2026-08-29 (live director session batch #3), option A: the
 * full repair is a DESIGN task — one renderer-side section/group contract with a
 * predicate slot, designed once for every layout arm (tabbed / TabbedForm /
 * WizardForm / flat) rather than patched arm by arm. Ruled as part of that same
 * option: *"a loud diagnostic lands first — an authored section `visibleWhen` on
 * the tabbed arm reports 'not yet supported on this layout' instead of today's
 * silent inertness."*
 *
 * ⛔ So this file pins REPORTING, never behaviour. It must not grow an assertion
 * that a `tabbed` or `wizard` section actually hides — that is the design task's
 * deliverable, and pinning it here would declare the contract by the back door.
 *
 * ## Why the control rows are the load-bearing half
 *
 * A diagnostic that fires everywhere is as useless as one that fires nowhere, and
 * far more annoying. The measured split on `origin/main` is:
 *
 *   - `split` / `drawer` / `modal` — `ObjectForm` rebuilds each section key by key
 *     and each of those three maps COPIES `visibleWhen` (#6111), so the predicate
 *     reaches a renderer. Warning on them would be a false alarm about a working
 *     feature.
 *   - flat / `simple` — carries the predicate on the `section-divider`
 *     pseudo-field. Also works.
 *   - `tabbed` (`TabbedForm`) and `wizard` (`WizardForm`) — the same key-by-key
 *     rebuild, copying no predicate. These are the inert arms.
 *
 * The four negative rows below therefore pin the boundary, not politeness: they
 * are what stops a later edit from turning this into a blanket warning.
 *
 * ⚠️ Note the ModalForm `contentLayout: 'tabbed'` arm is NOT an inert arm and is
 * deliberately absent from the warned set — it gained a real predicate slot in
 * #6619 (`FormFieldTab.visibleWhen`) and honours the key. "Tabbed" names two
 * different things on this card; only `formType: 'tabbed'` is inert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { PredicateScopeProvider } from '@object-ui/react';
import { registerAllFields } from '@object-ui/fields';
import { ObjectForm } from '../ObjectForm';
import { sectionPredicateUnsupportedWarning } from '../sectionPredicateDiagnostic';

registerAllFields();

/** Canonical wire shape — same spelling the #6111 / #6010 pins use. */
const cel = (source: string) => ({ dialect: 'cel', source });
const GATE = cel("'sales_manager' in current_user.positions");

function hostScope(positions: string[]) {
  const user = { id: 'u1', name: 'Kim', positions };
  return { current_user: user, user, ctx: { user }, os: { user }, app: {}, data: {}, features: {} };
}
/**
 * DENIED on purpose: the predicate resolves FALSE, which is the only state in
 * which an author would notice the arm is inert. The diagnostic is deliberately
 * verdict-INDEPENDENT (it reports that nothing will evaluate the key at all), and
 * the ALLOWED row below pins exactly that.
 */
const DENIED = hostScope(['sales']);
const ALLOWED = hostScope(['sales_manager']);

const objectSchema = {
  name: 'crm_case',
  fields: {
    subject: { type: 'text', label: 'Subject' },
    salary: { type: 'text', label: 'Salary' },
  },
};

let dataSource: any;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  dataSource = {
    getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** `Always` is the un-gated control section; `Compensation` carries the gate. */
const sections = (gate: unknown = GATE) => [
  { name: 'always', label: 'Always', fields: ['subject'] },
  { name: 'pay', label: 'Compensation', visibleWhen: gate, fields: ['salary'] },
];

const renderObjectForm = async (
  scope: Record<string, unknown>,
  extra: Record<string, unknown>,
  sectionList: unknown = sections(),
) => {
  const view = render(
    <PredicateScopeProvider scope={scope as any}>
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'crm_case',
          mode: 'create',
          sections: sectionList,
          ...extra,
        } as any}
        dataSource={dataSource}
      />
    </PredicateScopeProvider>,
  );
  // The un-gated sibling is the readiness signal AND the proof the form mounted.
  await waitFor(() => expect(screen.getAllByText('Always').length).toBeGreaterThan(0));
  return view;
};

/** Only the #6237 diagnostic — other console.warn traffic is not this pin's subject. */
const diagnosticCalls = () =>
  warnSpy.mock.calls
    .map((c: unknown[]) => String(c[0]))
    .filter((m: string) => m.includes('Section `visibleWhen` is not yet supported on this layout'));

describe('#6237 — the inert arms REPORT instead of dropping the predicate in silence', () => {
  it('formType `tabbed`: reports, naming the ruled phrase, the surface and the section', async () => {
    await renderObjectForm(DENIED, { formType: 'tabbed' });
    await waitFor(() => expect(diagnosticCalls().length).toBe(1));
    const message = diagnosticCalls()[0];
    expect(message).toContain('not yet supported on this layout');
    expect(message).toContain("the `tabbed` layout's tabs");
    // The section is named, so an author with ten sections knows which one.
    expect(message).toContain('pay');
    // The remedy names an arm that genuinely works today.
    expect(message).toContain('objectui#6237');
  });

  it('formType `wizard`: reports too — steps are the second silently-inert arm', async () => {
    await renderObjectForm(DENIED, { formType: 'wizard' });
    await waitFor(() => expect(diagnosticCalls().length).toBe(1));
    expect(diagnosticCalls()[0]).toContain("the `wizard` layout's steps");
  });

  it('the report does not depend on the VERDICT — an admitting predicate is just as inert', async () => {
    // Nothing evaluates the key on these arms, so a TRUE predicate is dropped
    // exactly as a FALSE one is. A diagnostic that only fired on the denied
    // scope would leave the author of an allow-rule believing it worked.
    await renderObjectForm(ALLOWED, { formType: 'tabbed' });
    await waitFor(() => expect(diagnosticCalls().length).toBe(1));
  });

  it('every section carrying a predicate is named, not just the first', async () => {
    await renderObjectForm(DENIED, { formType: 'tabbed' }, [
      { name: 'always', label: 'Always', fields: ['subject'] },
      { name: 'pay', label: 'Compensation', visibleWhen: GATE, fields: ['salary'] },
      { name: 'extra', label: 'Extra', visibleWhen: GATE, fields: ['subject'] },
    ]);
    await waitFor(() => expect(diagnosticCalls().length).toBe(1));
    expect(diagnosticCalls()[0]).toContain('pay, extra');
  });
});

describe('#6237 — the boundary: arms that HONOUR the predicate stay silent', () => {
  // Each row authors the identical predicate on the identical section. The only
  // variable is the layout, so a warning here would be a false alarm about a
  // feature #6111 / #6619 already landed.
  const honouring: Array<[string, Record<string, unknown>]> = [
    ['simple (flat, section-divider pseudo-field)', { formType: 'simple' }],
    ['modal (ObjectForm modal map copies it)', { formType: 'modal', open: true }],
    ['modal + contentLayout tabbed (#6619 FormFieldTab.visibleWhen)',
      { formType: 'modal', open: true, contentLayout: 'tabbed' }],
    ['drawer (ObjectForm drawer map copies it)', { formType: 'drawer', open: true }],
    ['split (ObjectForm split map copies it)', { formType: 'split' }],
  ];

  for (const [label, extra] of honouring) {
    it(`${label}: silent`, async () => {
      await renderObjectForm(DENIED, extra);
      expect(diagnosticCalls()).toEqual([]);
    });
  }

  it('an inert arm with NO authored predicate is silent — the gap, not the layout, is reported', async () => {
    await renderObjectForm(DENIED, { formType: 'tabbed' }, [
      { name: 'always', label: 'Always', fields: ['subject'] },
      { name: 'pay', label: 'Compensation', fields: ['salary'] },
    ]);
    expect(diagnosticCalls()).toEqual([]);
  });
});

describe('#6237 — the report is once per mount, not once per render', () => {
  it('re-rendering the same schema does not re-report', async () => {
    const view = await renderObjectForm(DENIED, { formType: 'tabbed' });
    await waitFor(() => expect(diagnosticCalls().length).toBe(1));
    // A fresh element with the same authored content: the effect's deps are
    // primitives (layout + joined names), so identity churn must not re-fire it.
    // Authoring a form re-renders on every keystroke; a per-render warning would
    // bury the console it is trying to speak into.
    view.rerender(
      <PredicateScopeProvider scope={DENIED as any}>
        <ObjectForm
          schema={{
            type: 'object-form',
            objectName: 'crm_case',
            mode: 'create',
            sections: sections(),
            formType: 'tabbed',
          } as any}
          dataSource={dataSource}
        />
      </PredicateScopeProvider>,
    );
    await waitFor(() => expect(screen.getAllByText('Always').length).toBeGreaterThan(0));
    expect(diagnosticCalls().length).toBe(1);
  });
});

describe('#6237 — the master-detail branch reports through its INNER pass, exactly once', () => {
  // `ObjectForm` routes a subforms-bearing schema to `MasterDetailForm` FIRST,
  // and that component builds a parent schema which re-enters `ObjectForm`. The
  // real layout is decided on that inner pass — a master-detail `wizard` parent
  // is rendered `simple`, which HONOURS the predicate. Reporting at the outer
  // call as well would double-report the tabbed parent and, worse, false-report
  // the wizard one about a layout it never actually renders.
  const subforms = [{ childObject: 'crm_case_line', relationshipField: 'case' }];

  it('master-detail `wizard`: silent — the parent renders `simple`, which honours the key', async () => {
    await renderObjectForm(DENIED, { formType: 'wizard', subforms });
    expect(diagnosticCalls()).toEqual([]);
  });

  it('master-detail `tabbed`: reported ONCE, not once per ObjectForm pass', async () => {
    await renderObjectForm(DENIED, { formType: 'tabbed', subforms });
    await waitFor(() => expect(diagnosticCalls().length).toBe(1));
    expect(diagnosticCalls()[0]).toContain("the `tabbed` layout's tabs");
  });
});

describe('#6237 — the message is single-sourced', () => {
  it('both arms speak through one builder, so the two cannot drift apart', () => {
    expect(sectionPredicateUnsupportedWarning('tabbed', 'pay'))
      .toContain('not yet supported on this layout');
    expect(sectionPredicateUnsupportedWarning('wizard', 'pay'))
      .toContain('not yet supported on this layout');
    // The one thing that differs is the surface noun.
    expect(sectionPredicateUnsupportedWarning('tabbed', 'pay'))
      .not.toEqual(sectionPredicateUnsupportedWarning('wizard', 'pay'));
  });
});
