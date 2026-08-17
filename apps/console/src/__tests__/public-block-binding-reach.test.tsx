/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Public blocks — a declared `objectName` binding must REACH THE DATA LAYER
 * (objectstack#4472, the detection half of objectstack#4413).
 *
 * ## Why this exists
 *
 * The framework's spec↔registry check (`check:react-declaration-parity`)
 * compares two DECLARATIONS: the spec zod schema's props on one side, and on
 * the other the `inputs` this repo's registry configs declare — copied verbatim
 * into `sdui.manifest.json` by `manifestFromConfigs`. Neither side observes a
 * renderer. So a prop that both sides declare and NO renderer consumes reads as
 * perfect agreement over there, and it did: `record:details` /
 * `record:highlights` / `record:related_list` / `record:path` published
 * `objectName`+`recordId` that nothing read, four blocks rendered blank, and
 * that check stayed green for the whole life of the defect (objectstack#4413).
 * It was found by a human reading these renderers.
 *
 * This test is the evidence that check cannot gather, taken from the only place
 * that has it — the render path. It is deliberately narrow: not "is every
 * declared input consumed" (undecidable from outside without heuristics) but
 * one exact, observable question per block —
 *
 *   mount it through `SchemaRenderer` with a plausible value for every input it
 *   declares, under a provider whose `dataSource` records every call:
 *   **did any call carry the object name?**
 *
 * Every declared input, not just the required ones: a block's read path can be
 * gated on an optional one (`embeddable-form` only builds the read-only source
 * its inner `ObjectForm` fetches through when `config.fields` is non-empty), and
 * omitting it would read here as "does not bind" when the truth is "was never
 * asked to". Values are plausible rather than degenerate for the same reason —
 * an early `[]` for `columns` makes a list render its empty state without ever
 * asking for data.
 *
 * A block that declares `objectName` and asks the data layer for something else
 * — or for nothing at all — is not bound to the object it advertises. That is
 * the objectstack#4413 shape, stated behaviourally.
 *
 * ## Scope, stated so it is not over-read in turn
 *
 * A reaching call proves the binding is WIRED, not that the block renders
 * correctly. And "did not reach" has legitimate causes (a block that needs a
 * parent record id first), which is what the ledger below is for — every
 * non-reaching block carries a written reason, and the ledger is asserted to
 * equal the observed set in BOTH directions, so a block that starts reaching
 * must be removed from it and a block that stops reaching fails here.
 *
 * The other half of "not over-read" is COVERAGE, and it has to be asserted
 * rather than assumed — see {@link EXPECTED_CANDIDATES}. This suite's first
 * release under-reported its own scope by 6 of 14 object-bound blocks and said
 * nothing (objectui#3149), which is the same shape as the gate it was written to
 * compensate for: a claim wider than the thing behind it.
 */

import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { ComponentRegistry } from '@object-ui/core';
import { SchemaRenderer, SchemaRendererProvider } from '@object-ui/react';
// The two graphs whose registrations this reads — the layout/content primitives
// and the console's own plugin layer, from the module main.tsx boots from. Same
// posture as public-contract.test.ts: read the REAL registration list, because a
// hand-copied one would agree with itself and tell us nothing.
import '@object-ui/components';
import '../register-plugins';

/** The object name every probed block is bound to; must appear in a data call. */
const PROBE_OBJECT = 'probe_object__c';

/**
 * `DataSource` methods the recording stub carries as real own properties, so a
 * block that derives a source by spreading (`{...dataSource, …}`) still gets
 * them. Not exhaustive and does not need to be — anything unlisted is served by
 * the Proxy's `get` — it only needs to cover what survives a spread.
 */
const DATA_SOURCE_METHODS = [
  'find',
  'findOne',
  'create',
  'update',
  'delete',
  'aggregate',
  'count',
  'getObjectSchema',
  'getObjects',
  'getView',
  'listViews',
  'listViewOverrides',
  'updateViewConfig',
  'onMutation',
] as const;

/**
 * Blocks that declare an `objectName` input and do NOT reach the data layer
 * with it, each with the reason. Entries are debt, not acceptance — an entry
 * whose block starts reaching fails this test until it is deleted.
 */
const NO_DATA_REACH: Readonly<Record<string, string>> = {
  // Legitimate, and documented on the framework side (@objectstack/spec
  // react-blocks.ts, the objectstack#4413 exclusion ledger): this block renders
  // a CHILD list scoped to a parent record, and takes that parent from the
  // record page's shared record context. Mounted with no record bound there is
  // no parent id, so it correctly declines to fetch rather than listing the
  // whole child object. `objectName` IS read — it names the related object and
  // titles the panel.
  'record:related_list':
    'needs the parent record id from RecordContext before it may fetch; declines to fetch without one (objectstack#4413 ledger)',

  // `list-view` and `embeddable-form` were the other two entries here for
  // exactly one release of this file. Neither registration bridged the
  // schema-renderer context onto the component's `dataSource` PROP — the bridge
  // `object-form`, `object-kanban` and `object-calendar` always had — and
  // `SchemaRenderer` never injects it, so on the registry/SDUI path both
  // rendered an empty shell while declaring `objectName` **required**: the
  // objectstack#4413 shape, one layer up.
  //
  // They are gone because #3144 fixed the wiring, and they are gone the only way
  // an entry here can go: the assertions below stopped passing the moment those
  // two blocks started reaching the data layer, and deleting the entries was the
  // way to get green again. That is the whole point of the both-directions
  // check — a ledger nobody is FORCED to update is how an accepted baseline
  // starts, and an accepted baseline reporting zero divergence is what let
  // objectstack#4413 ship.
};

/**
 * Every public block this suite must probe, exactly.
 *
 * An exact list rather than a floor, because the failure mode is a SHRINKING
 * candidate set — and that is not hypothetical, it is what shipped
 * (objectui#3149). The console registers most object blocks with
 * `registerLazy`, and a pending stub carries no `inputs`: `Registry.getMeta`
 * says in as many words that consumers must treat that as *"not yet known"*,
 * not as *"declares no props"*. The first release of this file filtered on
 * `inputs` directly and so silently dropped `object-chart`, `object-kanban`,
 * `object-calendar`, `object-gantt`, `object-timeline` and `object-map` — six
 * Tier-A object blocks, every one of them declaring `objectName` as
 * **required** — while reporting eight green probes and no gap.
 *
 * That is objectui#2953's shape (a lazy registration falling out of the
 * contract) recurring one layer up, in the consumer this time; and it is
 * objectstack#4472's shape recurring in the very suite written to answer it — a
 * gate whose stated scope was wider than its actual reach. The lesson both
 * times is the same one `public-contract.test.ts` already carries: a `toContain`
 * or a `length > 0` sails straight past a set that quietly got smaller. Only an
 * exact list makes both directions a deliberate edit.
 */
const EXPECTED_CANDIDATES = [
  'object-grid',
  'list-view',
  'object-form',
  'embeddable-form',
  'object-master-detail-form',
  'object-metric',
  'object-pivot',
  'record:related_list',
  // The six objectui#3149 restored. Lazily registered by the console, so they
  // only surface here once their loaders have run (see resolveLazyPublicBlocks).
  'object-chart',
  'object-kanban',
  'object-calendar',
  'object-gantt',
  'object-timeline',
  'object-map',
];

/**
 * Run every pending public lazy loader, so `getPublicConfigs()` reports each
 * block's real `inputs` instead of a stub's absent ones.
 *
 * Driven off the registry's OWN recorded loaders rather than a hand-written list
 * of plugin imports: a list here would drift out of step with
 * `register-plugins.ts` and reintroduce the same silent shrinkage by a different
 * route. It also keeps the registry mutation scoped to this file — loading via
 * `loadLazy` is what the app itself does on first use, not a test-only override
 * of what is registered.
 */
async function resolveLazyPublicBlocks(): Promise<void> {
  const pending = ComponentRegistry.getPublicConfigs().filter((c) => c.lazy);
  await Promise.all(
    pending.map((c) => {
      // A lazy entry is keyed under both its bare tag and `namespace:tag`;
      // `getPublicConfigs` reports the canonical (namespaced) one.
      const bare = c.type.includes(':') ? c.type.slice(c.type.indexOf(':') + 1) : c.type;
      return (
        ComponentRegistry.loadLazy(c.type) ??
        ComponentRegistry.loadLazy(bare) ??
        Promise.resolve()
      );
    }),
  );
}

await resolveLazyPublicBlocks();

/** Does this config declare an `objectName` input? */
const declaresObjectName = (cfg: { inputs?: Array<{ name?: string }> }) =>
  (cfg.inputs ?? []).some((i) => i?.name === 'objectName');

/**
 * Inputs that SUPERSEDE the `objectName` binding — filling them is the author
 * telling the block not to fetch, so the probe must leave them unset.
 *
 * Narrow and reasoned, not a convenience escape hatch. `data` is the documented
 * alternative data source: @objectstack/spec's react overlay glosses it as
 * *"static/precomputed data to chart directly **instead of** binding via
 * objectName + aggregate"*, and `ObjectChart`'s fetch is guarded by
 * `if ((schema.objectName || schema.dataset) && !boundData && !schema.data)`.
 * Filling it and then reporting "objectName never reached the data layer" would
 * be the probe manufacturing its own finding — the same mistake as seeding
 * `columns: []` (which makes a list render its empty state without fetching) or
 * spreading a bare Proxy (which strips a derived source of every method). Three
 * instances of one lesson: a plausible value for EVERY input is not the same as
 * a plausible CONFIGURATION.
 *
 * `customFields` is the second, and it arrived the same way `data` did — as a
 * red on this probe the moment objectui#4648 declared `object-form`'s full
 * authoring surface. Its guard is `ObjectForm.tsx:426`,
 * `const hasInlineFields = schema.customFields && schema.customFields.length > 0`,
 * read at `:455` under the comment *"Skip fetching if we have inline fields"* —
 * which substitutes a minimal in-memory object schema for the
 * `getObjectSchema(schema.objectName)` call — and again at `:479` to skip the
 * record fetch. The repo's own type says the same in prose: *"When used with
 * inline field definitions (without dataSource), this becomes the primary field
 * source"* (`ObjectFormSchema.customFields`, `packages/types/src/objectql.ts`).
 * So a non-empty `customFields` is the author declaring the fields inline, i.e.
 * telling the block not to fetch — the `data` case exactly. Note the guard is
 * LENGTH-sensitive: `sampleFor` returns a non-empty `['name']` for an array
 * input, which is what tripped it; an empty array would have left the binding
 * intact. That is the "plausible value ≠ plausible configuration" lesson a
 * fourth time.
 *
 * Add to this list only with the guard quoted, so the next reader can check the
 * claim instead of trusting it.
 */
const SUPERSEDES_BINDING = new Set(['data', 'customFields']);

/**
 * A plausible value for one declared input.
 *
 * "Plausible", not "present": arrays are non-empty because an empty `columns` is
 * a config a block can legitimately short-circuit on, and a block that renders
 * its empty state without asking for data would read here as an unbound
 * binding.
 */
const sampleFor = (input: any): unknown => {
  if (input.name === 'objectName') return PROBE_OBJECT;
  // `record:related_list.add` — the generic `object` sample below is `{}`, and
  // `{}` is not a valid `add`: the spec makes `picker` required. An invalid one
  // did not merely under-configure this block, it CRASHED it
  // (`RelatedList.tsx:1299` dereferenced `add.picker.object`, objectui#3838,
  // whose fix now gates the Add affordance on the resolved picker target) —
  // and a crashed block makes no data calls, which is indistinguishable from the
  // "declines to fetch" verdict this block is ledgered for below. That is a green
  // for the wrong reason, so the sample is spec-valid at the source instead.
  // Arrived with objectui#3808, which is when `add` became a declared input.
  if (input.name === 'add') return { picker: { object: PROBE_OBJECT } };
  if (input.defaultValue !== undefined) return input.defaultValue;
  switch (input.type) {
    case 'number':
      return 1;
    case 'boolean':
      return true;
    case 'array':
      return ['name'];
    case 'object':
      return {};
    case 'enum': {
      const first = input.enum?.[0];
      return typeof first === 'object' && first !== null ? first.value : (first ?? 'x');
    }
    default:
      return input.name === 'recordId' ? 'probe-record-1' : 'x';
  }
};

/**
 * What one probe mount observed: every data-layer call the block made, and the
 * DOM it produced.
 *
 * The html half is here because a crash is invisible in `calls` alone —
 * `SchemaRenderer` catches a renderer's throw and paints an error card, so a
 * crashed block simply makes no calls, which is the pass condition on the
 * ledgered branch below. Deliberately the same shape and field names as the
 * sibling probe's `Mount` (`record-block-record-reach.test.tsx:310-313`), which
 * has captured both halves from the start for the same reason.
 */
interface Mount {
  calls: string[];
  html: string;
}

/**
 * Mount one block bare and report every data-layer call it made, plus the DOM.
 *
 * The data source is a Proxy so ANY method a block reaches for is recorded
 * rather than crashing it — a block that calls `dataSource.aggregate` must not
 * fail the probe merely because a hand-written stub didn't anticipate it.
 */
async function dataCallsFor(cfg: any): Promise<Mount> {
  const calls: string[] = [];
  const record = (key: string) =>
    (...args: unknown[]) => {
      calls.push(`${key}(${args.map((a) => JSON.stringify(a) ?? 'undefined').join(', ')})`);
      // Subscription methods hand back an UNSUBSCRIBE function, which the block
      // calls on unmount. Returning a promise for those crashes the teardown
      // (`unsub is not a function`) — a failure that says nothing about the
      // block.
      return /^on[A-Z]/.test(key) || key === 'subscribe' ? () => {} : Promise.resolve([]);
    };
  // Seeded with real own properties, not a bare Proxy target: a block may hand
  // its own children a DERIVED source (`{...dataSource, create: stub}` — that is
  // exactly what `embeddable-form` does to neutralise writes on a public form),
  // and spreading a Proxy over `{}` copies nothing, silently stripping every
  // method. The Proxy still answers anything unseeded, so a block reaching for a
  // method not listed here is recorded rather than crashing.
  const seeded: Record<string, unknown> = {};
  for (const m of DATA_SOURCE_METHODS) seeded[m] = record(m);
  const dataSource: any = new Proxy(seeded, {
    get: (target, key: string) => (key in target ? (target as any)[key] : record(key)),
  });

  // EVERY declared input, not just the required ones — see the file header: a
  // read path can be gated on an optional input, and leaving it out would report
  // a block as unbound when it was simply never asked to fetch.
  const schema: Record<string, unknown> = { type: cfg.type };
  for (const input of cfg.inputs ?? []) {
    if (SUPERSEDES_BINDING.has(input.name)) continue;
    schema[input.name] = sampleFor(input);
  }

  const view = render(
    <SchemaRendererProvider dataSource={dataSource}>
      <SchemaRenderer schema={schema as any} />
    </SchemaRendererProvider>,
  );
  // Settle: a block may fetch from an effect, after a lazy renderer resolves, or
  // in a second pass once the object schema lands.
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  }
  // Teardown is not the subject. `object-map` mounts maplibre-gl, whose
  // `map.remove()` throws in jsdom because there is no WebGL context to release
  // — a fact about the DOM implementation, not about whether the block bound to
  // its object. Every call it made is already recorded above, so swallow the
  // unmount and let the assertion speak to the data reach. Deliberately scoped
  // to unmount: an error thrown during RENDER still propagates and fails.
  // Read the DOM before unmounting: `SchemaRenderer` CATCHES a renderer's throw
  // and paints an error card, so a crash never propagates here — it just makes
  // the block produce nothing, including no data calls. For a ledgered block
  // ("declines to fetch") that is a green earned by crashing, which is why this
  // is captured and asserted rather than left to the calls alone. Same guard the
  // sibling probe carries as `assertRendered`
  // (`record-block-record-reach.test.tsx`), added here after objectui#3808 made
  // an invalid `add` sample able to trigger exactly that.
  const html = view.container.innerHTML;
  try {
    view.unmount();
  } catch {
    /* see above */
  }
  return { calls, html };
}

const candidates = ComponentRegistry.getPublicConfigs().filter(declaresObjectName);

describe('public blocks — a declared objectName reaches the data layer (objectstack#4472)', () => {
  it('probes exactly the public blocks that declare an objectName (objectui#3149)', () => {
    // The guard this replaces was `length > 0` + `toContain('object-form')`,
    // which is precisely the shape that let six blocks fall out unnoticed: both
    // assertions stayed true the whole time the candidate set was 8 instead of
    // 14. A gate that cannot report its own coverage shrinking is not reporting
    // coverage.
    //
    // A block appearing here is additive and cheap to accept; a block
    // DISAPPEARING is the regression, and only the exact comparison catches it.
    expect([...candidates.map((c) => c.type)].sort()).toEqual([...EXPECTED_CANDIDATES].sort());
  });

  for (const cfg of candidates) {
    const ledgered = cfg.type in NO_DATA_REACH;
    it(`${cfg.type} ${ledgered ? 'does not reach the data layer (ledgered)' : 'asks the data layer for its objectName'}`, async () => {
      const { calls, html } = await dataCallsFor(cfg);
      const reached = calls.filter((c) => c.includes(PROBE_OBJECT));
      if (ledgered) {
        // A crash is not a binding answer, and on THIS branch it is
        // indistinguishable from one: "made no data call" is the pass condition,
        // and a block that threw during render made none either. `SchemaRenderer`
        // catches the throw and paints an error card, so nothing propagates —
        // without this the ledger entry would be confirmed by the block being
        // broken.
        //
        // Added with objectui#3808, and DEFENSIVE rather than load-bearing today:
        // that change made an invalid `add` sample crash `record:related_list`
        // (objectui#3838), which is what it did in the sibling probe, but not
        // here — `renderers/record-related-list.tsx:185` passes
        // `dataSource={ctx?.dataSource}`, this probe mounts with no RecordContext,
        // so `RelatedList`'s picker gate (`add && pickerObject && dataSource`,
        // truthiness-only on `add` before #3838) short-circuits before the read
        // either way. Checked, not assumed: reverting the sample to `{}` keeps
        // all 16 green. The predicate itself is known to work — applied to both
        // branches it reports the two crashes in objectui#3840 — so this is a
        // cheap standing guard on the one branch where a crash IS the pass
        // condition, not a claim that it fires today.
        //
        // Deliberately NOT applied to the other branch: `object-form` and
        // `object-master-detail-form` do paint an error card under this fixture
        // ("Cannot read properties of undefined (reading 'map')") while still
        // making their data calls, so their verdicts are earned rather than
        // vacuous. Whether that card is a product bug or this fixture handing
        // them an implausible configuration — the lesson the header records four
        // instances of — is objectui#3840, not something to decide by widening a
        // guard here.
        expect(
          html.includes('failed to render'),
          `<${cfg.type}> threw during render, so "made no data call" proves nothing:\n${html.slice(0, 600)}`,
        ).toBe(false);
        // Asserted, not skipped: the day this block starts binding, this fails
        // and the ledger entry has to go — a ledger nobody is forced to update
        // decays into the accepted-baseline problem this whole test exists for.
        expect(reached, `${cfg.type} now reaches the data layer — delete its NO_DATA_REACH entry`).toEqual([]);
      } else {
        expect(
          reached.length,
          `<${cfg.type}> declares an \`objectName\` input but made no data call naming "${PROBE_OBJECT}".\n` +
            `Calls observed: ${calls.length ? calls.join(' | ') : '(none)'}\n` +
            'Either the binding does not reach the renderer (the objectstack#4413 shape — fix the wiring),\n' +
            'or the block legitimately cannot fetch yet: add it to NO_DATA_REACH with the reason.',
        ).toBeGreaterThan(0);
      }
    }, 30_000);
  }

  it('the ledger names only blocks that really do not reach — no stale entries', () => {
    const unknown = Object.keys(NO_DATA_REACH).filter(
      (type) => !candidates.some((c) => c.type === type),
    );
    expect(
      unknown,
      'NO_DATA_REACH lists blocks that no longer declare an `objectName` input — delete them',
    ).toEqual([]);
    for (const [type, reason] of Object.entries(NO_DATA_REACH)) {
      expect(reason.length, `${type} needs a written reason, not an empty one`).toBeGreaterThan(20);
    }
  });
});
