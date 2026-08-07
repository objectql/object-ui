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

/**
 * ── NESTED union diagnostics: `config.columns` (objectui#3626) ──
 *
 * #3606 expanded the ROOT union only, and said so: `config.columns` is
 * `string[] | ColumnDef[]` with no discriminant, and it stayed collapsed. It
 * collapsed on BOTH gates, and had done on the create gate since long before
 * #3606 — measured on @objectstack/spec 17.0.0-rc.5, before this change:
 *
 *   create (`ViewItemSchema`)      → path `config.columns`  msg `Invalid input`
 *   edit   (`ViewMetadataSchema`)  → path `config.columns`  msg `Invalid input`
 *
 * The path was real, so the field was reachable; the message said nothing about
 * WHICH column or WHAT was expected. The rule that fixes it selects the union
 * member the value's own first element elects — a fact about what the author
 * wrote, the same class of rule as the root's `viewKind`, and not a ranking of
 * the error groups against each other.
 *
 * Three kinds of claim are pinned below, and they fail for different reasons:
 *
 *  - CANARY — the elected member's exact `path` + `message`. Members are
 *    indexed positionally, so a spec-side reorder of the `columns` union turns
 *    these red instead of quietly reporting the other variant's complaint.
 *  - NARROWING — the unions this rule must NOT speak for. `config.sort`
 *    (`string | ColumnSort[]`) is the live counter-example: drop the guard that
 *    ignores members which rejected the node's type outright, and a bare
 *    first-element test starts answering for it. These pin today's untouched
 *    output, so that regression is loud.
 *  - CONVERGENCE — create and edit report the SAME thing. #3626 was filed on
 *    the observation that PR #3624 made the two gates agree on a bad message;
 *    they have to keep agreeing on the good one.
 */
