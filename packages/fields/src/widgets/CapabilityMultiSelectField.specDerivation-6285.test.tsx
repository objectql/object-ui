/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6285 — the capability picker's curated label set IS
 * `@objectstack/spec/security`'s `PLATFORM_CAPABILITIES`, and every member of it
 * reaches the screen as a localized label.
 *
 * ## What went wrong, and why nothing caught it
 *
 * `CURATED_CAPABILITY_LABELS` was a hand-written seven-member `Set` carrying a
 * doc comment that claimed to mirror `PLATFORM_CAPABILITIES`. The spec grew an
 * eighth member (`manage_sharing`) and the copy did not follow, so that one
 * capability fell through to `byName.get(name)?.label` — the English label the
 * `sys_capability` registry serves — and rendered untranslated in all ten packs,
 * beside seven siblings that localize. Every gate stayed green: the seven keys
 * the literal named all existed, and no instrument compared the literal to the
 * array it named itself after.
 *
 * ## Why these assertions and not a render smoke test
 *
 * "the picker renders" passes in both worlds. Each assertion below is written to
 * fail in exactly one of them, so every registry row this file feeds in carries a
 * label deliberately UNLIKE the localized one (`REGISTRY …`). If the derivation
 * regressed — or if the `defaultValue` fallback were doing the rendering instead
 * of a real translation — the `REGISTRY …` string is what would appear, and the
 * equality below reports it by name.
 *
 * The three dotted members are their own case. The spec spells `setup.access`,
 * `setup.write` and `studio.access` with a dot; the i18n keys spell them with an
 * underscore, and `labelFor` bridges that with `name.replace(/\./g, '_')`. A
 * derivation that forgets the same transform silently un-localizes three members
 * that work today, which is the likeliest way to ship a regression here — so the
 * transform is restated in this file ON PURPOSE rather than imported from the
 * widget: a pin that shares the implementation's own helper moves when the
 * implementation moves and pins nothing.
 *
 * ## PREDICTIONS, written before the first run
 *
 * Against `origin/main` (hand-written literal, no `capability.label.manage_sharing`
 * key anywhere) — this file was expected RED on:
 *   - "manage_sharing renders its localized label" — renders `REGISTRY Manage Sharing`
 *   - "every declared platform capability renders its localized label" — same member
 *   - "`en` carries a label for every declared platform capability" — key absent
 * and GREEN on the dotted-member and orphan assertions, which describe behaviour
 * the literal already had. Recorded so a green first run would read as a broken
 * harness rather than as a passing fix.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PLATFORM_CAPABILITIES } from '@objectstack/spec/security';
import { builtInLocales } from '@object-ui/i18n';
import { CapabilityMultiSelectField } from './CapabilityMultiSelectField';

/**
 * The dot -> underscore transform `labelFor` applies before building the key.
 * Deliberately a second statement of it (see the header).
 */
const keyPart = (specName: string) => specName.replace(/\./g, '_');

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

describe('capability labels derive from PLATFORM_CAPABILITIES (objectui#6285)', () => {
  it('reads a non-empty vocabulary and a non-empty label table', () => {
    // The positive control. Both loops below iterate one of these; if either
    // side resolved to nothing they would pass vacuously, and a vacuous pass
    // reads exactly like a real one.
    expect(PLATFORM_CAPABILITIES.length).toBeGreaterThan(5);
    expect(Object.keys(enLabels()).length).toBeGreaterThan(5);
  });

  it('`en` carries a label for every declared platform capability', () => {
    // The half that fails when the spec grows a member and nobody authors the
    // key — the exact event that produced this card, caught in CI instead of on
    // screen. `check:i18n-keys` cannot state this: its vocabulary reader is
    // repo-source-only and the members now live in a dependency.
    const labels = enLabels();
    const missing = PLATFORM_CAPABILITIES.map((c) => keyPart(c.name)).filter(
      (k) => typeof labels[k] !== 'string' || !(labels[k] as string).trim(),
    );
    expect(missing).toEqual([]);
  });

  it('has no orphan label left behind by a capability the spec removed', () => {
    const declared = new Set(PLATFORM_CAPABILITIES.map((c) => keyPart(c.name)));
    expect(Object.keys(enLabels()).filter((k) => !declared.has(k))).toEqual([]);
  });

  it('renders `manage_sharing` as its localized label, not the registry English', async () => {
    // The member the hand-written literal was missing. Red on `main`: the
    // picker rendered `REGISTRY Manage Sharing`.
    renderPicker(registryRows());
    const expected = enLabels()[keyPart('manage_sharing')] as string;
    expect(await screen.findByRole('button', { name: expected })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'REGISTRY Manage Sharing' }),
    ).not.toBeInTheDocument();
  });

  it('still resolves the three dotted spec names through the underscore keys', async () => {
    // `setup.access` / `setup.write` / `studio.access`. These work today; a
    // derivation that drops the transform breaks them, and nothing else here
    // would notice.
    renderPicker(registryRows());
    const dotted = PLATFORM_CAPABILITIES.filter((c) => c.name.includes('.'));
    // Not pinned to exactly 3: a count is the hand-maintained copy this file exists
    // to retire. The floor is only here so the loop cannot pass vacuously.
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
    // provider-less defaults map to the `en` pack: this render has no
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
