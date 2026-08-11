// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Where an internal form submit lands (objectui#4109) — the host-app policy,
 * unit-tested without a router or a metadata catalog.
 */

import { describe, expect, it } from 'vitest';
import {
  buildCreatedRecordPath,
  resolveRecordHostAppSegment,
  type HostAppLike,
} from './createdRecordPath';

const SHOWCASE: HostAppLike = { name: 'showcase_app', _packageId: 'ai.objectstack.showcase' };
const CRM: HostAppLike = { name: 'crm_app', _packageId: 'ai.objectstack.crm' };

describe('resolveRecordHostAppSegment', () => {
  it('prefers the app the user is in, matched by package id', () => {
    expect(resolveRecordHostAppSegment([CRM, SHOWCASE], 'ai.objectstack.showcase')).toBe(
      'ai.objectstack.showcase',
    );
  });

  it('matches the preferred app by name too (runtime/DB apps, legacy URLs)', () => {
    expect(resolveRecordHostAppSegment([CRM, SHOWCASE], 'showcase_app')).toBe(
      'ai.objectstack.showcase',
    );
  });

  it('returns the package id as the segment, never the name, when both exist (ADR-0048)', () => {
    expect(resolveRecordHostAppSegment([SHOWCASE], 'showcase_app')).toBe('ai.objectstack.showcase');
  });

  it('falls back to the name for a runtime app carrying no package id', () => {
    expect(resolveRecordHostAppSegment([{ name: 'db_app' }], 'db_app')).toBe('db_app');
  });

  it('falls back to the first openable app when nothing is preferred', () => {
    expect(resolveRecordHostAppSegment([CRM, SHOWCASE], undefined)).toBe('ai.objectstack.crm');
  });

  /**
   * The re-check that keeps a deactivated/hidden app from being resurrected as
   * a link just because the shell still remembers the user was in it.
   */
  it('does not honour a preferred app that is no longer openable', () => {
    const apps = [{ ...SHOWCASE, active: false }, CRM];
    expect(resolveRecordHostAppSegment(apps, 'ai.objectstack.showcase')).toBe('ai.objectstack.crm');
  });

  it('skips hidden apps when falling back', () => {
    const apps = [{ ...SHOWCASE, hidden: true }, CRM];
    expect(resolveRecordHostAppSegment(apps, undefined)).toBe('ai.objectstack.crm');
  });

  /**
   * The deliberate divergence from app-shell's `resolveHostAppSegment`, which
   * ends at `setup`. Here an unresolvable app means we cannot NAME the record's
   * page, and the caller must confirm the submit instead of sending the user to
   * a URL that resolves to nothing. See the module docblock.
   */
  it('returns null when no app can be named, rather than guessing `setup`', () => {
    expect(resolveRecordHostAppSegment([], 'showcase_app')).toBeNull();
    expect(resolveRecordHostAppSegment(undefined, undefined)).toBeNull();
    expect(resolveRecordHostAppSegment([{ name: 'x', active: false }], undefined)).toBeNull();
    // An app with no addressable identity at all is not a segment either.
    expect(resolveRecordHostAppSegment([{}], undefined)).toBeNull();
  });
});

describe('buildCreatedRecordPath', () => {
  it('builds the app-scoped record path (ADR-0048 segment + object + id)', () => {
    expect(
      buildCreatedRecordPath([SHOWCASE], 'showcase_app', 'showcase_task', 'task-1'),
    ).toBe('/apps/ai.objectstack.showcase/showcase_task/record/task-1');
  });

  it('percent-encodes an id that carries URL-significant characters', () => {
    expect(buildCreatedRecordPath([{ name: 'a' }], 'a', 'obj', 'a/b#c')).toBe(
      '/apps/a/obj/record/a%2Fb%23c',
    );
  });

  it('returns null when there is no object or no id to land on', () => {
    expect(buildCreatedRecordPath([SHOWCASE], 'showcase_app', 'showcase_task', null)).toBeNull();
    expect(buildCreatedRecordPath([SHOWCASE], 'showcase_app', '', 'task-1')).toBeNull();
  });

  it('returns null when no app can host the record page', () => {
    expect(buildCreatedRecordPath([], 'showcase_app', 'showcase_task', 'task-1')).toBeNull();
  });
});