describe('view nested union — `config.columns` diagnostics (objectui#3626)', () => {
  // `STORED_ITEM` carries `isPinned`, which the AUTHORING gate rejects on
  // purpose (it is Studio state the console writes, pinned by "still rejects
  // platform-written keys on the authoring surface" above). Comparing the two
  // gates issue-for-issue needs a body whose only defect is the one under test,
  // so these cases author it themselves — same record, minus the console's pin.
  const AUTHORABLE_ITEM: Record<string, unknown> = { ...STORED_ITEM };
  delete AUTHORABLE_ITEM.isPinned;

  const withColumns = (columns: unknown) => ({
    ...AUTHORABLE_ITEM,
    config: { ...(AUTHORABLE_ITEM.config as Record<string, unknown>), columns },
  });

  /** Every case here must read identically through both gates. */
  const bothGates = async (body: unknown) => {
    const created = await validateMetadataDraft('view', body, undefined, { mode: 'create' });
    const edited = await validateMetadataDraft('view', body, undefined, EDIT);
    expect(created.ok).toBe(false);
    expect(edited.ok).toBe(false);
    // CONVERGENCE — the create gate reaches this union as a top-level issue,
    // the edit gate reaches it one level down inside the root member it
    // selected. Both compose to the same draft-absolute path.
    expect(edited.issues).toEqual(created.issues);
    return created.issues;
  };

  // ── CANARY ───────────────────────────────────────────────────────────────

  it('CANARY: a mis-typed key on a column object is addressed to that key', async () => {
    // Before: `config.columns` / `Invalid input` (both gates).
    const issues = await bothGates(withColumns([{ field: 123 }]));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('config.columns.0.field');
    expect(issues[0].message).toContain('expected string, received number');
  });

  it('CANARY: a column object missing its required `field` names the missing key', async () => {
    const issues = await bothGates(withColumns([{}]));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('config.columns.0.field');
    expect(issues[0].message).toContain('expected string, received undefined');
  });

  it('CANARY: a stray non-string in a field-NAME list is addressed to that element', async () => {
    // First element is a string, so the author is writing `string[]`; the
    // element that broke it is index 2. The object member's THREE rejections of
    // a shape they never chose are not shown — that is the noise control.
    const issues = await bothGates(withColumns(['a', 'b', 42]));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('config.columns.2');
    expect(issues[0].message).toContain('expected string, received number');
  });

  it('CANARY: a mixed list is judged by the variant its FIRST element elects', async () => {
    // Object first → this is a `ColumnDef[]`, and element 1 is the odd one out.
    const issues = await bothGates(withColumns([{ field: 'a' }, 'b']));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('config.columns.1');
    expect(issues[0].message).toContain('expected object, received string');
  });

  it('CANARY: the same union under the aggregated container reports `list.columns.…`', async () => {
    // The container reaches the identical union by a different route: top-level
    // on create, under root member [1] on edit. Prefix composition is the thing
    // under test — a member issue's path is relative to its own union node.
    const issues = await bothGates({
      ...CONTAINER,
      list: { type: 'grid', columns: [{ field: 123 }] },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('list.columns.0.field');
    expect(issues[0].message).toContain('expected string, received number');
  });

  it('shows ONLY the elected variant — never both members’ complaints', async () => {
    const issues = await bothGates(withColumns(['a', 'b', 42]));
    const messages = issues.map((i) => i.message).join('\n');
    // Positive anchor FIRST — without it the negative below passes vacuously
    // against a collapsed `Invalid input`, which contains no forbidden
    // substring either (the #3606 lesson, same trap).
    expect(messages).toContain('expected string, received number');
    expect(messages).not.toContain('expected object, received string');
  });

  // ── NARROWING: unions this rule must stay out of ─────────────────────────

  it('does NOT answer for `config.sort` — one member never accepted the array', async () => {
    // `sort` is `string | ColumnSort[]`. For `['name']` a bare first-element
    // test would elect the plain-`string` member and report "expected string,
    // received array" — true, and the wrong thing to tell someone who correctly
    // wrote an array. A member that rejected the node's TYPE outright never
    // looked at the contents, so the contents are not evidence for it, and the
    // CONTENT rule is left out of it. Remove that guard and this goes red.
    //
    // RE-PINNED BY #3678, and the claim above is unchanged: what this test
    // guards is that the plain-`string` member is never the one selected. The
    // expected value moved because a DIFFERENT rule — the sole-candidate rule —
    // now speaks here, and it selects the OTHER member, the one that actually
    // read the array. The forbidden mis-selection is asserted directly below so
    // the guard cannot pass vacuously: if #3626's narrowing guard is deleted,
    // the content rule elects `string[]` first and both assertions go red.
    const issues = await bothGates({
      ...AUTHORABLE_ITEM,
      config: { ...(AUTHORABLE_ITEM.config as Record<string, unknown>), sort: ['name'] },
    });
    expect(issues).toEqual([
      { path: 'config.sort.0', message: 'Invalid input: expected object, received string' },
    ]);
    expect(issues.map((i) => i.message).join('\n')).not.toContain(
      'expected string, received array',
    );
  });

  it('does NOT answer for a filter value union (five members, not two)', async () => {
    // The CONTENT rule needs exactly two members, and this union has five, so
    // it still declines — the claim this test was written for.
    //
    // RE-PINNED BY #3678: for an ARRAY value, four of the five members reject
    // the type outright and the array member is the sole candidate, so the
    // sole-candidate rule descends one level to the offending element. It then
    // STOPS: the element's own union (`string | number`) is rejected by every
    // member, nothing distinguishes them, and Zod's message is kept. The result
    // is a nearer path with the same message — `…value.0` rather than `…value`.
    const issues = await bothGates({
      ...AUTHORABLE_ITEM,
      config: {
        ...(AUTHORABLE_ITEM.config as Record<string, unknown>),
        filter: [{ field: 'f', operator: 'in', value: [{}] }],
      },
    });
    expect(issues).toEqual([{ path: 'config.filter.0.value.0', message: 'Invalid input' }]);
  });

  // ── Boundaries: what the content cannot elect ────────────────────────────

  it('an EMPTY `columns` is VALID — the undiscriminable case never arises', async () => {
    // Measured, not assumed: `[]` satisfies BOTH members, so the union succeeds
    // and there is no failure to expand. "What do we show for an empty array"
    // has no answer because it has no question.
    const created = await validateMetadataDraft('view', withColumns([]), undefined, {
      mode: 'create',
    });
    const edited = await validateMetadataDraft('view', withColumns([]), undefined, EDIT);
    expect(created.ok).toBe(true);
    expect(edited.ok).toBe(true);
  });

  it('a first element that elects NEITHER variant keeps the union’s own message', async () => {
    // `42` is neither a field name nor a column object; both members reject it
    // identically. Electing one would be inventing a preference the author
    // never expressed, so this stays exactly as it was — still addressable at
    // `config.columns`, which is what made #3626 milder than #3606.
    expect(await bothGates(withColumns([42]))).toEqual([
      { path: 'config.columns', message: 'Invalid input' },
    ]);
    expect(await bothGates(withColumns([null]))).toEqual([
      { path: 'config.columns', message: 'Invalid input' },
    ]);
  });

  it('a `columns` that is not an array at all keeps the union’s own message', async () => {
    // Both members do agree here ("expected array, received string"), but
    // promoting a message because all members happen to share it is a DIFFERENT
    // mechanism (#3626's direction 1), deliberately not built here.
    expect(await bothGates(withColumns('nope'))).toEqual([
      { path: 'config.columns', message: 'Invalid input' },
    ]);
  });

  it('stops at the next union down, but addressed to it rather than to `columns`', async () => {
    // `columns[0].summary` is `enum | {type, field}` — an OBJECT value, so the
    // array rule declines it and it keeps Zod's message. That is the descent
    // bound: not a depth counter, but a rule that has nothing to say here.
    // Before this change the whole thing collapsed to `config.columns`.
    const issues = await bothGates(withColumns([{ field: 'a', summary: { type: 'bogus' } }]));
    expect(issues).toEqual([{ path: 'config.columns.0.summary', message: 'Invalid input' }]);
  });
});

/**
 * PARITY, nested layer — same claim as the block above, same reason it is green
 * in both directions: the expansion runs inside the issue→form-issue mapping,
 * downstream of `ok`. Listed separately because these bodies are the ones
 * #3626 moves, so they are the ones worth re-pinning.
 */
describe('view verdict parity — `columns` bodies (objectui#3626)', () => {
  const withColumns = (columns: unknown) => ({
    ...STORED_ITEM,
    config: { ...(STORED_ITEM.config as Record<string, unknown>), columns },
  });

  const CASES: Array<{ label: string; body: unknown; ok: boolean }> = [
    { label: 'empty columns', body: withColumns([]), ok: true },
    { label: 'field-name list', body: withColumns(['name', 'amount']), ok: true },
    { label: 'column-def list', body: withColumns([{ field: 'name' }]), ok: true },
    { label: 'column def with a bad key type', body: withColumns([{ field: 123 }]), ok: false },
    { label: 'field-name list with a stray number', body: withColumns(['a', 42]), ok: false },
    { label: 'mixed list', body: withColumns([{ field: 'a' }, 'b']), ok: false },
    { label: 'columns elected by nothing', body: withColumns([42]), ok: false },
    { label: 'columns not an array', body: withColumns('nope'), ok: false },
  ];

  for (const c of CASES) {
    it(`${c.label}: edit=${c.ok ? 'ok' : 'not ok'}`, async () => {
      const edited = await validateMetadataDraft('view', c.body, undefined, EDIT);
      expect(edited.ok, `edit: ${JSON.stringify(edited.issues)}`).toBe(c.ok);
      expect(edited.issues.length === 0).toBe(c.ok);
    });
  }
});

/**
 * ── NESTED union diagnostics: the SOLE-CANDIDATE rule (objectui#3678) ──
 *
 * #3626 narrowed its content rule so it could not speak for `config.sort`, and
 * said what that left behind: when a union's members are censused by the
 * categorical test — did this member reject the value's TYPE at the node
 * itself, without ever reading it? — and EXACTLY ONE member is left standing,
 * naming that member is not a guess. It is the only member that read the value,
 * so it is the only one whose complaint can be about what the author wrote.
 *
 * Measured before implementing, on @objectstack/spec 17.0.0-rc.5:
 *
 *   sort: [{field:'n', order:'bogus'}]  member[0] `string`        rejected the type
 *                                       member[1] `ColumnSort[]`  [0].order Invalid option
 *
 * so the diagnostic that reached the user was `config.sort` / `Invalid input`
 * while the spec's own guided message sat one level down, unread.
 *
 * ── How this rule relates to #3626's content rule ────────────────────────────
 *
 * They are DISJOINT, not layered, and the dispatch for #3678 asked for that to
 * be measured rather than asserted. Let `k` be how many members accepted the
 * value's type. `k` partitions every nested union:
 *
 *   k === 1                → #3678 names the sole candidate.
 *   k === members.length   → every member read the value, so the value's own
 *                            CONTENT decides (#3626), which further declines
 *                            unless the union is `array<A> | array<B>`.
 *   otherwise              → no rule; the union keeps Zod's message.
 *
 * `k === 1` and `k === members.length` can only coincide at a one-member union,
 * which this schema does not produce — and #3626's rule requires exactly two
 * members anyway. The census below walks every nested-union shape the `view`
 * family produces and pins that no shape lands in two cells, so there is no
 * priority question to answer.
 *
 * Three kinds of claim are pinned here:
 *
 *  - CANARY — the sole candidate's exact `path` + `message`. This rule does not
 *    index members positionally, so a reorder cannot hurt it; what CAN hurt it
 *    is a spec change to the member SET (a third `sort` member that also accepts
 *    arrays would take `k` from 1 to 2 and collapse the node back). These turn
 *    red on that instead of quietly reverting to `Invalid input`.
 *  - DISJOINTNESS — the two rules never both select, asserted over the census.
 *  - MAINTAINED — the cells where this rule must stay silent (`k === 0`, and
 *    `k >= 2` where the content rule declines) still read exactly as #3626 left
 *    them.
 */
describe('view nested union — the sole-candidate rule (objectui#3678)', () => {
  const AUTHORABLE_ITEM: Record<string, unknown> = { ...STORED_ITEM };
  delete AUTHORABLE_ITEM.isPinned;

  const withConfig = (extra: Record<string, unknown>) => ({
    ...AUTHORABLE_ITEM,
    config: { ...(AUTHORABLE_ITEM.config as Record<string, unknown>), ...extra },
  });

  /** Every case here must read identically through both gates. */
  const bothGates = async (body: unknown) => {
    const created = await validateMetadataDraft('view', body, undefined, { mode: 'create' });
    const edited = await validateMetadataDraft('view', body, undefined, EDIT);
    expect(created.ok).toBe(false);
    expect(edited.ok).toBe(false);
    expect(edited.issues).toEqual(created.issues);
    return created.issues;
  };

  // ── CANARY ───────────────────────────────────────────────────────────────

  it('CANARY: a bad `order` on a sort row reports the key and the allowed options', async () => {
    // THE case #3678 was filed on. Before: `config.sort` / `Invalid input`.
    const issues = await bothGates(withConfig({ sort: [{ field: 'n', order: 'bogus' }] }));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('config.sort.0.order');
    expect(issues[0].message).toContain('Invalid option');
    expect(issues[0].message).toContain('"asc"');
    expect(issues[0].message).toContain('"desc"');
  });

  it('CANARY: a non-object element in a sort list is addressed to that element', async () => {
    // The `string` member rejected the array outright, so `ColumnSort[]` is the
    // sole candidate and index 0 is where it broke. Measured, against the
    // dispatch's guess that BOTH members would reject `[42]`: they do not — the
    // array member accepts the type and complains about the element.
    const issues = await bothGates(withConfig({ sort: [42] }));
    expect(issues).toEqual([
      { path: 'config.sort.0', message: 'Invalid input: expected object, received number' },
    ]);
  });

  it('CANARY: every issue of the sole candidate is shown, and only that member’s', async () => {
    // `sort: [{}]` is missing `field` AND has no valid `order`. Both belong to
    // the selected member; the rejected member's "expected string, received
    // array" is not among them.
    const issues = await bothGates(withConfig({ sort: [{}] }));
    expect(issues.map((i) => i.path)).toEqual(['config.sort.0.field', 'config.sort.0.order']);
    const messages = issues.map((i) => i.message).join('\n');
    // Positive anchor FIRST — a collapsed `Invalid input` contains no forbidden
    // substring either, so the negative alone would pass vacuously (#3606's
    // lesson, and #3626 hit the same trap).
    expect(messages).toContain('expected string, received undefined');
    expect(messages).not.toContain('expected string, received array');
  });

  it('CANARY: the same union under the aggregated container reports `list.sort.…`', async () => {
    // Prefix composition on the other route: top-level on create, one level
    // down inside the selected root member on edit.
    const issues = await bothGates({
      ...CONTAINER,
      list: { type: 'grid', columns: ['name'], sort: [{ field: 'n', order: 'bogus' }] },
    });
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('list.sort.0.order');
    expect(issues[0].message).toContain('Invalid option');
  });

  it('CANARY: a scalar union member left standing names the options it wanted', async () => {
    // `columns[0].summary` is `enum | {type, field}`. Handed a STRING the object
    // member rejects the type, leaving the enum as sole candidate — so the path
    // is unchanged and the MESSAGE stops being `Invalid input`. (Handed an
    // OBJECT, k is 2 and this stays collapsed — pinned in the #3626 block.)
    const issues = await bothGates(withConfig({ columns: [{ field: 'a', summary: 'bogus' }] }));
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('config.columns.0.summary');
    expect(issues[0].message).toContain('Invalid option');
    expect(issues[0].message).toContain('"count"');
  });

  it('descends more than one level when each level has a sole candidate', async () => {
    // `sections[].fields[]` is `string | FormField`. This is the reach #3678's
    // own scope paragraph did not expect: it read this union as rejecting
    // wholesale, which it does for a scalar element but not for an object one.
    const issues = await bothGates({
      ...AUTHORABLE_ITEM,
      viewKind: 'form',
      config: { type: 'simple', sections: [{ fields: [{}] }] },
    });
    expect(issues).toEqual([
      {
        path: 'config.sections.0.fields.0.field',
        message: 'Invalid input: expected string, received undefined',
      },
    ]);
  });

  // ── MAINTAINED: the cells this rule must stay out of ─────────────────────

  it('k === 0 — every member rejected the type, so the collapse is kept', async () => {
    // `sort: 42` is neither a string nor an array. Nothing distinguishes the
    // members, and #3626 already ruled that inventing a preference is not ours.
    expect(await bothGates(withConfig({ sort: 42 }))).toEqual([
      { path: 'config.sort', message: 'Invalid input' },
    ]);
  });

  it('k >= 2 — two members read the value, so this rule stays silent', async () => {
    // `columns: [42]` — BOTH members accepted the array type, so there is no
    // sole candidate; the content rule then declines because `42` elects
    // neither variant, and the node keeps its own message. This is the
    // uniqueness requirement doing its job: drop it and take "the first member
    // that accepted" instead, and this reports `config.columns.0` /
    // "expected string, received number" — a preference nobody expressed.
    expect(await bothGates(withConfig({ columns: [42] }))).toEqual([
      { path: 'config.columns', message: 'Invalid input' },
    ]);
  });

  it('every nested union shape lands in exactly ONE rule’s cell — census', async () => {
    // The `k` partition is an argument about the code; this is the measurement
    // that stands behind it. For each shape: the nested union under test
    // (`unionAt`), where the diagnostic actually lands (`reportedAt`), and which
    // cell that implies.
    //
    // The cells are observable from outside, but NOT — as this test first
    // assumed and was corrected by running it — through the path alone. A rule
    // that spoke shows up as a nearer path OR as a named message, and each can
    // happen without the other:
    //
    //   selected member's issue is DEEPER  → path moves   (`sort` → `…sort.0.order`)
    //   selected member's issue is AT the  → path stays, message stops being
    //     union node (a scalar member)       `Invalid input` (`summary: 'bogus'`)
    //   descent ends in a `none` cell      → path moves, message stays
    //     one level further down             (`filter[].value: [{}]`)
    //
    // So the honest test of "did a rule speak" is the disjunction, and `none`
    // is exactly its negation: the address is still the union node AND the
    // message is still the node's own `Invalid input`.
    //
    // What makes this a disjointness measurement rather than a list: the two
    // rules would collide only if a k=2 union were also selected as a sole
    // candidate. The `columns` rows are the k=2 population — three of them, two
    // where the content rule speaks and one where nothing does — and none of
    // them reports the "first member that accepted" address (`config.columns.0`
    // / "expected string, received number" for `[42]`) that a collision would
    // produce. The `k >= 2` test above pins that single case directly.
    const CENSUS: Array<{
      label: string;
      body: unknown;
      unionAt: string;
      reportedAt: string;
      cell: 'sole' | 'content' | 'none';
      collapsedMessage: boolean;
    }> = [
      { label: 'sort: bad order', body: withConfig({ sort: [{ field: 'n', order: 'bogus' }] }), unionAt: 'config.sort', reportedAt: 'config.sort.0.order', cell: 'sole', collapsedMessage: false },
      { label: 'sort: of field names', body: withConfig({ sort: ['name'] }), unionAt: 'config.sort', reportedAt: 'config.sort.0', cell: 'sole', collapsedMessage: false },
      { label: 'sort: of numbers', body: withConfig({ sort: [42] }), unionAt: 'config.sort', reportedAt: 'config.sort.0', cell: 'sole', collapsedMessage: false },
      { label: 'sort: a bare number', body: withConfig({ sort: 42 }), unionAt: 'config.sort', reportedAt: 'config.sort', cell: 'none', collapsedMessage: true },
      { label: 'columns: bad key type', body: withConfig({ columns: [{ field: 123 }] }), unionAt: 'config.columns', reportedAt: 'config.columns.0.field', cell: 'content', collapsedMessage: false },
      { label: 'columns: stray element', body: withConfig({ columns: ['a', 42] }), unionAt: 'config.columns', reportedAt: 'config.columns.1', cell: 'content', collapsedMessage: false },
      { label: 'columns: elected by nothing', body: withConfig({ columns: [42] }), unionAt: 'config.columns', reportedAt: 'config.columns', cell: 'none', collapsedMessage: true },
      { label: 'columns: not an array', body: withConfig({ columns: 'nope' }), unionAt: 'config.columns', reportedAt: 'config.columns', cell: 'none', collapsedMessage: true },
      { label: 'summary: a bad enum string', body: withConfig({ columns: [{ field: 'a', summary: 'bogus' }] }), unionAt: 'config.columns.0.summary', reportedAt: 'config.columns.0.summary', cell: 'sole', collapsedMessage: false },
      { label: 'summary: an object', body: withConfig({ columns: [{ field: 'a', summary: { type: 'bogus' } }] }), unionAt: 'config.columns.0.summary', reportedAt: 'config.columns.0.summary', cell: 'none', collapsedMessage: true },
      { label: 'filter value: an array', body: withConfig({ filter: [{ field: 'f', operator: 'in', value: [{}] }] }), unionAt: 'config.filter.0.value', reportedAt: 'config.filter.0.value.0', cell: 'sole', collapsedMessage: true },
      { label: 'filter value: an object', body: withConfig({ filter: [{ field: 'f', operator: 'equals', value: {} }] }), unionAt: 'config.filter.0.value', reportedAt: 'config.filter.0.value', cell: 'none', collapsedMessage: true },
    ];
    for (const c of CENSUS) {
      const issues = await bothGates(c.body);
      expect(issues.map((i) => i.path), c.label).toEqual([c.reportedAt]);
      expect(issues[0].message === 'Invalid input', c.label).toBe(c.collapsedMessage);
      // The address never leaves the union node's subtree, whatever spoke.
      expect(
        c.reportedAt === c.unionAt || c.reportedAt.startsWith(`${c.unionAt}.`),
        c.label,
      ).toBe(true);
      const spoke = c.reportedAt !== c.unionAt || issues[0].message !== 'Invalid input';
      expect(spoke, c.label).toBe(c.cell !== 'none');
    }
  });

  it('a rule speaking is NOT the same as the message improving — both directions', async () => {
    // Two rows of the census move in only one of the two observables each, and
    // asserting the wrong one is how a pin passes for a reason that is not the
    // reason it claims. Written out so the next reader does not re-derive it.

    // Path moves, message does NOT. The sole-candidate rule named the element
    // that broke the list, but the element's own union is rejected by every
    // member, so the descent ends in a `none` cell and `Invalid input` is all
    // there is left to show.
    expect(
      await bothGates(withConfig({ filter: [{ field: 'f', operator: 'in', value: [{}] }] })),
    ).toEqual([{ path: 'config.filter.0.value.0', message: 'Invalid input' }]);

    // Message moves, path does NOT. The sole candidate is the ENUM member,
    // whose issue sits AT the union node, so the address is unchanged and the
    // entire gain is that the user is told which options exist.
    const summary = await bothGates(withConfig({ columns: [{ field: 'a', summary: 'bogus' }] }));
    expect(summary.map((i) => i.path)).toEqual(['config.columns.0.summary']);
    expect(summary[0].message).not.toBe('Invalid input');
    expect(summary[0].message).toContain('Invalid option');
  });
});

/**
 * PARITY, sole-candidate layer — the verdict cannot move, for the structural
 * reason #3606 and #3626 already pinned: the expansion runs inside the
 * issue→form-issue mapping, downstream of `ok`. Green before this change and
 * green after; that is the point of it, not a weakness of it.
 */
describe('view verdict parity — sole-candidate bodies (objectui#3678)', () => {
  const withConfig = (extra: Record<string, unknown>) => ({
    ...STORED_ITEM,
    config: { ...(STORED_ITEM.config as Record<string, unknown>), ...extra },
  });

  const CASES: Array<{ label: string; body: unknown; ok: boolean }> = [
    { label: 'sort as a field name', body: withConfig({ sort: 'name' }), ok: true },
    { label: 'sort as an empty array', body: withConfig({ sort: [] }), ok: true },
    { label: 'sort as column sorts', body: withConfig({ sort: [{ field: 'n', order: 'asc' }] }), ok: true },
    { label: 'sort with a bad order', body: withConfig({ sort: [{ field: 'n', order: 'bogus' }] }), ok: false },
    { label: 'sort of field names', body: withConfig({ sort: ['name'] }), ok: false },
    { label: 'sort of numbers', body: withConfig({ sort: [42] }), ok: false },
    { label: 'sort as a number', body: withConfig({ sort: 42 }), ok: false },
    { label: 'summary as a bad enum', body: withConfig({ columns: [{ field: 'a', summary: 'bogus' }] }), ok: false },
  ];

  for (const c of CASES) {
    it(`${c.label}: edit=${c.ok ? 'ok' : 'not ok'}`, async () => {
      const edited = await validateMetadataDraft('view', c.body, undefined, EDIT);
      expect(edited.ok, `edit: ${JSON.stringify(edited.issues)}`).toBe(c.ok);
      expect(edited.issues.length === 0).toBe(c.ok);
    });
  }
});
