/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `record:*` blocks — the BOUND RECORD must reach the output
 * (objectui#3149 layer 3a; objectstack#4413's original shape, stated
 * behaviourally).
 *
 * ## Why a second probe rather than an extension of the first
 *
 * `public-block-binding-reach.test.tsx` asks one question: a block that
 * declares `objectName`, mounted bare — does any data call carry that name?
 * Every `record:*` block is outside that question by construction. They take
 * their subject from `<RecordContextProvider>`, not from a schema prop, so
 * mounted bare they correctly do nothing, and "made no data call" says nothing
 * about whether they work.
 *
 * That is not a hypothetical gap. It is the exact place objectstack#4413 lived:
 * `record:details` / `record:highlights` / `record:path` / `record:related_list`
 * published `objectName` + `recordId` that no renderer read, four blocks
 * rendered blank on a real record page, and every gate stayed green — because
 * the framework check compares two declarations (objectstack#4472) and the
 * binding-reach probe cannot see this family at all. Until this file, the claim
 * "this family works under a record page" was an ASSUMPTION with no behavioural
 * evidence behind it.
 *
 * ## The question this asks
 *
 *   Mount the block under a record context with record A, then with record B —
 *   two different records of the SAME object, identical trees. Does anything
 *   about its behaviour change?
 *
 * Evidence is a difference between the two mounts: in the rendered DOM, or in
 * the data calls made. Either one proves the bound record reached the renderer
 * and came out the other side.
 *
 * Two records rather than bound-vs-unbound, deliberately. An unbound control
 * differs in TREE SHAPE (one less provider), so `React.useId` values shift and
 * blocks "differ" for a reason that has nothing to do with the record — the
 * probe would manufacture its own green. Two records under an identical tree
 * hold everything constant except the one variable under test.
 *
 * And a differential rather than "renders something": objectui#3149 records the
 * decision NOT to cover the display primitives precisely because "renders
 * non-empty" is also true of a block that ignores every input it declares. A
 * gate that reports green without checking anything is what objectstack#4472
 * exists to eliminate, and adding one here would be self-defeating. A block
 * that renders the same fixed shell for two different records scores zero
 * evidence — the correct reading of a block whose subject never arrives.
 *
 * The differential is itself checked, not assumed: {@link mountThrice} also
 * renders record A a second time and asserts that mount is byte-identical to
 * the first. If that control ever fails, "A differs from B" stops meaning
 * "the record reached the output" and this whole file's green becomes noise —
 * so it is asserted per block rather than trusted.
 *
 * ## Scope, stated so this is not over-read in turn
 *
 * A difference proves the record REACHES the output. It does not prove the
 * output is RIGHT — nothing on this chain looks at rendered results (ADR-0082
 * addendum). And "no difference" has legitimate causes: a block whose data is
 * injected by the page host rather than declared by the author. Those are
 * ledgered below with the host path NAMED and a file:line to check it against,
 * because "host-fed" is only a reason while a host actually feeds it — the day
 * no host does, "host-fed" is the same excuse objectstack#4413 shipped behind.
 * One entry in the ledger was exactly that case when this file landed:
 * `record:activity`, whose feed no host fed and whose renderer hard-coded
 * `items={[]}`. objectui#3165 gave it a scoped `sys_activity` read and the
 * entry went with it — the ledger's two-way assertion is what forced that.
 */

import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import {
  SchemaRenderer,
  SchemaRendererProvider,
  RecordContextProvider,
  MetadataCtx,
} from '@object-ui/react';
// The real registration graphs, same posture as public-contract.test.ts and the
// binding-reach probe: a hand-copied list would agree with itself.
import '@object-ui/components';
import '../register-plugins';

/** The object every probed block is mounted against. */
const PROBE_OBJECT = 'probe_object__c';
/** The related/child object a `record:*` block fans out to. */
const PROBE_CHILD_OBJECT = 'probe_child__c';
/** The lookup field on the child pointing back at the parent record. */
const RELATIONSHIP_FIELD = 'parent_probe_id';
/** The action name `record:quick_actions` is asked to resolve from metadata. */
const PROBE_ACTION = 'probe_action';

/**
 * Two records of the SAME object, differing in every field.
 *
 * Same object so that object-driven behaviour (metadata lookups, permission
 * gates, the related-object name) is held constant and the record is the only
 * variable. Every field differs so a block that surfaces any ONE of them
 * registers a difference — a block that happens to render only `stage` must not
 * read as unbound because the probe varied only `name`.
 *
 * `stage` differs across the qualified/draft boundary specifically: it is what
 * `record:path` highlights and what the `record:alert` / quick-action
 * predicates below are written against.
 */
const RECORD_A = {
  id: 'probe-record-aaaa',
  name: 'Probe Alpha',
  description: 'first probe record',
  amount: 4413,
  stage: 'qualified',
  updated_at: '2026-08-01T00:00:00.000Z',
};
const RECORD_B = {
  id: 'probe-record-bbbb',
  name: 'Probe Bravo',
  description: 'second probe record',
  amount: 4472,
  stage: 'draft',
  updated_at: '2026-08-02T00:00:00.000Z',
};

/**
 * Object metadata the record blocks resolve field labels, picklists and
 * ACTIONS through.
 *
 * The action carries `visible` over the record because that is the only way
 * `record:quick_actions` depends on the bound record at all: it renders the
 * OBJECT's declared actions, and the record decides which of them survive the
 * predicate filter. Gating a quick action on record state is the ordinary
 * Lightning-style configuration, not a contrivance for the probe.
 */
const PROBE_OBJECT_SCHEMA = {
  name: PROBE_OBJECT,
  label: 'Probe Object',
  primaryField: 'name',
  fields: [
    { name: 'id', label: 'ID', type: 'text' },
    { name: 'name', label: 'Name', type: 'text' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'amount', label: 'Amount', type: 'number' },
    {
      name: 'stage',
      label: 'Stage',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Won', value: 'won' },
      ],
    },
  ],
  actions: [
    {
      name: PROBE_ACTION,
      label: 'Probe Action',
      type: 'url',
      locations: ['record_header'],
      visible: "record.stage === 'qualified'",
    },
  ],
};

