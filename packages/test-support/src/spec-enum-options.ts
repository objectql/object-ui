/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SPEC ENUM VOCABULARY — one reader for every parity gate that asks
 * "which names does this key of the contract accept?" (objectui#5872).
 *
 * ## The reader this replaces
 *
 * Four spec-parity suites in four packages each wrote out, byte-for-byte
 * identical apart from the schema and key names:
 *
 *     const v = (Schema as unknown as { shape?: Record<string, unknown> })
 *       .shape?.key as { def?: { innerType?: { options?: readonly string[] } } } | undefined;
 *     const options = v?.def?.innerType?.options;
 *     return Array.isArray(options) ? [...options] : [];
 *
 * `spec-tombstones.ts` already argues at length why that is worth ending, and
 * says of `resolvePropsShape`: "Reaching into internals is confined to this
 * module so that a gate never has to." That was true of SHAPE resolution and
 * false of everything else a parity gate reads off a Zod node. This module is
 * that sentence made true for one more reader class.
 *
 * ## Why the copies could not move together
 *
 * The hand copy reads EXACTLY ONE wrapper spelling — `def.innerType` — so it
 * answers correctly only while the member is wrapped exactly once and Zod
 * exposes `def`. A member that stops being `.optional()`/`.default()`, or a Zod
 * build that exposes only `_def`, yields `undefined` and the derived vocabulary
 * silently becomes the EMPTY SET. That is the objectui#4434 failure mode: every
 * "the renderer implements every name the spec accepts" assertion built on an
 * empty set passes over nothing. Four textually identical copies is the sharp
 * case, because a reviewer who diffs one of them sees nothing that says the
 * other three did not move.
 *
 * ## What this reader does that the copies did not
 *
 * - resolves the shape through `resolvePropsShape`, so all three `.shape`
 *   spellings and the `lazySchema()` thunk work, not just the plain one;
 * - walks the wrapper chain instead of assuming a single level, and accepts
 *   `unwrap()`, `def.innerType` and `_def.innerType` as the step;
 * - reads `.options` at every level, so an UNWRAPPED enum member answers too.
 *
 * All three are widenings — this reader answers wherever a hand copy answered,
 * and in cases where a hand copy went quietly empty. Verdict preservation was
 * measured rather than assumed when the four call sites converged: against the
 * installed pin (`@objectstack/spec@17.2.0`, `zod@4.4.3`) it returns the
 * identical array, in the identical order, for all four (schema, key) pairs.
 *
 * ## `[]` and the non-vacuity duty it leaves with the caller
 *
 * `[]` means "no vocabulary could be read", and it is deliberately NOT
 * distinguished from "this enum is empty" — because no spec enum is empty, and
 * every caller in-tree already carries the assertion that makes the difference
 * observable: one `it('reads a non-empty enum from the spec')` per suite. A
 * caller that adopts this reader owes that assertion too; without it a broken
 * reader and a satisfied parity check look exactly alike.
 */

import { resolvePropsShape } from './spec-tombstones';

/** A Zod node, as far as unwrapping to an enum needs to see it. */
interface EnumCarrier {
  options?: unknown;
  unwrap?: () => unknown;
  def?: { innerType?: unknown };
  _def?: { innerType?: unknown };
}

/**
 * How many wrappers deep to look before giving up.
 *
 * Bounded rather than `while (node)`: the step below is reached through
 * `unknown`, so a node that unwraps to itself — a shape this reader cannot
 * rule out and should not hang on — ends the walk instead of the process. Eight
 * is far past anything the contract stacks today (the deepest in-tree member is
 * one wrapper: `.default()` or `.optional()`).
 */
const MAX_WRAPPER_DEPTH = 8;

/**
 * The enum names one key of a props schema accepts, unwrapped past
 * `.optional()` / `.default()` / `.nullable()` — `[]` when it cannot be read.
 *
 * Signature deliberately mirrors `shapeMemberTypeName(schema, key)` in
 * `spec-tombstones.ts`: same question shape ("about ONE member of a shape"),
 * same tolerance of a schema this pin does not carry.
 */
export function shapeEnumOptions(schema: unknown, key: string): string[] {
  const shape = resolvePropsShape(schema);
  if (!shape) return [];

  let node = shape[key] as EnumCarrier | undefined;
  for (let depth = 0; node && depth <= MAX_WRAPPER_DEPTH; depth += 1) {
    const options = node.options;
    // Not filtered to strings: the four converging call sites did not filter
    // either, and dropping a non-string member here would narrow a vocabulary
    // silently — the one thing this module exists to stop.
    if (Array.isArray(options)) return [...options] as string[];
    const inner =
      typeof node.unwrap === 'function'
        ? node.unwrap()
        : (node.def?.innerType ?? node._def?.innerType);
    node = inner as EnumCarrier | undefined;
  }
  return [];
}
