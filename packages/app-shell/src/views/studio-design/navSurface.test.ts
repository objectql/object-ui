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

/**
 * objectui#4881 — the binding reads the CANONICAL target key only.
 *
 * This card is subtraction, and subtraction has a trap: a pin that only says
 * `resolveSurface(x) === null` is green because NOTHING WAS PRODUCED, not
 * because the logic is right — it would have passed before the deleted legs
 * as well as after, so it proves nothing either way. Each spelling is
 * therefore pinned as a PAIR on the SAME `type`, and the pair is what carries
 * the proof:
 *
 *   a) the canonical fixture PARSES against `NavigationItemSchema` and
 *      RESOLVES to a surface — green only if the surviving branch really
 *      reads that key; and
 *   b) the bare fixture is REJECTED by the spec, with an `unrecognized_keys`
 *      issue naming that exact key (so the shape cannot reach a saved app),
 *      AND stays unresolved here.
 *
 * The null in (b) is only meaningful because (a) is non-null on the same
 * variant with only the key spelling changed: the leaf is unresolvable
 * because of the SPELLING, not because the variant has no surface.
 *
 * Measured against the installed `@objectstack/spec` 17.0.0 (the card was
 * written against 17.0.0-rc.6): all four bare spellings are still unknown
 * keys, and the union still has no `view` member.
 */
interface Variant {
  type: string;
  canonicalKey: 'pageName' | 'objectName' | 'dashboardName' | 'reportName';
  /** The spelling `AppSchema` answers with `unrecognized_keys`. */
  bareKey: string;
  name: string;
  label: string;
}

const VARIANTS: Variant[] = [
  { type: 'page', canonicalKey: 'pageName', bareKey: 'page', name: 'home', label: 'Home' },
  { type: 'object', canonicalKey: 'objectName', bareKey: 'object', name: 'crm_lead', label: 'Leads' },
  { type: 'dashboard', canonicalKey: 'dashboardName', bareKey: 'dashboard', name: 'sales', label: 'Sales' },
  { type: 'report', canonicalKey: 'reportName', bareKey: 'report', name: 'pipeline', label: 'Pipeline' },
];

/** Every `unrecognized_keys` key the spec named, flattened. */
function unrecognizedKeys(value: unknown): string[] {
  const parsed = NavigationItemSchema.safeParse(value);
  if (parsed.success) return [];
  return parsed.error.issues.flatMap((i) => (i.code === 'unrecognized_keys' ? i.keys : []));
}

describe.each(VARIANTS)(
  'resolveSurface — $type binds `$canonicalKey`, never the bare `$bareKey` (objectui#4881)',
  ({ type, canonicalKey, bareKey, name, label }) => {
    it('the canonical fixture is spec-VALID and resolves to its surface', () => {
      const node = { id: `nav_${name}`, type, label, [canonicalKey]: name } as NavNode;
      expect(NavigationItemSchema.safeParse(node).success).toBe(true);
      expect(resolveSurface(node)).toEqual({ type, name, label });
    });

    it('the bare spelling is `unrecognized_keys` in the spec AND unresolved here', () => {
      const node = { id: `nav_${name}`, type, label, [bareKey]: name } as NavNode;
      // Half one: the shape cannot reach production — the schema refuses it by
      // name, so no saved app can carry it.
      expect(NavigationItemSchema.safeParse(node).success).toBe(false);
      expect(unrecognizedKeys(node)).toContain(bareKey);
      // Half two: the consumer does not parse it either. Non-trivial because
      // the sibling test above resolves the SAME type with only the key
      // spelling changed — this null is about the spelling, not the variant.
      expect(resolveSurface(node)).toBeNull();
    });

    it('a draft carrying BOTH keys binds to the canonical one', () => {
      const node = { id: `nav_${name}`, type, label, [canonicalKey]: name, [bareKey]: 'rejected_spelling' } as NavNode;
      // Such a draft is unsaveable — the bare key alone is enough to fail.
      expect(unrecognizedKeys(node)).toContain(bareKey);
      expect(resolveSurface(node)?.name).toBe(name);
    });
  },
);

describe('resolveSurface — there is no `view` nav variant (objectui#4881)', () => {
  const VIEW_LEAF = { id: 'nav_all', type: 'view', label: 'All Leads', viewName: 'all' } as NavNode;

  it('`type: "view"` fails the discriminator — the union has nine members and none is `view`', () => {
    const parsed = NavigationItemSchema.safeParse(VIEW_LEAF);
    expect(parsed.success).toBe(false);
    const issue = parsed.success ? undefined : parsed.error.issues[0];
    expect(issue?.code).toBe('invalid_union');
    expect(issue?.path).toEqual(['type']);
    // The deleted branch could only ever have run on this — i.e. never.
    expect(resolveSurface(VIEW_LEAF)).toBeNull();
  });

  it('`viewName` is an OPTIONAL key ON the object item, so that leaf still binds as `object`', () => {
    // The reason there is no `view` TYPE: "which list view to open" is a
    // property of an object nav item, not a navigation variant of its own.
    const node = { id: 'nav_lead', type: 'object', label: 'Leads', objectName: 'crm_lead', viewName: 'all' } as NavNode;
    expect(NavigationItemSchema.safeParse(node).success).toBe(true);
    expect(resolveSurface(node)).toEqual({ type: 'object', name: 'crm_lead', label: 'Leads' });
  });

  it('the bare `view` key is `unrecognized_keys` even on an otherwise valid object item', () => {
    const node = { id: 'nav_lead', type: 'object', label: 'Leads', objectName: 'crm_lead', view: 'all' } as NavNode;
    expect(unrecognizedKeys(node)).toContain('view');
  });
});
