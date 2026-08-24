// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Which fields of an object the app author declared `hidden: true`
 * (objectui#5565).
 *
 * ## What this exists to enforce, and why here
 *
 * `hidden: true` is a **UI contract** — "hidden from the default UI" — and the
 * maintainer's ruling on objectstack#10749 pinned it there: *`hidden: true`
 * stays UI-only; `internal: true` is the serialization primitive*. A field an
 * author wants off the wire entirely is declared `internal: true` and never
 * reaches a client at all; a field-level access control is FLS, which the
 * server applies at serve time (`getReadableFields`, objectstack#11039).
 *
 * `hidden` is neither of those. The producer is **correct** to ship a `hidden`
 * field in an approval request's `payload_json` snapshot, so the UI is not
 * compensating for a bad producer when it declines to render it — the UI is
 * the *only* place that contract lives, and the Approvals drawer's business
 * summary card is default UI. That is why the trim is here and not in
 * `@objectstack/plugin-approvals`.
 *
 * ⛔ Do not extend this to `internal`. They are distinct primitives with
 * distinct meanings, and conflating them here would re-introduce the
 * serialization semantic the ruling refused.
 *
 * ## ⚠️ This is a presentation filter, NOT an access control
 *
 * The server stays the only authority on what a principal may read, and it has
 * already answered by the time a payload reaches this page. So an *unanswered*
 * metadata read leaves the declaration unknown, and an unknown declaration
 * renders the field — the same fail-open direction as `recordReadability` on
 * this page, and for the same reason: degrading an approver's decision surface
 * on a transient metadata error would break the primary workflow to enforce a
 * declaration that was never the security boundary. (Contrast objectui#5553's
 * raw-JSON panel, which fails CLOSED — there the measured defect *was* a
 * non-holder seeing the panel, so absence of an answer had to deny.)
 *
 * ## Cost
 *
 * One `getObjectSchema(objectName)` per distinct object, per mount. The read is
 * `GET /api/v1/meta/object/:name` — the same read the record form and detail
 * view already perform for any business user — and it lands on the adapter's
 * own `MetadataCache` (LRU, 5-minute TTL, in-flight de-duplication), so
 * repeated drawer opens on one object cost zero round trips. On top of that
 * this hook keeps a per-mount resolved map, so re-renders (the page's 60s
 * clock, search typing, a drawer re-opening) cost nothing at all.
 *
 * Invalidation is therefore: the adapter cache's TTL, an explicit adapter
 * `clearCache()` (which the shell issues on a locale switch), or a page
 * reload. A `hidden` flag flipped in Studio while this page is open is picked
 * up on the next reload — the same staleness `useRecordReadability` accepts,
 * and it is a presentation flag, not a grant.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdapter } from '@object-ui/app-shell';

/**
 * Minimal structural view of the metadata source this needs. Declared here
 * rather than importing the adapter type so the reader is testable with a
 * counting stub — and so it can never reach for anything but a schema read.
 *
 * `getObjectSchema` is optional on purpose: `DataSource` implementations that
 * cannot describe an object simply do not have it, and that is an *unknown*
 * answer, not an empty one.
 */
export interface HiddenFieldsSource {
  getObjectSchema?(objectName: string): Promise<unknown>;
}

/** Nothing declared hidden — also the "we do not know" answer. See the header. */
const NONE: ReadonlySet<string> = new Set<string>();

/** The empty answer, as a shared instance, so consumers can memo on identity. */
export const NO_HIDDEN_FIELDS = NONE;

/**
 * Field names an object schema declares `hidden: true`.
 *
 * `fields` arrives in either shape the platform serves: the record shape
 * (`{ name: def }`, the `*.object.ts` spec shape) or the array shape
 * (`[{ name, ...def }]`, the objectql shape). Both are read; anything else
 * yields the empty set.
 *
 * Strictly `=== true`. A truthy-but-not-true value (a string `'false'`, a `1`)
 * is not a declaration this can act on, and guessing at one would hide a field
 * the author never asked to hide.
 */
export function hiddenFieldNames(schema: unknown): ReadonlySet<string> {
  const fields = (schema as { fields?: unknown } | null | undefined)?.fields;
  if (!fields || typeof fields !== 'object') return NONE;
  const out = new Set<string>();
  if (Array.isArray(fields)) {
    for (const entry of fields) {
      if (!entry || typeof entry !== 'object') continue;
      const def = entry as Record<string, unknown>;
      const name = def.name;
      if (typeof name === 'string' && name !== '' && def.hidden === true) out.add(name);
    }
  } else {
    for (const [name, def] of Object.entries(fields as Record<string, unknown>)) {
      if (!def || typeof def !== 'object') continue;
      if ((def as Record<string, unknown>).hidden === true) out.add(name);
    }
  }
  return out.size > 0 ? out : NONE;
}

/**
 * Read one object's hidden-field declaration.
 *
 * Never rejects: a source that cannot answer — no `getObjectSchema`, a 404, a
 * transport error, a principal without metadata read — resolves to the empty
 * set, which is the unknown answer the caller fails open on.
 */
export async function readHiddenFields(
  source: HiddenFieldsSource | null | undefined,
  objectName: string,
): Promise<ReadonlySet<string>> {
  if (typeof source?.getObjectSchema !== 'function') return NONE;
  try {
    return hiddenFieldNames(await source.getObjectSchema(objectName));
  } catch {
    // Unknown, so the caller renders the field. Deliberately silent: a viewer
    // without metadata access to the object hits this on every drawer open,
    // and a console error per open would be noise, not a signal.
    return NONE;
  }
}

/**
 * The hidden-field set for `objectName`, resolved once per mount.
 *
 * Returns the empty set until the read answers, so the first paint of a drawer
 * renders exactly what it renders today and the trim applies as soon as the
 * declaration is known. Callers must treat the empty set as "nothing known to
 * be hidden" — see the header on failing open.
 */
export function useHiddenFields(objectName: string | null | undefined): ReadonlySet<string> {
  const adapter = useAdapter() as HiddenFieldsSource | null | undefined;
  const [known, setKnown] = useState<ReadonlyMap<string, ReadonlySet<string>>>(() => new Map());
  /** Object names already handed to a read — the "read once" ledger. */
  const attempted = useRef<Set<string>>(new Set());

  const name = typeof objectName === 'string' && objectName !== '' ? objectName : null;

  useEffect(() => {
    if (!adapter || !name || attempted.current.has(name)) return;
    attempted.current.add(name);
    let cancelled = false;
    void readHiddenFields(adapter, name).then((hidden) => {
      if (cancelled) return;
      setKnown((prev) => {
        const next = new Map(prev);
        next.set(name, hidden);
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [adapter, name]);

  return useMemo(() => (name ? known.get(name) ?? NONE : NONE), [known, name]);
}
