/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4075 — the row must be bound the THREE canonical ways on the action
 * face, not just at the bare root.
 *
 * `useCondition(pred, ctx)` evaluates on `new ExpressionEvaluator({ ...scope,
 * ...ctx })`, so a context bag that is the row spread flat resolves the
 * shorthand spelling (`status == 'pending'`) and nothing else. The CANONICAL
 * spelling is the `record.` root — it is what `ExpressionEvaluator`'s CEL path
 * binds (`bag.record` as the record namespace), what `evalRowPredicate` binds
 * on the record header and on list rows (`record.status` / bare `status` /
 * `data.status`), and what the server enforces with. Under a root-only bag
 * `record.viewer.can_act` does not read as `false`: the legacy evaluator throws
 * `record is not defined`, and on a fail-closed `visible` that throw becomes
 * "hidden" — a correctly-authored predicate silently deletes its own button.
 *
 * `DeclaredActionsBar` carried the same root-only binding and suppressed the
 * ENTIRE server-declared approval decision set (every `sys_approval_request`
 * action gates on `record.viewer.*`); PR #4077 fixed it there by binding the
 * row all three ways. These four generic renderers still carried the original
 * binding, and two of them — `action:menu`'s item and `action:group`'s two
 * leaves — had no record in scope at all, so even the shorthand could not
 * resolve.
 *
 * ## What each block pins, and in which direction
 *
 * Per site, three roots × two polarities, plus the fault case:
 *
 *   • `record.*` true / false  — THE defect. Before the fix the true case is
 *     the red one on a fail-CLOSED `visible` (the throw hides a holding gate);
 *     on a fail-SOFT leg it is the FALSE case that is red (the throw returns
 *     the fail-soft `true`, i.e. shown / disabled / enabled). Both polarities
 *     are asserted at every site precisely because only one of them can be red
 *     at a time, and which one depends on that site's error policy.
 *   • bare `status` true / false — the shorthand is ALSO legal and must keep
 *     working; these are the anti-regression half. On `action:menu` /
 *     `action:group` they are red before the fix too (no record at all).
 *   • `data.*` true / false — the third root `evalRowPredicate` binds, so the
 *     action face and the row surfaces answer one authoring question one way.
 *   • a genuinely faulting predicate (`nope.deep == 1`, an unbound root) keeps
 *     each site's EXISTING error policy. Fail-closed is the policy on
 *     `action:button` / `action:menu` `visible`; the fault case is not what
 *     this PR changes, and the fail-soft legs are pinned as fail-soft rather
 *     than quietly converted (the per-site policy table is #3871's, in
 *     `action-template-predicate-gate.test.tsx`).
 *
 * Every "not rendered" assertion carries an ungated companion, so a green can
 * never mean "the host itself vanished".
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import { PredicateScopeProvider } from '@object-ui/react';
// Module-scope side-effect imports so the renderers are registered before the
// first render — the light `dom` project deliberately does not load the
// `@object-ui/components` graph. Module scope, not a `beforeAll`, per AGENTS.md
// §测试纪律: the cost lands in the import phase, unbounded by any hook timeout.
import '../action-button';
import '../action-icon';
import '../action-bar';
import '../action-menu';
import '../action-group';

/**
 * The row every case evaluates against. `viewer.can_act` is the real shape
 * from the approval family (framework#3310 / #3424) — nested, so a predicate
 * that only ever reads a flat scalar cannot pass by accident.
 */
const ROW = { id: 'r1', status: 'pending', viewer: { can_act: true } };

/** The same question asked through each of the three canonical roots. */
const HOLDS = {
  record: "record.status == 'pending'",
  bare: "status == 'pending'",
  data: "data.status == 'pending'",
} as const;
const FAILS = {
  record: "record.status == 'closed'",
  bare: "status == 'closed'",
  data: "data.status == 'closed'",
} as const;
/** The nested read the approval actions actually ship. */
const NESTED = 'record.viewer.can_act == true';
/** A genuinely faulting predicate — `nope` is bound nowhere. */
const FAULT = 'nope.deep == 1';

const LABEL = 'Act';
const COMPANION = { name: 'view', label: 'View', type: 'script' };

function getRenderer(type: string) {
  const R = ComponentRegistry.get(type);
  if (!R) throw new Error(`${type} is not registered`);
  return R;
}

const shown = () => expect(screen.queryByText(LABEL)).toBeInTheDocument();
const hidden = () => {
  expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
  expect(screen.getByText('View')).toBeInTheDocument();
};

/**
 * Open a real Radix dropdown host. Radix opens on `pointerdown` (a plain
 * `.click()` does nothing), and the content mounts in a portal on the next
 * tick — so the companion is awaited, which doubles as the "the host itself is
 * alive" check every `hidden()` assertion below depends on.
 */
async function openMenu(name: string | RegExp) {
  const trigger = screen.getByRole('button', { name });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  await waitFor(() => expect(screen.getByText('View')).toBeInTheDocument());
}

