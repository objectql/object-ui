/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ⭐ THE DISCRIMINATING PIN for objectui#6837 half 2's arm deletion, on
 * `app-shell`'s two exported protocol readers.
 *
 * ## Why a DIVERGENT def and not a legacy-only one
 *
 * The refusal pins elsewhere feed a `reference_to`-ONLY def and assert nothing
 * resolves. Those are the right shape for the user-visible break, but they are
 * NOT the right shape for an ablation: restore the deleted arm on a
 * legacy-only def and the reader starts resolving, so they do go red — yet
 * they say nothing about ORDER, and a reader that read
 * `reference ?? reference_to` (canonical-first, arm restored) would keep them
 * green while the arm was back.
 *
 * A def carrying BOTH keys with DIFFERENT values separates those cases. There
 * is exactly one answer per chain shape:
 *
 *   reference only            -> 'canonical_target'   (what half 2 ships)
 *   reference_to || reference -> 'legacy_target'      (the deleted legacy-first arm)
 *   reference ?? reference_to -> 'canonical_target'   (a canonical-first re-widening)
 *
 * ⇒ this file goes RED on the legacy-first restoration, which is the mutation
 * the ablation performs, and the third row is why the legacy-only pins are not
 * a substitute for it.
 *
 * ⚠️ A divergent def is broken metadata and is not a shape any producer should
 * emit — that is the point. It is a PROBE for which key the reader consults,
 * chosen because it is the only shape whose answer differs per chain. The
 * accompanying single-key cases below are the non-vacuous controls: without
 * them a reader that had stopped resolving anything would satisfy every
 * divergent assertion by returning the canonical value never.
 */
import { describe, it, expect } from 'vitest';
import { deriveRelatedLists } from '../deriveRelatedLists';
import { resolveActionParams } from '../resolveActionParams';

/** Broken-on-purpose: the two keys disagree, so the answer names the reader's choice. */
const DIVERGENT = { type: 'master_detail' as const, reference: 'canonical_target', reference_to: 'legacy_target' };

describe('deriveRelatedLists consults `reference`, not `reference_to` (objectui#6837 half 2)', () => {
  const parent = (name: string) => ({ name, fields: {} });

  const derive = (fk: Record<string, unknown>) =>
    deriveRelatedLists(parent('canonical_target'), [
      parent('canonical_target'),
      { name: 'task', fields: { fk } },
    ]);

  it('a divergent def resolves through `reference` — restoring the legacy-first arm turns this red', () => {
    // With `reference_to || reference` back, the FK would point at
    // `legacy_target`, match no parent, and derive nothing.
    expect(derive(DIVERGENT)).toHaveLength(1);
  });

  it('and the mirror image derives NOTHING, so the case above is reading the key and not the parent name', () => {
    // Same two values, swapped. A reader consulting `reference` finds
    // `legacy_target`, which is not the parent — so zero lists.
    expect(
      derive({ type: 'master_detail', reference: 'legacy_target', reference_to: 'canonical_target' }),
    ).toHaveLength(0);
  });

  describe('single-key controls — without these, a helper that derived nothing would pass the divergent case', () => {
    it('`reference` alone derives one', () => {
      expect(derive({ type: 'master_detail', reference: 'canonical_target' })).toHaveLength(1);
    });

    it('`reference_to` alone derives none', () => {
      expect(derive({ type: 'master_detail', reference_to: 'canonical_target' })).toHaveLength(0);
    });
  });
});

describe('resolveActionParams consults `reference`, not `reference_to` (objectui#6837 half 2)', () => {
  const resolve = (fieldDef: Record<string, unknown>) =>
    resolveActionParams([{ field: 'account_id' } as any], {
      objectName: 'quality_dispatch',
      objects: [{ name: 'quality_dispatch', fields: { account_id: { type: 'lookup', label: 'Account', ...fieldDef } } }],
      fieldLabel: (_o: unknown, _f: unknown, fallback: string) => fallback,
    } as any)[0];

  it('a divergent def resolves through `reference` — restoring the legacy-first arm turns this red', () => {
    expect(resolve({ reference: 'canonical_target', reference_to: 'legacy_target' }).referenceTo).toBe(
      'canonical_target',
    );
  });

  describe('single-key controls', () => {
    it('`reference` alone reaches the picker as `referenceTo`', () => {
      expect(resolve({ reference: 'canonical_target' }).referenceTo).toBe('canonical_target');
    });

    it('`reference_to` alone does not', () => {
      expect(resolve({ reference_to: 'canonical_target' }).referenceTo).toBeUndefined();
    });

    it('the param still resolves as a lookup either way, so the case above is not passing on a dropped param', () => {
      // The degenerate pass this guards: a resolver that returned nothing at
      // all would satisfy every `toBeUndefined()` above.
      expect(resolve({ reference_to: 'canonical_target' }).name).toBe('account_id');
    });
  });
});
