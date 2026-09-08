/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The STRICT AUTHORING FACE — a derived, unknown-key-closing twin of the node
 * face (objectui#8345, under the objectui#5250 ruling: maintainer 2026-09-04,
 * decision batch #25, option 2 — "each node schema gets a derived strict
 * variant; `objectui validate` and the doc-snippet gates run strict; renderer
 * props keep the tolerant face unchanged").
 *
 * ## What this is, and what it deliberately is NOT
 *
 * It is a SECOND face over the SAME declarations. `BaseSchemaCore` stays
 * `.passthrough()` and every published mirror keeps the accept set it has: this
 * module adds a face, it does not change the existing one. Nothing in this
 * repository consumes it yet — wiring `objectui validate`, the JSON-fence gate
 * and `objectui check` is the devx half of the ruling and is ruled to come
 * after, so the only consumer of these exports today is the pin file that
 * measures them.
 *
 * It is DERIVED, never hand-written. A second hand-maintained copy of the 107
 * component schemas would be a parity ledger nobody can keep honest — this
 * repository already carries the bill for that shape (objectui#6058, #6152,
 * #7759). Everything below walks the mirrors that already exist.
 *
 * It is a RUNTIME face only. `deriveStrictAuthoringSchema` returns the same
 * TypeScript type it was given, because strictness here is a property of the
 * parse and not of the declaration — a document that type-checks against
 * `SchemaNode` still type-checks. The TypeScript authoring face is a separate
 * card with a separate ruling (objectui#7927).
 *
 * ## Why objects are CLONED and not rebuilt
 *
 * Every object is cloned by patching a copy of its own `_zod.def` and calling
 * its own constructor. ⛔ Never rebuild one with `z.object(shape)`: that
 * spelling keeps the shape and DROPS `def.checks`, so every `.refine()` and
 * `.superRefine()` on the way down is silently lost and the twin UNDER-reports
 * red — a strict face that quietly stopped enforcing a refinement is worse than
 * no strict face, because it reads as evidence. The pin file holds a control
 * that shows the rebuild spelling losing a real check.
 *
 * ## What strict cannot close, stated as the complete list
 *
 * Opaque validators — `custom`, `function` and `transform` — have no shape
 * inside them to close, so the walker returns them untouched and REPORTS them
 * through `onOpaqueShape`. That is the whole limit list, not a sample of it,
 * and the pin file re-derives it rather than quoting this sentence.
 *
 * One further limit is worth naming because it is invisible in the shape: a
 * check installed with `.superRefine()` is a CLOSURE, and a closure that
 * consults another schema keeps consulting the TOLERANT one. The live instance
 * is the `chatbot` body clause in `defineNodeComponentUnion` — it is preserved
 * by the clone and still fires, but the schema it defers to inside is the
 * tolerant `BaseSchemaCore.shape.body`. That direction is conservative: such a
 * check can only ADD refusals, never accept something the strict shape refused.
 *
 * ## The recursion point, and why this card waited for it
 *
 * A child slot is `z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])`, and
 * since objectui#8344 `SchemaNodeSchema`'s component arm IS the component union
 * rather than the ~21 base keys. Strict-ifying the OLD recursion point measured
 * the recursion point instead of the components — every child node's own
 * declared props read as unrecognised. That is the order-of-magnitude error
 * objectui#7935 exists to prevent, and it is why the derivation below can now
 * run over the whole tree with no boundary at all.
 */

import { z } from 'zod';
import { SchemaNodeSchema } from './zod/base.zod.js';
// ⚠️ A DELIBERATE MODULE CYCLE, and the reason it is safe is structural rather
// than lucky. `zod/index.zod.ts` re-exports the three values below, so it
// depends on this module and this module depends on it. ESM links cycles fine;
// what throws is READING a binding whose defining module has not run its body
// yet. `AnyComponentSchema` is therefore read ONLY inside the `z.lazy` getters
// at the bottom — never at this module's top level — so by the time anything
// can read it, `index.zod.ts` has finished evaluating and the objectui#8344
// recursion-point fill is installed. The pin file asserts that end state from
// the published barrel rather than trusting this paragraph.
import { AnyComponentSchema } from './zod/index.zod.js';

/**
 * One shape the strict walker could not close, reported as it is met.
 *
 * `kind` is the zod def type of the opaque node; `path` is the trail from the
 * root of the walk, so a consumer can say WHERE rather than only how many.
 */
export interface StrictAuthoringLimit {
  /** The zod def type that has no shape to close: `custom`, `function` or `transform`. */
  kind: string;
  /** Trail from the walk root, e.g. `#/options/8/shape/props`. */
  path: string;
}

/** Options for {@link deriveStrictAuthoringSchema}. */
export interface DeriveStrictAuthoringOptions {
  /**
   * Called once per opaque node the walker meets, in walk order. Present so the
   * limit list is a MEASUREMENT a caller can re-derive, not a claim in a
   * docblock. Deduplication is the caller's business: the walker memoises by
   * schema identity, so each distinct node is reported once per walk.
   */
  onOpaqueShape?: (limit: StrictAuthoringLimit) => void;
}

/**
 * The subset of a zod def this walker reads. Zod does not publish `_zod.def`
 * in its public types, and the alternative — a chain of `instanceof` narrowings
 * against 15 concrete classes — would have to be rewritten whenever zod adds a
 * wrapper. Sibling precedent for reading it: `defineNodeComponentUnion` in
 * `zod/base.zod.ts` reads the same field to verify its own install.
 */
interface WalkableDef {
  type: string;
  shape?: Record<string, z.ZodType>;
  options?: z.ZodType[];
  items?: z.ZodType[];
  element?: z.ZodType;
  rest?: z.ZodType;
  valueType?: z.ZodType;
  left?: z.ZodType;
  right?: z.ZodType;
  in?: z.ZodType;
  innerType?: z.ZodType;
  out?: z.ZodType;
  catchall?: z.ZodType;
  getter?: () => z.ZodType;
}

interface ZodInternals {
  _zod: { def: WalkableDef };
  constructor: new (def: WalkableDef) => z.ZodType;
}

const internals = (schema: z.ZodType): ZodInternals => schema as unknown as ZodInternals;

/**
 * Is this a zod schema node?
 *
 * ⚠️ `typeof value === 'object'` is NOT the test, and writing it that way is a
 * silent, measured coverage hole rather than a style slip. Zod 4.4.3 builds
 * some objects through `$ZodObjectJIT`, whose instances are CALLABLE — they
 * answer `typeof 'function'`, their constructor prints as a bound `ZodObject`,
 * their traits read `ZodObject/$ZodObjectJIT/$ZodObject/$ZodType`, and they
 * parse exactly like any other object. On this face, 20 such nodes are
 * reachable, all of them arriving through `@objectstack/spec`-derived subtrees.
 *
 * An object-only guard hands each of them straight back, so the ENTIRE subtree
 * beneath it goes unwalked. Measured, before this test admitted functions: 6
 * objects under those nodes stayed open on the twin, and a document with an
 * invented key inside one of them — `page.interfaceConfig.sort[]` is the
 * shortest — was ACCEPTED by the strict face and the key silently dropped,
 * while the same key at the root was correctly refused and named.
 *
 * ⛔ Nothing in the corpus could catch that: no document among the 556 carries
 * an undeclared key inside those 6 objects, so every corpus reading is
 * identical whichever guard is written here. The population pin in
 * `__tests__/strict-authoring-face-8345.test.ts` — every reachable object on
 * the twin has `catchall: never`, with the function-typed count asserted
 * non-zero — is what actually holds this line, and it too had to be taught the
 * same lesson: its own census started `typeof node !== 'object'` and shared the
 * blind spot with the thing it was measuring.
 */
const isZodType = (value: unknown): value is z.ZodType =>
  value !== null && (typeof value === 'object' || typeof value === 'function') && '_zod' in value;

/**
 * Clone one schema with a patched def, PRESERVING everything else in it —
 * `def.checks` above all, which is where `.refine()` / `.superRefine()` live.
 *
 * A callable JIT instance clones through its own bound constructor and comes
 * back as an ordinary object-typed instance of the same class. That is a
 * difference in representation, not in behaviour, and behaviour is what the
 * pins measure: the clone parses, closes, and leaves the original untouched.
 */
const cloneWithDef = (schema: z.ZodType, patch: Partial<WalkableDef>): z.ZodType => {
  const Ctor = internals(schema).constructor;
  return new Ctor({ ...internals(schema)._zod.def, ...patch });
};

/**
 * A walker with ONE memo. Two schemas derived through the same walker share
 * their derived subgraph, so the second costs nothing and the two twins agree
 * by construction instead of by assertion.
 */
function createStrictWalker(options: DeriveStrictAuthoringOptions = {}): <T extends z.ZodType>(schema: T, path?: string) => T {
  const memo = new Map<z.ZodType, z.ZodType>();

  const walk = (schema: z.ZodType, path: string): z.ZodType => {
    if (!isZodType(schema)) return schema;
    const cached = memo.get(schema);
    if (cached) return cached;
    const def = internals(schema)._zod.def;

    // `lazy` first, and memoised BEFORE the getter can re-enter: the node face
    // is self-referential through every child slot, so a walker that recursed
    // into the getter eagerly would not terminate.
    if (def.type === 'lazy') {
      const out: z.ZodType = z.lazy(() => walk(def.getter!(), `${path}/lazy`));
      memo.set(schema, out);
      return out;
    }

    let out: z.ZodType;
    switch (def.type) {
      case 'object': {
        const shape: Record<string, z.ZodType> = {};
        for (const [key, value] of Object.entries(def.shape ?? {})) {
          shape[key] = walk(value, `${path}/shape/${key}`);
        }
        // `catchall: z.never()` IS `.strict()` — spelled through the def so the
        // clone keeps this object's own checks. `.strict()` would too, but only
        // on a `ZodObject`; this arm also has to serve loose objects, which is
        // every `BaseSchema` heir.
        out = cloneWithDef(schema, { shape, catchall: z.never() });
        break;
      }
      // A discriminated union carries `type: 'union'` too, plus a
      // `discriminator` the spread preserves — so both union kinds land here
      // and neither is flattened into the other.
      case 'union':
        out = cloneWithDef(schema, {
          options: (def.options ?? []).map((option, i) => walk(option, `${path}/options/${i}`)),
        });
        break;
      case 'array':
        out = cloneWithDef(schema, { element: walk(def.element!, `${path}/element`) });
        break;
      case 'tuple':
        out = cloneWithDef(schema, {
          items: (def.items ?? []).map((item, i) => walk(item, `${path}/items/${i}`)),
          ...(def.rest ? { rest: walk(def.rest, `${path}/rest`) } : {}),
        });
        break;
      case 'record':
        out = cloneWithDef(schema, { valueType: walk(def.valueType!, `${path}/valueType`) });
        break;
      case 'intersection':
        out = cloneWithDef(schema, {
          left: walk(def.left!, `${path}/left`),
          right: walk(def.right!, `${path}/right`),
        });
        break;
      case 'pipe':
        // BOTH sides, and the `out` side is the one worth naming. A pipe
        // spelled `X.transform(f)` holds the schema in `in` and the opaque
        // transform in `out`; a pipe spelled `z.preprocess(f, X)` holds them
        // the other way round. Walking only `in` closes the first and silently
        // leaves the second's real schema tolerant — an asymmetry with no
        // symptom, because the accept set it produces looks exactly like a
        // schema that had nothing to close.
        //
        // Re-derived on the published face at the head this landed on, once the
        // guard above stopped skipping callable nodes: FOUR pipes are reachable
        // — `transform` into `enum` (a preprocessor, under
        // `page.interfaceConfig.filterBy[]`), and `object`, `string` and
        // `array` each into a `transform`. So a preprocessor is already here,
        // and today no OBJECT sits on an `out` side, which is why this arm
        // moves no accept set yet. It is here so the first preprocessor that
        // wraps an object does not open a hole. ⚠️ The earlier version of this
        // comment said "one pipe reachable" — that was a reading taken through
        // the blind guard, and it is exactly the class of number this file's
        // pins now re-derive instead of quoting.
        out = cloneWithDef(schema, {
          in: walk(def.in!, `${path}/in`),
          ...(def.out ? { out: walk(def.out, `${path}/out`) } : {}),
        });
        break;
      case 'optional':
      case 'nullable':
      case 'default':
      case 'nonoptional':
      case 'readonly':
      case 'catch':
        out = cloneWithDef(schema, { innerType: walk(def.innerType!, `${path}/innerType`) });
        break;
      case 'custom':
      case 'transform':
      case 'function':
        // No shape inside to close. Reported, ⛔ never silently skipped.
        options.onOpaqueShape?.({ kind: def.type, path });
        out = schema;
        break;
      default:
        // Leaves: string, number, boolean, literal, enum, any, unknown, never,
        // date, … — nothing to close and nothing to walk into.
        out = schema;
    }
    memo.set(schema, out);
    return out;
  };

  return <T extends z.ZodType>(schema: T, path = '#'): T => walk(schema, path) as T;
}

/**
 * Derive the strict authoring twin of any schema on the published zod face.
 *
 * Every reachable object gains `catchall: z.never()`, reached through unions,
 * discriminated unions, arrays, tuples, records, intersections, optionals,
 * nullables, defaults, pipes and `z.lazy` (memoised, so the self-referential
 * node face terminates). The returned schema has the same TypeScript type as
 * the input and shares no mutable state with it — the input is left exactly as
 * it was, which is what keeps the rendering face untouched.
 *
 * Each call builds its own memo, so deriving two schemas separately builds two
 * graphs. The two faces below are derived through one shared walker for that
 * reason.
 */
export function deriveStrictAuthoringSchema<T extends z.ZodType>(
  schema: T,
  options?: DeriveStrictAuthoringOptions,
): T {
  return createStrictWalker(options)(schema);
}

/**
 * The one walker behind both published faces, so the document face and the node
 * face share a single derived graph.
 */
const faceWalker = createStrictWalker();

/**
 * The strict authoring twin of `AnyComponentSchema` — a DOCUMENT root.
 *
 * Same accept set as `AnyComponentSchema` minus every undeclared key, at every
 * depth. Undeclared keys are reported as `unrecognized_keys` issues naming the
 * offending keys.
 *
 * Typed by its input and output rather than by its runtime class: the walk is
 * deferred behind `z.lazy` (see the import comment above for why it must be),
 * so this is a `ZodLazy` whose inner is the derived discriminated union.
 */
export const StrictAnyComponentSchema: z.ZodType<
  z.output<typeof AnyComponentSchema>,
  z.input<typeof AnyComponentSchema>
> = z.lazy(() => faceWalker(AnyComponentSchema));

/**
 * The strict authoring twin of `SchemaNodeSchema` — a CHILD SLOT: a component
 * document, or one of the primitives a slot admits.
 *
 * Prefer {@link StrictAnyComponentSchema} for a whole document: this face
 * accepts a bare string or number, because a child slot does.
 */
export const StrictSchemaNodeSchema: z.ZodType<
  z.output<typeof SchemaNodeSchema>,
  z.input<typeof SchemaNodeSchema>
> = z.lazy(() => faceWalker(SchemaNodeSchema));
