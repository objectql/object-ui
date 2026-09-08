/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The derived STRICT AUTHORING FACE, and the three things objectui#8345 owes as
 * pins rather than promises (objectui#5250, maintainer 2026-09-04, decision
 * batch #25, option 2):
 *
 *   (a) a known-good document parses under the strict face;
 *   (b) a document with one invented top-level key is REFUSED, with an
 *       `unrecognized_keys` issue NAMING that key;
 *   (c) the tolerant face is behaviourally unchanged on the same inputs.
 *
 * (c) is the load-bearing one and the reason several tests below assert things
 * that read as obvious: the card publishes a SECOND face, and the whole appetite
 * rests on the first one not moving. "Unchanged" that nobody measures is a
 * promise; the tables below are the measurement.
 *
 * ## Two further properties this file pins, because the card's risk is there
 *
 * **The recursion point.** Since objectui#8344 a child slot resolves its
 * component arm to the component union rather than to the ~21 base keys. A
 * strict twin derived over the OLD recursion point would refuse every child
 * node's own declared props — the order-of-magnitude error objectui#7935 exists
 * to prevent, and the reason this card was blocked behind #8344. So a child
 * node's OWN component props being accepted is pinned as directly as the
 * invented key being refused.
 *
 * **Checks survive the clone.** The walker clones by patching a copy of the
 * def, ⛔ never by rebuilding with `z.object(shape)`. A rebuilt twin drops
 * `def.checks`, so every `.refine()` / `.superRefine()` on the way down is lost
 * and the face UNDER-reports red — the one failure direction that reads as good
 * news. Both the synthetic control and the live instance are below.
 *
 * ## Instruments, and one that is NOT one
 *
 * ⚠️ `vitest` does not typecheck. The type-level pins at the bottom are read by
 * `tsc -p tsconfig.test.json` (the third program of this package's `type-check`
 * script) and by nothing else — a green vitest run says nothing about them.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  AnyComponentSchema,
  deriveStrictAuthoringSchema,
  StrictAnyComponentSchema,
  StrictSchemaNodeSchema,
  type StrictAuthoringLimit,
} from '../zod/index.zod.js';
import { SchemaNodeSchema } from '../zod/base.zod.js';

/* ── Reading a refusal ───────────────────────────────────────────────────── */

type Issue = {
  code: string;
  path: PropertyKey[];
  keys?: string[];
  errors?: Issue[][];
};

/**
 * Flatten a zod error tree. A refusal inside a union arrives as one
 * `invalid_union` carrying a group of issue lists per arm, and a child slot is
 * a union of six arms, so the interesting issue is never at the top level.
 */
function flatten(issues: readonly Issue[], out: Issue[] = []): Issue[] {
  for (const issue of issues) {
    if (issue.code === 'invalid_union' && issue.errors) {
      for (const group of issue.errors) flatten(group, out);
    } else {
      out.push(issue);
    }
  }
  return out;
}

/** Every key named by an `unrecognized_keys` issue anywhere in the refusal. */
function refusedKeys(result: z.ZodSafeParseResult<unknown>): string[] {
  if (result.success) return [];
  const keys = flatten(result.error.issues as unknown as Issue[])
    .filter((i) => i.code === 'unrecognized_keys')
    .flatMap((i) => i.keys ?? []);
  return [...new Set(keys)].sort();
}

/* ── Documents ───────────────────────────────────────────────────────────── */

/** Declared keys only, one level of nesting, two different component types. */
const KNOWN_GOOD = {
  type: 'card',
  title: 'Quarterly figures',
  children: [
    { type: 'button', label: 'Export', variant: 'default' },
    { type: 'text', content: 'Updated hourly' },
  ],
} as const;

const INVENTED_TOP_LEVEL_KEY = 'inventedTopLevelKey';
const INVENTED_CHILD_KEY = 'inventedChildKey';

const INVENTED_AT_ROOT = { ...KNOWN_GOOD, [INVENTED_TOP_LEVEL_KEY]: 1 };
const INVENTED_AT_CHILD = {
  type: 'card',
  children: [{ type: 'button', label: 'Export', [INVENTED_CHILD_KEY]: 1 }],
};

