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
 * SEQUENCING — read before "finishing the job". `PageHeader.tsx` still READS
 * `subtitle ?? description` at runtime, and the last test in this file pins
 * that on purpose. The alias exists precisely for out-of-repo consumer schemas,
 * so "no in-repo author writes `description`" (true, verified) says nothing
 * about whether anyone does; dropping the read today would delete an external
 * page's second line while its title kept rendering — the least reportable
 * failure there is. The read goes away together with the ADR-0087 D2 conversion
 * entry `page-header-subtitle-alias` (`description` → `subtitle` rewritten at
 * load time), which lives in the framework repo. Narrowing the DECLARATION did
 * not need to wait on it and changes no runtime behaviour; deleting the READ
 * does. When that conversion lands, delete the fallback AND the last test here
 * in one change.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { PageHeaderProps as SpecPageHeaderProps } from '@objectstack/spec/ui';

import { registerLayout, PageHeader } from '../index';

/** Authorable keys of the spec node this renderer serves. */
const specKeys = new Set(Object.keys(SpecPageHeaderProps.shape));

const declaredInputNames = (type: string, namespace?: string): string[] => {
  const config = ComponentRegistry.getConfig(type, namespace);
  if (!config) throw new Error(`"${namespace ? `${namespace}:${type}` : type}" is not registered`);
  return (config.inputs ?? []).map((input) => input.name);
};

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

describe('the runtime `description` fallback stays until the conversion entry lands', () => {
  // NOT an endorsement of the alias — a guard on the ORDER. Removing this read
  // before `page-header-subtitle-alias` exists is the deletion route that was
  // considered and rejected: external schemas authored with `description` would
  // lose their subtitle silently. Delete this test in the same change that
  // deletes the fallback, once the conversion rewrites the key upstream.
  it('still renders a legacy `description` as the secondary line', () => {
    render(<PageHeader title="Customer Details" description="View and edit customer information" />);
    expect(screen.getByText('View and edit customer information')).toBeTruthy();
  });

  it('lets the spec key win when both are present', () => {
    render(<PageHeader title="Customer Details" subtitle="From the spec" description="From the alias" />);
    expect(screen.getByText('From the spec')).toBeTruthy();
    expect(screen.queryByText('From the alias')).toBeNull();
  });
});
