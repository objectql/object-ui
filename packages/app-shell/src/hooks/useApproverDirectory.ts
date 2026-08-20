/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * useApproverDirectory — resolve `<kind>:<value>` approver references against
 * the system directory objects, for the surfaces that must NAME an approver
 * (objectui#5414).
 *
 * ## Server-first, and inert by default
 *
 * The producer's own `pending_approver_names` is authoritative and this hook
 * never competes with it: callers pass only the references the server left
 * unresolved. On a backend that resolves everything the ref list is empty, the
 * effect returns before touching the adapter, and the record page issues not one
 * extra request. That gate is why a display fix can afford directory reads at
 * all.
 *
 * ## What it reads, and why the staffing leg is separate
 *
 *   - one `find` per distinct directory OBJECT (`sys_position`, `sys_team`,
 *     `sys_business_unit`, `sys_user`), batched with `$in` over that object's
 *     values — the label leg;
 *   - for `position` refs only, `sys_user_position` -> `sys_user` — the staffing
 *     leg, which answers "who actually sits in this seat" and, when it comes
 *     back empty, the unstaffed state objectui#5414 asks to surface.
 *
 * The two legs fail INDEPENDENTLY. A business-app reader may hold list access to
 * `sys_position` and none to `sys_user_position`; `find` rejects that with
 * `OBJECT_API_DISABLED` rather than an empty page. Folding the legs together
 * would let a permission error render as `销售经理(暂无在岗人员)` — a fabricated
 * fact on a governance surface. A failed staffing leg therefore leaves `holders`
 * `undefined` (unknown), which `approverDisplay` renders as silence, while the
 * label it did resolve still lands.
 *
 * ## The module-level cache
 *
 * `DeclaredActionsBar` mounts one component PER declared action, each asking
 * about the same slate; the panel asks again. Without dedupe an override on a
 * three-action request would fan one answer into a dozen requests. The cache is
 * keyed by the reference string and lives for the page session — a display
 * label, not a decision input, so a position renamed mid-session reading stale
 * until reload is the correct trade. `resetApproverDirectoryCache()` exists for
 * tests, which must not inherit each other's answers.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdapter } from '@object-ui/react';
import {
  APPROVER_DIRECTORY_BINDINGS,
  PERSON_DISPLAY_FIELDS,
  parseApproverRef,
  rowLabel,
  type ResolvedApprover,
} from '../utils/approverIdentity.js';

/** The directory answers for a slate of references, keyed by the raw reference. */
export type ApproverDirectory = Record<string, ResolvedApprover>;

/** Junction carrying "user U holds position P" (ADR-0090 D3). */
const USER_POSITION_OBJECT = 'sys_user_position';
/** `sys_user_position.position` stores the position MACHINE NAME, not its id. */
const USER_POSITION_NAME_FIELD = 'position';
const USER_POSITION_USER_FIELD = 'user_id';
const PERSON_OBJECT = 'sys_user';

const CACHE = new Map<string, ResolvedApprover>();
const INFLIGHT = new Map<string, Promise<void>>();

/** Drop every memoized answer — tests only; see this module's docstring. */
export function resetApproverDirectoryCache(): void {
  CACHE.clear();
  INFLIGHT.clear();
}

/** `find()` answers as a bare array or under one of several envelope keys. */
const asArray = (res: any): any[] =>
  Array.isArray(res) ? res : res?.records ?? res?.items ?? res?.data ?? [];

/**
 * Resolve the label leg for every reference of one directory kind.
 * Rejects propagate to {@link loadSlate}, which isolates each kind.
 */
async function resolveLabels(
  adapter: any,
  kind: string,
  values: string[],
  into: Map<string, ResolvedApprover>,
): Promise<void> {
  const binding = APPROVER_DIRECTORY_BINDINGS[kind];
  if (!binding) return;
  const rows = asArray(
    await adapter.find(binding.object, {
      $filter: { [binding.valueField]: { $in: values } },
      $top: 200,
    }),
  );
  for (const row of rows) {
    const key = row?.[binding.valueField];
    if (key == null) continue;
    const label = rowLabel(row, binding.displayFields);
    if (!label) continue;
    const ref = `${kind}:${String(key)}`;
    into.set(ref, { ...into.get(ref), label });
  }
}

/**
 * Resolve the staffing leg for `position:` references — who sits in each seat.
 * A seat that the junction never mentions is recorded as `[]` (probed, empty),
 * which is what makes the unstaffed state sayable; a REJECTION leaves every
 * seat's `holders` untouched, i.e. unknown.
 */
async function resolveStaffing(
  adapter: any,
  positionNames: string[],
  into: Map<string, ResolvedApprover>,
): Promise<void> {
  const assignments = asArray(
    await adapter.find(USER_POSITION_OBJECT, {
      $filter: { [USER_POSITION_NAME_FIELD]: { $in: positionNames } },
      $top: 500,
    }),
  );
  const userIdsByPosition = new Map<string, string[]>();
  for (const name of positionNames) userIdsByPosition.set(name, []);
  for (const a of assignments) {
    const name = a?.[USER_POSITION_NAME_FIELD];
    const uid = a?.[USER_POSITION_USER_FIELD];
    if (name == null || uid == null) continue;
    const bucket = userIdsByPosition.get(String(name));
    if (bucket && !bucket.includes(String(uid))) bucket.push(String(uid));
  }

  const allIds = [...new Set([...userIdsByPosition.values()].flat())];
  const nameById = new Map<string, string>();
  if (allIds.length > 0) {
    const people = asArray(
      await adapter.find(PERSON_OBJECT, { $filter: { id: { $in: allIds } }, $top: 500 }),
    );
    for (const p of people) {
      if (p?.id == null) continue;
      nameById.set(String(p.id), rowLabel(p, PERSON_DISPLAY_FIELDS) || String(p.id));
    }
  }

  for (const [name, ids] of userIdsByPosition) {
    const ref = `position:${name}`;
    into.set(ref, { ...into.get(ref), holders: ids.map((id) => nameById.get(id) ?? id) });
  }
}

/**
 * Resolve one slate of references, writing every answer into the shared cache.
 *
 * Each leg is isolated: a kind whose object the viewer cannot list must not cost
 * the other kinds their labels, and a failed staffing leg must not cost the
 * position its label. Every reference asked about is written back even when
 * nothing resolved, so a second mount does not re-ask a question the directory
 * has already declined to answer.
 */
async function loadSlate(adapter: any, refs: string[]): Promise<void> {
  const answers = new Map<string, ResolvedApprover>();
  const valuesByKind = new Map<string, string[]>();
  for (const raw of refs) {
    const ref = parseApproverRef(raw);
    if (!ref || !APPROVER_DIRECTORY_BINDINGS[ref.kind]) continue;
    const bucket = valuesByKind.get(ref.kind) ?? [];
    if (!bucket.includes(ref.value)) bucket.push(ref.value);
    valuesByKind.set(ref.kind, bucket);
  }

  await Promise.all(
    [...valuesByKind].map(([kind, values]) =>
      resolveLabels(adapter, kind, values, answers).catch(() => {
        /* label leg unavailable — the prettified machine name still reads */
      }),
    ),
  );

  const positions = valuesByKind.get('position');
  if (positions && positions.length > 0) {
    await resolveStaffing(adapter, positions, answers).catch(() => {
      /* staffing unknown — NOT the same claim as "the seat is empty" */
    });
  }

  for (const raw of refs) CACHE.set(raw, answers.get(raw) ?? {});
}

/**
 * Directory answers for `refs`, resolved once per page session.
 *
 * Pass `[]` (or only server-unresolved references) to keep the hook inert.
 */
export function useApproverDirectory(refs: readonly string[]): ApproverDirectory {
  const adapter = useAdapter() as any;
  // Sorted + de-duplicated so a re-render that reorders the slate does not
  // re-run the effect, and so the in-flight key is stable across callers.
  const wanted = useMemo(() => [...new Set(refs)].filter(Boolean).sort(), [refs]);
  const key = wanted.join('|');
  const [tick, bump] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    if (!adapter || wanted.length === 0) return;
    const missing = wanted.filter((r) => !CACHE.has(r));
    if (missing.length === 0) return;
    const batch = missing.join('|');
    let pending = INFLIGHT.get(batch);
    if (!pending) {
      pending = loadSlate(adapter, missing).finally(() => INFLIGHT.delete(batch));
      INFLIGHT.set(batch, pending);
    }
    void pending.then(() => { if (alive.current) bump((n) => n + 1); });
    // `key` is the stable identity of `wanted`; listing the array itself would
    // re-run on every render that rebuilds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, key]);

  return useMemo(() => {
    const out: ApproverDirectory = {};
    for (const r of wanted) {
      const hit = CACHE.get(r);
      if (hit) out[r] = hit;
    }
    return out;
    // `tick` is bumped when a load settles; `key` identifies the slate. The
    // cache itself is module state and cannot be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
}
