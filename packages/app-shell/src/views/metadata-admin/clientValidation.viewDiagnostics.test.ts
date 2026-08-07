// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Field-level diagnostics on the `view` EDIT path (objectui#3606).
 *
 * The edit gate is `ViewMetadataSchema` = `z.preprocess(strip, z.union([…]))`
 * (objectstack#5316 / objectui#3607). Zod reports a union failure as ONE root
 * issue — `path: []`, `message: 'Invalid input'` — with every member's real
 * diagnostics buried in `issue.errors`. Mapping that root issue literally
 * collapsed the whole edit path to a single un-addressable "Invalid input":
 * `SchemaForm` highlights by `path`, Monaco locates by `path`, and the guided
 * messages the spec wrote for these rejections (#4001) never reached the user.
 *
 * Two things are being pinned here, and they are different kinds of claim:
 *
 *  - CANARY — the union member selected by the draft's own discriminant
 *    produces THESE exact paths and messages. The selection indexes members
 *    positionally, which couples to a spec-internal detail; these assertions
 *    are what makes a reorder / insertion / removal of a `ViewMetadataSchema`
 *    union member fail loudly instead of silently mis-selecting.
 *  - PARITY — the verdict (`ok`) is byte-identical to what the un-expanded
 *    mapping produced. The expansion runs strictly inside the issue→form-issue
 *    mapping, downstream of `ok`; only presentation moves. Note this half
 *    CANNOT be red-before-green-after — it was green before the change and must
 *    stay green. That is the point of it.
 */

import { describe, it, expect } from 'vitest';
import { validateMetadataDraft } from './clientValidation';

const EDIT = { mode: 'edit' } as const;

/** A stored ViewItem: what `createBuildBody` emits plus the pin the view switcher wrote. */
const STORED_ITEM: Record<string, unknown> = {
  name: 'crm_lead.all_leads',
  object: 'crm_lead',
  viewKind: 'list',
  label: 'All Leads',
  isPinned: true,
  config: {
    type: 'grid',
    columns: [],
    data: { provider: 'object', object: 'crm_lead' },
  },
};

/** A record that was never expanded into ViewItems. */
const CONTAINER: Record<string, unknown> = {
  name: 'crm_lead',
  label: 'Lead views',
  object: 'crm_lead',
  list: { type: 'grid', columns: ['name'] },
};

describe('view edit path — union diagnostics are expanded to the selected member (objectui#3606)', () => {
  // ── CANARY ───────────────────────────────────────────────────────────────
  // Exact path + message of the member the discriminant selects. If the spec
  // reorders `ViewMetadataSchema`'s union, the positional index in
  // `clientValidation.ts` selects a different member and these go red.

  it('CANARY: a stored ViewItem with a bad layout type reports `config.type`, not a bare root issue', async () => {
    const res = await validateMetadataDraft(
      'view',
      { ...STORED_ITEM, config: { type: 'not_a_real_layout', columns: [] } },
      undefined,
      EDIT,
    );
    expect(res.ok).toBe(false);
    // Before #3606 this was the single issue `{ path: '', message: 'Invalid input' }`.
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0].path).toBe('config.type');
    expect(res.issues[0].message).toContain('Invalid option');
    expect(res.issues[0].message).toContain('"grid"');
  });

  it('CANARY: a stored container with an unknown key reports the spec-authored guidance', async () => {
    const res = await validateMetadataDraft(
      'view',
      { ...CONTAINER, notAContainerKey: true },
      undefined,
      EDIT,
    );
    expect(res.ok).toBe(false);
    expect(res.issues).toHaveLength(1);
    // The container member reports `unrecognized_keys` AT the object it applies
    // to, so the root path is correct here — the message is what was lost.
    expect(res.issues[0].path).toBe('');
    expect(res.issues[0].message).toContain('Unrecognized key(s) on this view container');
    expect(res.issues[0].message).toContain('notAContainerKey');
  });

  it('CANARY: a container key that belongs to a single view recovers the full `defineView` guidance', async () => {
    // #3606's report quoted the container rejection as ending in
    // "Wrap it: defineView({...})". Measured, that clause is not part of the
    // generic message above — it is a PER-KEY hint the spec attaches only to
    // keys that belong to a single view rather than to the container
    // (`type` / `columns` / `data` / `viewKind` / `filters` / `sort`). This is
    // the richest message the collapse was destroying, so it gets its own pin.
    const res = await validateMetadataDraft('view', { ...CONTAINER, columns: ['name'] }, undefined, EDIT);
    expect(res.ok).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0].message).toContain('belongs to a single VIEW, not to the container');
    expect(res.issues[0].message).toContain('Wrap it: `defineView(');
    expect(res.issues[0].message).toContain("The container's own keys are");
  });

  it('CANARY: a missing required field on a stored ViewItem is addressed to that field', async () => {
    const draft = { ...STORED_ITEM };
    delete draft.name;
    const res = await validateMetadataDraft('view', draft, undefined, EDIT);
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.path)).toEqual(['name']);
    expect(res.issues[0].message).toContain('expected string');
  });

  it('CANARY: a bad nested filter operator keeps its full array path', async () => {
    const res = await validateMetadataDraft(
      'view',
      {
        ...STORED_ITEM,
        config: {
          ...(STORED_ITEM.config as Record<string, unknown>),
          filter: [{ field: 'status', operator: 'not_an_operator', value: 'open' }],
        },
      },
      undefined,
      EDIT,
    );
    expect(res.ok).toBe(false);
    expect(res.issues.map((i) => i.path)).toEqual(['config.filter.0.operator']);
    expect(res.issues[0].message).toContain('Invalid option');
  });

  // ── Noise control ────────────────────────────────────────────────────────

  it('shows ONLY the selected member — never the other members’ rejections', async () => {
    // All four members reject this body. The three we did not select say things
    // like "this is not a view container" / "expected undefined, received
    // object", which would be pure noise to someone editing a ViewItem.
    const res = await validateMetadataDraft(
      'view',
      { ...STORED_ITEM, config: { type: 'not_a_real_layout', columns: [] } },
      undefined,
      EDIT,
    );
    const messages = res.issues.map((i) => i.message).join('\n');
    // Positive anchor FIRST: without it the negatives below pass vacuously
    // against the collapsed "Invalid input", which contains no forbidden
    // substring either — green because nothing is produced, not because the
    // selection is right.
    expect(messages).toContain('Invalid option');
    expect(messages).not.toContain('view container');
    expect(messages).not.toContain('expected undefined');
  });

  it('selects by the draft’s discriminant, not by "fewest issues / deepest path"', async () => {
    // The heuristic picks wrong here, measurably: for this container the
    // ViewItem member reports a DEEPER path (`viewKind`, discriminator
    // mismatch) than the container member's root `unrecognized_keys` — and it
    // is the wrong message. The discriminant has no `viewKind`, so the
    // container member is selected regardless of group shape.
    const res = await validateMetadataDraft(
      'view',
      { ...CONTAINER, notAContainerKey: true },
      undefined,
      EDIT,
    );
    const messages = res.issues.map((i) => i.message).join('\n');
    // Positive anchor first, same reason as above.
    expect(messages).toContain('Unrecognized key(s) on this view container');
    expect(messages).not.toContain('Invalid discriminator value');
  });

  // ── Fallbacks: never lose a diagnostic ───────────────────────────────────

  it('a rejected draft always renders at least one issue', async () => {
    // Includes the residual case: `config.columns` fails a union that is nested
    // BELOW the root, which this change deliberately does not expand (a nested
    // member issue's path is relative to its own node, and there is no
    // documented discriminant down there). It still carries a real path, so it
    // is addressable — which the root case was not.
    const bodies: unknown[] = [
      { ...STORED_ITEM, config: { type: 'not_a_real_layout', columns: [] } },
      { ...STORED_ITEM, viewKind: 'not_a_kind' },
      {
        ...STORED_ITEM,
        config: { ...(STORED_ITEM.config as Record<string, unknown>), columns: [{ field: 123 }] },
      },
      { ...CONTAINER, notAContainerKey: true },
      'not even an object',
      null,
    ];
    for (const body of bodies) {
      const res = await validateMetadataDraft('view', body, undefined, EDIT);
      expect(res.ok, JSON.stringify(body)).toBe(false);
      expect(res.issues.length, JSON.stringify(body)).toBeGreaterThan(0);
    }
  });

  it('leaves non-union failures exactly as they were', async () => {
    // `page` has a plain object schema — no union, so the mapping is untouched.
    const res = await validateMetadataDraft('page', { name: 'p', type: 42 });
    expect(res.ok).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res.issues.every((i) => i.message !== 'Invalid input')).toBe(true);
  });
});

