/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8672 — MEASUREMENT PINS for a `dependsOn` lookup ACTION PARAM.
 *
 * ⭐⭐ **CURRENT SHAPE, NOT CONTRACT.** ⭐⭐ Read this before changing anything
 * below. The card names three dispositions — wire it · refuse it · declare the
 * limit — and **none of them is chosen here**. This file exists so that the
 * ruling is made against a measured, stable behaviour instead of a guess; every
 * `expect` in legs A and C records what the code does TODAY and endorses none of
 * it. Whoever implements a disposition should expect these to go red and should
 * **rewrite them**, not trust them: a red here is the pin doing its job, not a
 * regression. Leg B is the exception and says so on its own describe block.
 *
 * ## What the three legs measure
 *
 * - **Leg A (current shape)** — the behaviour the card reports, made permanent:
 *   a lookup param declaring `dependsOn` renders GATED and a keystroke in the
 *   named parent does not lift the gate. `CASCADE_OPTION_WIDGET_TYPES` (the
 *   dialog's `dependentValues` supply set in `ActionParamDialog.tsx`) does not
 *   contain `lookup`, so `LookupField` resolves its record through the context
 *   tail that is unconditionally `{}` (objectui#7206) and `dependenciesMissing`
 *   can never go false.
 * - **Leg B (contract, version-qualified)** — where the authoring surface is.
 *   `@objectstack/spec`'s `ActionParamSchema` is `.strict()` and REFUSES
 *   `dependsOn` on an action param outright. `@object-ui/types`' `ActionParam`
 *   derives its key set from `z.input<typeof ActionParamSchema>`, so it declares
 *   no `dependsOn` either — which is why leg A has to synthesise the resolved
 *   `ActionParamDef` directly rather than author a param.
 * - **Leg C (current shape)** — the ONE route the repo itself points authors to
 *   (`RESOLVED_ONLY_PARAM_KEYS.dependsOn`: "make the param field-backed … to
 *   pick it up") reads `field.depends_on`, the SNAKE spelling, while the spelling
 *   `FieldSchema` accepts is camel `dependsOn`. So a spec-valid object field
 *   declaring the cascade delivers `undefined` here.
 *
 * ## Every reading has a lit control beside it
 *
 * A gated trigger, a refused parse and an `undefined` key are all shapes a
 * broken fixture produces for free, so none of them is asserted alone:
 *
 * - leg A pairs the gated lookup with a CONTROL lookup identical but for
 *   `dependsOn` (asserted enabled), and drives the keystroke through a `radio`
 *   param whose `visibleWhen` DOES react to it — so "the gate did not lift" is
 *   read against a keystroke proven to have reached the dialog and re-rendered
 *   it, not against a dialog that ignored the event;
 * - leg B pairs each refusal with a positive control document that must PARSE,
 *   and with an unknown-key document that must be REFUSED — so an "accept" is a
 *   reading of a live strict schema rather than of a permissive one;
 * - leg C pairs the `undefined` with a sibling key resolved off the SAME field
 *   def in the same call, so an empty reading cannot come from a fixture the
 *   resolver never saw.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ActionParamDef } from '@object-ui/core';
import { CASCADE_OPTION_WIDGET_TYPES } from '@object-ui/core';
import { ActionParamSchema } from '@objectstack/spec/ui';
import { FieldSchema } from '@objectstack/spec/data';
// Module scope, per AGENTS.md 测试纪律: the dialog reaches `LookupField` through
// a `React.lazy` factory inside `@object-ui/fields`, and a first dynamic
// import() under a saturated transform pipeline can eat most of RTL's 1s
// `findBy` budget. This barrel statically re-exports those widget modules, so
// the lazy factories resolve in a microtask instead of racing the assertions.
import '@object-ui/fields';
import { ActionParamDialog } from './ActionParamDialog';
import {
  resolveActionParams,
  type ResolveActionParamsContext,
  type RawActionParam,
} from '../utils/resolveActionParams';

/* ────────────────────────────────────────────────────────────────────────── */
/* Leg A — the dialog's behaviour today                    CURRENT SHAPE      */
/* ────────────────────────────────────────────────────────────────────────── */

/** The parent the child lookup names. A plain text param, so it is typable. */
const ACCOUNT: ActionParamDef = { name: 'account', label: 'Account', type: 'text' };

/**
 * The card's shape verbatim: `{ type: 'lookup', referenceTo: 'contacts',
 * dependsOn: ['account'] }`. Synthesised as a RESOLVED `ActionParamDef` on
 * purpose — leg B measures that this cannot be authored as a raw param at all.
 */
const GATED_LOOKUP: ActionParamDef = {
  name: 'contact',
  label: 'Contact',
  type: 'lookup',
  referenceTo: 'contacts',
  dependsOn: ['account'],
};

/** CONTROL — the same lookup, same target, differing ONLY in `dependsOn`. */
const CONTROL_LOOKUP: ActionParamDef = {
  name: 'control_contact',
  label: 'Control contact',
  type: 'lookup',
  referenceTo: 'contacts',
};

/**
 * CONTROL for the KEYSTROKE. A `radio` IS in `CASCADE_OPTION_WIDGET_TYPES`, so
 * the dialog threads its in-progress values to it and this option's predicate
 * re-resolves on every change to `account`. Without it, "the gate did not lift"
 * would also be the reading for a dialog that never saw the keystroke.
 */
const KEYSTROKE_WITNESS: ActionParamDef = {
  name: 'tier',
  label: 'Tier',
  type: 'radio',
  options: [
    { label: 'Enterprise', value: 'ent', visibleWhen: "record.account == 'acme'" },
    { label: 'Small business', value: 'smb', visibleWhen: "record.account == 'other'" },
  ],
};

function openDialog(params: ActionParamDef[]) {
  render(
    <ActionParamDialog
      state={{ open: true, params, resolve: () => {} }}
      onOpenChange={() => {}}
    />,
  );
}

const typeAccount = (value: string) =>
  fireEvent.change(screen.getByLabelText('Account'), { target: { value } });

describe('objectui#8672 leg A — a `dependsOn` lookup param is gated, permanently (CURRENT SHAPE, NOT CONTRACT)', () => {
  it('renders the declared lookup GATED while the control lookup beside it is usable', async () => {
    openDialog([ACCOUNT, GATED_LOOKUP, CONTROL_LOOKUP]);

    // CONTROL first: an identical lookup differing only in `dependsOn` renders a
    // normal, enabled trigger. This is what makes the gated reading below a
    // measurement of `dependsOn` rather than of a lookup that cannot render here.
    const control = await screen.findByTestId('lookup-trigger-control_contact');
    expect(control).toBeEnabled();

    // SUBJECT: the declared lookup renders the gate — disabled, and prompting
    // for the very field the user is about to fill.
    const gated = screen.getByTestId('lookup-trigger-gated');
    expect(gated).toBeDisabled();
    expect(gated).toHaveTextContent('Select account first');
  });

  it('does NOT lift the gate when the named parent is filled — while the same keystroke moves a witness', async () => {
    openDialog([ACCOUNT, GATED_LOOKUP, KEYSTROKE_WITNESS]);

    // Both witness options are offered before anything is typed: `record.account`
    // is unresolvable, which fails OPEN.
    expect(await screen.findByTestId('radio-option-ent')).toBeInTheDocument();
    expect(screen.getByTestId('radio-option-smb')).toBeInTheDocument();
    expect(screen.getByTestId('lookup-trigger-gated')).toBeDisabled();

    typeAccount('acme');

    // ⭐ The keystroke DID reach the dialog and DID re-render it: the witness's
    // offered set narrowed. Load-bearing — it converts the assertion after it
    // from "nothing happened" into "this specific thing did not happen".
    await waitFor(() => expect(screen.queryByTestId('radio-option-smb')).not.toBeInTheDocument());
    expect(screen.getByTestId('radio-option-ent')).toBeInTheDocument();

    // …and the lookup is still gated on the field that now carries `acme`. This
    // assertion is the card. ⛔ It is NOT a statement that it should stay this
    // way — see the file docblock.
    const stillGated = screen.getByTestId('lookup-trigger-gated');
    expect(stillGated).toBeDisabled();
    expect(stillGated).toHaveTextContent('Select account first');
  });

  it('records WHY: the dialog\'s `dependentValues` supply set excludes `lookup`', () => {
    // The mechanism behind the two renders above, stated where it can be found
    // from them. `ActionParamDialog.tsx` supplies `dependentValues` only to
    // members of this set, so a lookup is reached without one and falls through
    // to the context tail that objectui#7206 measured as unconditionally `{}`.
    expect(CASCADE_OPTION_WIDGET_TYPES.has('lookup')).toBe(false);
    // Lit control on the same read: the members that DO get the record.
    expect(CASCADE_OPTION_WIDGET_TYPES.has('radio')).toBe(true);
    expect(CASCADE_OPTION_WIDGET_TYPES.has('select')).toBe(true);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Leg B — where the authoring surface is                  CONTRACT           */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * ⚠️ Unlike legs A and C this leg pins a CONTRACT, not a current shape — but a
 * VERSION-QUALIFIED one: it is a reading of the `@objectstack/spec` this repo
 * has installed, and the answer moves if that schema does. It is here because it
 * is the fact the card's disposition turns on: a refusal for `dependsOn` on an
 * action param already exists, and it lives UPSTREAM.
 */
describe('objectui#8672 leg B — `@objectstack/spec` already refuses `dependsOn` on an action param', () => {
  const param = (over: Record<string, unknown>) => ({
    name: 'contact',
    label: 'Contact',
    type: 'lookup',
    reference: 'contacts',
    ...over,
  });

  it('POSITIVE CONTROL — a lookup action param with no cascade key parses', () => {
    // Without this the refusals below could be a schema that refuses everything.
    expect(ActionParamSchema.safeParse(param({})).success).toBe(true);
  });

  it('NEGATIVE CONTROL — an unknown key is refused, so the schema is live and strict', () => {
    const r = ActionParamSchema.safeParse(param({ zzz_not_a_key: 1 }));
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
  });

  it('SUBJECT — `dependsOn` on a lookup action param is an unrecognized key', () => {
    const r = ActionParamSchema.safeParse(param({ dependsOn: ['account'] }));
    expect(r.success).toBe(false);
    const unrecognized = r.error?.issues.find((i) => i.code === 'unrecognized_keys');
    expect(unrecognized).toBeDefined();
    expect((unrecognized as { keys?: string[] } | undefined)?.keys).toContain('dependsOn');
  });

  it('the refusal is not lookup-specific — a `select` param is refused the same way', () => {
    // Recorded so a disposition author does not read the refusal as a narrow,
    // type-scoped rule it is not: no action param of any type admits `dependsOn`.
    const r = ActionParamSchema.safeParse({
      name: 'city', label: 'City', type: 'select', dependsOn: ['country'],
    });
    expect(r.success).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* Leg C — the field-backed route reads the spelling spec refuses             */
/*                                                         CURRENT SHAPE      */
/* ────────────────────────────────────────────────────────────────────────── */

describe('objectui#8672 leg C — the field-backed route reads `depends_on`, which `FieldSchema` refuses (CURRENT SHAPE, NOT CONTRACT)', () => {
  it('CONTROL — `FieldSchema` accepts camel `dependsOn` on a lookup field and refuses the snake twin by name', () => {
    const base = { name: 'contact_id', label: 'Contact', type: 'lookup', reference: 'contacts' };
    // POSITIVE CONTROL: the field def parses at all.
    expect(FieldSchema.safeParse(base).success).toBe(true);
    // The spelling the spec declares (objectui#7357 retired objectui's twin).
    expect(FieldSchema.safeParse({ ...base, dependsOn: ['account_id'] }).success).toBe(true);
    // …and the spelling `resolveActionParams` actually reads is refused here.
    expect(FieldSchema.safeParse({ ...base, depends_on: ['account_id'] }).success).toBe(false);
  });

  const ctx = (field: Record<string, unknown>): ResolveActionParamsContext => ({
    objectName: 'crm_case',
    objects: [{ name: 'crm_case', fields: { contact_id: field } }] as never,
    fieldLabel: (_o, _f, fallback) => fallback,
  });

  const FIELD_BACKED: RawActionParam[] = [{ field: 'contact_id' }];

  it('a spec-valid field declaring camel `dependsOn` resolves to `dependsOn: undefined`', () => {
    const [resolved] = resolveActionParams(
      FIELD_BACKED,
      ctx({ type: 'lookup', label: 'Contact', reference: 'contacts', dependsOn: ['account_id'] }),
    );
    // ⭐ LIT CONTROL on the same call: a sibling key off the SAME field def DOES
    // arrive, so the `undefined` below cannot be a fixture the resolver never
    // read. Without this the assertion would pass against an empty object.
    expect(resolved.referenceTo).toBe('contacts');
    expect(resolved.type).toBe('lookup');
    // SUBJECT — the cascade key does not survive the route the repo's own
    // `RESOLVED_ONLY_PARAM_KEYS.dependsOn` message points authors to.
    expect(resolved.dependsOn).toBeUndefined();
  });

  it('only the snake spelling — the one the spec refuses — reaches the resolved param', () => {
    const [resolved] = resolveActionParams(
      FIELD_BACKED,
      ctx({ type: 'lookup', label: 'Contact', reference: 'contacts', depends_on: ['account_id'] }),
    );
    expect(resolved.referenceTo).toBe('contacts');
    expect(resolved.dependsOn).toEqual(['account_id']);
  });
});
