// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `ViewNavigationConfig` IS the spec's navigation config (objectui#4588).
 *
 * The card behind this file: `@object-ui/types` published **two** types for one
 * spec object, and they disagreed about whether `mode` may be omitted.
 * `index.ts` re-exports the spec's `NavigationConfig` unchanged, while
 * `objectql.ts` hand-declared a `ViewNavigationConfig` covering the same six
 * keys with `mode` REQUIRED — under a doc comment that itself claimed
 * `@default 'page'`. The spec never asked for that: `packages/spec/src/ui/
 * view.zod.ts:1210` declares `mode: NavigationModeSchema.default('page')`, and
 * a `.default()` lands on the AUTHORING side as `| undefined`, which is why the
 * spec publishes its own type as `z.input< typeof NavigationConfigSchema >`
 * (view.zod.ts:3466). So `{ view: 'summary_view' }` is legal authored metadata
 * that lets the mode default — and it did not type-check against the three
 * schema interfaces that spell `navigation?: ViewNavigationConfig`.
 *
 * This is objectui#4550 / PR objectui#4586 one package over: that one collapsed
 * `@object-ui/react`'s `NavigationConfig` to the spec's authored input. This
 * file pins the same collapse here, so the two published spellings can no
 * longer drift apart again.
 *
 * The assertions are mostly type-level on purpose. They run in
 * `tsc -p tsconfig.test.json` (part of this package's `type-check`), so
 * re-growing a hand copy fails the build rather than waiting for a reviewer to
 * notice — which is the failure mode this card was reported for.
 */

import { describe, it, expect } from 'vitest';
import type {
  NamedListView,
  NavigationConfig,
  ObjectGridSchema,
  ObjectMapSchema,
  ObjectViewSchema,
  ViewNavigationConfig,
} from '../index';

/* ── Type-level helpers ──────────────────────────────────────────────────── */

/** Invariant equality — `extends` both ways would accept a narrowing. */
type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;

/* ── The collapse itself ─────────────────────────────────────────────────── */

/**
 * The whole point of the card: the two names this package publishes for the
 * spec's navigation config are ONE type. `NavigationConfig` is the spec
 * re-export at `index.ts`; `ViewNavigationConfig` is the name `objectql.ts`
 * publishes. If a future edit re-grows a hand copy — even one that starts out
 * byte-identical — this line goes red on the day it drifts.
 */
type _IsExactlyTheSpecInput = Expect< Equal< ViewNavigationConfig, NavigationConfig > >;

/**
 * The six keys the spec declares (`view.zod.ts` `NavigationConfigSchema`).
 * Adding a key here to make a new local read compile is the defect, not the
 * fix: the key has to exist in the spec first, or the platform refuses metadata
 * that declares it.
 */
type SpecDeclaredKeys = 'mode' | 'view' | 'preventNavigation' | 'openNewTab' | 'size' | 'width';

type _KeysAreExactlyTheSpecSix = Expect< Equal< keyof ViewNavigationConfig, SpecDeclaredKeys > >;

/* ── `mode` is optional, because the spec defaults it ────────────────────── */

/**
 * The defect this card names. `undefined` is assignable to `mode` because
 * `.default('page')` makes it optional on the authoring side.
 */
type _ModeIsOptional = Expect<
  Equal< undefined extends ViewNavigationConfig['mode'] ? true : false, true >
>;

/**
 * Membership of the seven modes, pinned through `NonNullable`.
 *
 * A BARE `Equal< ViewNavigationConfig['mode'], …the seven… >` would now be
 * `false` — but for the wrong reason: the `| undefined` that the `.default()`
 * puts there on purpose, not a drift in which modes exist. `NonNullable` keeps
 * this assertion pointed at the thing it guards. (Same care PR objectui#4586
 * took with `_ModeIsConfigMode` one package over.)
 */
type _ModeMembershipIsTheSevenSpecModes = Expect<
  Equal<
    NonNullable< ViewNavigationConfig['mode'] >,
    'page' | 'drawer' | 'modal' | 'split' | 'popover' | 'new_window' | 'none'
  >
>;

/* ── The three schema sites use the shared type ──────────────────────────── */

/**
 * `objectql.ts` spells `navigation?: ViewNavigationConfig` in four interfaces
 * (`ObjectMapSchema` joined them with objectui#5018, which declared the keys
 * `ObjectMap` actually reads).
 * Each must be the spec type itself, so one authoring surface cannot outgrow
 * another — the same guard `objectql.exportOptions.test.ts` puts on
 * `exportOptions`.
 */
type _GridUsesTheSharedType = Expect<
  Equal< NonNullable< ObjectGridSchema['navigation'] >, ViewNavigationConfig >
>;
type _ObjectViewUsesTheSharedType = Expect<
  Equal< NonNullable< ObjectViewSchema['navigation'] >, ViewNavigationConfig >
>;
type _NamedViewUsesTheSharedType = Expect<
  Equal< NonNullable< NamedListView['navigation'] >, ViewNavigationConfig >
>;
type _ObjectMapUsesTheSharedType = Expect<
  Equal< NonNullable< ObjectMapSchema['navigation'] >, ViewNavigationConfig >
>;

/* ── Runtime half ────────────────────────────────────────────────────────── */

describe('ViewNavigationConfig is the spec navigation config (objectui#4588)', () => {
  it('accepts the spec-valid config that omits `mode`', () => {
    // The exact value from the card. Before the collapse this line was
    // `TS2741: Property 'mode' is missing`.
    const navigation: ViewNavigationConfig = { view: 'summary_view' };

    // Runtime half: the type-level assertions above are erased, so without a
    // value that actually omits `mode`, the requirement could come back and
    // this file would still compile.
    expect(Object.keys(navigation)).toEqual(['view']);
    expect(navigation.mode).toBeUndefined();
  });

  it('accepts a mode-less config at each of the three schema sites', () => {
    const grid: Pick< ObjectGridSchema, 'navigation' > = { navigation: { view: 'summary_view' } };
    const view: Pick< ObjectViewSchema, 'navigation' > = { navigation: { view: 'summary_view' } };
    const named: Pick< NamedListView, 'navigation' > = { navigation: { view: 'summary_view' } };

    for (const site of [grid, view, named]) {
      expect(site.navigation?.mode).toBeUndefined();
      expect(site.navigation?.view).toBe('summary_view');
    }
  });

  it('still accepts every spec key, so the collapse did not narrow the surface', () => {
    const full: ViewNavigationConfig = {
      mode: 'drawer',
      view: 'summary_view',
      preventNavigation: false,
      openNewTab: false,
      size: 'lg',
      width: '600px',
    };
    expect(Object.keys(full).sort()).toEqual(
      ['mode', 'openNewTab', 'preventNavigation', 'size', 'view', 'width'],
    );
  });

  it('refuses a mode outside the spec enum', () => {
    const bad: ViewNavigationConfig = {
      // @ts-expect-error 'sidebar' is not one of the seven spec navigation modes
      mode: 'sidebar',
    };
    expect(bad).toBeDefined();
  });

  it('refuses a key the spec does not declare', () => {
    const bad: ViewNavigationConfig = {
      mode: 'page',
      // @ts-expect-error `placement` is not a declared navigation key
      placement: 'right',
    };
    expect(bad).toBeDefined();
  });
});
