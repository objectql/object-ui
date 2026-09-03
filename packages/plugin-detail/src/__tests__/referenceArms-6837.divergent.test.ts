/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ⭐ THE DISCRIMINATING PIN for objectui#6837 half 2, on `plugin-detail`'s two
 * exported protocol readers. The reasoning for the divergent-def probe is
 * stated once, in `app-shell`'s sibling of this file
 * (`utils/__tests__/referenceArms-6837.divergent.test.ts`); the short version
 * is that a legacy-ONLY def cannot tell a legacy-first chain apart from a
 * canonical-first one, and a def whose two keys DISAGREE can.
 *
 * ## ⚠️ Both readers here are shape-2 sites: the READ narrowed, the WRITE did not
 *
 * `enrichDetailField` and `deriveFieldGroupDetailSections` both take the target
 * off an OBJECT SCHEMA field def (the protocol, where `reference` is the only
 * declared spelling) and stamp it onto a `DetailViewField`-shaped bag (ObjectUI's
 * OWN contract, where `reference_to` is the declared spelling and `reference` is
 * not declared at all). So the assertions below deliberately read
 * `enriched.reference_to` while feeding `reference` — that is not a
 * contradiction, it is the tier boundary, and pinning both halves in one
 * expectation is what stops a future sweep from "tidying" the emitted key.
 */
import { describe, it, expect } from 'vitest';
import { enrichDetailField } from '../fieldEnrichment';
import { deriveFieldGroupDetailSections } from '../synth/buildDefaultPageSchema';

describe('enrichDetailField consults `reference` and still emits `reference_to` (objectui#6837 half 2)', () => {
  const enrich = (objectDefField: Record<string, unknown>) =>
    enrichDetailField({ name: 'account_id' }, { type: 'lookup', ...objectDefField });

  it('a divergent def resolves through `reference` — restoring the legacy-first arm turns this red', () => {
    expect(enrich({ reference: 'canonical_target', reference_to: 'legacy_target' }).reference_to).toBe(
      'canonical_target',
    );
  });

  describe('single-key controls — without these, a helper that enriched nothing would pass the divergent case', () => {
    it('`reference` alone is stamped onto the view field as `reference_to`', () => {
      expect(enrich({ reference: 'canonical_target' }).reference_to).toBe('canonical_target');
    });

    it('`reference_to` alone is not read', () => {
      expect(enrich({ reference_to: 'canonical_target' }).reference_to).toBeUndefined();
    });

    it('the field is still enriched either way, so the case above is not passing on an empty result', () => {
      expect(enrich({ reference_to: 'canonical_target' }).type).toBe('lookup');
    });
  });
});

describe('deriveFieldGroupDetailSections consults `reference` and still emits `reference_to` (objectui#6837 half 2)', () => {
  const sectionField = (accountField: Record<string, unknown>) => {
    // `deriveFieldGroupLayout` (the spec helper this adapter wraps) needs BOTH
    // halves of ADR-0085's grouping shape: declared groups, and per-field
    // `group` keys pointing into them. With either half missing it returns
    // null and this harness would measure nothing.
    const sections = deriveFieldGroupDetailSections({
      name: 'probe',
      fields: {
        name: { type: 'text', label: 'Name', group: 'main' },
        account_id: { type: 'lookup', label: 'Account', group: 'main', ...accountField },
      },
      fieldGroups: [{ key: 'main', label: 'Main' }],
    } as never);
    const all = (sections ?? []).flatMap((s) => (s.fields ?? []) as Array<Record<string, unknown>>);
    return all.find((f) => f.name === 'account_id');
  };

  it('a divergent def resolves through `reference` — restoring the legacy-first arm turns this red', () => {
    expect(sectionField({ reference: 'canonical_target', reference_to: 'legacy_target' })?.reference_to).toBe(
      'canonical_target',
    );
  });

  describe('single-key controls', () => {
    it('`reference` alone is stamped onto the section field as `reference_to`', () => {
      expect(sectionField({ reference: 'canonical_target' })?.reference_to).toBe('canonical_target');
    });

    it('`reference_to` alone is not read', () => {
      expect(sectionField({ reference_to: 'canonical_target' })?.reference_to).toBeUndefined();
    });

    it('the section field is still derived either way, so the case above is not passing on a missing field', () => {
      expect(sectionField({ reference_to: 'canonical_target' })?.type).toBe('lookup');
    });
  });
});