/**
 * `DataSource` methods carried as real own properties so a block that derives a
 * source by spreading still gets them — the artifact the binding-reach probe
 * paid for once already (`{...dataSource}` over a bare Proxy copies nothing).
 */
const DATA_SOURCE_METHODS = [
  'find', 'findOne', 'create', 'update', 'delete', 'aggregate', 'count',
  'getObjectSchema', 'getObjects', 'getView', 'listViews', 'listViewOverrides',
  'updateViewConfig', 'onMutation',
] as const;

/**
 * A plausible value for each declared input, keyed by input NAME.
 *
 * Keyed by name rather than by type because on this family the type carries
 * almost no information: `statusField`, `relationshipField` and `emptyText` are
 * all `type: 'string'`, and only one of them can be filled with `'x'` without
 * making the block short-circuit. Every value points at something that exists
 * in {@link RECORD_A} / {@link PROBE_OBJECT_SCHEMA}, so a block that reads its
 * config and then reads the record finds real referents on both sides.
 *
 * `sections` is here because the generic `array` sample (`['name']`) is not
 * merely uninformative, it is malformed: `record:details` spreads each section
 * entry, so a bare string became `{0:'n',1:'a',…}` and the block died inside
 * `DetailView` with "Cannot read properties of undefined (reading 'name')".
 * That crash is the fourth instance of the one lesson this pair of probes keeps
 * re-learning: a plausible value for every input is not a plausible
 * CONFIGURATION. It is also why {@link assertRendered} exists — a crash must
 * fail loudly rather than land in the "no difference" bucket and read as a
 * finding about the block.
 *
 * `add` is the FIFTH instance, and arrived the moment `record:related_list`
 * started publishing it (objectui#3808). The generic `object` sample is `{}`,
 * and `{}` is not a valid `add`: the spec makes `picker` required, so the sample
 * has to carry `picker.object` or the fixture is exercising metadata no author
 * could publish. Filled here rather than by loosening the generic `object`
 * sample, which would put an unspecified bag on every future `object` input.
 *
 * That `{}` did not merely under-exercise the block, it CRASHED it —
 * `RelatedList.tsx:1299` dereferences `add.picker.object` where `:378` / `:390`
 * optional-chain the same path — and the crash is filed as objectui#3838 rather
 * than papered over here: this fixture's job is to be spec-valid, not to steer
 * clear of the renderer's unguarded reads.
 */
