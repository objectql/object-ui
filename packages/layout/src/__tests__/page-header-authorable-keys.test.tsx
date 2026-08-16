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
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { PageHeaderProps as SpecPageHeaderProps } from '@objectstack/spec/ui';

import { registerLayout, PageHeader } from '../index';

/** Authorable keys of the spec node this renderer serves. */
const specKeys = new Set(Object.keys(SpecPageHeaderProps.shape));

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

  it('declares nothing `@objectstack/spec` does not', () => {
    const offSpec = declaredInputNames('page-header').filter((name) => !specKeys.has(name));
    expect(offSpec).toEqual([]);
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
  // The `declares nothing @objectstack/spec does not` test above is ONE-WAY: it
  // catches a declared key the spec rejects, and can never catch a spec key the
  // renderer honours while `inputs` omits it. That omission is not a documentation
  // gap — `sdui-parser/src/validate.ts:70-77` reports `unknown-prop` for any
  // top-level key not in `inputs`, so the manifest gate warned authors off keys
  // this component renders. `icon` was live on the repo's own documented demo.
  //
  // Both keys pass the same three-face test (renderer read point × spec key ×
  // a `ManifestInputType` that can spell the value); the omissions below pin the
  // audit's negative results, which is what keeps this from becoming "copy the
  // spec's shape into `inputs`".
  it.each([
    ['icon', 'string'],
    ['actions', 'array'],
  ])('declares `%s` with type `%s`, on both registration keys', (name, type) => {
    for (const namespace of [undefined, 'layout']) {
      const input = declaredInputs('page-header', namespace).find((i) => i.name === name);
      expect(input, `page-header (namespace: ${namespace}) does not declare \`${name}\``).toBeTruthy();
      expect(input?.type).toBe(type);
    }
    // …and it is legal to declare only because the spec owns the key. If the spec
    // ever drops it, this line fails here rather than as a mystery parity red.
    expect(specKeys.has(name)).toBe(true);
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
