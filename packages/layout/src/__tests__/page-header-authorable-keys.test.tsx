/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The `page-header` alias declares only keys `@objectstack/spec` declares
 * (objectui#3226).
 *
 * The legacy kebab key `page-header` and the canonical protocol key
 * `page:header` (in `@object-ui/components`) render the same concept, but this
 * one used to DECLARE a different authorable key for the secondary line:
 * `description`, where the spec's `PageHeaderProps` — and therefore
 * `page:header` — declares `subtitle`. That is not a tolerated legacy spelling,
 * it is a second dialect published on the declaration surface: `inputs` is what
 * the designer offers as fields and what the framework's
 * `check:react-declaration-parity` diffs against the spec schemas, so an author
 * (especially an AI one) was being TOLD `description` was legal. Metadata that
 * took the offer renders a subtitle under `page-header` and silently loses it
 * under `page:header` — the same JSON, two results, which is the failure mode
 * one contract exists to prevent.
 *
 * The cross-check below is deliberately derived from the spec's own shape
 * rather than a hand-written allowlist: a future input added here that the spec
 * does not declare fails for the same reason `description` did, without anyone
 * having to remember this issue.
 *
 * SEQUENCING — SETTLED (objectui#3789). This file used to end with two tests
 * pinning the runtime `subtitle ?? description` read, because the alias existed
 * precisely for out-of-repo consumer schemas: "no in-repo author writes
 * `description`" (true, verified) said nothing about whether anyone does, and
 * dropping the read while metadata still carried the key would have deleted an
 * external page's second line while its title kept rendering — the least
 * reportable failure there is. The gate was a measurement, not a date: every
 * spec-valid position a `page-header` node can occupy had to be shown to pass
 * through a loader that performs the ADR-0087 D2 rewrite
 * `page-header-subtitle-alias` (`description` → `subtitle`). It did not, twice:
 * the conversion walker reached only `regions[].components[]`
 * (objectstack#6775). After objectstack#6776 (slots) and PR #7034 (containers
 * nested to any depth), all seven positions convert — re-measured against the
 * spec build this repo consumes — so the read and its two pins were deleted in
 * the same change. The measurement itself did not go away with them: it is a
 * standing pin in `page-header-subtitle-conversion-coverage.test.ts`, which goes
 * red if that reach ever narrows again.
 *
 * TOMBSTONES — objectui#3829. "Derived from the spec's own shape" was doing less
 * work than it read as. `Object.keys(shape)` reports a key whether the spec
 * ACCEPTS it or REJECTS it by name: an ADR-0087 D2 retirement replaces the
 * member with `z.never()` and leaves the entry in place. So when
 * @objectstack/spec 17.0.0 retired `PageHeaderProps.icon` (objectstack#6946 /
 * PR objectstack#7115), every assertion here that consulted the derived key set
 * went on passing for `icon` — describing a spec key that no longer exists. The
 * derivation now skips tombstones, and the two facts the old reading conflated
 * are stated separately: `actions` is declared because the spec owns it, `icon`
 * is declared because THIS renderer draws it (the canonical `page:header` never
 * did, which is why upstream retired the key at all). The carve-out is a named,
 * issue-backed, self-clearing list rather than a silent pass — see
 * `RENDERER_OWN_DECLARED`.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { PageHeaderProps as SpecPageHeaderProps } from '@objectstack/spec/ui';

import { registerLayout, PageHeader } from '../index';

/** Every key `PageHeaderProps` still LISTS — ADR-0087 tombstones included. */
const specDeclaredKeys = new Set(Object.keys(SpecPageHeaderProps.shape));

/**
 * One `.shape` member's type, unwrapped past `.optional()`.
 *
 * Walking Zod internals is the only way to ask this question, so the probe is
 * guarded by its own non-vacuity test below rather than trusted.
 */
const shapeMemberType = (key: string): string | undefined => {
  const shape = SpecPageHeaderProps.shape as unknown as Record<string, unknown>;
  const member = shape[key] as { unwrap?: () => unknown } | undefined;
  const inner = (typeof member?.unwrap === 'function' ? member.unwrap() : member) as
    | { _def?: { type?: string }; def?: { type?: string } }
    | undefined;
  return inner?._def?.type ?? inner?.def?.type;
};

/**
 * Is this key an ADR-0087 D2 tombstone — still listed, but typed `never` so the
 * contract rejects every value by name with a migration message?
 *
 * The distinction is the whole reason this file changed in objectui#3829. A D2
 * retirement does NOT delete the key from the shape; it REPLACES the member with
 * `z.never()`. So `Object.keys(shape)` keeps answering "yes, declared" for a key
 * the spec refuses — and every assertion below that derived its truth from raw
 * `Object.keys` was therefore FALSE GREEN for `icon` from the moment
 * @objectstack/spec 17.0.0 retired `PageHeaderProps.icon` (objectstack#6946 /
 * PR objectstack#7115). The criterion here is deliberately the same one
 * objectui#3809 converges on repo-wide; when that lands, this local helper is
 * what it replaces.
 */
const isTombstoned = (key: string): boolean => shapeMemberType(key) === 'never';

/** Authorable keys of the spec node this renderer serves — tombstones excluded. */
const specKeys = new Set([...specDeclaredKeys].filter((key) => !isTombstoned(key)));

/**
 * Keys this ALIAS declares on a renderer-read fact the spec no longer carries.
 *
 * Exactly one entry, and it is a ruling rather than a shortcut: objectui#3829
 * measured `page:header.icon` after upstream retired it and found the two
 * renderers disagree. The CANONICAL `page:header` never read the key — which is
 * why the spec retired it, and why the metadata-admin designer's icon field for
 * that block was removed in the same change. This alias renderer DOES read it
 * (`PageHeader.tsx:123`, drawn at `:231-233`), `content/docs/layout/
 * page-header.mdx` publishes the prop, and the docs page's only live demo writes
 * `"icon": "users"`. Withdrawing the input would delete a working capability and
 * break that demo, so route A was taken: keep the input, and stop pretending the
 * spec is what licenses it.
 *
 * The residual risk is named rather than hidden: `icon` now renders under
 * `page-header` and is rejected by name under `page:header`, which is one key
 * with two outcomes — the failure mode a single contract exists to prevent. It
 * is accepted only because this alias is the legacy registration and the
 * capability is real; if the canonical renderer ever grows the same drawing, the
 * right move is to un-retire the key upstream, not to widen this list.
 */
const RENDERER_OWN_DECLARED: Record<string, string> = {
  icon: 'Retired upstream as an ADR-0087 D2 tombstone by objectstack#6946 / PR objectstack#7115 because the CANONICAL page:header renderer never read it. This alias renderer reads and draws it (PageHeader.tsx:123, :231-233), the docs page publishes it and its live demo writes it, so objectui#3829 ruled the input stays — declared on the renderer read, not on spec parity.',
};

const declaredInputs = (type: string, namespace?: string) => {
  const config = ComponentRegistry.getConfig(type, namespace);
  if (!config) throw new Error(`"${namespace ? `${namespace}:${type}` : type}" is not registered`);
  return config.inputs ?? [];
};

const declaredInputNames = (type: string, namespace?: string): string[] =>
  declaredInputs(type, namespace).map((input) => input.name);

beforeAll(() => {
  registerLayout();
});

describe('the `page-header` registration declares the spec key, not a dialect', () => {
  it('is registered under the bare key and its namespace', () => {
    expect(ComponentRegistry.getConfig('page-header')).toBeTruthy();
    expect(ComponentRegistry.getConfig('page-header', 'layout')).toBeTruthy();
  });

  // The one assertion this issue is about: whatever else changes, the
  // declaration surface must never advertise `description` again.
  it.each([
    ['page-header', undefined],
    ['page-header', 'layout'],
  ])('does not advertise `description` on %s (namespace: %s)', (type, namespace) => {
    expect(declaredInputNames(type, namespace)).not.toContain('description');
  });

  it('declares `subtitle` — the spec key for the secondary line', () => {
    expect(declaredInputNames('page-header')).toContain('subtitle');
    expect(specKeys.has('subtitle')).toBe(true);
    // …and the spec has no `description` at all, which is the whole reason the
    // old declaration was wrong rather than merely redundant.
    expect(specKeys.has('description')).toBe(false);
  });

  it('the tombstone probe really reads the spec — not `undefined` for everything', () => {
    // Guards `isTombstoned`, not the subject. A Zod-internals change that made
    // `shapeMemberType` return `undefined` everywhere would silently restore the
    // raw `Object.keys` behaviour this file exists to stop, and every assertion
    // below would go green describing nothing. Both directions are pinned: a
    // known tombstone reads `never`, a known live key does not.
    expect(specDeclaredKeys.size).toBeGreaterThan(0);
    expect(shapeMemberType('title')).toBeTruthy();
    expect(isTombstoned('title')).toBe(false);
    expect(isTombstoned('icon')).toBe(true);
    // …and the narrowing is not a no-op, which is the third way this could rot.
    expect(specKeys.size).toBeLessThan(specDeclaredKeys.size);
  });

  it('declares nothing `@objectstack/spec` accepts, beyond the declared renderer-own keys', () => {
    // objectui#3226's original assertion, on the narrowed key set. `specKeys`
    // used to be raw `Object.keys(shape)`, which counted a retired `icon` as a
    // spec key and let this test pass for the wrong reason.
    const offSpec = declaredInputNames('page-header')
      .filter((name) => !specKeys.has(name))
      .filter((name) => !(name in RENDERER_OWN_DECLARED));
    expect(offSpec).toEqual([]);
  });

  it('every renderer-own declaration is licensed by a tombstone and says why', () => {
    // What keeps `RENDERER_OWN_DECLARED` from becoming the dialect door
    // objectui#3226 closed. An entry is legal only for a key the spec ONCE
    // declared and has since retired — a key the spec never had is `showBack`,
    // and that one is pinned as NOT declared further down. Each clause is
    // self-clearing: un-retire the key upstream and the tombstone assertion
    // reds, drop the input and the first one does.
    for (const [name, reason] of Object.entries(RENDERER_OWN_DECLARED)) {
      expect(declaredInputNames('page-header'), `${name} is allowed but not declared`).toContain(
        name,
      );
      expect(specDeclaredKeys.has(name), `${name} was never a spec key — that is a dialect`).toBe(
        true,
      );
      expect(isTombstoned(name), `${name} is live spec; it needs no carve-out`).toBe(true);
      expect(/#\d+/.test(reason), `${name} needs a tracking issue`).toBe(true);
    }
  });
});

describe('the `page-header` registration declares the child slot it renders (objectui#3900)', () => {
  // Same principle as the `inputs` narrowing above, other direction: the
  // declaration face must not DENY a surface the component serves either.
  // `PageHeader.tsx:182` deliberately renders `schema.children` into the
  // right-hand slot, `content/docs/layout/page-header.mdx` publishes that slot's
  // precedence, and the docs page's only live demo is exactly that shape — while
  // the registration omitted `isContainer`, so `sdui-parser`'s `not-a-container`
  // diagnostic fired on it. Nothing on the render path reads the flag, so the
  // omission broke no rendering; it made the validator tell authors (AI authors
  // especially) that a documented, demo-verified schema was invalid, which is
  // how the true `not-a-container` reports lose their credibility.
  //
  // Not an extension of the spec's authoring surface: `children` is a base
  // property of every node in objectui's JSON protocol (`BASE_PROPS` in
  // `sdui-parser/src/validate.ts`), not a key of `PageHeaderProps` — hence the
  // `specKeys` cross-check above neither covers nor contradicts this.
  //
  // The end-to-end half of this pin — the real demo JSON through the manifest
  // the app actually builds, plus the control proving the diagnostic still fires
  // for a genuinely childless component — lives in
  // `examples/schema-catalog/test/pageheader-with-actions.test.tsx`, next to the
  // fixture it validates.
  it.each([
    ['page-header', undefined],
    ['page-header', 'layout'],
  ])('marks %s (namespace: %s) as a container', (type, namespace) => {
    expect(ComponentRegistry.getConfig(type, namespace)?.isContainer).toBe(true);
  });
});

describe('the `page-header` registration declares the keys the renderer reads (objectui#3972)', () => {
  // The `declares nothing @objectstack/spec accepts` test above is ONE-WAY: it
  // catches a declared key the spec rejects, and can never catch a spec key the
  // renderer honours while `inputs` omits it. That omission is not a documentation
  // gap — `sdui-parser/src/validate.ts:70-77` reports `unknown-prop` for any
  // top-level key not in `inputs`, so the manifest gate warned authors off keys
  // this component renders. `icon` was live on the repo's own documented demo.
  //
  // Both keys pass the renderer-read × `ManifestInputType` halves of the audit;
  // the omissions below pin the audit's negative results, which is what keeps
  // this from becoming "copy the spec's shape into `inputs`".
  //
  // They no longer share a THIRD face, which is why the two are split rather
  // than kept in one `it.each`. `actions` is a live spec key and is declared on
  // spec parity; `icon` is an ADR-0087 tombstone and is declared on the renderer
  // read alone (objectui#3829). One assertion cannot state both facts, and the
  // version that tried — `expect(specKeys.has(name)).toBe(true)` for both — was
  // green only because the retired member was still listed in the raw shape.
  const declaresWithType = (name: string, type: string) => {
    for (const namespace of [undefined, 'layout']) {
      const input = declaredInputs('page-header', namespace).find((i) => i.name === name);
      expect(input, `page-header (namespace: ${namespace}) does not declare \`${name}\``).toBeTruthy();
      expect(input?.type).toBe(type);
    }
  };

  it('declares `actions` with type `array`, on both registration keys', () => {
    declaresWithType('actions', 'array');
    // …and it is legal to declare because the spec owns the key. If the spec
    // ever drops it, this line fails here rather than as a mystery parity red.
    expect(specKeys.has('actions')).toBe(true);
  });

  it('declares `icon` with type `string` on both keys — on the renderer read, not spec parity', () => {
    // The assertion this issue moved. What is pinned is the ALIAS INPUT ITSELF:
    // the input exists, on both registration keys, spelled `string` because the
    // authorable form is an icon name. That is the fact the docs page and its
    // live demo depend on, and it is unaffected by the spec key's retirement.
    declaresWithType('icon', 'string');
    // What DID change is the licence. `icon` is no longer a key the spec
    // accepts, so the old `expect(specKeys.has('icon')).toBe(true)` is now
    // asserted in reverse — and the two lines under it are why that is a
    // retirement rather than a deletion, which is exactly what the raw
    // `Object.keys` reading could not tell apart.
    expect(specKeys.has('icon')).toBe(false);
    expect(specDeclaredKeys.has('icon')).toBe(true);
    expect(isTombstoned('icon')).toBe(true);
    // The carve-out is stated, not implied: `RENDERER_OWN_DECLARED` is what the
    // dialect guard above consults, and its own discipline test licenses this.
    expect(Object.keys(RENDERER_OWN_DECLARED)).toContain('icon');
  });

  it('does not declare `breadcrumb` — a spec key this renderer never reads', () => {
    // The other direction of the same audit, and the reason it is not "declare
    // every spec key": `PageHeader.tsx` has no `breadcrumb` read point at all
    // (the word occurs only in a comment and an `aria-label`). Declaring it would
    // publish configuration the component silently drops — objectui#3829's defect,
    // which is the exact mistake this file's positive assertions could invite.
    expect(specKeys.has('breadcrumb')).toBe(true);
    expect(declaredInputNames('page-header')).not.toContain('breadcrumb');
  });

  // `description` used to ride in this list, on the same "read by the renderer,
  // not a spec key" footing. objectui#3789 removed the read, so it no longer
  // belongs here — and nothing is lost by dropping it, because the assertion
  // that the DECLARATION never re-advertises it is stated outright above
  // ("does not advertise `description` on %s"), which is the guard that matters.
  it.each(['showBack', 'action'])(
    'does not declare `%s` — read by the renderer, but no spec key exists',
    (name) => {
      expect(specKeys.has(name)).toBe(false);
      expect(declaredInputNames('page-header')).not.toContain(name);
    },
  );
});

describe('the retired `description` alias is not read at runtime (objectui#3789)', () => {
  // The other half of the retirement, asserted on the RENDERED output rather
  // than the declaration surface: `description` is now an ordinary unknown
  // prop. `PageHeaderComponentProps` extends `HTMLAttributes<HTMLDivElement>`,
  // so passing it does not fail `tsc` — it is spread onto the wrapper div —
  // which is exactly why the assertion has to be "the text does not render"
  // rather than "the type rejects it".
  it('renders no secondary line for a lone `description`', () => {
    render(
      // @ts-expect-error — the retired alias is not a prop of this component.
      <PageHeader title="Customer Details" description="View and edit customer information" />,
    );
    expect(screen.getByText('Customer Details')).toBeTruthy();
    expect(screen.queryByText('View and edit customer information')).toBeNull();
  });

  it('renders `subtitle` and only `subtitle` when both are present', () => {
    render(
      // @ts-expect-error — the retired alias is not a prop of this component.
      <PageHeader title="Customer Details" subtitle="From the spec" description="From the alias" />,
    );
    expect(screen.getByText('From the spec')).toBeTruthy();
    expect(screen.queryByText('From the alias')).toBeNull();
  });
});
