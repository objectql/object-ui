/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Form-view bridge — retired keys stay unread (objectui#3901 / #3974).
 *
 * The bridge used to end with two copies that could never fire:
 *
 *   if (spec.defaultSort) node.defaultSort = spec.defaultSort;   // :188
 *   if (spec.aria) node.aria = spec.aria;                        // :193
 *
 * Spec 17 retired both keys on the FORM carrier (`retiredKey()` tombstones in
 * `packages/spec/src/ui/view.zod.ts`), so a FormView that passed validation can
 * never carry either. Under the maintainer's 2026-08-11 enforce-or-remove
 * ruling the reads were removed rather than documented.
 *
 * This file pins the removal from both directions, because a dormant read is
 * only safely deletable when BOTH ends are dead:
 *
 *  1. **Producer** — the contract still rejects the keys. This is what makes
 *     the deletion "not a capability removal": the capability was already gone
 *     at the spec. If a future spec un-retires either key, this half turns red
 *     and tells the next agent the ruling needs revisiting BEFORE they re-add a
 *     read to make something work.
 *  2. **Bridge output** — even fed a RAW, never-validated object carrying both
 *     keys (the only class of input that could still present them: a host
 *     calling the exported `SpecBridge` with a stored pre-17 document), the
 *     node gains neither key. Feeding raw input on purpose is the point — a
 *     fixture that could not carry the key would pass for the wrong reason.
 *
 * Key-presence assertions (`'aria' in node`), not value assertions: what is
 * guarded is that the bridge does not PRODUCE these node slots at all.
 */
import { describe, it, expect } from 'vitest';
import { FormViewSchema } from '@objectstack/spec/ui';
import { SpecBridge } from '../SpecBridge';
import { bridgeFormView } from '../bridges/form-view';

/** A FormView that is spec-valid except for the deliberately-planted key. */
const VALID_BASE = {
  type: 'simple',
  sections: [{ label: 'Basic', fields: [{ field: 'name' }] }],
};

describe('form-view bridge — retired spec keys (#3901 / #3974)', () => {
  describe('producer: the contract still refuses both keys', () => {
    it('parses the base form view (the control — the fixture is otherwise valid)', () => {
      expect(FormViewSchema.safeParse(VALID_BASE).success).toBe(true);
    });

    it('rejects `aria` on a form view by name', () => {
      const parsed = FormViewSchema.safeParse({
        ...VALID_BASE,
        aria: { ariaLabel: 'Create Account Form', role: 'form' },
      });

      expect(parsed.success).toBe(false);
      // `retiredKey()` is `z.never().optional()`, so the key is REJECTED at the
      // parse rather than stripped — the issue lands on the key's own path.
      expect(parsed.error?.issues.some((i) => i.path[0] === 'aria')).toBe(true);
    });

    it('rejects `defaultSort` on a form view by name', () => {
      const parsed = FormViewSchema.safeParse({
        ...VALID_BASE,
        defaultSort: [{ field: 'name', order: 'asc' }],
      });

      expect(parsed.success).toBe(false);
      expect(parsed.error?.issues.some((i) => i.path[0] === 'defaultSort')).toBe(true);
    });
  });

  describe('bridge: raw input carrying the retired keys produces neither slot', () => {
    const RAW_WITH_RETIRED_KEYS = {
      ...VALID_BASE,
      aria: { ariaLabel: 'Create Account Form', role: 'form' },
      defaultSort: [{ field: 'name', order: 'asc' }],
    };

    it('does not carry `aria` or `defaultSort` onto the node', () => {
      const node = new SpecBridge().transformFormView(RAW_WITH_RETIRED_KEYS);

      expect('aria' in node).toBe(false);
      expect('defaultSort' in node).toBe(false);
      expect(Object.keys(node)).not.toContain('aria');
      expect(Object.keys(node)).not.toContain('defaultSort');
    });

    it('still carries the live keys beside them (the read removal was surgical)', () => {
      const node = new SpecBridge().transformFormView({
        ...RAW_WITH_RETIRED_KEYS,
        title: 'Edit Opportunity',
        sharing: { visibility: 'team' },
        submitBehavior: { kind: 'redirect', url: '/done' },
      });

      // `sharing` and `submitBehavior` sat on the same trailing block as the
      // two deleted copies — if a future edit takes the block out wholesale,
      // this is what reports it.
      expect(node.title).toBe('Edit Opportunity');
      expect(node.sharing).toEqual({ visibility: 'team' });
      expect(node.submitBehavior).toEqual({ kind: 'redirect', url: '/done' });
      expect((node.sections as unknown[]).length).toBe(1);
    });

    it('holds when the bridge function is called directly, not just via SpecBridge', () => {
      const node = bridgeFormView(RAW_WITH_RETIRED_KEYS, {});

      expect('aria' in node).toBe(false);
      expect('defaultSort' in node).toBe(false);
    });
  });
});