const SAMPLE_BY_INPUT: Readonly<Record<string, unknown>> = {
  // On `record:*` this names the RELATED object, not the page's object —
  // `record:related_list` fans out from the bound parent to its children
  // (@objectstack/spec react-blocks.ts spells this out after objectstack#4340).
  objectName: PROBE_CHILD_OBJECT,
  childObject: PROBE_CHILD_OBJECT,
  relationshipField: RELATIONSHIP_FIELD,
  columns: ['name', 'amount'],
  fields: ['name', 'description', 'amount'],
  sections: [{ name: 'main', title: 'Main', fields: ['description', 'amount'] }],
  statusField: 'stage',
  stages: [
    { value: 'draft', label: 'Draft' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'won', label: 'Won' },
  ],
  actionNames: [PROBE_ACTION],
  // `record:alert` is a banner whose COPY is authored; the only thing the bound
  // record decides is whether it shows. Filling `visible` with a predicate over
  // the record is therefore the only configuration under which "does the record
  // reach this block" is even askable — an alert with no predicate is
  // unconditionally visible and identical for every record, which would be the
  // probe answering its own question with a shrug.
  visible: "record.stage === 'qualified'",
  title: 'Probe Alert',
  body: 'Probe alert body',
  // `record:related_list.add` — spec-valid minimum, i.e. `picker.object` present.
  // Points at the same child object the rest of this fixture uses, so the Add
  // affordance is configured against something that exists rather than at a
  // dangling name.
  add: { picker: { object: PROBE_CHILD_OBJECT } },
};

/** Fill one declared input. */
const sampleFor = (input: any): unknown => {
  if (input.name in SAMPLE_BY_INPUT) return SAMPLE_BY_INPUT[input.name];
  if (input.defaultValue !== undefined) return input.defaultValue;
  switch (input.type) {
    case 'number': return 1;
    case 'boolean': return true;
    case 'array': return ['name'];
    case 'object': return {};
    case 'enum': {
      const first = input.enum?.[0];
      return typeof first === 'object' && first !== null ? first.value : (first ?? 'x');
    }
    default: return 'x';
  }
};

/** Minimal metadata context: enough for `getItem('object', PROBE_OBJECT)`. */
const METADATA: any = {
  apps: [], objects: [PROBE_OBJECT_SCHEMA], dashboards: [], reports: [], pages: [],
  loading: false,
  error: null,
  refresh: async () => {},
  invalidate: () => {},
  ensureType: async () => [],
  getItem: async (type: string, name: string) =>
    type === 'object' && name === PROBE_OBJECT ? PROBE_OBJECT_SCHEMA : null,
  getItemsByType: () => [],
  getTypeStatus: () => 'ready',
};

/**
 * The call log of the mount currently in flight — see
 * {@link installHermeticFetch}.
 */
let currentCalls: string[] | null = null;

/**
 * Make the probe hermetic, and treat a bare `fetch` as data access like any
 * other.
 *
 * Some blocks in this family call `fetch` directly rather than going through
 * the injected data source (`/api/v1/security/explain` is the one this family
 * reaches for today). Under happy-dom a relative `/api/...` resolves against
 * `localhost:3000`, so left alone the probe depends on nothing listening there
 * — it "worked" only because the connection was refused, printed two dozen
 * ECONNREFUSED lines doing it, and would behave differently for a developer
 * with a dev server on that port. Reject immediately instead: the same answer
 * as "no backend", with no socket and no ambient dependency.
 *
 * The URL goes into the same call log as the data-source calls, so a block that
 * binds the record through a bare fetch is credited for it rather than reported
 * as unbound — the log is meant to be every data access, not every access
 * through one API.
 */
function installHermeticFetch(): void {
  (globalThis as any).fetch = (input: any) => {
    const url = String(typeof input === 'string' ? input : input?.url ?? input);
    currentCalls?.push(`fetch(${url})`);
    return Promise.reject(new Error('probe: network disabled'));
  };
}
installHermeticFetch();

interface Mount {
  html: string;
  calls: string[];
}