// ---------------------------------------------------------------------------
// action:button — the record arrives as the `data` prop (action:bar forwards it)
// ---------------------------------------------------------------------------

/** Mounted the way `action:bar` mounts a member: action spread onto `schema`. */
function mountButton(action: any) {
  const Renderer = getRenderer('action:button');
  return render(
    <div>
      <Renderer schema={{ ...action, type: 'action:button', actionType: 'script' }} data={ROW} />
      <Renderer schema={{ ...COMPANION, type: 'action:button', actionType: 'script' }} data={ROW} />
    </div>,
  );
}

describe('action:button — the row binds three ways (objectui#4075)', () => {
  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
    ['record.* nested', NESTED],
  ])('a holding `visible` written as %s renders the button', (_root, visible) => {
    mountButton({ name: 'act', label: LABEL, visible });
    shown();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `visible` written as %s hides the button', (_root, visible) => {
    mountButton({ name: 'act', label: LABEL, visible });
    hidden();
  });

  it('`visible` still fails CLOSED on a genuinely faulting predicate', () => {
    mountButton({ name: 'act', label: LABEL, visible: FAULT });
    hidden();
  });

  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
  ])('a holding `disabled` written as %s greys the button', (_root, disabled) => {
    mountButton({ name: 'act', label: LABEL, disabled });
    expect(screen.getByText(LABEL).closest('button')).toBeDisabled();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `disabled` written as %s leaves the button clickable', (_root, disabled) => {
    mountButton({ name: 'act', label: LABEL, disabled });
    expect(screen.getByText(LABEL).closest('button')).not.toBeDisabled();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing legacy `enabled` written as %s greys the button', (_root, enabled) => {
    mountButton({ name: 'act', label: LABEL, enabled });
    expect(screen.getByText(LABEL).closest('button')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// action:icon — read the `data` prop at all (it used to land in `...rest`)
// ---------------------------------------------------------------------------

function mountIcon(action: any) {
  const Renderer = getRenderer('action:icon');
  return render(
    <div>
      <Renderer schema={{ ...action, type: 'action:icon', actionType: 'script' }} data={ROW} />
      <Renderer schema={{ ...COMPANION, type: 'action:icon', actionType: 'script' }} data={ROW} />
    </div>,
  );
}

const iconShown = () => expect(screen.queryByLabelText(LABEL)).toBeInTheDocument();
const iconHidden = () => {
  expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
  expect(screen.getByLabelText('View')).toBeInTheDocument();
};

describe('action:icon — the row binds three ways (objectui#4075)', () => {
  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
    ['record.* nested', NESTED],
  ])('a holding `visible` written as %s renders the icon', (_root, visible) => {
    mountIcon({ name: 'act', label: LABEL, visible });
    iconShown();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `visible` written as %s hides the icon', (_root, visible) => {
    mountIcon({ name: 'act', label: LABEL, visible });
    iconHidden();
  });

  it('`visible` keeps its EXISTING fail-soft policy on a faulting predicate', () => {
    // Not what this PR decides: `action:icon` has never passed `throwOnError`
    // on `visible` (#3871's table). Pinned so the binding fix cannot be read as
    // having quietly changed the error policy too.
    mountIcon({ name: 'act', label: LABEL, visible: FAULT });
    iconShown();
  });

  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
  ])('a holding `disabled` written as %s greys the icon', (_root, disabled) => {
    mountIcon({ name: 'act', label: LABEL, disabled });
    expect(screen.getByLabelText(LABEL)).toBeDisabled();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `disabled` written as %s leaves the icon clickable', (_root, disabled) => {
    mountIcon({ name: 'act', label: LABEL, disabled });
    expect(screen.getByLabelText(LABEL)).not.toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// action:menu — its items had NO record in scope; the host must supply the row
// ---------------------------------------------------------------------------

/** The real `action:menu` host, mounted with the row and opened. */
async function mountMenu(action: any) {
  const Renderer = getRenderer('action:menu');
  const r = render(
    <Renderer
      schema={{ type: 'action:menu', label: 'More', actions: [action, COMPANION] }}
      data={ROW}
    />,
  );
  await openMenu('More');
  return r;
}

describe('action:menu item — the row binds three ways (objectui#4075)', () => {
  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
    ['record.* nested', NESTED],
  ])('a holding `visible` written as %s renders the menu item', async (_root, visible) => {
    await mountMenu({ name: 'act', label: LABEL, type: 'script', visible });
    shown();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `visible` written as %s hides the menu item', async (_root, visible) => {
    await mountMenu({ name: 'act', label: LABEL, type: 'script', visible });
    hidden();
  });

  it('a menu item `visible` still fails CLOSED on a faulting predicate', async () => {
    await mountMenu({ name: 'act', label: LABEL, type: 'script', visible: FAULT });
    hidden();
  });

  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
  ])('a holding `disabled` written as %s greys the menu item', async (_root, disabled) => {
    await mountMenu({ name: 'act', label: LABEL, type: 'script', disabled });
    expect(screen.getByText(LABEL).closest('[role="menuitem"]')).toHaveAttribute(
      'data-disabled',
    );
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `disabled` written as %s leaves the menu item live', async (_root, disabled) => {
    await mountMenu({ name: 'act', label: LABEL, type: 'script', disabled });
    expect(screen.getByText(LABEL).closest('[role="menuitem"]')).not.toHaveAttribute(
      'data-disabled',
    );
  });
});

