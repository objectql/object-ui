/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ⭐ THE CHEAP DEFENCE-IN-DEPTH PIN — objectui#6837 half 2.
 *
 * Maintainer ruling, 2026-08-31 (第 6 场总监席决裁批 #14). The half-2 delivery
 * requirement, 原文照录:
 *
 * > 防御深度钉(便宜):读者遇到遗留键时 dev 模式警告一次并指向本裁定——协议之
 * > 外的键不解析,但不无声。
 *
 * Half 2 deleted the per-reader `reference_to` fallback arms. What makes that
 * deletion survivable for a BYO host is the ingestion choke point, which stamps
 * `reference` from whichever spelling arrived. But a choke point that absorbs a
 * producer's bug SILENTLY is the AGENTS.md #0.1 failure mode by another name —
 * so it now says so, once, in dev.
 *
 * ## What each case here is actually measuring
 *
 * The three pins the card names, plus the two controls without which they would
 * be satisfiable by a warning that never fires (or one that fires always):
 *
 *   1. fires on a legacy-only def          — the pin
 *   2. does NOT fire on a canonical def    — the negative control
 *   3. does NOT fire twice                 — the flood control
 *   4. names the field and the ruling      — the message is the deliverable,
 *                                            not the call count
 *   5. the STAMP is unchanged              — the guard that this file is
 *                                            testing an addition, not a
 *                                            behaviour change
 *
 * ⚠️ Case 5 is the one that would go missing. The ruling asked for an audible
 * warning, NOT for the normalizer to start refusing anything: the def must
 * still come out carrying both snake_case keys exactly as before. A warning
 * that also dropped the key would pass 1-4 and be a regression.
 *
 * ## Warn-once GRANULARITY, stated because it is a deliberate reading
 *
 * The card says "once-per-process". This implementation memoises per
 * (field name, legacy spelling) rather than behind one global flag, mirroring
 * `column-identity.ts`'s `warnedConflicts` and its recorded reason: a schema
 * whose producer mis-spells three fields has three producer bugs to fix, and a
 * single global flag names only the first. Both readings satisfy "does not fire
 * twice" for one def; this one additionally names every offender. Pinned below
 * in both directions so the choice is visible rather than incidental.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeFieldReferenceKeys,
  normalizeSchemaReferenceKeys,
  resetReferenceKeyWarnings,
} from '../reference-keys';

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetReferenceKeyWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  resetReferenceKeyWarnings();
});

const messages = (): string[] => warn.mock.calls.map((c: unknown[]) => String(c[0]));

describe('the choke point warns, in dev, when a def spells ONLY a legacy target key (objectui#6837)', () => {
  describe('the pin — a legacy-only def is audible', () => {
    it('warns on a `reference_to`-only def', () => {
      normalizeFieldReferenceKeys({ type: 'lookup', reference_to: 'crm_account' }, 'account');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('warns on a `referenceTo`-only def', () => {
      normalizeFieldReferenceKeys({ type: 'lookup', referenceTo: 'crm_account' }, 'account');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('names the FIELD, the offending key, and the ruling that asked for this', () => {
      // The message is the deliverable. A warning that fires but says nothing
      // actionable would satisfy a bare call-count assertion and help nobody.
      normalizeFieldReferenceKeys({ type: 'lookup', reference_to: 'crm_account' }, 'account');
      const m = messages()[0];
      expect(m).toContain('`account`');
      expect(m).toContain('reference_to');
      expect(m).toContain('reference');
      expect(m).toContain('objectui#6837');
    });

    it('falls back to the def\'s own `name` when the container gave no key', () => {
      // The array-shaped `fields` container carries the name on the def.
      normalizeSchemaReferenceKeys({
        fields: [{ name: 'owner_account', type: 'lookup', reference_to: 'crm_account' }],
      });
      expect(messages()[0]).toContain('`owner_account`');
    });

    it('takes the field name from the MAP key when the container is a map', () => {
      normalizeSchemaReferenceKeys({
        fields: { billing_account: { type: 'lookup', reference_to: 'crm_account' } },
      });
      expect(messages()[0]).toContain('`billing_account`');
    });
  });

  describe('negative controls — without these the pin above is satisfiable by a warning that always fires', () => {
    it('does NOT warn on a canonical `reference` def', () => {
      normalizeFieldReferenceKeys({ type: 'lookup', reference: 'crm_account' }, 'account');
      expect(warn).not.toHaveBeenCalled();
    });

    it('does NOT warn when a legacy key sits BESIDE `reference` — nothing was absorbed', () => {
      normalizeFieldReferenceKeys(
        { type: 'lookup', reference: 'crm_account', reference_to: 'crm_account' },
        'account',
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it('does NOT warn on a non-relational field', () => {
      normalizeFieldReferenceKeys({ type: 'text' }, 'subject');
      expect(warn).not.toHaveBeenCalled();
    });

    it('does NOT warn on an empty legacy target — there is no target to lose', () => {
      normalizeFieldReferenceKeys({ type: 'lookup', reference_to: '' }, 'account');
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('flood control — a console that scrolls is a console nobody reads', () => {
    it('does NOT fire twice for the same field and spelling', () => {
      normalizeFieldReferenceKeys({ type: 'lookup', reference_to: 'crm_account' }, 'account');
      normalizeFieldReferenceKeys({ type: 'lookup', reference_to: 'crm_account' }, 'account');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fire again when the SAME def is re-normalized (the adapter re-serves a cached schema)', () => {
      const def = { type: 'lookup', reference_to: 'crm_account' };
      normalizeFieldReferenceKeys(def, 'account');
      normalizeFieldReferenceKeys(def, 'account');
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('DOES name a second, different offender — three producer bugs are three fixes', () => {
      // The deliberate reading of "once per process" recorded in this file's
      // docblock. Flip the memo to a single global flag and this goes red.
      normalizeSchemaReferenceKeys({
        fields: {
          billing_account: { type: 'lookup', reference_to: 'crm_account' },
          owner: { type: 'lookup', referenceTo: 'sys_user' },
        },
      });
      expect(warn).toHaveBeenCalledTimes(2);
      expect(messages().join('\n')).toContain('`billing_account`');
      expect(messages().join('\n')).toContain('`owner`');
    });
  });

  describe('⛔ the STAMP is unchanged — this slice adds a warning, it does not change behaviour', () => {
    it('still stamps BOTH snake_case keys from a `reference_to`-only def', () => {
      const def: Record<string, unknown> = { type: 'lookup', reference_to: 'crm_account' };
      normalizeFieldReferenceKeys(def, 'account');
      expect(def.reference).toBe('crm_account');
      expect(def.reference_to).toBe('crm_account');
    });

    it('still stamps BOTH snake_case keys from a `referenceTo`-only def', () => {
      const def: Record<string, unknown> = { type: 'lookup', referenceTo: 'crm_account' };
      normalizeFieldReferenceKeys(def, 'account');
      expect(def.reference).toBe('crm_account');
      expect(def.reference_to).toBe('crm_account');
    });

    it('is silent AND still stamps under NODE_ENV=production', () => {
      // The warning is a dev affordance; the stamp is the contract. A
      // production build must keep the second and lose only the first.
      vi.stubEnv('NODE_ENV', 'production');
      try {
        const def: Record<string, unknown> = { type: 'lookup', reference_to: 'crm_account' };
        normalizeFieldReferenceKeys(def, 'account');
        expect(warn).not.toHaveBeenCalled();
        expect(def.reference).toBe('crm_account');
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