describe('the strict authoring face — positive controls', () => {
  it('the published barrel exports the derived faces and the derivation', () => {
    expect(typeof StrictAnyComponentSchema.safeParse).toBe('function');
    expect(typeof StrictSchemaNodeSchema.safeParse).toBe('function');
    expect(typeof deriveStrictAuthoringSchema).toBe('function');
  });

  it('the tolerant face admits an undeclared key — the control every table below is read against', () => {
    // If this ever goes false, the rendering face's `.passthrough()` was
    // flipped and no assertion in this file means what it says.
    expect(AnyComponentSchema.safeParse(INVENTED_AT_ROOT).success).toBe(true);
    expect(AnyComponentSchema.safeParse(INVENTED_AT_CHILD).success).toBe(true);
  });
});

describe('(a) a known-good document parses under the strict face', () => {
  it('accepts it', () => {
    expect(StrictAnyComponentSchema.safeParse(KNOWN_GOOD).success).toBe(true);
  });

  it('and the tolerant face accepts the same document — the two agree where nothing is invented', () => {
    expect(AnyComponentSchema.safeParse(KNOWN_GOOD).success).toBe(true);
  });
});

describe('(b) one invented top-level key is refused, and the key is named', () => {
  it('refuses, with an `unrecognized_keys` issue naming exactly that key', () => {
    const result = StrictAnyComponentSchema.safeParse(INVENTED_AT_ROOT);
    expect(result.success).toBe(false);
    expect(refusedKeys(result)).toEqual([INVENTED_TOP_LEVEL_KEY]);
  });

  it('the same document is accepted by the tolerant face — the difference is the whole card', () => {
    expect(AnyComponentSchema.safeParse(INVENTED_AT_ROOT).success).toBe(true);
  });
});

describe('(c) the tolerant face is behaviourally unchanged — a pin, not a promise', () => {
  /**
   * Read AFTER the strict derivation has been forced, deliberately: the walk is
   * deferred behind `z.lazy`, so a table read before it would not be evidence
   * about anything the derivation does.
   */
  it('every verdict of the tolerant face is what it was, with the strict face fully derived', () => {
    StrictAnyComponentSchema.safeParse(KNOWN_GOOD);
    StrictSchemaNodeSchema.safeParse(KNOWN_GOOD);

    const table: Array<[label: string, input: unknown, accepted: boolean]> = [
      ['a known-good document', KNOWN_GOOD, true],
      ['an invented key at the root', INVENTED_AT_ROOT, true],
      ['an invented key on a child', INVENTED_AT_CHILD, true],
      ['a node whose `type` resolves in no arm', { type: 'no-such-component' }, false],
      ['a node with no `type` at all', { label: 'x' }, false],
    ];

    expect(table.map(([label, input]) => [label, AnyComponentSchema.safeParse(input).success]))
      .toEqual(table.map(([label, , accepted]) => [label, accepted]));
  });

  it('deriving mutates nothing: the tolerant graph carries exactly the closed objects it carried before', () => {
    // `catchall: never` IS strictness. Some objects on the face are strict
    // already — the schemas imported from `@objectstack/spec` are — so the
    // reading that matters is that the count does not MOVE, not that it is zero.
    const before = closedObjectCount(AnyComponentSchema);
    const twin = deriveStrictAuthoringSchema(AnyComponentSchema);
    twin.safeParse(KNOWN_GOOD); // force the deferred subtrees
    expect(closedObjectCount(AnyComponentSchema)).toBe(before);
    expect(before).toBeGreaterThan(0); // non-vacuity: the counter sees something
  });
});

describe('a nested node is judged by its own component schema (objectui#8344 is load-bearing)', () => {
  it('refuses an invented key on a CHILD node, naming it', () => {
    const result = StrictAnyComponentSchema.safeParse(INVENTED_AT_CHILD);
    expect(result.success).toBe(false);
    expect(refusedKeys(result)).toEqual([INVENTED_CHILD_KEY]);
  });

  it("accepts a child's OWN component props — a strict twin of the pre-#8344 recursion point would refuse these", () => {
    // `variant` and `size` are declared by `ButtonSchema` and by NOTHING in the
    // base key set. If the child slot were judged by a strict `BaseSchemaCore`,
    // both would come back as unrecognised — the order-of-magnitude error the
    // blocker existed to prevent, spelled as an assertion.
    const result = StrictAnyComponentSchema.safeParse({
      type: 'card',
      children: [{ type: 'button', label: 'Export', variant: 'destructive', size: 'sm' }],
    });
    expect(refusedKeys(result)).toEqual([]);
    expect(result.success).toBe(true);
  });
});

