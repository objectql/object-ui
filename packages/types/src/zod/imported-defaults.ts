/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * THE IMPORT BOUNDARY — **this mirror authors no default, imported subschemas
 * included** (objectui#8317, director ruling, decision batch #90, 2026-09-08,
 * under the maintainer's standing delegation).
 *
 * Decision batch #69 (objectui#7735) ruled a principle, not two rows: *a
 * validator validates; it does not write values into an author's document.*
 * PR #8299 delivered it for the 41 `.default()` call sites written in this
 * repository's own mirrors, and stopped there — the ruling's named scope could
 * not reach a default this repository never wrote. Measured after that landing,
 * **57 `ZodDefault` nodes were still reachable from the published
 * `@object-ui/types/zod` barrel**, every one inside a subschema imported by
 * reference from `@objectstack/spec`. So `safeValidateSchema` went on
 * substituting on those keys: an author who wrote `navigation: {}` got back
 * `navigation: { mode, preventNavigation, openNewTab, size }` — four keys they
 * did not write — and the "one authored document, two shapes" defect
 * objectui#7735 was opened about survived there.
 *
 * Batch #90 ruled option A: the principle holds for **every** key
 * `safeValidateSchema` answers, not only the 41 this repository authored, and
 * the imported defaults are stripped **here, at the boundary where the spec
 * enters this package**. ⛔ Option B — the 1546-site spec-side change on
 * another repository's release train — was NOT taken, and A is reversible into
 * it: every strip below becomes a no-op the day `@objectstack/spec` adopts the
 * same principle, with nothing to roll back. ⛔ Option C-unstated — 41 stripped,
 * 57 not, indistinguishable from the document — was refused as the one outcome
 * nobody defended.
 *
 * ## Why a WALK and not 57 hand-written `.removeDefault()` calls
 *
 * `.removeDefault()` is the established local pattern (`objectql.zod.ts`'s
 * `ViewKindEnum`, `views.zod.ts`'s `SpecListViewTypeEnum`) and it is what runs
 * below — but it only reaches a default sitting at the TOP of a member's
 * wrapper chain. Of the 57, four are at that depth; the rest are nested inside
 * imported subtrees (`page.interfaceConfig.*`, dashboard `chartConfig.*`,
 * `kanban.grouping.fields[].*`), where reaching one by hand means restating the
 * spec's own object locally. That is the "narrower than the contract it
 * implements" shape this directory already records twice, and it is how a
 * mirror silently stops being a mirror. Walking the graph instead keeps every
 * key, every type and every check exactly as the spec declares them, and
 * removes only the substitution.
 *
 * ## The accept set does not move, and that is load-bearing
 *
 * `.default(v)` carries optionality as well as a value: a member spelled
 * `.default(v)` with no `.optional()` is omissible BECAUSE of the default, and
 * a naive unwrap makes it REQUIRED — a silent accept-set narrowing on a
 * published surface, which this ruling did not authorise. So the `default` arm
 * below re-optionalises whatever `.removeDefault()` hands back, unless it is
 * already optional. `__tests__/imported-defaults-8317.test.ts` re-derives that
 * as a live differential over the repository's own document corpus rather than
 * trusting this paragraph.
 *
 * ## Why objects are CLONED and not rebuilt
 *
 * Every node is cloned by patching a copy of its own `_zod.def` and calling its
 * own constructor. ⛔ Never rebuild one with `z.object(shape)`: that spelling
 * keeps the shape and DROPS `def.checks`, so every `.refine()` and
 * `.superRefine()` the spec installed on the way down is silently lost and this
 * package would accept documents the spec refuses. Sibling precedent, and the
 * file this walker is modelled on: `../strict-authoring-face.ts`.
 *
 * ⛔ The input is never mutated. `@objectstack/spec`'s own exports are shared
 * with every other consumer in the workspace; this module derives and returns a
 * new graph, and leaves the spec's objects exactly as it found them.
 */

import { z } from 'zod';

/**
 * The subset of a zod def this walker reads. Zod does not publish `_zod.def` in
 * its public types, and the alternative — a chain of `instanceof` narrowings
 * against 15 concrete classes — would have to be rewritten whenever zod adds a
 * wrapper. Same field set, and the same reason, as `../strict-authoring-face.ts`.
 */
interface WalkableDef {
  type: string;
  shape?: Record<string, z.ZodType>;
  options?: z.ZodType[];
  items?: z.ZodType[];
  element?: z.ZodType;
  rest?: z.ZodType;
  valueType?: z.ZodType;
  keyType?: z.ZodType;
  left?: z.ZodType;
  right?: z.ZodType;
  in?: z.ZodType;
  out?: z.ZodType;
  innerType?: z.ZodType;
  catchall?: z.ZodType;
  getter?: () => z.ZodType;
}

interface ZodInternals {
  _zod: { def: WalkableDef; optin?: string };
  constructor: new (def: WalkableDef) => z.ZodType;
}

const internals = (schema: z.ZodType): ZodInternals => schema as unknown as ZodInternals;

/**
 * Is this a zod schema node?
 *
 * ⚠️ `typeof value === 'object'` is NOT the test, and writing it that way is a
 * measured coverage hole rather than a style slip. Zod 4.4.3 builds some
 * objects through `$ZodObjectJIT`, whose instances are CALLABLE — they answer
 * `typeof 'function'` and parse exactly like any other object. On this face
 * those nodes arrive through `@objectstack/spec`-derived subtrees, which is
 * precisely the population this module walks: an object-only guard hands each
 * of them straight back and the entire subtree beneath it — defaults included —
 * goes unwalked, with no symptom other than a residue count that will not fall.
 * `../strict-authoring-face.ts` records the same lesson, learnt the hard way.
 */
const isZodType = (value: unknown): value is z.ZodType =>
  value !== null && (typeof value === 'object' || typeof value === 'function') && '_zod' in value;

/** Clone one schema with a patched def, PRESERVING everything else — `def.checks` above all. */
const cloneWithDef = (schema: z.ZodType, patch: Partial<WalkableDef>): z.ZodType => {
  const Ctor = internals(schema).constructor;
  return new Ctor({ ...internals(schema)._zod.def, ...patch });
};

/** Does this node already answer "omissible" to an enclosing object? */
const isAlreadyOptional = (schema: z.ZodType): boolean =>
  internals(schema)._zod.optin === 'optional';

/**
 * A walker with ONE memo, shared by every call. Two schemas stripped through it
 * share their derived subgraph, so `ListViewSchema` and the
 * `UserActionsConfigSchema` nested inside it agree by construction rather than
 * by assertion, and the second costs nothing.
 */
const memo = new Map<z.ZodType, z.ZodType>();

const walk = (schema: z.ZodType): z.ZodType => {
  if (!isZodType(schema)) return schema;
  const cached = memo.get(schema);
  if (cached) return cached;
  const def = internals(schema)._zod.def;

  // `lazy` first, and memoised BEFORE the getter can re-enter: spec subtrees are
  // self-referential (a filter clause contains filter clauses), so a walker that
  // forced the getter eagerly would not terminate.
  //
  // ⚠️ This is the ONE arm that cannot answer "was anything stripped below me?"
  // without forcing the getter, so it ALWAYS rebuilds — the identity property
  // below stops at a `z.lazy`. Measured on the imported population at the head
  // this landed on: THREE distinct `lazy` nodes are reachable
  // (`AppSchema.navigation[]` and `NavigationAreaSchema.navigation[]`, which are
  // the same recursive nav item; the recursive filter clause under
  // `DashboardWidgetSchema.filter` / `GlobalFilterSchema.optionsFrom.filter` /
  // `PageSchema.slots.header…dataSource.filter`; and `PageSchema.regions[].components[]`).
  // Each sits inside a schema that carries a default anyway, so today the
  // exception costs no extra rebuild — the pin file re-derives that count and
  // goes red if it moves, rather than trusting this sentence.
  //
  // ⛔ Rebuilt through `cloneWithDef`, not `z.lazy(…)`: a fresh `z.lazy` would
  // be a different class with none of this node's own `def.checks` or
  // description, which is the same silent-loss shape the clone rule exists for.
  if (def.type === 'lazy') {
    const out = cloneWithDef(schema, { getter: () => walk(def.getter!()) });
    memo.set(schema, out);
    return out;
  }

  /**
   * ⭐ THE IDENTITY PROPERTY, and it is the ruling's reversibility made literal.
   *
   * A node is rebuilt ONLY if the walk actually changed something beneath it.
   * A subtree with no `ZodDefault` in it therefore comes back REFERENCE-EQUAL
   * to the spec's own object — so this module is exactly the identity function
   * the day `@objectstack/spec` adopts the same principle, with nothing to roll
   * back, and today it leaves every already-clean imported schema binding by
   * reference exactly as it was before batch #90.
   */
  const unchanged = (children: readonly (readonly [z.ZodType | undefined, z.ZodType | undefined])[]): boolean =>
    children.every(([before, after]) => before === after);

  let out: z.ZodType;
  switch (def.type) {
    /**
     * THE STRIP. `.removeDefault()` is the ruled spelling and the established
     * local pattern; it returns this node's inner type, which is then walked so
     * a default nested under a default is reached too.
     *
     * The re-optionalisation is the accept-set half. `ZodDefault(ZodOptional(T))`
     * — the `.optional().default(v)` spelling — unwraps to something already
     * omissible and is left alone; a bare `ZodDefault(T)` unwraps to a REQUIRED
     * member and is made optional again, because its omissibility was the
     * default's doing and removing it must not narrow what this package accepts.
     */
    case 'default': {
      const inner = walk((schema as unknown as { removeDefault: () => z.ZodType }).removeDefault());
      out = isAlreadyOptional(inner) ? inner : z.optional(inner);
      break;
    }
    case 'object': {
      const shape: Record<string, z.ZodType> = {};
      let same = true;
      for (const [key, value] of Object.entries(def.shape ?? {})) {
        shape[key] = walk(value);
        if (shape[key] !== value) same = false;
      }
      out = same ? schema : cloneWithDef(schema, { shape });
      break;
    }
    // A discriminated union carries `type: 'union'` too, plus a `discriminator`
    // the spread preserves — so both union kinds land here and neither is
    // flattened into the other.
    case 'union': {
      const options = (def.options ?? []).map(walk);
      out = unchanged((def.options ?? []).map((o, i) => [o, options[i]] as const))
        ? schema
        : cloneWithDef(schema, { options });
      break;
    }
    case 'array': {
      const element = walk(def.element!);
      out = element === def.element ? schema : cloneWithDef(schema, { element });
      break;
    }
    case 'tuple': {
      const items = (def.items ?? []).map(walk);
      const rest = def.rest ? walk(def.rest) : undefined;
      out = unchanged([...(def.items ?? []).map((it, i) => [it, items[i]] as const), [def.rest, rest] as const])
        ? schema
        : cloneWithDef(schema, { items, ...(def.rest ? { rest: rest! } : {}) });
      break;
    }
    case 'record': {
      const valueType = walk(def.valueType!);
      out = valueType === def.valueType ? schema : cloneWithDef(schema, { valueType });
      break;
    }
    case 'intersection': {
      const left = walk(def.left!);
      const right = walk(def.right!);
      out = unchanged([[def.left, left], [def.right, right]]) ? schema : cloneWithDef(schema, { left, right });
      break;
    }
    // BOTH sides. A pipe spelled `X.transform(f)` holds the schema in `in`; one
    // spelled `z.preprocess(f, X)` holds it in `out`. Walking only `in` leaves
    // the second's real schema — and any default inside it — untouched, with no
    // symptom other than a residue this module claims to have removed.
    case 'pipe': {
      const inSide = walk(def.in!);
      const outSide = def.out ? walk(def.out) : undefined;
      out = unchanged([[def.in, inSide], [def.out, outSide]])
        ? schema
        : cloneWithDef(schema, { in: inSide, ...(def.out ? { out: outSide! } : {}) });
      break;
    }
    case 'optional':
    case 'nullable':
    case 'nonoptional':
    case 'readonly':
    case 'catch': {
      const innerType = walk(def.innerType!);
      out = innerType === def.innerType ? schema : cloneWithDef(schema, { innerType });
      break;
    }
    case 'custom':
    case 'transform':
    case 'function':
      // No shape inside, so no default inside either. Returned as-is.
      out = schema;
      break;
    default:
      // Leaves: string, number, boolean, literal, enum, any, unknown, never,
      // date, … — nothing to walk into.
      out = schema;
  }
  memo.set(schema, out);
  return out;
};

/**
 * Strip every `ZodDefault` reachable from an imported `@objectstack/spec`
 * schema, at this package's import boundary.
 *
 * Returns a schema with the same TypeScript type, the same keys, the same
 * checks and the same accept set — differing only in that a key the author
 * omitted stays omitted in `parse` output instead of being written for them.
 * The input is left untouched.
 *
 * ⚠️ A schema that HAD a default in it is not reference-equal to the spec's
 * afterwards: a mirror member re-exporting one of these re-exports this
 * package's derivation, not the spec object itself. That is exactly what batch
 * #90 ruled. A schema with nothing to strip comes back REFERENCE-EQUAL — see
 * the identity property in the walker — so applying this at a boundary that is
 * already clean changes nothing at all.
 *
 * ⚠️ The STATIC type is deliberately unchanged — strictly, `T` in and `T` out —
 * following `../strict-authoring-face.ts`, whose derivation makes the same
 * choice for the same reason: this is a property of the PARSE, not of the
 * declaration, and the TypeScript twins in `../*.ts` are hand-written and
 * already declare these keys omissible. The one consequence worth naming, since
 * it bites silently: on a member that HAD a default, `.removeDefault()` still
 * TYPECHECKS against the unchanged static type and THROWS at runtime, because
 * the node there is now a `ZodOptional`. Derive a value vocabulary off the
 * `Imported…` binding instead (`views.zod.ts`'s `SpecListViewTypeEnum`).
 *
 * @example
 * ```ts
 * import { ListViewSchema as ImportedSpecListViewSchema } from '@objectstack/spec/ui';
 * const SpecListViewSchema = stripImportedDefaults(ImportedSpecListViewSchema);
 * ```
 */
export function stripImportedDefaults<T extends z.ZodType>(schema: T): T {
  return walk(schema) as T;
}
