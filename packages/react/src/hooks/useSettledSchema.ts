/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useState } from 'react';
import type { DataSource } from '@object-ui/types';

/**
 * The settled result of `{@link useSettledSchema}`: whether the object
 * definition for the CURRENT key has finished resolving, and the definition
 * itself once it has.
 *
 * `ready` is never a fact about "a fetch completed" in isolation — it is
 * "a fetch completed FOR THE OBJECT THIS RENDER IS ASKING ABOUT". See the
 * hook's own doc comment for why that distinction is the entire point.
 */
export interface SettledSchema<TDef = unknown> {
  /**
   * `true` once the object definition for the key passed to this render has
   * settled — successfully, with a thrown read, or because there was no
   * source to read from. `false` while it is still in flight, and also
   * `false` for exactly one render right after `key` changes, even if a
   * PREVIOUS key's resolution is sitting in state (objectui#6481's defect,
   * made unwritable — see the hook doc comment).
   */
  ready: boolean;
  /**
   * The resolved definition once `ready` is `true`, otherwise `null`.
   * `null` while `ready` is `true` is a legitimate, DISTINCT outcome from
   * "not ready yet" — it means the resolution settled with nothing (no
   * `dataSource`, no `getObjectSchema`, no key, or a read that threw), not
   * that the read never happened.
   */
  def: TDef | null;
}

/**
 * Resolves an object's schema/definition and tracks whether that resolution
 * has SETTLED for the object CURRENTLY being asked about — one piece of
 * state a caller cannot observe half of.
 *
 * ## The shape, and why it is exactly this one
 *
 * This is the RESOLUTION half of the settled-schema gate four views
 * (`ObjectKanban`, `ObjectView`, `ObjectCalendar`, and — pre-fix —
 * `ObjectTree`) each hand-wrote (objectui#6271, #6419, #6453, #6014). Ruled
 * objectui#6482 (maintainer, 2026-08-27, Option A): extract the resolution
 * half as a shared, published hook; leave GATE PLACEMENT — deciding which
 * effect branch actually waits on `ready` — to each component, because that
 * part is genuinely component-private (`ObjectCalendar` gates only its
 * `object`-provider branch and keys on the object the block RESOLVES rather
 * than on `schema.objectName`, because an inline `value` data set issues no
 * metadata read at all — a whole-effect gate would hold its query open on a
 * resolution nothing was ever going to produce).
 *
 * `ready` is DERIVED at render time — `resolution !== null && resolution.key
 * === key` — from a SINGLE piece of state, `{ key, def } | null`, rather than
 * stored as a second, independent boolean. That is not a style choice; it is
 * the fix for the defect this card exists to close. objectui#6481's
 * `ObjectTree` carried the definition (`objectSchema`) and "has it settled"
 * (`schemaSettled`) as two SEPARATE `useState`s. `schemaSettled` was a
 * one-way latch — set `true` on first settle and never reset — so when the
 * host swapped `objectName` mid-life, the fetch effect re-ran and started
 * refetching the NEW object's schema, but `schemaSettled` stayed `true` from
 * the OLD object's settle. The gated effect read `schemaSettled === true`
 * and `objectSchema` still holding the OLD object's fields, and queried with
 * the WRONG `$expand` — a stale key reading as ready.
 *
 * With one state value and a render-time key comparison, that failure mode
 * is not merely fixed, it is UNREPRESENTABLE: the instant `key` changes,
 * `resolution.key === key` is false in that very render (no effect needs to
 * run first), so `ready` flips to `false` in the same commit the key
 * changed — there is no window, and no second piece of state a caller could
 * read out of sync with the first, because there is no second piece of
 * state. A caller cannot spell "ready for the wrong object": `ready` and
 * `def` are two views of one value, never independently settable.
 *
 * Every exit of the internal fetch effect settles the resolution — success,
 * a thrown read, and "there is no source to read from" alike — because a
 * caller's gated effect WAITS on `ready`. An exit that returned without
 * settling would not merely skip the expansion; it would hold that gated
 * query open forever.
 *
 * ## What this hook does NOT do
 *
 * It does not decide when to fetch beyond "when `key` or `dataSource`
 * change", and it does not decide what a caller's OTHER effects should wait
 * on. A caller that should not fetch at all for the current render (e.g.
 * `ObjectCalendar`'s inline `value` provider, which issues no metadata read)
 * passes `dataSource: undefined` for that render rather than a new "should
 * fetch" flag — the hook already settles-with-`null` whenever `dataSource`
 * is absent, which is the exact "no source to read from" outcome that case
 * needs.
 *
 * @param key - The identity of the object THIS render is asking about — for a
 *   record-bound view, `resolveRecordSourceObjectName(schema, dataConfig) ?? ''`
 *   from `@object-ui/core`. ⛔ Do NOT re-spell that ladder inline here: six view
 *   plugins each carried their own copy and had drifted, which is the whole of
 *   objectui#7627. Choosing the key is still the caller's job — it is the
 *   component-private half of the original hand copies, not something this hook
 *   can infer — but the ladder behind it is published and shared.
 * @param dataSource - The data source to read the definition from. Pass
 *   `undefined`/`null` for a render that should settle immediately with no
 *   definition (no source, or a provider that needs none) rather than adding
 *   a separate enable flag.
 * @returns `{ ready, def }` — see {@link SettledSchema}.
 *
 * @example
 * ```tsx
 * const schemaKey = resolveRecordSourceObjectName(schema, dataConfig); // @object-ui/core
 * const { ready: objectSchemaReady, def: objectSchema } =
 *   useSettledSchema(schemaKey ?? '', hasInlineData ? undefined : dataSource);
 *
 * useEffect(() => {
 *   // A PROVIDER test, not an object-name read — it asks "is there metadata to
 *   // wait for at all", which the shared reader deliberately does not answer.
 *   // Gate placement stays local (objectui#6482); the ladder does not.
 *   if (dataConfig?.provider === 'object' && !objectSchemaReady) return;
 *   // ...issue the record query, `buildExpandFields(objectSchema?.fields)`
 * }, [objectSchemaReady, objectSchema, /* ... *\/]);
 * ```
 */
export function useSettledSchema<TDef = unknown>(
  key: string,
  dataSource: DataSource<any> | null | undefined,
): SettledSchema<TDef> {
  const [resolution, setResolution] = useState<{ key: string; def: TDef | null } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const settleKey = key;

    const resolve = async () => {
      if (!dataSource || !settleKey || typeof dataSource.getObjectSchema !== 'function') {
        // No source for a definition: settle with none, so anything gated on
        // `ready` still runs (unexpanded — with no schema there is no expand
        // set to derive).
        if (isMounted) setResolution({ key: settleKey, def: null });
        return;
      }
      try {
        const def = await dataSource.getObjectSchema(settleKey);
        if (isMounted) setResolution({ key: settleKey, def: def as TDef });
      } catch (err) {
        console.error('[useSettledSchema] getObjectSchema failed for', settleKey, err);
        if (isMounted) setResolution({ key: settleKey, def: null });
      }
    };

    resolve();
    return () => {
      isMounted = false;
    };
  }, [key, dataSource]);

  const ready = resolution !== null && resolution.key === key;
  const def = ready ? (resolution as { key: string; def: TDef | null }).def : null;

  return { ready, def };
}
