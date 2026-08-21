/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * objectui#5424 site 4 — the expression user advertised a key that was always
 * `undefined`.
 *
 * ## What was wrong
 *
 * `AppContent` built the object `ExpressionProvider` binds as `current_user` /
 * `ctx.user` / `os.user`, and forwarded `roles: (user as any).roles` into it.
 * The protocol-17 session face emits no `roles` key at all (framework ADR-0090
 * D3 renamed it to `positions` with no deprecation window — measured on a live
 * 17.1.0 server in objectui#5389), so that property was present-and-undefined
 * on every evaluation context the console ever built.
 *
 * This is the mildest of the card's four sites — the same object already
 * forwarded `positions` and `isPlatformAdmin` correctly, so nothing depended on
 * it — but "present and always undefined" is the shape that teaches the wrong
 * thing: a metadata author writing `'manager' in current_user.roles` gets a
 * context that answers rather than one that is plainly missing the key, and the
 * answer is silently, permanently wrong.
 *
 * ## Why the assertion is `in` and not `toBeUndefined`
 *
 * `{ roles: undefined }` and `{}` both make `user.roles` read as `undefined`,
 * so a value assertion cannot tell the fixed shape from the broken one — it is
 * green either way. Key PRESENCE is the only thing that moves, so `'roles' in`
 * is the whole pin. Same reason `toEqual` is used on the full object below:
 * `toEqual` treats an explicit `undefined` as absent, `toStrictEqual` does not,
 * and this file needs the strict one.
 *
 * ## Reverse verification (direction predicted BEFORE running, measured in this PR)
 *
 * Put `roles: u.roles,` back into `buildExpressionUser`:
 *   - "never advertises the retired `roles` key" goes RED for the signed-in
 *     case (`'roles' in` → `true`), and the strict-shape case goes RED with the
 *     extra `roles: undefined` property;
 *   - the `positions` / `isPlatformAdmin` forwarding cases stay GREEN — they
 *     never read the retired key, so they cannot stand in for the pin above;
 *   - the signed-out case stays GREEN — that branch never carried `roles`,
 *     which is exactly the inconsistency between the two branches that the
 *     removal closes.
 */
import { describe, it, expect } from 'vitest';

import { buildExpressionUser } from '../AppContent';

/**
 * The measured protocol-17 payload (objectui#5424): a permission-set-derived
 * platform admin on a single-tenant 17.1.0 server. `role` is the scalar
 * `'user'`; the position names live only in `positions`; there is no `roles`.
 */
const PROTOCOL_17_USER = {
  id: 'u_1',
  name: 'Ada',
  email: 'admin@example.com',
  role: 'user',
  positions: ['user', 'platform_admin'],
  isPlatformAdmin: true,
};

describe('objectui#5424 — `buildExpressionUser` stops advertising the retired `roles` key', () => {
  it('never advertises `roles`, for a signed-in user', () => {
    // The pin. On `origin/main` the key is written with value `undefined`, so
    // `in` answers true while every value-shaped assertion stays green.
    expect('roles' in buildExpressionUser(PROTOCOL_17_USER)).toBe(false);
  });

  it('never advertises `roles`, even when the session still carries one', () => {
    // Not a fallback, not a passthrough: the retired spelling does not reach the
    // predicate context by any route (`packages/auth/src/types.ts` — "do not
    // pair it with `positions` as a fallback").
    const built = buildExpressionUser({ ...PROTOCOL_17_USER, roles: ['ghost_position'] });

    expect('roles' in built).toBe(false);
    expect(Object.values(built)).not.toContainEqual(['ghost_position']);
  });

  it('binds exactly the declared shape for a signed-in user', () => {
    // `toStrictEqual` so a re-added `roles: undefined` fails here too, not just
    // on the `in` check above.
    expect(buildExpressionUser(PROTOCOL_17_USER)).toStrictEqual({
      id: 'u_1',
      name: 'Ada',
      email: 'admin@example.com',
      role: 'user',
      isPlatformAdmin: true,
      positions: ['user', 'platform_admin'],
    });
  });

  it('still forwards `positions` and `isPlatformAdmin` — the keys authorization gating reads', () => {
    // Control: green before and after. These are what ADR-0058 / objectui#2284
    // put in this object, and the removal above must not disturb them.
    const built = buildExpressionUser(PROTOCOL_17_USER);

    expect(built.positions).toEqual(['user', 'platform_admin']);
    expect(built.isPlatformAdmin).toBe(true);
  });

  it('defaults `positions` to an empty list rather than leaving it undefined', () => {
    // A session without positions must still give `'x' in current_user.positions`
    // something to evaluate against.
    expect(buildExpressionUser({ id: 'u_2', name: 'B', email: 'b@c.d' }).positions).toEqual([]);
  });

  it('binds the anonymous shape when there is no session, with no `roles` there either', () => {
    const anonymous = buildExpressionUser(null);

    expect('roles' in anonymous).toBe(false);
    expect(anonymous).toStrictEqual({
      name: 'Anonymous',
      email: '',
      role: 'guest',
      isPlatformAdmin: false,
      positions: [],
    });
  });
});
