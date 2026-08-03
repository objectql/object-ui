// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `view` draft validation across the type's TWO spec-declared shapes
 * (objectui#3312, surfaced by the `@objectstack/spec` 17.0.0-rc.2 uptake).
 *
 * `@objectstack/spec/ui` exports both `ViewItemSchema` (the first-class
 * per-view record this admin authors — `{ name, object, viewKind, config }`,
 * ADR-0017) and `ViewSchema` (the aggregated container — `{ list, form,
 * listViews, formViews }`), and the backend serves both.
 *
 * The validator used to name only the container. That looked fine because the
 * container was non-strict: a ViewItem's `viewKind` / `config` were silently
 * stripped and the draft "passed" without one of its own keys ever being
 * checked — a vacuous pass, for every view this admin has ever created. Spec
 * 17.0.0 made the container strict and turned it into a loud rejection.
 *
 * These pins state the property that matters and that a single-schema mapping
 * cannot have: BOTH shapes validate, each against its OWN schema, and neither
 * is waved through. The last two are the load-bearing ones — they fail if the
 * dispatch ever degrades into "try one, shrug on failure".
 */

import { describe, it, expect } from 'vitest';
import { validateMetadataDraft } from './clientValidation';

/** What `anchors.ts`'s `createBuildBody` emits for a default list view. */
const VIEW_ITEM = {
  name: 'crm_lead.all_leads',
  object: 'crm_lead',
  viewKind: 'list',
  label: 'All Leads',
  config: {
    type: 'grid',
    columns: [],
    data: { provider: 'object', object: 'crm_lead' },
  },
};

/** A record that was never expanded into ViewItems. */
const CONTAINER = {
  name: 'crm_lead',
  label: 'Lead views',
  object: 'crm_lead',
  list: { type: 'grid', columns: ['name'] },
};

describe('validateMetadataDraft("view") — both spec shapes (objectui#3312)', () => {
  it('accepts the ViewItem this admin authors', async () => {
    const res = await validateMetadataDraft('view', VIEW_ITEM);
    expect(res.issues, JSON.stringify(res.issues)).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it('accepts the aggregated container the backend still serves', async () => {
    const res = await validateMetadataDraft('view', CONTAINER);
    expect(res.issues, JSON.stringify(res.issues)).toEqual([]);
    expect(res.ok).toBe(true);
  });

  it('still REJECTS a ViewItem whose own body is wrong', async () => {
    // The whole point of dispatching: a ViewItem is now checked against
    // `ViewItemSchema`, so a bad `config` is caught instead of stripped. Under
    // the old container-only mapping this passed vacuously.
    const res = await validateMetadataDraft('view', {
      ...VIEW_ITEM,
      config: { type: 'not_a_real_layout', columns: [] },
    });
    expect(res.ok).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
  });

  it('still REJECTS a container that carries an unknown key', async () => {
    const res = await validateMetadataDraft('view', {
      ...CONTAINER,
      notAContainerKey: true,
    });
    expect(res.ok).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
  });
});