/**
 * The CREATE path is judged by the authoring gates (`ViewItemSchema` /
 * `ViewSchema`), neither of which is a root union — so the expansion is a
 * structural no-op there. Pinned with exact values rather than argued.
 */
describe('view create path — unchanged by objectui#3606', () => {
  it('reports the same field-level issue it always did', async () => {
    const res = await validateMetadataDraft('view', {
      name: 'crm_lead.all_leads',
      object: 'crm_lead',
      viewKind: 'list',
      label: 'All Leads',
      config: { type: 'not_a_real_layout', columns: [] },
    });
    expect(res.ok).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues[0].path).toBe('config.type');
    expect(res.issues[0].message).toContain('Invalid option');
  });

  it('still rejects platform-written keys on the authoring surface', async () => {
    const res = await validateMetadataDraft('view', STORED_ITEM);
    expect(res.ok).toBe(false);
    expect(res.issues.length).toBeGreaterThan(0);
  });
});

/**
 * PARITY — the verdict is decided by ONE gate and this change did not touch it.
 *
 * Read this as the anti-regression half of the pair above: whatever the
 * diagnostics now say, `ok` for every shape × mode is what `ViewMetadataSchema`
 * (edit) and the authoring gates (create) already decided. A `try both, pass if
 * either passes` fallback — the thing #3606 explicitly is NOT — would show up
 * here as an expectation flipping to `true`.
 */