describe('checks survive the clone — a twin rebuilt with `z.object(shape)` would not', () => {
  const refined = z.object({ a: z.number() }).refine((v) => v.a > 0, 'a must be positive');

  it('the derived twin still refuses what the refinement refuses', () => {
    expect(deriveStrictAuthoringSchema(refined).safeParse({ a: -1 }).success).toBe(false);
    expect(deriveStrictAuthoringSchema(refined).safeParse({ a: 1 }).success).toBe(true);
  });

  it('the banned spelling loses it — this is why the walker patches the def', () => {
    // The caricature, kept as a control so the paragraph above is a measurement.
    expect(z.object({ a: z.number() }).safeParse({ a: -1 }).success).toBe(true);
  });

  it('the live instance: the `chatbot` body clause still fires at a child slot', () => {
    // `defineNodeComponentUnion` installs a `superRefine` on the union that sits
    // in the node slot, and only there. So this document is accepted at the root
    // and refused one slot down — on BOTH faces. A twin that dropped the check
    // would accept the nested form and this test would go red on the strict row.
    const chatbot = { type: 'chatbot', messages: [], body: { foo: 'bar' } };
    const nested = { type: 'card', children: [chatbot] };

    expect(StrictAnyComponentSchema.safeParse(chatbot).success).toBe(true);
    expect(StrictAnyComponentSchema.safeParse(nested).success).toBe(false);
    // …and unchanged on the tolerant face, which is (c) again on this input.
    expect(AnyComponentSchema.safeParse(chatbot).success).toBe(true);
    expect(AnyComponentSchema.safeParse(nested).success).toBe(false);
  });
});

describe('the node face (child slot) twin', () => {
  it('admits the primitives a child slot admits', () => {
    expect(StrictSchemaNodeSchema.safeParse('a bare string').success).toBe(true);
    expect(StrictSchemaNodeSchema.safeParse(7).success).toBe(true);
  });

  it('closes a component in that slot', () => {
    expect(StrictSchemaNodeSchema.safeParse({ type: 'text', content: 'x' }).success).toBe(true);
    const result = StrictSchemaNodeSchema.safeParse({ type: 'text', content: 'x', nope: 1 });
    expect(result.success).toBe(false);
    expect(refusedKeys(result)).toEqual(['nope']);
  });
});

describe('what strict could not close is enumerated, not claimed', () => {
  /** Every def type the walker treats as opaque. Nothing else may be reported. */
  const OPAQUE_KINDS = ['custom', 'function', 'transform'] as const;

  it('every limit reported over the published face is one of the recorded opaque kinds', () => {
    const limits: StrictAuthoringLimit[] = [];
    const twin = deriveStrictAuthoringSchema(AnyComponentSchema, {
      onOpaqueShape: (limit) => limits.push(limit),
    });
    // ⚠️ A census is only as complete as the subtrees that have been walked, and
    // `z.lazy` defers. Forcing one document parse resolves the node slot and,
    // through it, the rest of the graph.
    twin.safeParse(KNOWN_GOOD);

    expect(limits.length, 'a census that reports nothing is not a census').toBeGreaterThan(0);
    const unexpected = [...new Set(limits.map((l) => l.kind))]
      .filter((kind) => !(OPAQUE_KINDS as readonly string[]).includes(kind))
      .sort();
    expect(unexpected, 'the walker met a shape it could not close and this list does not name it').toEqual([]);
    expect(limits.every((l) => l.path.startsWith('#'))).toBe(true);
  });

  it('the reporter recognises all three kinds — a synthetic positive control', () => {
    // Which of the three the LIVE face exhibits moves with `@objectstack/spec`,
    // so the population is asserted as a subset above and the reporter's own
    // coverage is pinned here instead. Without this, a walker that had silently
    // stopped recognising one kind would still pass the subset assertion.
    const kinds: string[] = [];
    deriveStrictAuthoringSchema(
      z.object({
        opaqueCustom: z.custom<string>((v) => typeof v === 'string'),
        opaqueTransform: z.string().transform((v) => v.length),
        opaqueFunction: z.function(),
      }),
      { onOpaqueShape: (limit) => kinds.push(limit.kind) },
    );
    expect([...new Set(kinds)].sort()).toEqual([...OPAQUE_KINDS]);
  });

  it('a `z.preprocess` has its real schema closed — the `out` side of a pipe is walked', () => {
    // The asymmetry this guards: `X.transform(f)` keeps the schema in `in`,
    // `z.preprocess(f, X)` keeps it in `out`. A walker that read only `in`
    // closes the first and leaves the second wide open, with no symptom.
    const preprocessed = z.preprocess((v) => v, z.object({ a: z.string() }));
    expect(preprocessed.safeParse({ a: 'x', bogus: 1 }).success).toBe(true);
    expect(deriveStrictAuthoringSchema(preprocessed).safeParse({ a: 'x', bogus: 1 }).success).toBe(false);
  });
});