/** Mount one block under a record context and report DOM + data calls. */
async function mountWithRecord(cfg: any, record: Record<string, unknown>): Promise<Mount> {
  const calls: string[] = [];
  const stub = (key: string) =>
    (...args: unknown[]) => {
      // Capped: a stub with a stable identity cannot spin, but a renderer that
      // polls on an interval still can, and an uncapped log turns that into an
      // OOM instead of a readable result.
      if (calls.length < 200) {
        calls.push(`${key}(${args.map((a) => JSON.stringify(a) ?? 'undefined').join(', ')})`);
      }
      // Subscription methods hand back an UNSUBSCRIBE function; a promise there
      // crashes teardown with `unsub is not a function`, a failure that says
      // nothing about the block.
      return /^on[A-Z]/.test(key) || key === 'subscribe' ? () => {} : Promise.resolve([]);
    };
  const seeded: Record<string, unknown> = {};
  for (const m of DATA_SOURCE_METHODS) seeded[m] = stub(m);
  // The Proxy MEMOIZES: one stub per key, for the life of this mount.
  //
  // Not a nicety — a fresh function per access is a live infinite-render loop.
  // These blocks hand `ctx.dataSource` to components deep enough to put data
  // source methods in `useEffect` / `useMemo` dependency arrays; an unmemoized
  // `get` changes every one of those deps on every render, so the component
  // re-renders forever. The first run of this probe pinned a core and grew to
  // 8.6 GB without ever reaching an assertion. The binding-reach probe never
  // hit it because a bare-mounted block is a much shallower tree.
  const stubs = new Map<string, unknown>();
  const dataSource: any = new Proxy(seeded, {
    get: (target, key: string | symbol) => {
      if (key in target) return (target as any)[key];
      // Two accesses must answer "absent" rather than "here is a stub":
      //   - symbols (`Symbol.iterator`, `Symbol.toPrimitive`, React internals)
      //     — a stub would be called in a protocol position it cannot satisfy,
      //     and `/^on[A-Z]/.test(symbol)` throws before that anyway;
      //   - `then` — a stub there makes this object a THENABLE, so anything
      //     that awaits it or wraps it in `Promise.resolve` hangs forever on a
      //     resolve callback that is only ever recorded.
      if (typeof key === 'symbol' || key === 'then') return undefined;
      if (!stubs.has(key)) stubs.set(key, stub(key));
      return stubs.get(key);
    },
  });

  const schema: Record<string, unknown> = { type: cfg.type };
  for (const input of cfg.inputs ?? []) schema[input.name] = sampleFor(input);

  currentCalls = calls;
  const view = render(
    <MetadataCtx.Provider value={METADATA}>
      <SchemaRendererProvider dataSource={dataSource}>
        {/*
          `dataSource` is typed `string` on RecordContextValue (a datasource id)
          while `record:history`, `record:reference_rail` and
          `record:line_items` all call `.find` on it — the host passes the
          object and the renderers cast. Passing the object is what matches the
          runtime (app-shell RecordDetailView), not the declaration.
        */}
        <RecordContextProvider
          objectName={PROBE_OBJECT}
          recordId={record.id as string}
          data={record}
          objectSchema={PROBE_OBJECT_SCHEMA}
          dataSource={dataSource}
        >
          <SchemaRenderer schema={schema as any} />
        </RecordContextProvider>
      </SchemaRendererProvider>
    </MetadataCtx.Provider>,
  );
  // Settle: a block may fetch from an effect, after a lazy renderer resolves,
  // or in a second pass once the object schema lands.
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  const html = view.container.innerHTML;
  try {
    view.unmount();
  } catch {
    /* teardown is not the subject — same posture as the binding-reach probe */
  }
  currentCalls = null;
  return { html, calls };
}

/**
 * Mount A, mount A again (the control), then mount B.
 *
 * The control is what keeps "A differs from B" meaningful. If two mounts of the
 * SAME record ever diverge — an unstable id, a timestamp, a random key — then a
 * difference no longer traces to the record and every "reaches" verdict in this
 * file becomes a coin flip that happens to land green.
 */
async function mountThrice(cfg: any): Promise<{ a: Mount; control: Mount; b: Mount }> {
  const a = await mountWithRecord(cfg, RECORD_A);
  const control = await mountWithRecord(cfg, RECORD_A);
  const b = await mountWithRecord(cfg, RECORD_B);
  return { a, control, b };
}

/**
 * SchemaRenderer catches a renderer's throw and paints an error card. A crashed
 * block renders the SAME card for both records, so without this it would land
 * in the "no difference" bucket and be read as a finding about its binding —
 * the probe reporting a broken probe as a broken block.
 */
