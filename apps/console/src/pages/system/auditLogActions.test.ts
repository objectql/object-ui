// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Guards `ACTION_OPTIONS` against drifting from the server-declared
 * `sys_audit_log.action` enum (objectstack
 * packages/plugins/plugin-audit/src/objects/sys-audit-log.object.ts).
 *
 * objectui#4476: this console filter list previously carried three values
 * (`permission_change`, `export`, `restore`) the server never wrote or, by
 * the time this landed, no longer declared — an audit filter that always
 * returns zero rows is a visible product defect ("审计面宁窄勿谎" — narrow
 * but honest beats broad but lying). The corrected member set was itself
 * revised twice mid-flight (see issue comments 2026-08-13/14): `import`
 * turned out to have a real writer (plugin-auth's admin-import-users.ts)
 * and stayed; `restore` turned out to have none and was added to the
 * retirement list after the server enum dropped it in objectstack#8315
 * (landed as `4827e915d`, verified again on objectstack@a5262d5 below).
 *
 * The expected list below is written as an INDEPENDENT literal — not
 * derived from `ACTION_OPTIONS` — on purpose. A test that compares a
 * constant to itself (e.g. via a shared source) cannot fail no matter how
 * far the two drift apart; objectstack's own sibling card for this
 * retirement (objectstack#8148) hit exactly that shape of blind spot with
 * a stale prose comment that had been wrong since the day it was written.
 * Keeping this list hand-written means a future edit to either side (a
 * console dev adding an option back, or a server dev changing the enum
 * without checking here) actually turns this test red.
 */
import { describe, expect, it } from 'vitest';
import { ACTION_OPTIONS } from './auditLogActions';

// Last verified directly against
// objectstack packages/plugins/plugin-audit/src/objects/sys-audit-log.object.ts
// at objectstack@a5262d5 (2026-08-15). Update this literal by hand whenever
// the server enum changes — that is the point of the guard.
const SERVER_ACTION_ENUM = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'config_change',
  'import',
];

describe('ACTION_OPTIONS', () => {
  it('matches the server-declared sys_audit_log.action enum exactly', () => {
    expect([...ACTION_OPTIONS].sort()).toEqual([...SERVER_ACTION_ENUM].sort());
  });

  it('does not carry any of the retired action values', () => {
    for (const retired of ['permission_change', 'export', 'restore']) {
      expect(ACTION_OPTIONS).not.toContain(retired);
    }
  });
});