// ---------------------------------------------------------------------------
// action:group — both display modes; its two leaves had no record either
// ---------------------------------------------------------------------------

async function mountInlineGroup(action: any) {
  const Group = getRenderer('action:group');
  return render(
    <Group
      schema={{ type: 'action:group', display: 'inline', actions: [action, COMPANION] }}
      data={ROW}
    />,
  );
}

async function mountDropdownGroup(action: any) {
  const Group = getRenderer('action:group');
  const r = render(
    <Group
      schema={{ type: 'action:group', display: 'dropdown', label: 'More', actions: [action, COMPANION] }}
      data={ROW}
    />,
  );
  await openMenu(/More/);
  return r;
}

describe.each([
  ['inline', mountInlineGroup],
  ['dropdown', mountDropdownGroup],
])('action:group %s leaf — the row binds three ways (objectui#4075)', (_mode, mount) => {
  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
    ['record.* nested', NESTED],
  ])('a holding `visible` written as %s renders the action', async (_root, visible) => {
    await mount({ name: 'act', label: LABEL, type: 'script', visible });
    shown();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `visible` written as %s hides the action', async (_root, visible) => {
    await mount({ name: 'act', label: LABEL, type: 'script', visible });
    hidden();
  });

  it('`visible` keeps its EXISTING fail-soft policy on a faulting predicate', async () => {
    // As with `action:icon`: `action:group`'s leaves have never passed
    // `throwOnError` (#3871's table). The binding fix does not change it.
    await mount({ name: 'act', label: LABEL, type: 'script', visible: FAULT });
    shown();
  });
});

// ---------------------------------------------------------------------------
// No row at the render site — binding must not blank out an ambient `record`
// ---------------------------------------------------------------------------

describe('a host with no row of its own does not shadow the ambient scope (objectui#4075)', () => {
  /**
   * A host may supply the row through the predicate SCOPE instead of a prop
   * (that is how `action-group-dropdown-visible.test.tsx` drives these leaves).
   * `useCondition` merges the local context OVER the scope, so binding an empty
   * record for "no row here" would blank that out — "this surface has no row"
   * and "this surface's row is empty" are different statements, and only the
   * second may shadow the scope. Caught as a regression by the existing suite,
   * pinned here so the distinction is stated where the binding rule is.
   */
  it('an ambient `record` still resolves when the renderer is given no `data`', () => {
    const Renderer = getRenderer('action:button');
    render(
      <PredicateScopeProvider scope={{ record: ROW }}>
        <Renderer
          schema={{ name: 'act', label: LABEL, type: 'action:button', actionType: 'script', visible: HOLDS.record }}
        />
        <Renderer
          schema={{ ...COMPANION, type: 'action:button', actionType: 'script' }}
        />
      </PredicateScopeProvider>,
    );
    shown();
  });

  it('a `data` prop still WINS over an ambient `record` when both are present', () => {
    const Renderer = getRenderer('action:button');
    render(
      <PredicateScopeProvider scope={{ record: { status: 'closed' } }}>
        <Renderer
          schema={{ name: 'act', label: LABEL, type: 'action:button', actionType: 'script', visible: HOLDS.record }}
          data={ROW}
        />
        <Renderer
          schema={{ ...COMPANION, type: 'action:button', actionType: 'script' }}
        />
      </PredicateScopeProvider>,
    );
    shown();
  });
});

// ---------------------------------------------------------------------------
// action:bar overflow — the bar forwards `data` inline but not into the
// overflow menu it builds, so an overflowed action lost the row entirely
// ---------------------------------------------------------------------------

describe('action:bar overflow menu — the row reaches an overflowed action (objectui#4075)', () => {
  async function mountBarOverflow(action: any) {
    const Bar = getRenderer('action:bar');
    const r = render(
      <Bar
        schema={{ type: 'action:bar', maxVisible: 0, actions: [action, COMPANION] }}
        data={ROW}
      />,
    );
    await openMenu('More actions');
    return r;
  }

  it.each([
    ['record.*', HOLDS.record],
    ['bare', HOLDS.bare],
    ['data.*', HOLDS.data],
    ['record.* nested', NESTED],
  ])('a holding `visible` written as %s renders the overflowed action', async (_root, visible) => {
    await mountBarOverflow({ name: 'act', label: LABEL, type: 'script', visible });
    shown();
  });

  it.each([
    ['record.*', FAILS.record],
    ['bare', FAILS.bare],
    ['data.*', FAILS.data],
  ])('a failing `visible` written as %s hides the overflowed action', async (_root, visible) => {
    await mountBarOverflow({ name: 'act', label: LABEL, type: 'script', visible });
    hidden();
  });
});