describe('view verdict parity — presentation moved, judgement did not (objectui#3606)', () => {
  const CASES: Array<{ label: string; body: unknown; edit: boolean; create: boolean }> = [
    { label: 'clean stored ViewItem (pinned)', body: STORED_ITEM, edit: true, create: false },
    {
      label: 'stored ViewItem with nested console row ids',
      body: {
        ...STORED_ITEM,
        sortOrder: 3,
        config: {
          ...(STORED_ITEM.config as Record<string, unknown>),
          filter: [{ field: 'status', operator: 'equals', value: 'open', id: 'row-1' }],
        },
      },
      edit: true,
      create: false,
    },
    { label: 'aggregated container', body: CONTAINER, edit: true, create: true },
    {
      label: 'ViewItem with a bad layout type',
      body: { ...STORED_ITEM, config: { type: 'not_a_real_layout', columns: [] } },
      edit: false,
      create: false,
    },
    {
      label: 'container with an unknown key',
      body: { ...CONTAINER, notAContainerKey: true },
      edit: false,
      create: false,
    },
    { label: 'ViewItem with an unknown viewKind', body: { ...STORED_ITEM, viewKind: 'nope' }, edit: false, create: false },
    { label: 'not an object at all', body: 'nope', edit: false, create: false },
  ];

  for (const c of CASES) {
    it(`${c.label}: edit=${c.edit ? 'ok' : 'not ok'}, create=${c.create ? 'ok' : 'not ok'}`, async () => {
      const edited = await validateMetadataDraft('view', c.body, undefined, EDIT);
      const created = await validateMetadataDraft('view', c.body, undefined, { mode: 'create' });
      expect(edited.ok, `edit: ${JSON.stringify(edited.issues)}`).toBe(c.edit);
      expect(created.ok, `create: ${JSON.stringify(created.issues)}`).toBe(c.create);
      // ok and issues stay consistent in both directions.
      expect(edited.issues.length === 0).toBe(c.edit);
      expect(created.issues.length === 0).toBe(c.create);
    });
  }
});
