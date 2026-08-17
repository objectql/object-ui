// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Interfaces-pillar nav-leaf binding (objectui#4019).
 *
 * The gap this pins: an `action` nav item is a LIVE runtime surface — the
 * shipped sidebar renders it and `useNavActionDispatch` executes it
 * (framework#4509) — but the Studio Interfaces rail could not resolve it to a
 * design surface, so the very same entry rendered permanently DISABLED in the
 * designer while it worked in the running app. `action` has had both a
 * registered preview (`ActionPreview`) and a registered default inspector
 * (`ActionDefaultInspector`) all along; only this binding was missing.
 *
 * The fixtures are parsed against the spec's own `NavigationItemSchema` rather
 * than asserted by eye, so this file cannot drift into pinning a shape the
 * schema rejects (the phantom-rule trap): the positive fixture must be
 * spec-VALID for the designer to be required to open it, and the rejected
 * alias spelling must stay unresolvable here because the schema refuses it by
 * name — Commandment #0.1, no second dialect in the consumer.
 */
import { describe, expect, it } from 'vitest';
import { NavigationItemSchema } from '@objectstack/spec/ui';
import { resolveSurface, findSurfaceInTree, type NavNode } from './navSurface';

/** A spec-valid global-action nav item. */
const ACTION_NODE: NavNode = {
  id: 'nav_run_sync',
  type: 'action',
  label: 'Run Sync',
  actionDef: { actionName: 'sync_now' },
};

describe('resolveSurface — action nav items (objectui#4019)', () => {
  it('the fixture is a real authoring surface: the spec accepts it whole', () => {
    const parsed = NavigationItemSchema.safeParse(ACTION_NODE);
    expect(parsed.success).toBe(true);
  });

  it('binds an action nav leaf to the `action` design surface', () => {
    expect(resolveSurface(ACTION_NODE)).toEqual({
      type: 'action',
      name: 'sync_now',
      label: 'Run Sync',
    });
  });

  it('leaves an action item with no actionName unresolved (stays disabled)', () => {
    expect(resolveSurface({ id: 'nav_x', type: 'action', label: 'Nothing' })).toBeNull();
    expect(resolveSurface({ id: 'nav_x', type: 'action', label: 'Nothing', actionDef: {} })).toBeNull();
  });

  it('reads the canonical key ONLY — a spelling the schema rejects stays unresolved', () => {
    // `action` / `name` inside `actionDef` are REJECTED aliases carrying a
    // redirect (objectstack#4001), not second spellings. Measured on
    // spec 17.0.0-rc.6: `unrecognized_keys` on `actionDef` plus a missing
    // `actionName`. A tolerant `??` limb here would resurrect exactly the bug
    // #4001 closed — an entry that dispatches an action the author did not
    // declare — so the designer must refuse what the schema refuses.
    const aliasNode = {
      id: 'nav_run_sync',
      type: 'action',
      label: 'Run Sync',
      actionDef: { action: 'sync_now' },
    };
    const parsed = NavigationItemSchema.safeParse(aliasNode);
    expect(parsed.success).toBe(false);
    expect(resolveSurface(aliasNode as NavNode)).toBeNull();
  });

  it('reaches an action leaf nested in a group (the `?surface=` deep-link path)', () => {
    const tree: NavNode[] = [
      { id: 'g1', type: 'group', label: 'Ops', children: [ACTION_NODE] },
    ];
    expect(findSurfaceInTree(tree, { type: 'action', name: 'sync_now' })).toEqual({
      type: 'action',
      name: 'sync_now',
      label: 'Run Sync',
    });
  });
});

describe('resolveSurface — the variants around the new one are unchanged', () => {
  it('still binds the surface-bearing leaves', () => {
    expect(resolveSurface({ type: 'page', pageName: 'home', label: 'Home' })?.type).toBe('page');
    expect(resolveSurface({ type: 'object', objectName: 'crm_lead', label: 'Leads' })?.name).toBe('crm_lead');
    expect(resolveSurface({ type: 'dashboard', dashboardName: 'sales', label: 'Sales' })?.name).toBe('sales');
    expect(resolveSurface({ type: 'report', reportName: 'pipeline', label: 'Pipeline' })?.name).toBe('pipeline');
  });

  it('leaves the variants with no authorable target unresolved', () => {
    // Deliberately NOT openable — `url` points out of the product, `separator`
    // is a divider, and `component` names a first-party UI shipped in code, so
    // none of the three has a metadata item to design. Only `action` was a
    // metadata type sitting in this bucket by omission.
    expect(resolveSurface({ id: 'nav_docs', type: 'url', label: 'Docs', url: 'https://example.com' })).toBeNull();
    expect(resolveSurface({ id: 'nav_sep', type: 'separator' })).toBeNull();
    expect(
      resolveSurface({ id: 'nav_dir', type: 'component', label: 'Directory', componentRef: 'metadata:directory' }),
    ).toBeNull();
  });
});
