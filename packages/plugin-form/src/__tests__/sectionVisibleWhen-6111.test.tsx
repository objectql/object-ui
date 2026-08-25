/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6111 — an authored `FormSection.visibleWhen` must REACH an evaluator
 * on the object-view chain, in every plugin-form layout.
 *
 * `@objectstack/spec` declares `FormSection.visibleWhen`; this repo's spec
 * bridge carries it (`packages/react/src/spec-bridge/bridges/form-view.ts:250`);
 * `RecordFormPage` / `resolveFormViewLayout` wire whole `sections` objects into
 * the layouts. Every layout then renders a section header as a virtual
 * `section-divider` pseudo-field — and none of them copied the predicate onto
 * it, so the key was declared, mapped, carried, and dropped one hop before
 * anything evaluated it.
 *
 * The renderer half already works: `packages/components/src/renderers/form/
 * form.tsx` runs EVERY pseudo-field through `resolveFieldRuleState` with the
 * host predicate scope bound (#6010) before it reaches the `section-divider`
 * branch, so a divider carrying a `visibleWhen` hides exactly like a field
 * does. `predicate-scope-parity-6010.test.tsx`'s `sectionSurface` row pins that
 * directly, hand-authoring the pseudo-field this file makes the layouts emit.
 *
 * ## ⚠️ Why every case below asserts HIDDEN, and never merely SHOWN
 *
 * `visibleWhen` fails OPEN. A section that renders is the outcome of three
 * different worlds — the predicate resolved TRUE, the predicate never arrived,
 * and the predicate faulted — so **an assertion that a section IS shown
 * distinguishes none of them** and is green on unfixed code. The deliverable is
 * therefore the DENIED row: the heading is ABSENT while a predicate that
 * resolves false is authored on the section.
 *
 * The ALLOWED row is the control and nothing more. Without it, "hidden" is
 * satisfiable by a layout that dropped the heading for some unrelated reason
 * (an empty section, a bad label lookup), which would be a worse defect and
 * completely invisible to the DENIED row alone.
 *
 * ## Why one parameterised case would NOT have been enough
 *
 * There are SIX `section-divider` synthesis sites across FOUR layout files, and
 * a fix applied to five of six still passes a suite that exercises five. Each
 * layout is therefore mounted BY NAME below, through the entry the product
 * actually uses.
 *
 * Two hops had to be repaired per layout, and only the second was on the card:
 *
 *   1. `ObjectForm` rebuilds each section KEY BY KEY when it delegates to
 *      Split/Drawer/Modal (`ObjectForm.tsx` ~296/~331/~388) — a key that map
 *      does not copy never reaches the layout at all. `ModalForm`'s own
 *      `groups` map does the same thing again. The file's own comment on the
 *      split map already recorded the hazard: *"this mapping rebuilds each
 *      section key by key, so a key it doesn't copy is silently dropped —
 *      exactly how `visibleOn` once vanished here."*
 *   2. The `section-divider` synthesis sites themselves.
 *
 * Routing the modal/drawer/split rows through `ObjectForm` (which is what
 * `RecordFormPage` does) exercises BOTH hops; the direct `ModalForm` row covers
 * `resolveFormViewLayout`, which mounts `ModalForm` without passing through
 * `ObjectForm` at all.
 *
 * ## Reverse verification (direction predicted BEFORE running)
 *
 * Revert the `visibleWhen:` copy at any ONE synthesis site and that layout's
 * DENIED row — and only that one — goes red in the SHOWN direction (the heading
 * comes back), because the fallback is fail-open. Every ALLOWED row stays green
 * everywhere, which is precisely why the ALLOWED rows could never have caught
 * this.
 *
 * ## Scope, measured — what this does NOT claim
 *
 * The renderer treats `section-divider` as a presentational ROW and holds no
 * association between it and the fields that follow it, so a false predicate
 * removes the HEADING and leaves the section's fields rendering. The console
 * renderer (`apps/console/src/components/FormPage.tsx:1819`) drops the whole
 * `<section>`, fields included. That divergence is real and is filed
 * separately — it needs a renderer-side grouping contract, not another line in
 * a layout. The `stillRendersItsFields` case below pins the CURRENT behaviour
 * honestly rather than letting the file imply a guarantee it does not deliver.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import { PredicateScopeProvider } from '@object-ui/react';
import { registerAllFields } from '@object-ui/fields';
import { ObjectForm } from '../ObjectForm';
import { ModalForm } from '../ModalForm';

registerAllFields();

/**
 * The canonical wire shape — `@objectstack/spec` normalizes an authored
 * predicate into a `{ dialect: 'cel' }` envelope at parse (ADR-0089 D2), and a
 * bare string would route to a different engine on some surfaces (measured in
 * `predicate-scope-parity-6010.test.tsx`). Same spelling as that file, on
 * purpose: one authored text, one verdict, every surface.
 */
const cel = (source: string) => ({ dialect: 'cel', source });

/** THE authored section predicate. One text, asked of every layout below. */
const GATE = cel("'sales_manager' in current_user.positions");

/** The host scope `ExpressionProvider` mounts, transcribed (see #6010's pin). */
function hostScope(positions: string[]) {
  const user = { id: 'u1', name: 'Kim', positions };
  return { current_user: user, user, ctx: { user }, os: { user }, app: {}, data: {}, features: {} };
}

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

beforeEach(() => {
  dataSource = {
    getObjectSchema: vi.fn().mockResolvedValue(objectSchema),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Two sections: `Always` carries no predicate and is the paired control that
 * proves the form rendered AT ALL — so a missing `Compensation` heading is a
 * verdict and not an inability. `Compensation` carries the gate.
 */
const sections = () => [
  { name: 'always', label: 'Always', fields: ['subject'] },
  { name: 'pay', label: 'Compensation', visibleWhen: GATE, fields: ['salary'] },
];

/** Mount through `ObjectForm` — the entry `RecordFormPage` itself uses. */
const renderObjectForm = async (
  scope: Record<string, unknown>,
  extra: Record<string, unknown>,
) => {
  render(
    <PredicateScopeProvider scope={scope as any}>
      <ObjectForm
        schema={{
          type: 'object-form',
          objectName: 'crm_case',
          mode: 'create',
          sections: sections(),
          ...extra,
        } as any}
        dataSource={dataSource}
      />
    </PredicateScopeProvider>,
  );
  // The un-gated sibling heading is the readiness signal AND the control.
  await waitFor(() => expect(screen.getByText('Always')).toBeTruthy());
};

/** Mount `ModalForm` directly — the shape `resolveFormViewLayout` produces. */
const renderModalFormDirect = async (scope: Record<string, unknown>) => {
  render(
    <PredicateScopeProvider scope={scope as any}>
      <ModalForm
        schema={{
          type: 'modal-form',
          objectName: 'crm_case',
          mode: 'create',
          open: true,
          sections: sections(),
        } as any}
        dataSource={dataSource}
      />
    </PredicateScopeProvider>,
  );
  await waitFor(() => expect(screen.getByText('Always')).toBeTruthy());
};

/** The gated section's heading — `null` when the layout hid it. */
const gatedHeading = () => screen.queryByText('Compensation');

/**
 * Every layout, by name, with the mount that reaches its own synthesis site.
 * Named individually because a fix applied to five of six sites still passes a
 * suite that exercises five.
 */
const LAYOUTS: { label: string; mount: (scope: Record<string, unknown>) => Promise<void> }[] = [
  {
    label: 'ObjectForm — stacked `simple` sections (ObjectForm.tsx section-divider)',
    mount: (scope) => renderObjectForm(scope, { formType: 'simple' }),
  },
  {
    label: 'ModalForm — via ObjectForm delegation (key-by-key remap + ModalForm groups map)',
    mount: (scope) => renderObjectForm(scope, { formType: 'modal', open: true }),
  },
  {
    label: 'ModalForm — mounted directly (the resolveFormViewLayout shape)',
    mount: (scope) => renderModalFormDirect(scope),
  },
  {
    label: 'DrawerForm — via ObjectForm delegation (key-by-key remap + explicit-sections divider)',
    mount: (scope) => renderObjectForm(scope, { formType: 'drawer', open: true }),
  },
  {
    label: 'SplitForm — via ObjectForm delegation (key-by-key remap + paneFields divider)',
    mount: (scope) => renderObjectForm(scope, { formType: 'split' }),
  },
];

describe('#6111 — an authored section `visibleWhen` reaches an evaluator in every layout', () => {
  describe('DENIED — the predicate resolves FALSE, so the section heading is HIDDEN', () => {
    // ⚠️ THE deliverable. Green here is the only observation that separates
    // "the predicate arrived and was evaluated" from "it never arrived" —
    // every other row in this file is green on unfixed code.
    for (const layout of LAYOUTS) {
      it(layout.label, async () => {
        await layout.mount(DENIED);
        expect(gatedHeading()).toBeNull();
      });
    }
  });

  describe('ALLOWED — the SAME predicate text, a user it admits ⇒ still SHOWN', () => {
    // The control. Without it, "hidden" is satisfied by a layout that dropped
    // the heading for an unrelated reason — a worse defect, invisible above.
    for (const layout of LAYOUTS) {
      it(layout.label, async () => {
        await layout.mount(ALLOWED);
        expect(gatedHeading()).not.toBeNull();
      });
    }
  });

  describe('FAULTED — a genuinely unbound root still fails OPEN (unchanged)', () => {
    // Pinned so the DENIED rows above mean "evaluated and false" rather than
    // "could not be evaluated at all". Asserted against the DENIED user on
    // purpose: the only difference from the DENIED block is the ROOT the
    // predicate names, so a fail-CLOSED regression cannot hide behind the
    // membership test.
    for (const layout of LAYOUTS) {
      it(layout.label, async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const unbound = cel("'sales_manager' in no_such_root.positions");
        render(
          <PredicateScopeProvider scope={DENIED as any}>
            <ObjectForm
              schema={{
                type: 'object-form',
                objectName: 'crm_case',
                mode: 'create',
                formType: 'simple',
                sections: [
                  { name: 'always', label: 'Always', fields: ['subject'] },
                  { name: 'pay', label: 'Compensation', visibleWhen: unbound, fields: ['salary'] },
                ],
              } as any}
              dataSource={dataSource}
            />
          </PredicateScopeProvider>,
        );
        await waitFor(() => expect(screen.getByText('Always')).toBeTruthy());
        expect(gatedHeading()).not.toBeNull();
      });
    }
  });

  it('measured scope: a hidden section still renders its FIELDS (objectui#6111 follow-up)', async () => {
    // NOT an endorsement — an honest pin of what this change does and does not
    // deliver. `section-divider` is a presentational ROW; the renderer holds no
    // association between it and the fields after it, so the heading goes and
    // the fields stay. The console renderer drops the whole `<section>`.
    // Reconciling the two needs a renderer-side grouping contract and is filed
    // separately; this assertion turning red is the SIGNAL that it landed.
    await renderObjectForm(DENIED, { formType: 'simple' });
    expect(gatedHeading()).toBeNull();
    expect(screen.getByLabelText(/salary/i)).toBeTruthy();
  });
});