const assertRendered = (type: string, m: Mount) => {
  expect(
    m.html.includes('failed to render'),
    `<${type}> threw during render — that is a crash, not a binding verdict:\n${m.html.slice(0, 600)}`,
  ).toBe(false);
};

/**
 * Every public `record:*` block, exactly.
 *
 * Exact rather than a floor, for the reason objectui#3149 layer 1 cost a
 * release to learn: the failure mode is a candidate set that quietly gets
 * SMALLER, and `toContain` / `length > 0` sail straight past it.
 *
 * `record:chatter` is absent because it is not public — it is the same renderer
 * as `record:discussion` under a Salesforce-familiar alias, and
 * `public-contract.test.ts` excludes it on those grounds.
 */
const EXPECTED_CANDIDATES = [
  'record:details',
  'record:highlights',
  'record:related_list',
  'record:path',
  'record:line_items',
  'record:activity',
  'record:discussion',
  'record:history',
  'record:quick_actions',
  'record:reference_rail',
  'record:alert',
];

/**
 * Blocks where the bound record changes nothing observable, each with the
 * reason and the place to check it. Entries are DEBT, not acceptance — an entry
 * whose block starts responding to the record fails this test until deleted.
 *
 * Both entries are host-fed by design and the host really does feed them.
 *
 * A third entry — `record:activity`, the one this probe was written to find —
 * was deleted by objectui#3165, which gave the block the scoped `sys_activity`
 * read it had been declaring eleven filters over. It reaches now, so the ledger
 * cannot carry it: the assertion below is two-way and goes red on a block that
 * responds to the record while still listed here. That is the whole point of
 * writing the ledger as an assertion rather than a skip.
 */
const NO_RECORD_REACH: Readonly<Record<string, string>> = {
  // ── Host-fed, and the host really does feed them ──────────────────────────
  // Feed items come from DiscussionContext, which the page host mounts
  // (app-shell RecordDetailView wraps the record body in
  // <DiscussionContextProvider>). The block is a presenter, not a fetcher, so
  // mounted without that provider it correctly shows an empty feed. The
  // provider and its data are real — which is the difference between a reason
  // and an excuse, and why entries here have to name the path instead of just
  // saying "host-fed". (`record:activity` used to sit here on a claim of the
  // same shape with no host behind it; #3165 is what that cost to establish.)
  'record:discussion':
    'feed items come from DiscussionContext, mounted by the page host (app-shell RecordDetailView); presenter, not fetcher',

  // The rail's `entries` are not an author input at all — the registration
  // declares only `hideEmpty`, and `buildDefaultPageSchema` supplies `entries`
  // from the object's related-list definitions. With no entries the renderer
  // returns null before it can fetch, which is why both mounts are empty. Its
  // per-entry fetch IS scoped to the parent record (`dataSource.find(entry
  // .objectName, …parentId)`), so it reaches — just not from anything an
  // author can declare, and therefore not from anything this probe can vary.
  'record:reference_rail':
    'its `entries` are injected by the page host (plugin-detail buildDefaultPageSchema), not declared by the author; with none it returns null before fetching',
};

/**
 * Blocks that fan out from the parent record to a CHILD object, and the
 * declared binding that must appear in that fetch (objectui#3149 layer 2).
 *
 * This is the narrow slice layer 2 asked for, in the only form the codebase
 * offers it. The slice #3149 originally proposed — `recordId` on `object-form`
 * / `object-master-detail-form` / `embeddable-form` — does not exist: NO public
 * block declares a `recordId` input (the only `recordId`/`resourceId` inputs in
 * the repo are on `view:detail` and `detail-view`, neither of which is in the
 * curated public set). That is the same result objectstack#4472's direction (d)
 * hit — a slice proposed from the declarations, unavailable once you look at
 * what is actually declared.
 *
 * What IS available is stronger anyway: two blocks whose REQUIRED
 * `relationshipField` / `childObject` must land in the query, mechanically
 * checkable, and only observable under a record context — i.e. only from this
 * probe. It settles the "same mechanism, different assertion" hypothesis #3149
 * wanted tested before anyone decides to widen: it holds, and it cost one
 * assertion on mounts that were already happening.
 */
const CHILD_QUERY_BINDINGS: Readonly<Record<string, readonly string[]>> = {
  'record:related_list': [PROBE_CHILD_OBJECT, RELATIONSHIP_FIELD],
  'record:line_items': [PROBE_CHILD_OBJECT, RELATIONSHIP_FIELD],
};

