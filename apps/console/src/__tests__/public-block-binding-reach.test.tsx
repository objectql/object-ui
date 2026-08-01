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

/** Does this config declare an `objectName` input? */
const declaresObjectName = (cfg: { inputs?: Array<{ name?: string }> }) =>
  (cfg.inputs ?? []).some((i) => i?.name === 'objectName');

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
 * Mount one block bare and report every data-layer call it made.
 *
 * The data source is a Proxy so ANY method a block reaches for is recorded
 * rather than crashing it — a block that calls `dataSource.aggregate` must not
 * fail the probe merely because a hand-written stub didn't anticipate it.
 */
async function dataCallsFor(cfg: any): Promise<string[]> {
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

  // Only `objectName` + the inputs the block declares REQUIRED. A bogus value
  // for an optional input is a degenerate config that can make a block bail out
  // before it ever asks for data — which would read here as a false finding.
  // EVERY declared input, not just the required ones — see the file header: a
  // read path can be gated on an optional input, and leaving it out would report
  // a block as unbound when it was simply never asked to fetch.
  const schema: Record<string, unknown> = { type: cfg.type };
  for (const input of cfg.inputs ?? []) {
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
  view.unmount();
  return calls;
}

const candidates = ComponentRegistry.getPublicConfigs().filter(declaresObjectName);

describe('public blocks — a declared objectName reaches the data layer (objectstack#4472)', () => {
  it('finds the object-bound blocks to probe (guards against probing nothing)', () => {
    // If the registry ever stops exposing these, this suite would pass by
    // probing an empty list — the failure mode a coverage gate must not have.
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.map((c) => c.type)).toContain('object-form');
  });

  for (const cfg of candidates) {
    const ledgered = cfg.type in NO_DATA_REACH;
    it(`${cfg.type} ${ledgered ? 'does not reach the data layer (ledgered)' : 'asks the data layer for its objectName'}`, async () => {
      const calls = await dataCallsFor(cfg);
      const reached = calls.filter((c) => c.includes(PROBE_OBJECT));
      if (ledgered) {
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