/* ── Type-level pins — read by `tsc -p tsconfig.test.json`, NOT by vitest ──── */

/** The derivation returns the type it was given: strictness is a runtime property. */
const assertionDerivationPreservesTheType: typeof AnyComponentSchema =
  deriveStrictAuthoringSchema(AnyComponentSchema);

/** Both faces inhabit one type — the twin invites exactly what the tolerant face invites. */
const assertionTolerantFaceFitsTheCommonType: z.ZodType<
  z.output<typeof AnyComponentSchema>,
  z.input<typeof AnyComponentSchema>
> = AnyComponentSchema;
const assertionStrictFaceFitsTheCommonType: z.ZodType<
  z.output<typeof AnyComponentSchema>,
  z.input<typeof AnyComponentSchema>
> = StrictAnyComponentSchema;

/** The node-slot twin carries `SchemaNodeSchema`'s declaration on both sides. */
const assertionNodeTwinCarriesTheNodeDeclaration: typeof SchemaNodeSchema = StrictSchemaNodeSchema;

describe('the type-level pins are reachable (vitest cannot read them)', () => {
  it('names them so an unused-binding rule cannot delete the pins', () => {
    expect([
      assertionDerivationPreservesTheType,
      assertionTolerantFaceFitsTheCommonType,
      assertionStrictFaceFitsTheCommonType,
      assertionNodeTwinCarriesTheNodeDeclaration,
    ].every((s) => typeof s.safeParse === 'function')).toBe(true);
  });
});

/* ── The counter used by the non-mutation pin ────────────────────────────── */

/**
 * How many objects reachable from `schema` are CLOSED (`catchall` is `never`).
 * Reads `_zod.def` for the same reason the walker does — zod publishes no other
 * way to ask. Lazies are resolved so the census is not truncated at the node
 * boundary.
 */
function closedObjectCount(schema: z.ZodType): number {
  type Def = Record<string, unknown> & { type: string };
  const seen = new Set<unknown>();
  let closed = 0;
  const visit = (node: unknown): void => {
    if (typeof node !== 'object' || node === null || !('_zod' in node)) return;
    if (seen.has(node)) return;
    seen.add(node);
    const def = (node as { _zod: { def: Def } })._zod.def;
    if (def.type === 'object') {
      const catchall = def.catchall as { _zod?: { def?: { type?: string } } } | undefined;
      if (catchall?._zod?.def?.type === 'never') closed += 1;
    }
    if (def.type === 'lazy') {
      const getter = def.getter as (() => unknown) | undefined;
      if (getter) visit(getter());
      return;
    }
    if (def.shape) for (const v of Object.values(def.shape as Record<string, unknown>)) visit(v);
    if (Array.isArray(def.options)) for (const v of def.options) visit(v);
    if (Array.isArray(def.items)) for (const v of def.items) visit(v);
    for (const key of ['element', 'rest', 'valueType', 'keyType', 'left', 'right', 'in', 'out', 'innerType', 'catchall']) {
      if (def[key]) visit(def[key]);
    }
  };
  visit(schema);
  return closed;
}