const candidates = ComponentRegistry.getPublicConfigs().filter((c) =>
  c.type.startsWith('record:'),
);

describe('record:* blocks — the bound record reaches the output (objectui#3149)', () => {
  it('probes exactly the public record:* blocks', () => {
    expect([...candidates.map((c) => c.type)].sort()).toEqual([...EXPECTED_CANDIDATES].sort());
  });

  for (const cfg of candidates) {
    const ledgered = cfg.type in NO_RECORD_REACH;
    it(`${cfg.type} ${ledgered ? 'is unmoved by the bound record (ledgered)' : 'responds to the bound record'}`, async () => {
      const { a, control, b } = await mountThrice(cfg);

      assertRendered(cfg.type, a);
      assertRendered(cfg.type, b);

      // The instrument, checked before it is read from.
      expect(
        control.html === a.html && control.calls.join('|') === a.calls.join('|'),
        `<${cfg.type}> rendered differently for the SAME record twice, so a difference ` +
          'between two records proves nothing here. Find the unstable output (an id, a ' +
          'timestamp, a random key) before trusting any verdict in this file.',
      ).toBe(true);

      const domDiffers = a.html !== b.html;
      const callsDiffer = a.calls.join('|') !== b.calls.join('|');

      if (ledgered) {
        // Asserted, not skipped: the day this block starts responding to the
        // record, this fails and the ledger entry has to go. A ledger nobody is
        // FORCED to update decays into the accepted baseline that let
        // objectstack#4413 ship.
        expect(
          domDiffers || callsDiffer,
          `<${cfg.type}> now responds to the bound record — delete its NO_RECORD_REACH entry`,
        ).toBe(false);
      } else {
        expect(
          domDiffers || callsDiffer,
          `<${cfg.type}> rendered identically and made identical data calls for two ` +
            `DIFFERENT records of ${PROBE_OBJECT}. The bound record does not reach its ` +
            'output — objectstack#4413\'s shape.\n' +
            `Calls: ${a.calls.join(' | ') || '(none)'}\n` +
            'Either the record does not reach the renderer (fix the wiring), or the block ' +
            'is legitimately fed by the page host: add it to NO_RECORD_REACH naming the ' +
            'host path, so the next reader can check the claim instead of trusting it.',
        ).toBe(true);
      }

      // objectui#3149 layer 2 — the child fetch must carry the declared
      // bindings, not just SOME binding.
      const expected = CHILD_QUERY_BINDINGS[cfg.type];
      if (expected) {
        const fetches = a.calls.filter((c) => c.startsWith('find('));
        expect(fetches.length, `<${cfg.type}> made no find() call to check bindings against`)
          .toBeGreaterThan(0);
        for (const token of expected) {
          expect(
            fetches.some((c) => c.includes(token)),
            `<${cfg.type}> declares "${token}" but no find() call carries it.\n` +
              `Calls: ${a.calls.join(' | ')}`,
          ).toBe(true);
        }
        // And the parent it scopes to must be the BOUND record, not a constant.
        expect(
          fetches.some((c) => c.includes(RECORD_A.id)),
          `<${cfg.type}> fetches children but not scoped to the bound parent record`,
        ).toBe(true);
      }
    }, 60_000);
  }

  it('the ledger and the layer-2 slice name only blocks that exist — no stale entries', () => {
    const stale = (types: string[]) => types.filter((t) => !candidates.some((c) => c.type === t));

    expect(
      stale(Object.keys(NO_RECORD_REACH)),
      'NO_RECORD_REACH lists blocks that are no longer public — delete them',
    ).toEqual([]);
    for (const [type, reason] of Object.entries(NO_RECORD_REACH)) {
      expect(reason.length, `${type} needs a written reason, not an empty one`).toBeGreaterThan(20);
    }

    // Same check for the layer-2 slice, for the same reason: a binding
    // assertion keyed on a block that stopped existing stops running, silently.
    // That is how a gate's real scope drifts below its stated one — objectui#3149
    // layer 1 in miniature.
    expect(
      stale(Object.keys(CHILD_QUERY_BINDINGS)),
      'CHILD_QUERY_BINDINGS names blocks that are no longer public — its assertions are dead',
    ).toEqual([]);
  });
});
