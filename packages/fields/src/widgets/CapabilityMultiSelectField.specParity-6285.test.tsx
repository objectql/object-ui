/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6285 — `CURATED_CAPABILITY_LABELS` equals `@objectstack/spec/security`'s
 * `PLATFORM_CAPABILITIES`, and every member of it reaches the screen as a
 * localized label.
 *
 * ## What went wrong, and why nothing caught it
 *
 * The declaration was a seven-member list under a doc comment claiming it
 * mirrored `PLATFORM_CAPABILITIES`. The spec grew an eighth member
 * (`manage_sharing`) and the list did not follow, so that capability fell
 * through to `byName.get(name)?.label` — the English label the `sys_capability`
 * registry serves — and rendered untranslated in all ten packs, beside seven
 * siblings that localize. Every gate stayed green, and the reason is exact:
 * `scripts/check-i18n-call-site-keys.mjs` reads this declaration as the
 * `capability.label.` family's vocabulary and checks that each member it names
 * has an `en` key. All seven did. No instrument compared the vocabulary to the
 * array it was named after, so the member the list never mentioned was invisible
 * to the entire toolchain.
 *
 * This file is that missing comparison. It is the reason the list is allowed to
 * stay a repo-local literal (see the declaration's own comment for why a runtime
 * derivation was measured and declined), and it is deliberately the same shape
 * as `packages/app-shell/src/hooks/__tests__/tenancyPostureWall.parity.test.ts`:
 * a local restatement, held to the protocol by a test that imports the protocol.
 * Tests are not bundled, so the assertion is free.
 *
 * ## Two layers, and both are needed
 *
 *   - SOURCE parity — the member set equals the spec's names, in both
 *     directions. Read with the i18n gate's OWN `readVocabulary`, so what this
 *     file pins is precisely what that gate consumes; a rewrite that made the
 *     declaration unreadable to the gate would fail here first, instead of
 *     silently downgrading the gate to a prefix check.
 *   - RENDERED parity — each member resolves to a real localized string on
 *     screen. Source parity alone would pass with the label table empty, and the
 *     `en` table alone says nothing about `useFieldTranslation`'s provider-less
 *     defaults map, which is what actually renders when no I18nProvider is
 *     mounted.
 *
 * Every registry row fed in below carries a label deliberately UNLIKE the
 * localized one (`REGISTRY …`). "The picker renders" passes in both worlds; each
 * assertion here is written to fail in exactly one. If the list regressed — or
 * if `labelFor`'s `defaultValue` fallback were doing the rendering instead of a
 * real translation — `REGISTRY …` is what would appear, and the equality reports
 * it by name.
 *
 * The dotted members are their own case. The spec spells `setup.access`,
 * `setup.write` and `studio.access` with a dot; the keys spell them with an
 * underscore, and `labelFor` bridges that with `name.replace(/\./g, '_')`. The
 * transform is restated in this file ON PURPOSE rather than imported from the
 * widget: a pin that shares the implementation's own helper moves when the
 * implementation moves and pins nothing.
 *
 * ## PREDICTIONS, written before the run
 *
 * On this branch: all green. Against the pre-fix declaration (seven members, no
 * `capability.label.manage_sharing` key), expected RED on source parity, on the
 * `en`-coverage assertion, and on the two rendering assertions that name
 * `manage_sharing`; expected GREEN on the dotted-member, orphan and non-vacuity
 * assertions, which describe behaviour the seven-member list already had.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PLATFORM_CAPABILITIES } from '@objectstack/spec/security';
import { builtInLocales } from '@object-ui/i18n';
// The i18n gate's own source reader (objectui#4964). Importing it — rather than
// re-implementing a regex — is what makes "the vocabulary that gate consumes"
// and "the thing this file pins" the same object. Plain JS, untyped here, the
// same arrangement `packages/layout/src/__tests__/readme-registration-keys.test.ts`
// uses for `scripts/component-registrations.mjs`.
// @ts-expect-error — plain-JS shared helper, intentionally untyped
import { readVocabulary } from '../../../../scripts/check-i18n-call-site-keys.mjs';
import { CapabilityMultiSelectField } from './CapabilityMultiSelectField';

/**
 * The root `readVocabulary` resolves `module` against. `'.'` — the process cwd —
 * IS the repo root here, and not by luck: `scripts/vitest-invocation-guard.mjs`
 * refuses any invocation whose vitest root is not the repo root (objectui#3378,
 * #3288), which is the same invariant. Spelled this way rather than as
 * `resolve(__dirname, '../../../..')` because this package's test program
 * deliberately does not name `types: ['node']` — see the long note in
 * `packages/fields/tsconfig.test.json` — and a test file is not the place to
 * change that program. If the invariant ever broke, `declaredMembers()` throws
 * the message below rather than reporting an empty vocabulary.
 */
const VOCABULARY_ROOT = '.';

/** The registry entry `check-i18n-call-site-keys.mjs` declares for this family. */
const VOCABULARY = {
  module: 'packages/fields/src/widgets/CapabilityMultiSelectField.tsx',
  name: 'CURATED_CAPABILITY_LABELS',
  kind: 'set',
} as const;

/**
 * The dot -> underscore transform `labelFor` applies before building the key.
 * Deliberately a second statement of it (see the header).
 */
const keyPart = (specName: string) => specName.replace(/\./g, '_');

/** Spec member names in the alphabet the i18n keys are written in. */
const specKeyParts = () => PLATFORM_CAPABILITIES.map((c) => keyPart(c.name)).sort();

