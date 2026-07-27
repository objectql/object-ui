/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * RecordDetailView — the detail header's Edit/Delete gate vs the server's
 * effective API operation set (#3546).
 *
 * PR-4 (objectui#2823) intersected the LIST/TOOLBAR affordances with the
 * server-resolved effective operation set (`/me/permissions` `apiOperations`).
 * #3546 extends that intersection to the DETAIL surface: the synthesized
 * `sys_edit` CTA (which also gates the record-body inline-edit session) and the
 * `sys_delete` overflow item must never be offered for an operation the server
 * would 405.
 *
 * These pin the resulting show/hide matrix, including the two properties that
 * make this an INTERSECTION and not a union:
 *   • a server grant never re-opens an affordance the lifecycle bucket closed;
 *   • a permissive bucket default never survives a server denial.
 * ...and the backward-compatible fallback: a missing effective set (unrestricted
 * object / old backend / no PermissionProvider) leaves today's bucket +
 * `userActions` decision untouched.
 */

import { describe, it, expect } from 'vitest';
import { resolveRecordHeaderActionGates } from './RecordDetailView';

// `platform` is the permissive bucket — edit + delete both default open, so it
// isolates the effective-set intersection as the only variable.
const platform = { name: 'crm_lead', managedBy: 'platform' };

describe('resolveRecordHeaderActionGates — effective API operations (#3546)', () => {
  it('full-CRUD effective set → Edit and Delete both offered', () => {
    expect(
      resolveRecordHeaderActionGates(platform, ['get', 'list', 'create', 'update', 'delete']),
    ).toEqual({ edit: true, delete: true });
  });

  it('read-only effective set → neither Edit nor Delete', () => {
    expect(resolveRecordHeaderActionGates(platform, ['get', 'list'])).toEqual({
      edit: false,
      delete: false,
    });
  });

  it('update-only effective set → Edit offered, Delete hidden', () => {
    expect(resolveRecordHeaderActionGates(platform, ['get', 'list', 'update'])).toEqual({
      edit: true,
      delete: false,
    });
  });

  it('delete-only effective set → Delete offered, Edit hidden', () => {
    expect(resolveRecordHeaderActionGates(platform, ['get', 'list', 'delete'])).toEqual({
      edit: false,
      delete: true,
    });
  });

  it('empty effective set ("expose nothing") → neither', () => {
    expect(resolveRecordHeaderActionGates(platform, [])).toEqual({ edit: false, delete: false });
  });

  it('undefined effective set (unrestricted / old backend) → bucket wins, both offered', () => {
    expect(resolveRecordHeaderActionGates(platform, undefined)).toEqual({
      edit: true,
      delete: true,
    });
    // Omitting the argument entirely must behave identically — this is the
    // pre-#3546 call shape every non-permission-aware caller still uses.
    expect(resolveRecordHeaderActionGates(platform)).toEqual({ edit: true, delete: true });
  });

  it('null effective set is treated as absent, not as an empty set', () => {
    expect(resolveRecordHeaderActionGates(platform, null)).toEqual({ edit: true, delete: true });
  });

  // ── Intersection, never union ────────────────────────────────────────────
  it('bucket-locked object stays locked even when the server allows update/delete', () => {
    // `system` (engine-owned) closes edit + delete by default. A permissive
    // server set must NOT re-open them — the server governs what it will
    // accept, the bucket governs what the product offers.
    expect(
      resolveRecordHeaderActionGates({ name: 'sys_automation_run', managedBy: 'system' }, [
        'get',
        'list',
        'create',
        'update',
        'delete',
      ]),
    ).toEqual({ edit: false, delete: false });
  });

  it('userActions opt-in still loses to a server denial', () => {
    // sys_user opens `edit` via userActions (ADR-0103), but a caller whose
    // effective set lacks `update` must not see the Edit CTA.
    const sysUser = { name: 'sys_user', managedBy: 'better-auth', userActions: { edit: true } };
    expect(resolveRecordHeaderActionGates(sysUser, ['get', 'list', 'update'])).toEqual({
      edit: true,
      delete: false,
    });
    expect(resolveRecordHeaderActionGates(sysUser, ['get', 'list'])).toEqual({
      edit: false,
      delete: false,
    });
  });

  it('admin-editable `config` bucket intersects the same way', () => {
    const webhook = { name: 'sys_webhook', managedBy: 'config' };
    expect(resolveRecordHeaderActionGates(webhook, ['get', 'list', 'update', 'delete'])).toEqual({
      edit: true,
      delete: true,
    });
    expect(resolveRecordHeaderActionGates(webhook, ['get', 'list', 'update'])).toEqual({
      edit: true,
      delete: false,
    });
  });

  it('a missing objectDef falls back to the platform default (no crash)', () => {
    expect(resolveRecordHeaderActionGates(undefined, ['get', 'list', 'update'])).toEqual({
      edit: true,
      delete: false,
    });
  });
});
