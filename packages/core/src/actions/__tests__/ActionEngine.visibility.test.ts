/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Regression suite for `ActionEngine.getActionsForLocation` visibility
 * filtering. Locks down the contract established by the platform-wide
 * fix (commits 9289f0cf / f87d9e24 / 4e5bf5e1 / a7c85eae):
 *
 *   1. `visible` is evaluated against the runner context, not ignored.
 *   2. Raw expression strings (`'record.x == y'`) are treated as
 *      expressions, not as truthy string literals.
 *   3. `{ dialect, source }` envelopes (the spec serialization form) are
 *      evaluated — a `cel` dialect on the canonical `@objectstack/formula`
 *      engine (#3314; the envelope is NOT flattened to `${source}`), any
 *      other dialect unwrapped onto the legacy `${…}` path.
 *   4. Predicate errors fail closed (action hidden), not open.
 *   5. `null`/`undefined`/`''`/`true` all mean "always visible".
 *   6. Literal `false` always hides.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ActionEngine } from '../ActionEngine';
import type { ActionDef } from '../ActionRunner';

function makeEngine(context: any) {
  const engine = new ActionEngine(context);
  return engine;
}

const SELF_ID = 'user-self';
const OTHER_ID = 'user-other';

describe('ActionEngine.getActionsForLocation — visibility filter', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      record: { id: SELF_ID, two_factor_enabled: false, email_verified: false },
      user: { id: SELF_ID },
      // mirrors `ActionProvider`'s normalization so predicates may use
      // either flat (`record.x`) or namespaced (`ctx.user.id`) accessors.
      ctx: {
        record: { id: SELF_ID, two_factor_enabled: false, email_verified: false },
        user: { id: SELF_ID },
      },
    };
  });

  it('always returns actions with no `visible` predicate', () => {
    const engine = makeEngine(ctx);
    engine.registerAction({ name: 'no_predicate', type: 'api' }, { locations: ['record_section'] });
    expect(engine.getActionsForLocation('record_section')).toHaveLength(1);
  });

  it('honours boolean `visible: true` / `visible: false`', () => {
    const engine = makeEngine(ctx);
    engine.registerAction({ name: 'always_on', type: 'api', visible: true } as ActionDef, { locations: ['record_section'] });
    engine.registerAction({ name: 'always_off', type: 'api', visible: false } as ActionDef, { locations: ['record_section'] });
    const visible = engine.getActionsForLocation('record_section').map(a => a.name);
    expect(visible).toEqual(['always_on']);
  });

  it('treats empty/`null`/`undefined` predicates as always visible (no fail-closed surprise)', () => {
    const engine = makeEngine(ctx);
    engine.registerAction({ name: 'empty', type: 'api', visible: '' } as any, { locations: ['record_section'] });
    engine.registerAction({ name: 'nullp', type: 'api', visible: null } as any, { locations: ['record_section'] });
    engine.registerAction({ name: 'undef', type: 'api', visible: undefined } as any, { locations: ['record_section'] });
    expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['empty', 'nullp', 'undef']);
  });

  it('evaluates raw string predicates as expressions (regression: string-truthy bug)', () => {
    // BEFORE the fix: a raw `'record.id == ctx.user.id'` string was returned
    // verbatim by the evaluator (no `${}` template wrap), then `Boolean(str)`
    // coerced it to `true` — leaking actions whose preconditions failed.
    const engine = makeEngine(ctx);
    engine.registerAction(
      { name: 'self_only', type: 'api', visible: 'record.id == ctx.user.id' } as any,
      { locations: ['record_section'] }
    );
    engine.registerAction(
      { name: 'other_only', type: 'api', visible: 'record.id == "other-id"' } as any,
      { locations: ['record_section'] }
    );
    expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['self_only']);
  });

  it('evaluates `{ dialect, source }` envelopes (the spec serialization form)', () => {
    const engine = makeEngine(ctx);
    engine.registerAction(
      {
        name: 'enabled_2fa',
        type: 'api',
        visible: { dialect: 'cel', source: 'record.id == ctx.user.id && record.two_factor_enabled == true' },
      } as any,
      { locations: ['record_section'] }
    );
    engine.registerAction(
      {
        name: 'disabled_2fa',
        type: 'api',
        visible: { dialect: 'cel', source: 'record.id == ctx.user.id && record.two_factor_enabled != true' },
      } as any,
      { locations: ['record_section'] }
    );
    expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['disabled_2fa']);
  });

  it('fails closed when a predicate references missing context (regression: silent leak)', () => {
    // The evaluator's default behaviour swallows ReferenceErrors and
    // returns the raw template string. Engine must pass `throwOnError`
    // and catch — so missing `ctx.user.id` (e.g. provider not mounted)
    // hides the action instead of revealing it.
    const engine = new ActionEngine({ record: { id: SELF_ID } });
    engine.registerAction(
      { name: 'needs_user', type: 'api', visible: 'record.id == ctx.user.id' } as any,
      { locations: ['record_section'] }
    );
    expect(engine.getActionsForLocation('record_section')).toHaveLength(0);
  });

  it('combines location filter with visibility filter', () => {
    const engine = makeEngine(ctx);
    engine.registerAction(
      { name: 'in_header_self', type: 'api', visible: 'record.id == ctx.user.id' } as any,
      { locations: ['record_header'] }
    );
    engine.registerAction(
      { name: 'in_section_self', type: 'api', visible: 'record.id == ctx.user.id' } as any,
      { locations: ['record_section'] }
    );
    engine.registerAction(
      { name: 'in_section_other', type: 'api', visible: `record.id == "${OTHER_ID}"` } as any,
      { locations: ['record_section'] }
    );
    expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['in_section_self']);
    expect(engine.getActionsForLocation('record_header').map(a => a.name)).toEqual(['in_header_self']);
  });

  it('respects priority ordering after filtering', () => {
    const engine = makeEngine(ctx);
    engine.registerAction({ name: 'a', type: 'api', visible: true } as any, { locations: ['record_section'], priority: 30 });
    engine.registerAction({ name: 'b', type: 'api', visible: true } as any, { locations: ['record_section'], priority: 10 });
    engine.registerAction({ name: 'c', type: 'api', visible: false } as any, { locations: ['record_section'], priority: 5 });
    expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['b', 'a']);
  });
  it('hides a throwing (bare-field) predicate AND warns once (diagnose #2183 silent hide)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const engine = makeEngine(ctx);
      // bare `done` is undeclared in the eval scope → throws → fail-closed hide
      engine.registerAction({ name: 'mark_done', type: 'script', visible: '!done' } as any, { locations: ['record_section'] });
      expect(engine.getActionsForLocation('record_section')).toHaveLength(0);
      // re-querying must NOT spam the warning (deduped per predicate)
      engine.getActionsForLocation('record_section');
      const hits = warn.mock.calls.filter(c => String(c[0]).includes('mark_done'));
      expect(hits).toHaveLength(1);
      expect(String(hits[0][0])).toMatch(/record\.<field>/);
    } finally {
      warn.mockRestore();
    }
  });

  it('does not warn for a correct record-qualified predicate', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const engine = makeEngine(ctx);
      engine.registerAction({ name: 'ok_action', type: 'script', visible: '!record.two_factor_enabled' } as any, { locations: ['record_section'] });
      expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['ok_action']);
      expect(warn.mock.calls.filter(c => String(c[0]).includes('ok_action'))).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });

  // #2358 trap 1 — the spec's canonical CEL identity scope is `os.user.*`
  // (server formula / validation / sharing). The runner derives an `os.user`
  // alias from `context.user` so a predicate authored against the server
  // dialect evaluates identically on the client instead of throwing and
  // being fail-closed hidden.
  describe('os.user identity alias (#2358)', () => {
    it('resolves os.user.* predicates from context.user', () => {
      const engine = makeEngine({ user: { id: 'u1', role: 'admin' } });
      engine.registerAction(
        { name: 'admin_only', type: 'api', visible: 'os.user.role == "admin"' } as any,
        { locations: ['record_section'] },
      );
      engine.registerAction(
        { name: 'manager_only', type: 'api', visible: 'os.user.role == "manager"' } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['admin_only']);
    });

    it('keeps a consumer-provided os namespace but tracks os.user', () => {
      const engine = makeEngine({ user: { id: 'u1' }, os: { tenant: 't1' } });
      engine.registerAction(
        { name: 'both', type: 'api', visible: 'os.user.id == "u1" && os.tenant == "t1"' } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section')).toHaveLength(1);
    });

    it('refreshes os.user when updateContext replaces user', () => {
      const engine = makeEngine({ user: { id: 'u1', role: 'viewer' } });
      engine.registerAction(
        { name: 'admin_gate', type: 'api', visible: 'os.user.role == "admin"' } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section')).toHaveLength(0);
      engine.updateContext({ user: { id: 'u1', role: 'admin' } });
      expect(engine.getActionsForLocation('record_section')).toHaveLength(1);
    });
  });

  // #3314 — the engine used to unwrap a `{ dialect: 'cel', source }` envelope
  // into a `${source}` string before calling `evaluateCondition`, which only
  // routes to the canonical `@objectstack/formula` engine while the argument
  // is STILL an envelope. Every CEL predicate therefore silently ran on the
  // legacy JS evaluator here, while the renderers (`toPredicateInput` →
  // `useCondition`) ran the same predicate on CEL (#2661).
  //
  // The discriminator is a null comparison, where the two engines genuinely
  // disagree: CEL has no `<` overload for `null` → the predicate faults →
  // `throwOnError` → fail-closed HIDE; JS evaluates `null < null` to `false`
  // → `!(…)` is `true` → SHOW. Same predicate text, opposite verdict.
  describe('CEL envelopes route to the canonical formula engine (#3314)', () => {
    const NULLS = { record: { a: null, b: null, status: 'open' } };
    const NULL_PRED = '!(record.a < record.b)';

    it('routes a `cel` envelope to CEL — a null comparison faults and fail-closed hides', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const engine = new ActionEngine(NULLS);
        engine.registerAction(
          { name: 'cel_nulls', type: 'api', visible: { dialect: 'cel', source: NULL_PRED } } as any,
          { locations: ['record_section'] },
        );
        // BEFORE the fix the envelope was flattened to `${!(record.a < record.b)}`
        // and the legacy JS engine returned `true` — the action stayed visible.
        expect(engine.getActionsForLocation('record_section')).toHaveLength(0);
        // …and the fail-closed hide is diagnosable, with the envelope's source
        // in the message (not `[object Object]`).
        const hits = warn.mock.calls.filter(c => String(c[0]).includes('cel_nulls'));
        expect(hits).toHaveLength(1);
        expect(String(hits[0][0])).toContain(NULL_PRED);
      } finally {
        warn.mockRestore();
      }
    });

    it('keeps the bare-string predicate on the legacy JS path (no regression)', () => {
      // The same predicate text as a bare string is NOT a CEL envelope, so it
      // stays on the legacy `${…}` path — `null < null` is `false` there, so
      // the action shows. This is the assertion that makes the case above a
      // real engine discriminator rather than a predicate that hides anyway.
      const engine = new ActionEngine(NULLS);
      engine.registerAction(
        { name: 'js_nulls', type: 'api', visible: NULL_PRED } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['js_nulls']);
    });

    it('keeps a non-`cel` dialect envelope on the legacy JS path', () => {
      const engine = new ActionEngine(NULLS);
      engine.registerAction(
        { name: 'tpl_nulls', type: 'api', visible: { dialect: 'template', source: NULL_PRED } } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['tpl_nulls']);
    });

    it('still evaluates a well-formed `cel` envelope to its real verdict', () => {
      // Guard against "the fix just hides everything": a CEL predicate that
      // genuinely holds must still pass the filter, and one that genuinely
      // fails must be dropped — neither is a fault.
      const engine = new ActionEngine(NULLS);
      engine.registerAction(
        { name: 'cel_true', type: 'api', visible: { dialect: 'cel', source: 'record.status == "open"' } } as any,
        { locations: ['record_section'] },
      );
      engine.registerAction(
        { name: 'cel_false', type: 'api', visible: { dialect: 'cel', source: 'record.status == "closed"' } } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['cel_true']);
    });

    it('treats an empty `source` as "no predicate declared" (visible), for every dialect', () => {
      const engine = new ActionEngine(NULLS);
      engine.registerAction(
        { name: 'cel_empty', type: 'api', visible: { dialect: 'cel', source: '' } } as any,
        { locations: ['record_section'] },
      );
      engine.registerAction(
        { name: 'tpl_empty', type: 'api', visible: { dialect: 'template', source: '' } } as any,
        { locations: ['record_section'] },
      );
      engine.registerAction(
        { name: 'no_source', type: 'api', visible: {} } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section').map(a => a.name))
        .toEqual(['cel_empty', 'tpl_empty', 'no_source']);
    });
  });

  /**
   * objectui#3871 — the legacy `${…}` spelling on the engine's own filter.
   *
   * This filter normalizes with `toPredicateInput` and evaluates with
   * `throwOnError: true`, so the double wrap did NOT read as truthy here: the
   * unparseable `'${${…}}'` threw, the `catch` below fail-closed HID the action,
   * and `warnHiddenPredicate` blamed the author's expression. Measured before
   * the fix on this tree: BOTH actions below were dropped, including the one
   * whose predicate holds — the direction the issue card mis-predicted (it
   * expected a constant "visible" here, which is what the fail-SOFT renderer
   * legs did).
   *
   * Reverse verification: restore the unconditional wrap and `tpl_true` goes red
   * (it was hidden); `tpl_false` stays green, because "hidden because the
   * predicate is false" and "hidden because the predicate could not be parsed"
   * are indistinguishable from the outside. Hence both, and hence the warn
   * assertion — a fail-closed hide is loud, so its ABSENCE is what separates the
   * two reasons.
   */
  describe('the legacy `${…}` template spelling (objectui#3871)', () => {
    const OPEN = { record: { status: 'open' } };

    it('evaluates a `${…}` predicate to its real verdict on both polarities', () => {
      const engine = new ActionEngine(OPEN);
      engine.registerAction(
        { name: 'tpl_true', type: 'api', visible: '${record.status === "open"}' } as any,
        { locations: ['record_section'] },
      );
      engine.registerAction(
        { name: 'tpl_false', type: 'api', visible: '${record.status === "closed"}' } as any,
        { locations: ['record_section'] },
      );
      expect(engine.getActionsForLocation('record_section').map(a => a.name)).toEqual(['tpl_true']);
    });

    it('drops the false one WITHOUT the fail-closed warning (it is a verdict, not a fault)', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const engine = new ActionEngine(OPEN);
        engine.registerAction(
          { name: 'tpl_quiet', type: 'api', visible: '${record.status === "closed"}' } as any,
          { locations: ['record_section'] },
        );
        expect(engine.getActionsForLocation('record_section')).toHaveLength(0);
        // Before the fix this same call warned about `tpl_quiet` — the predicate
        // faulted rather than answering. A genuine `false` is silent, so this is
        // the assertion that distinguishes the two ways of being hidden.
        expect(warn.mock.calls.filter(c => String(c[0]).includes('tpl_quiet'))).toHaveLength(0);
      } finally {
        warn.mockRestore();
      }
    });
  });

});