/** The declaration, read exactly as the i18n gate reads it. */
const declaredMembers = (): string[] => {
  const members = readVocabulary(VOCABULARY_ROOT, VOCABULARY) as string[] | null;
  if (members === null) {
    throw new Error(
      `${VOCABULARY.name} is unreadable as a \`${VOCABULARY.kind}\` in ${VOCABULARY.module} — ` +
        'either the declaration moved, was renamed, or was rewritten into a shape the i18n ' +
        'gate cannot parse (which would silently downgrade `capability.label.` to a prefix ' +
        'check), or this run\'s cwd is not the repo root and the file was never opened.',
    );
  }
  return [...members].sort();
};

/** The `en` pack's `capability.label` table, or a loud failure if it moved. */
const enLabels = (): Record<string, unknown> => {
  const capability = (builtInLocales.en as Record<string, unknown>).capability as
    | { label?: unknown }
    | undefined;
  const node = capability?.label;
  if (!node || typeof node !== 'object') {
    throw new Error('en.capability.label is missing — the label table moved or was renamed');
  }
  return node as Record<string, unknown>;
};

/**
 * One `sys_capability` row per declared platform capability, each carrying a
 * label that is NOT the localized one. Any assertion that reads `REGISTRY …`
 * back has caught the widget falling through to the registry.
 */
const registryRows = () =>
  PLATFORM_CAPABILITIES.map((c) => ({
    name: c.name,
    label: `REGISTRY ${c.label}`,
    description: c.description,
    scope: c.scope,
    active: true,
  }));

const mockDataSource = (rows: unknown[]) =>
  ({ find: vi.fn().mockResolvedValue({ data: rows }) }) as any;

const renderPicker = (rows: unknown[]) =>
  render(
    <CapabilityMultiSelectField
      value={'[]'}
      onChange={vi.fn()}
      field={{ name: 'system_permissions' } as any}
      dataSource={mockDataSource(rows)}
    />,
  );

describe('the curated capability set is PLATFORM_CAPABILITIES (objectui#6285)', () => {
  it('reads a non-empty vocabulary, spec array and label table', () => {
    // The positive control for every set-difference and every loop below. Each
    // of them passes vacuously if its side resolved to nothing, and a vacuous
    // pass reads exactly like a real one. Counts are floors, not pins: pinning
    // today's 8 would re-create the hand-maintained copy this file exists to
    // hold in check.
    expect(PLATFORM_CAPABILITIES.length).toBeGreaterThan(5);
    expect(declaredMembers().length).toBeGreaterThan(5);
    expect(Object.keys(enLabels()).length).toBeGreaterThan(5);
  });

  it('declares exactly the spec\'s capability names, in both directions', () => {
    // The assertion the `Mirrors` comment used to make in prose. `toEqual` on
    // two sorted arrays fails on a member the spec added and this list lacks
    // (the defect this card is) AND on one this list kept after the spec dropped
    // it, which no rendering assertion can see.
    expect(declaredMembers()).toEqual(specKeyParts());
  });

  it('`en` carries a label for every declared platform capability', () => {
    // Membership alone is not enough: a member with no key renders the registry
    // label through `labelFor`'s `defaultValue` — quietly, and in every locale
    // at once. This is the half that fails when the spec grows a member and
    // nobody authors the translation.
    const labels = enLabels();
    const missing = specKeyParts().filter(
      (k) => typeof labels[k] !== 'string' || !(labels[k] as string).trim(),
    );
    expect(missing).toEqual([]);
  });

  it('has no orphan label left behind by a capability the spec removed', () => {
    const declared = new Set(specKeyParts());
    expect(Object.keys(enLabels()).filter((k) => !declared.has(k))).toEqual([]);
  });

  it('renders `manage_sharing` as its localized label, not the registry English', async () => {
    // The member the seven-name list was missing. Red before the fix: the picker
    // rendered `REGISTRY Manage Sharing`.
    renderPicker(registryRows());
    const expected = enLabels()[keyPart('manage_sharing')] as string;
    expect(await screen.findByRole('button', { name: expected })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'REGISTRY Manage Sharing' }),
    ).not.toBeInTheDocument();
  });

  it('still resolves the three dotted spec names through the underscore keys', async () => {
    renderPicker(registryRows());
    const dotted = PLATFORM_CAPABILITIES.filter((c) => c.name.includes('.'));
    // Not pinned to exactly 3: a count is the hand-maintained copy this file
    // exists to retire. The floor is only here so the loop cannot pass vacuously.
    expect(dotted.length).toBeGreaterThanOrEqual(3);
    for (const cap of dotted) {
      const expected = enLabels()[keyPart(cap.name)] as string;
      expect(await screen.findByRole('button', { name: expected })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: `REGISTRY ${cap.label}` }),
      ).not.toBeInTheDocument();
    }
  });

  it('renders every declared platform capability as its localized label', async () => {
    // The whole vocabulary in one sweep, and the assertion that ties the
    // provider-less defaults map to the `en` pack: this render mounts no
    // I18nProvider, so the string on screen comes from `FIELD_DEFAULTS`, while
    // the expectation is read out of `en`. They must agree member by member.
    renderPicker(registryRows());
    const expectedNames = PLATFORM_CAPABILITIES.map((c) => enLabels()[keyPart(c.name)] as string);
    await screen.findByRole('button', { name: expectedNames[0] });
    for (const name of expectedNames) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    // And nothing fell through to the registry.
    expect(screen.queryAllByRole('button', { name: /^REGISTRY / })).toEqual([]);
  });
});
